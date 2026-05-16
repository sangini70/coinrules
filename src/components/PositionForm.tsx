import { useEffect, useState } from 'react';
import { useAppStore } from '../store/useAppStore';

export function PositionForm() {
  const [stage, setStage] = useState('POSITIONFORM_STAGE2');
  const storeSignals = useAppStore((state) => state.signals);
  console.log("[SIGNALS_RAW]", storeSignals);
  const entries = Object.entries(storeSignals ?? {}).slice(0, 3);
  console.log("[ENTRIES_SHAPE]", entries);

  useEffect(() => {
    setStage('POSITIONFORM_STAGE3');
  }, []);

  console.log(storeSignals);

  return (
    <div>
      {entries.map(([key, signal]) => (
        <div key={key}>
          {String(signal?.state)} {" | "} {String(signal?.trend)} {" | "} {String(signal?.volume)} {" | "} {String(signal?.breakout)}
        </div>
      ))}
    </div>
  );
}
