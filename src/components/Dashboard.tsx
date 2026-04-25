import * as React from 'react';
import { DEFAULT_CONTROL, DEFAULT_SETTINGS, useAppStore } from '../store/useAppStore';
import { AlertCircle, Ban, Shield, Zap } from 'lucide-react';

export function Dashboard() {
  const { control, settings, playSound } = useAppStore();
  const translator = useAppStore((state) => state.t);
  const t = typeof translator === 'function' ? translator() : ((key: string) => key);
  const safeControl = control ?? DEFAULT_CONTROL;
  const safeSettings = settings ?? DEFAULT_SETTINGS;
  const cooldowns = safeControl.cooldowns ?? {};
  const [activeCooldowns, setActiveCooldowns] = React.useState<string[]>([]);

  React.useEffect(() => {
    const now = new Date();
    const active = Object.entries(cooldowns)
      .filter(([_, endStr]) => new Date(endStr) > now)
      .map(([coin]) => coin);
    setActiveCooldowns(active);
  }, [cooldowns]);

  React.useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const currentlyActive = Object.entries(cooldowns)
        .filter(([_, endStr]) => new Date(endStr) > now)
        .map(([coin]) => coin);
      
      const finished = activeCooldowns.filter(coin => !currentlyActive.includes(coin));
      
      if (finished.length > 0) {
        playSound('notify');
      }
      
      if (JSON.stringify(currentlyActive) !== JSON.stringify(activeCooldowns)) {
        setActiveCooldowns(currentlyActive);
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [cooldowns, activeCooldowns, playSound]);

  const isTradeLocked = Boolean(safeControl.isInputDisabled);
  const tradeCountPercent = safeSettings.maxDailyTrades > 0
    ? ((safeControl.todayTradeCount ?? 0) / safeSettings.maxDailyTrades) * 100
    : 0;
  
  return (
    <div className="space-y-12 transition-all duration-300">
      <div className="grid md:grid-cols-2 gap-12 bg-card-bg border border-text-main/5 p-8 md:p-12 relative overflow-hidden">
        <div className="relative z-10">
          <h2 className={`text-6xl md:text-8xl font-black mb-6 tracking-tighter leading-none italic ${isTradeLocked ? 'text-status-danger' : 'text-text-main'}`}>
            {isTradeLocked ? t('system_locked') : t('system_ready')}
          </h2>
          <div className="space-y-4 max-w-sm">
            <p className="text-text-muted text-xs font-mono uppercase tracking-widest leading-relaxed">
              {isTradeLocked 
                ? 'Daily trade limit exceeded. Strategy locked to prevent emotional execution. Resets at 00:00:00.' 
                : 'Decision engine operational. All protective rules are active. Emotional filter set to maximum.'}
            </p>
            
            {isTradeLocked && (
              <div className="inline-flex items-center gap-2 border border-status-danger text-status-danger px-6 py-3 font-black text-xs uppercase tracking-widest bg-status-danger/5">
                <Ban size={16} />
                <span>Go Home - Limit Reached</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col justify-end gap-10">
          <div className="grid grid-cols-2 gap-8">
            <div>
              <div className="text-[11px] uppercase tracking-widest text-text-muted/40 font-bold mb-2 font-mono">Daily Trades</div>
              <div className="text-6xl font-black tabular-nums tracking-tighter leading-none text-text-main">
                {String(safeControl.todayTradeCount ?? 0).padStart(2, '0')}
                <span className="text-text-muted/20">/</span>
                {String(safeSettings.maxDailyTrades ?? 0).padStart(2, '0')}
              </div>
              <div className="mt-4 h-1 w-full bg-text-main/5">
                <div 
                  style={{ width: `${Math.min(100, tradeCountPercent)}%` }}
                  className={`h-full transition-all duration-500 ${tradeCountPercent >= 100 ? 'bg-status-danger' : 'bg-status-safe'}`}
                />
              </div>
            </div>
            
            <div>
              <div className="text-[11px] uppercase tracking-widest text-text-muted/40 font-bold mb-2 font-mono">Cons. Losses</div>
              <div className="text-6xl font-black tabular-nums tracking-tighter leading-none text-status-danger">
                {String(safeControl.consecutiveLossCount ?? 0).padStart(2, '0')}
              </div>
              <div className="text-[9px] text-text-muted/40 mt-2 font-mono uppercase tracking-widest">Locked if reach {safeSettings.maxConsecutiveLosses ?? 0}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-1 bg-text-main/10 border border-text-main/10">
        <div className="bg-card-bg p-8">
          <div className="text-status-safe mb-6 flex items-center gap-2">
            <Zap size={16} />
            <span className="text-[10px] font-black uppercase tracking-widest">Philosophy</span>
          </div>
          <p className="text-xl font-black leading-tight tracking-tight uppercase text-text-main">Capital preservation over profit maximization.</p>
        </div>
        <div className="bg-card-bg p-8">
          <div className="text-[#3b82f6] mb-6 flex items-center gap-2">
            <Shield size={16} className="text-[#3b82f6]" />
            <span className="text-[10px] font-black uppercase tracking-widest">Protection</span>
          </div>
          <p className="text-xl font-black leading-tight tracking-tight uppercase text-text-main">Mandatory SL lift to break-even at +3% gain.</p>
        </div>
        <div className="bg-card-bg p-8">
          <div className="text-status-danger mb-6 flex items-center gap-2">
            <AlertCircle size={16} />
            <span className="text-[10px] font-black uppercase tracking-widest">Isolation</span>
          </div>
          <p className="text-xl font-black leading-tight tracking-tight uppercase text-text-main">System restricts execution on tilt detection.</p>
        </div>
      </div>
    </div>
  );
}
