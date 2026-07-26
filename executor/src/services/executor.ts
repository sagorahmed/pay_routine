import { getAddress } from "viem";
import { bridgeDuePaymentFromArc } from "../lib/cctp";
import { contract, executorAddress, publicClient, walletClient } from "../lib/chain";
import { config } from "../lib/config";
import {
  getCrossChainSchedule,
  getDueSchedules,
  getPendingCrossChainBridgePayments,
  upsertCctpBridgeHistory,
  upsertPaymentHistory,
} from "../lib/db";
import { logger } from "../lib/logger";
import { sendNotification } from "./notifications";

type OnChainSchedule = {
  creator: `0x${string}`;
  recipient: `0x${string}`;
  token: `0x${string}`;
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

type DueScheduleRow = {
  schedule_id: string;
  on_chain?: OnChainSchedule;
};

async function retry<T>(fn: () => Promise<T>, retries: number, baseDelay = 1500): Promise<T> {
  let attempt = 0;

  while (true) {
    try {
      return await fn();
    } catch (error) {
      attempt += 1;
      if (attempt > retries) {
        throw error;
      }
      const delay = baseDelay * 2 ** (attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

async function backfillPendingCrossChainBridges() {
  const pending = await getPendingCrossChainBridgePayments(100);
  if (pending.length === 0) {
    return;
  }

  logger.info({ pendingBridgeCount: pending.length }, "Processing pending cross-chain bridge backlog");

  for (const row of pending) {
    try {
      const amount = BigInt(row.amount);

      const bridgeResult = await bridgeDuePaymentFromArc({
        amount,
        destinationChainId: row.destination_chain_id,
        destinationDomain: row.destination_domain,
        destinationRecipient: row.destination_recipient as `0x${string}`,
        destinationUsdcAddress: row.destination_usdc_address as `0x${string}`,
        messageTransmitterAddress: row.message_transmitter_address as `0x${string}`,
      });

      await upsertCctpBridgeHistory({
        scheduleId: row.schedule_id,
        sourcePaymentTxHash: row.source_payment_tx_hash,
        burnTxHash: bridgeResult.burnTxHash,
        mintTxHash: bridgeResult.mintTxHash,
        destinationChainId: row.destination_chain_id,
        destinationDomain: row.destination_domain,
        amount: row.amount,
        status: "success",
      });
    } catch (error) {
      logger.error(
        { error, scheduleId: row.schedule_id, sourcePaymentTxHash: row.source_payment_tx_hash },
        "Backfill cross-chain bridge failed",
      );

      await upsertCctpBridgeHistory({
        scheduleId: row.schedule_id,
        sourcePaymentTxHash: row.source_payment_tx_hash,
        destinationChainId: row.destination_chain_id,
        destinationDomain: row.destination_domain,
        amount: row.amount,
        status: "failed",
        reason: error instanceof Error ? error.message : "Unknown backfill bridge error",
      });
    }
  }
}

export async function runExecutionCycle() {
  const now = new Date();
  let dueRows = (await getDueSchedules(now.toISOString())) as DueScheduleRow[];

  if (dueRows.length === 0) {
    const nowEpoch = Math.floor(Date.now() / 1000);
    const totalSchedules = Number(
      (await retry(
        async () =>
          (await publicClient.readContract({
            ...contract,
            functionName: "nextScheduleId",
          })) as bigint,
        config.RETRY_LIMIT,
        750,
      )) as bigint,
    );

    const discovered: DueScheduleRow[] = [];
    for (let id = 0; id < totalSchedules; id += 1) {
      const onChain = (await retry(
        async () =>
          (await publicClient.readContract({
            ...contract,
            functionName: "getSchedule",
            args: [BigInt(id)],
          })) as OnChainSchedule,
        config.RETRY_LIMIT,
        750,
      )) as OnChainSchedule;

      const isDue = Number(onChain.nextExecution) <= nowEpoch;
      if (!onChain.active || onChain.paused || onChain.cancelled || !isDue || onChain.remainingPayments === 0) {
        continue;
      }

      discovered.push({ schedule_id: String(id), on_chain: onChain });
    }

    if (discovered.length > 0) {
      logger.info(
        { discoveredDueCount: discovered.length },
        "No due rows in indexed_schedules; using on-chain fallback discovery",
      );
      dueRows = discovered;
    }
  }

  logger.info({ dueCount: dueRows.length }, "Fetched due schedules");

  for (const row of dueRows) {
    const scheduleId = BigInt(row.schedule_id);

    try {
      const onChain = row.on_chain
        ? row.on_chain
        : ((await retry(
            async () =>
              (await publicClient.readContract({
                ...contract,
                functionName: "getSchedule",
                args: [scheduleId],
              })) as OnChainSchedule,
            config.RETRY_LIMIT,
            750,
          )) as OnChainSchedule);

      const isDue = Number(onChain.nextExecution) <= Math.floor(Date.now() / 1000);

      if (!onChain.active || onChain.paused || onChain.cancelled || !isDue || onChain.remainingPayments === 0) {
        continue;
      }

      const txHash = await retry(
        async () =>
          walletClient.writeContract({
            ...contract,
            functionName: "executePayment",
            args: [scheduleId],
          }),
        config.RETRY_LIMIT,
      );

      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

      await upsertPaymentHistory({
        scheduleId: row.schedule_id,
        txHash,
        executor: getAddress(executorAddress),
        amount: String(onChain.amountPerPayment),
        status: receipt.status === "success" ? "success" : "failed",
        reason: receipt.status === "success" ? undefined : "Transaction reverted",
      });

      if (receipt.status === "success") {
        const crossChain = await getCrossChainSchedule(row.schedule_id);

        if (crossChain) {
          try {
            if (onChain.token.toLowerCase() !== (config.ARC_USDC_ADDRESS as string).toLowerCase()) {
              throw new Error("Cross-chain schedule token must be Arc USDC");
            }

            const bridgeResult = await bridgeDuePaymentFromArc({
              amount: onChain.amountPerPayment,
              destinationChainId: crossChain.destination_chain_id,
              destinationDomain: crossChain.destination_domain,
              destinationRecipient: crossChain.destination_recipient as `0x${string}`,
              destinationUsdcAddress: crossChain.destination_usdc_address as `0x${string}`,
              messageTransmitterAddress: crossChain.message_transmitter_address as `0x${string}`,
            });

            await upsertCctpBridgeHistory({
              scheduleId: row.schedule_id,
              sourcePaymentTxHash: txHash,
              burnTxHash: bridgeResult.burnTxHash,
              mintTxHash: bridgeResult.mintTxHash,
              destinationChainId: crossChain.destination_chain_id,
              destinationDomain: crossChain.destination_domain,
              amount: String(onChain.amountPerPayment),
              status: "success",
            });
          } catch (bridgeError) {
            logger.error({ bridgeError, scheduleId: row.schedule_id }, "Recurring CCTP bridge failed");

            await upsertCctpBridgeHistory({
              scheduleId: row.schedule_id,
              sourcePaymentTxHash: txHash,
              destinationChainId: crossChain.destination_chain_id,
              destinationDomain: crossChain.destination_domain,
              amount: String(onChain.amountPerPayment),
              status: "failed",
              reason: bridgeError instanceof Error ? bridgeError.message : "Unknown cross-chain bridge error",
            });

            await sendNotification({
              type: "execution_failed",
              scheduleId: row.schedule_id,
              reason:
                bridgeError instanceof Error
                  ? `Cross-chain bridge failed after executePayment: ${bridgeError.message}`
                  : "Cross-chain bridge failed after executePayment",
            });
          }
        }
      }

      await sendNotification({
        type: "payment_executed",
        scheduleId: row.schedule_id,
        txHash,
        status: receipt.status,
      });

      logger.info({ scheduleId: row.schedule_id, txHash }, "Payment execution complete");
    } catch (error) {
      logger.error({ error, scheduleId: row.schedule_id }, "Payment execution failed");

      await upsertPaymentHistory({
        scheduleId: row.schedule_id,
        txHash: `failed-${row.schedule_id}-${Date.now()}`,
        executor: getAddress(executorAddress),
        amount: "0",
        status: "failed",
        reason: error instanceof Error ? error.message : "Unknown error",
      });

      await sendNotification({
        type: "execution_failed",
        scheduleId: row.schedule_id,
        reason: error instanceof Error ? error.message : "Unknown",
      });
    }
  }

  await backfillPendingCrossChainBridges();
}
