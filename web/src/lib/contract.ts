import { parseAbi } from "viem";

export const recurringPaymentAbi = parseAbi([
  "function createSchedule(address recipient,address token,uint128 amountPerPayment,uint32 totalPayments,uint64 startTime,uint64 intervalSeconds,uint96 executorReward) returns (uint256)",
  "function pauseSchedule(uint256 scheduleId)",
  "function resumeSchedule(uint256 scheduleId)",
  "function cancelSchedule(uint256 scheduleId)",
  "function executePayment(uint256 scheduleId)",
  "function withdrawRemaining(uint256 scheduleId)",
  "function nextScheduleId() view returns (uint256)",
  "function getSchedule(uint256 scheduleId) view returns ((address creator,address recipient,address token,uint128 amountPerPayment,uint32 totalPayments,uint32 remainingPayments,uint64 nextExecution,uint64 intervalSeconds,uint128 depositedAmount,bool active,bool paused,bool cancelled,uint96 executorReward))",
  "function getSchedulesByUser(address user) view returns (uint256[])",
  "event ScheduleCreated(uint256 indexed scheduleId,address indexed creator,address indexed recipient,address token,uint128 amountPerPayment,uint32 totalPayments,uint64 nextExecution,uint64 intervalSeconds,uint96 executorReward,uint128 depositedAmount)",
  "event PaymentExecuted(uint256 indexed scheduleId,address indexed recipient,address indexed executor,uint128 amount,uint96 executorReward,uint32 remainingPayments,uint64 nextExecution)",
]);

export const recurringPaymentAddress =
  (process.env.NEXT_PUBLIC_RECURRING_PAYMENT_ADDRESS as `0x${string}` | undefined) ?? undefined;
