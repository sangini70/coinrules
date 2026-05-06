import { AppSettings } from '../types';

const ALERT_COOLDOWN_MS = 60_000;
const lastAlertAtByCoin = new Map<string, number>();
const EMAIL_ENDPOINT = '/api/alerts/email';

export interface AlertSignal {
  isBreakout: boolean;
  isFakeout: boolean;
  score: number;
}

export type AlertLevel = 'none' | 'prepare' | 'entry';

const getKoreaHour = (date = new Date()) =>
  Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Seoul',
      hour: '2-digit',
      hour12: false,
    }).format(date),
  );

const isWithinAlertWindow = (settings: AppSettings, now = new Date()) => {
  const hour = getKoreaHour(now);
  const start = Math.max(0, Math.min(23, settings.alertStartHour ?? 21));
  const end = Math.max(0, Math.min(23, settings.alertEndHour ?? 2));

  if (start === end) return true;
  if (start < end) return hour >= start && hour < end;
  return hour >= start || hour < end;
};

export const getAlertLevel = (signal: AlertSignal): AlertLevel => {
  if (signal.score >= 70) return 'entry';
  if (signal.score >= 40) return 'prepare';
  return 'none';
};

const buildEmailPayload = (coin: string, signal: AlertSignal, level: AlertLevel) => {
  const utcNow = new Date().toISOString();
  const krwCoin = coin.startsWith('KRW-') ? coin : `KRW-${coin}`;
  const subject = `[Upbit] ${krwCoin} ${level.toUpperCase()} signal`;
  const text = [
    `Coin: ${krwCoin}`,
    `Level: ${level}`,
    `Score: ${signal.score}`,
    `Breakout: ${signal.isBreakout ? 'yes' : 'no'}`,
    `Fakeout: ${signal.isFakeout ? 'yes' : 'no'}`,
    `Time(UTC): ${utcNow}`,
  ].join('\n');

  return { subject, text };
};

const sendSignalEmail = async (coin: string, signal: AlertSignal, level: AlertLevel) => {
  try {
    const payload = buildEmailPayload(coin, signal, level);
    const response = await fetch(EMAIL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      console.warn('Signal email request failed.', response.status, response.statusText, body);
    }
  } catch (error) {
    console.warn('Signal email request failed.', error);
  }
};

void sendSignalEmail;

export const shouldTriggerAlert = (
  coin: string,
  signal: AlertSignal,
  settings: AppSettings,
  now = Date.now(),
) => {
  const lastAlertAt = lastAlertAtByCoin.get(coin) ?? 0;
  const isCoolingDown = now - lastAlertAt < ALERT_COOLDOWN_MS;
  const alertLevel = getAlertLevel(signal);

  return (
    settings.alertEnabled === true &&
    isWithinAlertWindow(settings, new Date(now)) &&
    signal.isBreakout === true &&
    signal.isFakeout !== true &&
    alertLevel !== 'none' &&
    !isCoolingDown
  );
};

const playAlertFeedback = (settings: AppSettings, level: AlertLevel) => {
  if (level === 'none') return false;

  const vibrationPattern = level === 'entry' ? [120, 60, 120] : [80];

  if (settings.enableVibration && typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(vibrationPattern);
    } catch (error) {
      console.warn('Alert vibration failed.', error);
    }
  }

  if (settings.enableSound && !settings.masterMute) {
    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
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
      const frequency = level === 'entry' ? 1040 : 760;
      const duration = level === 'entry' ? 0.55 : 0.35;
      const peakGain = level === 'entry' ? 0.14 : 0.08;

      osc.type = level === 'entry' ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(frequency, ctx.currentTime);
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(peakGain * volume, ctx.currentTime + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration + 0.05);

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

export const triggerAlert = (coin: string, signal: AlertSignal, settings: AppSettings) => {
  const now = Date.now();
  if (!shouldTriggerAlert(coin, signal, settings, now)) return false;

  lastAlertAtByCoin.set(coin, now);
  const level = getAlertLevel(signal);
  return playAlertFeedback(settings, level);
};

export const triggerTestAlert = (settings: AppSettings, level: AlertLevel = 'entry') =>
  playAlertFeedback(settings, level);
