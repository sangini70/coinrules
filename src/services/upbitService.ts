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

export const fetchTicker = async (market: string): Promise<TickerData | null> => {
  try {
    const response = await fetch(`https://api.upbit.com/v1/ticker?markets=${market}`);
    if (!response.ok) throw new Error('API fetch failed');
    const data = await response.json();
    return data[0] as TickerData;
  } catch (error) {
    console.warn(`Upbit API fetch failed for ${market}, using mock value. (Reason: ${error instanceof Error ? error.message : 'Unknown'})`);
    return getMockTicker(market);
  }
};

export const fetchTickers = async (markets: string[]): Promise<TickerData[]> => {
  if (markets.length === 0) return [];
  try {
    const response = await fetch(`https://api.upbit.com/v1/ticker?markets=${markets.join(',')}`);
    if (!response.ok) throw new Error('API fetch failed');
    const data = await response.json();
    return data as TickerData[];
  } catch (error) {
    console.warn(`Upbit API fetch failed for multiple markets, using mock values. (Reason: ${error instanceof Error ? error.message : 'Unknown'})`);
    return markets.map(getMockTicker);
  }
};
