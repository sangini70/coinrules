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

// Simple check for production
const isProduction = typeof window !== 'undefined' && window.location.hostname !== 'localhost' && !window.location.hostname.includes('dev');

export const fetchTicker = async (market: string): Promise<TickerData | null> => {
  // Enforce KRW-SOL for SOL
  const targetMarket = market === 'SOL' ? 'KRW-SOL' : market;
  
  try {
    const response = await fetch(`https://api.upbit.com/v1/ticker?markets=${targetMarket}`);
    if (!response.ok) throw new Error('API fetch failed');
    const data = await response.json();
    const ticker = data[0] as TickerData;
    
    console.log("market:", targetMarket);
    console.log("ticker price:", ticker.trade_price);
    console.log("source:", "real");
    
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
    const response = await fetch(`https://api.upbit.com/v1/ticker?markets=${markets.join(',')}`);
    if (!response.ok) throw new Error('API fetch failed');
    const data = await response.json();
    return data as TickerData[];
  } catch (error) {
    console.warn(`Upbit API fetch failed for multiple markets, using mock values. (Reason: ${error instanceof Error ? error.message : 'Unknown'})`);
    return markets.map(getMockTicker);
  }
};

export const fetchCandles = async (market: string, count: number = 20): Promise<any[] | null> => {
  try {
    const response = await fetch(`https://api.upbit.com/v1/candles/minutes/5?market=${market}&count=${count}`);
    if (!response.ok) throw new Error('Candle API fetch failed');
    return await response.json();
  } catch (error) {
    console.warn(`Upbit Candle API fetch failed for ${market}: ${error}`);
    return null;
  }
};
