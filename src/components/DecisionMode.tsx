import { useEffect, useRef } from 'react';
import type { Position } from '../types';

type DangerPosition = Position & {
  currentPrice: number;
  profitRate: number;
  actionSignal: '?먯젅 ?ㅽ뻾' | '?듭젅 ?ㅽ뻾' | '愿留?';
  isDangerCard: boolean;
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

const signalToneClass = (actionSignal: DangerPosition['actionSignal']) => {
  if (actionSignal === '?먯젅 ?ㅽ뻾') return 'text-red-500';
  if (actionSignal === '?듭젅 ?ㅽ뻾') return 'text-green-500';
  return 'text-gray-400';
};

export function DecisionMode({
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
        console.log('[SELL_EFFECT][DecisionMode]', {
          id: position.id,
          coin: position.coin,
          actionSignal: position.actionSignal,
        });
        onSell(position);
      }
    });
  }, [positions, onSell]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black">
      <div className="mb-6 text-6xl font-bold text-white">{formatCoinName(dangerPosition.coin)}</div>
      <div className={`mb-10 text-center text-8xl font-black ${signalToneClass(dangerPosition.actionSignal)}`}>
        {dangerPosition.actionSignal}
      </div>
      <div className="mb-10 text-3xl text-gray-300">{asPercentText(dangerPosition.profitRate)}</div>
      <button className="rounded-xl bg-red-600 px-8 py-4 text-2xl text-white" onClick={() => onSell(dangerPosition)}>
        利됱떆 留ㅻ룄
      </button>
    </div>
  );
}
