import { TickerData } from '../types';

const MOCK_TICKERS: Record<string, TickerData> = {
  'KRW-BTC': { market: 'KRW-BTC', trade_price: 98000000, signed_change_rate: 0.02 },
  'KRW-ETH': { market: 'KRW-ETH', trade_price: 4500000, signed_change_rate: -0.01 },
  'KRW-SOL': { market: 'KRW-SOL', trade_price: 210000, signed_change_rate: 0.05 },
  'KRW-XRP': { market: 'KRW-XRP', trade_price: 850, signed_change_rate: -0.005 },
};

const getMockTicker = (market: string): TickerData => {
  return MOCK_TICKERS[market] || { market, trade_price: 100000, signed_change_rate: 0 };
};

type UpbitPayload<T> = {
  data: T | null;
  source?: 'real' | 'cache' | 'fallback';
};

const parsePayload = async <T>(response: Response): Promise<UpbitPayload<T>> => {
  try {
    const payload = await response.json();
    return {
      data: payload?.data ?? null,
      source: payload?.source,
    };
  } catch {
    return { data: null, source: 'fallback' };
  }
};

const isLocalhost =
  typeof window !== 'undefined' &&
  ['localhost', '127.0.0.1'].includes(window.location.hostname);

const API_BASE = isLocalhost ? 'http://localhost:4000' : '';

const isProduction = !isLocalhost;

export const fetchTicker = async (market: string): Promise<TickerData | null> => {
  // Enforce KRW-SOL for SOL
  const targetMarket = market === 'SOL' ? 'KRW-SOL' : market;
  
  try {
    const response = await fetch(
      `${API_BASE}/api/upbit/ticker?market=${encodeURIComponent(targetMarket)}`,
    );
    const payload = await parsePayload<TickerData[]>(response);
    const ticker = Array.isArray(payload.data) ? payload.data[0] as TickerData | undefined : undefined;
    if (!ticker?.trade_price) throw new Error('API fetch failed');
    
    console.log("market:", targetMarket);
    console.log("ticker price:", ticker.trade_price);
    console.log("source:", payload.source ?? "real");
    
    return ticker;
  } catch (error) {
    console.warn(`Upbit API fetch failed for ${targetMarket}, reason: ${error instanceof Error ? error.message : 'Unknown'}`);
    
    if (isProduction) {
      console.log("market:", targetMarket);
      console.log("ticker price: preserved last valid price");
      console.log("source:", "production-fail (no mock)");
      return null; // Signals to UI to keep old value
    } else {
      const mock = getMockTicker(targetMarket);
      console.log("market:", targetMarket);
      console.log("ticker price:", mock.trade_price);
      console.log("source:", "mock");
      return mock;
    }
  }
};

export const fetchTickers = async (markets: string[]): Promise<TickerData[]> => {
  if (markets.length === 0) return [];
  try {
    const response = await fetch(
      `${API_BASE}/api/upbit/ticker?market=${encodeURIComponent(markets.join(','))}`,
    );
    const payload = await parsePayload<TickerData[]>(response);
    return Array.isArray(payload.data) ? payload.data : markets.map(getMockTicker);
  } catch (error) {
    console.warn(`Upbit API fetch failed for multiple markets, using mock values. (Reason: ${error instanceof Error ? error.message : 'Unknown'})`);
    return markets.map(getMockTicker);
  }
};

export const fetchCandles = async (market: string, count: number = 20, unit: number = 5): Promise<any[] | null> => {
  try {
    const response = await fetch(
      `${API_BASE}/api/upbit/candles?market=${encodeURIComponent(market)}&unit=${unit}&count=${count}`,
    );
    const payload = await parsePayload<any[]>(response);
    return Array.isArray(payload.data) ? payload.data : null;
  } catch (error) {
    console.warn(`Upbit Candle API fetch failed for ${market}: ${error}`);
    return null;
  }
};
