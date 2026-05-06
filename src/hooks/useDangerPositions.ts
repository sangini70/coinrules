import { useEffect, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { fetchTicker } from '../services/upbitService';
import type { Position } from '../types';

export type DangerPosition = Position & {
  currentPrice: number;
  profitRate: number;
  actionSignal: 'SELL' | 'TAKE_PROFIT' | 'HOLD';
  isDangerCard: boolean;
};

export function useDangerPositions(): DangerPosition[] {
  const activePositions = useAppStore((state) => state.activePositions);
  const settings = useAppStore((state) => state.settings);
  const [positions, setPositions] = useState<DangerPosition[]>([]);

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      const stopLoss = Number(settings?.stopLoss ?? settings?.stopLossPercent ?? -2);
      const takeProfit = Number(settings?.takeProfitPercent ?? 3);
      const safeActivePositions = Array.isArray(activePositions) ? activePositions : [];

      const nextPositions = await Promise.all(
        safeActivePositions.map(async (position) => {
          let currentPrice = Number(position.buyPrice ?? 0);

          try {
            const ticker = await fetchTicker(position.coin || 'KRW-BTC');
            const tickerPrice = Number(ticker?.trade_price);
            if (Number.isFinite(tickerPrice) && tickerPrice > 0) {
              currentPrice = tickerPrice;
            }
          } catch {
            // keep the safe fallback price
          }

          const buyPrice = Number(position.buyPrice ?? 0);
          const profitRate = buyPrice > 0 && currentPrice > 0 ? ((currentPrice - buyPrice) / buyPrice) * 100 : 0;

          let actionSignal: DangerPosition['actionSignal'];
          if (profitRate <= stopLoss) {
            actionSignal = 'SELL';
          } else if (profitRate >= takeProfit) {
            actionSignal = 'TAKE_PROFIT';
          } else {
            actionSignal = 'HOLD';
          }

          return {
            ...position,
            currentPrice,
            profitRate,
            actionSignal,
            isDangerCard: actionSignal === 'SELL',
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
