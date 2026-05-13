import { Component, isValidElement, useEffect, useState, type ChangeEvent, type ErrorInfo, type ReactNode } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AlertTriangle, Cloud, Download, ShieldCheck, Trash2, Upload } from 'lucide-react';
import { Layout } from './components/Layout';
import { ActionSignalPositionsView } from './components/ActionSignalPositionsView';
import { DecisionMode } from './components/DecisionMode';
import { TradeRecordsView } from './components/TradeRecordsView';
import { useDangerPositions, type DangerPosition } from './hooks/useDangerPositions';
import { LongTermView } from './components/PositionTabs';
import { PositionForm } from './components/PositionForm';
import { SettingsPanel } from './components/SettingsPanel';
import { DEFAULT_CONTROL, useAppStore } from './store/useAppStore';

type TabKey = 'positions' | 'history' | 'long_term' | 'settings';

// Debug-only boundary to capture React error #31 component stacks.
class React31Boundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('[REACT31_BOUNDARY]', error);
    console.error('[REACT31_BOUNDARY_STACK]', info.componentStack);
  }

  render() {
    const { children } = this.props;

    if (this.state.hasError) {
      return null;
    }

    console.log('[REACT31_BOUNDARY_CHILDREN]', {
      typeof: typeof children,
      isArray: Array.isArray(children),
      isValidElement: isValidElement(children as ReactNode),
      preview: children,
    });

    if (isValidElement(children as ReactNode)) {
      const element = children as React.ReactElement<{ children?: ReactNode }>;
      const elementChildren = element.props?.children;

      console.log('[REACT31_ELEMENT_PROPS]', {
        type: element.type,
        propsType: typeof element.props,
        propsKeys: element.props && typeof element.props === 'object' ? Object.keys(element.props) : [],
        childrenType: typeof elementChildren,
        childrenIsArray: Array.isArray(elementChildren),
        childrenIsValidElement: isValidElement(elementChildren as ReactNode),
      });

      if (Array.isArray(elementChildren)) {
        console.log(
          '[REACT31_ELEMENT_CHILDREN]',
          elementChildren.map((child, index) => ({
            index,
            typeof: typeof child,
            isValidElement: isValidElement(child as ReactNode),
            isArray: Array.isArray(child),
            objectKeys:
              child && typeof child === 'object' && !Array.isArray(child)
                ? Object.keys(child as Record<string, unknown>)
                : [],
          })),
        );
      }
    }

    const isRenderableNode = (value: unknown): value is ReactNode =>
      value == null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      isValidElement(value as ReactNode);

    if (Array.isArray(children)) {
      const safeChildren = children.filter(isRenderableNode);
      return safeChildren.length > 0 ? <>{safeChildren}</> : null;
    }

    if (
      children == null ||
      typeof children === 'string' ||
      typeof children === 'number' ||
      typeof children === 'boolean' ||
      isValidElement(children as ReactNode)
    ) {
      return children;
    }

    return null;
  }
}


function AppShell({
  children,
  positions,
  onSell,
}: {
  children: ReactNode;
  positions: DangerPosition[];
  onSell: (position: DangerPosition) => void;
}) {
  const [activeTab, setActiveTab] = useState<TabKey>('positions');
  const { control, exportData, importData, resetAll, setLanguage, language } = useAppStore();
  const t = useAppStore((state) => state.t)();
  const safeControl = control ?? DEFAULT_CONTROL;
  const text = (key: Parameters<typeof t>[0]) => String(t(key));
  const isRenderableNode = (value: unknown): value is ReactNode =>
    value == null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    isValidElement(value as ReactNode);
  const normalizedChildren = Array.isArray(children)
    ? children.filter(isRenderableNode)
    : isRenderableNode(children)
      ? children
      : null;

  const handleExport = () => {
    const data = exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `core-controller-backup-${new Date().toLocaleDateString('sv-SE')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (importData(content)) {
        window.location.reload();
      } else {
        alert('복원에 실패했습니다.');
      }
    };
    reader.readAsText(file);
  };

  const handleWipe = () => {
    if (confirm(text('reset_confirm'))) {
      resetAll();
    }
  };

  return (
    <Layout>
      <header className="w-full border-b border-gray-200 bg-white/80 px-6 py-8 relative lg:px-8">
        <div className="relative z-10 flex w-full flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <h1 className="border-l-4 border-gray-900 pl-4 text-4xl font-black leading-none tracking-tight uppercase text-gray-900 md:text-5xl">
              {text('app_name')}
            </h1>
            <div className="flex flex-wrap items-center gap-4 pl-1 text-[10px] font-mono uppercase tracking-widest text-gray-500">
              <span className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${safeControl.isInputDisabled ? 'bg-red-500' : 'bg-green-600'}`}></span>
                {safeControl.isInputDisabled ? text('input_blocked') : text('input_active')}
              </span>
              <span className="text-gray-300">|</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setLanguage('ko')}
                  className={`px-1 transition-colors hover:text-gray-900 ${language === 'ko' ? 'font-bold text-gray-900 underline underline-offset-4' : 'text-gray-400'}`}
                >
                  KO
                </button>
                <span className="text-gray-300">/</span>
                <button
                  onClick={() => setLanguage('en')}
                  className={`px-1 transition-colors hover:text-gray-900 ${language === 'en' ? 'font-bold text-gray-900 underline underline-offset-4' : 'text-gray-400'}`}
                >
                  EN
                </button>
              </div>
            </div>
          </div>

          <div className="flex w-full flex-col gap-3 lg:w-auto lg:items-end">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-green-600">
                <Cloud size={14} />
                {text('system_operational')}
              </span>
              <span className="flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-orange-500">
                <AlertTriangle size={14} />
                {safeControl.isInputDisabled ? text('input_blocked') : text('input_active')}
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] px-10 py-8">
        <div className="flex w-full gap-12">
          <aside className="w-[340px] flex-shrink-0 space-y-6">
            <div className="space-y-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-2 flex items-center gap-2">
                <ShieldCheck size={16} className="text-green-600" />
                <h2 className="text-xl font-black tracking-tighter uppercase">{text('new_execution')}</h2>
              </div>
              {normalizedChildren}
            </div>

            <div className="grid grid-cols-1 gap-2">
              <button
                onClick={handleExport}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-gray-700 transition-all hover:bg-gray-100 hover:text-gray-900"
              >
                <Download size={14} />
                {text('backup')}
              </button>
              <label className="relative flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-gray-700 transition-all hover:bg-gray-100 hover:text-gray-900">
                <Upload size={14} />
                {text('restore')}
                <input type="file" accept=".json" onChange={handleImport} className="absolute inset-0 cursor-pointer opacity-0" />
              </label>
              <button
                onClick={handleWipe}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-gray-400 transition-all hover:bg-red-50 hover:text-red-500"
              >
                <Trash2 size={14} />
                {text('wipe')}
              </button>
            </div>
          </aside>

          <main className="flex-1 min-w-0 space-y-6 pr-6 max-w-[960px]">
            <nav className="no-scrollbar flex items-center gap-8 overflow-x-auto border-b border-gray-200 pb-px">
              <button
                onClick={() => setActiveTab('positions')}
                className={`relative whitespace-nowrap pb-4 text-xl font-semibold uppercase tracking-tight transition-all ${activeTab === 'positions' ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
              >
                {text('active')}
                {activeTab === 'positions' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-900/20" />}
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`relative whitespace-nowrap pb-4 text-xl font-semibold uppercase tracking-tight transition-all ${activeTab === 'history' ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
              >
                {text('history')}
                {activeTab === 'history' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-900/20" />}
              </button>
              <button
                onClick={() => setActiveTab('long_term')}
                className={`relative whitespace-nowrap pb-4 text-xl font-semibold uppercase tracking-tight transition-all ${activeTab === 'long_term' ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
              >
                {text('long_term')}
                {activeTab === 'long_term' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-900/20" />}
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`relative whitespace-nowrap pb-4 text-xl font-semibold uppercase tracking-tight transition-all ${activeTab === 'settings' ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
              >
                {text('config')}
                {activeTab === 'settings' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-900/20" />}
              </button>
            </nav>

            <div className="min-h-[600px]">
              {activeTab === 'positions' && null}
              {activeTab === 'history' && <TradeRecordsView />}
              {activeTab === 'long_term' && <LongTermView />}
              {activeTab === 'settings' && <SettingsPanel />}
            </div>
          </main>
        </div>
      </div>
    </Layout>
  );
}

function NormalMode({
  positions,
  onSell,
}: {
  positions: DangerPosition[];
  onSell: (position: DangerPosition) => void;
}) {
  return (
    <BrowserRouter>
      <AppShell positions={positions} onSell={onSell}>
        <Routes>
          <Route path="/" element={null} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
}

export default function AppRoutes() {
  const activePositions = useAppStore((state) => state.activePositions);
  const settings = useAppStore((state) => state.settings);
  const positions = useDangerPositions(activePositions, settings);
  const [dangerLock, setDangerLock] = useState(false);
  const [dangerPositions, setDangerPositions] = useState<DangerPosition[]>([]);
  const closePosition = useAppStore((state) => state.closePosition);

  useEffect(() => {
    const hasDangerNow = positions.some((position) => position.isDangerCard);

    if (hasDangerNow) {
      setDangerLock(true);
      setDangerPositions((prevDangerPositions) => {
        const nextDangerPositions = positions.filter((position) => position.isDangerCard);
        const isSameDangerPositions =
          prevDangerPositions.length === nextDangerPositions.length &&
          prevDangerPositions.every((item, index) => item.id === nextDangerPositions[index]?.id);

        return isSameDangerPositions ? prevDangerPositions : nextDangerPositions;
      });
    }
  }, [positions]);

  const handleSell = (position: DangerPosition) => {
    const sellPrice = Number.isFinite(position.currentPrice) && position.currentPrice > 0 ? position.currentPrice : Number(position.buyPrice ?? 0);
    if (!Number.isFinite(sellPrice) || sellPrice <= 0) return;

    const resultType = position.isDangerCard ? 'stop_loss' : 'manual_exit';
    const reasonSell = position.isDangerCard ? '즉시 손절' : '매도 실행';
    closePosition(position.id, sellPrice, resultType, reasonSell);
    setDangerLock(false);
    setDangerPositions([]);
  };

  const dangerPosition = positions.find((position) => position.isDangerCard) ?? null;

  return (
    <React31Boundary>
      {dangerPosition ? null : null}
    </React31Boundary>
  );
}
