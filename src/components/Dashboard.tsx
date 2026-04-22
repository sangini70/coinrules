import * as React from 'react';
import { useAppStore } from '../store/useAppStore';
import { AlertCircle, Ban, Shield, ShieldCheck, TrendingUp, Zap } from 'lucide-react';
import { motion } from 'motion/react';

export function Dashboard() {
  const { control, settings, playSound } = useAppStore();
  const t = useAppStore((state) => state.t)();
  const [activeCooldowns, setActiveCooldowns] = React.useState<string[]>([]);

  // Initial populate to avoid alerting on mount if cooldowns are already expired
  React.useEffect(() => {
    const now = new Date();
    const active = Object.entries(control.cooldowns)
      .filter(([_, endStr]) => new Date(endStr) > now)
      .map(([coin]) => coin);
    setActiveCooldowns(active);
  }, []);

  // Cooldown Watcher
  React.useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const currentlyActive = Object.entries(control.cooldowns)
        .filter(([_, endStr]) => new Date(endStr) > now)
        .map(([coin]) => coin);
      
      const finished = activeCooldowns.filter(coin => !currentlyActive.includes(coin));
      
      if (finished.length > 0) {
        // Double check it was actually a real cooldown (not just deleted)
        // For simplicity, we just play notify sound
        playSound('notify');
      }
      
      if (JSON.stringify(currentlyActive) !== JSON.stringify(activeCooldowns)) {
        setActiveCooldowns(currentlyActive);
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [control.cooldowns, activeCooldowns, playSound]);

  const isTradeLocked = control.isInputDisabled;
  const tradeCountPercent = (control.todayTradeCount / settings.maxDailyTrades) * 100;
  
  return (
    <div className="space-y-12">
      <div className="grid md:grid-cols-2 gap-12 bg-[#0F0F0F] border border-[#222] p-8 md:p-12 relative overflow-hidden">
        <div className="relative z-10">
          <h2 className={`text-6xl md:text-8xl font-black mb-6 tracking-tighter leading-none italic ${isTradeLocked ? 'text-red-600' : 'text-white'}`}>
            {isTradeLocked ? t('system_locked') : t('system_ready')}
          </h2>
          <div className="space-y-4 max-w-sm">
            <p className="text-[#666] text-xs font-mono uppercase tracking-widest leading-relaxed">
              {isTradeLocked 
                ? 'Daily trade limit exceeded. Strategy locked to prevent emotional execution. Resets at 00:00:00.' 
                : 'Decision engine operational. All protective rules are active. Emotional filter set to maximum.'}
            </p>
            
            {isTradeLocked && (
              <div className="inline-flex items-center gap-2 border-2 border-red-600 text-red-600 px-6 py-3 font-black text-xs uppercase tracking-widest bg-red-600/5 shadow-[0_0_20px_rgba(220,38,38,0.2)]">
                <Ban size={16} />
                <span>Go Home - Limit Reached</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col justify-end gap-10">
          <div className="grid grid-cols-2 gap-8">
            <div>
              <div className="text-[11px] uppercase tracking-widest text-[#444] font-bold mb-2">Daily Trades</div>
              <div className="text-6xl font-black tabular-nums tracking-tighter leading-none">
                {String(control.todayTradeCount).padStart(2, '0')}
                <span className="text-[#222]">/</span>
                {String(settings.maxDailyTrades).padStart(2, '0')}
              </div>
              <div className="mt-4 h-1 w-full bg-[#1A1A1A]">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, tradeCountPercent)}%` }}
                  className={`h-full ${tradeCountPercent >= 100 ? 'bg-red-600' : 'bg-[#00FF41]'}`}
                />
              </div>
            </div>
            
            <div>
              <div className="text-[11px] uppercase tracking-widest text-[#444] font-bold mb-2">Cons. Losses</div>
              <div className="text-6xl font-black tabular-nums tracking-tighter leading-none text-red-600">
                {String(control.consecutiveLossCount).padStart(2, '0')}
              </div>
              <div className="text-[9px] text-[#444] mt-2 font-mono uppercase tracking-widest">Locked if reach {settings.maxConsecutiveLosses}</div>
            </div>
          </div>
        </div>
        
        {/* Neon corner accent */}
        <div className="absolute top-0 right-0 w-1 h-20 bg-[#00FF41]"></div>
        <div className="absolute top-0 right-0 h-1 w-20 bg-[#00FF41]"></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-1 px-1 bg-[#1A1A1A]">
        <div className="bg-[#0A0A0A] p-8 border border-[#222]">
          <div className="text-[#00FF41] mb-6 flex items-center gap-2">
            <Zap size={16} />
            <span className="text-[10px] font-black uppercase tracking-widest">Philosophy</span>
          </div>
          <p className="text-xl font-black leading-tight tracking-tight uppercase">Capital preservation over profit maximization.</p>
        </div>
        <div className="bg-[#0A0A0A] p-8 border border-[#222]">
          <div className="text-[#3b82f6] mb-6 flex items-center gap-2">
            <Shield size={16} className="text-[#3b82f6]" />
            <span className="text-[10px] font-black uppercase tracking-widest">Protection</span>
          </div>
          <p className="text-xl font-black leading-tight tracking-tight uppercase">Mandatory SL lift to break-even at +3% gain.</p>
        </div>
        <div className="bg-[#0A0A0A] p-8 border border-[#222]">
          <div className="text-red-600 mb-6 flex items-center gap-2">
            <AlertCircle size={16} />
            <span className="text-[10px] font-black uppercase tracking-widest">Isolation</span>
          </div>
          <p className="text-xl font-black leading-tight tracking-tight uppercase">System restricts execution on tilt detection.</p>
        </div>
      </div>
    </div>
  );
}
