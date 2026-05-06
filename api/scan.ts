import type { IncomingMessage, ServerResponse } from 'node:http';
import { buildEntryEmail, sendMail } from './_mail';
import { getEntryState, getPrepareState, getSignalScore } from '../src/lib/signals';

const WATCHLIST = ['BTC', 'ETH', 'XRP', 'SOL', 'ADA', 'DOGE', 'SHIB', 'STEEM', 'AXL', 'IP'];
const MARKET_ANALYSIS_CANDLE_COUNT = 24;
const TREND_LOOKBACK = 5;
const BREAKOUT_LOOKBACK = 20;
const RECENT_VOLUME_WINDOW = 3;
const BASELINE_VOLUME_WINDOW = 10;
const VOLUME_SPIKE_MULTIPLIER = 1.3;
const SUSTAIN_LOOKBACK = 3;

type Candle = {
  opening_price: number;
  high_price: number;
  low_price: number;
  trade_price: number;
  candle_acc_trade_volume: number;
};

type ScanResult = {
  symbol: string;
  entryState: string;
  price: number;
  trend: boolean;
  volume: boolean;
  breakout: boolean;
  signalScore: number;
  prepareState: string;
};

type ScanResponse = ServerResponse & {
  status: (code: number) => ScanResponse;
  json: (body: unknown) => void;
};

const enhanceResponse = (res: ServerResponse) => {
  const response = res as ScanResponse;
  response.status = (code: number) => {
    response.statusCode = code;
    return response;
  };
  response.json = (body: unknown) => {
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.end(JSON.stringify(body));
  };
  return response;
};

const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;

const getOrigin = (req: IncomingMessage) => {
  const forwardedProto = Array.isArray(req.headers['x-forwarded-proto'])
    ? req.headers['x-forwarded-proto'][0]
    : req.headers['x-forwarded-proto'];
  const host = req.headers.host ?? 'localhost:3000';
  const protocol = forwardedProto || 'https';
  return `${protocol}://${host}`;
};

const fetchJson = async <T>(origin: string, path: string): Promise<T> => {
  const response = await fetch(new URL(path, origin).toString(), {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
};

const fetchTicker = async (origin: string, symbol: string) => {
  const payload = await fetchJson<{ data?: Array<{ trade_price?: number; market?: string }> }>(
    origin,
    `/api/upbit/ticker?market=${encodeURIComponent(`KRW-${symbol}`)}`,
  );
  return Array.isArray(payload.data) ? payload.data[0] ?? null : null;
};

const fetchCandles = async (origin: string, symbol: string, count: number, unit: number) => {
  const payload = await fetchJson<{ data?: Candle[] }>(
    origin,
    `/api/upbit/candles?market=${encodeURIComponent(`KRW-${symbol}`)}&unit=${encodeURIComponent(unit)}&count=${encodeURIComponent(count)}`,
  );
  return Array.isArray(payload.data) ? payload.data : [];
};

const analyzeMarket = async (origin: string, symbol: string, btcTrend: 'up' | 'neutral'): Promise<ScanResult | null> => {
  const ticker = await fetchTicker(origin, symbol);
  if (!ticker || !Number.isFinite(Number(ticker.trade_price ?? 0)) || Number(ticker.trade_price ?? 0) <= 0) {
    return null;
  }

  const [candles, oneMinuteCandles] = await Promise.all([
    fetchCandles(origin, symbol, MARKET_ANALYSIS_CANDLE_COUNT, 5),
    fetchCandles(origin, symbol, 2, 1),
  ]);

  if (!Array.isArray(candles) || candles.length < MARKET_ANALYSIS_CANDLE_COUNT) {
    return null;
  }

  const candleData = candles.map((c) => ({
    open: c.opening_price,
    close: c.trade_price,
    high: c.high_price,
    low: c.low_price,
    volume: c.candle_acc_trade_volume,
    upperWickRatio:
      (c.high_price - Math.max(c.opening_price, c.trade_price)) /
      (c.high_price - c.low_price + Number.EPSILON),
  }));

  const completedCandles = candleData.slice(1);
  if (completedCandles.length < BREAKOUT_LOOKBACK + SUSTAIN_LOOKBACK) {
    return null;
  }

  const latestCompleted = completedCandles[0];
  const trendCandles = completedCandles.slice(0, TREND_LOOKBACK);
  const recentVolumeCandles = completedCandles.slice(0, RECENT_VOLUME_WINDOW);
  const baselineVolumeCandles = completedCandles.slice(
    RECENT_VOLUME_WINDOW,
    RECENT_VOLUME_WINDOW + BASELINE_VOLUME_WINDOW,
  );
  const breakoutReferenceCandles = completedCandles.slice(1, BREAKOUT_LOOKBACK + 1);
  const sustainReferenceCandles = completedCandles.slice(SUSTAIN_LOOKBACK, SUSTAIN_LOOKBACK + BREAKOUT_LOOKBACK);
  const recentThreeCandles = completedCandles.slice(0, SUSTAIN_LOOKBACK);

  const higherHighCount = trendCandles.slice(0, -1).reduce(
    (count, candle, index) => count + (candle.high > trendCandles[index + 1].high ? 1 : 0),
    0,
  );
  const higherLowCount = trendCandles.slice(0, -1).reduce(
    (count, candle, index) => count + (candle.low > trendCandles[index + 1].low ? 1 : 0),
    0,
  );
  const higherCloseCount = trendCandles.slice(0, -1).reduce(
    (count, candle, index) => count + (candle.close > trendCandles[index + 1].close ? 1 : 0),
    0,
  );

  const recentHigh = Math.max(...breakoutReferenceCandles.map((c) => c.high));
  const sustainedLevel = Math.max(...sustainReferenceCandles.map((c) => c.high));
  const avgVol3 = average(recentVolumeCandles.map((c) => c.volume));
  const avgVol10 = average(baselineVolumeCandles.map((c) => c.volume));
  const isUpTrend =
    higherHighCount >= 3 &&
    higherLowCount >= 3 &&
    higherCloseCount >= 3 &&
    latestCompleted.close > trendCandles[TREND_LOOKBACK - 1].close;
  const isBreakout = latestCompleted.close > recentHigh;
  const isSustained = recentThreeCandles.every((c) => c.close > sustainedLevel);
  const isVolumeSpike = avgVol3 >= avgVol10 * VOLUME_SPIKE_MULTIPLIER;
  const attemptedBreakout = latestCompleted.high > recentHigh;
  const breakoutRejected = attemptedBreakout && latestCompleted.close <= recentHigh;
  const isFakeout =
    breakoutRejected ||
    (isBreakout && !isVolumeSpike && latestCompleted.upperWickRatio >= 0.45) ||
    (attemptedBreakout && latestCompleted.upperWickRatio >= 0.55 && latestCompleted.close < latestCompleted.open);

  const trendActive = Boolean(isUpTrend);
  const volumeActive = Boolean(isVolumeSpike);
  const breakoutActive = Boolean(isBreakout);
  const fakeout = Boolean(isFakeout);
  const highRisk = Boolean(isBreakout && !isSustained);

  const signalScore = getSignalScore({
    trend: trendActive,
    volume: volumeActive,
    breakout: breakoutActive,
  });
  const prepareState = getPrepareState({
    trend: trendActive,
    volume: volumeActive,
    breakout: breakoutActive,
  });
  const entryState = getEntryState({
    trend: trendActive,
    volume: volumeActive,
    breakout: breakoutActive,
    fakeout,
    highRisk,
    btcTrend,
  });

  return {
    symbol,
    entryState,
    price: Number(ticker.trade_price ?? 0),
    trend: trendActive,
    volume: volumeActive,
    breakout: breakoutActive,
    signalScore,
    prepareState,
  };
};

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const response = enhanceResponse(res);

  if (req.method !== 'GET') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const origin = getOrigin(req);

    const btcSignal = await analyzeMarket(origin, 'BTC', 'neutral');
    const btcTrend: 'up' | 'neutral' = btcSignal?.trend ? 'up' : 'neutral';

    const entryCandidates: ScanResult[] = [];

    for (const symbol of WATCHLIST) {
      const signal = await analyzeMarket(origin, symbol, btcTrend);
      if (!signal || signal.entryState !== 'ENTRY') continue;
      if (!Number.isFinite(signal.price) || signal.price <= 0) continue;
      entryCandidates.push(signal);
    }

    entryCandidates.sort((a, b) => b.signalScore - a.signalScore);
    const bestEntry = entryCandidates[0] ?? null;

    if (bestEntry) {
      const { subject, text, html } = buildEntryEmail(bestEntry);
      await sendMail(subject, text, html);
    }

    return response.status(200).json({
      ok: true,
      sent: Boolean(bestEntry),
      bestEntry: bestEntry?.symbol ?? null,
    });
  } catch (e) {
    console.error(e);
    return response.status(500).json({ error: 'scan failed' });
  }
}
