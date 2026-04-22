import * as React from 'react';
import { useState, useEffect } from 'react';
import { Position, PositionStatus, ResultType } from '../types';
import { useAppStore } from '../store/useAppStore';
import { fetchTicker } from '../services/upbitService';
import { formatPrice, formatPercent, formatCurrency } from '../lib/utils';
import { AlertTriangle, Shield, TrendingUp, X, Clock, HelpCircle } from 'lucide-react';
import { motion } from 'motion/react';

export const PositionCard: React.FC<{ position: Position }> = ({ position }) => {
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const { settings, closePosition, deletePosition, playSound, t } = useAppStore();
  const tFn = t();

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    
    const updatePrice = async () => {
      const ticker = await fetchTicker(position.coin);
      if (ticker) {
        setCurrentPrice(ticker.trade_price);
      }
      setLoading(false);
    };

    updatePrice();
    interval = setInterval(updatePrice, 10000); // 10s update
    return () => clearInterval(interval);
  }, [position.coin]);

  const pnlPercent = currentPrice ? ((currentPrice / position.buyPrice) - 1) * 100 : 0;
  const pnlAmount = currentPrice ? (currentPrice - position.buyPrice) * position.quantity : 0;

  const getStatus = (): PositionStatus => {
    if (!currentPrice || position.isLocked) return 'HOLD';
    
    const slThreshold = position.stopLossPrice * 1.01; // SL Imminent within 1% of SL
    if (currentPrice <= slThreshold) return 'STOP_LOSS';
    
    // User priority: SL Imminent > TP Zone > Breakeven > Hold
    if (currentPrice >= position.takeProfitPrice * 0.99) return 'TAKE_PROFIT';
    
    if (pnlPercent >= settings.breakevenTriggerPercent) return 'BREAKEVEN';
    
    return 'HOLD';
  };

  const status = getStatus();
  const prevStatusRef = React.useRef<PositionStatus>(status);

  // Handle Sound Alerts (Edge Trigger)
  useEffect(() => {
    if (status === 'STOP_LOSS' && prevStatusRef.current !== 'STOP_LOSS' && !position.isLocked && currentPrice && !loading) {
      playSound('warning');
    }
    prevStatusRef.current = status;
  }, [status, position.isLocked, currentPrice, loading, playSound]);

  const handleClose = () => {
    if (!currentPrice) return;
    
    let resultType: ResultType = 'manual_exit';
    let reason = '사용자가 수동으로 종료함';

    if (currentPrice <= position.stopLossPrice) {
      resultType = 'stop_loss';
      reason = '손절가 터치 (규칙 준수)';
    } else if (currentPrice >= position.takeProfitPrice) {
      resultType = 'take_profit';
      reason = '익절가 터치 (규칙 준수)';
    }

    const confirmMessage = status === 'HOLD' 
      ? '익절/손절가에 도달하지 않았습니다. 정말 종료하시겠습니까? (수동 종료로 기록됨)'
      : '선택하신 포지션을 공식적으로 종료하고 일지에 기록합니다.';
      
    if (window.confirm(confirmMessage)) {
      closePosition(position.id, currentPrice, resultType, reason);
    }
  };

  const statusMap = {
    HOLD: { 
      label: tFn('holding'), 
      desc: tFn('holding_desc'),
      color: 'text-text-muted', 
      bg: 'bg-text-main/5', 
      border: 'border-text-main/10' 
    },
    BREAKEVEN: { 
      label: tFn('protected'), 
      desc: tFn('protected_desc'),
      color: 'text-status-safe', 
      bg: 'bg-status-safe/10', 
      border: 'border-status-safe/30' 
    },
    TAKE_PROFIT: { 
      label: tFn('take_profit_zone'), 
      desc: tFn('take_profit_desc'),
      color: 'text-status-safe', 
      bg: 'bg-status-safe/5', 
      border: 'border-status-safe/20' 
    },
    STOP_LOSS: { 
      label: tFn('stop_loss_required'), 
      desc: tFn('stop_loss_desc'),
      color: 'text-status-danger', 
      bg: 'bg-status-danger/10', 
      border: 'border-status-danger/50' 
    },
    COOLDOWN: { 
      label: tFn('cooldown_active'), 
      desc: tFn('cooldown_desc'),
      color: 'text-status-warn', 
      bg: 'bg-status-warn/5', 
      border: 'border-status-warn/30' 
    },
  };

  const display = statusMap[status as keyof typeof statusMap] || statusMap.HOLD;

  return (
    <div 
      className={`bg-card-bg border ${display.border} p-0 relative overflow-hidden transition-all duration-300`}
    >
      <div className="flex flex-col md:flex-row items-stretch">
        {/* SIDE BAR STATUS INDICATOR */}
        <div className={`w-full md:w-1.5 shrink-0 ${status === 'HOLD' ? 'bg-text-main/10' : display.color.replace('text-', 'bg-').split(' ')[0]}`}></div>
        
        <div className="flex-1 p-8 grid grid-cols-1 md:grid-cols-12 gap-10 items-center">
          {/* COIN INFO */}
          <div className="md:col-span-3 space-y-1">
            <div className="text-[9px] font-black text-text-muted/40 uppercase tracking-[0.2em]">
              {position.isLocked ? tFn('longTerm') : tFn('shortTerm')}
            </div>
            <div className="text-5xl font-black tracking-tight leading-none text-text-main">
              {position.coin.replace('KRW-', '')}
            </div>
            <div className="text-[8px] font-mono text-text-muted/10 tracking-widest uppercase">ID_{position.id.slice(-6)}</div>
          </div>

          {/* STATUS - DOMINANT FOCUS */}
          <div className="md:col-span-5 flex flex-col justify-center border-l border-text-main/5 md:pl-10">
            <div className={`text-[10px] font-bold uppercase tracking-[0.2em] mb-3 ${display.color} opacity-60`}>{tFn('status_label')}</div>
            <div className={`text-4xl md:text-5xl font-black uppercase tracking-tight leading-none transition-colors duration-500 mb-4 ${display.color}`}>
              {display.label}
            </div>
            <div className="text-xs font-medium text-text-muted/40 tracking-tight flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-current opacity-40"></span>
              {display.desc}
            </div>
            {!position.isLocked && (
              <div className="mt-8 flex gap-8 text-[9px] font-mono font-bold tracking-widest text-text-muted/30 uppercase">
                <span className="flex items-center gap-1.5">
                  {tFn('stop_label')} <span className="text-status-danger/60">{formatPrice(position.stopLossPrice)}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  {tFn('target_label')} <span className="text-status-safe/60">{formatPrice(position.takeProfitPrice)}</span>
                </span>
              </div>
            )}
          </div>

          {/* PRICES & PERFORMANCE */}
          <div className="md:col-span-4 flex flex-col gap-6 md:pl-8">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-[9px] font-bold text-text-muted/30 uppercase tracking-widest mb-1">{tFn('current_price')}</div>
                <div className="text-lg font-black tabular-nums tracking-tight text-text-main/90">
                  {loading ? '---' : formatPrice(currentPrice!)}
                </div>
              </div>
              {!position.isLocked && (
                <div>
                  <div className="text-[9px] font-bold text-text-muted/30 uppercase tracking-widest mb-1">{tFn('pnl_return')}</div>
                  <div className={`text-lg font-black tabular-nums tracking-tight ${pnlPercent >= 0 ? 'text-status-safe' : 'text-status-danger'}`}>
                    {loading ? '---' : formatPercent(pnlPercent)}
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-6 mt-2 pt-6 border-t border-text-main/5">
              <div className="text-right md:text-left">
                <div className="text-[9px] font-bold text-text-muted/30 uppercase tracking-widest mb-1">{tFn('net_pnl')}</div>
                <div className={`text-xl font-black tabular-nums tracking-tighter leading-none ${pnlAmount >= 0 ? 'text-status-safe' : 'text-status-danger'} ${position.isLocked ? 'blur-[3px]' : ''}`}>
                  {loading ? '---' : formatCurrency(pnlAmount)}
                </div>
              </div>
              
              <div className="flex gap-2 w-full md:w-auto">
                <button 
                  onClick={handleClose}
                  className="flex-1 md:flex-none px-6 py-3 bg-aux-bg border border-text-main/5 text-text-muted/60 hover:text-text-main hover:bg-text-main/5 text-[10px] font-black uppercase tracking-widest transition-all"
                >
                  {tFn('close')}
                </button>
                <button 
                  onClick={() => confirm('Wipe data? (No history recorded)') && deletePosition(position.id)}
                  className="px-4 bg-aux-bg border border-text-main/5 text-text-muted/20 hover:text-status-danger hover:bg-status-danger/5 transition-all"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
