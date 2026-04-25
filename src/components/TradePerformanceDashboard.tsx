import { useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { formatPercent } from '../lib/utils';
import { isClosedTrade } from '../lib/tradeAnalytics';

const EMPTY_TRADE_ANALYSIS = {
  total: 0,
  winRate: 0,
  avgWin: 0,
  avgLoss: 0,
  rr: 0,
};

export function TradePerformanceDashboard() {
  const { trades, tradeAnalysis } = useAppStore((state) => ({
    trades: state.trades,
    tradeAnalysis: state.tradeAnalysis,
  }));

  const safeTrades = Array.isArray(trades) ? trades : [];
  const safeTradeAnalysis = tradeAnalysis ?? EMPTY_TRADE_ANALYSIS;
  const safeTotal = Number.isFinite(safeTradeAnalysis.total) ? Number(safeTradeAnalysis.total) : 0;
  const safeWinRate = Number.isFinite(safeTradeAnalysis.winRate) ? Number(safeTradeAnalysis.winRate) : 0;
  const safeAvgWin = Number.isFinite(safeTradeAnalysis.avgWin) ? Number(safeTradeAnalysis.avgWin) : 0;
  const safeAvgLoss = Number.isFinite(safeTradeAnalysis.avgLoss) ? Number(safeTradeAnalysis.avgLoss) : 0;
  const safeRr = Number.isFinite(safeTradeAnalysis.rr) ? Number(safeTradeAnalysis.rr) : 0;

  const recentResults = useMemo(
    () => safeTrades.filter(isClosedTrade).slice(0, 10),
    [safeTrades],
  );

  const cards = [
    { label: '총 거래 수', value: String(safeTotal).padStart(2, '0') },
    { label: '승률 (%)', value: `${safeWinRate.toFixed(1)}%` },
    { label: '평균 수익 (%)', value: formatPercent(safeAvgWin) },
    { label: '평균 손실 (%)', value: formatPercent(safeAvgLoss) },
    { label: '손익비 (RR)', value: safeRr.toFixed(2) },
  ];

  return (
    <section className="bg-card-bg border border-text-main/5 p-8 space-y-8">
      <div className="flex items-end justify-between border-b border-text-main/10 pb-5">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted/30 mb-2">
            Strategy Performance
          </p>
          <h2 className="text-3xl font-black tracking-tight uppercase text-text-main">
            전략 성과 대시보드
          </h2>
        </div>
        <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-text-muted/40">
          Firestore Auto Sync
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="border border-text-main/5 bg-aux-bg p-5 space-y-3">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-text-muted/40">
              {card.label}
            </p>
            <p className="text-3xl font-black tracking-tighter text-text-main">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black uppercase tracking-[0.18em] text-text-main">
            최근 10건 거래 결과
          </h3>
          <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-text-muted/40">
            {recentResults.length} records
          </span>
        </div>

        {recentResults.length === 0 ? (
          <div className="border border-text-main/5 bg-aux-bg p-6 text-sm text-text-muted/50">
            아직 종료된 거래 기록이 없습니다.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {recentResults.map((trade) => (
              <div key={trade.id} className="border border-text-main/5 bg-aux-bg p-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-lg font-black tracking-tight text-text-main">
                    {String(trade.coin ?? '').replace('KRW-', '')}
                  </p>
                  <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-text-muted/40">
                    {trade.market ?? 'range'} / {trade.strategy ?? 'EMA_PULLBACK'}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-black uppercase ${trade.result === 'win' ? 'text-status-safe' : 'text-status-danger'}`}>
                    {trade.result ?? 'loss'}
                  </p>
                  <p className={`text-lg font-black tracking-tight ${trade.result === 'win' ? 'text-status-safe' : 'text-status-danger'}`}>
                    {formatPercent(trade.pnlPercent ?? 0)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
