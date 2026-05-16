import { useEffect, useState } from "react";
import { useAppStore } from "../store/useAppStore";

export default function PositionForm() {
  const [count] = useState(1);
  const testValue = useAppStore((state) => state);
  const storeSignals = useAppStore((state) => state.signals);
  const fetchSignals = useAppStore((state) => state.fetchSignals);

  useEffect(() => {
    console.log("[POSITIONFORM_EFFECT]");
  }, []);

  useEffect(() => {
    console.log("[FETCH_START]");
    void fetchSignals("KRW-BTC");
  }, [fetchSignals]);

  console.log("[POSITIONFORM_RENDER]");
  console.log("[STORE_OK]", testValue);
  console.log("[SIGNALS_RAW]", storeSignals);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold">POSITIONFORM_ISOLATE</h1>
      <p className="text-sm text-gray-500">STATIC_BLOCK_OK</p>
      <div className="mt-4 rounded border p-2">TAILWIND_BLOCK_OK</div>
      <div className="mt-4">STATE_OK_{count}</div>
      <div className="mt-4">EFFECT_OK</div>
      <div className="mt-4">STORE_SELECTOR_OK</div>
      <div className="mt-4">SIGNALS_SELECTOR_OK</div>
    </div>
  );
}
