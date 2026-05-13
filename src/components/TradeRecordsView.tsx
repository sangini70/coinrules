import { useEffect, useState } from 'react';
import { fetchTrades } from '../services/getTrades';

type TradeRecord = {
  id?: string | number;
  market?: string;
  status?: string;
  result?: string | null;
  entryPrice?: number | string | null;
  exitPrice?: number | string | null;
  profitRate?: number | string | null;
  closedAt?: string | null;
  exitTime?: string | null;
  tp1?: number | string | null;
  sl?: number | string | null;
  createdAt?: string | null;
  time?: number | string | null;
};

const asString = (value: unknown, fallback = '-') => String(value ?? fallback);

const asNumberText = (value: unknown, digits?: number) => {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return '-';
  if (typeof digits === 'number') {
    return numberValue.toLocaleString('ko-KR', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  }
  return numberValue.toLocaleString('ko-KR');
};

const parseTradeTime = (trade: TradeRecord) => {
  if (typeof trade.time === 'number' && Number.isFinite(trade.time)) return trade.time;
  if (typeof trade.createdAt === 'string' && trade.createdAt) {
    const parsed = Date.parse(trade.createdAt);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

export function TradeRecordsView() {
  const [tradeRecords, setTradeRecords] = useState<TradeRecord[]>([]);

  useEffect(() => {
    let active = true;

    void fetchTrades()
      .then((data) => {
        if (!active) return;
        const normalized = Array.isArray(data)
          ? data
              .slice()
              .sort((left: TradeRecord, right: TradeRecord) => parseTradeTime(right) - parseTradeTime(left))
          : [];
        setTradeRecords(normalized);
      })
      .catch(() => {
        if (!active) return;
        setTradeRecords([]);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between border-b border-gray-200 pb-6">
        <h2 className="text-3xl font-black tracking-tight text-gray-900">嫄곕옒 湲곕줉</h2>
        <span className="text-xs font-mono text-gray-400 uppercase tracking-[0.2em] font-bold">
          {tradeRecords.length} records
        </span>
      </div>

      {tradeRecords.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-sm">
          <p className="text-sm font-semibold text-gray-500">嫄곕옒 湲곕줉 ?놁쓬</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {tradeRecords.map((item, index) => {
            const status = asString(item?.status);
            const market = asString(item?.market);
            const result = asString(item?.result);
            const profitValue = Number(item?.profitRate);
            const profitRate = Number.isFinite(profitValue)
              ? profitValue.toLocaleString('ko-KR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })
              : '-';
            const profitTone = profitValue > 0 ? 'text-green-500' : profitValue < 0 ? 'text-red-500' : 'text-gray-400';
            const closedAt = asString(item?.closedAt ?? item?.exitTime);
            const entryPrice = asNumberText(item?.entryPrice);
            const exitPrice = asNumberText(item?.exitPrice);
            const tp1 = asNumberText(item?.tp1);
            const sl = asNumberText(item?.sl);

            return null;
          })}
        </div>
      )}
    </div>
  );
}
