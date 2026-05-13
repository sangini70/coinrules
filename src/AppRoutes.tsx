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

  return <div>APPSHELL_ISOLATE</div>;
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
          <Route path="/" element={<div>ROUTE_ISOLATE</div>} />
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
      <div>BOUNDARY_TEST</div>
    </React31Boundary>
  );
}
