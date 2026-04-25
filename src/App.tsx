import { useState, useEffect, ChangeEvent, useMemo, useRef } from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore, type PersistedAppState } from './store/useAppStore';
import { Layout } from './components/Layout';
import { PositionTabs, LongTermView } from './components/PositionTabs';
import { SettingsPanel } from './components/SettingsPanel';
import { PositionForm } from './components/PositionForm';
import {
  ShieldCheck,
  Download,
  Upload,
  Trash2,
  Loader2,
  LogIn,
  LogOut,
  Cloud,
  CloudOff,
  Lock,
} from 'lucide-react';
import { formatDate, formatPrice, formatCurrency } from './lib/utils';
import { motion } from 'motion/react';
import { auth, db, googleAuthProvider } from './lib/firebase';

const LOCAL_STORAGE_KEY = 'coin-rules-storage';

type ActiveTab = 'positions' | 'history' | 'long_term' | 'settings';
type CloudStatus = 'idle' | 'loading' | 'saving' | 'synced' | 'error';
type AuthErrorType = 'auth' | 'sync' | null;

const readLocalPersistedState = (): Partial<PersistedAppState> | null => {
  if (typeof window === 'undefined') return null;

  const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    const state = parsed?.state;
    if (!state || typeof state !== 'object') return null;

    return {
      settings: state.settings,
      activePositions: state.activePositions,
      history: state.history,
      control: state.control,
      language: state.language,
    };
  } catch (error) {
    console.warn('Failed to parse local backup state.', error);
    return null;
  }
};

const serializeSnapshot = (snapshot: PersistedAppState) => JSON.stringify(snapshot);

const saveSnapshotToFirestore = async (
  userId: string,
  snapshot: PersistedAppState,
  options?: { migratedFromLocalStorage?: boolean },
) => {
  await setDoc(doc(db, 'users', userId), {
    appState: snapshot,
    updatedAt: serverTimestamp(),
    migratedFromLocalStorage: options?.migratedFromLocalStorage ?? false,
  }, { merge: true });
};

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('positions');
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [cloudStatus, setCloudStatus] = useState<CloudStatus>('idle');
  const [authError, setAuthError] = useState<AuthErrorType>(null);
  const [cloudReady, setCloudReady] = useState(false);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSyncedSnapshotRef = useRef('');

  const {
    control,
    settings,
    checkControlReset,
    language,
    setLanguage,
    exportData,
    importData,
    resetAll,
    applyAppStateSnapshot,
  } = useAppStore();
  const t = useAppStore((state) => state.t)();
  const persistedSnapshot = useAppStore(
    useShallow((state): PersistedAppState => ({
      settings: state.settings,
      activePositions: state.activePositions,
      history: state.history,
      control: state.control,
      language: state.language,
    })),
  );

  const serializedPersistedSnapshot = useMemo(
    () => serializeSnapshot(persistedSnapshot),
    [persistedSnapshot],
  );

  const authText = useMemo(
    () =>
      language === 'ko'
        ? {
            loginTitle: 'Google 로그인',
            loginDescription: '로그인 후 포지션, 설정, 거래 기록이 사용자 계정별로 Firestore에 저장됩니다.',
            loginButton: 'Google로 로그인',
            logoutButton: '로그아웃',
            loginRequired: '로그인 후 앱 주요 기능을 사용할 수 있습니다.',
            emailLabel: '로그인 계정',
            loading: '로그인 상태를 확인하는 중입니다.',
            cloudLoading: '클라우드 데이터 불러오는 중',
            cloudSaving: '클라우드 저장 중',
            cloudSynced: '클라우드 동기화 완료',
            cloudError: '클라우드 동기화 오류',
            authError: 'Google 로그인에 실패했습니다. 잠시 후 다시 시도하세요.',
            syncError: '클라우드 데이터 동기화에 실패했습니다. 새로고침 후 다시 시도하세요.',
            featureLock: '로그인 전에는 포지션 입력과 설정 변경이 잠깁니다.',
          }
        : {
            loginTitle: 'Google Sign In',
            loginDescription: 'After signing in, positions, settings, and trade history are stored per user in Firestore.',
            loginButton: 'Sign in with Google',
            logoutButton: 'Sign out',
            loginRequired: 'Sign in to unlock the main app features.',
            emailLabel: 'Signed in as',
            loading: 'Checking your sign-in status.',
            cloudLoading: 'Loading cloud data',
            cloudSaving: 'Saving to cloud',
            cloudSynced: 'Cloud synced',
            cloudError: 'Cloud sync failed',
            authError: 'Google sign-in failed. Please try again.',
            syncError: 'Cloud sync failed. Refresh and try again.',
            featureLock: 'Position input and settings stay locked until you sign in.',
          },
    [language],
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme);
  }, [settings.theme]);

  useEffect(() => {
    if (!authUser) return;

    checkControlReset();
    const interval = setInterval(checkControlReset, 60000);
    return () => clearInterval(interval);
  }, [authUser, checkControlReset]);

  useEffect(
    () => () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    },
    [],
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

      setAuthLoading(true);
      setAuthError(null);
      setCloudReady(false);

      if (!user) {
        setAuthUser(null);
        setCloudStatus('idle');
        lastSyncedSnapshotRef.current = '';
        setAuthLoading(false);
        return;
      }

      setAuthUser(user);
      setCloudStatus('loading');

      try {
        const appStateRef = doc(db, 'users', user.uid);
        const snapshot = await getDoc(appStateRef);

        if (snapshot.exists() && snapshot.data()?.appState) {
          applyAppStateSnapshot(snapshot.data().appState as Partial<PersistedAppState>);
        } else {
          const localBackup = readLocalPersistedState();
          if (localBackup) {
            applyAppStateSnapshot(localBackup);
            const migratedSnapshot = useAppStore.getState().getAppStateSnapshot();
            await saveSnapshotToFirestore(user.uid, migratedSnapshot, { migratedFromLocalStorage: true });
          }
        }

        lastSyncedSnapshotRef.current = serializeSnapshot(useAppStore.getState().getAppStateSnapshot());
        setCloudStatus('synced');
      } catch (error) {
        console.error('Failed to restore app state from Firestore.', error);
        setCloudStatus('error');
        setAuthError('sync');
      } finally {
        setCloudReady(true);
        setAuthLoading(false);
      }
    });

    return () => unsubscribe();
  }, [applyAppStateSnapshot]);

  useEffect(() => {
    if (!authUser || !cloudReady || authLoading) return;
    if (serializedPersistedSnapshot === lastSyncedSnapshotRef.current) return;

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    setCloudStatus('saving');

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await saveSnapshotToFirestore(authUser.uid, persistedSnapshot as PersistedAppState);
        lastSyncedSnapshotRef.current = serializedPersistedSnapshot;
        setCloudStatus('synced');
        setAuthError(null);
      } catch (error) {
        console.error('Failed to sync app state to Firestore.', error);
        setCloudStatus('error');
        setAuthError('sync');
      }
    }, 800);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [authUser, cloudReady, authLoading, persistedSnapshot, serializedPersistedSnapshot]);

  const isBlocked = control.isInputDisabled;

  const cloudStatusMeta =
    cloudStatus === 'loading'
      ? { label: authText.cloudLoading, icon: Loader2, className: 'text-blue-500 border-blue-500/20 bg-blue-500/5 animate-pulse' }
      : cloudStatus === 'saving'
        ? { label: authText.cloudSaving, icon: Loader2, className: 'text-blue-500 border-blue-500/20 bg-blue-500/5 animate-pulse' }
        : cloudStatus === 'error'
          ? { label: authText.cloudError, icon: CloudOff, className: 'text-status-danger border-status-danger/20 bg-status-danger/5' }
          : { label: authText.cloudSynced, icon: Cloud, className: 'text-status-safe border-status-safe/20 bg-status-safe/5' };

  const handleGoogleLogin = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleAuthProvider);
    } catch (error) {
      console.error('Google login failed.', error);
      setAuthError('auth');
    }
  };

  const handleLogout = async () => {
    try {
      if (authUser && cloudReady) {
        const currentSnapshot = useAppStore.getState().getAppStateSnapshot();
        const serializedCurrent = serializeSnapshot(currentSnapshot);

        if (serializedCurrent !== lastSyncedSnapshotRef.current) {
          await saveSnapshotToFirestore(authUser.uid, currentSnapshot as PersistedAppState);
          lastSyncedSnapshotRef.current = serializedCurrent;
        }
      }

      await signOut(auth);
    } catch (error) {
      console.error('Logout failed.', error);
      setAuthError('sync');
    }
  };

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
    reader.onload = (event) => {
      const content = event.target?.result as string;
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
            <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-none text-text-main uppercase border-l-4 border-text-main pl-4">
              {t('app_name')}
            </h1>
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

          <div className="flex flex-col items-start lg:items-end gap-3 w-full lg:w-auto">
            {authUser ? (
              <>
                <div className={`px-4 py-2 border text-[10px] font-black uppercase tracking-[0.18em] flex items-center gap-2 ${cloudStatusMeta.className}`}>
                  <cloudStatusMeta.icon size={14} className={cloudStatusMeta.icon === Loader2 ? 'animate-spin' : ''} />
                  <span>{cloudStatusMeta.label}</span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-[11px] font-bold text-text-muted/70">
                  <span>{authText.emailLabel}</span>
                  <span className="text-text-main">{authUser.email}</span>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="px-4 py-3 bg-aux-bg border border-text-main/5 text-text-muted/60 hover:text-text-main hover:bg-text-main/5 text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                >
                  <LogOut size={14} />
                  {authText.logoutButton}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={authLoading}
                className="px-4 py-3 bg-text-main text-main-bg hover:opacity-90 disabled:opacity-60 text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
              >
                {authLoading ? <Loader2 size={14} className="animate-spin" /> : <LogIn size={14} />}
                {authText.loginButton}
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto px-8 py-10">
        {authLoading ? (
          <div className="min-h-[60vh] flex items-center justify-center">
            <div className="bg-card-bg border border-text-main/5 p-10 max-w-xl w-full text-center space-y-4">
              <Loader2 size={28} className="animate-spin mx-auto text-text-main" />
              <h2 className="text-2xl font-black tracking-tight text-text-main uppercase">{authText.loginTitle}</h2>
              <p className="text-sm text-text-muted/60 leading-relaxed">{authText.loading}</p>
            </div>
          </div>
        ) : !authUser ? (
          <div className="min-h-[60vh] flex items-center justify-center">
            <div className="bg-card-bg border border-text-main/5 p-10 max-w-xl w-full space-y-6">
              <div className="flex items-center gap-3 text-text-main">
                <Lock size={20} />
                <h2 className="text-2xl font-black tracking-tight uppercase">{authText.loginTitle}</h2>
              </div>
              <p className="text-sm text-text-muted/70 leading-relaxed">{authText.loginDescription}</p>
              <p className="text-xs text-text-muted/50 uppercase tracking-[0.18em] font-bold">{authText.featureLock}</p>
              {authError && (
                <p className="text-sm text-status-danger font-bold">
                  {authError === 'auth' ? authText.authError : authText.syncError}
                </p>
              )}
              <button
                type="button"
                onClick={handleGoogleLogin}
                className="w-full px-4 py-4 bg-text-main text-main-bg hover:opacity-90 text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
              >
                <LogIn size={14} />
                {authText.loginButton}
              </button>
              <p className="text-xs text-text-muted/50 leading-relaxed">{authText.loginRequired}</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            <aside className="lg:col-span-4 xl:col-span-3 space-y-8">
              <div className="bg-card-bg border border-text-main/5 p-8 space-y-6">
                <div className="flex items-center gap-2 mb-2">
                  <ShieldCheck size={16} className="text-status-safe" />
                  <h2 className="text-xl font-black tracking-tighter uppercase">{t('new_execution')}</h2>
                </div>
                <PositionForm />
              </div>

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

            <main className="lg:col-span-8 xl:col-span-9 space-y-8">
              {authError && (
                <div className="border border-status-danger/20 bg-status-danger/5 px-4 py-3 text-sm font-bold text-status-danger">
                  {authError === 'auth' ? authText.authError : authText.syncError}
                </div>
              )}

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

              <footer className="mt-20 pt-10 border-t border-text-main/10 pb-20">
                <div className="max-w-2xl">
                  <p className="text-sm font-black uppercase tracking-tight text-text-muted/60 mb-2">{t('philosophy_title')}</p>
                  <p className="text-xs text-text-muted/30 font-medium leading-relaxed">{t('philosophy_desc')}</p>
                </div>
              </footer>
            </main>
          </div>
        )}
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
        <span className="text-[9px] font-mono text-text-muted/40 uppercase tracking-[0.2em] font-bold">
          {history.length} {translator('records_found')}
        </span>
      </div>

      {history.length === 0 ? (
        <div className="bg-aux-bg border border-[#1A1A1A] p-24 text-center">
          <p className="text-text-muted/10 font-black uppercase tracking-[0.4em] text-3xl">{translator('no_records')}</p>
        </div>
      ) : (
        <div className="grid gap-px bg-text-main/5 border border-text-main/5">
          <div className="bg-aux-bg p-4 grid grid-cols-3 md:grid-cols-4 text-[9px] font-black uppercase tracking-widest text-text-muted/30">
            <div>{translator('date')}</div>
            <div>{translator('coin')}</div>
            <div className="md:col-span-2">{translator('result')}</div>
          </div>

          {history.map((item) => (
            <div key={item.id} className="bg-card-bg p-8 relative overflow-hidden group border-t border-text-main/5">
              <div
                className={`absolute left-0 top-0 bottom-0 w-1 ${
                  item.resultType === 'take_profit'
                    ? 'bg-status-safe'
                    : item.resultType === 'stop_loss'
                      ? 'bg-status-danger'
                      : 'bg-text-main/5'
                }`}
              ></div>

              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
                <div>
                  <div className="flex items-center gap-4 mb-2">
                    <span className="text-4xl font-black tracking-tight text-text-main">{item.coin.replace('KRW-', '')}</span>
                    <span
                      className={`text-[9px] px-3 py-1 font-black uppercase tracking-widest border ${
                        item.type === 'short_term'
                          ? 'border-status-safe/20 text-status-safe'
                          : 'border-purple-600/20 text-purple-600'
                      }`}
                    >
                      {item.type === 'short_term' ? translator('shortTerm') : translator('longTerm')}
                    </span>
                  </div>
                  <p className="text-[9px] font-mono text-text-muted/40 uppercase tracking-widest font-bold">{formatDate(item.date)}</p>
                </div>

                <div
                  className={`px-6 py-2 border text-[10px] font-black uppercase tracking-[0.2em] ${
                    item.resultType === 'take_profit'
                      ? 'border-status-safe/30 text-status-safe bg-status-safe/5'
                      : item.resultType === 'stop_loss'
                        ? 'border-status-danger/30 text-status-danger bg-status-danger/5'
                        : 'border-text-main/5 text-text-muted/40'
                  }`}
                >
                  {item.resultType === 'take_profit'
                    ? translator('result_profit')
                    : item.resultType === 'stop_loss'
                      ? translator('result_loss')
                      : item.resultType === 'manual_exit'
                        ? translator('result_manual')
                        : translator('result_time')}
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
