import { useState, useEffect, FormEvent } from 'react';
import { useAppStore } from '../store/useAppStore';
import { fetchTicker } from '../services/upbitService';
import { formatPrice } from '../lib/utils';
import { Loader2, Info, CheckCircle2, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const COIN_OPTIONS = ['KRW-BTC', 'KRW-ETH', 'KRW-SOL', 'KRW-XRP', 'KRW-ADA', 'KRW-DOGE', 'KRW-AVAX', 'KRW-DOT'];

export function PositionForm() {
  const { settings, addPosition, isCoinInCooldown, getCooldownRemaining, control, signals, fetchSignals } = useAppStore();
  const t = useAppStore((state) => state.t)();
  
  const [formData, setFormData] = useState({
    coin: 'KRW-BTC',
    type: 'short_term' as 'short_term' | 'long_term',
    buyPrice: 0,
    amount: 1000000, 
    quantity: 0,
    memo: '',
  });

  const [loadingPrice, setLoadingPrice] = useState(false);
  const [cooldownTime, setCooldownTime] = useState(0);

  useEffect(() => {
    fetchSignals(formData.coin);
    const interval = setInterval(() => fetchSignals(formData.coin), 60000); // refresh every min
    return () => clearInterval(interval);
  }, [formData.coin, fetchSignals]);

  useEffect(() => {
    const checkCooldown = () => {
      setCooldownTime(getCooldownRemaining(formData.coin));
    };
    checkCooldown();
    const interval = setInterval(checkCooldown, 1000);
    return () => clearInterval(interval);
  }, [formData.coin, getCooldownRemaining]);

  const loadCurrentPrice = async () => {
    setLoadingPrice(true);
    const ticker = await fetchTicker(formData.coin);
    if (ticker) {
      const price = ticker.trade_price;
      setFormData(prev => ({ 
        ...prev, 
        buyPrice: price,
        quantity: prev.amount / price
      }));
    }
    setLoadingPrice(false);
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
  const getFormStatus = () => {
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
    const signal = signals[formData.coin];
    if (signal?.state === 'strong_observe') {
      return {
        label: t('signal_strong_observe'),
        desc: '(돌파 신호 감지 / Breakout Detected)',
        color: 'text-[#F1C40F]',
        border: 'border-[#F1C40F]/30',
        bg: 'bg-[#F1C40F]/5',
        dot: 'bg-[#F1C40F]'
      };
    }
    if (signal?.state === 'observe') {
      return {
        label: t('signal_observe'),
        desc: '(추세 상승 · 거래량 증가 / Upward Trend · Volume Spike)',
        color: 'text-[#888888]',
        border: 'border-[#888888]/30',
        bg: 'bg-[#888888]/5',
        dot: 'bg-[#888888]'
      };
    }
    return {
      label: t('signal_neutral'),
      desc: '(특이 사항 없음 / Neutral)',
      color: 'text-text-muted/20',
      border: 'border-[#1A1A1A]',
      bg: 'bg-aux-bg',
      dot: 'bg-[#333]'
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
      <div className="space-y-2">
        <label className="text-[9px] font-black uppercase tracking-[0.2em] text-text-muted/40 px-1">{t('select_coin')}</label>
        <select 
          value={formData.coin}
          onChange={(e) => setFormData({ ...formData, coin: e.target.value })}
          className="w-full bg-aux-bg border border-[#1A1A1A] p-4 text-text-main font-black uppercase tracking-tight outline-none focus:border-text-muted/50 transition-colors appearance-none"
        >
          {COIN_OPTIONS.map(opt => (
            <option key={opt} value={opt}>{opt.replace('KRW-', '')}</option>
          ))}
        </select>
      </div>

      {/* OBSERVATION SIGNAL / COOLDOWN WATCHER */}
      <AnimatePresence mode="wait">
        <motion.div 
          key={formData.coin + statusInfo.label}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className={`p-5 border transition-colors duration-500 min-h-[140px] flex flex-col justify-between ${statusInfo.border} ${statusInfo.bg}`}
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
              <div className="text-[9px] font-bold text-text-muted/40 uppercase tracking-widest mt-1">
                {statusInfo.desc}
              </div>
            </div>
          </div>
          
          {/* Signal Detail (Only if not blocked and has signal) */}
          {!isCoinBlocked && signals[formData.coin] && signals[formData.coin].state !== 'none' ? (
            <div className="grid grid-cols-3 gap-2 border-y border-[#1A1A1A] py-3 my-3">
              <div className="space-y-1">
                <p className="text-[7px] text-text-muted/30 font-black uppercase tracking-widest">Trend</p>
                <p className={`text-[8px] font-bold uppercase ${signals[formData.coin].trend === 'up' ? 'text-text-main' : 'text-text-muted/20'}`}>
                  {signals[formData.coin].trend}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-[7px] text-text-muted/30 font-black uppercase tracking-widest">Volume</p>
                <p className={`text-[8px] font-bold uppercase ${signals[formData.coin].volume === 'spike' ? 'text-text-main' : 'text-text-muted/20'}`}>
                  {signals[formData.coin].volume}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-[7px] text-text-muted/30 font-black uppercase tracking-widest">Breakout</p>
                <p className={`text-[8px] font-bold uppercase ${signals[formData.coin].breakout === 'bullish_breakout' ? 'text-text-main' : 'text-text-muted/20'}`}>
                  {signals[formData.coin].breakout === 'bullish_breakout' ? 'detect' : 'none'}
                </p>
              </div>
            </div>
          ) : (
            <div className="my-3 h-[1px] bg-[#1A1A1A]"></div>
          )}

          {/* WARNING MESSAGE */}
          <div className="flex gap-2 items-start">
            <Info size={10} className="text-text-muted/20 mt-0.5 shrink-0" />
            <p className="text-[9px] text-text-muted/30 font-bold leading-relaxed whitespace-pre-line tracking-tight italic">
              {t('signal_warning')}
            </p>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* STRATEGY TYPE */}
      <div className="space-y-2">
        <label className="text-[9px] font-black uppercase tracking-[0.2em] text-text-muted/40 px-1">{t('select_strategy')}</label>
        <div className="grid grid-cols-2 gap-1 bg-aux-bg p-1 border border-[#1A1A1A]">
          <button
            type="button"
            onClick={() => setFormData({ ...formData, type: 'short_term' })}
            className={`py-2 text-[10px] font-black uppercase tracking-widest transition-all ${formData.type === 'short_term' ? 'bg-status-safe text-black' : 'text-text-muted/40 hover:text-text-muted'}`}
          >
            {t('shortTerm')}
          </button>
          <button
            type="button"
            onClick={() => setFormData({ ...formData, type: 'long_term' })}
            className={`py-2 text-[10px] font-black uppercase tracking-widest transition-all ${formData.type === 'long_term' ? 'bg-purple-900/80 text-white' : 'text-text-muted/40 hover:text-text-muted'}`}
          >
            {t('longTerm')}
          </button>
        </div>
      </div>

      {/* BUY PRICE */}
      <div className="space-y-2">
        <label className="text-[9px] font-black uppercase tracking-[0.2em] text-text-muted/40 px-1">{t('buy_price')}</label>
        <div className="relative">
          <input 
            type="number"
            value={formData.buyPrice || ''}
            onChange={(e) => handlePriceChange(Number(e.target.value))}
            placeholder="0.00"
            className="w-full bg-aux-bg border border-[#1A1A1A] p-4 text-xl font-black tracking-tight text-text-main outline-none focus:border-text-muted/50 pr-20"
          />
          <button
            type="button"
            onClick={loadCurrentPrice}
            className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 bg-[#222] border border-[#333] text-[9px] font-black uppercase tracking-widest text-text-muted hover:bg-text-main hover:text-black transition-all"
          >
            {loadingPrice ? <Loader2 size={10} className="animate-spin" /> : t('auto_price')}
          </button>
        </div>
      </div>

      {/* AMOUNT */}
      <div className="space-y-2">
        <label className="text-[9px] font-black uppercase tracking-[0.2em] text-text-muted/40 px-1">{t('investment')}</label>
        <input 
          type="number"
          value={formData.amount || ''}
          onChange={(e) => handleAmountChange(Number(e.target.value))}
          placeholder="1000000"
          className="w-full bg-aux-bg border border-[#1A1A1A] p-4 text-xl font-black tracking-tight text-text-main outline-none focus:border-text-muted/50"
        />
      </div>

      {/* RULE SUMMARY */}
      <div className="p-5 bg-card-bg border border-[#1A1A1A] space-y-4">
        <div className="text-[9px] font-black uppercase tracking-[0.2em] text-text-muted/30 mb-1 flex justify-between">
          <span>{t('rule_summary')}</span>
          <CheckCircle2 size={12} className={formData.buyPrice > 0 ? 'text-status-safe' : 'text-text-muted/10'} />
        </div>
        <div className="space-y-2 font-mono text-[11px] font-bold">
          <div className="flex justify-between items-center pb-2 border-b border-[#1A1A1A]">
            <span className="text-text-muted/40">{t('stop_loss_val')}</span>
            <span className="text-status-danger/40 text-[9px]">({formatPrice(slPreview)})</span>
          </div>
          <div className="flex justify-between items-center pb-2 border-b border-[#1A1A1A]">
            <span className="text-text-muted/40">{t('take_profit_val')}</span>
            <span className="text-status-safe/40 text-[9px]">({formatPrice(tpPreview)})</span>
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
        className={`w-full py-5 font-black uppercase text-xs tracking-[0.3em] transition-all relative overflow-hidden group ${formData.buyPrice > 0 && !isBlocked ? 'bg-text-main text-black hover:bg-white' : 'bg-aux-bg text-text-muted/20 cursor-not-allowed border border-[#1A1A1A]'}`}
      >
        <span className="relative z-10">{t('confirm_button')}</span>
      </button>
    </form>
  );
}
