import { TickerData } from '../types';

const MOCK_TICKERS: Record<string, TickerData> = {
  'KRW-BTC': { market: 'KRW-BTC', trade_price: 98000000, signed_change_rate: 0.02 },
  'KRW-ETH': { market: 'KRW-ETH', trade_price: 4500000, signed_change_rate: -0.01 },
  'KRW-SOL': { market: 'KRW-SOL', trade_price: 210000, signed_change_rate: 0.05 },
  'KRW-XRP': { market: 'KRW-XRP', trade_price: 850, signed_change_rate: -0.005 },
};

const getMockTicker = (market: string): TickerData => MOCK_TICKERS[market] || { market, trade_price: 100000, signed_change_rate: 0 };

const BASE_URL = '/api/upbit';

type UpbitProxyPayload<T> = {
  data?: T;
  source?: 'real' | 'cache' | 'fallback';
};

const parsePayload = async <T>(response: Response): Promise<UpbitProxyPayload<T> | T | null> => {
  try {
    return (await response.json()) as UpbitProxyPayload<T> | T;
  } catch {
    return null;
  }
};

const buildTickerUrl = (market: string) =>
  `${BASE_URL}/ticker?markets=${encodeURIComponent(market)}`;

const buildCandleUrl = (market: string, count: number, unit: number) =>
  `${BASE_URL}/candles/minutes/${encodeURIComponent(unit)}?market=${encodeURIComponent(market)}&count=${encodeURIComponent(count)}`;

export const fetchMarkets = async (): Promise<string[]> => {
  try {
    const response = await fetch(`${BASE_URL}/markets`);
    const payload = await parsePayload<Array<{ market?: string }>>(response);
    const data = Array.isArray(payload)
      ? payload
      : payload?.data;

    if (!Array.isArray(data)) return [];

    return data
      .map((item) => item?.market)
      .filter((market): market is string => typeof market === 'string' && market.startsWith('KRW-'));
  } catch (error) {
    console.warn(`Upbit market list fetch failed: ${error instanceof Error ? error.message : 'Unknown'}`);
    return [];
  }
};

export const fetchTicker = async (market: string): Promise<TickerData | null> => {
  // Enforce KRW-SOL for SOL
  const targetMarket = market === 'SOL' ? 'KRW-SOL' : market;
  
  try {
    const response = await fetch(buildTickerUrl(targetMarket));
    const payload = await parsePayload<TickerData[]>(response);

    const data = Array.isArray(payload)
      ? payload
      : payload?.data;

    if (!Array.isArray(data) || data.length === 0) {
      console.warn('Invalid payload structure:', payload);
      return getMockTicker(targetMarket);
    }

    const ticker = data[0] as TickerData | undefined;

    if (!ticker?.trade_price) {
      console.warn('Invalid payload structure:', payload);
      return getMockTicker(targetMarket);
    }

    return ticker;
  } catch (error) {
    console.warn(`Upbit API fetch failed for ${targetMarket}, reason: ${error instanceof Error ? error.message : 'Unknown'}`);
    return getMockTicker(targetMarket);
  }
};

export const fetchTickers = async (markets: string[]): Promise<TickerData[]> => {
  if (markets.length === 0) return [];
  try {
    const response = await fetch(buildTickerUrl(markets.join(',')));
    const payload = await parsePayload<TickerData[]>(response);

    const data = Array.isArray(payload)
      ? payload
      : payload?.data;

    if (!Array.isArray(data) || data.length === 0) {
      console.warn('Invalid payload structure:', payload);
      return markets.map(getMockTicker);
    }
    return data;
  } catch (error) {
    console.warn(`Upbit API fetch failed for multiple markets. (Reason: ${error instanceof Error ? error.message : 'Unknown'})`);
    return markets.map(getMockTicker);
  }
};

export const fetchCandles = async (market: string, count: number = 20, unit: number = 5): Promise<any[] | null> => {
  try {
    const response = await fetch(buildCandleUrl(market, count, unit));
    const payload = await parsePayload<any[]>(response);

    const data = Array.isArray(payload)
      ? payload
      : payload?.data;

    if (!Array.isArray(data) || data.length === 0) {
      console.warn('Invalid payload structure:', payload);
      return null;
    }
    return data;
  } catch (error) {
    console.warn(`Upbit Candle API fetch failed for ${market}: ${error instanceof Error ? error.message : 'Unknown'}`);
    return null;
  }
};
