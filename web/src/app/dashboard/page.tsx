import { format, formatDistanceToNow } from "date-fns";
import { createPublicClient, formatUnits, http } from "viem";
import { ActivityChart } from "@/components/dashboard/activity-chart";
import { OverviewCards } from "@/components/dashboard/overview-cards";
import { Card } from "@/components/ui/card";
import { arcChain } from "@/lib/chain";
import { recurringPaymentAbi, recurringPaymentAddress } from "@/lib/contract";
import { db } from "@/lib/server/db";

type DashboardMetric = {
  label: string;
  value: string;
  helper: string;
};

type ActivityPoint = {
  week: string;
  paid: number;
};

type UpcomingPayment = {
  scheduleId: string;
  recipient: string;
  amount: string;
  dueLabel: string;
};

type RecentActivity = {
  scheduleId: string;
  txHash: string;
  amount: string;
  status: "success" | "failed";
  whenLabel: string;
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

function formatUsdc(rawAmount: string): string {
  try {
    return formatUnits(BigInt(rawAmount), 6);
  } catch {
    return rawAmount;
  }
}

export default async function DashboardPage() {
  const publicClient = recurringPaymentAddress
    ? createPublicClient({
        chain: arcChain,
        transport: http(arcChain.rpcUrls.default.http[0]),
      })
    : null;

  const liveSchedules = publicClient && recurringPaymentAddress
    ? await (async () => {
        const nextScheduleId = (await publicClient.readContract({
          abi: recurringPaymentAbi,
          address: recurringPaymentAddress as `0x${string}`,
          functionName: "nextScheduleId",
        })) as bigint;

        if (nextScheduleId <= 1n) {
          return [] as OnChainSchedule[];
        }

        const scheduleIds = Array.from({ length: Number(nextScheduleId - 1n) }, (_, index) => BigInt(index + 1));
        const schedules = await Promise.all(
          scheduleIds.map(async (scheduleId) => {
            try {
              return (await publicClient.readContract({
                abi: recurringPaymentAbi,
                address: recurringPaymentAddress as `0x${string}`,
                functionName: "getSchedule",
                args: [scheduleId],
              })) as OnChainSchedule;
            } catch {
              return null;
            }
          }),
        );

        return schedules.filter((schedule): schedule is OnChainSchedule => Boolean(schedule));
      })()
    : [];

  const [activityResult, upcomingResult, recentResult, indexedSummaryResult] = await Promise.all([
    db.query<{
      week_start: Date;
      paid_raw: string | null;
    }>(`
      SELECT
        date_trunc('week', executed_at) AS week_start,
        COALESCE(SUM(amount::numeric), 0)::text AS paid_raw
      FROM payment_history
      WHERE executed_at >= NOW() - INTERVAL '6 weeks'
      GROUP BY 1
      ORDER BY 1 ASC
    `),
    db.query<{
      schedule_id: string;
      recipient: string;
      amount_per_payment: string;
      next_execution: Date;
    }>(`
      SELECT schedule_id, recipient, amount_per_payment, next_execution
      FROM indexed_schedules
      WHERE active = TRUE AND paused = FALSE AND cancelled = FALSE
      ORDER BY next_execution ASC
      LIMIT 4
    `),
    db.query<{
      schedule_id: string;
      tx_hash: string;
      amount: string;
      status: string;
      executed_at: Date;
    }>(`
      SELECT schedule_id, tx_hash, amount, status, executed_at
      FROM payment_history
      ORDER BY executed_at DESC
      LIMIT 4
    `),
    db.query<{
      total_escrow_raw: string | null;
      paused_cancelled: number;
    }>(`
      SELECT
        COALESCE(SUM(deposited_amount::numeric), 0)::text AS total_escrow_raw,
        COUNT(*) FILTER (WHERE paused = TRUE OR cancelled = TRUE)::int AS paused_cancelled
      FROM indexed_schedules
    `),
  ]);

  const liveSummary = liveSchedules.reduce(
    (accumulator, schedule) => {
      accumulator.totalEscrowRaw += schedule.depositedAmount;
      if (schedule.active && !schedule.paused && !schedule.cancelled) {
        accumulator.activeSchedules += 1;
      }
      if (!schedule.cancelled && schedule.remainingPayments === 0) {
        accumulator.completedSchedules += 1;
      }
      if (schedule.paused || schedule.cancelled) {
        accumulator.pausedCancelled += 1;
      }
      if (!schedule.active && !schedule.paused && !schedule.cancelled) {
        accumulator.failedExecutions24h += 1;
      }
      return accumulator;
    },
    {
      totalEscrowRaw: 0n,
      activeSchedules: 0,
      completedSchedules: 0,
      pausedCancelled: 0,
      failedExecutions24h: 0,
    },
  );

  const indexedSummary = indexedSummaryResult.rows[0] ?? {
    total_escrow_raw: "0",
    paused_cancelled: 0,
  };

  const metrics: DashboardMetric[] = [
    {
      label: "Total Escrow",
      value: `${formatUsdc(liveSummary.totalEscrowRaw.toString() ?? indexedSummary.total_escrow_raw ?? "0")} USDC`,
      helper: liveSchedules.length > 0 ? "Live on-chain total" : "Fallback to indexed escrow records",
    },
    {
      label: "Active Schedules",
      value: String(liveSummary.activeSchedules),
      helper: `${liveSchedules.length} schedule${liveSchedules.length === 1 ? "" : "s"} scanned on-chain`,
    },
    {
      label: "Completed",
      value: String(liveSummary.completedSchedules),
      helper: "Schedules with no remaining payments",
    },
    {
      label: "Paused/Cancelled",
      value: String(liveSummary.pausedCancelled + indexedSummary.paused_cancelled),
      helper: "Needs user action or cleanup",
    },
  ];

  const chartData: ActivityPoint[] = activityResult.rows.map((row: { week_start: Date; paid_raw: string | null }) => ({
    week: format(row.week_start, "MMM d"),
    paid: Number(formatUsdc(row.paid_raw ?? "0")),
  }));

  const upcomingPayments: UpcomingPayment[] = upcomingResult.rows.map((row: { schedule_id: string; recipient: string; amount_per_payment: string; next_execution: Date }) => ({
    scheduleId: row.schedule_id,
    recipient: row.recipient,
    amount: formatUsdc(row.amount_per_payment),
    dueLabel: formatDistanceToNow(new Date(row.next_execution), { addSuffix: true }),
  }));

  const recentActivity: RecentActivity[] = recentResult.rows.map((row: { schedule_id: string; tx_hash: string; amount: string; status: string; executed_at: Date }) => ({
    scheduleId: row.schedule_id,
    txHash: row.tx_hash,
    amount: formatUsdc(row.amount),
    status: row.status === "failed" ? "failed" : "success",
    whenLabel: formatDistanceToNow(new Date(row.executed_at), { addSuffix: true }),
  }));

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 md:px-8">
      <section>
        <h1 className="text-3xl font-black text-slate-100">Dashboard</h1>
        <p className="mt-1 text-slate-400">Operational pulse for recurring USDC streams.</p>
      </section>
      <OverviewCards metrics={metrics} />
      <section className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <ActivityChart data={chartData} />
        </div>
        <Card>
          <h2 className="text-sm font-semibold text-slate-200">Upcoming Payments</h2>
          <div className="mt-4 space-y-3">
            {upcomingPayments.length === 0 ? (
              <div className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-sm text-slate-400">
                No active schedules with a next execution time yet.
              </div>
            ) : (
              upcomingPayments.map((item) => (
                <div key={item.scheduleId} className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-sm text-slate-300">
                  <div className="flex items-center justify-between gap-3">
                    <span>Schedule #{item.scheduleId}</span>
                    <span>{item.amount} USDC</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    Recipient {item.recipient} · due {item.dueLabel}
                  </p>
                </div>
              ))
            )}
          </div>
        </Card>
      </section>

      <Card>
        <h2 className="text-sm font-semibold text-slate-200">Recent Activity</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {recentActivity.length === 0 ? (
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-sm text-slate-400">
              No recent executions yet.
            </div>
          ) : (
            recentActivity.map((item) => (
              <div key={item.txHash} className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-sm text-slate-300">
                <div className="flex items-center justify-between gap-3">
                  <span>Schedule #{item.scheduleId}</span>
                  <span className={item.status === "failed" ? "text-rose-300" : "text-emerald-300"}>
                    {item.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  {item.amount} USDC · {item.whenLabel}
                </p>
              </div>
            ))
          )}
        </div>
      </Card>
    </main>
  );
}
