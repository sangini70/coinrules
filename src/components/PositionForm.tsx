import { useState, useEffect, useMemo, FormEvent, useRef, isValidElement } from 'react';







import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';







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
  const [test] = useState('OK');
  const ref = useRef(null);
  const memoTest = useMemo(() => 'MEMO_OK', []);
  useEffect(() => {
    return;
    setMarketAnalysisAction(null);
  }, []);
  useEffect(() => {
    fetchSignalsAction();
  }, []);
  useEffect(() => {
    console.log("POLLING_EFFECT_ENTER");

    console.log("POLLING_INTERVAL_CREATE");
    const interval = null;

    return () => {
      console.log("POLLING_EFFECT_CLEANUP");
      if (interval) {
        window.clearInterval(interval);
      }
    };
  }, []);
  const storeMarketList = [];
  const storeSignals = null;
  const setMarketAnalysisAction = () => {};
  const fetchSignalsAction = () => {};
  void test;
  void ref;
  void memoTest;
  void storeMarketList;
  void storeSignals;
  void setMarketAnalysisAction;
  void fetchSignalsAction;
  return (
    <div className="space-y-6">
      <div className="p-8 border border-status-danger/50 bg-status-danger/5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-700">
        {false && null}
      </div>
    </div>
  );

  // console.log("[PF_TOP_ENTER]");







  const settings = null;
  const signals = null;
  const control = null;
  const clearMarketState = () => {};
  const addPosition = () => {};
  const isCoinInCooldown = () => false;
  const getCooldownRemaining = () => 0;
  const tFromStore = null;







  const t = typeof tFromStore === 'function' ? tFromStore() : ((key: string) => key);







  const safeSettings = settings ?? {};







  const safeControl = control ?? {};







  const safeSignals = {} as Record<string, { trend?: string; volume?: string; breakout?: string; state?: string }>;

  const activePositions = [];







  







  const [currentPrice, setCurrentPrice] = useState<number | null>(null);







  const [marketAnalysis, setMarketAnalysis] = useState<MarketAnalysis | null>({});
  // console.log("[STEP_4]");







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
            const nextWatchlist = Array.isArray(remoteSettings.watchlist) ? remoteSettings.watchlist : [];
            setWatchlist(nextWatchlist);
            setFormData((prev) => ({
              ...prev,
              coin:
                remoteSettings.selectedCoin ||
                nextWatchlist[0] ||
                filteredCoins[0] ||
                '',
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







    const explainReason = reasons
      .map((reason) =>
        typeof reason === 'object' && reason !== null
          ? String((reason as Record<string, unknown>).label ?? (reason as Record<string, unknown>).text ?? (reason as Record<string, unknown>).message ?? JSON.stringify(reason))
          : String(reason)
      )
      .join(' / ');
    // console.log('[REACT31_DEBUG]', 'explainReason', typeof explainReason, Array.isArray(explainReason), explainReason);

    const failReasons = reasons;
    // console.log("[ISO_B]", "failReasons", typeof failReasons, Array.isArray(failReasons), failReasons);
    // console.log('[REACT31_DETAIL]', 'failReasons', JSON.stringify(failReasons, null, 2));
    // console.log('[REACT31_DEBUG]', 'failReasons', typeof failReasons, Array.isArray(failReasons), failReasons);
    // console.log("[SET_REASONS_PAYLOAD]", failReasons);

    const prepareState = null;
    // console.log('[REACT31_DEBUG]', 'prepareState', typeof prepareState, Array.isArray(prepareState), prepareState);







    const entryState = getEntryState({
      trend: trendActive,
      volume: volumeActive,
      breakout: breakoutActive,
      fakeout,
      highRisk,
      btcTrend: btcSignal?.trend === 'up' ? 'up' : 'neutral',
    });
    // console.log('[REACT31_DEBUG]', 'entryState', typeof entryState, Array.isArray(entryState), entryState);
    // console.log('[REACT31_DEBUG]', 'actionSignal', typeof entryState, Array.isArray(entryState), entryState);















  const entryAnalysis = null;
  return null;
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







    







    if (!market) return;

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
  // console.log("[ISO_A]", "filteredCoins", typeof filteredCoins, Array.isArray(filteredCoins), filteredCoins);







  const isCustomCoin = coinInput.length >= 2 && !COIN_OPTIONS.includes(`KRW-${coinInput.toUpperCase()}`);







  const customMarket = `KRW-${coinInput.toUpperCase()}`;







  // [CHANGED] Normalize the current selection so the UI always reads the same Zustand key.







  const selectedCoin = formData.coin
    ? (formData.coin.startsWith('KRW-') ? formData.coin : `KRW-${formData.coin}`)
    : '';







  // [CHANGED] Bind the UI to the live store signal, with a minimal fallback only for first render.







  const safeSignal = selectedCoin ? safeSignals?.[selectedCoin] ?? null : null;
  const selectedSignal = selectedCoin ? safeSignals[selectedCoin] : null;
  // console.log("[STEP_2]");
  // console.log('[REACT31_DEBUG]', 'safeSignal', typeof safeSignal, Array.isArray(safeSignal), safeSignal);
  // console.log('[REACT31_DEBUG]', 'currentSignal', typeof safeSignal, Array.isArray(safeSignal), safeSignal);
  // console.log('[REACT31_DEBUG]', 'signals[selectedCoin]', typeof (selectedCoin ? safeSignals?.[selectedCoin] ?? null : null), Array.isArray(selectedCoin ? safeSignals?.[selectedCoin] ?? null : null), selectedCoin ? safeSignals?.[selectedCoin] ?? null : null);
  // console.log('[REACT31_DEBUG]', 'marketAnalysis', typeof marketAnalysis, Array.isArray(marketAnalysis), marketAnalysis);
  // console.log("[STEP_3]");
  // console.log("[STEP_3]");
  const currentSignal = null;







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
  // console.log('[REACT31_DETAIL]', 'liquidityRiskMessage', JSON.stringify(liquidityBlockMessage, null, 2));
  // console.log("[ISO_B]", "liquidityBlockMessage", typeof liquidityBlockMessage, Array.isArray(liquidityBlockMessage), liquidityBlockMessage);
  // console.log('[REACT31_DEBUG]', 'liquidityRiskMessage', typeof liquidityBlockMessage, Array.isArray(liquidityBlockMessage), liquidityBlockMessage);

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







    const entryState = 'WAIT';
    // console.log('[REACT31_DEBUG]', 'entryState', typeof entryState, Array.isArray(entryState), entryState);
    // console.log('[REACT31_DEBUG]', 'actionSignal', typeof entryState, Array.isArray(entryState), entryState);















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
    // console.log('[REACT31_DETAIL]', 'reasons', JSON.stringify(reasons, null, 2));
    // console.log("[ISO_A]", "reasons", typeof reasons, Array.isArray(reasons), reasons);
    // console.log("[REASONS_RUNTIME]", reasons);
    // console.log("[REASONS_TYPE]", typeof reasons, Array.isArray(reasons), reasons?.[0]);

    const prepareState = null;
    // console.log('[REACT31_DEBUG]', 'prepareState', typeof prepareState, Array.isArray(prepareState), prepareState);















    return {







      market,







      symbol: market.replace('KRW-', ''),







      price: Number(currentPrice ?? 0),







      currentPrice: Number(currentPrice ?? 0),







      entryState,







      trendReady: trendActive,







      volumeReady: volumeActive,







      breakoutReady: breakoutActive,







      explainReason: reasons
        .map((reason) =>
          typeof reason === 'object' && reason !== null
            ? String((reason as Record<string, unknown>).label ?? (reason as Record<string, unknown>).text ?? (reason as Record<string, unknown>).message ?? JSON.stringify(reason))
            : String(reason)
        )
        .join(' / '),







      failReasons: reasons,







      trend: trendActive,







      volume: volumeActive,







      breakout: breakoutActive,







      signalScore,







      scoreColor,







      prepareState,







    };
useEffect(() => {
    return;







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
    const blockedLimit = String(t('blocked_limit'));
    const blockedTitle = String(t('blocked_tilt'));



    return (



      <div className="space-y-6">



        <div className="p-8 border border-status-danger/50 bg-status-danger/5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-700">



          <div className="flex items-center gap-2 text-status-danger">



            <AlertTriangle size={18} />



            <span className="text-[10px] font-black uppercase tracking-[0.2em]">{String(t('input_blocked'))}</span>



          </div>



          <p className="text-xs text-status-danger/90 font-bold leading-relaxed whitespace-pre-line">



            {String(t('inputBlocked'))}



          </p>



          <div className="pt-4 mt-4 border-t border-status-danger/20">



            <p className="text-[9px] text-status-danger/40 uppercase font-mono italic">



              {safeControl.todayTradeCount >= safeSettings.maxDailyTrades



                ? blockedLimit



                : blockedTitle}



            </p>



          </div>



        </div>



      </div>



    );



  }







  const renderDebugValue = (name: string, value: unknown) => {
    const isObjectLike = typeof value === 'object' && value !== null;
    // console.log('[RENDER_DEBUG]', name, {
//       typeof: typeof value,
//       isArray: Array.isArray(value),
//       isValidElement: isValidElement(value as React.ReactElement),
//       keys: isObjectLike ? Object.keys(value as Record<string, unknown>).length : 0,
//       preview: value,
    //     });
};
//
false && renderDebugValue('selectedCoin', selectedCoin);
false && renderDebugValue('safeSignal', safeSignal);
false && renderDebugValue('currentSignal', safeSignal);
false && renderDebugValue('marketAnalysis', marketAnalysis);
false && renderDebugValue('prepareState', prepareState);
false && renderDebugValue('reasons', reasons);
false && renderDebugValue('failReasons', failReasons);
false && renderDebugValue('liquidityRiskMessage', liquidityBlockMessage);
false && renderDebugValue('entryState', entryState);
false && renderDebugValue('authPanel', authPanel);
  // console.log('[ENTRY_STATE_TYPE]', typeof entryState, entryState);
const failReasonsText = '';
  // console.log("[CHK] reasons", reasons);
  // console.log("[CHK] failReasons", failReasons);
  // console.log("[CHK] liquidityRiskMessage", liquidityBlockMessage);
  // console.log("[CHK] entryState", entryState);
  // console.log("[CHK] authPanel", authPanel);
  // console.log("[PF_BEFORE_RETURN]");
//
console.log("[PF_RENDER_SNAPSHOT]", {
  selectedCoinType: typeof selectedCoin,
  entryStateType: typeof entryState,
  prepareStateType: typeof prepareState,
  marketAnalysisType: typeof marketAnalysis,
  marketAnalysisKeys:
    marketAnalysis && typeof marketAnalysis === 'object'
      ? Object.keys(marketAnalysis as Record<string, unknown>)
      : [],
  safeSignalType: typeof safeSignal,
  safeSignalKeys:
    safeSignal && typeof safeSignal === 'object'
      ? Object.keys(safeSignal as Record<string, unknown>)
      : [],
  safeSignalStateType: typeof safeSignal?.state,
  activePositionsIsArray: Array.isArray(activePositions),
  activePositionsLength: activePositions.length,
});
return (
  <div className="space-y-6">
    {authUserInfo ? (
      <div className="text-sm font-semibold">{String(authUserInfo.email ?? '')}</div>
    ) : null}
    {selectedCoin ? (
      <div className="text-xs text-gray-500">{String(selectedCoin)}</div>
    ) : null}
    <div className="text-xs text-gray-500">{String(watchlist.length)}</div>
    {hasReferenceData ? (
      <div className="text-xs text-emerald-500">{String(hasReferenceData)}</div>
    ) : null}
    <div className="text-xs text-blue-400">{String(Object.keys(safeSignals).length)}</div>
    <div className="rounded border border-zinc-700 p-2">
      {Object.entries(safeSignals)
        .slice(0, 3)
        .map(([symbol, signal]) => (
          <div key={symbol} className="text-xs text-yellow-400">
            {String(signal?.state ?? '')}
          </div>
        ))}
    </div>
    <div className="rounded border border-blue-700 p-2">
      <div className="text-xs text-blue-400">
        {String(marketAnalysis?.isUpTrend ?? '')}
      </div>
    </div>
    <div className="rounded border border-lime-700 p-2">
      {activePositions
        .slice(0, 1)
        .map((position, index) => (
          <div key={String(position?.coin ?? index)} className="text-xs text-lime-400">
            {String(position?.coin ?? '')}
          </div>
        ))}
    </div>
    <div className="rounded border border-fuchsia-700 p-2">
      {watchlist
        .slice(0, 1)
        .map((coin, index) => (
          <div key={String(coin ?? index)} className="text-xs text-fuchsia-400">
            {String(coin ?? '')}
          </div>
        ))}
    </div>
    <div className="text-xs text-sky-400">{String(activePositions.length)}</div>
    <div className="text-xs text-orange-400">{String(selectedSignal?.state ?? '')}</div>
    <div className="text-xs text-purple-400">{String(selectedSignal?.trend ?? '')}</div>
    <div className="text-xs text-cyan-400">{String(selectedSignal?.breakout ?? '')}</div>
    <div className="text-xs text-pink-400">{String(selectedSignal?.volume ?? '')}</div>
    <div className="text-xs text-indigo-400">{String(selectedSignal?.volume ?? '')}</div>
    <div className="text-xs text-cyan-400">{String(selectedSignal?.breakout ?? '')}</div>
    <div className="rounded border border-violet-700 p-2">
      <div className="space-y-1 text-xs text-violet-400">
        <div className="text-gray-500">STATE</div>
        <div>{String(selectedSignal?.state ?? '')}</div>
        <div>{String(selectedSignal?.trend ?? '')}</div>
        <div>{String(selectedSignal?.volume ?? '')}</div>
        {selectedSignal?.breakout ? <div>{String(selectedSignal?.breakout)}</div> : null}
      </div>
    </div>
    {selectedSignal ? (
      <div className="rounded border border-slate-700 p-2">
        <div className="text-xs text-slate-400">{String(selectedSignal?.volume ?? '')}</div>
      </div>
    ) : null}
    <div className="rounded border border-zinc-700 p-2">
      <div>{String(selectedSignal?.state ?? '')}</div>
      <div>{String(selectedSignal?.trend ?? '')}</div>
    </div>
    <div className="text-xs text-rose-400">{String(selectedSignal?.trend ?? '')}</div>
    <div className="space-y-1 text-xs text-teal-400">
      {Object.keys(safeSignals)
        .slice(0, 1)
        .map((key) => {
          const item = safeSignals[key];

          return (
            <div key={key} className="space-y-1">
              <div>{String(item?.state ?? '')}</div>
              <div>{String(item?.trend ?? '')}</div>
              <div>{String(item?.volume ?? '')}</div>
            </div>
          );
        })}
    </div>
  </div>
);
}
