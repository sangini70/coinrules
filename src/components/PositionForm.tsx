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
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-white p-3 sm:p-5 lg:p-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col space-y-3.5 sm:space-y-4">
      <section className="grid gap-3 rounded-3xl border border-gray-200 bg-white p-3.5 shadow-[0_12px_40px_rgba(15,23,42,0.08)] ring-1 ring-gray-100 md:grid-cols-[minmax(0,1fr)_auto] md:items-center sm:gap-4 sm:p-5">
        <div className="min-w-0 space-y-2.5">
          <div className="text-[10px] font-semibold uppercase tracking-[0.26em] text-gray-500 sm:text-[11px]">종목 선택</div>
          <div className="break-words text-2xl font-black tracking-tight text-gray-900 sm:text-4xl lg:text-5xl">
            {firstSignalKey.replace(/^KRW-/, "")}
          </div>
          <div className="text-sm font-semibold leading-tight tracking-tight text-gray-700 sm:text-base">현재 가격: {String(firstSignal?.currentPrice ?? "-")}</div>
        </div>

        <div className="flex min-w-0 flex-wrap gap-1.5 sm:gap-2 md:justify-end">
          <span className="inline-flex items-center rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 shadow-sm ring-1 ring-emerald-100 sm:px-3 sm:text-sm">
            상태: {String(firstSignal?.state)}
          </span>
          <span className="inline-flex items-center rounded-full border border-gray-200 bg-white/90 px-2.5 py-1.5 text-xs font-medium text-gray-700 shadow-sm sm:px-3 sm:text-sm">
            마켓: {String(firstSignalKey)}
          </span>
          <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-xs font-medium text-sky-700 shadow-sm sm:px-3 sm:text-sm">
            추세: {String(firstSignal?.trend)}
          </span>
        </div>
      </section>

      <section className="rounded-3xl border border-gray-200 bg-gray-50/90 p-3.5 shadow-sm ring-1 ring-gray-100 sm:p-5">
        <div className="text-[10px] font-semibold uppercase tracking-[0.26em] text-gray-500 sm:text-[11px]">Watchlist</div>
        <div className="mt-2 break-words text-[13px] font-semibold leading-5 tracking-tight text-gray-900 sm:mt-2.5 sm:text-base sm:leading-6">{signalKeys.join(" / ")}</div>
      </section>

      <section className="rounded-3xl border border-gray-200 bg-white p-3.5 shadow-[0_10px_35px_rgba(15,23,42,0.06)] ring-1 ring-gray-100 sm:p-5">
        <div className="text-[10px] font-semibold uppercase tracking-[0.26em] text-gray-500 sm:text-[11px]">Interaction shell</div>
        <div className="mt-2.5 flex flex-wrap gap-2">
          <button
            type="button"
            className={`inline-flex cursor-pointer items-center rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-200 sm:text-sm ${visualActive ? "border-emerald-300 bg-emerald-50 text-emerald-700 shadow-sm ring-1 ring-emerald-100" : "border-gray-200 bg-white text-gray-600 hover:-translate-y-0.5 hover:bg-gray-50 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-200"}`}
            onClick={() => setVisualActive((current) => !current)}
          >
            {visualActive ? "활성" : "비활성"}
          </button>
          <button
            type="button"
            className="inline-flex cursor-not-allowed items-center rounded-full border border-gray-200 bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-400 transition duration-200 sm:text-sm"
            disabled
          >
            DISABLED SHELL
          </button>
        </div>
        <div className="mt-3.5 flex flex-wrap items-center gap-2.5 sm:mt-4 sm:gap-3">
          <button
            type="button"
            className={`inline-flex cursor-pointer items-center rounded-full border px-4 py-2 text-xs font-semibold transition-all duration-200 sm:text-sm ${entryVisualActive ? "border-blue-300 bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-100" : "border-gray-200 bg-white text-gray-600 hover:-translate-y-0.5 hover:bg-gray-50 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-200"}`}
            onClick={() => setEntryVisualActive((current) => !current)}
          >
            ENTRY
          </button>
          <span className={`inline-flex items-center rounded-full px-3 py-1.5 text-[11px] font-medium tracking-wide ${entryVisualActive ? "bg-blue-50 text-blue-700 ring-1 ring-blue-100" : "bg-gray-100 text-gray-500"}`}>
            {entryVisualActive ? "활성" : "비활성"}
          </span>
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-2.5 sm:mt-3 sm:gap-3">
          <button
            type="button"
            className={`inline-flex cursor-pointer items-center rounded-full border px-4 py-2 text-xs font-semibold transition-all duration-200 sm:text-sm ${buyVisualActive ? "border-emerald-300 bg-emerald-50 text-emerald-700 shadow-sm ring-1 ring-emerald-100" : "border-gray-200 bg-white text-gray-600 hover:-translate-y-0.5 hover:bg-gray-50 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-200"}`}
            onClick={() => setBuyVisualActive((current) => !current)}
          >
            BUY
          </button>
          <span className={`inline-flex items-center rounded-full px-3 py-1.5 text-[11px] font-medium tracking-wide ${buyVisualActive ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100" : "bg-gray-100 text-gray-500"}`}>
            {buyVisualActive ? "활성" : "비활성"}
          </span>
          <button
            type="button"
            className={`inline-flex cursor-pointer items-center rounded-full border px-4 py-2 text-xs font-semibold transition-all duration-200 sm:text-sm ${sellVisualActive ? "border-rose-300 bg-rose-50 text-rose-700 shadow-sm ring-1 ring-rose-100" : "border-gray-200 bg-white text-gray-600 hover:-translate-y-0.5 hover:bg-gray-50 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-rose-200"}`}
            onClick={() => setSellVisualActive((current) => !current)}
          >
            SELL
          </button>
          <span className={`inline-flex items-center rounded-full px-3 py-1.5 text-[11px] font-medium tracking-wide ${sellVisualActive ? "bg-rose-50 text-rose-700 ring-1 ring-rose-100" : "bg-gray-100 text-gray-500"}`}>
            {sellVisualActive ? "활성" : "비활성"}
          </span>
        </div>
      </section>

      <section className="mt-5 overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.08)] ring-1 ring-gray-100 divide-y divide-gray-100 sm:mt-6">
        <header className="border-b border-gray-100 bg-gray-50/60 px-3.5 py-3 sm:px-5 sm:py-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.26em] text-gray-500 sm:text-[11px]">read-only signal info</div>
          <div className="mt-0.5 text-base font-bold tracking-tight text-gray-900 sm:text-xl">실시간 신호 요약</div>
        </header>

        <div className="grid gap-2 p-3.5 sm:grid-cols-2 sm:gap-3 sm:p-5">
          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-[13px] font-semibold leading-5 text-gray-800 shadow-sm sm:col-span-2 sm:text-sm sm:leading-6">
            코인: {String(firstSignalKey)}
          </div>
          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-[13px] font-semibold leading-5 text-gray-800 shadow-sm sm:text-sm sm:leading-6">
            상태: {String(firstSignal?.state)}
          </div>
          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-[13px] font-semibold leading-5 text-gray-800 shadow-sm sm:text-sm sm:leading-6">
            갱신: {firstSignal?.updatedAt ? String(firstSignal.updatedAt).slice(11, 19) : "-"}
          </div>
          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-[13px] font-semibold leading-5 text-gray-800 shadow-sm sm:text-sm sm:leading-6">
            거래량: {firstSignal?.volume ? String(firstSignal.volume) : "-"}
          </div>
          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-[13px] font-semibold leading-5 text-gray-800 shadow-sm sm:text-sm sm:leading-6">
            추세: {firstSignal?.trend ? String(firstSignal.trend) : "-"}
          </div>
          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-[13px] font-semibold leading-5 text-gray-800 shadow-sm sm:text-sm sm:leading-6">
            돌파: {firstSignal?.breakout ? String(firstSignal.breakout) : "-"}
          </div>
          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-[13px] font-semibold leading-5 text-gray-800 shadow-sm sm:text-sm sm:leading-6">
            마켓: {firstSignal?.market ? String(firstSignal.market) : "-"}
          </div>
          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-[13px] font-semibold leading-5 text-gray-800 shadow-sm sm:text-sm sm:leading-6">
            상태: {firstSignal?.state ? String(firstSignal.state) : "-"}
          </div>
          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-[13px] font-semibold leading-5 text-gray-800 shadow-sm sm:text-sm sm:leading-6">
            사유: {firstSignal?.reason ? String(firstSignal.reason) : "-"}
          </div>
          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-[13px] font-semibold leading-5 text-gray-800 shadow-sm sm:text-sm sm:leading-6">
            점수: {firstSignal?.score !== undefined ? String(firstSignal.score) : "-"}
          </div>
          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-[13px] font-semibold leading-5 text-gray-800 shadow-sm sm:col-span-2 sm:text-sm sm:leading-6">
            행동: {firstSignal?.action ? String(firstSignal.action) : "-"}
          </div>
        </div>
      </section>
      </div>
    </div>
  );
}
