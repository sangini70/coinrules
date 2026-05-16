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
  console.log("[STORE_DEBUG] storeSignals", storeSignals);

  const signalKeys = Object.keys(storeSignals || {});
  const firstSignalKey = signalKeys[0];

  console.log("[FIRST_SIGNAL_KEY]", firstSignalKey);
  console.log("[STORE_DEBUG] signalsKeys", signalKeys);
  console.log("[STORE_DEBUG] firstSignalKey", firstSignalKey);
  console.log("[STORE_DEBUG] firstSignal", firstSignalKey ? storeSignals[firstSignalKey] : undefined);

  if (!firstSignalKey) {
    return (
      <div className="p-4">
        EMPTY_SIGNAL_SAFE
      </div>
    );
  }

  const firstSignal = storeSignals[firstSignalKey];

  console.log("[FIRST_SIGNAL]", firstSignal);
  console.log("[SIGNALS_DEBUG] signals", storeSignals);
  console.log("[SIGNALS_DEBUG] firstSignal", firstSignal);
  console.log("[SIGNALS_DEBUG] firstSignal keys", Object.keys(firstSignal || {}));
  console.log("[SIGNALS_DEBUG] firstSignal types", {
    state: typeof firstSignal?.state,
    trend: typeof firstSignal?.trend,
    market: typeof firstSignal?.market,
    action: typeof firstSignal?.action,
    score: typeof firstSignal?.score,
    reason: typeof firstSignal?.reason,
    volume: typeof firstSignal?.volume,
    breakout: typeof firstSignal?.breakout,
    updatedAt: typeof firstSignal?.updatedAt,
  });
  console.log("[REASONS_DEBUG] reasons", firstSignal?.reasons);
  console.log("[REASONS_DEBUG] reasons type", typeof firstSignal?.reasons);
  console.log(
    "[REASONS_DEBUG] reasons item types",
    Array.isArray(firstSignal?.reasons)
      ? firstSignal.reasons.map((item) => ({
          type: typeof item,
          value: item,
        }))
      : "not-array",
  );
  if (Array.isArray(firstSignal?.reasons)) {
    firstSignal.reasons.forEach((item, index) => {
      console.log("[REASONS_ITEM_DEBUG]", {
        index,
        type: typeof item,
        isArray: Array.isArray(item),
        keys: item && typeof item === "object" ? Object.keys(item) : [],
        value: item,
      });
    });
  }
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
        SIGNAL_STATE_{String(firstSignal?.state)}
      </div>
      <div className="mt-4">SIGNAL_TREND_{String(firstSignal?.trend)}</div>
      <div className="mt-4">SIGNAL_VOLUME_{String(firstSignal?.volume)}</div>
      <div className="mt-4">SIGNAL_BREAKOUT_{String(firstSignal?.breakout)}</div>
      <div className="mt-4">SIGNAL_UPDATED_AT_{String(firstSignal?.updatedAt)}</div>
      <div className="mt-4">FIRST_SIGNAL_KEY_{String(firstSignalKey)}</div>
      <div className="mt-6 rounded-xl border p-4">
        <div className="text-lg font-bold">?醫륁깈 ?遺용튋</div>
        <div className="mt-2">?꾨뗄?? {String(firstSignalKey)}</div>
        <div>?怨밴묶: {String(firstSignal?.state)}</div>
        <div>揶쏄퉮?? {firstSignal?.updatedAt ? String(firstSignal.updatedAt).slice(11, 19) : "-"}</div>
        <div>椰꾧퀡??? {firstSignal?.volume ? String(firstSignal.volume) : "-"}</div>
        <div>추세: {firstSignal?.trend ? String(firstSignal.trend) : "-"}</div>
        <div>?뚰뙆: {firstSignal?.breakout ? String(firstSignal.breakout) : "-"}</div>
        <div>筌띾뜆?? {firstSignal?.market ? String(firstSignal.market) : "-"}</div>
        <div>?怨밴묶: {firstSignal?.state ? String(firstSignal.state) : "-"}</div>
        <div>???: {firstSignal?.reason ? String(firstSignal.reason) : "-"}</div>
        <div>?癒?땾: {firstSignal?.score !== undefined ? String(firstSignal.score) : "-"}</div>
        <div>??る? {firstSignal?.action ? String(firstSignal.action) : "-"}</div>
      </div>
    </div>
  );
}
