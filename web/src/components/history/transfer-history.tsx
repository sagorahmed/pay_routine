"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { arcChain } from "@/lib/chain";
import { CCTP_DESTINATION_CHAINS } from "@/lib/cctp";

type HistoryItem = {
  kind: "recurring" | "cross_chain";
  scheduleId: string;
  scheduleDestination: string | null;
  destinationRecipient: string | null;
  recipient: string | null;
  token: string | null;
  explorerBaseUrl: string | null;
  payment: {
    txHash: string;
    amount: string;
    rawAmount: string;
    status: "success" | "failed";
    reason: string | null;
    executedAt: string;
  };
  bridge: null | {
    sourcePaymentTxHash: string;
    burnTxHash: string | null;
    mintTxHash: string | null;
    destinationChainId: number;
    destinationLabel: string;
    amount: string;
    rawAmount: string;
    status: "success" | "failed";
    reason: string | null;
    createdAt: string;
  };
};

type HistoryResponse = {
  ok: boolean;
  data?: {
    address: string;
    summary: {
      schedules: number;
      payments: number;
      bridges: number;
      successes: number;
      failures: number;
    };
    items: HistoryItem[];
  };
  error?: string;
};

function statusTone(status: string) {
  if (status === "success") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  if (status === "failed") return "border-rose-500/30 bg-rose-500/10 text-rose-200";
  return "border-slate-500/30 bg-slate-500/10 text-slate-200";
}

function shortHash(hash: string) {
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`;
}

function explorerLink(base: string | null | undefined, kind: "tx" | "address", value: string): string | null {
  if (!base) return null;
  return `${base.replace(/\/$/, "")}/${kind}/${value}`;
}

function chainExplorerBase(chainId?: number): string | null {
  if (!chainId) return arcChain.blockExplorers?.default?.url ?? null;
  if (chainId === arcChain.id) return arcChain.blockExplorers?.default?.url ?? null;
  return CCTP_DESTINATION_CHAINS.find((item) => item.chain.id === chainId)?.chain.blockExplorers?.default?.url ?? null;
}

export function TransferHistory() {
  const { address, isConnected } = useAccount();
  const [filter, setFilter] = useState<"all" | "recurring" | "cross_chain">("all");

  const historyQuery = useQuery({
    queryKey: ["history", address],
    enabled: Boolean(address && isConnected),
    queryFn: async () => {
      const response = await fetch(`/api/history?address=${address}`);
      const payload = (await response.json()) as HistoryResponse;
      if (!response.ok || !payload.ok || !payload.data) {
        throw new Error(payload.error ?? "Failed to load history");
      }
      return payload.data;
    },
    staleTime: 30_000,
  });

  const items = useMemo(() => {
    const list = historyQuery.data?.items ?? [];
    if (filter === "all") return list;
    return list.filter((item) => item.kind === filter);
  }, [filter, historyQuery.data?.items]);

  if (!isConnected || !address) {
    return (
      <Card className="border-dashed border-slate-700 bg-slate-950/70 p-8 text-center">
        <h2 className="text-xl font-semibold text-slate-100">Connect your wallet to see history</h2>
        <p className="mt-2 text-sm text-slate-400">
          PayRoutine will show every recurring transfer and CCTP destination mint associated with your wallet.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-slate-800 bg-gradient-to-br from-slate-950 via-slate-950 to-cyan-950/30 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-cyan-300/70">Wallet History</p>
            <h2 className="mt-2 text-2xl font-black text-slate-100">All transfers for {shortHash(address)}</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              This timeline merges recurring Arc payments and cross-chain CCTP mints so you can see every transfer step
              in one place.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {(["all", "recurring", "cross_chain"] as const).map((item) => (
              <Button
                key={item}
                type="button"
                variant={filter === item ? "primary" : "secondary"}
                onClick={() => setFilter(item)}
                className="capitalize"
              >
                {item.replace("_", " ")}
              </Button>
            ))}
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-4">
          <Metric label="Schedules" value={historyQuery.data?.summary.schedules ?? 0} />
          <Metric label="Payments" value={historyQuery.data?.summary.payments ?? 0} />
          <Metric label="Bridges" value={historyQuery.data?.summary.bridges ?? 0} />
          <Metric label="Successes" value={historyQuery.data?.summary.successes ?? 0} />
        </div>
      </Card>

      {historyQuery.isLoading ? (
        <Card className="border-slate-800 bg-slate-950 p-8 text-sm text-slate-400">Loading history…</Card>
      ) : historyQuery.isError ? (
        <Card className="border-rose-500/30 bg-rose-950/20 p-8 text-sm text-rose-200">
          {historyQuery.error instanceof Error ? historyQuery.error.message : "Failed to load history"}
        </Card>
      ) : items.length === 0 ? (
        <Card className="border-dashed border-slate-700 bg-slate-950/70 p-8 text-center text-sm text-slate-400">
          No history yet for this filter. Create a schedule or wait for the executor to process the next due payment.
        </Card>
      ) : (
        <div className="space-y-4">
          {items.map((item) => {
            const recurringExplorer = chainExplorerBase(arcChain.id);
            const destinationExplorer = chainExplorerBase(item.bridge?.destinationChainId ?? undefined);
            const paymentTxHref = explorerLink(recurringExplorer, "tx", item.payment.txHash);
            const recipientHref = explorerLink(
              item.kind === "cross_chain" ? destinationExplorer : recurringExplorer,
              "address",
              item.recipient ?? item.destinationRecipient ?? "",
            );
            const burnTxHref = item.bridge?.burnTxHash ? explorerLink(recurringExplorer, "tx", item.bridge.burnTxHash) : null;
            const mintTxHref = item.bridge?.mintTxHash
              ? explorerLink(destinationExplorer, "tx", item.bridge.mintTxHash)
              : null;

            return (
              <Card key={`${item.scheduleId}-${item.payment.txHash}`} className="border-slate-800 bg-slate-950/90 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={statusTone(item.payment.status)}>{item.payment.status}</Badge>
                      <Badge className="border-cyan-400/30 bg-cyan-400/10 text-cyan-200">
                        Schedule #{item.scheduleId}
                      </Badge>
                      <Badge className="border-slate-600/30 bg-slate-600/10 text-slate-200">
                        {item.kind === "cross_chain" ? "Cross-chain" : "Recurring"}
                      </Badge>
                    </div>
                    <h3 className="mt-3 text-lg font-semibold text-slate-100">
                      {item.kind === "cross_chain"
                        ? `Bridged to ${item.bridge?.destinationLabel ?? item.scheduleDestination ?? "Destination chain"}`
                        : "Recurring payment executed on Arc"}
                    </h3>
                    <p className="mt-1 text-sm text-slate-400">
                      {item.payment.reason ?? "On-chain transfer completed successfully."}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-100">{item.payment.amount} USDC</p>
                    <p className="text-xs text-slate-500">
                      {formatDistanceToNow(new Date(item.bridge?.createdAt ?? item.payment.executedAt), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <Info
                    label="Payment tx"
                    value={shortHash(item.payment.txHash)}
                    href={paymentTxHref}
                    title={item.payment.txHash}
                  />
                  <Info
                    label="Recipient"
                    value={shortHash(item.recipient ?? item.destinationRecipient ?? "-")}
                    href={recipientHref}
                    title={item.recipient ?? item.destinationRecipient ?? "-"}
                  />
                  <Info label="Token" value={item.token ? shortHash(item.token) : "USDC"} />
                  <Info label="Status detail" value={item.bridge?.status ?? item.payment.status} />
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <Info label="Destination" value={item.bridge?.destinationLabel ?? item.scheduleDestination ?? "Arc"} />
                  <Info label="Amount" value={`${item.payment.amount} USDC`} />
                  <Info label="Schedule link" value={`#${item.scheduleId}`} />
                  <Info label="Step" value={item.bridge ? "Payment → Burn → Mint" : "Payment only"} />
                </div>

                {item.bridge ? (
                  <div className="mt-5 rounded-2xl border border-cyan-500/15 bg-cyan-500/5 p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-cyan-300/70">CCTP bridge details</p>
                    <div className="mt-3 grid gap-3 md:grid-cols-3">
                      <Info
                        label="Burn tx"
                        value={item.bridge.burnTxHash ? shortHash(item.bridge.burnTxHash) : "Pending"}
                        href={burnTxHref}
                        title={item.bridge.burnTxHash ?? ""}
                      />
                      <Info
                        label="Mint tx"
                        value={item.bridge.mintTxHash ? shortHash(item.bridge.mintTxHash) : "Pending"}
                        href={mintTxHref}
                        title={item.bridge.mintTxHash ?? ""}
                      />
                      <Info label="Destination chain" value={item.bridge.destinationLabel} />
                    </div>
                    {item.bridge.reason ? <p className="mt-3 text-sm text-rose-200">{item.bridge.reason}</p> : null}
                  </div>
                ) : null}

                <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <Link href={`/schedules/${item.scheduleId}`} className="text-cyan-300 hover:underline">
                    View schedule #{item.scheduleId}
                  </Link>
                  <span>•</span>
                  <span>Use the schedule page for full configuration and lifecycle controls.</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
      <p className="text-xs uppercase tracking-widest text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-100">{value}</p>
    </div>
  );
}

function Info({
  label,
  value,
  href,
  title,
}: {
  label: string;
  value: string;
  href?: string | null;
  title?: string;
}) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          title={title}
          className="mt-1 inline-block break-all text-sm text-cyan-300 hover:underline"
        >
          {value}
        </a>
      ) : (
        <p className="mt-1 break-all text-sm text-slate-200">{value}</p>
      )}
    </div>
  );
}
