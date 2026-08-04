import { ShieldCheck, Repeat, Coins, Bell, Bot, BarChart3 } from "lucide-react";
import { Card } from "@/components/ui/card";

const features = [
  { icon: ShieldCheck, title: "Escrowed Assurance", text: "Every schedule is fully funded upfront on Arc so each payout starts with real backing." },
  { icon: Repeat, title: "Recurring CCTP Delivery", text: "Create recurring USDC flows on Arc and route eligible payouts across chains with CCTP." },
  { icon: Coins, title: "USDC Payment Rails", text: "Built around stablecoin transfers for payroll, subscriptions, treasury ops, and grants." },
  { icon: Bot, title: "Always-On Automation", text: "The executor checks due schedules every minute, verifies state on-chain, and retries safely." },
  { icon: BarChart3, title: "Operational Visibility", text: "Monitor schedule health, payment history, bridge status, and execution performance in one view." },
];

export default function FeaturesPage() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10 md:px-8">
      <h1 className="text-3xl font-black text-slate-100">PayRoutine Features</h1>
      <p className="mt-2 max-w-2xl text-slate-400">
        Escrowed recurring USDC rails on Arc Network with CCTP-powered cross-chain reach.
      </p>
      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {features.map((feature) => (
          <Card key={feature.title}>
            <feature.icon className="h-5 w-5 text-cyan-300" />
            <h2 className="mt-3 text-lg font-semibold text-slate-100">{feature.title}</h2>
            <p className="mt-2 text-sm text-slate-400">{feature.text}</p>
          </Card>
        ))}
      </div>
    </main>
  );
}
