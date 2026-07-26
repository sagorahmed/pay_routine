import { ShieldCheck, Repeat, Coins, Bell, Bot, BarChart3 } from "lucide-react";
import { Card } from "@/components/ui/card";

const features = [
  { icon: ShieldCheck, title: "Guaranteed Escrow", text: "Full amount is locked upfront to guarantee each payout." },
  { icon: Repeat, title: "Flexible Frequencies", text: "Use presets like daily, weekly, monthly, or custom hour-level intervals." },
  { icon: Coins, title: "USDC Native", text: "Optimized for stablecoin recurring transfers and treasury operations." },
  { icon: Bell, title: "Multi-Channel Alerts", text: "Email, Telegram, Discord, and webhook notifications for all outcomes." },
  { icon: Bot, title: "24/7 Automation", text: "A VPS bot executes overdue payments every minute with retry logic." },
  { icon: BarChart3, title: "Analytics Dashboard", text: "Track escrow utilization, execution health, and payment timelines." },
];

export default function FeaturesPage() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10 md:px-8">
      <h1 className="text-3xl font-black text-slate-100">PayRoutine Features</h1>
      <p className="mt-2 max-w-2xl text-slate-400">Production-grade recurring USDC rails on Arc Network.</p>
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
