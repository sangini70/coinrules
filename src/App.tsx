import { useState, useEffect, ChangeEvent } from 'react';
import { useAppStore } from './store/useAppStore';
import { Layout } from './components/Layout';
import { PositionTabs, LongTermView } from './components/PositionTabs';
import { SettingsPanel } from './components/SettingsPanel';
import { PositionForm } from './components/PositionForm';
import { ShieldCheck, Settings as SettingsIcon, LayoutDashboard, History, Download, Upload, Trash2, Globe } from 'lucide-react';
import { formatDate, formatPrice, formatCurrency } from './lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'positions' | 'history' | 'long_term' | 'settings'>('positions');
  const { control, settings, checkControlReset, language, setLanguage, exportData, importData, resetAll } = useAppStore();
  const t = useAppStore((state) => state.t)();

  useEffect(() => {
    checkControlReset();
    const interval = setInterval(checkControlReset, 60000); 
    return () => clearInterval(interval);
  }, [checkControlReset]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme);
  }, [settings.theme]);

  const isBlocked = control.isInputDisabled;

  const handleExport = () => {
    const data = exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `core-controller-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  const handleImport = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (importData(content)) {
        alert('Data restored successfully');
      } else {
        alert('Restore failed');
      }
    };
    reader.readAsText(file);
  };

  const handleWipe = () => {
    if (confirm(t('reset_confirm'))) {
      resetAll();
    }
  };

  return (
    <Layout>
      <header className="p-8 border-b border-text-main/10 bg-main-bg relative">
        <div className="max-w-[1400px] mx-auto flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 relative z-10">
          <div className="space-y-2">
            <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-none text-text-main uppercase border-l-4 border-text-main pl-4">{t('app_name')}</h1>
            <div className="flex flex-wrap gap-4 text-[10px] font-mono tracking-widest text-text-muted uppercase items-center pl-1">
              <span className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${isBlocked ? 'bg-status-danger' : 'bg-status-safe'}`}></span>
                {t('system_operational')}
              </span>
              <span className="text-text-muted/10">|</span>
              <span className={isBlocked ? 'text-status-danger font-bold' : 'text-status-safe opacity-80'}>
                {isBlocked ? t('input_blocked') : t('input_active')}
              </span>
              <span className="text-text-muted/10">|</span>
              <div className="flex gap-2">
                <button 
                  onClick={() => setLanguage('ko')}
                  className={`hover:text-text-main transition-colors px-1 ${language === 'ko' ? 'text-text-main font-bold underline underline-offset-4' : 'text-text-muted opacity-40'}`}
                >
                  KO
                </button>
                <span className="text-text-muted/10">/</span>
                <button 
                  onClick={() => setLanguage('en')}
                  className={`hover:text-text-main transition-colors px-1 ${language === 'en' ? 'text-text-main font-bold underline underline-offset-4' : 'text-text-muted opacity-40'}`}
                >
                  EN
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-8 md:gap-16">
            <div className="space-y-1">
              <div className="text-[9px] uppercase font-bold text-text-muted tracking-[0.2em]">{t('daily_trades')}</div>
              <div className="text-3xl font-black tabular-nums tracking-tighter leading-none text-text-muted/20">
                {String(control.todayTradeCount).padStart(2, '0')}
                <span className="text-text-muted/10 mx-2">/</span>
                <span className="text-text-main">{String(settings.maxDailyTrades).padStart(2, '0')}</span>
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-[9px] uppercase font-bold text-text-muted tracking-[0.2em]">{t('consecutive_losses')}</div>
              <div className="text-3xl font-black tabular-nums tracking-tighter leading-none text-text-muted/20">
                <span className={control.consecutiveLossCount > 0 ? 'text-status-danger' : 'text-text-muted/10'}>
                  {String(control.consecutiveLossCount).padStart(2, '0')}
                </span>
                <span className="text-text-muted/10 mx-2">/</span>
                <span className="text-text-main">{String(settings.maxConsecutiveLosses).padStart(2, '0')}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto px-8 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* LEFT: EXECUTION AREA */}
          <aside className="lg:col-span-4 xl:col-span-3 space-y-8">
            <div className="bg-card-bg border border-text-main/5 p-8 space-y-6">
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck size={16} className="text-status-safe" />
                <h2 className="text-xl font-black tracking-tighter uppercase">{t('new_execution')}</h2>
              </div>
              <PositionForm />
            </div>

            {/* ACTION BUTTONS (BACKUP/RESTORE) */}
            <div className="grid grid-cols-1 gap-2">
              <button 
                onClick={handleExport}
                className="w-full px-4 py-3 bg-aux-bg border border-text-main/5 text-text-muted/60 hover:text-text-main hover:bg-text-main/5 text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
              >
                <Download size={14} />
                 {t('backup')}
              </button>
              <div className="relative">
                <input 
                  type="file" 
                  accept=".json" 
                  onChange={handleImport} 
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <button className="w-full px-4 py-3 bg-aux-bg border border-text-main/5 text-text-muted/60 hover:text-text-main hover:bg-text-main/5 text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 pointer-events-none">
                  <Upload size={14} />
                  {t('restore')}
                </button>
              </div>
              <button 
                onClick={handleWipe}
                className="w-full px-4 py-3 bg-aux-bg border border-text-main/5 text-text-muted/20 hover:text-status-danger hover:bg-text-main/5 text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
              >
                <Trash2 size={14} />
                {t('wipe')}
              </button>
            </div>
          </aside>

          {/* RIGHT: TABS AND CONTENT */}
          <main className="lg:col-span-8 xl:col-span-9 space-y-8">
            <nav className="flex items-center gap-8 border-b border-text-main/10 overflow-x-auto pb-px no-scrollbar">
              <button 
                onClick={() => setActiveTab('positions')}
                className={`pb-4 text-2xl font-black uppercase tracking-tight transition-all whitespace-nowrap relative ${activeTab === 'positions' ? 'text-text-main' : 'text-text-muted/20 hover:text-text-muted/40'}`}
              >
                {t('active')}
                {activeTab === 'positions' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-1 bg-text-main/20" />}
              </button>
              <button 
                onClick={() => setActiveTab('history')}
                className={`pb-4 text-2xl font-black uppercase tracking-tight transition-all whitespace-nowrap relative ${activeTab === 'history' ? 'text-text-main' : 'text-text-muted/20 hover:text-text-muted/40'}`}
              >
                {t('history')}
                {activeTab === 'history' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-1 bg-text-main/20" />}
              </button>
              <button 
                onClick={() => setActiveTab('long_term')}
                className={`pb-4 text-2xl font-black uppercase tracking-tight transition-all whitespace-nowrap relative ${activeTab === 'long_term' ? 'text-text-main' : 'text-text-muted/20 hover:text-text-muted/40'}`}
              >
                {t('long_term')}
                {activeTab === 'long_term' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-1 bg-text-main/20" />}
              </button>
              <button 
                onClick={() => setActiveTab('settings')}
                className={`pb-4 text-2xl font-black uppercase tracking-tight transition-all whitespace-nowrap relative ${activeTab === 'settings' ? 'text-text-main' : 'text-text-muted/20 hover:text-text-muted/40'}`}
              >
                {t('config')}
                {activeTab === 'settings' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-1 bg-text-main/20" />}
              </button>
            </nav>

            <div className="min-h-[600px]">
              {activeTab === 'positions' && <PositionTabs />}
              {activeTab === 'history' && <TradeHistoryView />}
              {activeTab === 'long_term' && <LongTermView />}
              {activeTab === 'settings' && <SettingsPanel />}
            </div>

            {/* PHILOSOPHY FOOTER */}
            <footer className="mt-20 pt-10 border-t border-text-main/10 pb-20">
              <div className="max-w-2xl">
                <p className="text-sm font-black uppercase tracking-tight text-text-muted/60 mb-2">{t('philosophy_title')}</p>
                <p className="text-xs text-text-muted/30 font-medium leading-relaxed">{t('philosophy_desc')}</p>
              </div>
            </footer>
          </main>
        </div>
      </div>
    </Layout>
  );
}

function TradeHistoryView() {
  const { history, t } = useAppStore();
  const translator = t();

  return (
    <div className="space-y-10">
      <div className="flex items-end justify-between border-b border-text-main/10 pb-6">
        <h2 className="text-4xl font-black tracking-tight uppercase text-text-main">{translator('history')}</h2>
        <span className="text-[9px] font-mono text-text-muted/40 uppercase tracking-[0.2em] font-bold">{history.length} {translator('records_found')}</span>
      </div>

      {history.length === 0 ? (
        <div className="bg-aux-bg border border-[#1A1A1A] p-24 text-center">
          <p className="text-text-muted/10 font-black uppercase tracking-[0.4em] text-3xl">{translator('no_records')}</p>
        </div>
      ) : (
        <div className="grid gap-px bg-text-main/5 border border-text-main/5">
          {/* TABLE HEADER */}
          <div className="bg-aux-bg p-4 grid grid-cols-3 md:grid-cols-4 text-[9px] font-black uppercase tracking-widest text-text-muted/30">
            <div>{translator('date')}</div>
            <div>{translator('coin')}</div>
            <div className="md:col-span-2">{translator('result')}</div>
          </div>

          {history.map((item) => (
            <div key={item.id} className="bg-card-bg p-8 relative overflow-hidden group border-t border-text-main/5">
               <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                item.resultType === 'take_profit' ? 'bg-status-safe' :
                item.resultType === 'stop_loss' ? 'bg-status-danger' : 
                'bg-text-main/5'
              }`}></div>

              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
                <div>
                  <div className="flex items-center gap-4 mb-2">
                    <span className="text-4xl font-black tracking-tight text-text-main">{item.coin.replace('KRW-', '')}</span>
                    <span className={`text-[9px] px-3 py-1 font-black uppercase tracking-widest border ${item.type === 'short_term' ? 'border-status-safe/20 text-status-safe' : 'border-purple-600/20 text-purple-600'}`}>
                      {item.type === 'short_term' ? translator('shortTerm') : translator('longTerm')}
                    </span>
                  </div>
                  <p className="text-[9px] font-mono text-text-muted/40 uppercase tracking-widest font-bold">{formatDate(item.date)}</p>
                </div>
                
                <div className={`px-6 py-2 border text-[10px] font-black uppercase tracking-[0.2em] ${
                  item.resultType === 'take_profit' ? 'border-status-safe/30 text-status-safe bg-status-safe/5' :
                  item.resultType === 'stop_loss' ? 'border-status-danger/30 text-status-danger bg-status-danger/5' : 
                  'border-text-main/5 text-text-muted/40'
                }`}>
                  {item.resultType === 'take_profit' ? translator('result_profit') :
                   item.resultType === 'stop_loss' ? translator('result_loss') : 
                   item.resultType === 'manual_exit' ? translator('result_manual') : translator('result_time')}
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8 py-6 border-y border-text-main/5">
                <div>
                  <p className="text-[9px] text-text-muted/30 uppercase font-black tracking-widest mb-2">{translator('buy_price')}</p>
                  <p className="font-bold text-lg tabular-nums tracking-tight text-text-main/80">{formatPrice(item.buyPrice)}</p>
                </div>
                <div>
                  <p className="text-[9px] text-text-muted/30 uppercase font-black tracking-widest mb-2">{translator('sell_price')}</p>
                  <p className="font-bold text-lg tabular-nums tracking-tight text-text-main/80">{formatPrice(item.sellPrice)}</p>
                </div>
                <div>
                  <p className="text-[9px] text-text-muted/30 uppercase font-black tracking-widest mb-2">{translator('pnl_return')}</p>
                  <p className={`font-black text-xl tabular-nums tracking-tighter ${item.sellPrice > item.buyPrice ? 'text-status-safe' : 'text-status-danger'}`}>
                    {((item.sellPrice / item.buyPrice - 1) * 100).toFixed(2)}%
                  </p>
                </div>
                <div>
                  <p className="text-[9px] text-text-muted/30 uppercase font-black tracking-widest mb-2">{translator('net_pnl')}</p>
                  <p className={`font-black text-xl tabular-nums tracking-tighter ${item.sellPrice > item.buyPrice ? 'text-status-safe' : 'text-status-danger'}`}>
                    {formatCurrency((item.sellPrice - item.buyPrice) * item.quantity)}
                  </p>
                </div>
              </div>

              {item.reasonSell && (
                <div className="mt-8">
                  <p className="text-[9px] text-text-muted/30 uppercase font-black tracking-widest mb-2">{translator('reason_label')}</p>
                  <p className="text-xs text-text-muted/80 leading-relaxed italic">{item.reasonSell}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
