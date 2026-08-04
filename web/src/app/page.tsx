import Link from "next/link";
import { ArrowRight, ShieldCheck, Clock3, Wallet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-14 md:px-8">
      <section className="grid items-center gap-8 lg:grid-cols-2">
        <div>
          <p className="inline-flex rounded-full border border-cyan-400/40 bg-cyan-400/10 px-3 py-1 text-xs font-semibold tracking-[0.2em] text-cyan-200">
            ARC NETWORK + CCTP
          </p>
          <h1 className="mt-5 text-4xl font-black leading-tight text-slate-100 md:text-6xl">
            Escrow on Arc.
            <br />
            Deliver with CCTP.
            <br />
            Repeat without friction.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-slate-300">
            PayRoutine is a CCTP-powered recurring payment app that locks USDC upfront on Arc Network and automates
            scheduled payouts across chains with predictable settlement.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/create">
              <Button className="gap-2">
                Launch Schedule <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button variant="secondary">View Payment Rails</Button>
            </Link>
          </div>
        </div>

        <Card className="grid gap-4 p-6">
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <p className="text-xs uppercase tracking-widest text-slate-400">CCTP Flow</p>
            <p className="mt-2 text-sm text-slate-200">Escrow 900 USDC on Arc</p>
            <p className="text-sm text-slate-200">Route payouts to the destination chain</p>
            <p className="text-sm text-slate-200">300 USDC monthly x 3 with CCTP delivery</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <p className="text-xs uppercase tracking-widest text-slate-400">Execution Layer</p>
            <p className="mt-2 text-sm text-slate-200">Always-on executor checks due schedules every minute</p>
            <p className="text-sm text-slate-200">Retries, verifies on-chain state, and settles reliably</p>
          </div>
        </Card>
      </section>

      <section className="mt-12 grid gap-4 md:grid-cols-3">
        {[
          { icon: ShieldCheck, title: "Escrowed Assurance", text: "Fund every schedule upfront so each payout is backed before it starts." },
          { icon: Clock3, title: "CCTP Recurrence", text: "Automate hourly, daily, weekly, or monthly USDC flows with cross-chain reach." },
          { icon: Wallet, title: "Self-Custodial Control", text: "Keep user funds and signing authority in-wallet while PayRoutine handles execution." },
        ].map((item) => (
          <Card key={item.title}>
            <item.icon className="h-5 w-5 text-cyan-300" />
            <h2 className="mt-3 text-lg font-semibold text-slate-100">{item.title}</h2>
            <p className="mt-2 text-sm text-slate-400">{item.text}</p>
          </Card>
        ))}
      </section>
    </main>
  );
}
