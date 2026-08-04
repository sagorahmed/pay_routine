import { Card } from "@/components/ui/card";

const steps = [
  "Create a recurring schedule on Arc and lock the full USDC amount in escrow upfront.",
  "PayRoutine indexes metadata for analytics, but the smart contract stays the source of truth.",
  "An always-on executor checks due schedules each minute and calls executePayment() when conditions match.",
  "The contract verifies timing, status, and remaining payments before releasing the next payout.",
  "For standard transfers, the recipient is paid on Arc; for cross-chain flows, CCTP handles destination delivery.",
];

export default function HowItWorksPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 md:px-8">
      <h1 className="text-3xl font-black text-slate-100">How PayRoutine Works</h1>
      <p className="mt-2 max-w-3xl text-slate-400">
        PayRoutine combines escrowed scheduling on Arc with CCTP-enabled settlement so recurring USDC can move with
        predictable execution.
      </p>
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
