"use client";

import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Sparkles, X } from "lucide-react";
import { CctpBridgeForm } from "@/components/bridge/cctp-bridge-form";
import { CreateScheduleForm } from "@/components/schedule/create-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type FlowMode = "schedule" | "cctp";
type FlowStage = "requirement" | "details" | "wallet" | "success";

const stepLabels = ["Requirement", "Configure", "Wallet", "Success"] as const;

export default function CreateSchedulePage() {
  const [mode, setMode] = useState<FlowMode | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [stage, setStage] = useState<FlowStage>("requirement");
  const [createdPayment, setCreatedPayment] = useState<{ scheduleId: string | null; kind: FlowMode } | null>(null);

  function openFlow(nextMode?: FlowMode) {
    setMode(nextMode ?? null);
    setCreatedPayment(null);
    setStage(nextMode ? "details" : "requirement");
    setIsOpen(true);
  }

  function closeFlow() {
    setIsOpen(false);
    setCreatedPayment(null);
    setMode(null);
    setStage("requirement");
  }

  function currentStepIndex() {
    if (stage === "requirement") return 0;
    if (stage === "details") return 1;
    if (stage === "wallet") return 2;
    return 3;
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-slate-800/70 bg-slate-950/70 p-5 md:p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300/80">Create Center</p>
            <h1 className="mt-2 text-2xl font-black text-slate-100 md:text-3xl">Create a recurring payment</h1>
            <p className="mt-2 text-sm text-slate-400">Choose payment type, set schedule details, confirm in wallet.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button className="gap-2" onClick={() => openFlow()}>
              Create Payment <Sparkles className="h-4 w-4" />
            </Button>
            <Button variant="secondary" onClick={() => openFlow("cctp")}>
              CCTP Payment
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: "1", text: "Choose route" },
            { label: "2", text: "Fill details" },
            { label: "3", text: "Confirm + create" },
          ].map((item) => (
            <Card key={item.label} className="p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-cyan-300/70">Step {item.label}</p>
              <p className="mt-2 text-sm font-semibold text-slate-100">{item.text}</p>
            </Card>
          ))}
        </div>
      </section>

      <AnimatePresence>
        {isOpen ? (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 p-2 backdrop-blur-md md:items-center md:p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeFlow}
          >
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.98 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="relative max-h-[94vh] w-full max-w-[58rem] overflow-hidden rounded-[24px] border border-slate-800/80 bg-[linear-gradient(135deg,rgba(2,6,23,0.98)_0%,rgba(3,19,31,0.96)_50%,rgba(8,47,73,0.92)_100%)] shadow-[0_40px_120px_-35px_rgba(8,145,178,0.4)]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4 border-b border-slate-800/80 px-4 py-4 md:px-6 md:py-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300/75">Create Payment</p>
                  <h2 className="mt-2 text-xl font-black text-slate-100 md:text-2xl">Build a recurring payment with a guided flow</h2>
                </div>
                <button
                  type="button"
                  onClick={closeFlow}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 bg-slate-900/80 text-slate-300 transition hover:border-cyan-400/40 hover:text-cyan-200"
                  aria-label="Close create payment flow"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="border-b border-slate-800/80 px-4 py-3 md:px-6 md:py-4">
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  {stepLabels.map((label, index) => {
                    const state = index < currentStepIndex() ? "complete" : index === currentStepIndex() ? "active" : "upcoming";

                    return (
                      <div key={label} className="min-w-0 flex items-center gap-2 rounded-xl border border-slate-800/80 bg-slate-950/55 px-3 py-2 sm:px-3.5 sm:py-2.5 md:px-4 md:py-3">
                        <div
                          className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold transition md:h-8 md:w-8 md:text-xs ${
                            state === "complete"
                              ? "bg-emerald-500 text-slate-950"
                              : state === "active"
                                ? "bg-cyan-400 text-slate-950 shadow-[0_0_0_6px_rgba(34,211,238,0.12)]"
                                : "bg-slate-800 text-slate-400"
                          }`}
                        >
                          {index + 1}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500 md:text-xs">Step</p>
                          <p className={`truncate text-xs font-semibold md:text-sm ${state === "upcoming" ? "text-slate-400" : "text-slate-100"}`}>{label}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div
                className={`max-h-[calc(94vh-164px)] px-4 py-4 md:px-6 md:py-5 ${
                  stage === "success" ? "flex items-center overflow-hidden" : "overflow-y-auto"
                }`}
              >
                {stage === "success" && createdPayment ? (
                  <motion.div
                    initial={{ opacity: 0, y: 24, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className="mx-auto w-full max-w-lg"
                  >
                    <Card className="border-emerald-500/30 bg-emerald-950/15 p-5 text-center md:p-6">
                      <motion.div
                        initial={{ scale: 0.7, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.05, type: "spring", stiffness: 220, damping: 18 }}
                        className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-500/10"
                      >
                        <CheckCircle2 className="h-7 w-7 text-emerald-300" />
                      </motion.div>
                      <h3 className="mt-4 text-xl font-black text-slate-100 md:text-2xl">Payment created successfully</h3>
                      <p className="mt-2 text-sm text-slate-300">
                        Your {createdPayment.kind === "cctp" ? "CCTP-powered" : "recurring"} payment flow is live and ready for tracking.
                      </p>
                      <div className="mt-4 flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-3">
                        <Link href={`/dashboard?newPayment=${createdPayment.scheduleId ?? "created"}&kind=${createdPayment.kind}`} className="inline-flex sm:inline-flex">
                          <Button>Open Dashboard</Button>
                        </Link>
                        {createdPayment.scheduleId ? (
                          <Link href={`/schedules/${createdPayment.scheduleId}`} className="inline-flex sm:inline-flex">
                            <Button variant="secondary">View Schedule</Button>
                          </Link>
                        ) : null}
                      </div>
                    </Card>
                  </motion.div>
                ) : (
                  <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,0.74fr)_minmax(0,1.1fr)]">
                    <Card className="h-fit min-w-0 p-4 md:p-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300/75">Choose Requirement</p>
                      <h3 className="mt-2.5 text-lg font-bold text-slate-100 md:text-xl">Pick the payment route</h3>
                      <p className="mt-2 text-sm text-slate-400">
                        Start with a direct recurring schedule or a CCTP destination flow. The rest of the experience adapts.
                      </p>
                      <div className="mt-4 grid gap-2">
                        {([
                          {
                            key: "schedule",
                            title: "Recurring Schedule",
                            description: "Automated recurring transfers that stay on Arc Network.",
                          },
                          {
                            key: "cctp",
                            title: "Cross-Chain (CCTP)",
                            description: "Create on Arc and deliver USDC across chains with CCTP.",
                          },
                        ] as const).map((item) => (
                          <button
                            key={item.key}
                            type="button"
                            className={`w-full rounded-xl border px-3 py-2.5 text-left transition-[transform,box-shadow,background-color,border-color,color] duration-300 ease-out hover:-translate-y-0.5 hover:scale-[1.01] ${
                              mode === item.key
                                ? "border-cyan-400/70 bg-cyan-500/10 text-cyan-200 shadow-[0_18px_42px_-24px_rgba(34,211,238,0.48)]"
                                : "border-slate-700 bg-slate-950/70 text-slate-300 hover:border-cyan-400/30 hover:shadow-[0_18px_42px_-28px_rgba(34,211,238,0.28)]"
                            }`}
                            onClick={() => {
                              setMode(item.key);
                              setStage("details");
                            }}
                          >
                            <p className="text-sm font-semibold md:text-base">{item.title}</p>
                            <p className="mt-1 text-xs leading-5 text-slate-400 md:text-sm">{item.description}</p>
                          </button>
                        ))}
                      </div>
                    </Card>

                    <AnimatePresence mode="wait">
                      <motion.div
                        key={mode ?? "empty"}
                        className="min-w-0"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -14 }}
                        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                      >
                        {mode === "schedule" ? (
                          <CreateScheduleForm
                            onStageChange={setStage}
                            onCreated={(payload) => {
                              setCreatedPayment({ scheduleId: payload.scheduleId, kind: payload.kind });
                              setStage("success");
                            }}
                          />
                        ) : mode === "cctp" ? (
                          <CctpBridgeForm
                            onStageChange={setStage}
                            onCreated={(payload) => {
                              setCreatedPayment({ scheduleId: payload.scheduleId, kind: payload.kind });
                              setStage("success");
                            }}
                          />
                        ) : (
                          <Card className="flex min-h-[420px] items-center justify-center p-10 text-center">
                            <div>
                              <p className="text-lg font-semibold text-slate-100">The form workspace opens after you choose a payment requirement.</p>
                              <p className="mt-2 text-sm text-slate-400">Step 2 and the animated review panel will appear here.</p>
                            </div>
                          </Card>
                        )}
                      </motion.div>
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </main>
  );
}
