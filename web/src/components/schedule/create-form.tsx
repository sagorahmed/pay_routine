"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useAccount, usePublicClient } from "wagmi";
import { BaseError, decodeEventLog, parseAbi, parseUnits } from "viem";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FloatingInput } from "@/components/ui/floating-input";
import { Input } from "@/components/ui/input";
import { frequencyOptions } from "@/lib/frequencies";
import { estimateBufferedContractGas } from "@/lib/gas";
import { recurringPaymentAbi, recurringPaymentAddress } from "@/lib/contract";
import { useRecurringContract } from "@/hooks/useRecurringContract";

const addressSchema = z
  .string()
  .trim()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Enter a valid EVM address");

const EXECUTOR_FEE_DENOMINATOR = BigInt(1_000_000);
const START_TIME_GRACE_SECONDS = 15;
const erc20ApprovalAbi = parseAbi([
  "function approve(address spender,uint256 value) returns (bool)",
]);

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

  if (message.includes("InvalidRecipient")) return "Recipient cannot be zero address or your own wallet.";
  if (message.includes("InvalidToken")) return "Token address is invalid for this network.";
  if (message.includes("InvalidAmount")) return "Amount is invalid or exceeds token/contract limits.";
  if (message.includes("InvalidPaymentCount")) return "Number of payments must be greater than 0.";
  if (message.includes("InvalidInterval")) return "Frequency interval is invalid.";
  if (message.includes("InvalidStartTime")) return "Start date is in the past. Pick a future time.";
  if (message.includes("transfer amount exceeds balance")) return "Insufficient token balance for total escrow.";
  if (message.includes("insufficient allowance")) return "Token allowance is insufficient for total escrow.";

  return message;
}

const schema = z.object({
  recipient: addressSchema,
  amountPerPayment: z.number().positive(),
  frequency: z.string().min(1),
  startDate: z.string().min(1),
  totalPayments: z.number().int().positive().max(360),
  memo: z.string().max(200).optional(),
});

type FormValues = z.infer<typeof schema>;

type CreateScheduleFormProps = {
  onStageChange?: (stage: "details" | "wallet") => void;
  onCreated?: (payload: { scheduleId: string | null; kind: "schedule" }) => void;
};

export function CreateScheduleForm({ onStageChange, onCreated }: CreateScheduleFormProps) {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const startDateInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [successInfo, setSuccessInfo] = useState<{
    approveHash: `0x${string}`;
    createHash: `0x${string}`;
    scheduleId: string | null;
  } | null>(null);
  const usdcTokenAddress =
    (process.env.NEXT_PUBLIC_USDC_TOKEN_ADDRESS as `0x${string}` | undefined) ??
    (process.env.NEXT_PUBLIC_USDC_TOKEN as `0x${string}` | undefined) ??
    "";
  const rawExecutorFeePercent = process.env.NEXT_PUBLIC_EXECUTOR_REWARD_PERCENT ?? "";
  const parsedExecutorFeePercent = Number(rawExecutorFeePercent);
  const isExecutorFeePercentValid =
    Number.isFinite(parsedExecutorFeePercent) && parsedExecutorFeePercent >= 0 && parsedExecutorFeePercent <= 100;
  const executorFeePercent = isExecutorFeePercentValid ? parsedExecutorFeePercent : 0;
  const executorFeePpm = Math.round(executorFeePercent * 10_000);
  const hasUsdcAddress = /^0x[a-fA-F0-9]{40}$/.test(usdcTokenAddress);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      frequency: "monthly",
      totalPayments: 3,
    },
  });

  const { writeContractAsync, isPending } = useRecurringContract();

  const values = useWatch({ control: form.control });
  const startDateField = form.register("startDate");

  const intervalSeconds = useMemo(() => {
    const frequency = frequencyOptions.find((item) => item.value === values.frequency);
    return frequency?.seconds ?? 30 * 24 * 3600;
  }, [values.frequency]);

  const showReviewCard = useMemo(() => {
    const hasRecipient = Boolean(values.recipient?.trim());
    const hasAmount = Number(values.amountPerPayment ?? 0) > 0;
    const hasPayments = Number(values.totalPayments ?? 0) > 0;
    const hasFrequency = Boolean(values.frequency);
    const hasStartDate = Boolean(values.startDate);

    return hasRecipient && hasAmount && hasPayments && hasFrequency && hasStartDate;
  }, [values.amountPerPayment, values.frequency, values.recipient, values.startDate, values.totalPayments]);

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

  useEffect(() => {
    if (!onStageChange || successInfo) {
      return;
    }

    onStageChange(isPending ? "wallet" : "details");
  }, [isPending, onStageChange, successInfo]);

  async function goToStepTwo() {
    const isStepOneValid = await form.trigger(["recipient", "amountPerPayment", "totalPayments", "frequency"]);
    if (!isStepOneValid) {
      return;
    }
    setStep(2);
  }

  async function onSubmit(data: FormValues) {
    setSuccessInfo(null);

    if (!recurringPaymentAddress) {
      form.setError("recipient", { message: "Missing NEXT_PUBLIC_RECURRING_PAYMENT_ADDRESS" });
      return;
    }

    if (!hasUsdcAddress) {
      form.setError("memo", { message: "Missing NEXT_PUBLIC_USDC_TOKEN_ADDRESS" });
      return;
    }

    if (!isExecutorFeePercentValid) {
      form.setError("memo", {
        message: "Missing or invalid NEXT_PUBLIC_EXECUTOR_REWARD_PERCENT (must be 0-100)",
      });
      return;
    }

    if (!publicClient) {
      form.setError("memo", { message: "Wallet client unavailable. Reconnect wallet and try again." });
      return;
    }

    if (address && data.recipient.toLowerCase() === address.toLowerCase()) {
      form.setError("recipient", { message: "Recipient cannot be your own wallet address." });
      return;
    }

    const tokenAddress = usdcTokenAddress;
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
      const approveGas = await estimateBufferedContractGas({
        client: publicClient,
        account: address,
        abi: erc20ApprovalAbi,
        address: tokenAddress as `0x${string}`,
        functionName: "approve",
        args: [recurringPaymentAddress, totalDeposit],
      });

      // Step 1: approve contract to pull escrow amount from user's wallet.
      const approveHash = await writeContractAsync({
        abi: erc20ApprovalAbi,
        address: tokenAddress as `0x${string}`,
        functionName: "approve",
        args: [recurringPaymentAddress, totalDeposit],
        gas: approveGas,
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
          data.recipient as `0x${string}`,
          tokenAddress as `0x${string}`,
          amountPerPayment,
          Number(data.totalPayments),
          BigInt(startTimestamp),
          BigInt(intervalSeconds),
          executorReward,
        ],
        account: address,
      });

      const createGas = await estimateBufferedContractGas({
        client: publicClient,
        account: address,
        abi: recurringPaymentAbi,
        address: recurringPaymentAddress,
        functionName: "createSchedule",
        args: [
          data.recipient as `0x${string}`,
          tokenAddress as `0x${string}`,
          amountPerPayment,
          Number(data.totalPayments),
          BigInt(startTimestamp),
          BigInt(intervalSeconds),
          executorReward,
        ],
      });

      // Step 2: create schedule and transfer funds into escrow via safeTransferFrom.
      const createHash = await writeContractAsync({
        abi: recurringPaymentAbi,
        address: recurringPaymentAddress,
        functionName: "createSchedule",
        args: [
          data.recipient as `0x${string}`,
          tokenAddress as `0x${string}`,
          amountPerPayment,
          Number(data.totalPayments),
          BigInt(startTimestamp),
          BigInt(intervalSeconds),
          executorReward,
        ],
        gas: createGas,
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

      setSuccessInfo({
        approveHash,
        createHash,
        scheduleId: createdScheduleId !== null ? createdScheduleId.toString() : null,
      });
      onCreated?.({
        scheduleId: createdScheduleId !== null ? createdScheduleId.toString() : null,
        kind: "schedule",
      });
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
        <h2 className="text-xl font-semibold text-slate-100">Create Recurring USDC Schedule</h2>
        <form className="mt-4 space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className={`rounded-full px-2 py-1 ${step === 1 ? "bg-cyan-500/20 text-cyan-300" : "bg-slate-800 text-slate-400"}`}>
              Step 1: Basics
            </span>
            <span className={`rounded-full px-2 py-1 ${step === 2 ? "bg-cyan-500/20 text-cyan-300" : "bg-slate-800 text-slate-400"}`}>
              Step 2: Details & Create
            </span>
          </div>

          {step === 1 ? (
            <div key="schedule-step-1" className="space-y-4">
              <FloatingInput label="Recipient Address" placeholder="0x..." {...form.register("recipient")} />

              <div className="grid gap-4 sm:grid-cols-2">
                <FloatingInput
                  label="Amount Per Payment"
                  type="number"
                  step="0.000001"
                  {...form.register("amountPerPayment", { valueAsNumber: true })}
                />
                <FloatingInput label="Number of Payments" type="number" {...form.register("totalPayments", { valueAsNumber: true })} />
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

              <div className="flex flex-wrap gap-3">
                <Button type="button" onClick={goToStepTwo}>
                  Next
                </Button>
              </div>
            </div>
          ) : (
            <div key="schedule-step-2" className="space-y-4">
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
                {form.formState.errors.startDate?.message ? (
                  <p className="mt-2 text-xs text-rose-400">{form.formState.errors.startDate.message}</p>
                ) : null}
              </div>

              <div>
                <FloatingInput
                  label="Memo"
                  placeholder="Payroll tranche, creator grant, subscription..."
                  autoComplete="off"
                  {...form.register("memo")}
                />
                {form.formState.errors.memo?.message ? (
                  <p className="mt-2 text-xs text-rose-400">{form.formState.errors.memo.message}</p>
                ) : null}
              </div>

              <AnimatePresence initial={false}>
                {showReviewCard ? (
                  <motion.div
                    key="schedule-review"
                    initial={{ opacity: 0, y: 18, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 12, scale: 0.98 }}
                    transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <Card className="border-slate-700 bg-slate-950/80 p-4">
                      <p className="text-sm text-slate-300">Review</p>
                      <p className="mt-2 text-sm text-slate-400">Interval: {intervalSeconds} seconds</p>
                      <p className="text-sm text-slate-400">Fee: {executorFeePercent.toFixed(2)}% per payment</p>
                      <p className="text-sm text-slate-400">Fee per payment: {rewardPerPayment.toFixed(6)} tokens</p>
                      <p className="text-sm text-slate-400">Total escrow required: {totalEscrow.toFixed(6)} $</p>
                      {!isExecutorFeePercentValid ? (
                        <p className="mt-2 text-xs text-rose-400">
                          Set NEXT_PUBLIC_EXECUTOR_REWARD_PERCENT (0-100) to enable schedule creation.
                        </p>
                      ) : null}
                    </Card>
                  </motion.div>
                ) : null}
              </AnimatePresence>

              <div className="flex flex-wrap gap-3">
                <Button type="button" variant="ghost" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button type="submit" disabled={!isConnected || isPending || !isExecutorFeePercentValid}>
                  {isPending ? "Submitting..." : "Create Schedule"}
                </Button>
              </div>
            </div>
          )}

          {successInfo && !onCreated ? (
            <Card className="border-emerald-500/40 bg-emerald-950/20 p-4">
              <p className="text-sm font-medium text-emerald-300">Schedule created successfully on-chain</p>
              {successInfo.scheduleId !== null ? (
                <p className="mt-1 text-sm text-emerald-200">
                  Schedule ID:{" "}
                  <Link href={`/schedules/${successInfo.scheduleId}`} className="font-semibold underline">
                    #{successInfo.scheduleId}
                  </Link>
                </p>
              ) : (
                <p className="mt-1 text-xs text-amber-300">
                  Schedule was created, but the schedule ID could not be parsed from the transaction logs.
                </p>
              )}
              <p className="mt-1 text-xs text-emerald-200/80">Approve tx: {successInfo.approveHash}</p>
              <p className="text-xs text-emerald-200/80">Create tx: {successInfo.createHash}</p>
            </Card>
          ) : null}

        </form>
      </Card>
    </motion.div>
  );
}
