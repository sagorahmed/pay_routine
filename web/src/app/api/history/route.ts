import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, formatUnits, http, isAddress } from "viem";
import { z } from "zod";
import { arcChain } from "@/lib/chain";
import { recurringPaymentAbi, recurringPaymentAddress } from "@/lib/contract";
import { CCTP_DESTINATION_CHAINS } from "@/lib/cctp";
import { db } from "@/lib/server/db";

const querySchema = z.object({
  address: z.string().trim().refine(isAddress, "Invalid wallet address"),
});

type PaymentRow = {
  schedule_id: string;
  tx_hash: string;
  amount: string;
  status: "success" | "failed";
  reason: string | null;
  executed_at: Date;
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

type BridgeRow = {
  schedule_id: string;
  source_payment_tx_hash: string;
  burn_tx_hash: string | null;
  mint_tx_hash: string | null;
  destination_chain_id: number;
  destination_domain: number;
  amount: string;
  status: "success" | "failed";
  reason: string | null;
  created_at: Date;
  destination_recipient: string | null;
};

type ScheduleRow = {
  schedule_id: string;
  creator: string;
  destination_chain_id: number;
  destination_domain: number;
  destination_recipient: string;
};

const recurringAbi = [
  {
    type: "function",
    name: "getSchedule",
    stateMutability: "view",
    inputs: [{ name: "scheduleId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "creator", type: "address" },
          { name: "recipient", type: "address" },
          { name: "token", type: "address" },
          { name: "amountPerPayment", type: "uint128" },
          { name: "totalPayments", type: "uint32" },
          { name: "remainingPayments", type: "uint32" },
          { name: "nextExecution", type: "uint64" },
          { name: "intervalSeconds", type: "uint64" },
          { name: "depositedAmount", type: "uint128" },
          { name: "active", type: "bool" },
          { name: "paused", type: "bool" },
          { name: "cancelled", type: "bool" },
          { name: "executorReward", type: "uint96" },
        ],
      },
    ],
  },
] as const;

async function ensureHistoryTables() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS cctp_bridge_history (
      id BIGSERIAL PRIMARY KEY,
      schedule_id TEXT NOT NULL,
      source_payment_tx_hash TEXT NOT NULL,
      burn_tx_hash TEXT,
      mint_tx_hash TEXT,
      destination_chain_id INTEGER NOT NULL,
      destination_domain INTEGER NOT NULL,
      amount TEXT NOT NULL,
      status TEXT NOT NULL,
      reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(source_payment_tx_hash)
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS cross_chain_schedules (
      schedule_id TEXT PRIMARY KEY,
      creator VARCHAR(42) NOT NULL,
      destination_chain_id INTEGER NOT NULL,
      destination_domain INTEGER NOT NULL,
      destination_recipient VARCHAR(42) NOT NULL,
      destination_usdc_address VARCHAR(42) NOT NULL,
      message_transmitter_address VARCHAR(42) NOT NULL,
      memo TEXT,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

function destinationLabel(chainId: number): string {
  return CCTP_DESTINATION_CHAINS.find((item) => item.chain.id === chainId)?.label ?? `Chain ${chainId}`;
}

function normalizeAmount(amount: string): string {
  try {
    return formatUnits(BigInt(amount), 6);
  } catch {
    return amount;
  }
}

export async function GET(request: NextRequest) {
  try {
    if (!recurringPaymentAddress) {
      return NextResponse.json({ ok: false, error: "NEXT_PUBLIC_RECURRING_PAYMENT_ADDRESS is missing" }, { status: 500 });
    }

    const address = request.nextUrl.searchParams.get("address") ?? "";
    const parsed = querySchema.safeParse({ address });
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid address" }, { status: 400 });
    }

    await ensureHistoryTables();

    const publicClient = createPublicClient({
      chain: arcChain,
      transport: http(arcChain.rpcUrls.default.http[0]),
    });

    const scheduleIds = (await publicClient.readContract({
      abi: recurringPaymentAbi,
      address: recurringPaymentAddress as `0x${string}`,
      functionName: "getSchedulesByUser",
      args: [parsed.data.address as `0x${string}`],
    })) as bigint[];

    const scheduleIdsText = scheduleIds.map((id) => id.toString());

    if (scheduleIdsText.length === 0) {
      return NextResponse.json({
        ok: true,
        data: {
          address: parsed.data.address,
          summary: {
            schedules: 0,
            payments: 0,
            bridges: 0,
            successes: 0,
            failures: 0,
          },
          items: [],
        },
      });
    }

    const onChainSchedules = await Promise.all(
      scheduleIdsText.map(async (scheduleId) => {
        try {
          const schedule = (await publicClient.readContract({
            abi: recurringAbi,
            address: recurringPaymentAddress as `0x${string}`,
            functionName: "getSchedule",
            args: [BigInt(scheduleId)],
          })) as OnChainSchedule;

          return [scheduleId, schedule] as const;
        } catch {
          return [scheduleId, null] as const;
        }
      }),
    );

    const onChainByScheduleId = new Map(onChainSchedules);

    const scheduleRows = await db.query<ScheduleRow>(
      `
        SELECT
          schedule_id,
          creator,
          destination_chain_id,
          destination_domain,
          destination_recipient
        FROM cross_chain_schedules
        WHERE schedule_id = ANY($1::text[])
      `,
      [scheduleIdsText],
    );

    const paymentRows = await db.query<PaymentRow>(
      `
        SELECT schedule_id, tx_hash, amount, status, reason, executed_at
        FROM payment_history
        WHERE schedule_id = ANY($1::text[])
        ORDER BY executed_at DESC
      `,
      [scheduleIdsText],
    );

    const bridgeRows = await db.query<BridgeRow>(
      `
        SELECT
          cbh.schedule_id,
          cbh.source_payment_tx_hash,
          cbh.burn_tx_hash,
          cbh.mint_tx_hash,
          cbh.destination_chain_id,
          cbh.destination_domain,
          cbh.amount,
          cbh.status,
          cbh.reason,
          cbh.created_at,
          ccs.destination_recipient
        FROM cctp_bridge_history cbh
        LEFT JOIN cross_chain_schedules ccs
          ON ccs.schedule_id = cbh.schedule_id
        WHERE cbh.schedule_id = ANY($1::text[])
        ORDER BY cbh.created_at DESC
      `,
      [scheduleIdsText],
    );

    const bridgeBySource = new Map<string, BridgeRow>();
    for (const bridge of bridgeRows.rows) {
      bridgeBySource.set(bridge.source_payment_tx_hash, bridge);
    }

    const items = paymentRows.rows.map((payment: PaymentRow) => {
      const bridge = bridgeBySource.get(payment.tx_hash);
      const schedule = scheduleRows.rows.find((item: ScheduleRow) => item.schedule_id === payment.schedule_id);
      const onChain = onChainByScheduleId.get(payment.schedule_id) ?? null;
      const destinationRecipient = schedule?.destination_recipient ?? bridge?.destination_recipient ?? null;

      return {
        kind: bridge ? "cross_chain" : "recurring",
        scheduleId: payment.schedule_id,
        scheduleDestination: schedule ? destinationLabel(schedule.destination_chain_id) : null,
        destinationRecipient,
        recipient: bridge ? destinationRecipient : onChain?.recipient ?? destinationRecipient,
        token: onChain?.token ?? null,
        explorerBaseUrl: arcChain.blockExplorers?.default?.url ?? null,
        payment: {
          txHash: payment.tx_hash,
          amount: normalizeAmount(payment.amount),
          rawAmount: payment.amount,
          status: payment.status,
          reason: payment.reason,
          executedAt: payment.executed_at,
        },
        bridge: bridge
          ? {
              sourcePaymentTxHash: bridge.source_payment_tx_hash,
              burnTxHash: bridge.burn_tx_hash,
              mintTxHash: bridge.mint_tx_hash,
              destinationChainId: bridge.destination_chain_id,
              destinationLabel: destinationLabel(bridge.destination_chain_id),
              amount: normalizeAmount(bridge.amount),
              rawAmount: bridge.amount,
              status: bridge.status,
              reason: bridge.reason,
              createdAt: bridge.created_at,
            }
          : null,
      };
    });

    const summary = {
      schedules: scheduleIdsText.length,
      payments: paymentRows.rows.length,
      bridges: bridgeRows.rows.length,
      successes: paymentRows.rows.filter((row: PaymentRow) => row.status === "success").length,
      failures:
        paymentRows.rows.filter((row: PaymentRow) => row.status === "failed").length +
        bridgeRows.rows.filter((row: BridgeRow) => row.status === "failed").length,
    };

    return NextResponse.json({
      ok: true,
      data: {
        address: parsed.data.address,
        summary,
        items,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to load history",
      },
      { status: 500 },
    );
  }
}
