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
          className={`rounded-lg border px-4 py-3 text-left text-sm transition ${
            mode === "schedule"
              ? "border-cyan-400/70 bg-cyan-500/10 text-cyan-200"
              : "border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500"
          }`}
          onClick={() => setMode("schedule")}
        >
          <p className="font-medium">Recurring Schedule</p>
          <p className="mt-0.5 text-xs text-slate-400">Create automated recurring transfers on Arc Network</p>
        </button>

        <button
          type="button"
          className={`rounded-lg border px-4 py-3 text-left text-sm transition ${
            mode === "cctp"
              ? "border-cyan-400/70 bg-cyan-500/10 text-cyan-200"
              : "border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500"
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
