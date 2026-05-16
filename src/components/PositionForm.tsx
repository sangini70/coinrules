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
  console.log("[SIGNALS_KEYS]", Object.keys(storeSignals || {}));
  const signalKeys = Object.keys(storeSignals || {});
  const firstSignalKey = signalKeys[0];
  console.log("[FIRST_SIGNAL_KEY]", firstSignalKey);

  if (!firstSignalKey) {
    return (
      <div className="p-4">
        EMPTY_SIGNAL_SAFE
      </div>
    );
  }

  const firstSignal = storeSignals[firstSignalKey];

  console.log("[FIRST_SIGNAL]", firstSignal);
  const firstSignalType = firstSignal?.type;
  const firstSignalEntries = Object.entries(firstSignal || {});
  const entryKeys = firstSignalEntries.map(([key]) => key);
  const firstEntryValue = firstSignalEntries[0]?.[1];

  console.log("[FIRST_SIGNAL_TYPE]", firstSignalType);
  console.log("[FIRST_SIGNAL_ENTRIES]", firstSignalEntries);
  console.log("[ENTRY_KEYS]", entryKeys);
  console.log("[FIRST_ENTRY_VALUE]", firstEntryValue);
  console.log(
    "[REASONS_ITEM_TYPES]",
    Array.isArray(firstSignal?.reasons)
      ? firstSignal.reasons.map((item) => typeof item)
      : [],
  );
  console.log("[FIRST_SIGNAL_KEYS]", firstSignal ? Object.keys(firstSignal) : []);
  console.log("[FIRST_SIGNAL_RAW]", firstSignal);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold">POSITIONFORM_ISOLATE</h1>
      <p className="text-sm text-gray-500">STATIC_BLOCK_OK</p>
      <div className="mt-4 rounded border p-2">TAILWIND_BLOCK_OK</div>
      <div className="mt-4">STATE_OK_{count}</div>
      <div className="mt-4">EFFECT_OK</div>
      <div className="mt-4">STORE_SELECTOR_OK</div>
      <div className="mt-4">SIGNALS_SELECTOR_OK</div>
      <div className="mt-4 rounded border p-2">
        SIGNAL_SUMMARY_{String(firstSignalType)}
      </div>
      <div className="mt-4">SIGNAL_MARKET_{String(firstSignal?.market)}</div>
      <div className="mt-4">SIGNAL_ACTION_{String(firstSignal?.action)}</div>
      <div className="mt-4">SIGNAL_SCORE_{String(firstSignal?.score)}</div>
      <div className="mt-4">SIGNAL_REASON_{String(firstSignal?.reason)}</div>
      <div className="mt-4">
        SIGNAL_REASONS_COUNT_
        {Array.isArray(firstSignal?.reasons) ? firstSignal.reasons.length : 0}
      </div>
      <div className="mt-4">FIRST_SIGNAL_KEY_{String(firstSignalKey)}</div>
      <div className="mt-4">FIRST_SIGNAL_TYPE_{String(firstSignalType)}</div>
      <div className="mt-4">ENTRY_KEYS_COUNT_{entryKeys.length}</div>
      <div className="mt-4">FIRST_ENTRY_VALUE_TYPE_{typeof firstEntryValue}</div>
    </div>
  );
}
