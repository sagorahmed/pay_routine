import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { createPublicClient, formatUnits, http, parseAbi } from "viem";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { arcChain } from "@/lib/chain";
import { recurringPaymentAddress } from "@/lib/contract";
import { CCTP_DESTINATION_CHAINS } from "@/lib/cctp";
import { db } from "@/lib/server/db";

type Props = {
  id: string;
};

type OnChainSchedule = {
  creator: string;
  recipient: string;
  token: string;
  amountPerPayment: bigint;
  totalPayments: number;
  remainingPayments: number;
  nextExecution: bigint;
  intervalSeconds: bigint;
  depositedAmount: bigint;
  active: boolean;
  paused: boolean;
  cancelled: boolean;
  executorReward: bigint;
};

type IndexedScheduleRow = {
  schedule_id: string;
  creator: string;
  recipient: string;
  token: string;
  amount_per_payment: string;
  total_payments: number;
  remaining_payments: number;
  next_execution: Date;
  interval_seconds: number;
  deposited_amount: string;
  active: boolean;
  paused: boolean;
  cancelled: boolean;
  memo: string | null;
};

type CrossChainScheduleRow = {
  schedule_id: string;
  destination_chain_id: number;
  destination_domain: number;
  destination_recipient: string;
  destination_usdc_address: string;
  message_transmitter_address: string;
  memo: string | null;
  active: boolean;
};

type PaymentRow = {
  schedule_id: string;
  tx_hash: string;
  amount: string;
  status: "success" | "failed";
  reason: string | null;
  executed_at: Date;
};

type BridgeRow = {
  source_payment_tx_hash: string;
  burn_tx_hash: string | null;
  mint_tx_hash: string | null;
  destination_chain_id: number;
  amount: string;
  status: "success" | "failed";
  reason: string | null;
  created_at: Date;
};

type PaymentTimelineItem = {
  label: string;
  amount: string;
  when: string;
  txHash: string;
  txHref: string | null;
  reason: string | null;
};

type BridgeTimelineItem = {
  status: "success" | "failed";
  amount: string;
  when: string;
  burnTxHash: string | null;
  mintTxHash: string | null;
  burnHref: string | null;
  mintHref: string | null;
  reason: string | null;
};

const getScheduleAbi = parseAbi([
  "function getSchedule(uint256 scheduleId) view returns ((address creator,address recipient,address token,uint128 amountPerPayment,uint32 totalPayments,uint32 remainingPayments,uint64 nextExecution,uint64 intervalSeconds,uint128 depositedAmount,bool active,bool paused,bool cancelled,uint96 executorReward))",
]);

function formatUsdc(rawAmount: string | bigint): string {
  try {
    return formatUnits(BigInt(rawAmount), 6);
  } catch {
    return String(rawAmount);
  }
}

function explorerBase(chainId?: number): string | null {
  if (!chainId || chainId === arcChain.id) {
    return arcChain.blockExplorers?.default?.url ?? null;
  }

  return CCTP_DESTINATION_CHAINS.find((item) => item.chain.id === chainId)?.chain.blockExplorers?.default?.url ?? null;
}

function explorerLink(base: string | null, kind: "tx" | "address", value: string): string | null {
  if (!base) return null;
  return `${base.replace(/\/$/, "")}/${kind}/${value}`;
}

function shortHash(value: string) {
  return value.length <= 12 ? value : `${value.slice(0, 8)}…${value.slice(-6)}`;
}

function scheduleStatus(schedule: OnChainSchedule | null, indexed: IndexedScheduleRow | null) {
  if (schedule?.cancelled || indexed?.cancelled) return "Cancelled";
  if (schedule?.paused || indexed?.paused) return "Paused";
  if (schedule?.active || indexed?.active) return "Active";
  return "Unknown";
}

export async function ScheduleDetail({ id }: Props) {
  if (!recurringPaymentAddress) {
    return (
      <Card className="border-rose-500/30 bg-rose-950/20 p-6 text-rose-200">
        NEXT_PUBLIC_RECURRING_PAYMENT_ADDRESS is missing.
      </Card>
    );
  }

  let scheduleId: bigint;
  try {
    scheduleId = BigInt(id);
  } catch {
    return (
      <Card className="border-rose-500/30 bg-rose-950/20 p-6 text-rose-200">
        Invalid schedule id.
      </Card>
    );
  }

  const publicClient = createPublicClient({
    chain: arcChain,
    transport: http(arcChain.rpcUrls.default.http[0]),
  });

  const [scheduleResult, indexedResult, crossChainResult, paymentsResult, bridgesResult] = await Promise.all([
    publicClient
      .readContract({
        abi: getScheduleAbi,
        address: recurringPaymentAddress,
        functionName: "getSchedule",
        args: [scheduleId],
      })
      .then((value) => value as OnChainSchedule)
      .catch(() => null),
    db.query<IndexedScheduleRow>(
      `
        SELECT
          schedule_id,
          creator,
          recipient,
          token,
          amount_per_payment,
          total_payments,
          remaining_payments,
          next_execution,
          interval_seconds,
          deposited_amount,
          active,
          paused,
          cancelled,
          memo
        FROM indexed_schedules
        WHERE schedule_id = $1
        LIMIT 1
      `,
      [id],
    ),
    db.query<CrossChainScheduleRow>(
      `
        SELECT
          schedule_id,
          destination_chain_id,
          destination_domain,
          destination_recipient,
          destination_usdc_address,
          message_transmitter_address,
          memo,
          active
        FROM cross_chain_schedules
        WHERE schedule_id = $1
        LIMIT 1
      `,
      [id],
    ),
    db.query<PaymentRow>(
      `
        SELECT schedule_id, tx_hash, amount, status, reason, executed_at
        FROM payment_history
        WHERE schedule_id = $1
        ORDER BY executed_at DESC
        LIMIT 12
      `,
      [id],
    ),
    db.query<BridgeRow>(
      `
        SELECT
          source_payment_tx_hash,
          burn_tx_hash,
          mint_tx_hash,
          destination_chain_id,
          amount,
          status,
          reason,
          created_at
        FROM cctp_bridge_history
        WHERE schedule_id = $1
        ORDER BY created_at DESC
        LIMIT 12
      `,
      [id],
    ),
  ]);

  const schedule = scheduleResult ?? null;
  const indexed = indexedResult.rows[0] ?? null;
  const crossChain = crossChainResult.rows[0] ?? null;
  const explorer = explorerBase(crossChain?.destination_chain_id ?? arcChain.id);
  const arcExplorer = explorerBase(arcChain.id);
  const paymentTimeline: PaymentTimelineItem[] = paymentsResult.rows.map((row: PaymentRow) => ({
    label: row.status === "failed" ? "Failed" : "Executed",
    amount: formatUsdc(row.amount),
    when: formatDistanceToNow(new Date(row.executed_at), { addSuffix: true }),
    txHash: row.tx_hash,
    txHref: explorerLink(arcExplorer, "tx", row.tx_hash),
    reason: row.reason,
  }));
  const bridgeTimeline: BridgeTimelineItem[] = bridgesResult.rows.map((row: BridgeRow) => ({
    status: row.status,
    amount: formatUsdc(row.amount),
    when: formatDistanceToNow(new Date(row.created_at), { addSuffix: true }),
    burnTxHash: row.burn_tx_hash,
    mintTxHash: row.mint_tx_hash,
    burnHref: row.burn_tx_hash ? explorerLink(arcExplorer, "tx", row.burn_tx_hash) : null,
    mintHref: row.mint_tx_hash ? explorerLink(explorer, "tx", row.mint_tx_hash) : null,
    reason: row.reason,
  }));

  const amountPerPayment = schedule ? formatUsdc(schedule.amountPerPayment) : formatUsdc(indexed?.amount_per_payment ?? "0");
  const totalPayments = schedule?.totalPayments ?? indexed?.total_payments ?? 0;
  const remainingPayments = schedule?.remainingPayments ?? indexed?.remaining_payments ?? 0;
  const depositedAmount = schedule ? formatUsdc(schedule.depositedAmount) : formatUsdc(indexed?.deposited_amount ?? "0");
  const intervalSeconds = Number(schedule?.intervalSeconds ?? indexed?.interval_seconds ?? 0);
  const nextExecution = schedule ? new Date(Number(schedule.nextExecution) * 1000) : indexed?.next_execution ?? null;
  const recipient = schedule?.recipient ?? indexed?.recipient ?? crossChain?.destination_recipient ?? null;
  const token = schedule?.token ?? indexed?.token ?? null;
  const destinationLabel = crossChain ? CCTP_DESTINATION_CHAINS.find((item) => item.chain.id === crossChain.destination_chain_id)?.label ?? `Chain ${crossChain.destination_chain_id}` : null;

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-400">Schedule #{id}</p>
            <h2 className="text-xl font-bold text-slate-100">
              {crossChain ? "Cross-chain recurring schedule" : "Recurring schedule"}
            </h2>
          </div>
          <Badge>{scheduleStatus(schedule, indexed)}</Badge>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Detail label="Schedule ID" value={`#${id}`} />
          <Detail label="Recipient" value={recipient ?? "-"} href={recipient ? explorerLink(arcExplorer, "address", recipient) : null} className="md:col-span-2" />
          <Detail
            label="Next Payment"
            value={nextExecution ? formatDistanceToNow(nextExecution, { addSuffix: true }) : "Unknown"}
          />
          <Detail label="Remaining Payments" value={totalPayments > 0 ? `${remainingPayments} / ${totalPayments}` : "Unknown"} />
          <Detail label="Amount Per Payment" value={`${amountPerPayment} USDC`} />
          <Detail label="Escrow Balance" value={`${depositedAmount} USDC`} />
          <Detail label="Execution Interval" value={intervalSeconds ? formatInterval(intervalSeconds) : "Unknown"} />
          <Detail label="Token" value={token ?? indexed?.token ?? "USDC"} href={token ? explorerLink(arcExplorer, "address", token) : null} />
          <Detail label="Creator" value={schedule?.creator ?? indexed?.creator ?? crossChain?.schedule_id ?? "-"} href={schedule?.creator ? explorerLink(arcExplorer, "address", schedule.creator) : null} className="md:col-span-2" />
          <Detail label="Destination" value={destinationLabel ?? "Arc"} />
        </div>

        {crossChain ? (
          <div className="mt-6 rounded-2xl border border-cyan-500/15 bg-cyan-500/5 p-4">
            <p className="text-xs uppercase tracking-[0.25em] text-cyan-300/70">Cross-chain details</p>
            <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Detail label="Destination recipient" value={crossChain.destination_recipient} href={explorerLink(explorer, "address", crossChain.destination_recipient)} />
              <Detail label="Destination USDC" value={crossChain.destination_usdc_address} href={explorerLink(explorer, "address", crossChain.destination_usdc_address)} />
              <Detail label="Message transmitter" value={crossChain.message_transmitter_address} href={explorerLink(explorer, "address", crossChain.message_transmitter_address)} />
            </div>
            {crossChain.memo ? <p className="mt-3 text-sm text-slate-300">{crossChain.memo}</p> : null}
          </div>
        ) : null}
      </Card>

      <Card>
        <h3 className="text-base font-semibold text-slate-100">Payment Timeline</h3>
        <div className="mt-3 space-y-3">
          {paymentTimeline.length === 0 ? (
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-sm text-slate-400">
              No payment history found for this schedule.
            </div>
          ) : (
            paymentTimeline.map((item: PaymentTimelineItem) => (
              <div key={item.txHash} className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-sm text-slate-300">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span>
                    {item.label} - {item.amount} USDC
                  </span>
                  <span className="text-xs text-slate-400">{item.when}</span>
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  {item.txHref ? (
                    <Link href={item.txHref} target="_blank" rel="noreferrer" className="text-cyan-300 hover:underline">
                      {shortHash(item.txHash)}
                    </Link>
                  ) : (
                    <span>{shortHash(item.txHash)}</span>
                  )}
                  {item.reason ? <span> · {item.reason}</span> : null}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {bridgeTimeline.length > 0 ? (
        <Card>
          <h3 className="text-base font-semibold text-slate-100">Bridge Timeline</h3>
          <div className="mt-3 space-y-3">
            {bridgeTimeline.map((item: BridgeTimelineItem) => (
              <div key={`${item.burnTxHash ?? item.mintTxHash ?? item.when}`} className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-sm text-slate-300">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span>
                    {item.status === "failed" ? "Bridge failed" : "Bridge completed"} - {item.amount} USDC
                  </span>
                  <span className="text-xs text-slate-400">{item.when}</span>
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  {item.burnHref ? (
                    <Link href={item.burnHref} target="_blank" rel="noreferrer" className="text-cyan-300 hover:underline">
                      Burn: {shortHash(item.burnTxHash ?? "")}
                    </Link>
                  ) : item.burnTxHash ? (
                    <span>Burn: {shortHash(item.burnTxHash)}</span>
                  ) : null}
                  {item.mintHref ? (
                    <>
                      <span> · </span>
                      <Link href={item.mintHref} target="_blank" rel="noreferrer" className="text-cyan-300 hover:underline">
                        Mint: {shortHash(item.mintTxHash ?? "")}
                      </Link>
                    </>
                  ) : item.mintTxHash ? (
                    <span> · Mint: {shortHash(item.mintTxHash)}</span>
                  ) : null}
                  {item.reason ? <span> · {item.reason}</span> : null}
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function Detail({
  label,
  value,
  href,
  className,
}: {
  label: string;
  value: string;
  href?: string | null;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-xs text-slate-400">{label}</p>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" className="mt-1 block break-all text-sm leading-5 text-cyan-300 hover:underline">
          {value}
        </a>
      ) : (
        <p className="mt-1 break-words text-sm leading-5 text-slate-200">{value}</p>
      )}
    </div>
  );
}

function formatInterval(seconds: number) {
  if (seconds % 86400 === 0) {
    const days = seconds / 86400;
    return days === 1 ? "Every day" : `Every ${days} days`;
  }
  if (seconds % 3600 === 0) {
    const hours = seconds / 3600;
    return hours === 1 ? "Every hour" : `Every ${hours} hours`;
  }
  if (seconds % 60 === 0) {
    const minutes = seconds / 60;
    return minutes === 1 ? "Every minute" : `Every ${minutes} minutes`;
  }
  return `Every ${seconds} seconds`;
}
