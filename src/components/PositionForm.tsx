import { useState, useEffect, FormEvent, useRef, isValidElement } from 'react';







import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';







import { useAppStore } from '../store/useAppStore';







import { DEFAULT_CONTROL, DEFAULT_SETTINGS } from '../store/useAppStore';







import { auth, googleAuthProvider } from '../lib/firebase';







import { fetchTicker, fetchCandles, fetchMarkets } from '../services/upbitService';







import {
  loadUserSettings,
  normalizeSelectedCoin,
  normalizeWatchlist as normalizeStoredWatchlist,
  saveUserSettings,
} from '../services/userSettings';







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







    return [];







  }















  try {







    const raw = window.localStorage.getItem('asset-protection-watchlist');







    if (!raw) return [];







    const parsed = JSON.parse(raw);







    const normalized = normalizeStoredWatchlist(parsed);







    return normalized.length > 0 ? normalized : [];







  } catch {







    return [];







  }







};
















const readFallbackSelectedCoin = () => {
  if (typeof window === 'undefined') {
    return '';
  }

  try {
    const raw = window.localStorage.getItem('asset-protection-selected-coin');
    if (!raw) return '';
    return normalizeSelectedCoin(JSON.parse(raw));
  } catch {
    return '';
  }
};

const writeFallbackSettings = (watchlist: string[], selectedCoin: string) => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem('asset-protection-watchlist', JSON.stringify(watchlist));
    window.localStorage.setItem(
      'asset-protection-selected-coin',
      JSON.stringify(normalizeSelectedCoin(selectedCoin)),
    );
  } catch (error) {
    console.warn('WATCHLIST SAVE FAILED', error);
  }
};

export function PositionForm() {
  console.log("[PF_TOP_ENTER]");







  const { settings, addPosition, isCoinInCooldown, getCooldownRemaining, control, signals, clearMarketState } = useAppStore();
  return null;







  const tFromStore = useAppStore((state) => state.t);







  const t = typeof tFromStore === 'function' ? tFromStore() : ((key: string) => key);







  const safeSettings = settings ?? DEFAULT_SETTINGS;







  const safeControl = control ?? DEFAULT_CONTROL;







  const safeSignals = signals ?? {};

  const activePositions = useAppStore((state) => state.activePositions);







  







  const [currentPrice, setCurrentPrice] = useState<number | null>(null);







  const [marketAnalysis, setMarketAnalysis] = useState<MarketAnalysis | null>(null);
  console.log("[STEP_4]");







  const [liquiditySnapshot, setLiquiditySnapshot] = useState<LiquiditySnapshot>({







    avgVolume5m: 0,







    volume1m: 0,







  });







  const [formData, setFormData] = useState({







    coin: '',







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
  const [watchlistStateSource, setWatchlistStateSource] = useState<'loading' | 'remote' | 'guest' | 'fallback'>('loading');







  const [authUserInfo, setAuthUserInfo] = useState<{ uid: string; email: string | null } | null>(null);







  const [watchlist, setWatchlist] = useState<string[]>(() => {







    if (typeof window === 'undefined') {







      return [];







    }















    try {







      const raw = window.localStorage.getItem('asset-protection-watchlist');







      if (!raw) return [];







      const parsed = JSON.parse(raw);







      const normalized = normalizeStoredWatchlist(parsed);















      return normalized;







    } catch {







      return [];







    }







  });







  const [watchlistOwnerUid, setWatchlistOwnerUid] = useState<string | null>(null);







  const dropdownRef = useRef<HTMLDivElement>(null);







  const lastGlobalSentAt = useRef<number>(0);







  const market = formData.coin
    ? (formData.coin.startsWith('KRW-') ? formData.coin : `KRW-${formData.coin}`)
    : '';







  useEffect(() => {


    if (!market || watchlist.length === 0) {
      setMarketAnalysis(null);
      return;
    }

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
      setWatchlistSettingsLoaded(false);
      setWatchlistStateSource('loading');

      if (!uid) {
        setWatchlist([]);
        setFormData((prev) => ({
          ...prev,
          coin: '',
        }));
        clearMarketState();
        setWatchlistStateSource('guest');
        setWatchlistSettingsLoaded(true);
        return;
      }

      setWatchlist([]);
      setFormData((prev) => ({
        ...prev,
        coin: '',
      }));
      clearMarketState();

      void (async () => {
        try {
          const remoteSettings = await loadUserSettings(uid);
          if (!isMounted) return;

          if (remoteSettings) {
            setWatchlist(remoteSettings.watchlist);
            setFormData((prev) => ({
              ...prev,
              coin: remoteSettings.selectedCoin || '',
            }));
            setWatchlistStateSource('remote');
            setWatchlistSettingsLoaded(true);
            return;
          }

          await saveUserSettings(uid, {
            watchlist: [],
            selectedCoin: '',
          });

          if (!isMounted) return;

          setWatchlist([]);
          setFormData((prev) => ({
            ...prev,
            coin: '',
          }));
          clearMarketState();
          setWatchlistStateSource('remote');
          setWatchlistSettingsLoaded(true);
          return;
        } catch (error) {
          console.warn('USER SETTINGS LOAD FAILED', error);
        }

        if (!isMounted) return;

        setWatchlist([]);
        setFormData((prev) => ({
          ...prev,
          coin: '',
        }));
        clearMarketState();
        setWatchlistStateSource('fallback');
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

    if (watchlistStateSource === 'guest' || watchlistStateSource === 'fallback') {
      writeFallbackSettings(watchlist, formData.coin);
    }
  }, [watchlist, formData.coin, watchlistSettingsLoaded, watchlistStateSource]);

















  useEffect(() => {
    if (!watchlistSettingsLoaded) return;

    if (watchlistStateSource === 'guest' || watchlistStateSource === 'fallback') {
      writeFallbackSettings(watchlist, formData.coin);
    }

    const uid = watchlistOwnerUid ?? auth.currentUser?.uid ?? null;

    if (!uid || watchlistStateSource !== 'remote') return;

    void (async () => {
      try {
        await saveUserSettings(uid, {
          watchlist,
          selectedCoin: formData.coin,
        });
      } catch (error) {
        console.warn('USER SETTINGS SAVE FAILED', error);
      }
    })();
  }, [formData.coin, watchlistSettingsLoaded, watchlistOwnerUid, watchlistStateSource]);

  const isValidCoin = (coin: string) => marketList.includes(`KRW-${coin}`);
















  const persistWatchlistForUser = async (nextWatchlist: string[]) => {
    if (!watchlistSettingsLoaded) return;

    const uid = watchlistOwnerUid ?? auth.currentUser?.uid ?? null;

    if (!uid || watchlistStateSource !== 'remote') return;

    try {
      await saveUserSettings(uid, {
        watchlist: nextWatchlist,
        selectedCoin: formData.coin,
      });
    } catch (error) {
      console.warn('USER SETTINGS SAVE FAILED', error);
    }
  };















  const addWatchlistSymbol = async () => {







    const coin = normalizeWatchlistSymbol(watchlistInput);







    if (!coin) return;







    if (watchlist.includes(coin)) return;







    if (!isValidCoin(coin)) {







      alert("\uC874\uC7AC\uD558\uC9C0 \uC54A\uB294 \uCF54\uC778\uC785\uB2C8\uB2E4");







      return;







    }







    if (watchlist.length >= 10) {







      alert('?耀붾굝??????鶯? 10?????ル뒌??????? ??????꾨굴???????????????????곸죩');







      return;







    }















    const nextWatchlist = [...watchlist, coin];







    setWatchlist(nextWatchlist);







    setWatchlistInput('');







  };















  const removeWatchlistSymbol = async (symbol: string) => {







    const nextWatchlist = watchlist.filter((item) => item !== symbol);







    setWatchlist(nextWatchlist.length > 0 ? nextWatchlist : DEFAULT_WATCHLIST);














  };















  const resetWatchlist = async () => {







    setWatchlist(DEFAULT_WATCHLIST);







    setWatchlistInput('');















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























  const evaluateEmailSignal = async (symbol: string) => {







    const marketSymbol = `KRW-${normalizeWatchlistSymbol(symbol)}`;







    const ticker = await fetchTicker(marketSymbol);







    const price = Number(ticker?.trade_price ?? 0);















    if (!Number.isFinite(price) || price <= 0) {







      return null;







    }















    const [candles, oneMinuteCandles] = await Promise.all([







      fetchCandles(marketSymbol, MARKET_ANALYSIS_CANDLE_COUNT, 5),







      fetchCandles(marketSymbol, 2, 1),







    ]);















    if (!Array.isArray(candles) || candles.length < MARKET_ANALYSIS_CANDLE_COUNT) {







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







    const explainReason = reasons.join(' / ');
    console.log('[REACT31_DEBUG]', 'explainReason', typeof explainReason, Array.isArray(explainReason), explainReason);

    const failReasons = reasons;
    console.log("[ISO_B]", "failReasons", typeof failReasons, Array.isArray(failReasons), failReasons);
    console.log('[REACT31_DETAIL]', 'failReasons', JSON.stringify(failReasons, null, 2));
    console.log('[REACT31_DEBUG]', 'failReasons', typeof failReasons, Array.isArray(failReasons), failReasons);
    console.log("[SET_REASONS_PAYLOAD]", failReasons);

    const prepareState = getPrepareState({







      trend: trendActive,







      volume: volumeActive,







      breakout: breakoutActive,







    });
    console.log('[REACT31_DEBUG]', 'prepareState', typeof prepareState, Array.isArray(prepareState), prepareState);







    const entryState = getEntryState({







      trend: trendActive,







      volume: volumeActive,







      breakout: breakoutActive,







      fakeout,







      highRisk,







      btcTrend: btcSignal?.trend ?? 'neutral',







    });
    console.log('[REACT31_DEBUG]', 'entryState', typeof entryState, Array.isArray(entryState), entryState);
    console.log('[REACT31_DEBUG]', 'actionSignal', typeof entryState, Array.isArray(entryState), entryState);















  const entryAnalysis = {







      symbol,







      entryState,







      price,







      currentPrice: price,







      trend: trendActive,







      volume: volumeActive,







      breakout: breakoutActive,







      signalScore,







      prepareState,







    };
  console.log("[ISO_A]", "entryAnalysis", typeof entryAnalysis, Array.isArray(entryAnalysis), entryAnalysis);
  console.log('[REACT31_DEBUG]', 'entryAnalysis', typeof entryAnalysis, Array.isArray(entryAnalysis), entryAnalysis);







  };















  const authPanel = null;
  /*







    <div className="rounded border bg-white p-4">







      {authUserInfo ? (







        <>







          <div className="text-sm text-gray-500">?β돦裕?????⑤객臾?/div>







          <div className="text-sm font-semibold">{authUserInfo.email ?? '?β돦裕??????筌????怨몃쾳'}</div>







          <div className="mt-1 text-xs text-gray-500">UID: {authUserInfo.uid.slice(0, 8)}...</div>







          <button







            type="button"







            onClick={handleLogout}







            className="mt-3 border rounded px-3 py-2 text-sm font-semibold"







          >







            ????癲??????獄쏅챶留??






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







            Google 濡쒓렇??






          </button>







        </>







      )}







    </div>







  );

  */




















  useEffect(() => {


    if (!market) {
      setMarketAnalysis(null);
      return;
    }

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







    







    if (!market || watchlist.length === 0) return;

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







  }, [market, watchlist]);















  useEffect(() => {







    const getCooldownRemainingAction = useAppStore.getState().getCooldownRemaining;







    const checkCooldown = () => {







      const nextCooldownTime = formData.coin ? getCooldownRemainingAction(formData.coin) : 0;







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
  console.log("[ISO_A]", "filteredCoins", typeof filteredCoins, Array.isArray(filteredCoins), filteredCoins);







  const isCustomCoin = coinInput.length >= 2 && !COIN_OPTIONS.includes(`KRW-${coinInput.toUpperCase()}`);







  const customMarket = `KRW-${coinInput.toUpperCase()}`;







  // [CHANGED] Normalize the current selection so the UI always reads the same Zustand key.







  const selectedCoin = formData.coin
    ? (formData.coin.startsWith('KRW-') ? formData.coin : `KRW-${formData.coin}`)
    : '';
  console.log("[STEP_1]");







  // [CHANGED] Bind the UI to the live store signal, with a minimal fallback only for first render.







  const safeSignal = selectedCoin ? safeSignals?.[selectedCoin] ?? null : null;
  console.log("[STEP_2]");
  console.log('[REACT31_DEBUG]', 'safeSignal', typeof safeSignal, Array.isArray(safeSignal), safeSignal);
  console.log('[REACT31_DEBUG]', 'currentSignal', typeof safeSignal, Array.isArray(safeSignal), safeSignal);
  console.log('[REACT31_DEBUG]', 'signals[selectedCoin]', typeof (selectedCoin ? safeSignals?.[selectedCoin] ?? null : null), Array.isArray(selectedCoin ? safeSignals?.[selectedCoin] ?? null : null), selectedCoin ? safeSignals?.[selectedCoin] ?? null : null);
  console.log('[REACT31_DEBUG]', 'marketAnalysis', typeof marketAnalysis, Array.isArray(marketAnalysis), marketAnalysis);
  console.log("[STEP_3]");
  console.log("[STEP_3]");







  const btcSignal = safeSignals?.['KRW-BTC'] ?? null;

  const estimatedQuantity = formData.buyPrice > 0 ? formData.amount / formData.buyPrice : 0;

  const hasReferenceData = Boolean(selectedCoin) && watchlist.length > 0 && Object.keys(safeSignals).length > 0 && activePositions.length > 0;

  const avgVolume5m = liquiditySnapshot.avgVolume5m;
  const volume1m = liquiditySnapshot.volume1m;
  const positionVolumeRatio5m = avgVolume5m > 0 ? estimatedQuantity / avgVolume5m : Number.POSITIVE_INFINITY;
  const positionVolumeRatio1m = volume1m > 0 ? estimatedQuantity / volume1m : Number.POSITIVE_INFINITY;
  const liquidityRisk = positionVolumeRatio5m > 0.5 || positionVolumeRatio1m > 1.0 ? 'NO_ENTRY' : 'OK';

  useEffect(() => {
    if (!watchlistSettingsLoaded) return;
    if (watchlistStateSource === 'loading') return;

    const hasSignalData = Object.keys(safeSignals).length > 0;
    if (watchlist.length === 0 || !selectedCoin || !hasSignalData) {
      clearMarketState();
    }
  }, [
    safeSignals,
    selectedCoin,
    watchlist.length,
    watchlistSettingsLoaded,
    watchlistStateSource,
    clearMarketState,
  ]);















  const handleSelectCoin = (coin: string) => {







    setFormData({ ...formData, coin });







    setCoinInput('');







    setIsDropdownOpen(false);







  };















  const handleFetchPrice = async () => {







    const market = formData.coin
      ? (formData.coin.startsWith('KRW-') ? formData.coin : `KRW-${formData.coin}`)
      : '';















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




























  const liquidityBlockMessage =
    '?????????????????밸쫫??? ?耀붾굝梨루땟???????關?쒎첎?嫄????????堉온?????⑥ル??????븐뼐????????????곸죩.\n?????獄쏅챶留??????⑥ル????????????耀붾굝?????????????곕츥??????轅붽틓??影?놁쟼???';
  console.log('[REACT31_DETAIL]', 'liquidityRiskMessage', JSON.stringify(liquidityBlockMessage, null, 2));
  console.log("[ISO_B]", "liquidityBlockMessage", typeof liquidityBlockMessage, Array.isArray(liquidityBlockMessage), liquidityBlockMessage);
  console.log('[REACT31_DEBUG]', 'liquidityRiskMessage', typeof liquidityBlockMessage, Array.isArray(liquidityBlockMessage), liquidityBlockMessage);

const blockEntry = (message: string) => {







    window.alert(message);







  };















  const handleSubmit = (e: FormEvent) => {







    e.preventDefault();







    if (formData.buyPrice <= 0 || formData.amount <= 0 || safeControl.isInputDisabled || cooldownTime > 0) return;















    // ENTRY PRE-CHECK: liquidity exit risk







    const avgVolume5m = liquiditySnapshot.avgVolume5m;







    const volume1m = liquiditySnapshot.volume1m;







    const positionVolumeRatio5m = avgVolume5m > 0 ? estimatedQuantity / avgVolume5m : Number.POSITIVE_INFINITY;







    const positionVolumeRatio1m = volume1m > 0 ? estimatedQuantity / volume1m : Number.POSITIVE_INFINITY;







    const liquidityRisk =







      positionVolumeRatio5m > 0.5 || positionVolumeRatio1m > 1.0 ? 'NO_ENTRY' : 'OK';















    if (liquidityRisk === 'NO_ENTRY') {







      return blockEntry(

        '?????????????????밸쫫??? ?耀붾굝梨루땟???????關?쒎첎?嫄????????堉온?????⑥ル??????븐뼐????????????곸죩.\n?????獄쏅챶留??????⑥ル????????????耀붾굝?????????????곕츥??????轅붽틓??影?놁쟼???',

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















  const signalTrendUp = safeSignal?.trend === 'up';







    const signalVolumeSpike = safeSignal?.volume === 'spike';







    const signalBreakout = safeSignal?.breakout === 'bullish_breakout';















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







    const signalScore = score;















    const scoreLabel = score >= 75 ? 'High' : (score >= 60 ? 'Medium' : 'Low');







    const scoreColor = score >= 75 ? 'text-green-500' : (score >= 60 ? 'text-blue-500' : 'text-gray-500');







    const entryState = getEntryState({







      trend: trendActive,







      volume: volumeActive,







      breakout: breakoutActive,







      fakeout,







      highRisk,







      btcTrend: btcSignal?.trend ?? 'neutral',







    });
    console.log('[REACT31_DEBUG]', 'entryState', typeof entryState, Array.isArray(entryState), entryState);
    console.log('[REACT31_DEBUG]', 'actionSignal', typeof entryState, Array.isArray(entryState), entryState);















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
              : ['????????????????', '?????????????'];
    console.log('[REACT31_DETAIL]', 'reasons', JSON.stringify(reasons, null, 2));
    console.log("[ISO_A]", "reasons", typeof reasons, Array.isArray(reasons), reasons);
    console.log("[REASONS_RUNTIME]", reasons);
    console.log("[REASONS_TYPE]", typeof reasons, Array.isArray(reasons), reasons?.[0]);

    const prepareState = getPrepareState({







      trend: trendActive,







      volume: volumeActive,







      breakout: breakoutActive,







    });
    console.log('[REACT31_DEBUG]', 'prepareState', typeof prepareState, Array.isArray(prepareState), prepareState);















    return {







      market,







      symbol: market.replace('KRW-', ''),







      price: Number(currentPrice ?? 0),







      currentPrice: Number(currentPrice ?? 0),







      entryState,







      trendReady: trendActive,







      volumeReady: volumeActive,







      breakoutReady: breakoutActive,







      explainReason: reasons.join(' / '),







      failReasons: reasons,







      trend: trendActive,







      volume: volumeActive,







      breakout: breakoutActive,







      signalScore,







      scoreColor,







      prepareState,







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







  }, [btcSignal?.trend, watchlist]);



















  if (isInputBlocked) {



    return (



      <div className="space-y-6">



        {isValidElement(authPanel) ? authPanel : null}



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







  const renderDebugValue = (name: string, value: unknown) => {
    const isObjectLike = typeof value === 'object' && value !== null;
    console.log('[RENDER_DEBUG]', name, {
      typeof: typeof value,
      isArray: Array.isArray(value),
      isValidElement: isValidElement(value as React.ReactElement),
      keys: isObjectLike ? Object.keys(value as Record<string, unknown>).length : 0,
      preview: value,
    });
  };

  renderDebugValue('selectedCoin', selectedCoin);
  renderDebugValue('safeSignal', safeSignal);
  renderDebugValue('currentSignal', safeSignal);
  renderDebugValue('marketAnalysis', marketAnalysis);
  renderDebugValue('prepareState', prepareState);
  renderDebugValue('reasons', reasons);
  renderDebugValue('failReasons', failReasons);
  renderDebugValue('liquidityRiskMessage', liquidityBlockMessage);
  renderDebugValue('entryState', entryState);
  renderDebugValue('authPanel', authPanel);
  const failReasonsText = Array.isArray(failReasons)
    ? failReasons
        .map((reason) =>
          typeof reason === 'object' && reason !== null ? JSON.stringify(reason) : String(reason)
        )
        .join(' / ')
    : String(failReasons ?? '');
  console.log("[CHK] reasons", reasons);
  console.log("[CHK] failReasons", failReasons);
  console.log("[CHK] liquidityRiskMessage", liquidityBlockMessage);
  console.log("[CHK] entryState", entryState);
  console.log("[CHK] authPanel", authPanel);
  console.log("[PF_BEFORE_RETURN]");

  return null;

  return (



    <div className="space-y-6">
      {false && (isValidElement(authPanel) ? authPanel : null)}







      <form onSubmit={handleSubmit} className="space-y-6">



        <div className="space-y-6">



          {false && (
          <div className="p-4 border rounded">
            <div className="text-sm text-gray-500">醫낅ぉ ?좏깮</div>
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={coinInput}
                onChange={(e) => setCoinInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const nextCoin = coinInput.trim().toUpperCase();
                    if (!nextCoin) return;
                    if (COIN_OPTIONS.includes(`KRW-${nextCoin}`)) {
                      handleSelectCoin(`KRW-${nextCoin}`);
                      return;
                    }
                    if (isCustomCoin) {
                      handleSelectCoin(customMarket);
                    }
                  }
                }}
                placeholder="?? BTC, ETH, SOL"
                className="flex-1 border rounded px-3 py-2 text-sm"
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {filteredCoins.slice(0, 6).map((coin) => {
                console.log('[MAP_ITEM]', coin);
                return (
                  <button
                    key={coin}
                    type="button"
                    onClick={() => handleSelectCoin(coin)}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                      selectedCoin === coin ? 'border-green-500 text-green-600 bg-green-50' : 'border-gray-300 text-gray-600'
                    }`}
                  >
                    {coin.replace('KRW-', '')}
                  </button>
                );
              })}
              {isCustomCoin && (
                <button
                  type="button"
                  onClick={() => handleSelectCoin(customMarket)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                    selectedCoin === customMarket ? 'border-green-500 text-green-600 bg-green-50' : 'border-gray-300 text-gray-600'
                  }`}
                >
                  {customMarket.replace('KRW-', '')}
                </button>
              )}
            </div>
            <div className="mt-2 text-xs text-gray-500">
              ?????獄쏅챶留??????壤굿??Β?? {selectedCoin.replace('KRW-', '')}
            </div>
          </div>
          )}

          {false && (
          <div className="p-4 border rounded">



            <div className="text-sm text-gray-500">Watchlist</div>



            <div className="flex flex-wrap gap-2 mt-2">



              {watchlist.map((symbol) => (



                <span key={symbol} className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm">



                  <span>{String(symbol)}</span>



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



                ??????꾨굴??



              </button>



              <button type="button" onClick={resetWatchlist} className="border rounded px-3 py-2 text-sm font-semibold">



                ??????硫멸킐???


              </button>



            </div>



          </div>
          )}







          {false && (
          <div className="p-4 border rounded">
            <div className="text-sm text-gray-500">?꾩옱 ?곹깭</div>
            <div className="text-sm font-semibold">{String(Array.isArray(watchlist) ? watchlist.map((symbol) => {
              console.log('[MAP_ITEM]', symbol);
              return String(symbol);
            }).join(' / ') : '')}</div>
          </div>
          )}







          {false && (
          <div className="p-4 border rounded">



            <div className="text-sm text-gray-500">吏꾩엯 ?④퀎</div>



            <div
              className={`text-xl font-bold ${
                entryState === 'ENTRY'
                  ? 'text-green-500'
                  : entryState === 'RISK'
                    ? 'text-orange-500'
                    : entryState === 'AVOID'
                      ? 'text-red-500'
                      : 'text-gray-500'
              }`}
            >
              {String(entryState)}
            </div>



          </div>
          )}







          {/* TEMP_ISOLATE_ASIDE_BOTTOM_START
          <div className="p-4 border rounded mt-4">
            <div className="text-xs text-gray-400 mb-1">?轅붽틓????????????????살깙嶺?/div>
            <div className="text-sm text-gray-500">?轅붽틓???????β뼯援?????덉땃?/div>
            <div className="text-sm">???? ????거??? {String(explainReason)}</div>
            <div className="text-sm">???濚밸Ŧ援???????산뭐鶯? {String(explainReason)}</div>
            <div className="text-sm">???숆강???녿펾筌?? {String(explainReason)}</div>
            <div className="text-sm">?????살깙嶺? {String(explainReason)}</div>
          </div>
          )}







          {false && (
          <div className="p-4 border rounded mt-4">



            <div className="text-sm text-gray-500">???????????嶺?/div>



            <div className={trendReady ? 'text-green-500' : 'text-red-500'}>Trend: {trendReady ? 'OK' : 'NO'}</div>



            <div className={volumeReady ? 'text-green-500' : 'text-red-500'}>Volume: {volumeReady ? 'OK' : 'NO'}</div>



            <div className={breakoutReady ? 'text-green-500' : 'text-red-500'}>Breakout: {breakoutReady ? 'OK' : 'NO'}</div>



          </div>
          )}







          {false && (
          <div className="p-4 border rounded mt-4">



            <div className="text-sm text-gray-500">?轅붽틓???????鶯ㅺ동??????/div>



            <div className="text-lg font-semibold">{String(prepareState)}</div>



          </div>

          )}






          {false && (
          <div className="p-4 border rounded mt-4">



            <div className="text-sm text-gray-500">?????援경퓴??????/div>



            <div className={`text-lg font-semibold ${scoreColor}`}>



              {String(signalScore)} / 100



            </div>



          </div>

          )}






          {false && (
          <div className="p-4 border rounded mt-4">



            <div className="text-sm text-gray-500">ENTRY ?轅붽틓??????⒟?/div>



            <div className={trendReady ? 'text-green-500' : 'text-red-500'}>



              Trend: {trendReady ? 'OK' : 'NO'}



            </div>



            <div className={volumeReady ? 'text-green-500' : 'text-red-500'}>



              Volume: {volumeReady ? 'OK' : 'NO'}



            </div>



            <div className={breakoutReady ? 'text-green-500' : 'text-red-500'}>



              Breakout: {breakoutReady ? 'OK' : 'NO'}



            </div>



            <div className={signalScore >= 80 ? 'text-green-500' : 'text-red-500'}>



              Score: {signalScore >= 80 ? 'OK' : 'NO'}



            </div>



            <div className={prepareState === 'ENTRY' ? 'text-green-500' : 'text-red-500'}>



              Stage: {prepareState === 'ENTRY' ? 'OK' : 'NO'}



            </div>



            <div className={btcSignal?.trend === 'up' ? 'text-green-500' : 'text-red-500'}>



              BTC: {btcSignal?.trend === 'up' ? 'OK' : 'NO'}



            </div>



          </div>
          )}







          {false && (
          <div className="p-4 border rounded mt-4">
            <div className="text-sm text-gray-500">ENTRY ?????怨뚯댅 ????</div>

            {entryState === 'ENTRY' ? (
               <div className="text-green-500">?轅붽틓????????ル봿????/div>
            ) : (
              <div className="text-sm">
                {failReasonsText}
              </div>
            )}
          </div>
          )}







          {false && (
          <div className={`mt-3 p-4 border rounded-lg ${liquidityRisk === 'NO_ENTRY' ? 'bg-status-danger/5 border-status-danger/20' : 'bg-gray-50 border-text-main/10'}`}>



            <div className="text-sm font-semibold text-gray-700 mb-2">?轅붽틓???곌램鍮????????????/div>



            <div className="grid grid-cols-2 gap-3 text-xs text-gray-700">



              <div className="space-y-1">



                <div className="text-text-muted/60">Estimated Quantity</div>



                <div className="font-semibold">{hasReferenceData ? String(formatMetric(estimatedQuantity, 6)) : ''}</div>



              </div>



              <div className="space-y-1">



                <div className="text-text-muted/60">5m Average Volume</div>



                <div className="font-semibold">{hasReferenceData ? String(formatMetric(avgVolume5m, 6)) : ''}</div>



              </div>



              <div className="space-y-1">



                <div className="text-text-muted/60">1m Volume</div>



                <div className="font-semibold">{hasReferenceData ? String(formatMetric(volume1m, 6)) : ''}</div>



              </div>



              <div className="space-y-1">



                <div className="text-text-muted/60">Final Verdict</div>



                <div className={`font-semibold ${hasReferenceData ? (liquidityRisk === 'NO_ENTRY' ? 'text-status-danger' : 'text-status-safe') : 'text-text-muted/60'}`}>



                  {hasReferenceData ? String(liquidityRisk === 'NO_ENTRY' ? 'Entry blocked' : 'Entry allowed') : ''}



                </div>



              </div>



              <div className="space-y-1">



                <div className="text-text-muted/60">5m Ratio</div>



                <div className="font-semibold">{hasReferenceData ? String(formatMetric(positionVolumeRatio5m, 4)) : ''}</div>



              </div>



              <div className="space-y-1">



                <div className="text-text-muted/60">1m Ratio</div>



                <div className="font-semibold">{hasReferenceData ? String(formatMetric(positionVolumeRatio1m, 4)) : ''}</div>



              </div>



            </div>



            {hasReferenceData && liquidityRisk === 'NO_ENTRY' && (



              <p className="mt-3 text-xs leading-relaxed text-status-danger whitespace-pre-line">



                {String(liquidityBlockMessage)}

          )}


              </p>



            )}



          </div>
          )}
          TEMP_ISOLATE_ASIDE_BOTTOM_END */}



        </div>



      </form>



    </div>



  );



}
