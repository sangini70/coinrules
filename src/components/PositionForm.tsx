import { useEffect, useState } from "react";
import { useAppStore } from "../store/useAppStore";

export default function PositionForm() {
  const [count] = useState(1);
  const [visualActive, setVisualActive] = useState(false);
  const [entryVisualActive, setEntryVisualActive] = useState(false);
  const [buyVisualActive, setBuyVisualActive] = useState(false);
  const [sellVisualActive, setSellVisualActive] = useState(false);
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
  console.log("[FIRST_SIGNAL_PRICE]", {
    firstSignalKey,
    currentPrice: firstSignal?.currentPrice,
    updatedAt: firstSignal?.updatedAt,
    signalsKeysLength: signalKeys.length,
  });

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-7">
      <section className="grid gap-5 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm ring-1 ring-gray-100 md:grid-cols-[minmax(0,1fr)_auto] md:items-center sm:p-5">
        <div className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">종목 선택</div>
          <div className="text-3xl font-black tracking-tight text-gray-900 sm:text-4xl lg:text-5xl">
            {firstSignalKey.replace(/^KRW-/, "")}
          </div>
          <div className="text-sm font-medium tracking-tight text-gray-500">현재 가격: {String(firstSignal?.currentPrice ?? "-")}</div>
        </div>

        <div className="flex flex-wrap gap-2 md:justify-end">
          <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700 shadow-sm ring-1 ring-emerald-100">
            상태: {String(firstSignal?.state)}
          </span>
          <span className="inline-flex items-center rounded-full border border-gray-200 bg-white/80 px-3 py-1.5 text-sm text-gray-600 shadow-sm">
            마켓: {String(firstSignalKey)}
          </span>
          <span className="inline-flex items-center rounded-full border border-gray-200 bg-white/80 px-3 py-1.5 text-sm text-gray-600 shadow-sm">
            추세: {String(firstSignal?.trend)}
          </span>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-gray-50/60 p-4 shadow-sm ring-1 ring-gray-100 sm:p-5">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Watchlist</div>
        <div className="mt-3 text-sm font-semibold tracking-tight text-gray-900">{signalKeys.join(" / ")}</div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm ring-1 ring-gray-100 sm:p-5">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Interaction shell</div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className={`inline-flex cursor-pointer items-center rounded-full border px-3 py-1.5 text-sm font-semibold transition duration-200 ${visualActive ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`}
            onClick={() => setVisualActive((current) => !current)}
          >
            {visualActive ? "활성" : "비활성"}
          </button>
          <button
            type="button"
            className="inline-flex cursor-not-allowed items-center rounded-full border border-gray-200 bg-gray-100 px-3 py-1.5 text-sm font-semibold text-gray-400 transition duration-200"
            disabled
          >
            DISABLED SHELL
          </button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className={`inline-flex cursor-pointer items-center rounded-full border px-4 py-2 text-sm font-semibold transition duration-200 ${entryVisualActive ? "border-blue-300 bg-blue-50 text-blue-700" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`}
            onClick={() => setEntryVisualActive((current) => !current)}
          >
            ENTRY
          </button>
          <span className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium tracking-wide ${entryVisualActive ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-500"}`}>
            {entryVisualActive ? "활성" : "비활성"}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className={`inline-flex cursor-pointer items-center rounded-full border px-4 py-2 text-sm font-semibold transition duration-200 ${buyVisualActive ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`}
            onClick={() => setBuyVisualActive((current) => !current)}
          >
            BUY
          </button>
          <span className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium tracking-wide ${buyVisualActive ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
            {buyVisualActive ? "활성" : "비활성"}
          </span>
          <button
            type="button"
            className={`inline-flex cursor-pointer items-center rounded-full border px-4 py-2 text-sm font-semibold transition duration-200 ${sellVisualActive ? "border-rose-300 bg-rose-50 text-rose-700" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`}
            onClick={() => setSellVisualActive((current) => !current)}
          >
            SELL
          </button>
          <span className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium tracking-wide ${sellVisualActive ? "bg-rose-50 text-rose-700" : "bg-gray-100 text-gray-500"}`}>
            {sellVisualActive ? "활성" : "비활성"}
          </span>
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm ring-1 ring-gray-100 divide-y divide-gray-100">
        <header className="border-b border-gray-100 px-4 py-4 sm:px-5">
          <div className="text-lg font-bold tracking-tight text-gray-900">실시간 신호 요약</div>
          <div className="mt-1 text-xs font-medium uppercase tracking-[0.2em] text-gray-400">read-only signal info</div>
        </header>

        <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
          <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-700 sm:col-span-2">
            코인: {String(firstSignalKey)}
          </div>
          <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-700">
            상태: {String(firstSignal?.state)}
          </div>
          <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-700">
            갱신: {firstSignal?.updatedAt ? String(firstSignal.updatedAt).slice(11, 19) : "-"}
          </div>
          <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-700">
            거래량: {firstSignal?.volume ? String(firstSignal.volume) : "-"}
          </div>
          <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-700">
            추세: {firstSignal?.trend ? String(firstSignal.trend) : "-"}
          </div>
          <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-700">
            돌파: {firstSignal?.breakout ? String(firstSignal.breakout) : "-"}
          </div>
          <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-700">
            마켓: {firstSignal?.market ? String(firstSignal.market) : "-"}
          </div>
          <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-700">
            상태: {firstSignal?.state ? String(firstSignal.state) : "-"}
          </div>
          <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-700">
            사유: {firstSignal?.reason ? String(firstSignal.reason) : "-"}
          </div>
          <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-700">
            점수: {firstSignal?.score !== undefined ? String(firstSignal.score) : "-"}
          </div>
          <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-700 sm:col-span-2">
            행동: {firstSignal?.action ? String(firstSignal.action) : "-"}
          </div>
        </div>
      </section>
    </div>
  );
}
