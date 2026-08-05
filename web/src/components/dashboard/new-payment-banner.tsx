"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useSearchParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function NewPaymentBanner() {
  const searchParams = useSearchParams();
  const newPayment = searchParams.get("newPayment");
  const kind = searchParams.get("kind");

  if (!newPayment) {
    return null;
  }

  const isCrossChain = kind === "cctp";
  const hasScheduleId = newPayment !== "created";

  return (
    <motion.div initial={{ opacity: 0, y: 18, x: 20 }} animate={{ opacity: 1, y: 0, x: 0 }} transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}>
      <Card className="border-emerald-500/30 bg-emerald-950/15 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-400/30 bg-emerald-500/10">
              <CheckCircle2 className="h-6 w-6 text-emerald-300" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-300/80">New Payment Live</p>
              <h2 className="mt-2 text-xl font-bold text-slate-100">
                {isCrossChain ? "CCTP payment created successfully" : "Recurring payment created successfully"}
              </h2>
              <p className="mt-2 text-sm text-slate-300">
                {hasScheduleId ? `Schedule #${newPayment} has entered the payment system and should surface in the dashboard views.` : "Your new payment has been created on-chain and is ready for tracking."}
              </p>
            </div>
          </div>

          {hasScheduleId ? (
            <Link href={`/schedules/${newPayment}`} className="inline-flex">
              <Button variant="secondary">Open Schedule</Button>
            </Link>
          ) : null}
        </div>
      </Card>
    </motion.div>
  );
}