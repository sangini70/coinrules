import { useState, useEffect, FormEvent, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';
import { fetchTicker, fetchCandles } from '../services/upbitService';
import { formatPrice } from '../lib/utils';
import { Loader2, Info, CheckCircle2, AlertTriangle, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Translation } from '../i18n/types';

const COIN_OPTIONS = ['KRW-BTC', 'KRW-ETH', 'KRW-SOL', 'KRW-XRP', 'KRW-ADA', 'KRW-DOGE', 'KRW-AVAX', 'KRW-DOT'];

export function PositionForm() {
  const { settings, addPosition, isCoinInCooldown, getCooldownRemaining, control, signals, fetchSignals } = useAppStore();
  const t = useAppStore((state) => state.t)();
  
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [marketAnalysis, setMarketAnalysis] = useState<any>(null);
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
    
    // Fetch only ticker for current price display
    const fetchMarketData = async () => {
      // [1] State: fetch current ticker price
      const ticker = await fetchTicker(market);
      const candles = await fetchCandles(market, 20);
      
      // [2] Race condition prevention
      if (!active) return;
      
      if (ticker) {
        setCurrentPrice(ticker.trade_price);
        
        // Analyze candles
        if (candles && candles.length >= 20) {
          const highs = candles.map(c => c.high_price);
          const lows = candles.map(c => c.low_price);
          const volumes = candles.map(c => c.candle_acc_trade_volume);
          
          // 1. Trend Analysis (5+ same direction, 3+ highs/lows)
          let trend = 'sideways';
          let upHighs = 0, upLows = 0, downHighs = 0, downLows = 0;
          for (let i = 0; i < 5; i++) {
            if (highs[i] > highs[i+1]) upHighs++;
            if (lows[i] > lows[i+1]) upLows++;
            if (highs[i] < highs[i+1]) downHighs++;
            if (lows[i] < lows[i+1]) downLows++;
          }
          
          const range = Math.max(...highs.slice(0, 5)) / Math.min(...lows.slice(0, 5)) - 1;
          if (range > 0.05) {
            if (upHighs >= 3 && upLows >= 3 && (upHighs + upLows) >= 5) trend = 'up';
            else if (downHighs >= 3 && downLows >= 3 && (downHighs + downLows) >= 5) trend = 'down';
          }

          // 2. Volume Analysis (Recent 3 avg / Prev 10 avg > 1.3)
          const recentVol = volumes.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
          const prevVol = volumes.slice(3, 13).reduce((a, b) => a + b, 0) / 10;
          let volume = recentVol > prevVol * 1.3 ? 'high' : 'normal';

        const candleData = candles.map(c => ({
          open: c.opening_price,
          close: c.trade_price,
          high: c.high_price,
          low: c.low_price,
          volume: c.candle_acc_trade_volume,
          upperWickRatio: (c.high_price - Math.max(c.opening_price, c.trade_price)) / (c.high_price - c.low_price + 0.0000000001)
        }));

        const highs20 = candleData.map(c => c.high);
        const recentHigh = Math.max(...highs20.slice(0, 20));
        const avgVol3 = candleData.slice(0, 3).reduce((a, b) => a + b.volume, 0) / 3;
        const avgVol10 = candleData.slice(3, 13).reduce((a, b) => a + b.volume, 0) / 10;
        
        const isUpTrend = candleData[0].close > candleData[3].close && candleData[0].low > candleData[3].low;
        const isBreakout = candleData[0].close > recentHigh;
        const isSustained = candleData.slice(0, 3).every(c => c.close > recentHigh);
        const isVolumeSpike = avgVol3 > avgVol10 * 1.5;
        const isFakeout = (isBreakout && avgVol3 < avgVol10) || 
                          (candleData[0].upperWickRatio > 0.4) ||
                          (isBreakout && candleData[1].close < recentHigh);
        
        setMarketAnalysis({ isUpTrend, isVolumeSpike, isBreakout, isSustained, isFakeout, recentHigh });
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

    const slPrice = formData.buyPrice * (1 + settings.stopLossPercent / 100);
    const tpPrice = formData.buyPrice * (1 + settings.takeProfitPercent / 100);

    addPosition({
      coin: formData.coin,
      type: formData.type,
      buyPrice: formData.buyPrice,
      quantity: formData.quantity,
      entryAmount: formData.amount,
      stopLossPercent: formData.type === 'short_term' ? settings.stopLossPercent : 0,
      takeProfitPercent: formData.type === 'short_term' ? settings.takeProfitPercent : 0,
      stopLossPrice: formData.type === 'short_term' ? slPrice : 0,
      takeProfitPrice: formData.type === 'short_term' ? tpPrice : 0,
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
  const slPreview = formData.buyPrice > 0 ? formData.buyPrice * (1 + settings.stopLossPercent / 100) : 0;
  const tpPreview = formData.buyPrice > 0 ? formData.buyPrice * (1 + settings.takeProfitPercent / 100) : 0;

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
              {statusInfo.label}
            </div>
            <div className="text-[9px] font-bold text-text-muted/60 uppercase tracking-widest mt-1">
              {statusInfo.desc}
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
        {(() => {
        if (!marketAnalysis) {
          return (
            <div className="mt-3 p-4 border rounded-lg bg-gray-50 border-text-main/10">
              <div className="text-sm font-semibold text-gray-700">시장 상태 확인</div>
              <div className="mt-2 text-sm text-gray-600">충족 정도: -</div>
              <div className="mt-1 text-sm text-gray-600">결론: 대기 중</div>
            </div>
          );
        }

        // 1. 상태 및 데이터 추출
        const { isUpTrend, isVolumeSpike, isBreakout, isSustained, isFakeout, recentHigh } = marketAnalysis;
        
        // 2. 점수 계산 (조건 충족 정도)
        let score = 0;
        if (isUpTrend) score += 35;
        if (isVolumeSpike) score += 25;
        if (isBreakout) score += 25;
        if (isSustained) score += 15;
        score = Math.min(100, Math.max(0, score));

        // 3. 결론 및 근거
        let conclusion = "대기";
        const reasons: string[] = [];
        const price = currentPrice || 0;
        
        let scoreLabel = score >= 75 ? "많음" : (score >= 60 ? "보통" : "낮음");
        const scoreColor = score >= 75 ? 'text-text-main' : (score >= 60 ? 'text-blue-500' : 'text-yellow-600');

        if (isFakeout) {
            conclusion = "가짜 돌파 가능성";
            reasons.push("돌파 후 매물 출회", "거래량 부족 또는 윗꼬리");
        } else if (score >= 75 && isUpTrend && isVolumeSpike && isBreakout && isSustained) {
            conclusion = "조건 일부 충족 (확인 필요)";
            reasons.push("상승 추세 전환", "거래량 유입", "돌파 유지");
        } else if (isBreakout === false && price < recentHigh * 0.95 && isVolumeSpike) {
            conclusion = "현재 시장 상태 (하락 진행)";
            reasons.push("하락 추세 확인", "지지선 이탈", "매도 거래량 증가");
        } else if (price >= recentHigh * 0.95 && !isBreakout && isVolumeSpike) {
            conclusion = "관찰 구간 (진입 금지)";
            reasons.push("최근 고점 근접", "거래량 변화 발생");
        }
        
        return (
          <div className="mt-3 p-4 border rounded-lg bg-gray-50 border-text-main/10">
            <div className="text-sm font-semibold text-gray-700 mb-2">시장 상태 확인</div>
            <div className="text-sm font-bold mb-1">
              조건 충족 정도: <span className={`text-base ${scoreColor}`}>{score} ({scoreLabel})</span> / 100
            </div>
            <div className="text-base font-bold text-gray-900 mb-2">결론: {conclusion}</div>
            <div className="text-[10px] text-text-muted/60 mb-3 font-bold italic">
              * 조건 충족 여부만 표시합니다. 결정은 사용자 책임입니다.
            </div>
            <div className="text-sm font-semibold text-gray-700 mb-1">근거</div>
            <ul className="text-xs text-gray-600 space-y-0.5 list-disc list-inside">
              {reasons.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </div>
        );
      })()}

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
            <span className="text-text-muted/40">{t('stop_loss_val')}</span>
            <span className="text-status-danger/40 text-[9px]">({slPreview ? formatPrice(slPreview) : "-"})</span>
          </div>
          <div className="flex justify-between items-center pb-2 border-b border-text-main/5">
            <span className="text-text-muted/40">{t('take_profit_val')}</span>
            <span className="text-status-safe/40 text-[9px]">({tpPreview ? formatPrice(tpPreview) : "-"})</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-text-muted/40">{t('cooldown_min')}</span>
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
