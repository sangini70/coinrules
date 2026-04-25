import { AppSettings } from '../types';

const ALERT_COOLDOWN_MS = 60_000;
const lastAlertAtByCoin = new Map<string, number>();

export interface AlertSignal {
  isBreakout: boolean;
  isVolumeSpike: boolean;
  isFakeout: boolean;
  score: number;
}

export const shouldTriggerAlert = (
  coin: string,
  signal: AlertSignal,
  settings: AppSettings,
  now = Date.now(),
) => {
  const lastAlertAt = lastAlertAtByCoin.get(coin) ?? 0;
  const isCoolingDown = now - lastAlertAt < ALERT_COOLDOWN_MS;

  return (
    settings.alertEnabled === true &&
    signal.isBreakout === true &&
    signal.isVolumeSpike === true &&
    signal.isFakeout !== true &&
    signal.score >= 70 &&
    !isCoolingDown
  );
};

export const triggerAlert = (coin: string, signal: AlertSignal, settings: AppSettings) => {
  const now = Date.now();
  if (!shouldTriggerAlert(coin, signal, settings, now)) return false;

  lastAlertAtByCoin.set(coin, now);

  if (settings.enableVibration && typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(120);
    } catch (error) {
      console.warn('Alert vibration failed.', error);
    }
  }

  if (settings.enableSound && !settings.masterMute) {
    try {
      const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return true;

      const ctx = new AudioContextClass();
      if (ctx.state === 'suspended') {
        void ctx.resume().catch((error) => {
          console.warn('Alert audio resume failed.', error);
        });
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const volume = Math.max(0, Math.min(1, (settings.volume ?? 30) / 100));

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(980, ctx.currentTime);
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.12 * volume, ctx.currentTime + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);

      window.setTimeout(() => {
        if (ctx.state !== 'closed') {
          void ctx.close().catch((error) => {
            console.warn('Alert audio close failed.', error);
          });
        }
      }, 900);
    } catch (error) {
      console.warn('Alert sound failed.', error);
    }
  }

  return true;
};
