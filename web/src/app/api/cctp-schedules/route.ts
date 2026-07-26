import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";

const bodySchema = z.object({
  scheduleId: z.string().min(1),
  creator: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  destinationChainId: z.number().int().positive(),
  destinationDomain: z.number().int().nonnegative(),
  destinationRecipient: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  destinationUsdcAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  messageTransmitterAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  memo: z.string().max(200).nullable().optional(),
});

async function ensureCrossChainSchedulesTable() {
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

export async function POST(request: NextRequest) {
  try {
    const json = await request.json();
    const parsed = bodySchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid payload" }, { status: 400 });
    }

    await ensureCrossChainSchedulesTable();

    const payload = parsed.data;

    await db.query(
      `
        INSERT INTO cross_chain_schedules (
          schedule_id,
          creator,
          destination_chain_id,
          destination_domain,
          destination_recipient,
          destination_usdc_address,
          message_transmitter_address,
          memo,
          active,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, NOW())
        ON CONFLICT (schedule_id) DO UPDATE
        SET creator = EXCLUDED.creator,
            destination_chain_id = EXCLUDED.destination_chain_id,
            destination_domain = EXCLUDED.destination_domain,
            destination_recipient = EXCLUDED.destination_recipient,
            destination_usdc_address = EXCLUDED.destination_usdc_address,
            message_transmitter_address = EXCLUDED.message_transmitter_address,
            memo = EXCLUDED.memo,
            active = TRUE,
            updated_at = NOW()
      `,
      [
        payload.scheduleId,
        payload.creator,
        payload.destinationChainId,
        payload.destinationDomain,
        payload.destinationRecipient,
        payload.destinationUsdcAddress,
        payload.messageTransmitterAddress,
        payload.memo ?? null,
      ],
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to persist cross-chain schedule metadata",
      },
      { status: 500 },
    );
  }
}
