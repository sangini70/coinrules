import { useState, useEffect, FormEvent, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';
import { fetchTicker, fetchCandles } from '../services/upbitService';
import { formatPrice } from '../lib/utils';
import {
  SHORT_TERM_STOP_LOSS_PERCENT,
  SHORT_TERM_TAKE_PROFIT_1_PERCENT,
  SHORT_TERM_TAKE_PROFIT_2_PERCENT,
} from '../lib/tradingRules';
import { Loader2, Info, CheckCircle2, AlertTriangle, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Translation } from '../i18n/types';

const COIN_OPTIONS = ['KRW-BTC', 'KRW-ETH', 'KRW-SOL', 'KRW-XRP', 'KRW-ADA', 'KRW-DOGE', 'KRW-AVAX', 'KRW-DOT'];
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

const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;

export function PositionForm() {
  const { settings, addPosition, isCoinInCooldown, getCooldownRemaining, control, signals, fetchSignals } = useAppStore();
  const t = useAppStore((state) => state.t)();
  
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [marketAnalysis, setMarketAnalysis] = useState<MarketAnalysis | null>(null);
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
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true; // For race condition prevention
    
    // Force KRW code if it's just the coin name
    const market = formData.coin.startsWith('KRW-') ? formData.coin : `KRW-${formData.coin}`;
    setMarketAnalysis(null);
    
    // Fetch only ticker for current price display
    const fetchMarketData = async () => {
      // [1] State: fetch current ticker price
      const ticker = await fetchTicker(market);
      const candles = await fetchCandles(market, MARKET_ANALYSIS_CANDLE_COUNT);
      
      // [2] Race condition prevention
      if (!active) return;
      
      if (ticker) {
        setCurrentPrice(ticker.trade_price);
        
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

            setMarketAnalysis({ isUpTrend, isVolumeSpike, isBreakout, isSustained, isFakeout, recentHigh });
          }
        }
      }
    };
    
    fetchSignals(market);
    fetchMarketData();
    const interval = setInterval(() => {
      fetchSignals(market);
      fetchMarketData();
    }, 60000);
    
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [formData.coin, fetchSignals]);

  useEffect(() => {
    const checkCooldown = () => {
      setCooldownTime(getCooldownRemaining(formData.coin));
    };
    checkCooldown();
    const interval = setInterval(checkCooldown, 1000);
    return () => clearInterval(interval);
  }, [formData.coin, getCooldownRemaining]);

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

  const handleSelectCoin = (coin: string) => {
    setFormData({ ...formData, coin });
    setCoinInput('');
    setIsDropdownOpen(false);
  };

  const handleFetchPrice = async () => {
    const market = formData.coin.startsWith('KRW-') ? formData.coin : `KRW-${formData.coin}`;
    console.log("FETCH START:", market);

    try {
      const ticker = await fetchTicker(market);
      console.log("FETCH RESULT:", ticker?.trade_price);
      
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

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (formData.buyPrice <= 0 || formData.amount <= 0 || control.isInputDisabled || cooldownTime > 0) return;

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
      takeProfitPercent: formData.type === 'short_term' ? settings.takeProfitPercent : 0,
      stopLossPrice: formData.type === 'short_term' ? slPrice : 0,
      takeProfitPrice1: formData.type === 'short_term' ? tp1Price : 0,
      takeProfitPrice2: formData.type === 'short_term' ? tp2Price : 0,
      memo: formData.memo,
      isLocked: formData.type === 'long_term',
    });
    
    // Reset form partially
    setFormData(prev => ({ ...prev, buyPrice: 0, quantity: 0, memo: '' }));
  };

  const isInputBlocked = control?.isInputDisabled ?? false;
  const isCoinBlocked = (cooldownTime ?? 0) > 0;
  const isBlocked = isInputBlocked || isCoinBlocked;

  // Rule Summary Preview
  const slPreview = formData.buyPrice > 0 ? formData.buyPrice * (1 + SHORT_TERM_STOP_LOSS_PERCENT / 100) : 0;
  const tp1Preview = formData.buyPrice > 0 ? formData.buyPrice * (1 + SHORT_TERM_TAKE_PROFIT_1_PERCENT / 100) : 0;
  const tp2Preview = formData.buyPrice > 0 ? formData.buyPrice * (1 + SHORT_TERM_TAKE_PROFIT_2_PERCENT / 100) : 0;

  const entryAnalysis = (() => {
    if (!marketAnalysis) {
      return {
        score: 0,
        scoreLabel: '-',
        scoreColor: 'text-text-muted/40',
        conclusion: '데이터 확인 중',
        reasons: ['시장 데이터 수집 중'],
        entryState: '상태 확인 중',
      };
    }

    const { isUpTrend, isVolumeSpike, isBreakout, isSustained, isFakeout } = marketAnalysis;

    let score = 0;
    if (isUpTrend) score += 30;
    if (isVolumeSpike) score += 20;
    if (isBreakout) score += 25;
    if (isSustained) score += 15;
    if (isBreakout && isVolumeSpike) score += 10;
    if (isBreakout && isSustained) score += 10;
    if (isBreakout && !isSustained) score -= 10;
    score = Math.max(0, Math.min(100, score));

    let conclusion = '관망';
    const reasons: string[] = [];
    const hasAnySignal = isUpTrend || isVolumeSpike || isBreakout || isSustained;
    const hasNormalVolume = !isVolumeSpike;

    if (isFakeout) reasons.push('가짜 돌파 가능성');
    if (isBreakout && !isSustained) reasons.push('돌파 유지 실패');
    if (isUpTrend && isVolumeSpike) reasons.push('거래량 동반 상승');
    else if (isUpTrend) reasons.push('상승 흐름');
    else if (isVolumeSpike) reasons.push('거래량 유입 확대');
    if (isBreakout && isSustained) reasons.push('돌파 유지');
    else if (isBreakout) reasons.push('돌파 시도');
    if (!isUpTrend && hasNormalVolume && !isBreakout) reasons.push('횡보 구간');
    if (!hasAnySignal) reasons.push('관망');

    const scoreLabel = score >= 75 ? '높음' : (score >= 60 ? '보통' : '낮음');
    const scoreColor = score >= 75 ? 'text-text-main' : (score >= 60 ? 'text-blue-500' : 'text-yellow-600');

    if (isFakeout) {
      conclusion = '가짜 돌파 가능성';
    } else if (isBreakout && !isSustained) {
      conclusion = '돌파 유지 실패';
    } else if (isBreakout && isSustained) {
      conclusion = '돌파 유지';
    } else if (isBreakout) {
      conclusion = '돌파 시도';
    } else if (isUpTrend && isVolumeSpike) {
      conclusion = '거래량 동반 상승';
    } else if (isUpTrend) {
      conclusion = '상승 흐름';
    } else if (isVolumeSpike) {
      conclusion = '거래량 유입 확대';
    } else if (!isUpTrend && hasNormalVolume && !isBreakout) {
      conclusion = '횡보 구간';
    } else if (!hasAnySignal) {
      conclusion = '관망';
    } else {
      conclusion = score >= 35 || isSustained ? '관망' : '횡보 구간';
    }

    let entryState = '관망';
    if (isFakeout || (isBreakout && !isSustained)) entryState = '진입 금지';
    else if (score >= 75 && isBreakout && isSustained) entryState = '진입 신호';
    else if (score >= 60) entryState = '관찰';

    return {
      score,
      scoreLabel,
      scoreColor,
      conclusion,
      reasons: Array.from(new Set(reasons)),
      entryState,
    };
  })();

  // Status Priority for form
  useEffect(() => {
    console.log("SIGNAL:", signals[formData.coin]);
  }, [signals, formData.coin]);
  
  const getFormStatus = () => {
    // [1] COOLDOWN CHECK
    if (isCoinBlocked) {
      return {
        label: t('waiting_reentry'),
        desc: `(재진입 대기 중 / ${Math.floor(cooldownTime / 60)}:${(cooldownTime % 60).toString().padStart(2, '0')})`,
        color: 'text-status-warn',
        border: 'border-status-warn/30',
        bg: 'bg-status-warn/5',
        dot: 'bg-status-warn'
      };
    }
    
    // [2] MARKET INTERPRETATION
    const signal = signals[formData.coin];
    if (signal && signal.state !== 'none') {
      const stateKey = `state_${signal.state}` as keyof Translation;
      const descKey = `desc_${signal.state}` as keyof Translation;
      
      const statusMap: Record<string, any> = {
        'WAIT': { color: 'text-status-danger', border: 'border-status-danger/30', bg: 'bg-status-danger/5', dot: 'bg-status-danger' },
        'OBSERVE': { color: 'text-text-muted', border: 'border-text-muted/30', bg: 'bg-text-muted/5', dot: 'bg-text-muted' },
        'CAUTION': { color: 'text-status-warn', border: 'border-status-warn/30', bg: 'bg-status-warn/5', dot: 'bg-status-warn' },
        'PREPARE': { color: 'text-status-safe', border: 'border-status-safe/30', bg: 'bg-status-safe/5', dot: 'bg-status-safe' },
        'RISK': { color: 'text-text-muted/50', border: 'border-text-main/10', bg: 'bg-aux-bg', dot: 'bg-text-muted/20' },
      };
      
      const base = statusMap[signal.state] || statusMap['RISK'];
      
      return {
        label: t(stateKey),
        desc: t(descKey),
        ...base
      };
    }
    
    return {
      label: t('state_RISK'),
      desc: t('desc_RISK'),
      color: 'text-text-muted/20',
      border: 'border-text-main/10',
      bg: 'bg-aux-bg',
      dot: 'bg-text-muted/20'
    };
  };

  const statusInfo = getFormStatus();

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
            {control.todayTradeCount >= settings.maxDailyTrades 
              ? t('blocked_limit') 
              : t('blocked_tilt')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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

      {/* MARKET INTERPRETATION */}
      <div 
        className={`p-5 border transition-all duration-300 min-h-[140px] flex flex-col justify-between ${statusInfo.border} ${statusInfo.bg}`}
      >
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-text-muted/30">{t('current_status')}</span>
            <div className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot}`}></div>
          </div>
          
          <div className="mb-2">
            <div className={`text-base font-black uppercase tracking-tight ${statusInfo.color}`}>
              {entryAnalysis.entryState}
            </div>
            <div className="text-[9px] font-bold text-text-muted/60 uppercase tracking-widest mt-1">
              {entryAnalysis.reasons[0]}
            </div>
          </div>
        </div>
        
        {/* Evidence */}
        <div className="grid grid-cols-3 gap-2 border-y border-text-main/5 py-3 my-3">
            <div className="space-y-1">
              <p className="text-[7px] text-text-muted/30 font-black uppercase tracking-widest">Trend</p>
              <p className={`text-[8px] font-bold uppercase ${signals[formData.coin]?.trend === 'up' ? 'text-text-main' : 'text-text-muted/20'}`}>
                {signals[formData.coin]?.trend || '-'}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-[7px] text-text-muted/30 font-black uppercase tracking-widest">Volume</p>
              <p className={`text-[8px] font-bold uppercase ${signals[formData.coin]?.volume === 'spike' ? 'text-text-main' : 'text-text-muted/20'}`}>
                {signals[formData.coin]?.volume || '-'}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-[7px] text-text-muted/30 font-black uppercase tracking-widest">Breakout</p>
              <p className={`text-[8px] font-bold uppercase ${signals[formData.coin]?.breakout === 'bullish_breakout' ? 'text-text-main' : 'text-text-muted/20'}`}>
                {signals[formData.coin]?.breakout === 'bullish_breakout' ? 'detect' : 'none'}
              </p>
            </div>
        </div>

        {/* WARNING MESSAGE */}
        <div className="flex gap-2 items-start mt-2">
          <Info size={10} className="text-text-muted/20 mt-0.5 shrink-0" />
          <p className="text-[9px] text-text-muted/40 font-bold leading-relaxed whitespace-pre-line tracking-tight italic">
            이 신호는 진입을 의미하지 않습니다.
            충분히 관찰한 후 판단하세요.
          </p>
        </div>
      </div>

      {/* 시장 상태 확인 UI */}
      <div className="mt-3 p-4 border rounded-lg bg-gray-50 border-text-main/10">
        <div className="text-sm font-semibold text-gray-700 mb-2">단기 흐름 요약</div>
        <div className="text-sm font-bold mb-1">
          조건 충족 정도:{' '}
          {marketAnalysis ? (
            <span className={`text-base ${entryAnalysis.scoreColor}`}>
              {entryAnalysis.score} ({entryAnalysis.scoreLabel})
            </span>
          ) : (
            <span className="text-base text-text-muted/40">-</span>
          )}{' '}
          / 100
        </div>
        <div className="text-base font-bold text-gray-900 mb-2">상태 해석: {entryAnalysis.conclusion}</div>
        <div className="text-[10px] text-text-muted/60 mb-3 font-bold italic">
          * 참고용 상태 요약입니다. 실제 판단 전 추가 확인이 필요할 수 있습니다.
        </div>
        <div className="text-sm font-semibold text-gray-700 mb-1">확인된 신호</div>
        <ul className="text-xs text-gray-600 space-y-0.5 list-disc list-inside">
          {entryAnalysis.reasons.map((r, i) => <li key={i}>{r}</li>)}
        </ul>
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
            <span className="text-text-muted/40">SL ({settings.stopLossPercent}%)</span>
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
    </form>
  );
}
