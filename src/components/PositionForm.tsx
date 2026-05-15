import { useEffect, useState } from 'react';

export function PositionForm() {
  const [stage, setStage] = useState('POSITIONFORM_STAGE2');

  useEffect(() => {
    setStage('POSITIONFORM_STAGE3');
  }, []);

  return <div>{stage}</div>;
}
