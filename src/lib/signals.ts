import { ObservationSignal } from '../types';
import { SHORT_TERM_ENTRY_THRESHOLD_SCORE } from './tradingRules';

declare module '../types' {
  interface ObservationSignal {
    currentPrice?: number;
  }
}

interface Candle {
  market: string;
  candle_date_time_utc: string;
  opening_price: number;
  high_price: number;
  low_price: number;
  trade_price: number;
  candle_acc_trade_volume: number;
}

export function calculateSMA(data: number[], period: number): number {
  if (data.length < period) return 0;
  const subset = data.slice(0, period);
  return subset.reduce((a, b) => a + b, 0) / period;
}

export function calculateEMA(data: number[], period: number): number {
  if (data.length < period) return 0;
  const k = 2 / (period + 1);
  const subset = [...data].reverse();
  let ema = subset.slice(0, period).reduce((a, b) => a + b, 0) / period;

  for (let i = period; i < subset.length; i++) {
    ema = (subset[i] - ema) * k + ema;
  }
  return ema;
}

export function calculateRSI(data: number[], period: number = 14): number {
  if (data.length <= period) return 0;
  const ordered = [...data].reverse();
  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = ordered[i] - ordered[i - 1];
    if (diff > 0) gains += diff;
    else losses += Math.abs(diff);
  }

  const averageGain = gains / period;
  const averageLoss = losses / period;
  if (averageLoss === 0) return 100;

  const rs = averageGain / averageLoss;
  return 100 - 100 / (1 + rs);
}

export function calculateMACDHistogram(data: number[]) {
  if (data.length < 35) {
    return { current: 0, previous: 0 };
  }

  const ordered = [...data].reverse();
  const macdSeries = ordered.map((_, index) => {
    const subset = ordered.slice(0, index + 1);
    const reversedSubset = [...subset].reverse();
    return calculateEMA(reversedSubset, 12) - calculateEMA(reversedSubset, 26);
  });

  const currentSignalLine = calculateEMA([...macdSeries].reverse(), 9);
  const previousSignalLine = calculateEMA([...macdSeries.slice(0, -1)].reverse(), 9);
  const currentMacd = macdSeries[macdSeries.length - 1] ?? 0;
  const previousMacd = macdSeries[macdSeries.length - 2] ?? 0;

  return {
    current: currentMacd - currentSignalLine,
    previous: previousMacd - previousSignalLine,
  };
}

export function analyzeSignal(oneMinuteCandles: Candle[], fiveMinuteCandles: Candle[]): ObservationSignal {
  if (!Array.isArray(oneMinuteCandles) || !Array.isArray(fiveMinuteCandles)) {
    return {
      trend: 'neutral',
      volume: 'normal',
      breakout: 'none',
      state: 'WAIT',
      updatedAt: new Date().toISOString(),
      currentPrice: 0,
    };
  }

  const oneMinutePrices = oneMinuteCandles.map((c) => c.trade_price);
  const fiveMinutePrices = fiveMinuteCandles.map((c) => c.trade_price);

  const currentFiveMinuteClose = fiveMinuteCandles[0]?.trade_price ?? 0;
  const ema200 = calculateEMA(fiveMinutePrices, 200);
  const ema9 = calculateEMA(fiveMinutePrices, 9);
  const ema55 = calculateEMA(fiveMinutePrices, 55);
  const rsi = calculateRSI(fiveMinutePrices, 14);
  const trendReady = currentFiveMinuteClose > ema200 && ema9 > ema55;
  const momentumReady = rsi > 50;

  const { current: macdHistogram, previous: previousMacdHistogram } = calculateMACDHistogram(oneMinutePrices);
  const macdPositiveCross = previousMacdHistogram <= 0 && macdHistogram > 0;
  const macdPositive = macdHistogram > 0;

  const resistance = Math.max(
    0,
    ...oneMinuteCandles.slice(2, 22).map((c) => c.high_price ?? 0),
  );
  const currentVolume = oneMinuteCandles[0]?.candle_acc_trade_volume ?? 0;
  const VOLUME_MULTIPLIER = 1.2;
  const averageVolume20 = calculateSMA(
    oneMinuteCandles.slice(1, 21).map((c) => c.candle_acc_trade_volume ?? 0),
    20,
  );
  const isVolumeValid = currentVolume > averageVolume20 * VOLUME_MULTIPLIER;
  const volumeIncreasing = isVolumeValid;
  const latestClose = oneMinuteCandles[0]?.trade_price ?? 0;
  const previousClose = oneMinuteCandles[1]?.trade_price ?? 0;
  const BREAKOUT_BUFFER = 1.002;
  const isBreakoutValid = latestClose > resistance * BREAKOUT_BUFFER;
  const breakoutAttempt = isBreakoutValid;
  const breakoutReady = isBreakoutValid && previousClose > resistance * BREAKOUT_BUFFER;
  const latestLow = fiveMinuteCandles[0]?.low_price ?? 0;
  const latestOpen = fiveMinuteCandles[0]?.opening_price ?? 0;
  const pullbackFloor = Math.max(ema9, ema55) * 0.995;
  const pullbackCeiling = Math.max(ema9, ema55) * 1.005;
  const pullbackReady =
    latestLow <= pullbackCeiling &&
    latestLow >= pullbackFloor &&
    currentFiveMinuteClose > latestOpen &&
    currentFiveMinuteClose >= ema9;
  const strongBreakout = breakoutReady && (volumeIncreasing || macdPositive);
  const pullbackDepthValid = currentFiveMinuteClose <= ema9 * 1.01;
  const strongPullback = pullbackReady && momentumReady && trendReady && volumeIncreasing && pullbackDepthValid;
  const timingTrigger = strongBreakout || strongPullback;
  const currentPrice = latestClose > 0 ? latestClose : currentFiveMinuteClose;
  const signalScore = getSignalScore({
    trend: trendReady,
    volume: volumeIncreasing,
    breakout: breakoutReady,
  });
  const entryReady =
    breakoutReady &&
    pullbackReady &&
    macdPositiveCross &&
    trendReady &&
    momentumReady &&
    volumeIncreasing &&
    currentPrice <= ema9 * 1.005 &&
    signalScore >= SHORT_TERM_ENTRY_THRESHOLD_SCORE;
  const breakoutFailed = breakoutAttempt && !breakoutReady;

  let state: ObservationSignal['state'] = 'WAIT';

  if (breakoutFailed) {
    state = 'RISK';
  } else if (entryReady) {
    state = 'ENTRY';
  } else if (timingTrigger || trendReady || momentumReady || macdPositive || breakoutReady || pullbackReady) {
    state = 'OBSERVE';
  }

  console.log('[ENTRY_FLOW]', {
    stage: 'analyzeSignal',
    trend: trendReady ? 'up' : 'neutral',
    volume: 'normal',
    breakout: breakoutAttempt ? 'bullish_breakout' : 'none',
    state,
  });
  console.log('[TRADING_RULES_RESULT]', {
    oneMinuteCount: oneMinuteCandles.length,
    fiveMinuteCount: fiveMinuteCandles.length,
    trendReady,
    momentumReady,
    volumeIncreasing,
    breakoutAttempt,
    signalScore,
    entryReady,
    state,
  });

  return {
    trend: trendReady ? 'up' : 'neutral',
    volume: 'normal',
    breakout: breakoutAttempt ? 'bullish_breakout' : 'none',
    state,
    updatedAt: new Date().toISOString(),
    currentPrice,
  };
}

export type EntryState = 'AVOID' | 'RISK' | 'ENTRY' | 'OBSERVE' | 'WAIT';

export function getEntryState({
  trend,
  volume,
  breakout,
  fakeout,
  highRisk,
  btcTrend,
}: {
  trend: boolean;
  volume: boolean;
  breakout: boolean;
  fakeout: boolean;
  highRisk: boolean;
  btcTrend: 'up' | 'neutral';
}): EntryState {
  const score = getSignalScore({ trend, volume, breakout });
  const isBtcUptrend = btcTrend !== 'down';
  const entryState: EntryState = fakeout
    ? 'AVOID'
    : highRisk || !isBtcUptrend
      ? 'RISK'
      : score >= SHORT_TERM_ENTRY_THRESHOLD_SCORE && volume
        ? 'ENTRY'
        : score >= 20
          ? 'OBSERVE'
          : 'WAIT';

  console.log('[ENTRY_FLOW]', {
    score,
    trend,
    volume,
    breakout,
    btcTrend,
    fakeout,
    highRisk,
    threshold: SHORT_TERM_ENTRY_THRESHOLD_SCORE,
    entryState,
  });

  return entryState;
}

export function getPrepareState({
  trend,
  volume,
  breakout,
}: {
  trend: boolean;
  volume: boolean;
  breakout: boolean;
}) {
  if (trend && volume && breakout) return 'ENTRY';
  if (trend || volume || breakout) return 'OBSERVE';
  return 'WAIT';
}

export function getSignalScore({
  trend,
  volume,
  breakout,
}: {
  trend: boolean;
  volume: boolean;
  breakout: boolean;
}) {
  let score = 0;

  if (trend) score += 40;
  if (volume) score += 30;
  if (breakout) score += 30;

  console.log('[ENTRY_FLOW]', {
    stage: 'getSignalScore',
    score,
    trend,
    volume,
    breakout,
  });

  return score;
}
