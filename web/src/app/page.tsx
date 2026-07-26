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
            ARC NETWORK
          </p>
          <h1 className="mt-5 text-4xl font-black leading-tight text-slate-100 md:text-6xl">
            Recurring USDC flows.
            <br />
            One signature.
            <br />
            Zero surprises.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-slate-300">
            PayRoutine is a blockchain-native standing order system that escrows full funds upfront and executes
            scheduled payouts automatically.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/create">
              <Button className="gap-2">
                Create Schedule <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button variant="secondary">Open Dashboard</Button>
            </Link>
          </div>
        </div>

        <Card className="grid gap-4 p-6">
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <p className="text-xs uppercase tracking-widest text-slate-400">Example</p>
            <p className="mt-2 text-sm text-slate-200">Deposit 900 USDC</p>
            <p className="text-sm text-slate-200">Recipient Wallet B</p>
            <p className="text-sm text-slate-200">300 USDC monthly x 3</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <p className="text-xs uppercase tracking-widest text-slate-400">Automation</p>
            <p className="mt-2 text-sm text-slate-200">Executor bot scans every 60 seconds</p>
            <p className="text-sm text-slate-200">Retries failed transactions with backoff</p>
          </div>
        </Card>
      </section>

      <section className="mt-12 grid gap-4 md:grid-cols-3">
        {[
          { icon: ShieldCheck, title: "Escrow Security", text: "All scheduled funds are locked when created." },
          { icon: Clock3, title: "Flexible Timing", text: "Hourly (1-12), daily, weekly, monthly, and custom." },
          { icon: Wallet, title: "Self-Custodial", text: "No private keys on Vercel. Users stay in control." },
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
