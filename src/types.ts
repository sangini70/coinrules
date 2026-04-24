export type PositionType = 'short_term' | 'long_term';
export type ResultType = 'take_profit' | 'stop_loss' | 'manual_exit' | 'timeout_exit';

export interface AppSettings {
  stopLossPercent: number;
  takeProfitPercent: number;
  breakevenTriggerPercent: number;
  maxDailyTrades: number;
  maxConsecutiveLosses: number;
  cooldownMinutes: number;
  // Sound UX Control
  enableSound: boolean;
  enableVibration: boolean;
  notifyStopLoss: boolean;
  notifyCooldown: boolean;
  volume: number; // 0-100
  masterMute: boolean;
  theme: 'light' | 'dark';
}

export interface Position {
  id: string;
  coin: string; // e.g. KRW-BTC
  type: PositionType;
  buyPrice: number;
  quantity: number;
  entryAmount: number;
  stopLossPercent: number;
  takeProfitPercent: number;
  stopLossPrice: number;
  takeProfitPrice1: number;
  takeProfitPrice2: number;
  createdAt: string;
  memo: string;
  isLocked: boolean;
}

export interface TradeHistory {
  id: string;
  coin: string;
  type: PositionType;
  buyPrice: number;
  sellPrice: number;
  entryAmount: number;
  quantity: number;
  ruleKept: boolean;
  reasonBuy: string;
  reasonSell: string;
  resultType: ResultType;
  date: string;
  signalSnapshot?: ObservationSignal;
}

export interface TradeControlState {
  todayTradeCount: number;
  consecutiveLossCount: number;
  isInputDisabled: boolean;
  cooldowns: Record<string, string>; // coin: ISO Date
  lastTradeDate: string; // YYYY-MM-DD
}

export type PositionStatus = 'WATCH' | 'HOLD' | 'BREAKEVEN' | 'TAKE_PROFIT' | 'STOP_LOSS';

export type ObservationState = 'none' | 'WAIT' | 'OBSERVE' | 'CAUTION' | 'PREPARE' | 'RISK';

export interface ObservationSignal {
  trend: 'up' | 'neutral';
  volume: 'normal' | 'spike';
  breakout: 'none' | 'bullish_breakout';
  state: ObservationState;
  updatedAt: string;
}

export interface TickerData {
  market: string;
  trade_price: number;
  signed_change_rate: number;
}
