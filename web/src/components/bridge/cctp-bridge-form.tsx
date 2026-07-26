"use client";

import { useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { useAccount, usePublicClient } from "wagmi";
import { BaseError, decodeEventLog, parseAbi, parseUnits } from "viem";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { frequencyOptions } from "@/lib/frequencies";
import { recurringPaymentAbi, recurringPaymentAddress } from "@/lib/contract";
import { ARC_USDC_ADDRESS, CCTP_DESTINATION_CHAINS } from "@/lib/cctp";
import { useRecurringContract } from "@/hooks/useRecurringContract";

const addressSchema = z
  .string()
  .trim()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Enter a valid EVM address");

const EXECUTOR_FEE_DENOMINATOR = BigInt(1_000_000);
const START_TIME_GRACE_SECONDS = 15;
const erc20ApprovalAbi = parseAbi(["function approve(address spender,uint256 value) returns (bool)"]);

function formatDateTimeLocal(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatCreateScheduleError(error: unknown): string {
  const message = error instanceof BaseError ? error.shortMessage : error instanceof Error ? error.message : String(error);

  const lower = message.toLowerCase();
  if (
    lower.includes("rate limit") ||
    lower.includes("rate limited") ||
    lower.includes("request limit reached") ||
    lower.includes("http 429") ||
    lower.includes("too many requests")
  ) {
    return "RPC provider is rate limiting requests right now. The contract did not fail business validation. Retry in a few seconds or switch to a higher-capacity RPC endpoint.";
  }

  if (message.includes("InvalidRecipient")) return "Executor recipient config is invalid.";
  if (message.includes("InvalidToken")) return "Arc USDC token address is invalid for this network.";
  if (message.includes("InvalidAmount")) return "Amount is invalid or exceeds token/contract limits.";
  if (message.includes("InvalidPaymentCount")) return "Number of payments must be greater than 0.";
  if (message.includes("InvalidInterval")) return "Frequency interval is invalid.";
  if (message.includes("InvalidStartTime")) return "Start date is in the past. Pick a future time.";
  if (message.includes("transfer amount exceeds balance")) return "Insufficient USDC balance for total escrow.";
  if (message.includes("insufficient allowance")) return "USDC allowance is insufficient for total escrow.";

  return message;
}

const schema = z.object({
  destinationChainKey: z.string().min(1),
  destinationRecipient: addressSchema,
  amountPerPayment: z.number().positive(),
  frequency: z.string().min(1),
  startDate: z.string().min(1),
  totalPayments: z.number().int().positive().max(360),
  memo: z.string().max(200).optional(),
});

type FormValues = z.infer<typeof schema>;

export function CctpBridgeForm() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const startDateInputRef = useRef<HTMLInputElement>(null);
  const { writeContractAsync, isPending } = useRecurringContract();

  const [successInfo, setSuccessInfo] = useState<{
    approveHash: `0x${string}`;
    createHash: `0x${string}`;
    scheduleId: string;
  } | null>(null);

  const rawExecutorFeePercent = process.env.NEXT_PUBLIC_EXECUTOR_REWARD_PERCENT ?? "";
  const parsedExecutorFeePercent = Number(rawExecutorFeePercent);
  const isExecutorFeePercentValid =
    Number.isFinite(parsedExecutorFeePercent) && parsedExecutorFeePercent >= 0 && parsedExecutorFeePercent <= 100;
  const executorFeePercent = isExecutorFeePercentValid ? parsedExecutorFeePercent : 0;
  const executorFeePpm = Math.round(executorFeePercent * 10_000);

  const executorPayoutAddress =
    (process.env.NEXT_PUBLIC_CCTP_EXECUTOR_ADDRESS as `0x${string}` | undefined) ??
    (process.env.NEXT_PUBLIC_EXECUTOR_ADDRESS as `0x${string}` | undefined) ??
    "";

  const hasExecutorPayoutAddress = /^0x[a-fA-F0-9]{40}$/.test(executorPayoutAddress);
  const hasArcUsdcAddress = /^0x[a-fA-F0-9]{40}$/.test(ARC_USDC_ADDRESS);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      destinationChainKey: CCTP_DESTINATION_CHAINS[0].key,
      destinationRecipient: address ?? "",
      frequency: "monthly",
      totalPayments: 3,
    },
  });

  const values = useWatch({ control: form.control });
  const startDateField = form.register("startDate");

  const selectedDestinationChain = useMemo(
    () =>
      CCTP_DESTINATION_CHAINS.find((chain) => chain.key === values.destinationChainKey) ?? CCTP_DESTINATION_CHAINS[0],
    [values.destinationChainKey],
  );

  const intervalSeconds = useMemo(() => {
    const frequency = frequencyOptions.find((item) => item.value === values.frequency);
    return frequency?.seconds ?? 30 * 24 * 3600;
  }, [values.frequency]);

  const totalEscrow = useMemo(() => {
    const payout = Number(values.amountPerPayment || 0);
    const reward = payout * (executorFeePercent / 100);
    const count = Number(values.totalPayments || 0);
    return (payout + reward) * count;
  }, [values.amountPerPayment, values.totalPayments, executorFeePercent]);

  const rewardPerPayment = useMemo(() => {
    const payout = Number(values.amountPerPayment || 0);
    return payout * (executorFeePercent / 100);
  }, [values.amountPerPayment, executorFeePercent]);

  const minimumStartDate = useMemo(() => {
    const minMs = Date.now() + START_TIME_GRACE_SECONDS * 1000;
    const roundedToNextMinute = Math.ceil(minMs / 60000) * 60000;
    return formatDateTimeLocal(new Date(roundedToNextMinute));
  }, []);

  async function onSubmit(data: FormValues) {
    setSuccessInfo(null);

    if (!recurringPaymentAddress) {
      form.setError("memo", { message: "Missing NEXT_PUBLIC_RECURRING_PAYMENT_ADDRESS" });
      return;
    }

    if (!publicClient) {
      form.setError("memo", { message: "Wallet client unavailable. Reconnect wallet and try again." });
      return;
    }

    if (!hasArcUsdcAddress) {
      form.setError("memo", { message: "Missing or invalid NEXT_PUBLIC_ARC_USDC_ADDRESS" });
      return;
    }

    if (!hasExecutorPayoutAddress) {
      form.setError("memo", {
        message: "Missing NEXT_PUBLIC_CCTP_EXECUTOR_ADDRESS (executor wallet that receives each due payout).",
      });
      return;
    }

    if (recurringPaymentAddress && executorPayoutAddress.toLowerCase() === recurringPaymentAddress.toLowerCase()) {
      form.setError("memo", {
        message:
          "NEXT_PUBLIC_CCTP_EXECUTOR_ADDRESS cannot be the recurring contract address. Set it to the executor wallet address.",
      });
      return;
    }

    const executorRecipient = executorPayoutAddress as `0x${string}`;

    if (!isExecutorFeePercentValid) {
      form.setError("memo", {
        message: "Missing or invalid NEXT_PUBLIC_EXECUTOR_REWARD_PERCENT (must be 0-100)",
      });
      return;
    }

    const amountPerPayment = parseUnits(String(data.amountPerPayment), 6);
    const executorReward = (amountPerPayment * BigInt(executorFeePpm)) / EXECUTOR_FEE_DENOMINATOR;
    const totalDeposit = (amountPerPayment + executorReward) * BigInt(data.totalPayments);

    if (totalDeposit <= BigInt(0)) {
      form.setError("amountPerPayment", {
        message: "Total escrow is zero. Increase amount or payment count.",
      });
      return;
    }

    const startTimestampMs = new Date(data.startDate).getTime();
    if (!Number.isFinite(startTimestampMs)) {
      form.setError("startDate", { message: "Start date is invalid." });
      return;
    }

    if (startTimestampMs <= Date.now() + START_TIME_GRACE_SECONDS * 1000) {
      form.setError("startDate", {
        message: `Start date must be at least ${START_TIME_GRACE_SECONDS} seconds in the future.`,
      });
      return;
    }

    const startTimestamp = Math.floor(startTimestampMs / 1000);

    try {
      const approveHash = await writeContractAsync({
        abi: erc20ApprovalAbi,
        address: ARC_USDC_ADDRESS,
        functionName: "approve",
        args: [recurringPaymentAddress, totalDeposit],
      });

      const approveReceipt = await publicClient.waitForTransactionReceipt({ hash: approveHash });
      if (approveReceipt.status !== "success") {
        form.setError("memo", { message: "Approve transaction failed on-chain." });
        return;
      }

      await publicClient.simulateContract({
        abi: recurringPaymentAbi,
        address: recurringPaymentAddress,
        functionName: "createSchedule",
        args: [
          executorRecipient,
          ARC_USDC_ADDRESS,
          amountPerPayment,
          Number(data.totalPayments),
          BigInt(startTimestamp),
          BigInt(intervalSeconds),
          executorReward,
        ],
        account: address,
      });

      const createHash = await writeContractAsync({
        abi: recurringPaymentAbi,
        address: recurringPaymentAddress,
        functionName: "createSchedule",
        args: [
          executorRecipient,
          ARC_USDC_ADDRESS,
          amountPerPayment,
          Number(data.totalPayments),
          BigInt(startTimestamp),
          BigInt(intervalSeconds),
          executorReward,
        ],
      });

      const createReceipt = await publicClient.waitForTransactionReceipt({ hash: createHash });
      if (createReceipt.status !== "success") {
        form.setError("memo", {
          message: "Create schedule transaction reverted. Check USDC balance and allowance.",
        });
        return;
      }

      let createdScheduleId: bigint | null = null;
      for (const log of createReceipt.logs) {
        try {
          const decoded = decodeEventLog({
            abi: recurringPaymentAbi,
            data: log.data,
            topics: log.topics,
          });
          if (decoded.eventName === "ScheduleCreated") {
            createdScheduleId = decoded.args.scheduleId as bigint;
            break;
          }
        } catch {
          // Ignore unrelated logs.
        }
      }

      if (createdScheduleId === null) {
        form.setError("memo", { message: "Schedule was created, but ScheduleCreated event parsing failed." });
        return;
      }

      const metadataResponse = await fetch("/api/cctp-schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduleId: createdScheduleId.toString(),
          creator: address,
          destinationChainId: selectedDestinationChain.chain.id,
          destinationDomain: selectedDestinationChain.domain,
          destinationRecipient: data.destinationRecipient,
          destinationUsdcAddress: selectedDestinationChain.usdcAddress,
          messageTransmitterAddress: selectedDestinationChain.messageTransmitterAddress,
          memo: data.memo ?? null,
        }),
      });

      if (!metadataResponse.ok) {
        const payload = await metadataResponse.json().catch(() => null);
        const message = payload && typeof payload.error === "string" ? payload.error : "Failed to save CCTP metadata";
        form.setError("memo", { message });
        return;
      }

      setSuccessInfo({ approveHash, createHash, scheduleId: createdScheduleId.toString() });
      form.clearErrors("memo");
    } catch (error) {
      form.setError("memo", {
        message: formatCreateScheduleError(error),
      });
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <Card>
        <h2 className="text-xl font-semibold text-slate-100">Create Recurring Cross-Chain Schedule (CCTP)</h2>
        <p className="mt-1 text-sm text-slate-400">
          Funds are escrowed on Arc now, then on each due interval PayRoutine executor receives the payout and bridges USDC
          to the destination chain automatically.
        </p>

        <form className="mt-6 space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-slate-300">Source Chain</label>
              <div className="flex h-10 items-center rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 text-sm text-cyan-200">
                Arc Network (fixed)
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm text-slate-300">Destination Chain</label>
              <select
                className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
                {...form.register("destinationChainKey")}
              >
                {CCTP_DESTINATION_CHAINS.map((chain) => (
                  <option key={chain.key} value={chain.key}>
                    {chain.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-300">Destination Recipient Address</label>
            <Input placeholder="0x..." {...form.register("destinationRecipient")} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-slate-300">Amount Per Payment (USDC)</label>
              <Input
                type="number"
                step="0.000001"
                {...form.register("amountPerPayment", { valueAsNumber: true })}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-300">Number of Payments</label>
              <Input type="number" {...form.register("totalPayments", { valueAsNumber: true })} />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-300">Frequency</label>
            <select
              className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
              {...form.register("frequency")}
            >
              {frequencyOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-300">Start Date</label>
            <div className="relative">
              <Input
                ref={(element) => {
                  startDateInputRef.current = element;
                  startDateField.ref(element);
                }}
                type="datetime-local"
                min={minimumStartDate}
                className="pr-28 [color-scheme:dark]"
                name={startDateField.name}
                onBlur={startDateField.onBlur}
                onChange={startDateField.onChange}
              />
              <Button
                type="button"
                variant="secondary"
                className="absolute right-1 top-1 h-8 px-3 text-xs"
                onClick={() => {
                  const input = startDateInputRef.current;
                  if (!input) return;
                  if (typeof input.showPicker === "function") {
                    input.showPicker();
                    return;
                  }
                  input.focus();
                }}
              >
                Pick Date
              </Button>
            </div>
            <p className="mt-1 text-xs text-slate-500">Select when the first payment should start.</p>
            {form.formState.errors.startDate?.message ? (
              <p className="mt-2 text-xs text-rose-400">{form.formState.errors.startDate.message}</p>
            ) : null}
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-300">Memo</label>
            <Input placeholder="Treasury payout to destination chain" {...form.register("memo")} />
            {form.formState.errors.memo?.message ? (
              <p className="mt-2 text-xs text-rose-400">{form.formState.errors.memo.message}</p>
            ) : null}
          </div>

          {successInfo ? (
            <Card className="border-emerald-500/40 bg-emerald-950/20 p-4">
              <p className="text-sm font-medium text-emerald-300">Cross-chain schedule created successfully on-chain</p>
              <p className="mt-1 text-xs text-emerald-200/80">Schedule ID: {successInfo.scheduleId}</p>
              <p className="text-xs text-emerald-200/80">Approve tx: {successInfo.approveHash}</p>
              <p className="text-xs text-emerald-200/80">Create tx: {successInfo.createHash}</p>
            </Card>
          ) : null}

          <Card className="border-slate-700 bg-slate-950/80 p-4">
            <p className="text-sm text-slate-300">Review</p>
            <p className="mt-2 text-sm text-slate-400">Escrow token: USDC on Arc ({ARC_USDC_ADDRESS})</p>
            <p className="text-sm text-slate-400">Destination: {selectedDestinationChain.label}</p>
            <p className="text-sm text-slate-400">Interval: {intervalSeconds} seconds</p>
            <p className="text-sm text-slate-400">Fee: {executorFeePercent.toFixed(2)}% per payment</p>
            <p className="text-sm text-slate-400">Fee per payment: {rewardPerPayment.toFixed(6)} USDC</p>
            <p className="text-sm text-slate-400">Total escrow required: {totalEscrow.toFixed(6)} USDC</p>
            <p className="text-sm text-slate-500">
              You will confirm 2 wallet transactions now: Approve, then Create Schedule. Recurring bridges are handled by
              PayRoutine scheduler at each due interval.
            </p>
            {!isExecutorFeePercentValid ? (
              <p className="mt-2 text-xs text-rose-400">
                Set NEXT_PUBLIC_EXECUTOR_REWARD_PERCENT (0-100) to enable schedule creation.
              </p>
            ) : null}
          </Card>

          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={!isConnected || isPending || !isExecutorFeePercentValid}>
              {isPending ? "Submitting..." : "Create Cross-Chain Schedule"}
            </Button>
          </div>
        </form>
      </Card>
    </motion.div>
  );
}
