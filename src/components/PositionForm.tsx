import { useEffect, useState } from 'react';
import { fetchCandles, fetchTicker } from '../services/upbitService';
import { getEntryState, getSignalScore } from '../lib/signals';

const MARKET_ANALYSIS_CANDLE_COUNT = 24;
const TREND_LOOKBACK = 5;
const BREAKOUT_LOOKBACK = 20;
const RECENT_VOLUME_WINDOW = 3;
const BASELINE_VOLUME_WINDOW = 10;
const VOLUME_SPIKE_MULTIPLIER = 1.3;
const SUSTAIN_LOOKBACK = 3;

const average = (values: number[]) =>
  values.reduce((sum, value) => sum + value, 0) / values.length;

const normalizeWatchlistSymbol = (value: string) =>
  value.replace(/\s+/g, '').replace(/^KRW-/i, '').toUpperCase();

export function PositionForm() {
  const [stage, setStage] = useState('POSITIONFORM_STAGE2');
  const storeSignals = {};
  console.log('[SIGNALS_RAW]', storeSignals);

  const btcSignal = storeSignals?.['KRW-BTC'] ?? null;

  const evaluateEmailSignal = async (symbol: string) => {
    return {
      symbol,
      currentPrice: 1,
      entryState: 'ENTRY',
      price: 1,
      prepareState: 'READY',
      breakout: true,
      signalScore: 100,
      trend: true,
      volume: true,
    };

    const marketSymbol = `KRW-${normalizeWatchlistSymbol(symbol)}`;
    const ticker = await fetchTicker(marketSymbol);
    const price = Number(ticker?.trade_price ?? 0);

    if (!Number.isFinite(price) || price <= 0) {
      return null;
    }

    const candles = await fetchCandles(marketSymbol, MARKET_ANALYSIS_CANDLE_COUNT, 5);

    if (!Array.isArray(candles) || candles.length < MARKET_ANALYSIS_CANDLE_COUNT) {
      return null;
    }

    const candleData = candles.map((c: any) => ({
      open: c.opening_price,
      close: c.trade_price,
      high: c.high_price,
      low: c.low_price,
      volume: c.candle_acc_trade_volume,
      upperWickRatio:
        (c.high_price - Math.max(c.opening_price, c.trade_price)) /
        (c.high_price - c.low_price + Number.EPSILON),
    }));

    const completedCandles = candleData.slice(1);

    if (completedCandles.length < BREAKOUT_LOOKBACK + SUSTAIN_LOOKBACK) {
      return null;
    }

    const trendCandles = completedCandles.slice(0, TREND_LOOKBACK);
    const recentVolumeCandles = completedCandles.slice(0, RECENT_VOLUME_WINDOW);
    const baselineVolumeCandles = completedCandles.slice(
      RECENT_VOLUME_WINDOW,
      RECENT_VOLUME_WINDOW + BASELINE_VOLUME_WINDOW,
    );
    const breakoutReferenceCandles = completedCandles.slice(1, BREAKOUT_LOOKBACK + 1);
    const sustainReferenceCandles = completedCandles.slice(
      SUSTAIN_LOOKBACK,
      SUSTAIN_LOOKBACK + BREAKOUT_LOOKBACK,
    );
    const recentThreeCandles = completedCandles.slice(0, SUSTAIN_LOOKBACK);

    if (trendCandles.length < TREND_LOOKBACK) {
      return null;
    }

    const latestCompleted = completedCandles[0];
    const higherHighCount = trendCandles.slice(0, -1).reduce(
      (count, candle, index) => count + (candle.high > trendCandles[index + 1].high ? 1 : 0),
      0,
    );
    const higherLowCount = trendCandles.slice(0, -1).reduce(
      (count, candle, index) => count + (candle.low > trendCandles[index + 1].low ? 1 : 0),
      0,
    );
    const higherCloseCount = trendCandles.slice(0, -1).reduce(
      (count, candle, index) => count + (candle.close > trendCandles[index + 1].close ? 1 : 0),
      0,
    );

    const recentHigh = Math.max(...breakoutReferenceCandles.map((c) => c.high));
    const sustainedLevel = Math.max(...sustainReferenceCandles.map((c) => c.high));
    const avgVol3 = average(recentVolumeCandles.map((c) => c.volume));
    const avgVol10 = average(baselineVolumeCandles.map((c) => c.volume));

    const isUpTrend =
      higherHighCount >= 3 &&
      higherLowCount >= 3 &&
      higherCloseCount >= 3 &&
      latestCompleted.close > trendCandles[TREND_LOOKBACK - 1].close;

    const isBreakout = latestCompleted.close > recentHigh;
    const isSustained = recentThreeCandles.every((c) => c.close > sustainedLevel);
    const isVolumeSpike = avgVol3 >= avgVol10 * VOLUME_SPIKE_MULTIPLIER;
    const attemptedBreakout = latestCompleted.high > recentHigh;
    const breakoutRejected = attemptedBreakout && latestCompleted.close <= recentHigh;
    const isFakeout =
      breakoutRejected ||
      (isBreakout && !isVolumeSpike && latestCompleted.upperWickRatio >= 0.45) ||
      (attemptedBreakout && latestCompleted.upperWickRatio >= 0.55 && latestCompleted.close < latestCompleted.open);

    const trendActive = Boolean(isUpTrend);
    const volumeActive = Boolean(isVolumeSpike);
    const breakoutActive = Boolean(isBreakout);
    const fakeout = Boolean(isFakeout);
    const highRisk = Boolean(isBreakout && !isSustained);

    const signalScore = getSignalScore({
      trend: trendActive,
      volume: volumeActive,
      breakout: breakoutActive,
    });

    const entryState = getEntryState({
      trend: trendActive,
      volume: volumeActive,
      breakout: breakoutActive,
      fakeout,
      highRisk,
      btcTrend: btcSignal?.trend === 'up' ? 'up' : 'neutral',
    });

    const prepareState = null;

    return {
      currentPrice: price,
      entryState,
      price,
      prepareState,
      breakout: breakoutActive,
      signalScore,
      trend: trendActive,
      volume: volumeActive,
    };
  };

  useEffect(() => {
    let isCancelled = false;

    const runWatchlist = () => {
      const entryCandidates: Array<{
        symbol: string;
        entryState: string;
        price: number;
        trend: boolean;
        volume: boolean;
        breakout: boolean;
        signalScore: number;
        prepareState: string | null;
      }> = [];

      const watchlist = Object.keys(storeSignals ?? {});

      for (const symbol of watchlist) {
        try {
          const result = evaluateEmailSignal(symbol);
          if (isCancelled) return;
          if (!result || result.entryState !== 'ENTRY') continue;
          if (!Number.isFinite(result.currentPrice) || result.currentPrice <= 0) continue;

          entryCandidates.push({
            symbol,
            entryState: result.entryState,
            price: result.price,
            trend: result.trend,
            volume: result.volume,
            breakout: result.breakout,
            signalScore: result.signalScore,
            prepareState: result.prepareState,
          });
        } catch (error) {
          console.error('WATCHLIST SIGNAL ERROR:', symbol, error);
        }
      }

      entryCandidates.sort((a, b) => b.signalScore - a.signalScore);
      console.log('[RUNWATCHLIST_ONCE]', entryCandidates);
    };

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    setStage('POSITIONFORM_STAGE3');
  }, []);

  console.log(storeSignals);
  console.log(
    '[SIGNALS_KEYS]',
    Object.keys(storeSignals ?? {})
  );
  console.log(
    '[FIRST_SIGNAL]',
    Object.values(storeSignals ?? {})[0]
  );

  return (
    <div>
      POSITIONFORM_ISOLATE
    </div>
  );
}
