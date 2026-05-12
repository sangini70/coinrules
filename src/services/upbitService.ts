import { TickerData } from '../types';

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

const normalizeMarket = (market: string) => {
  const raw = String(market ?? '').trim().toUpperCase();
  if (!raw) return '';
  return raw.startsWith('KRW-') ? raw : `KRW-${raw}`;
};

const buildTickerUrl = (market: string) =>
  `${BASE_URL}/ticker?market=${encodeURIComponent(normalizeMarket(market))}`;

const buildCandleUrl = (market: string, count: number, unit: number) =>
  `${BASE_URL}/candles?unit=${encodeURIComponent(unit)}&market=${encodeURIComponent(normalizeMarket(market))}&count=${encodeURIComponent(count)}`;

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
  const targetMarket = normalizeMarket(market);
  if (!targetMarket) return null;
  
  try {
    const response = await fetch(buildTickerUrl(targetMarket));
    const payload = await parsePayload<TickerData[]>(response);

    const data = Array.isArray(payload)
      ? payload
      : payload?.data;

    if (!Array.isArray(data) || data.length === 0) {
      console.warn('Invalid payload structure:', payload);
      return null;
    }

    const ticker = data[0] as TickerData | undefined;

    if (!ticker?.trade_price) {
      console.warn('Invalid payload structure:', payload);
      return null;
    }

    return ticker;
  } catch (error) {
    console.warn(`Upbit API fetch failed for ${targetMarket}, reason: ${error instanceof Error ? error.message : 'Unknown'}`);
    return null;
  }
};

export const fetchTickers = async (markets: string[]): Promise<TickerData[]> => {
  const normalizedMarkets = markets.map(normalizeMarket).filter(Boolean);
  if (normalizedMarkets.length === 0) return [];
  try {
    const response = await fetch(`${BASE_URL}/ticker?markets=${encodeURIComponent(normalizedMarkets.join(','))}`);
    const payload = await parsePayload<TickerData[]>(response);

    const data = Array.isArray(payload)
      ? payload
      : payload?.data;

    if (!Array.isArray(data) || data.length === 0) {
      console.warn('Invalid payload structure:', payload);
      return [];
    }
    return data;
  } catch (error) {
    console.warn(`Upbit API fetch failed for multiple markets. (Reason: ${error instanceof Error ? error.message : 'Unknown'})`);
    return [];
  }
};

export const fetchCandles = async (market: string, count: number = 20, unit: number = 5): Promise<any[]> => {
  const targetMarket = normalizeMarket(market);
  if (!targetMarket) return [];

  try {
    const requestUrl = buildCandleUrl(targetMarket, count, unit);
    const response = await fetch(requestUrl);
    if (!response.ok) {
      console.warn(
        `Upbit Candle API request failed for ${targetMarket}: ${response.status} ${response.statusText} (${requestUrl})`,
      );
      return [];
    }
    const payload = await parsePayload<any[]>(response);

    const data = Array.isArray(payload)
      ? payload
      : payload?.data;

    if (!Array.isArray(data) || data.length === 0) {
      console.warn('Invalid payload structure:', payload);
      return [];
    }
    return data;
  } catch (error) {
    console.warn(`Upbit Candle API fetch failed for ${targetMarket}: ${error instanceof Error ? error.message : 'Unknown'}`);
    return [];
  }
};
