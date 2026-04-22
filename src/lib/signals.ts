import { ObservationSignal } from '../types';

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
  // Simple start: take SMA as first EMA
  let ema = calculateSMA(data.slice(-period), period);
  // Iterate from oldest to newest in the data subset
  // data[0] is newest in Upbit response
  const subset = [...data].reverse();
  ema = subset.slice(0, period).reduce((a, b) => a + b, 0) / period;
  
  for (let i = period; i < subset.length; i++) {
    ema = (subset[i] - ema) * k + ema;
  }
  return ema;
}

export function analyzeSignal(candles: Candle[]): ObservationSignal {
  const prices = candles.map(c => c.trade_price);
  const volumes = candles.map(c => c.candle_acc_trade_volume);
  
  const currentPrice = candles[0].trade_price;
  const openPrice = candles[0].opening_price;
  const currentVolume = candles[0].candle_acc_trade_volume;
  
  // 1. Trend: EMA(9) > SMA(20) && SMA(20) > SMA(50)
  const ema9 = calculateEMA(prices, 9);
  const sma20 = calculateSMA(prices, 20);
  const sma50 = calculateSMA(prices, 50);
  
  const isTrendUp = ema9 > sma20 && sma20 > sma50;
  
  // 2. Volume: 현재 거래량 > 최근 20기간 평균 거래량 * 2
  // Recent 20 periods excluding current one or including? "Recent 20 periods average"
  const avgVolume20 = calculateSMA(volumes.slice(1), 20);
  const isVolumeSpike = currentVolume > avgVolume20 * 2;
  
  // 3. Breakthrough: 종가 > 저항선 && 종가 > 시가
  // Resistance = Highest high of previous 20 periods
  const prevHighs = candles.slice(1, 21).map(c => c.high_price);
  const resistance = Math.max(...prevHighs);
  const isBreakout = currentPrice > resistance && currentPrice > openPrice;
  
  let state: ObservationSignal['state'] = 'none';
  if (isTrendUp && isVolumeSpike) {
    state = isBreakout ? 'strong_observe' : 'observe';
  }

  return {
    trend: isTrendUp ? 'up' : 'neutral',
    volume: isVolumeSpike ? 'spike' : 'normal',
    breakout: isBreakout ? 'bullish_breakout' : 'none',
    state,
    updatedAt: new Date().toISOString(),
  };
}
