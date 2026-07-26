import { Pool } from "pg";
import { config } from "./config";

export const db = new Pool({
  connectionString: config.DATABASE_URL,
});

export async function ensureExecutorTables() {
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
}

export async function getDueSchedules(nowIso: string) {
  const { rows } = await db.query(
    `
      SELECT schedule_id, next_execution, active, paused, cancelled
      FROM indexed_schedules
      WHERE active = true
      AND paused = false
      AND cancelled = false
      AND next_execution <= $1
      ORDER BY next_execution ASC
      LIMIT 200
    `,
    [nowIso],
  );

  return rows;
}

export type CrossChainScheduleRow = {
  schedule_id: string;
  destination_chain_id: number;
  destination_domain: number;
  destination_recipient: string;
  destination_usdc_address: string;
  message_transmitter_address: string;
  active: boolean;
};

export async function getCrossChainSchedule(scheduleId: string): Promise<CrossChainScheduleRow | null> {
  const { rows } = await db.query<CrossChainScheduleRow>(
    `
      SELECT
        schedule_id,
        destination_chain_id,
        destination_domain,
        destination_recipient,
        destination_usdc_address,
        message_transmitter_address,
        active
      FROM cross_chain_schedules
      WHERE schedule_id = $1
        AND active = TRUE
      LIMIT 1
    `,
    [scheduleId],
  );

  return rows[0] ?? null;
}

export async function upsertCctpBridgeHistory(input: {
  scheduleId: string;
  sourcePaymentTxHash: string;
  burnTxHash?: string;
  mintTxHash?: string;
  destinationChainId: number;
  destinationDomain: number;
  amount: string;
  status: "success" | "failed";
  reason?: string;
}) {
  await db.query(
    `
      INSERT INTO cctp_bridge_history (
        schedule_id,
        source_payment_tx_hash,
        burn_tx_hash,
        mint_tx_hash,
        destination_chain_id,
        destination_domain,
        amount,
        status,
        reason,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      ON CONFLICT (source_payment_tx_hash) DO UPDATE
      SET burn_tx_hash = EXCLUDED.burn_tx_hash,
          mint_tx_hash = EXCLUDED.mint_tx_hash,
          status = EXCLUDED.status,
          reason = EXCLUDED.reason
    `,
    [
      input.scheduleId,
      input.sourcePaymentTxHash,
      input.burnTxHash ?? null,
      input.mintTxHash ?? null,
      input.destinationChainId,
      input.destinationDomain,
      input.amount,
      input.status,
      input.reason ?? null,
    ],
  );
}

export type PendingCrossChainBridgePayment = {
  schedule_id: string;
  source_payment_tx_hash: string;
  amount: string;
  destination_chain_id: number;
  destination_domain: number;
  destination_recipient: string;
  destination_usdc_address: string;
  message_transmitter_address: string;
};

export async function getPendingCrossChainBridgePayments(limit = 50): Promise<PendingCrossChainBridgePayment[]> {
  const { rows } = await db.query<PendingCrossChainBridgePayment>(
    `
      SELECT
        ph.schedule_id,
        ph.tx_hash AS source_payment_tx_hash,
        ph.amount,
        ccs.destination_chain_id,
        ccs.destination_domain,
        ccs.destination_recipient,
        ccs.destination_usdc_address,
        ccs.message_transmitter_address
      FROM payment_history ph
      INNER JOIN cross_chain_schedules ccs
        ON ccs.schedule_id = ph.schedule_id
      LEFT JOIN cctp_bridge_history cbh
        ON cbh.source_payment_tx_hash = ph.tx_hash
      WHERE ph.status = 'success'
        AND ccs.active = TRUE
        AND cbh.source_payment_tx_hash IS NULL
      ORDER BY ph.executed_at ASC
      LIMIT $1
    `,
    [limit],
  );

  return rows;
}

export async function upsertPaymentHistory(input: {
  scheduleId: string;
  txHash: string;
  executor: string;
  amount: string;
  status: "success" | "failed";
  reason?: string;
}) {
  await db.query(
    `
      INSERT INTO payment_history (schedule_id, tx_hash, executor, amount, status, reason, executed_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (tx_hash) DO UPDATE
      SET status = EXCLUDED.status,
          reason = EXCLUDED.reason
    `,
    [input.scheduleId, input.txHash, input.executor, input.amount, input.status, input.reason ?? null],
  );
}
