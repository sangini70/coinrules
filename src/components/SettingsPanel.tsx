import * as React from 'react';
import { useEffect, useState } from 'react';
import { DEFAULT_SETTINGS, useAppStore } from '../store/useAppStore';

export function SettingsPanel() {
  const { settings, updateSettings, exportData, importData, resetAll, t } = useAppStore();
  const tFn = typeof t === 'function' ? t() : ((key: string) => key);
  const safeSettings = settings ?? DEFAULT_SETTINGS;
  const [localSettings, setLocalSettings] = useState(safeSettings);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    setLocalSettings(safeSettings);
  }, [safeSettings]);

  const handleSave = () => {
    updateSettings(localSettings);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleExport = () => {
    const data = exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const json = event.target?.result as string;
      if (importData(json)) {
        alert(tFn('config_saved'));
        window.location.reload();
      } else {
        alert('Restore failed');
      }
    };
    reader.readAsText(file);
  };

  const handleReset = () => {
    if (confirm(tFn('reset_confirm'))) {
      resetAll();
      window.location.reload();
    }
  };

  return (
    <div className="space-y-12 transition-all duration-300">
      <section className="bg-card-bg border border-text-main/5 p-10 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-6">
          <div>
            <h3 className="text-4xl font-black uppercase tracking-tight mb-2 text-text-main">{tFn('strategy_config')}</h3>
            <p className="text-text-muted/30 text-[10px] font-mono uppercase tracking-[0.3em] font-bold">{tFn('input_active')}</p>
          </div>
          
          <div className="flex items-center gap-4">
             {/* THEME TOGGLE */}
             <div className="flex bg-aux-bg p-1 border border-text-main/10">
                <button 
                  onClick={() => updateSettings({ theme: 'light' })}
                  className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${safeSettings.theme === 'light' ? 'bg-text-main text-main-bg' : 'text-text-muted hover:text-text-main'}`}
                >
                  Light
                </button>
                <button 
                  onClick={() => updateSettings({ theme: 'dark' })}
                  className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${safeSettings.theme === 'dark' ? 'bg-text-main text-main-bg' : 'text-text-muted hover:text-text-main'}`}
                >
                  Dark
                </button>
             </div>

            <button 
              onClick={handleSave}
              className={`px-10 py-5 font-black uppercase text-xs tracking-[0.2em] transition-all shadow-sm ${isSaved ? 'bg-status-safe text-white' : 'bg-text-main text-main-bg active:scale-[0.98]'}`}
            >
              {isSaved ? tFn('config_saved') : tFn('commit_changes')}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
          <div className="space-y-3">
            <label className="text-[10px] font-black text-text-muted/40 uppercase tracking-[0.2em] block px-1">{tFn('stop')} (%)</label>
            <input 
              type="number" 
              value={localSettings.stopLossPercent} 
              onChange={e => setLocalSettings({...localSettings, stopLossPercent: Number(e.target.value)})}
              className="w-full bg-aux-bg border border-text-main/5 p-4 font-black text-xl text-status-danger focus:border-status-danger/40 outline-none transition-all"
            />
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black text-text-muted/40 uppercase tracking-[0.2em] block px-1">{tFn('take')} (%)</label>
            <input 
              type="number" 
              value={localSettings.takeProfitPercent} 
              onChange={e => setLocalSettings({...localSettings, takeProfitPercent: Number(e.target.value)})}
              className="w-full bg-aux-bg border border-text-main/5 p-4 font-black text-xl text-status-safe focus:border-status-safe/40 outline-none transition-all"
            />
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black text-text-muted/40 uppercase tracking-[0.2em] block px-1">{tFn('daily_trades')}</label>
            <input 
              type="number" 
              value={localSettings.maxDailyTrades} 
              onChange={e => setLocalSettings({...localSettings, maxDailyTrades: Number(e.target.value)})}
              className="w-full bg-aux-bg border border-text-main/5 p-4 font-black text-xl text-text-main outline-none focus:border-text-muted/10"
            />
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black text-text-muted/40 uppercase tracking-[0.2em] block px-1">{tFn('consecutive_losses')}</label>
            <input 
              type="number" 
              value={localSettings.maxConsecutiveLosses} 
              onChange={e => setLocalSettings({...localSettings, maxConsecutiveLosses: Number(e.target.value)})}
              className="w-full bg-aux-bg border border-text-main/5 p-4 font-black text-xl text-text-main outline-none focus:border-text-muted/10"
            />
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black text-text-muted/40 uppercase tracking-[0.2em] block px-1">{tFn('cooldown')} (MIN)</label>
            <input 
              type="number" 
              value={localSettings.cooldownMinutes} 
              onChange={e => setLocalSettings({...localSettings, cooldownMinutes: Number(e.target.value)})}
              className="w-full bg-aux-bg border border-text-main/5 p-4 font-black text-xl text-text-main outline-none focus:border-text-muted/10"
            />
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black text-text-muted/40 uppercase tracking-[0.2em] block px-1">{tFn('protected')} (%)</label>
            <input 
              type="number" 
              value={localSettings.breakevenTriggerPercent} 
              onChange={e => setLocalSettings({...localSettings, breakevenTriggerPercent: Number(e.target.value)})}
              className="w-full bg-aux-bg border border-text-main/5 p-4 font-black text-xl text-[#3b82f6]/80 focus:border-[#3b82f6]/40 outline-none transition-all"
            />
          </div>
        </div>
      </section>

      {/* AUDIO SETTINGS */}
      <section className="bg-card-bg border border-text-main/5 p-10 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-6">
          <div>
            <h3 className="text-4xl font-black uppercase tracking-tight mb-2 text-text-main">{tFn('settings_sound')}</h3>
            <p className="text-text-muted/30 text-[10px] font-mono uppercase tracking-[0.3em] font-bold">{tFn('enable_sound_desc')}</p>
          </div>
          
          {/* [6] 긴급 정지 (Master Mute) */}
          <button 
            type="button"
            onClick={() => setLocalSettings({...localSettings, masterMute: !localSettings.masterMute})}
            className={`px-6 py-4 font-black uppercase text-[10px] tracking-widest border transition-all ${localSettings.masterMute ? 'bg-status-danger text-white border-status-danger' : 'border-text-main/10 text-text-muted hover:border-text-main hover:text-text-main'}`}
          >
            {localSettings.masterMute ? 'MUTE ACTIVE' : tFn('master_mute')}
          </button>
        </div>

        <div className={`space-y-8 transition-all duration-500 ${localSettings.masterMute ? 'opacity-20 pointer-events-none grayscale' : 'opacity-100'}`}>
           {/* Enable Sound Master Toggle */}
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             <div className="flex items-center justify-between p-6 bg-aux-bg border border-text-main/5">
               <div>
                  <p className="text-[11px] font-black uppercase tracking-widest text-text-main">{tFn('enable_sound')}</p>
                  <p className="text-[9px] font-bold text-text-muted/40 uppercase tracking-tight mt-1">Audio Feedback</p>
               </div>
               <button 
                  type="button"
                  onClick={() => setLocalSettings({...localSettings, enableSound: !localSettings.enableSound})}
                  className={`w-14 h-8 transition-all relative ${localSettings.enableSound ? 'bg-status-safe' : 'bg-text-main/10'}`}
               >
                  <div className={`absolute top-1 w-6 h-6 bg-white transition-all ${localSettings.enableSound ? 'left-7' : 'left-1 shadow-sm'}`}></div>
               </button>
             </div>

             {/* [4] 모바일 진동 Toggle */}
             <div className="flex items-center justify-between p-6 bg-aux-bg border border-text-main/5">
               <div>
                  <p className="text-[11px] font-black uppercase tracking-widest text-text-main">{tFn('enable_vibration')}</p>
                  <p className="text-[9px] font-bold text-text-muted/40 uppercase tracking-tight mt-1">{tFn('vibration_desc')}</p>
               </div>
               <button 
                  type="button"
                  onClick={() => setLocalSettings({...localSettings, enableVibration: !localSettings.enableVibration})}
                  className={`w-14 h-8 transition-all relative ${localSettings.enableVibration ? 'bg-status-safe' : 'bg-text-main/10'}`}
               >
                  <div className={`absolute top-1 w-6 h-6 bg-white transition-all ${localSettings.enableVibration ? 'left-7' : 'left-1 shadow-sm'}`}></div>
               </button>
             </div>
           </div>

           {/* [5] Volume Control */}
           <div className={`p-6 bg-aux-bg border border-text-main/5 transition-opacity ${localSettings.enableSound ? 'opacity-100' : 'opacity-20 pointer-events-none'}`}>
              <div className="flex justify-between items-center mb-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-text-muted">{tFn('volume')}</p>
                <p className="text-xl font-black text-text-main font-mono">{localSettings.volume}%</p>
              </div>
              <input 
                type="range"
                min="0"
                max="100"
                step="5"
                value={localSettings.volume}
                onChange={e => setLocalSettings({...localSettings, volume: Number(e.target.value)})}
                className="w-full h-1 bg-text-main/10 appearance-none cursor-pointer accent-text-main [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-text-main"
              />
           </div>

           {/* Sub Options */}
           <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 transition-all duration-500 ${(localSettings.enableSound || localSettings.enableVibration) ? 'opacity-100' : 'opacity-20 pointer-events-none grayscale'}`}>
              <div className="p-6 bg-aux-bg border border-text-main/5 flex items-center justify-between">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-text-muted">{tFn('notify_sl_imminent')}</p>
                    <p className="text-[8px] font-medium text-text-muted/30 mt-1">{tFn('notify_sl_desc')}</p>
                </div>
                <input 
                  type="checkbox" 
                  checked={localSettings.notifyStopLoss}
                  onChange={e => setLocalSettings({...localSettings, notifyStopLoss: e.target.checked})}
                  className="w-5 h-5 accent-status-danger bg-text-main/5 border-text-main/10"
                />
              </div>

              <div className="p-6 bg-aux-bg border border-text-main/5 flex items-center justify-between">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-text-muted">{tFn('notify_cooldown_end')}</p>
                    <p className="text-[8px] font-medium text-text-muted/30 mt-1">{tFn('notify_cooldown_desc')}</p>
                </div>
                <input 
                  type="checkbox" 
                  checked={localSettings.notifyCooldown}
                  onChange={e => setLocalSettings({...localSettings, notifyCooldown: e.target.checked})}
                  className="w-5 h-5 accent-status-safe bg-text-main/5 border-text-main/10"
                />
              </div>
           </div>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-text-main/10 border border-text-main/10">
        <div className="bg-card-bg p-10">
           <h3 className="text-xl font-black mb-2 uppercase tracking-tight text-text-main">{tFn('database_ops')}</h3>
           <p className="text-text-muted/20 text-[10px] font-mono mb-8 uppercase tracking-widest font-bold">{tFn('backup')} / {tFn('restore')}</p>
           
           <div className="flex gap-2">
            <button 
              onClick={handleExport}
              className="flex-1 bg-aux-bg p-6 text-text-muted hover:text-text-main font-black uppercase text-[10px] tracking-widest hover:bg-text-main/5 transition-all border border-text-main/5"
            >
              {tFn('export_json')}
            </button>
            <label className="flex-1 bg-aux-bg p-6 text-text-muted hover:text-text-main font-black uppercase text-[10px] tracking-widest hover:bg-text-main/5 transition-all cursor-pointer text-center border border-text-main/5">
              {tFn('restore_json')}
              <input type="file" accept=".json" onChange={handleImport} className="hidden" />
            </label>
           </div>
        </div>

        <div className="bg-card-bg p-10">
           <h3 className="text-xl font-black text-status-danger mb-2 uppercase tracking-tight">{tFn('purge_all_data')}</h3>
           <p className="text-text-muted/20 text-[10px] font-mono mb-8 uppercase tracking-widest font-bold">{tFn('data_wipe_desc')}</p>
           
           <button 
            onClick={handleReset}
            className="w-full border border-status-danger/20 text-status-danger/60 p-6 font-black uppercase text-[10px] tracking-widest hover:bg-status-danger hover:text-white transition-all shadow-sm"
           >
            {tFn('wipe')}
           </button>
        </div>
      </div>
    </div>
  );
}
