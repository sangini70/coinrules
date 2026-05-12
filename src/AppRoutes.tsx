import { Component, isValidElement, useEffect, useRef, useState, type ChangeEvent, type ErrorInfo, type ReactNode } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AlertTriangle, Cloud, Download, ShieldCheck, Trash2, Upload } from 'lucide-react';
import { Layout } from './components/Layout';
import { LongTermView } from './components/PositionTabs';
import { PositionForm } from './components/PositionForm';
import { SettingsPanel } from './components/SettingsPanel';
import { DEFAULT_CONTROL, useAppStore } from './store/useAppStore';
import { fetchTrades } from './services/getTrades';
import { fetchTicker } from './services/upbitService';
import type { Position } from './types';

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

type TabKey = 'positions' | 'history' | 'long_term' | 'settings';

type DangerPosition = Position & {
  currentPrice: number;
  profitRate: number;
  actionSignal: '손절 실행' | '익절 실행' | '관망';
  isDangerCard: boolean;
};

// Debug-only boundary to capture React error #31 component stacks.
class React31Boundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('[REACT31_BOUNDARY]', error);
    console.error('[REACT31_BOUNDARY_STACK]', info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return null;
    }

    return this.props.children;
  }
}

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

const asPercentText = (value: unknown) => {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return '-';
  return `${numberValue.toLocaleString('ko-KR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
};

const parseTradeTime = (trade: TradeRecord) => {
  if (typeof trade.time === 'number' && Number.isFinite(trade.time)) return trade.time;
  if (typeof trade.createdAt === 'string' && trade.createdAt) {
    const parsed = Date.parse(trade.createdAt);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const formatCoinName = (coin: string) => String(coin ?? '-').replace('KRW-', '');

const signalTone = (actionSignal: DangerPosition['actionSignal']) => {
  if (actionSignal === '손절 실행') {
    return {
      badge: 'bg-red-100 text-red-700',
      text: 'text-red-600',
      button: 'bg-red-700 text-white',
      card: 'bg-red-50',
    };
  }

  if (actionSignal === '익절 실행') {
    return {
      badge: 'bg-green-100 text-green-700',
      text: 'text-green-600',
      button: 'bg-green-700 text-white',
      card: 'bg-green-50',
    };
  }

  return {
    badge: 'bg-gray-100 text-gray-600',
    text: 'text-gray-500',
    button: 'bg-gray-700 text-white',
    card: 'bg-gray-50',
  };
};

function useDangerPositions() {
  const activePositions = useAppStore((state) => state.activePositions);
  const settings = useAppStore((state) => state.settings);
  const [positions, setPositions] = useState<DangerPosition[]>([]);

  useEffect(() => {
    let cancelled = false;

    const stopLoss = Number(settings?.stopLoss ?? settings?.stopLossPercent ?? -2);
    const takeProfit = Number(settings?.takeProfitPercent ?? 3);
    const safeActivePositions = Array.isArray(activePositions) ? activePositions : [];

    const refresh = async () => {
      const nextPositions = await Promise.all(
        safeActivePositions.map(async (position) => {
          let currentPrice = Number(position.buyPrice ?? 0);

          try {
            const ticker = await fetchTicker(position.coin || 'KRW-BTC');
            const tradePrice = Number(ticker?.trade_price);
            if (Number.isFinite(tradePrice) && tradePrice > 0) {
              currentPrice = tradePrice;
            }
          } catch {
            // Keep the last safe fallback price.
          }

          const buyPrice = Number(position.buyPrice ?? 0);
          const profitRate = buyPrice > 0 && currentPrice > 0 ? ((currentPrice - buyPrice) / buyPrice) * 100 : 0;
          const actionSignal: DangerPosition['actionSignal'] =
            profitRate <= stopLoss ? '손절 실행' : profitRate >= takeProfit ? '익절 실행' : '관망';

          return {
            ...position,
            currentPrice,
            profitRate,
            actionSignal,
            isDangerCard: actionSignal === '손절 실행',
          };
        }),
      );

      if (!cancelled) {
        setPositions(nextPositions);
      }
    };

    void refresh();
    const interval = window.setInterval(() => {
      void refresh();
    }, 10000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [activePositions, settings?.stopLoss, settings?.stopLossPercent, settings?.takeProfitPercent]);

  return positions;
}

function DecisionMode({
  positions,
  dangerPosition,
  onSell,
}: {
  positions: DangerPosition[];
  dangerPosition: DangerPosition;
  onSell: (position: DangerPosition) => void;
}) {
  const executedSellRef = useRef(new Set<string>());

  useEffect(() => {
    if (navigator.vibrate) {
      navigator.vibrate([300, 100, 300, 100, 500]);
    }
  }, []);

  useEffect(() => {
    positions.forEach((position) => {
      if (position.actionSignal === 'SELL' && !executedSellRef.current.has(position.id)) {
        executedSellRef.current.add(position.id);
        onSell(position);
      }
    });
  }, [positions, onSell]);

  const signalToneClass =
    dangerPosition.actionSignal === '손절 실행'
      ? 'text-red-500'
      : dangerPosition.actionSignal === '익절 실행'
        ? 'text-green-500'
        : 'text-gray-400';

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black">
      <div className="mb-6 text-6xl font-bold text-white">{formatCoinName(dangerPosition.coin)}</div>
      <div className={`mb-10 text-center text-8xl font-black ${signalToneClass}`}>
        {dangerPosition.actionSignal}
      </div>
      <div className="mb-10 text-3xl text-gray-300">{asPercentText(dangerPosition.profitRate)}</div>
      <button className="rounded-xl bg-red-600 px-8 py-4 text-2xl text-white" onClick={() => onSell(dangerPosition)}>
        즉시 매도
      </button>
    </div>
  );
}

function ActionSignalPositionsView({
  positions,
  onSell,
}: {
  positions: DangerPosition[];
  onSell: (position: DangerPosition) => void;
}) {
  const orderedPositions = [...positions].sort((left, right) => {
    const rank = (signal: DangerPosition['actionSignal']) => {
      if (signal === '손절 실행') return 0;
      if (signal === '익절 실행') return 1;
      return 2;
    };

    const leftRank = rank(left.actionSignal);
    const rightRank = rank(right.actionSignal);

    if (leftRank !== rightRank) return leftRank - rightRank;
    return Number(right.profitRate ?? 0) - Number(left.profitRate ?? 0);
  });

  const handleSell = (position: DangerPosition) => {
    onSell(position);
  };

  if (orderedPositions.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-end justify-between border-b border-gray-200 pb-6">
          <h2 className="text-3xl font-black tracking-tight text-gray-900">행동 신호</h2>
          <span className="text-xs font-mono text-gray-400 uppercase tracking-[0.2em] font-bold">0 positions</span>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-sm">
          <p className="text-sm font-semibold text-gray-500">표시할 포지션이 없습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between border-b border-gray-200 pb-6">
        <h2 className="text-3xl font-black tracking-tight text-gray-900">행동 신호</h2>
        <span className="text-xs font-mono text-gray-400 uppercase tracking-[0.2em] font-bold">
          {orderedPositions.length} positions
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {orderedPositions.map((position) => {
          const tones = signalTone(position.actionSignal);
          const profitRate = Number(position.profitRate ?? 0);
          const pnlAmount = (Number(position.currentPrice ?? 0) - Number(position.buyPrice ?? 0)) * Number(position.quantity ?? 0);
          const pnlTone = pnlAmount > 0 ? 'text-green-500' : pnlAmount < 0 ? 'text-red-500' : 'text-gray-400';

          return (
            <div
              key={position.id}
              className={`flex flex-col gap-3 rounded-2xl border border-gray-200 p-4 shadow-sm ${tones.card}`}
            >
              <div className="min-w-0 text-center">
                <div className="truncate text-xl font-black tracking-tight text-gray-900">
                  {formatCoinName(position.coin)}
                </div>
                <div className="mt-1 text-xs font-mono uppercase tracking-[0.2em] text-gray-400">
                  ID {String(position.id).slice(-6)}
                </div>
              </div>

              <div className={`text-center text-8xl font-black tracking-tight leading-none ${tones.text}`}>
                {position.actionSignal}
              </div>

              <div className={`text-center text-4xl font-black leading-none ${profitRate > 0 ? 'text-green-500' : profitRate < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                {asPercentText(profitRate)}
              </div>

              <div className={`text-center text-2xl font-semibold leading-tight ${pnlTone}`}>
                {asNumberText(pnlAmount)}
              </div>

              <button
                type="button"
                onClick={() => handleSell(position)}
                className={`w-full rounded-xl py-3 text-sm font-black uppercase tracking-[0.16em] transition active:scale-[0.99] ${tones.button}`}
              >
                매도 실행
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TradeRecordsView() {
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
        <h2 className="text-3xl font-black tracking-tight text-gray-900">거래 기록</h2>
        <span className="text-xs font-mono text-gray-400 uppercase tracking-[0.2em] font-bold">
          {tradeRecords.length} records
        </span>
      </div>

      {tradeRecords.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-sm">
          <p className="text-sm font-semibold text-gray-500">거래 기록 없음</p>
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

            return (
              <div key={index} className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-2xl font-black tracking-tight text-gray-900">
                      {formatCoinName(market)}
                    </div>
                    <div className="text-xs text-gray-400 font-mono tracking-[0.2em] uppercase">
                      ID {String(item?.id ?? `trade-${index}`).slice(-6)}
                    </div>
                  </div>
                  <div className="shrink-0 rounded-md bg-gray-100 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-gray-600">
                    {status}
                  </div>
                </div>

                <div className="flex flex-col items-center gap-2 py-2">
                  <div className={`text-4xl font-black text-center leading-none ${profitTone}`}>
                    {profitRate === '-' ? '-' : `${profitRate}%`}
                  </div>
                  <div className="text-xl text-center font-semibold text-gray-700">
                    {result}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
                  <div className="truncate">
                    <span className="font-semibold text-gray-500">진입가</span> {entryPrice}
                  </div>
                  <div className="truncate">
                    <span className="font-semibold text-gray-500">청산가</span> {exitPrice}
                  </div>
                  <div className="truncate">
                    <span className="font-semibold text-gray-500">TP1</span> {tp1}
                  </div>
                  <div className="truncate">
                    <span className="font-semibold text-gray-500">SL</span> {sl}
                  </div>
                  <div className="col-span-2 truncate">
                    <span className="font-semibold text-gray-500">종료 시각</span> {closedAt}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AppShell({
  children,
  positions,
  onSell,
}: {
  children: ReactNode;
  positions: DangerPosition[];
  onSell: (position: DangerPosition) => void;
}) {
  const [activeTab, setActiveTab] = useState<TabKey>('positions');
  const { control, exportData, importData, resetAll, setLanguage, language } = useAppStore();
  const t = useAppStore((state) => state.t)();
  const safeControl = control ?? DEFAULT_CONTROL;
  const text = (key: Parameters<typeof t>[0]) => String(t(key));
  const safeChildren = isValidElement(children) ? children : Array.isArray(children) ? children : null;

  const handleExport = () => {
    const data = exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `core-controller-backup-${new Date().toLocaleDateString('sv-SE')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (importData(content)) {
        window.location.reload();
      } else {
        alert('복원에 실패했습니다.');
      }
    };
    reader.readAsText(file);
  };

  const handleWipe = () => {
    if (confirm(text('reset_confirm'))) {
      resetAll();
    }
  };

  return (
    <Layout>
      <header className="w-full border-b border-gray-200 bg-white/80 px-6 py-8 relative lg:px-8">
        <div className="relative z-10 flex w-full flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <h1 className="border-l-4 border-gray-900 pl-4 text-4xl font-black leading-none tracking-tight uppercase text-gray-900 md:text-5xl">
              {text('app_name')}
            </h1>
            <div className="flex flex-wrap items-center gap-4 pl-1 text-[10px] font-mono uppercase tracking-widest text-gray-500">
              <span className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${safeControl.isInputDisabled ? 'bg-red-500' : 'bg-green-600'}`}></span>
                {safeControl.isInputDisabled ? text('input_blocked') : text('input_active')}
              </span>
              <span className="text-gray-300">|</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setLanguage('ko')}
                  className={`px-1 transition-colors hover:text-gray-900 ${language === 'ko' ? 'font-bold text-gray-900 underline underline-offset-4' : 'text-gray-400'}`}
                >
                  KO
                </button>
                <span className="text-gray-300">/</span>
                <button
                  onClick={() => setLanguage('en')}
                  className={`px-1 transition-colors hover:text-gray-900 ${language === 'en' ? 'font-bold text-gray-900 underline underline-offset-4' : 'text-gray-400'}`}
                >
                  EN
                </button>
              </div>
            </div>
          </div>

          <div className="flex w-full flex-col gap-3 lg:w-auto lg:items-end">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-green-600">
                <Cloud size={14} />
                {text('system_operational')}
              </span>
              <span className="flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-orange-500">
                <AlertTriangle size={14} />
                {safeControl.isInputDisabled ? text('input_blocked') : text('input_active')}
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] px-10 py-8">
        <div className="flex w-full gap-12">
          <aside className="w-[340px] flex-shrink-0 space-y-6">
            <div className="space-y-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-2 flex items-center gap-2">
                <ShieldCheck size={16} className="text-green-600" />
                <h2 className="text-xl font-black tracking-tighter uppercase">{text('new_execution')}</h2>
              </div>
              {safeChildren}
            </div>

            <div className="grid grid-cols-1 gap-2">
              <button
                onClick={handleExport}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-gray-700 transition-all hover:bg-gray-100 hover:text-gray-900"
              >
                <Download size={14} />
                {text('backup')}
              </button>
              <label className="relative flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-gray-700 transition-all hover:bg-gray-100 hover:text-gray-900">
                <Upload size={14} />
                {text('restore')}
                <input type="file" accept=".json" onChange={handleImport} className="absolute inset-0 cursor-pointer opacity-0" />
              </label>
              <button
                onClick={handleWipe}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-gray-400 transition-all hover:bg-red-50 hover:text-red-500"
              >
                <Trash2 size={14} />
                {text('wipe')}
              </button>
            </div>
          </aside>

          <main className="flex-1 min-w-0 space-y-6 pr-6 max-w-[960px]">
            <nav className="no-scrollbar flex items-center gap-8 overflow-x-auto border-b border-gray-200 pb-px">
              <button
                onClick={() => setActiveTab('positions')}
                className={`relative whitespace-nowrap pb-4 text-xl font-semibold uppercase tracking-tight transition-all ${activeTab === 'positions' ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
              >
                {text('active')}
                {activeTab === 'positions' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-900/20" />}
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`relative whitespace-nowrap pb-4 text-xl font-semibold uppercase tracking-tight transition-all ${activeTab === 'history' ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
              >
                {text('history')}
                {activeTab === 'history' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-900/20" />}
              </button>
              <button
                onClick={() => setActiveTab('long_term')}
                className={`relative whitespace-nowrap pb-4 text-xl font-semibold uppercase tracking-tight transition-all ${activeTab === 'long_term' ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
              >
                {text('long_term')}
                {activeTab === 'long_term' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-900/20" />}
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`relative whitespace-nowrap pb-4 text-xl font-semibold uppercase tracking-tight transition-all ${activeTab === 'settings' ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
              >
                {text('config')}
                {activeTab === 'settings' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-900/20" />}
              </button>
            </nav>

            <div className="min-h-[600px]">
              {activeTab === 'positions' && <ActionSignalPositionsView positions={positions} onSell={onSell} />}
              {activeTab === 'history' && <TradeRecordsView />}
              {activeTab === 'long_term' && <LongTermView />}
              {activeTab === 'settings' && <SettingsPanel />}
            </div>
          </main>
        </div>
      </div>
    </Layout>
  );
}

function NormalMode({
  positions,
  onSell,
}: {
  positions: DangerPosition[];
  onSell: (position: DangerPosition) => void;
}) {
  return (
    <BrowserRouter>
      <AppShell positions={positions} onSell={onSell}>
        <Routes>
          <Route path="/" element={<PositionForm />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
}

export default function AppRoutes() {
  const positions = useDangerPositions();
  const [dangerLock, setDangerLock] = useState(false);
  const [dangerPositions, setDangerPositions] = useState<DangerPosition[]>([]);
  const closePosition = useAppStore((state) => state.closePosition);

  useEffect(() => {
    const hasDangerNow = positions.some((position) => position.isDangerCard);

    if (hasDangerNow) {
      setDangerLock(true);
      setDangerPositions((prevDangerPositions) => {
        const nextDangerPositions = positions.filter((position) => position.isDangerCard);
        const isSameDangerPositions =
          prevDangerPositions.length === nextDangerPositions.length &&
          prevDangerPositions.every((item, index) => item.id === nextDangerPositions[index]?.id);

        return isSameDangerPositions ? prevDangerPositions : nextDangerPositions;
      });
    }
  }, [positions]);

  const handleSell = (position: DangerPosition) => {
    const sellPrice = Number.isFinite(position.currentPrice) && position.currentPrice > 0 ? position.currentPrice : Number(position.buyPrice ?? 0);
    if (!Number.isFinite(sellPrice) || sellPrice <= 0) return;

    const resultType = position.isDangerCard ? 'stop_loss' : 'manual_exit';
    const reasonSell = position.isDangerCard ? '즉시 손절' : '매도 실행';
    closePosition(position.id, sellPrice, resultType, reasonSell);
    setDangerLock(false);
    setDangerPositions([]);
  };

  const dangerPosition = positions.find((position) => position.isDangerCard) ?? null;

  return (
    <React31Boundary>
      {dangerPosition ? (
        <DecisionMode positions={positions} dangerPosition={dangerPosition} onSell={handleSell} />
      ) : (
        <NormalMode positions={positions} onSell={handleSell} />
      )}
    </React31Boundary>
  );
}
