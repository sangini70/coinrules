import { useState, useEffect, FormEvent, useRef } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { useAppStore } from '../store/useAppStore';
import { DEFAULT_CONTROL, DEFAULT_SETTINGS, DEFAULT_SIGNAL } from '../store/useAppStore';
import { auth, googleAuthProvider } from '../lib/firebase';
import { fetchTicker, fetchCandles, fetchMarkets } from '../services/upbitService';
import { loadUserWatchlist, normalizeWatchlist as normalizeStoredWatchlist, saveUserWatchlist } from '../services/userSettings';
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
const DEFAULT_MARKET_LIST = DEFAULT_WATCHLIST.map((symbol) => `KRW-${symbol}`);
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

const readFallbackWatchlist = () => {
  if (typeof window === 'undefined') {
    return DEFAULT_WATCHLIST;
  }

  try {
    const raw = window.localStorage.getItem('asset-protection-watchlist');
    if (!raw) return DEFAULT_WATCHLIST;
    const parsed = JSON.parse(raw);
    const normalized = normalizeStoredWatchlist(parsed);
    return normalized.length > 0 ? normalized : DEFAULT_WATCHLIST;
  } catch {
    return DEFAULT_WATCHLIST;
  }
};

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
  const [marketList, setMarketList] = useState<string[]>(DEFAULT_MARKET_LIST);
  const [watchlistSettingsLoaded, setWatchlistSettingsLoaded] = useState(false);
  const [authUserInfo, setAuthUserInfo] = useState<{ uid: string; email: string | null } | null>(null);
  const [watchlist, setWatchlist] = useState<string[]>(() => {
    if (typeof window === 'undefined') {
      return DEFAULT_WATCHLIST;
    }

    try {
      const raw = window.localStorage.getItem('asset-protection-watchlist');
      if (!raw) return DEFAULT_WATCHLIST;
      const parsed = JSON.parse(raw);
      const normalized = normalizeStoredWatchlist(parsed);

      return normalized.length > 0 ? normalized : DEFAULT_WATCHLIST;
    } catch {
      return DEFAULT_WATCHLIST;
    }
  });
  const [watchlistOwnerUid, setWatchlistOwnerUid] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const lastGlobalSentAt = useRef<number>(0);
  const market = (formData.coin || 'KRW-BTC').startsWith('KRW-') ? formData.coin : `KRW-${formData.coin || 'BTC'}`;
  useEffect(() => {
    let active = true;

    const loadMarkets = async () => {
      try {
        const krwMarkets = await fetchMarkets();
        if (!active) return;
        setMarketList(krwMarkets.length > 0 ? krwMarkets : DEFAULT_MARKET_LIST);
      } catch (e) {
        if (!active) return;
        console.error('MARKET LOAD FAILED', e);
        setMarketList(DEFAULT_MARKET_LIST);
      }
    };

    void loadMarkets();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!isMounted) return;

      const uid = user?.uid ?? null;
      setAuthUserInfo(user ? { uid: user.uid, email: user.email } : null);
      setWatchlistOwnerUid(uid);

      if (!uid) {
        setWatchlist(readFallbackWatchlist());
        setWatchlistSettingsLoaded(true);
        return;
      }

      void (async () => {
        try {
          const remoteWatchlist = await loadUserWatchlist(uid);
          if (!isMounted) return;

          if (Array.isArray(remoteWatchlist) && remoteWatchlist.length > 0) {
            setWatchlist(remoteWatchlist);
            setWatchlistSettingsLoaded(true);
            return;
          }
        } catch (error) {
          console.warn('USER SETTINGS LOAD FAILED', error);
        }

        if (!isMounted) return;
        setWatchlist(readFallbackWatchlist());
        setWatchlistSettingsLoaded(true);
      })();
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!watchlistSettingsLoaded) return;

    try {
      window.localStorage.setItem('asset-protection-watchlist', JSON.stringify(watchlist));
    } catch (error) {
      console.warn('WATCHLIST SAVE FAILED', error);
    }
  }, [watchlist, watchlistSettingsLoaded]);

  const isValidCoin = (coin: string) => marketList.includes(`KRW-${coin}`);

  const persistWatchlistForUser = async (nextWatchlist: string[]) => {
    if (!watchlistSettingsLoaded) return;

    const uid = watchlistOwnerUid ?? auth.currentUser?.uid ?? null;
    if (!uid) return;

    try {
      await saveUserWatchlist(uid, nextWatchlist);
    } catch (error) {
      console.warn('USER SETTINGS SAVE FAILED', error);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleAuthProvider);
    } catch (error) {
      console.error('GOOGLE LOGIN FAILED', error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('LOGOUT FAILED', error);
    }
  };


  const authPanel = (
    <div className="rounded border bg-white p-4">
      {authUserInfo ? (
        <>
          <div className="text-sm text-gray-500">로그인 완료</div>
          <div className="text-sm font-semibold">{authUserInfo.email ?? '이메일 없음'}</div>
          <div className="mt-1 text-xs text-gray-500">UID: {authUserInfo.uid.slice(0, 8)}...</div>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-3 border rounded px-3 py-2 text-sm font-semibold"
          >
            로그아웃
          </button>
        </>
      ) : (
        <>
          <div className="text-sm text-gray-500">로그인 필요</div>
          <button
            type="button"
            onClick={handleGoogleLogin}
            className="mt-3 border rounded px-3 py-2 text-sm font-semibold"
          >
            Google 로그인
          </button>
        </>
      )}
    </div>
  );

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
    '????????거????????????????????대첉????????椰??????????????????????????????????⑤벡?????? ????????????????????거??????????\n????????????????癲ル슢?싩땟??????????븐뼐??????????????낄?????????????????椰??????????????怨쀫엥????????????椰??????????????????????????????留⑶뜮???????????????????????곕섯????????????????????썹땟戮녹??諭?????⑸㎦?????????????????耀붾굝??????????????????????????? ??????椰????????????????椰???????????⑤벡瑜??????????????嶺뚮씮?????????????거??????????';

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
        '???????됰Ŧ???????????????????살몖????????嫄??????雍??????????????????????????怨뺤떪????? ???????????????????됰Ŧ??????????\n????????????????嶺뚮씚維????????遺얘턁???????????뚮쳥????????????????嫄??????????????곗뿨????????????嫄?????????????????????????????뀀맩鍮??????????????????????됰뼸??????????????????ш끽維뽳쭩?뱀땡???얩맪?????????????????饔낅떽?????????????????????????? ??????嫄????????????????嫄??????????怨뺤른??????????????筌띿솘???????????됰Ŧ??????????',
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

    const scoreLabel = score >= 75 ? 'High' : (score >= 60 ? 'Medium' : 'Low');
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
      AVOID: 'Avoid',
      RISK: 'Risk',
      ENTRY: 'Entry',
      OBSERVE: 'Observe',
      WAIT: 'Wait',
    };

    const reasons =
      entryState === 'AVOID'
        ? ['Low confidence', 'Avoid new entries']
        : entryState === 'RISK'
          ? ['Risk elevated', 'Wait for clearer setup']
          : entryState === 'ENTRY'
            ? ['Trend confirmed', 'Volume confirmed', 'Breakout confirmed']
            : entryState === 'OBSERVE'
              ? ['Trend developing', 'Monitor for follow-through']
              : ['No entry signal', 'Hold and wait'];

    const prepareState = getPrepareState({
      trend: trendActive,
      volume: volumeActive,
      breakout: breakoutActive,
    });

    return {
      market,
      symbol: market.replace('KRW-', ''),
      price: Number(currentPrice ?? 0),
      currentPrice: Number(currentPrice ?? 0),
      entryState,
      trend: trendActive,
      volume: volumeActive,
      breakout: breakoutActive,
      signalScore,
      prepareState,
    };
  })();

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
      <div className="space-y-6">
        {authPanel}
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
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded border bg-white p-4">
        {authUserInfo ? (
          <>
            <div className="text-sm text-gray-500">濡쒓렇???곹깭</div>
            <div className="text-sm font-semibold">{authUserInfo.email ?? '?대찓???놁쓬'}</div>
            <div className="mt-1 text-xs text-gray-500">UID: {authUserInfo.uid.slice(0, 8)}...</div>
            <button
              type="button"
              onClick={handleLogout}
              className="mt-3 border rounded px-3 py-2 text-sm font-semibold"
            >
              濡쒓렇?꾩썐
            </button>
          </>
        ) : (
          <>
            <div className="text-sm text-gray-500">濡쒓렇???꾩슂</div>
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="mt-3 border rounded px-3 py-2 text-sm font-semibold"
            >
              Google 濡쒓렇??            </button>
          </>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <div className="p-4 border rounded">
            {authUserInfo ? (
              <>
                <div className="text-sm text-gray-500">嚥≪뮄????怨밴묶</div>
                <div className="text-sm font-semibold">{authUserInfo.email ?? '??李????곸벉'}</div>
                <div className="text-xs text-gray-500 mt-1">UID: {authUserInfo.uid.slice(0, 8)}...</div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="mt-3 border rounded px-3 py-2 text-sm font-semibold"
                >
                  嚥≪뮄??袁⑹뜍
                </button>
              </>
            ) : (
              <>
                <div className="text-sm text-gray-500">嚥≪뮄????袁⑹뒄</div>
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  className="mt-3 border rounded px-3 py-2 text-sm font-semibold"
                >
                  Google 嚥≪뮄???                </button>
              </>
            )}
          </div>

          <div className="p-4 border rounded">
            <div className="text-sm text-gray-500">Watchlist</div>
            <div className="flex flex-wrap gap-2 mt-2">
              {watchlist.map((symbol) => (
                <span key={symbol} className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm">
                  <span>{symbol}</span>
                  <button
                    type="button"
                    onClick={() => removeWatchlistSymbol(symbol)}
                    className="text-gray-500 hover:text-red-500"
                    aria-label={`${symbol} delete`}
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
                placeholder="?? SHIB, DOT, AVAX"
                className="flex-1 border rounded px-3 py-2 text-sm"
              />
              <button type="button" onClick={addWatchlistSymbol} className="border rounded px-3 py-2 text-sm font-semibold">
                Add
              </button>
              <button type="button" onClick={resetWatchlist} className="border rounded px-3 py-2 text-sm font-semibold">
                Reset
              </button>
            </div>
          </div>

          <div className="p-4 border rounded">
            <div className="text-sm text-gray-500">Watchlist Summary</div>
            <div className="text-sm font-semibold">{watchlist.join(' / ')}</div>
          </div>

          <div className="p-4 border rounded">
            <div className="text-sm text-gray-500">Current State</div>
            <div className="text-xl font-bold">{entryState}</div>
          </div>

          <div className="p-4 border rounded mt-4">
            <div className="text-xs text-gray-400 mb-1">{"??ル맪??嶺뚯쉳????リ옇?? (嶺뚮씞??????堉?"}</div>
            <div className="text-sm text-gray-500">{"嶺뚯솘?????⑤?????怨댄맍"}</div>
            <div className="text-sm">{"嶺뚯솘????롪퍒?▽빳? "}{explain.summary}</div>
            <div className="text-sm">{"??怨? ??븐슜?? "}{explainReason}</div>
            <div className="text-sm">{"???깅쾳 ??怨뺤쭢: "}{explain.action}</div>
            <div className="text-sm">{"?洹먮봾裕?? "}{explain.risk}</div>
          </div>

          <div className="p-4 border rounded mt-4">
            <div className="text-sm text-gray-500">Judgement</div>
            <div>Trend: {trendReady ? 'OK' : 'NO'}</div>
            <div>Volume: {volumeReady ? 'OK' : 'NO'}</div>
            <div>Breakout: {breakoutReady ? 'OK' : 'NO'}</div>
          </div>

          <div className="p-4 border rounded mt-4">
            <div className="text-sm text-gray-500">Prepare State</div>
            <div className="text-lg font-semibold">{prepareState}</div>
          </div>

          <div className="p-4 border rounded mt-4">
            <div className="text-sm text-gray-500">Signal Score</div>
            <div className={`text-lg font-semibold ${scoreColor}`}>
              {signalScore} / 100
            </div>
          </div>

          <div className="p-4 border rounded mt-4">
            <div className="text-sm text-gray-500">ENTRY Check</div>
            <div className={getColor(trendReady)}>
              Trend: {trendReady ? 'OK' : 'NO'}
            </div>
            <div className={getColor(volumeReady)}>
              Volume: {volumeReady ? 'OK' : 'NO'}
            </div>
            <div className={getColor(breakoutReady)}>
              Breakout: {breakoutReady ? 'OK' : 'NO'}
            </div>
            <div className={getColor(signalScore >= 80)}>
              Score: {signalScore >= 80 ? 'OK' : 'NO'}
            </div>
            <div className={getColor(prepareState === 'ENTRY')}>
              Stage: {prepareState === 'ENTRY' ? 'OK' : 'NO'}
            </div>
            <div className={getColor(btcSignal.trend === 'up')}>
              BTC: {btcSignal.trend === 'up' ? 'OK' : 'NO'}
            </div>
          </div>

          <div className="p-4 border rounded mt-4">
            <div className="text-sm text-gray-500">ENTRY Fail Reasons</div>
            {entryState === 'ENTRY' ? (
              <div className="text-green-500">Entry ready</div>
            ) : (
              <ul className="text-sm list-disc pl-4">
                {failReasons.slice(0, 2).map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            )}
          </div>

          <div className={`mt-3 p-4 border rounded-lg ${liquidityRisk === 'NO_ENTRY' ? 'bg-status-danger/5 border-status-danger/20' : 'bg-gray-50 border-text-main/10'}`}>
            <div className="text-sm font-semibold text-gray-700 mb-2">Reference Data</div>
            <div className="grid grid-cols-2 gap-3 text-xs text-gray-700">
              <div className="space-y-1">
                <div className="text-text-muted/60">Estimated Quantity</div>
                <div className="font-semibold">{formatMetric(estimatedQuantity, 6)}</div>
              </div>
              <div className="space-y-1">
                <div className="text-text-muted/60">5m Average Volume</div>
                <div className="font-semibold">{formatMetric(avgVolume5m, 6)}</div>
              </div>
              <div className="space-y-1">
                <div className="text-text-muted/60">1m Volume</div>
                <div className="font-semibold">{formatMetric(volume1m, 6)}</div>
              </div>
              <div className="space-y-1">
                <div className="text-text-muted/60">Final Verdict</div>
                <div className={`font-semibold ${liquidityRisk === 'NO_ENTRY' ? 'text-status-danger' : 'text-status-safe'}`}>
                  {liquidityRisk === 'NO_ENTRY' ? 'Entry blocked' : 'Entry allowed'}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-text-muted/60">5m Ratio</div>
                <div className="font-semibold">{formatMetric(positionVolumeRatio5m, 4)}</div>
              </div>
              <div className="space-y-1">
                <div className="text-text-muted/60">1m Ratio</div>
                <div className="font-semibold">{formatMetric(positionVolumeRatio1m, 4)}</div>
              </div>
            </div>
            {liquidityRisk === 'NO_ENTRY' && (
              <p className="mt-3 text-xs leading-relaxed text-status-danger whitespace-pre-line">
                {liquidityBlockMessage}
              </p>
            )}
          </div>        </div>
      </div>
      </form>
    </div>
  );
}
