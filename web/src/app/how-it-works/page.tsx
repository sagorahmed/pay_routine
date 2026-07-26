import { Card } from "@/components/ui/card";

const steps = [
  "Create a schedule and escrow total USDC in one transaction.",
  "PayRoutine stores indexed metadata but keeps blockchain as source of truth.",
  "Executor bot checks due schedules each minute and calls executePayment().",
  "Contract validates status, timing, and remaining payments before transfer.",
  "Recipient receives USDC, optional executor reward is paid, schedule advances.",
  "Notifications and analytics are updated after confirmation.",
];

export default function HowItWorksPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 md:px-8">
      <h1 className="text-3xl font-black text-slate-100">How PayRoutine Works</h1>
      <div className="mt-8 space-y-4">
        {steps.map((step, i) => (
          <Card key={step} className="flex items-start gap-3">
            <div className="mt-1 flex h-7 w-7 items-center justify-center rounded-full bg-cyan-400/20 text-sm font-bold text-cyan-200">
              {i + 1}
            </div>
            <p className="text-slate-300">{step}</p>
          </Card>
        ))}
      </div>
    </main>
  );
}
