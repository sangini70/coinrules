import { useEffect, useRef } from 'react';
import type { Position } from '../types';

type DangerPosition = Position & {
  currentPrice: number;
  profitRate: number;
  actionSignal: '손절 실행' | '익절 실행' | '관망';
  isDangerCard: boolean;
};

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

export function ActionSignalPositionsView({
  positions,
  onSell,
}: {
  positions: DangerPosition[];
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
        console.log('[SELL_EFFECT][ActionSignalPositionsView]', {
          id: position.id,
          coin: position.coin,
          actionSignal: position.actionSignal,
        });
        onSell(position);
      }
    });
  }, [positions, onSell]);

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
