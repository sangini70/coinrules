import { StoredTrade, TradeAnalysis } from '../types';

const EMPTY_ANALYSIS: TradeAnalysis = {
  total: 0,
  winRate: 0,
  avgWin: 0,
  avgLoss: 0,
  rr: 0,
};

const average = (values: number[]) =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;

export const isClosedTrade = (trade: StoredTrade) =>
  typeof trade.exitTime === 'number' &&
  trade.exitTime > 0 &&
  typeof trade.pnlPercent === 'number' &&
  (trade.result === 'win' || trade.result === 'loss');

export function analyzeTrades(trades: StoredTrade[]): TradeAnalysis {
  const closedTrades = trades.filter(isClosedTrade);
  const total = closedTrades.length;

  if (total === 0) return EMPTY_ANALYSIS;

  const wins = closedTrades.filter((trade) => trade.result === 'win').length;
  const winTrades = closedTrades.filter((trade) => (trade.pnlPercent ?? 0) > 0);
  const lossTrades = closedTrades.filter((trade) => (trade.pnlPercent ?? 0) < 0);
  const avgWin = average(winTrades.map((trade) => trade.pnlPercent ?? 0));
  const avgLoss = average(lossTrades.map((trade) => trade.pnlPercent ?? 0));
  const rr = avgLoss === 0 ? 0 : Math.abs(avgWin / avgLoss);

  return {
    total,
    winRate: (wins / total) * 100,
    avgWin,
    avgLoss,
    rr,
  };
}
