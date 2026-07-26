"use client";

import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";

const links = [
  { href: "/", label: "Landing" },
  { href: "/features", label: "Features" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/create", label: "Create Schedule" },
  { href: "/history", label: "Payment History" },
  { href: "/notifications", label: "Notifications" },
  { href: "/help", label: "Help" },
];

export function Nav() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-800/70 bg-slate-950/80 backdrop-blur-lg">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-8">
        <Link href="/" className="text-xl font-black tracking-tight text-cyan-300">
          PayRoutine
        </Link>
        <nav className="hidden flex-wrap items-center gap-4 lg:flex">
          {links.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm text-slate-300 transition hover:text-cyan-200"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false} />
      </div>
    </header>
  );
}
