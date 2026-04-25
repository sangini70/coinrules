import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AppSettings, Position, TradeHistory, TradeControlState, PositionStatus, ResultType, ObservationSignal } from '../types';
import { isSameDay } from 'date-fns';
import { ko } from '../i18n/ko';
import { en } from '../i18n/en';
import { Translation } from '../i18n/types';
import { analyzeSignal } from '../lib/signals';
import {
  DEFAULT_SHORT_TERM_STOP_LOSS_PERCENT,
  DEFAULT_SHORT_TERM_TAKE_PROFIT_PERCENT,
} from '../lib/tradingRules';
import { fetchCandles } from '../services/upbitService';

interface AppStore {
  settings: AppSettings;
  activePositions: Position[];
  history: TradeHistory[];
  control: TradeControlState;
  language: 'ko' | 'en';
  signals: Record<string, ObservationSignal>;
  signalBuffer: Record<string, ObservationSignal[]>; // For debouncing
  lastPlayed: Record<string, number>; // throttle for sound

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
}

export interface PersistedAppState {
  settings: AppSettings;
  activePositions: Position[];
  history: TradeHistory[];
  control: TradeControlState;
  language: 'ko' | 'en';
}

const DEFAULT_SETTINGS: AppSettings = {
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

const DEFAULT_CONTROL: TradeControlState = {
  todayTradeCount: 0,
  consecutiveLossCount: 0,
  isInputDisabled: false,
  cooldowns: {},
  lastTradeDate: new Date().toISOString().split('T')[0],
};

function sanitizePersistedAppState(input: any): PersistedAppState {
  return {
    settings: input?.settings ?? DEFAULT_SETTINGS,
    activePositions: input?.activePositions ?? [],
    history: input?.history ?? [],
    control: input?.control ?? DEFAULT_CONTROL,
    language: input?.language ?? 'ko',
  };
}

const MONITORED_COINS = ['KRW-BTC', 'KRW-ETH', 'KRW-SOL', 'KRW-XRP', 'KRW-ADA', 'KRW-DOGE', 'KRW-AVAX'];

const createSafeSignal = (signal?: Partial<ObservationSignal>): ObservationSignal => ({
  breakout: signal?.breakout ?? 'none',
  state: signal?.state ?? 'WAIT',
  trend: signal?.trend ?? 'neutral',
  volume: signal?.volume ?? 'normal',
  updatedAt: signal?.updatedAt ?? new Date().toISOString(),
});

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      settings: DEFAULT_SETTINGS,
      activePositions: [],
      history: [],
      control: DEFAULT_CONTROL,
      language: 'ko',
      signals: {},
      signalBuffer: {},
      lastPlayed: {},

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

      setLanguage: (language) => set({ language }),

      updateSettings: (newSettings) => set((state) => ({ settings: { ...state.settings, ...newSettings } })),

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
      },

      closePosition: (id: string, sellPrice: number, resultType: ResultType, reasonSell: string) => {
        const { activePositions, control, settings, history, signals } = get();
        const pos = activePositions.find((p) => p.id === id);
        if (!pos) return;

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
          signalSnapshot: signals[pos.coin],
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
      },

      deletePosition: (id) => set((state) => ({
        activePositions: state.activePositions.filter((p) => p.id !== id)
      })),

      checkControlReset: () => {
        const { control } = get();
        const today = new Date().toISOString().split('T')[0];
        if (control.lastTradeDate !== today) {
          set({
            control: {
              ...DEFAULT_CONTROL,
              cooldowns: control.cooldowns, // Keep cooldowns across days? Usually yes for a few mins
              lastTradeDate: today,
            },
          });
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
        set({
          settings: nextState.settings,
          activePositions: nextState.activePositions,
          history: nextState.history,
          control: nextState.control,
          language: nextState.language,
        });
      },

      importData: (json) => {
        try {
          const data = JSON.parse(json) as PersistedAppState;
          const nextState = sanitizePersistedAppState(data);
          set({
            settings: nextState.settings,
            activePositions: nextState.activePositions,
            history: nextState.history,
            control: nextState.control,
            language: nextState.language,
          });
          return true;
        } catch (e) {
          console.error('Import failed', e);
          return false;
        }
      },

      resetAll: () => set({
        settings: DEFAULT_SETTINGS,
        activePositions: [],
        history: [],
        control: DEFAULT_CONTROL,
      }),
    }),
    {
      name: 'coin-rules-storage',
    }
  )
);
