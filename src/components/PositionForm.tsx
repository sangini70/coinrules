import { useState, useEffect, FormEvent, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';
import { DEFAULT_CONTROL, DEFAULT_SETTINGS, DEFAULT_SIGNAL } from '../store/useAppStore';
import { fetchTicker, fetchCandles } from '../services/upbitService';
import { formatPrice } from '../lib/utils';
import { getExplain } from '../lib/explain';
import { getEntryState, getPrepareState, getSignalScore } from '../lib/signals';
import {
  SHORT_TERM_STOP_LOSS_PERCENT,
  SHORT_TERM_TAKE_PROFIT_1_PERCENT,
  SHORT_TERM_TAKE_PROFIT_2_PERCENT,
} from '../lib/tradingRules';
import { Loader2, Info, CheckCircle2, AlertTriangle, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Translation } from '../i18n/types';

const COIN_OPTIONS = ['KRW-BTC', 'KRW-ETH', 'KRW-SOL', 'KRW-XRP', 'KRW-ADA', 'KRW-DOGE', 'KRW-AVAX', 'KRW-DOT'];
const DEFAULT_WATCHLIST = ['BTC', 'ETH', 'XRP', 'SOL', 'ADA', 'DOGE'];
const MARKET_ANALYSIS_CANDLE_COUNT = 24;
const TREND_LOOKBACK = 5;
const BREAKOUT_LOOKBACK = 20;
const RECENT_VOLUME_WINDOW = 3;
const BASELINE_VOLUME_WINDOW = 10;
const VOLUME_SPIKE_MULTIPLIER = 1.3;
const SUSTAIN_LOOKBACK = 3;

type CandleSnapshot = {
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
  upperWickRatio: number;
};

type MarketAnalysis = {
  isUpTrend: boolean;
  isVolumeSpike: boolean;
  isBreakout: boolean;
  isSustained: boolean;
  isFakeout: boolean;
  recentHigh: number;
};

type LiquiditySnapshot = {
  avgVolume5m: number;
  volume1m: number;
};

const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
const formatMetric = (value: number, fractionDigits: number = 2) =>
  Number.isFinite(value) ? value.toLocaleString('ko-KR', { maximumFractionDigits: fractionDigits }) : '-';
const normalizeWatchlistSymbol = (value: string) =>
  value.replace(/\s+/g, '').replace(/^KRW-/i, '').toUpperCase();

export function PositionForm() {
  const { settings, addPosition, isCoinInCooldown, getCooldownRemaining, control, signals } = useAppStore();
  const tFromStore = useAppStore((state) => state.t);
  const t = typeof tFromStore === 'function' ? tFromStore() : ((key: string) => key);
  const safeSettings = settings ?? DEFAULT_SETTINGS;
  const safeControl = control ?? DEFAULT_CONTROL;
  const safeSignals = signals ?? {};
  
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [marketAnalysis, setMarketAnalysis] = useState<MarketAnalysis | null>(null);
  const [liquiditySnapshot, setLiquiditySnapshot] = useState<LiquiditySnapshot>({
    avgVolume5m: 0,
    volume1m: 0,
  });
  const [formData, setFormData] = useState({
    coin: 'KRW-BTC',
    type: 'short_term' as 'short_term' | 'long_term',
    buyPrice: 0,
    amount: 1000000, 
    quantity: 0,
    memo: '',
  });

  const [cooldownTime, setCooldownTime] = useState(0);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isPriceHighlighted, setIsPriceHighlighted] = useState(false);
  const [coinInput, setCoinInput] = useState('');
  const [watchlistInput, setWatchlistInput] = useState('');
  const [marketList, setMarketList] = useState<string[]>([]);
  const [watchlist, setWatchlist] = useState<string[]>(() => {
    if (typeof window === 'undefined') {
      return DEFAULT_WATCHLIST;
    }

    try {
      const raw = window.localStorage.getItem('asset-protection-watchlist');
      if (!raw) return DEFAULT_WATCHLIST;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return DEFAULT_WATCHLIST;

      const normalized = Array.from(
        new Set(
          parsed
            .map((item) => normalizeWatchlistSymbol(String(item ?? '')))
            .filter((item) => Boolean(item)),
        ),
      ).slice(0, 10);

      return normalized.length > 0 ? normalized : DEFAULT_WATCHLIST;
    } catch {
      return DEFAULT_WATCHLIST;
    }
  });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const lastGlobalSentAt = useRef<number>(0);
  const market = (formData.coin || 'KRW-BTC').startsWith('KRW-') ? formData.coin : `KRW-${formData.coin || 'BTC'}`;

  useEffect(() => {
    const fetchMarkets = async () => {
      try {
        const res = await fetch('https://api.upbit.com/v1/market/all');
        const data = await res.json();

        const krwMarkets = Array.isArray(data)
          ? data
              .filter((m: any) => typeof m?.market === 'string' && m.market.startsWith('KRW-'))
              .map((m: any) => m.market)
          : [];

        setMarketList(krwMarkets);
      } catch (e) {
        console.error('마켓 로드 실패', e);
      }
    };

    void fetchMarkets();
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem('asset-protection-watchlist', JSON.stringify(watchlist));
    } catch (error) {
      console.warn('WATCHLIST 저장 실패', error);
    }
  }, [watchlist]);

  const isValidCoin = (coin: string) => marketList.includes(`KRW-${coin}`);

  useEffect(() => {
    let active = true;
    const fetchSignalsAction = useAppStore.getState().fetchSignals;
    setMarketAnalysis(null);

    const fetchMarketData = async () => {
      const ticker = await fetchTicker(market);
      const [candles, oneMinuteCandles] = await Promise.all([
        fetchCandles(market, MARKET_ANALYSIS_CANDLE_COUNT, 5),
        fetchCandles(market, 2, 1),
      ]);

      if (!active) return;
      
      if (ticker) {
        setCurrentPrice((prevPrice) => (prevPrice === ticker.trade_price ? prevPrice : ticker.trade_price));
        
        // Analyze candles
        if (candles && candles.length >= MARKET_ANALYSIS_CANDLE_COUNT) {
          const candleData: CandleSnapshot[] = candles.map((c) => ({
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

          const avgVolume5m = average(
            completedCandles
              .slice(0, 5)
              .map((c) => c.volume)
              .filter((volume) => Number.isFinite(volume) && volume > 0),
          );
          const volume1m = Array.isArray(oneMinuteCandles) && oneMinuteCandles.length > 0
            ? Math.max(0, Number(oneMinuteCandles[0]?.candle_acc_trade_volume ?? 0))
            : 0;

          setLiquiditySnapshot((prevSnapshot) => (
            prevSnapshot.avgVolume5m === avgVolume5m && prevSnapshot.volume1m === volume1m
              ? prevSnapshot
              : { avgVolume5m, volume1m }
          ));

          if (completedCandles.length >= BREAKOUT_LOOKBACK + SUSTAIN_LOOKBACK) {
            const latestCompleted = completedCandles[0];
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

            const higherHighCount = trendCandles
              .slice(0, -1)
              .reduce(
                (count, candle, index) => count + (candle.high > trendCandles[index + 1].high ? 1 : 0),
                0,
              );
            const higherLowCount = trendCandles
              .slice(0, -1)
              .reduce(
                (count, candle, index) => count + (candle.low > trendCandles[index + 1].low ? 1 : 0),
                0,
              );
            const higherCloseCount = trendCandles
              .slice(0, -1)
              .reduce(
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

            setMarketAnalysis((prevAnalysis) => {
              const nextAnalysis = { isUpTrend, isVolumeSpike, isBreakout, isSustained, isFakeout, recentHigh };
              return JSON.stringify(prevAnalysis) === JSON.stringify(nextAnalysis) ? prevAnalysis : nextAnalysis;
            });
          }
        }
      }
    };
    
    void fetchSignalsAction(market);
    void fetchMarketData();
    const interval = setInterval(() => {
      void fetchSignalsAction(market);
      void fetchMarketData();
    }, 60000);
    
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [market]);

  useEffect(() => {
    const getCooldownRemainingAction = useAppStore.getState().getCooldownRemaining;
    const checkCooldown = () => {
      const nextCooldownTime = getCooldownRemainingAction(formData.coin || 'KRW-BTC');
      setCooldownTime((prevCooldownTime) => (prevCooldownTime === nextCooldownTime ? prevCooldownTime : nextCooldownTime));
    };
    checkCooldown();
    const interval = setInterval(checkCooldown, 1000);
    return () => clearInterval(interval);
  }, [formData.coin]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredCoins = COIN_OPTIONS.filter(c => c.replace('KRW-', '').toLowerCase().includes(coinInput.toLowerCase()));
  const isCustomCoin = coinInput.length >= 2 && !COIN_OPTIONS.includes(`KRW-${coinInput.toUpperCase()}`);
  const customMarket = `KRW-${coinInput.toUpperCase()}`;
  // [CHANGED] Normalize the current selection so the UI always reads the same Zustand key.
  const selectedCoin = (formData.coin || 'KRW-BTC').startsWith('KRW-') ? (formData.coin || 'KRW-BTC') : `KRW-${formData.coin || 'BTC'}`;
  // [CHANGED] Bind the UI to the live store signal, with a minimal fallback only for first render.
  const safeSignal = safeSignals?.[selectedCoin ?? 'KRW-BTC'] ?? DEFAULT_SIGNAL;
  const btcSignal = safeSignals?.['KRW-BTC'] ?? DEFAULT_SIGNAL;

  const handleSelectCoin = (coin: string) => {
    setFormData({ ...formData, coin });
    setCoinInput('');
    setIsDropdownOpen(false);
  };

  const handleFetchPrice = async () => {
    const market = formData.coin.startsWith('KRW-') ? formData.coin : `KRW-${formData.coin}`;

    try {
      const ticker = await fetchTicker(market);
      
      if (ticker && ticker.trade_price > 0) {
        setFormData(prev => ({
          ...prev,
          buyPrice: ticker.trade_price,
          quantity: prev.amount / ticker.trade_price
        }));
        // Trigger highlight
        setIsPriceHighlighted(true);
        setTimeout(() => setIsPriceHighlighted(false), 800);
      } else {
        console.error("INVALID PRICE: No valid trade price received");
      }
    } catch (e) {
      console.error("PRICE FETCH ERROR:", e);
    }
  };

  const handlePriceChange = (value: number) => {
    setFormData(prev => ({ 
      ...prev, 
      buyPrice: value,
      quantity: value > 0 ? prev.amount / value : 0
    }));
  };

  const handleAmountChange = (value: number) => {
    setFormData(prev => ({ 
      ...prev, 
      amount: value,
      quantity: prev.buyPrice > 0 ? value / prev.buyPrice : 0
    }));
  };

  const estimatedQuantity = formData.buyPrice > 0 ? formData.amount / formData.buyPrice : 0;
  const avgVolume5m = liquiditySnapshot.avgVolume5m;
  const volume1m = liquiditySnapshot.volume1m;
  const positionVolumeRatio5m = avgVolume5m > 0 ? estimatedQuantity / avgVolume5m : Number.POSITIVE_INFINITY;
  const positionVolumeRatio1m = volume1m > 0 ? estimatedQuantity / volume1m : Number.POSITIVE_INFINITY;
  const liquidityRisk =
    positionVolumeRatio5m > 0.5 || positionVolumeRatio1m > 1.0 ? 'NO_ENTRY' : 'OK';
  const liquidityBlockMessage =
    '?쒖옣 嫄곕옒???鍮??덉긽 蹂댁쑀 ?섎웾??怨쇰룄?⑸땲??\n媛寃⑹씠 ?щ씪??留ㅻ룄 泥닿껐???대졄嫄곕굹 ???먯떎??諛쒖깮?????덉뼱 吏꾩엯??李⑤떒?⑸땲??';

  const blockEntry = (message: string) => {
    window.alert(message);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (formData.buyPrice <= 0 || formData.amount <= 0 || safeControl.isInputDisabled || cooldownTime > 0) return;

    // ENTRY PRE-CHECK: liquidity exit risk
    const estimatedQuantity = formData.amount / formData.buyPrice;
    const avgVolume5m = liquiditySnapshot.avgVolume5m;
    const volume1m = liquiditySnapshot.volume1m;
    const positionVolumeRatio5m = avgVolume5m > 0 ? estimatedQuantity / avgVolume5m : Number.POSITIVE_INFINITY;
    const positionVolumeRatio1m = volume1m > 0 ? estimatedQuantity / volume1m : Number.POSITIVE_INFINITY;
    const liquidityRisk =
      positionVolumeRatio5m > 0.5 || positionVolumeRatio1m > 1.0 ? 'NO_ENTRY' : 'OK';

    if (liquidityRisk === 'NO_ENTRY') {
      return blockEntry(
        '시장 거래량 대비 예상 보유 수량이 과도합니다.\n가격이 올라도 매도 체결이 어렵거나 큰 손실이 발생할 수 있어 진입을 차단합니다.',
      );
    }

    const slPrice = formData.buyPrice * (1 + SHORT_TERM_STOP_LOSS_PERCENT / 100);
    const tp1Price = formData.buyPrice * (1 + SHORT_TERM_TAKE_PROFIT_1_PERCENT / 100);
    const tp2Price = formData.buyPrice * (1 + SHORT_TERM_TAKE_PROFIT_2_PERCENT / 100);

    addPosition({
      coin: formData.coin,
      type: formData.type,
      buyPrice: formData.buyPrice,
      quantity: formData.quantity,
      entryAmount: formData.amount,
      stopLossPercent: formData.type === 'short_term' ? SHORT_TERM_STOP_LOSS_PERCENT : 0,
      takeProfitPercent: formData.type === 'short_term' ? safeSettings.takeProfitPercent : 0,
      stopLossPrice: formData.type === 'short_term' ? slPrice : 0,
      takeProfitPrice1: formData.type === 'short_term' ? tp1Price : 0,
      takeProfitPrice2: formData.type === 'short_term' ? tp2Price : 0,
      memo: formData.memo,
      isLocked: formData.type === 'long_term',
    });
    
    // Reset form partially
    setFormData(prev => ({ ...prev, buyPrice: 0, quantity: 0, memo: '' }));
  };

  const isInputBlocked = safeControl?.isInputDisabled ?? false;
  const isCoinBlocked = (cooldownTime ?? 0) > 0;
  const isBlocked = isInputBlocked || isCoinBlocked;

  // Rule Summary Preview
  const slPreview = formData.buyPrice > 0 ? formData.buyPrice * (1 + SHORT_TERM_STOP_LOSS_PERCENT / 100) : 0;
  const tp1Preview = formData.buyPrice > 0 ? formData.buyPrice * (1 + SHORT_TERM_TAKE_PROFIT_1_PERCENT / 100) : 0;
  const tp2Preview = formData.buyPrice > 0 ? formData.buyPrice * (1 + SHORT_TERM_TAKE_PROFIT_2_PERCENT / 100) : 0;

  const entryAnalysis = (() => {
    const signalTrendUp = safeSignal.trend === 'up';
    const signalVolumeSpike = safeSignal.volume === 'spike';
    const signalBreakout = safeSignal.breakout === 'bullish_breakout';

    const trendActive = Boolean(marketAnalysis?.isUpTrend || signalTrendUp);
    const volumeActive = Boolean(marketAnalysis?.isVolumeSpike || signalVolumeSpike);
    const breakoutActive = Boolean(marketAnalysis?.isBreakout || signalBreakout);
    const fakeout = Boolean(marketAnalysis?.isFakeout);
    const highRisk = Boolean(marketAnalysis?.isBreakout && !marketAnalysis?.isSustained);

    let score = 0;
    if (marketAnalysis?.isUpTrend) score += 30;
    if (marketAnalysis?.isVolumeSpike) score += 20;
    if (marketAnalysis?.isBreakout) score += 25;
    if (marketAnalysis?.isSustained) score += 15;
    if (marketAnalysis?.isBreakout && marketAnalysis?.isVolumeSpike) score += 10;
    if (marketAnalysis?.isBreakout && marketAnalysis?.isSustained) score += 10;
    if (marketAnalysis?.isBreakout && !marketAnalysis?.isSustained) score -= 10;
    score = Math.max(0, Math.min(100, score));

    const scoreLabel = score >= 75 ? '높음' : (score >= 60 ? '보통' : '낮음');
    const scoreColor = score >= 75 ? 'text-text-main' : (score >= 60 ? 'text-blue-500' : 'text-yellow-600');
    const entryState = getEntryState({
      trend: trendActive,
      volume: volumeActive,
      breakout: breakoutActive,
      fakeout,
      highRisk,
      btcTrend: btcSignal.trend,
    });

    const conclusionMap: Record<'AVOID' | 'RISK' | 'ENTRY' | 'OBSERVE' | 'WAIT', string> = {
      AVOID: '회피',
      RISK: '손절 임박',
      ENTRY: '진입',
      OBSERVE: '관찰',
      WAIT: '대기',
    };

    const reasons =
      entryState === 'AVOID'
        ? ['돌파 실패 흔적', '지지선 확인 필요']
        : entryState === 'RISK'
          ? ['손절 기준 근접', '변동성 점검 필요']
          : entryState === 'ENTRY'
            ? ['추세 확인', '거래량 확인', '돌파 확인']
            : entryState === 'OBSERVE'
              ? ['추세 유지 중', '추가 확인 필요']
              : ['신호 부족', '방향성 확인 필요'];

    return {
      score,
      scoreLabel,
      scoreColor,
      conclusion: conclusionMap[entryState],
      reasons,
      entryState,
      trendActive,
      volumeActive,
      breakoutActive,
    };
  })();

  const trendReady = entryAnalysis.trendActive;
  const volumeReady = entryAnalysis.volumeActive;
  const breakoutReady = entryAnalysis.breakoutActive;

  const entryState = entryAnalysis.entryState;
  const actionGuide =
    entryState === 'ENTRY'
      ? '소액 매수 가능'
      : entryState === 'OBSERVE'
        ? '매수하지 말고 관찰하라'
        : entryState === 'WAIT'
          ? '대기'
        : entryState === 'AVOID'
          ? '매수 금지'
          : '매수 금지 (리스크 구간)';

  const prepareState = getPrepareState({
    trend: trendReady,
    volume: volumeReady,
    breakout: breakoutReady,
  });
  const signalScore = getSignalScore({
    trend: trendReady,
    volume: volumeReady,
    breakout: breakoutReady,
  });
  let scoreColor = "text-gray-400";

  if (signalScore >= 80) {
    scoreColor = "text-green-500";
  } else if (signalScore >= 60) {
    scoreColor = "text-yellow-500";
  } else {
    scoreColor = "text-red-500";
  }

  const failReasons: string[] = [];

  if (!trendReady) failReasons.push("Trend 부족");
  if (!volumeReady) failReasons.push("거래량 부족");
  if (!breakoutReady) failReasons.push("돌파 부족");
  if (signalScore < 80) failReasons.push("점수 부족");
  if (prepareState !== "ENTRY") failReasons.push("진입 단계 아님");
  if (btcSignal.trend !== "up") failReasons.push("BTC 하락");

  const getColor = (v: boolean) => (v ? "text-green-500" : "text-red-500");
  const explain = getExplain({
    state: entryState,
    trendReady,
    volumeReady,
    breakoutReady,
    btcTrend: btcSignal.trend,
    score: signalScore,
  });
  const explainReason = entryState === "ENTRY" ? "조건 충족" : failReasons.slice(0, 2).join(" / ") || "조건 부족";

  const addWatchlistSymbol = () => {
    const normalized = normalizeWatchlistSymbol(watchlistInput);
    if (!normalized) return;
    if (watchlist.includes(normalized)) return;
    if (!isValidCoin(normalized)) {
      alert('존재하지 않는 코인입니다');
      return;
    }
    setWatchlist((prev) => {
      if (prev.includes(normalized)) return prev;
      if (prev.length >= 10) return prev;
      return [...prev, normalized];
    });
    setWatchlistInput('');
  };

  const removeWatchlistSymbol = (symbol: string) => {
    setWatchlist((prev) => {
      const next = prev.filter((item) => item !== symbol);
      return next.length > 0 ? next : DEFAULT_WATCHLIST;
    });
  };

  const resetWatchlist = () => {
    setWatchlist(DEFAULT_WATCHLIST);
    setWatchlistInput('');
  };

  const evaluateEmailSignal = async (symbol: string) => {
    const marketSymbol = `KRW-${symbol}`;
    const ticker = await fetchTicker(marketSymbol);
    const [candles, oneMinuteCandles] = await Promise.all([
      fetchCandles(marketSymbol, MARKET_ANALYSIS_CANDLE_COUNT, 5),
      fetchCandles(marketSymbol, 2, 1),
    ]);

    if (!ticker || !Array.isArray(candles) || candles.length < MARKET_ANALYSIS_CANDLE_COUNT) {
      return null;
    }

    const candleData: CandleSnapshot[] = candles.map((c) => ({
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

    const latestCompleted = completedCandles[0];
    const trendCandles = completedCandles.slice(0, TREND_LOOKBACK);
    const recentVolumeCandles = completedCandles.slice(0, RECENT_VOLUME_WINDOW);
    const baselineVolumeCandles = completedCandles.slice(
      RECENT_VOLUME_WINDOW,
      RECENT_VOLUME_WINDOW + BASELINE_VOLUME_WINDOW,
    );
    const breakoutReferenceCandles = completedCandles.slice(1, BREAKOUT_LOOKBACK + 1);
    const sustainReferenceCandles = completedCandles.slice(SUSTAIN_LOOKBACK, SUSTAIN_LOOKBACK + BREAKOUT_LOOKBACK);
    const recentThreeCandles = completedCandles.slice(0, SUSTAIN_LOOKBACK);

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
    const prepareState = getPrepareState({
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
      btcTrend: btcSignal.trend,
    });

    return {
      market: marketSymbol,
      symbol: marketSymbol.replace('KRW-', ''),
      price: Number(ticker.trade_price ?? 0),
      currentPrice: Number(ticker.trade_price ?? 0),
      entryState,
      trend: trendActive,
      volume: volumeActive,
      breakout: breakoutActive,
      signalScore,
      prepareState,
    };
  };

  useEffect(() => {
    let isCancelled = false;
    const EMAIL_COOLDOWN = 1 * 60 * 1000;

    const runWatchlist = async () => {
      const entryCandidates: Array<{
        symbol: string;
        entryState: string;
        price: number;
        trend: boolean;
        volume: boolean;
        breakout: boolean;
        signalScore: number;
        prepareState: string;
      }> = [];

      for (const symbol of watchlist) {
        try {
          const result = await evaluateEmailSignal(symbol);
          if (!result || isCancelled) continue;
          if (result.entryState !== 'ENTRY') continue;
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
      const bestEntry = entryCandidates[0];

      if (
        bestEntry &&
        Date.now() - lastGlobalSentAt.current > EMAIL_COOLDOWN
      ) {
        lastGlobalSentAt.current = Date.now();
        void fetch('/api/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            symbol: bestEntry.symbol,
            entryState: bestEntry.entryState,
            price: bestEntry.price,
            trend: bestEntry.trend,
            volume: bestEntry.volume,
            breakout: bestEntry.breakout,
            signalScore: bestEntry.signalScore,
            prepareState: bestEntry.prepareState,
          }),
        }).catch((error) => {
          console.error('EMAIL SEND ERROR:', error);
        });
      }
    };

    void runWatchlist();
    const interval = setInterval(() => {
      void runWatchlist();
    }, 60_000);

    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [btcSignal.trend, watchlist]);

  if (isInputBlocked) {
    return (
      <div className="p-8 border border-status-danger/50 bg-status-danger/5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-700">
        <div className="flex items-center gap-2 text-status-danger">
          <AlertTriangle size={18} />
          <span className="text-[10px] font-black uppercase tracking-[0.2em]">{t('input_blocked')}</span>
        </div>
        <p className="text-xs text-status-danger/90 font-bold leading-relaxed whitespace-pre-line">
          {t('inputBlocked')}
        </p>
        <div className="pt-4 mt-4 border-t border-status-danger/20">
          <p className="text-[9px] text-status-danger/40 uppercase font-mono italic">
            {safeControl.todayTradeCount >= safeSettings.maxDailyTrades 
              ? t('blocked_limit') 
              : t('blocked_tilt')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          {/* MARKET SELECT */}
          <div className="space-y-2 relative" ref={dropdownRef}>
            <label className="text-[9px] font-black uppercase tracking-[0.2em] text-text-muted/40 px-1">{t('select_coin')}</label>
            <div className="relative">
              <input
                type="text"
                value={coinInput}
                onChange={(e) => setCoinInput(e.target.value.replace(/[^A-Za-z]/g, '').toUpperCase())}
                onFocus={() => setIsDropdownOpen(true)}
                placeholder={formData.coin.replace('KRW-', '')}
                className="w-full bg-aux-bg border border-text-main/10 p-4 text-xl font-black uppercase tracking-tight text-text-main outline-none focus:border-text-muted/30 transition-all"
              />
              <ChevronDown size={16} className={`absolute right-4 top-1/2 -translate-y-1/2 text-text-muted/40 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </div>
            
            <AnimatePresence>
              {isDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute z-50 left-0 right-0 top-full mt-1 bg-card-bg border border-text-main/10 shadow-2xl overflow-hidden"
                >
                  <div className="max-h-48 overflow-y-auto overscroll-contain scrollbar-hide">
                    {filteredCoins.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => handleSelectCoin(opt)}
                        className={`w-full p-4 text-left font-black uppercase tracking-tight text-sm hover:bg-text-main/5 transition-colors border-b border-text-main/5 last:border-0 ${formData.coin === opt ? 'text-text-main bg-text-main/5' : 'text-text-muted'}`}
                      >
                        {opt.replace('KRW-', '')}
                      </button>
                    ))}
                    {isCustomCoin && (
                      <button
                        type="button"
                        onClick={() => handleSelectCoin(customMarket)}
                        className="w-full p-4 text-left font-black uppercase tracking-tight text-sm bg-status-safe/10 text-status-safe hover:bg-status-safe/20 transition-colors"
                      >
                        직접 입력: {coinInput.toUpperCase()}
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* STRATEGY TYPE */}
          <div className="space-y-2">
            <label className="text-[9px] font-black uppercase tracking-[0.2em] text-text-muted/40 px-1">{t('select_strategy')}</label>
            <div className="grid grid-cols-2 gap-1 bg-aux-bg p-1 border border-text-main/5">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: 'short_term' })}
                className={`py-2 text-[10px] font-black uppercase tracking-widest transition-all ${formData.type === 'short_term' ? 'bg-status-safe text-white' : 'text-text-muted/40 hover:text-text-main'}`}
              >
                {t('shortTerm')}
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: 'long_term' })}
                className={`py-2 text-[10px] font-black uppercase tracking-widest transition-all ${formData.type === 'long_term' ? 'bg-purple-600 text-white' : 'text-text-muted/40 hover:text-text-main'}`}
              >
                {t('longTerm')}
              </button>
            </div>
          </div>

          {/* BUY PRICE */}
          <div className="space-y-2">
            <label className="text-[9px] font-black uppercase tracking-[0.2em] text-text-muted/40 px-1">{t('buy_price')}</label>
            <input 
              type="text"
              inputMode="numeric"
              value={formData.buyPrice || ''}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9]/g, '');
                handlePriceChange(Number(val));
              }}
              placeholder={t('placeholder_buy_price')}
              className="w-full h-14 bg-aux-bg border border-text-main/5 p-4 text-xl font-black tracking-tight text-text-main outline-none focus:border-text-main/30 transition-all"
            />
            <button
              type="button"
              onClick={handleFetchPrice}
              className="w-full h-11 bg-text-main/5 border border-text-main/10 text-[9px] font-black uppercase tracking-widest text-text-muted hover:text-text-main hover:bg-text-main/10 transition-all"
            >
              {t('auto_price')}
            </button>
          </div>

          {/* AMOUNT */}
          <div className="space-y-2">
            <label className="text-[9px] font-black uppercase tracking-[0.2em] text-text-muted/40 px-1">{t('investment')}</label>
            <div className="relative group">
              <input 
                type="number"
                value={formData.amount || ''}
                onChange={(e) => handleAmountChange(Number(e.target.value))}
                placeholder={t('placeholder_amount')}
                className="w-full bg-aux-bg border border-text-main/5 p-4 text-xl font-black tracking-tight text-text-main outline-none focus:border-text-main/30 transition-all"
              />
              {/* Visual Focus Ring */}
              <div className="absolute inset-0 border-2 border-text-main opacity-0 pointer-events-none focus-within:opacity-5 transition-opacity"></div>
            </div>
          </div>

          {/* RULE SUMMARY */}
          <div className="p-5 bg-card-bg border border-text-main/5 space-y-4">
            <div className="text-[9px] font-black uppercase tracking-[0.2em] text-text-muted/30 mb-1 flex justify-between">
              <span>{t('rule_summary')}</span>
              <CheckCircle2 size={12} className={formData.buyPrice > 0 ? 'text-status-safe' : 'text-text-muted/10'} />
            </div>
            <div className="space-y-2 font-mono text-[11px] font-bold">
              <div className="flex justify-between items-center pb-2 border-b border-text-main/5">
                <span className="text-text-muted/40">SL ({safeSettings.stopLossPercent}%)</span>
                <span className="text-status-danger/40 text-[9px]">({slPreview ? formatPrice(slPreview) : "-"})</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-text-main/5">
                <span className="text-text-muted/40">TP1 (+{SHORT_TERM_TAKE_PROFIT_1_PERCENT}%)</span>
                <span className="text-status-safe/40 text-[9px]">({tp1Preview ? formatPrice(tp1Preview) : "-"})</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-muted/40">TP2 (+{SHORT_TERM_TAKE_PROFIT_2_PERCENT}%)</span>
                <span className="text-status-safe/40 text-[9px]">({tp2Preview ? formatPrice(tp2Preview) : "-"})</span>
              </div>
            </div>
          </div>

          {/* SUBMIT BUTTON */}
          <button
            type="submit"
            disabled={formData.buyPrice <= 0 || isBlocked}
            className={`w-full py-5 font-black uppercase text-xs tracking-[0.3em] transition-all relative overflow-hidden group ${formData.buyPrice > 0 && !isBlocked ? 'bg-text-main text-main-bg hover:opacity-90' : 'bg-aux-bg text-text-muted/20 cursor-not-allowed border border-text-main/5'}`}
          >
            <span className="relative z-10">{t('confirm_button')}</span>
          </button>
        </div>

        <div className="space-y-6">
          <div className="p-4 border rounded">
            <div className="text-sm text-gray-500">감시 코인 설정</div>
            <div className="flex flex-wrap gap-2 mt-2">
              {watchlist.map((symbol) => (
                <span key={symbol} className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm">
                  <span>{symbol}</span>
                  <button
                    type="button"
                    onClick={() => removeWatchlistSymbol(symbol)}
                    className="text-gray-500 hover:text-red-500"
                    aria-label={`${symbol} 삭제`}
                  >
                    x
                  </button>
                </span>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                value={watchlistInput}
                onChange={(e) => setWatchlistInput(e.target.value)}
                placeholder="예: SHIB, DOT, AVAX"
                className="flex-1 border rounded px-3 py-2 text-sm"
              />
              <button type="button" onClick={addWatchlistSymbol} className="border rounded px-3 py-2 text-sm font-semibold">
                추가
              </button>
              <button type="button" onClick={resetWatchlist} className="border rounded px-3 py-2 text-sm font-semibold">
                초기화
              </button>
            </div>
          </div>
          <div className="p-4 border rounded">
            <div className="text-sm text-gray-500">감시 코인</div>
            <div className="text-sm font-semibold">{watchlist.join(' / ')}</div>
          </div>
          <div className="p-4 border rounded">
            <div className="text-sm text-gray-500">현재 상태</div>
            <div className="text-xl font-bold">{entryState}</div>
          </div>
          <div className="p-4 border rounded mt-4">
            <div className="text-xs text-gray-400 mb-1">
              {"신규 진입 기준 (매수 판단)"}
            </div>
            <div className="text-sm text-gray-500">{"지금 상황 해석"}</div>
            <div className="text-sm">{"지금 결론: "}{explain.summary}</div>
            <div className="text-sm">{"이유 요약: "}{explainReason}</div>
            <div className="text-sm">{"다음 행동: "}{explain.action}</div>
            <div className="text-sm">{"리스크: "}{explain.risk}</div>
          </div>
          <div className="p-4 border rounded mt-4">
            <div className="text-sm text-gray-500">판단 근거</div>
            <div>Trend: {trendReady ? "OK" : "NO"}</div>
            <div>Volume: {volumeReady ? "OK" : "NO"}</div>
            <div>Breakout: {breakoutReady ? "OK" : "NO"}</div>
          </div>
          <div className="p-4 border rounded mt-4">
            <div className="text-sm text-gray-500">진입 단계</div>
            <div className="text-lg font-semibold">{prepareState}</div>
          </div>
          <div className="p-4 border rounded mt-4">
            <div className="text-sm text-gray-500">신호 점수</div>
            <div className={`text-lg font-semibold ${scoreColor}`}>
              {signalScore} / 100
            </div>
          </div>
          <div className="p-4 border rounded mt-4">
            <div className="text-sm text-gray-500">ENTRY 체크</div>
            <div className={getColor(trendReady)}>
              Trend: {trendReady ? "OK" : "NO"}
            </div>
            <div className={getColor(volumeReady)}>
              Volume: {volumeReady ? "OK" : "NO"}
            </div>
            <div className={getColor(breakoutReady)}>
              Breakout: {breakoutReady ? "OK" : "NO"}
            </div>
            <div className={getColor(signalScore >= 80)}>
              Score: {signalScore >= 80 ? "OK" : "NO"}
            </div>
            <div className={getColor(prepareState === "ENTRY")}>
              Stage: {prepareState === "ENTRY" ? "OK" : "NO"}
            </div>
            <div className={getColor(btcSignal.trend === "up")}>
              BTC: {btcSignal.trend === "up" ? "OK" : "NO"}
            </div>
          </div>
          <div className="p-4 border rounded mt-4">
            <div className="text-sm text-gray-500">ENTRY 실패 이유</div>
            {entryState === "ENTRY" ? (
              <div className="text-green-500">진입 가능</div>
            ) : (
              <ul className="text-sm list-disc pl-4">
                {failReasons.slice(0, 2).map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            )}
          </div>
          <div className={`mt-3 p-4 border rounded-lg ${liquidityRisk === 'NO_ENTRY' ? 'bg-status-danger/5 border-status-danger/20' : 'bg-gray-50 border-text-main/10'}`}>
            <div className="text-sm font-semibold text-gray-700 mb-2">참고 데이터</div>
            <div className="grid grid-cols-2 gap-3 text-xs text-gray-700">
              <div className="space-y-1">
                <div className="text-text-muted/60">예상 보유 수량</div>
                <div className="font-semibold">{formatMetric(estimatedQuantity, 6)}</div>
              </div>
              <div className="space-y-1">
                <div className="text-text-muted/60">5분 평균 거래량</div>
                <div className="font-semibold">{formatMetric(avgVolume5m, 6)}</div>
              </div>
              <div className="space-y-1">
                <div className="text-text-muted/60">1분 거래량</div>
                <div className="font-semibold">{formatMetric(volume1m, 6)}</div>
              </div>
              <div className="space-y-1">
                <div className="text-text-muted/60">최종 판정</div>
                <div className={`font-semibold ${liquidityRisk === 'NO_ENTRY' ? 'text-status-danger' : 'text-status-safe'}`}>
                  {liquidityRisk === 'NO_ENTRY' ? '진입 차단' : '진입 가능'}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-text-muted/60">5분 대비 내 물량 비율</div>
                <div className="font-semibold">{formatMetric(positionVolumeRatio5m, 4)}</div>
              </div>
              <div className="space-y-1">
                <div className="text-text-muted/60">1분 대비 내 물량 비율</div>
                <div className="font-semibold">{formatMetric(positionVolumeRatio1m, 4)}</div>
              </div>
            </div>
            {liquidityRisk === 'NO_ENTRY' && (
              <p className="mt-3 text-xs leading-relaxed text-status-danger whitespace-pre-line">
                {liquidityBlockMessage}
              </p>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}
