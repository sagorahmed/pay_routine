"use client";

import { useState } from "react";
import { CctpBridgeForm } from "@/components/bridge/cctp-bridge-form";
import { CreateScheduleForm } from "@/components/schedule/create-form";

export default function CreateSchedulePage() {
  const [mode, setMode] = useState<"schedule" | "cctp">("schedule");

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 md:px-8">
      <div className="mb-6 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          className={`rounded-xl border px-4 py-3 text-left text-sm transition-[transform,box-shadow,background-color,border-color,color] duration-300 ease-out will-change-transform hover:scale-[1.02] hover:-translate-y-0.5 active:scale-[0.985] active:translate-y-0 ${
            mode === "schedule"
              ? "border-cyan-400/70 bg-cyan-500/10 text-cyan-200 shadow-[0_14px_36px_-22px_rgba(34,211,238,0.65)]"
              : "border-slate-700 bg-slate-950 text-slate-300 shadow-[0_12px_28px_-22px_rgba(15,23,42,0.9)] hover:border-cyan-400/30 hover:shadow-[0_16px_40px_-22px_rgba(34,211,238,0.28)]"
          }`}
          onClick={() => setMode("schedule")}
        >
          <p className="font-medium">Recurring Schedule</p>
          <p className="mt-0.5 text-xs text-slate-400">Create automated recurring transfers on Arc Network</p>
        </button>

        <button
          type="button"
          className={`rounded-xl border px-4 py-3 text-left text-sm transition-[transform,box-shadow,background-color,border-color,color] duration-300 ease-out will-change-transform hover:scale-[1.02] hover:-translate-y-0.5 active:scale-[0.985] active:translate-y-0 ${
            mode === "cctp"
              ? "border-cyan-400/70 bg-cyan-500/10 text-cyan-200 shadow-[0_14px_36px_-22px_rgba(34,211,238,0.65)]"
              : "border-slate-700 bg-slate-950 text-slate-300 shadow-[0_12px_28px_-22px_rgba(15,23,42,0.9)] hover:border-cyan-400/30 hover:shadow-[0_16px_40px_-22px_rgba(34,211,238,0.28)]"
          }`}
          onClick={() => setMode("cctp")}
        >
          <p className="font-medium">Cross-Chain (CCTP)</p>
          <p className="mt-0.5 text-xs text-slate-400">Bridge USDC from Arc to a selected destination chain</p>
        </button>
      </div>

      {mode === "schedule" ? <CreateScheduleForm /> : <CctpBridgeForm />}
    </main>
  );
}
