import { useEffect, useState } from 'react';
import { useAppStore } from '../store/useAppStore';

export function PositionForm() {
  const [stage, setStage] = useState('POSITIONFORM_STAGE2');
  const storeSignals = useAppStore((state) => state.signals);

  useEffect(() => {
    setStage('POSITIONFORM_STAGE3');
  }, []);

  console.log(storeSignals);

  return <div>{stage}</div>;
}
