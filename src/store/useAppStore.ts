import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  AppSettings,
  Position,
  TradeHistory,
  TradeControlState,
  PositionStatus,
  ResultType,
  ObservationSignal,
  StoredTrade,
  Trade,
  TradeAnalysis,
  TradeMarket,
} from '../types';
import { isSameDay } from 'date-fns';
import { ko } from '../i18n/ko';
import { en } from '../i18n/en';
import { Translation } from '../i18n/types';
import { analyzeSignal } from '../lib/signals';
import { analyzeTrades, isClosedTrade } from '../lib/tradeAnalytics';
import {
  DEFAULT_SHORT_TERM_STOP_LOSS_PERCENT,
  DEFAULT_SHORT_TERM_TAKE_PROFIT_PERCENT,
} from '../lib/tradingRules';
import { fetchCandles } from '../services/upbitService';
import { auth, db } from '../lib/firebase';
import { collection, doc, getDocs, setDoc } from 'firebase/firestore';

interface AppStore {
  settings: AppSettings;
  activePositions: Position[];
  history: TradeHistory[];
  control: TradeControlState;
  language: 'ko' | 'en';
  signals: Record<string, ObservationSignal>;
  signalBuffer: Record<string, ObservationSignal[]>; // For debouncing
  lastPlayed: Record<string, number>; // throttle for sound
  trades: StoredTrade[];
  tradeAnalysis: TradeAnalysis;

  // Actions
  updateSettings: (settings: Partial<AppSettings>) => void;
  addPosition: (position: Omit<Position, 'id' | 'createdAt' | 'isLocked'> & { isLocked?: boolean }) => void;
  closePosition: (id: string, sellPrice: number, resultType: ResultType, reasonSell: string) => void;
  deletePosition: (id: string) => void;
  setLanguage: (lang: 'ko' | 'en') => void;
  t: () => (key: keyof Translation) => string;
  fetchSignals: (coin: string) => Promise<void>;
  playSound: (type: 'warning' | 'notify') => void;
  
  // Rule Engine Helpers
  checkControlReset: () => void;
  isCoinInCooldown: (coin: string) => boolean;
  getCooldownRemaining: (coin: string) => number; // seconds
  
  // Backup
  exportData: () => string;
  importData: (json: string) => boolean;
  resetAll: () => void;
  getAppStateSnapshot: () => PersistedAppState;
  applyAppStateSnapshot: (snapshot: Partial<PersistedAppState>) => void;
  loadTrades: () => Promise<void>;
  addTrade: (tradeId: string, trade: Trade) => Promise<void>;
  updateTrade: (
    tradeId: string,
    updates: Pick<Trade, 'exitPrice' | 'exitTime' | 'result' | 'pnlPercent'>,
  ) => Promise<void>;
  clearTrades: () => void;
}

export interface PersistedAppState {
  settings: AppSettings;
  activePositions: Position[];
  history: TradeHistory[];
  control: TradeControlState;
  language: 'ko' | 'en';
}

export const DEFAULT_SETTINGS: AppSettings = {
  stopLossPercent: DEFAULT_SHORT_TERM_STOP_LOSS_PERCENT,
  takeProfitPercent: DEFAULT_SHORT_TERM_TAKE_PROFIT_PERCENT,
  breakevenTriggerPercent: 3,
  maxDailyTrades: 3,
  maxConsecutiveLosses: 2,
  cooldownMinutes: 15,
  enableSound: false,
  enableVibration: false,
  notifyStopLoss: false,
  notifyCooldown: false,
  volume: 30,
  masterMute: false,
  theme: 'light',
};

export const DEFAULT_CONTROL: TradeControlState = {
  todayTradeCount: 0,
  consecutiveLossCount: 0,
  isInputDisabled: false,
  cooldowns: {},
  lastTradeDate: new Date().toISOString().split('T')[0],
};

export const DEFAULT_SIGNAL: ObservationSignal = {
  breakout: 'none',
  state: 'WAIT',
  trend: 'neutral',
  volume: 'normal',
  updatedAt: new Date(0).toISOString(),
};

export const EMPTY_TRADE_ANALYSIS: TradeAnalysis = {
  total: 0,
  winRate: 0,
  avgWin: 0,
  avgLoss: 0,
  rr: 0,
};

export const DEFAULT_STATE = {
  settings: DEFAULT_SETTINGS,
  activePositions: [] as Position[],
  history: [] as TradeHistory[],
  control: DEFAULT_CONTROL,
  language: 'ko' as const,
  signals: {} as Record<string, ObservationSignal>,
  signalBuffer: {} as Record<string, ObservationSignal[]>,
  lastPlayed: {} as Record<string, number>,
  trades: [] as StoredTrade[],
  tradeAnalysis: EMPTY_TRADE_ANALYSIS,
};

function sanitizePersistedAppState(input: any): PersistedAppState {
  return {
    settings: { ...DEFAULT_SETTINGS, ...(input?.settings ?? {}) },
    activePositions: Array.isArray(input?.activePositions) ? input.activePositions : [],
    history: Array.isArray(input?.history) ? input.history : [],
    control: {
      ...DEFAULT_CONTROL,
      ...(input?.control ?? {}),
      cooldowns: input?.control?.cooldowns ?? DEFAULT_CONTROL.cooldowns,
    },
    language: input?.language === 'en' ? 'en' : 'ko',
  };
}

const MONITORED_COINS = ['KRW-BTC', 'KRW-ETH', 'KRW-SOL', 'KRW-XRP', 'KRW-ADA', 'KRW-DOGE', 'KRW-AVAX'];

const sortTrades = (trades: StoredTrade[]) =>
  [...trades].sort((a, b) => {
    const timeA = a.exitTime ?? a.entryTime;
    const timeB = b.exitTime ?? b.entryTime;
    return timeB - timeA;
  });

const getTradeMarket = (signal?: ObservationSignal): TradeMarket => {
  if (!signal) return 'range';
  if (signal.breakout === 'bullish_breakout' || signal.trend === 'up') return 'bull';
  if (signal.state === 'RISK') return 'bear';
  return 'range';
};

const createSafeSignal = (signal?: Partial<ObservationSignal>): ObservationSignal => ({
  ...DEFAULT_SIGNAL,
  ...signal,
  updatedAt: signal?.updatedAt ?? new Date().toISOString(),
});

const areSnapshotsEqual = (left: PersistedAppState, right: PersistedAppState) =>
  JSON.stringify(left) === JSON.stringify(right);

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      ...DEFAULT_STATE,

      t: () => {
        const { language } = get();
        const dictionary = language === 'ko' ? ko : en;
        return (key: keyof Translation) => dictionary[key] || key;
      },

      fetchSignals: async (coin) => {
        const targetCoins = Array.from(new Set([...MONITORED_COINS, coin]));

        try {
          await Promise.all(
            targetCoins.map(async (targetCoin) => {
              let rawSignal: ObservationSignal | undefined;

              try {
                const candles = await fetchCandles(targetCoin, 100, 15);
                if (Array.isArray(candles) && candles.length > 50) {
                  rawSignal = analyzeSignal(candles);
                }
              } catch (e) {
                console.warn(
                  `Signals fetch failed for ${targetCoin}, using safe fallback. (Reason: ${e instanceof Error ? e.message : 'Unknown'})`,
                );
              }

              const safeSignal = createSafeSignal(rawSignal);
              const { signalBuffer } = get();
              const buffer = signalBuffer[targetCoin] || [];
              const newBuffer = [...buffer, safeSignal].slice(-3);

              console.log('COIN:', targetCoin);
              console.log('SIGNAL RAW:', rawSignal);
              console.log('SIGNAL FINAL:', safeSignal);

              set((state) => ({
                signalBuffer: { ...state.signalBuffer, [targetCoin]: newBuffer },
                signals: {
                  ...state.signals,
                  [targetCoin]: safeSignal,
                },
              }));
            }),
          );
        } finally {
          // TTL Cleanup for all signals
          const { signals } = get();
          const now = new Date().getTime();
          const cleanedSignals = { ...signals };
          let changed = false;
          Object.keys(cleanedSignals).forEach(c => {
            const sigAt = new Date(cleanedSignals[c].updatedAt).getTime();
            if (now - sigAt > 15 * 60 * 1000) { // 15 mins
              delete cleanedSignals[c];
              changed = true;
            }
          });
          if (changed) {
            set({ signals: cleanedSignals });
          }
        }
      },

      playSound: (type) => {
        const { settings, lastPlayed } = get();
        
        // [6] 긴급 정지 (Master Mute)
        if (settings.masterMute) return;
        
        // [7] 백그라운드 재생 금지
        if (document.hidden) return;

        if (!settings.enableSound && !settings.enableVibration) return;
        
        const now = Date.now();
        const last = lastPlayed[type] || 0;
        
        // [2] 전역 쓰로틀(Throttle) + 이벤트별 쓰로틀 분리
        // Stop Loss 알림 최소 60초, 나머지는 30초 (쿨다운 등)
        const throttleTime = type === 'warning' ? 60000 : 30000;
        if (now - last < throttleTime) return;

        set((state) => ({
          lastPlayed: { ...state.lastPlayed, [type]: now }
        }));

        // [4] 모바일 진동 구현
        if (settings.enableVibration && typeof navigator !== 'undefined' && navigator.vibrate) {
          try {
            navigator.vibrate(80);
          } catch (e) {
            // Silently ignore vibration failures
          }
        }

        if (!settings.enableSound) return;
        if (type === 'warning' && !settings.notifyStopLoss) return;
        if (type === 'notify' && !settings.notifyCooldown) return;

        // Soft Web Audio Synth
        try {
          const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
          if (!AudioContextClass) return;
          
          const ctx = new AudioContextClass();
          
          // [8] 브라우저 autoplay 제한 대응 (Resume context)
          if (ctx.state === 'suspended') {
            ctx.resume();
          }

          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          
          // [5] 음량 및 사용자 제어 추가 (0.0 ~ 1.0)
          const userVolume = (settings.volume || 30) / 100;
          const targetGain = type === 'warning' ? 0.08 * userVolume : 0.08 * userVolume;

          if (type === 'warning') {
            // Soft "ding" - higher pitch (880Hz), short decay
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, ctx.currentTime);
            gain.gain.setValueAtTime(0, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(targetGain, ctx.currentTime + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
          } else {
            // Soft "tok" - lower pitch (220Hz), very short
            osc.type = 'sine';
            osc.frequency.setValueAtTime(220, ctx.currentTime);
            gain.gain.setValueAtTime(0, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(targetGain, ctx.currentTime + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
          }

          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + (type === 'warning' ? 0.6 : 0.4));
          
          // Cleanup
          setTimeout(() => {
            if (ctx.state !== 'closed') ctx.close();
          }, 1000);

        } catch (e) {
          console.warn('Audio play failed', e);
        }
      },

      setLanguage: (language) =>
        set((state) => (state.language === language ? state : { language })),

      updateSettings: (newSettings) =>
        set((state) => {
          const mergedSettings = { ...DEFAULT_SETTINGS, ...state.settings, ...newSettings };
          return JSON.stringify(state.settings) === JSON.stringify(mergedSettings)
            ? state
            : { settings: mergedSettings };
        }),

      addPosition: (pos) => {
        const { control, settings } = get();
        if (control.isInputDisabled) return;
        
        const newPosition: Position = {
          ...pos,
          id: `pos-${Math.random().toString(36).substr(2, 9)}`,
          createdAt: new Date().toISOString(),
          isLocked: pos.isLocked ?? false,
        };

        set((state) => ({
          activePositions: [...state.activePositions, newPosition],
        }));

        const entrySignal = get().signals?.[newPosition.coin] ?? DEFAULT_SIGNAL;

        void get().addTrade(newPosition.id, {
          coin: newPosition.coin,
          strategy: 'EMA_PULLBACK',
          entryPrice: newPosition.buyPrice,
          entryTime: Date.now(),
          market: getTradeMarket(entrySignal),
        });
      },

      closePosition: (id: string, sellPrice: number, resultType: ResultType, reasonSell: string) => {
        const { activePositions, control, settings, history, signals } = get();
        const pos = activePositions.find((p) => p.id === id);
        if (!pos) return;

        const signalSnapshot = signals?.[pos.coin] ?? DEFAULT_SIGNAL;

        const newHistory: TradeHistory = {
          id: `hist-${Math.random().toString(36).substr(2, 9)}`,
          coin: pos.coin,
          type: pos.type,
          buyPrice: pos.buyPrice,
          sellPrice,
          entryAmount: pos.entryAmount,
          quantity: pos.quantity,
          ruleKept: resultType !== 'manual_exit',
          reasonBuy: pos.memo,
          reasonSell,
          resultType,
          date: new Date().toISOString(),
          signalSnapshot,
        };

        // Update control state
        const isLoss = resultType === 'stop_loss';
        const newConsecutiveLoss = isLoss ? control.consecutiveLossCount + 1 : 0;
        const newTradeCount = control.todayTradeCount + 1;
        
        // Cooldown
        const cooldowns = { ...control.cooldowns };
        const cooldownEnd = new Date();
        cooldownEnd.setMinutes(cooldownEnd.getMinutes() + settings.cooldownMinutes);
        cooldowns[pos.coin] = cooldownEnd.toISOString();

        const isInputDisabled = 
          newTradeCount >= settings.maxDailyTrades || 
          newConsecutiveLoss >= settings.maxConsecutiveLosses;

        set((state) => ({
          activePositions: state.activePositions.filter((p) => p.id !== id),
          history: [newHistory, ...state.history],
          control: {
            ...state.control,
            todayTradeCount: newTradeCount,
            consecutiveLossCount: newConsecutiveLoss,
            isInputDisabled,
            cooldowns,
          },
        }));

        const pnlPercent = ((sellPrice / pos.buyPrice) - 1) * 100;
        void get().updateTrade(id, {
          exitPrice: sellPrice,
          exitTime: Date.now(),
          result: pnlPercent >= 0 ? 'win' : 'loss',
          pnlPercent,
        });
      },

      deletePosition: (id) => set((state) => ({
        activePositions: state.activePositions.filter((p) => p.id !== id)
      })),

      checkControlReset: () => {
        const { control } = get();
        const today = new Date().toISOString().split('T')[0];
        if (control.lastTradeDate !== today) {
          const nextControl = {
            ...DEFAULT_CONTROL,
            cooldowns: control.cooldowns,
            lastTradeDate: today,
          };
          if (JSON.stringify(control) !== JSON.stringify(nextControl)) {
            set({ control: nextControl });
          }
        }
      },

      isCoinInCooldown: (coin) => {
        const { control } = get();
        const cooldown = control.cooldowns[coin];
        if (!cooldown) return false;
        return new Date(cooldown) > new Date();
      },

      getCooldownRemaining: (coin) => {
        const { control } = get();
        const cooldown = control.cooldowns[coin];
        if (!cooldown) return 0;
        const diff = new Date(cooldown).getTime() - new Date().getTime();
        return Math.max(0, Math.floor(diff / 1000));
      },

      exportData: () => {
        const { settings, activePositions, history, control, language } = get();
        return JSON.stringify({ settings, activePositions, history, control, language }, null, 2);
      },

      getAppStateSnapshot: () => {
        const { settings, activePositions, history, control, language } = get();
        return sanitizePersistedAppState({ settings, activePositions, history, control, language });
      },

      applyAppStateSnapshot: (snapshot) => {
        const nextState = sanitizePersistedAppState(snapshot);
        set((state) => {
          const currentSnapshot = sanitizePersistedAppState({
            settings: state.settings,
            activePositions: state.activePositions,
            history: state.history,
            control: state.control,
            language: state.language,
          });
          return areSnapshotsEqual(currentSnapshot, nextState)
            ? state
            : {
                settings: nextState.settings,
                activePositions: nextState.activePositions,
                history: nextState.history,
                control: nextState.control,
                language: nextState.language,
              };
        });
      },

      loadTrades: async () => {
        const user = auth.currentUser;
        if (!user) {
          set({ trades: DEFAULT_STATE.trades, tradeAnalysis: DEFAULT_STATE.tradeAnalysis });
          return;
        }

        const tradeSnapshot = await getDocs(collection(db, 'users', user.uid, 'trades'));
        const trades = sortTrades(
          tradeSnapshot.docs.map((tradeDoc) => ({
            id: tradeDoc.id,
            ...(tradeDoc.data() as Trade),
          })),
        );

        set({
          trades,
          tradeAnalysis: analyzeTrades(trades),
        });
      },

      addTrade: async (tradeId, trade) => {
        const user = auth.currentUser;
        if (!user) return;

        await setDoc(doc(db, 'users', user.uid, 'trades', tradeId), trade, { merge: true });

        set((state) => {
          const trades = sortTrades([
            { id: tradeId, ...trade },
            ...state.trades.filter((existingTrade) => existingTrade.id !== tradeId),
          ]);

          return {
            trades,
            tradeAnalysis: analyzeTrades(trades),
          };
        });
      },

      updateTrade: async (tradeId, updates) => {
        const user = auth.currentUser;
        if (!user) return;

        await setDoc(doc(db, 'users', user.uid, 'trades', tradeId), updates, { merge: true });

        set((state) => {
          const trades = sortTrades(
            state.trades.map((trade) =>
              trade.id === tradeId ? { ...trade, ...updates } : trade,
            ),
          );

          return {
            trades,
            tradeAnalysis: analyzeTrades(trades),
          };
        });
      },

      clearTrades: () => set((state) => (
        Array.isArray(state.trades) &&
        state.trades.length === 0 &&
        JSON.stringify(state.tradeAnalysis) === JSON.stringify(DEFAULT_STATE.tradeAnalysis)
          ? state
          : {
              trades: DEFAULT_STATE.trades,
              tradeAnalysis: DEFAULT_STATE.tradeAnalysis,
            }
      )),

      importData: (json) => {
        try {
          const data = JSON.parse(json) as PersistedAppState;
          const nextState = sanitizePersistedAppState(data);
          set((state) => {
            const currentSnapshot = sanitizePersistedAppState({
              settings: state.settings,
              activePositions: state.activePositions,
              history: state.history,
              control: state.control,
              language: state.language,
            });
            return areSnapshotsEqual(currentSnapshot, nextState)
              ? state
              : {
                  settings: nextState.settings,
                  activePositions: nextState.activePositions,
                  history: nextState.history,
                  control: nextState.control,
                  language: nextState.language,
                };
          });
          return true;
        } catch (e) {
          console.error('Import failed', e);
          return false;
        }
      },

      resetAll: () => set((state) => {
        const currentSnapshot = sanitizePersistedAppState({
          settings: state.settings,
          activePositions: state.activePositions,
          history: state.history,
          control: state.control,
          language: state.language,
        });
        const defaultSnapshot = sanitizePersistedAppState(DEFAULT_STATE);

        return areSnapshotsEqual(currentSnapshot, defaultSnapshot) &&
          Object.keys(state.signals ?? {}).length === 0 &&
          Object.keys(state.signalBuffer ?? {}).length === 0 &&
          Object.keys(state.lastPlayed ?? {}).length === 0 &&
          Array.isArray(state.trades) &&
          state.trades.length === 0 &&
          JSON.stringify(state.tradeAnalysis) === JSON.stringify(DEFAULT_STATE.tradeAnalysis)
          ? state
          : {
              settings: DEFAULT_STATE.settings,
              activePositions: DEFAULT_STATE.activePositions,
              history: DEFAULT_STATE.history,
              control: DEFAULT_STATE.control,
              signals: DEFAULT_STATE.signals,
              signalBuffer: DEFAULT_STATE.signalBuffer,
              lastPlayed: DEFAULT_STATE.lastPlayed,
              trades: DEFAULT_STATE.trades,
              tradeAnalysis: DEFAULT_STATE.tradeAnalysis,
              language: DEFAULT_STATE.language,
            };
      }),
    }),
    {
      name: 'coin-rules-storage',
      partialize: (state) => ({
        settings: state.settings,
        activePositions: state.activePositions,
        history: state.history,
        control: state.control,
        language: state.language,
      }),
      merge: (persistedState, currentState) => {
        const persisted = (persistedState as Partial<PersistedAppState> | undefined) ?? {};
        const sanitized = sanitizePersistedAppState(persisted);

        return {
          ...currentState,
          ...DEFAULT_STATE,
          settings: sanitized.settings,
          activePositions: sanitized.activePositions,
          history: sanitized.history,
          control: sanitized.control,
          language: sanitized.language,
          signals: currentState.signals ?? DEFAULT_STATE.signals,
          signalBuffer: currentState.signalBuffer ?? DEFAULT_STATE.signalBuffer,
          lastPlayed: currentState.lastPlayed ?? DEFAULT_STATE.lastPlayed,
          trades: currentState.trades ?? DEFAULT_STATE.trades,
          tradeAnalysis: currentState.tradeAnalysis ?? DEFAULT_STATE.tradeAnalysis,
        };
      },
    }
  )
);
