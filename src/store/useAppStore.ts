import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AppSettings, Position, TradeHistory, TradeControlState, PositionStatus, ResultType, ObservationSignal } from '../types';
import { isSameDay } from 'date-fns';
import { ko } from '../i18n/ko';
import { en } from '../i18n/en';
import { Translation } from '../i18n/types';
import { analyzeSignal } from '../lib/signals';

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
}

const DEFAULT_SETTINGS: AppSettings = {
  stopLossPercent: -3,
  takeProfitPercent: 5,
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
        try {
          const response = await fetch(`https://api.upbit.com/v1/candles/minutes/15?market=${coin}&count=100`);
          if (!response.ok) throw new Error('Signals fetch failed');
          const candles = await response.json();
          if (Array.isArray(candles) && candles.length > 50) {
            const rawSignal = analyzeSignal(candles);
            const { signalBuffer, signals } = get();
            
            const buffer = signalBuffer[coin] || [];
            const newBuffer = [...buffer, rawSignal].slice(-3); // Keep last 3
            
            set((state) => ({
              signalBuffer: { ...state.signalBuffer, [coin]: newBuffer }
            }));

            // Debounce: all 3 must be same
            if (newBuffer.length === 3 && newBuffer.every(s => s.state === rawSignal.state)) {
              set((state) => ({
                signals: { 
                  ...state.signals, 
                  [coin]: { ...rawSignal, updatedAt: new Date().toISOString() } 
                }
              }));
            }
          }
        } catch (e) {
          console.warn(`Signals fetch failed for ${coin}, using safe fallback. (Reason: ${e instanceof Error ? e.message : 'Unknown'})`);
          
          // Basic Mock Detection for preview stability
          const mockSignal: ObservationSignal = {
            trend: 'up',
            volume: 'normal',
            breakout: 'none',
            state: 'RISK',
            updatedAt: new Date().toISOString()
          };
          
          set((state) => ({
            signals: { ...state.signals, [coin]: mockSignal }
          }));
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
        const { settings, activePositions, history, control } = get();
        return JSON.stringify({ settings, activePositions, history, control }, null, 2);
      },

      importData: (json) => {
        try {
          const data = JSON.parse(json);
          set({
            settings: data.settings || DEFAULT_SETTINGS,
            activePositions: data.activePositions || [],
            history: data.history || [],
            control: data.control || DEFAULT_CONTROL,
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
