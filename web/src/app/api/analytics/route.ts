import { NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { formatUnits } from "viem";

function formatUsdc(rawAmount: string): string {
  try {
    return formatUnits(BigInt(rawAmount), 6);
  } catch {
    return rawAmount;
  }
}

export async function GET() {
  const [summaryResult] = await Promise.all([
    db.query<{
      total_escrow_raw: string | null;
      active_schedules: number;
      completed_schedules: number;
      failed_executions_24h: number;
    }>(`
      SELECT
        COALESCE(SUM(deposited_amount::numeric), 0)::text AS total_escrow_raw,
        COUNT(*) FILTER (WHERE active = TRUE AND paused = FALSE AND cancelled = FALSE)::int AS active_schedules,
        COUNT(*) FILTER (WHERE cancelled = FALSE AND remaining_payments = 0)::int AS completed_schedules,
        COUNT(*) FILTER (WHERE status = 'failed' AND executed_at >= NOW() - INTERVAL '24 hours')::int AS failed_executions_24h
      FROM indexed_schedules
      LEFT JOIN payment_history ON payment_history.schedule_id = indexed_schedules.schedule_id
    `),
  ]);

  const summary = summaryResult.rows[0] ?? {
    total_escrow_raw: "0",
    active_schedules: 0,
    completed_schedules: 0,
    failed_executions_24h: 0,
  };

  return NextResponse.json({
    ok: true,
    data: {
      totalEscrow: formatUsdc(summary.total_escrow_raw ?? "0"),
      activeSchedules: summary.active_schedules,
      completedSchedules: summary.completed_schedules,
      failedExecutions24h: summary.failed_executions_24h,
      generatedAt: new Date().toISOString(),
    },
  });
}
