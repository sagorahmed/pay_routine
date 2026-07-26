export type ScheduleStatus = "active" | "paused" | "cancelled" | "completed";

export type PaymentFrequency =
  | "minutely"
  | "hourly"
  | "daily"
  | "weekly"
  | "biweekly"
  | "monthly"
  | "quarterly"
  | "yearly";

export interface RecurringSchedule {
  id: string;
  creator: string;
  recipient: string;
  token: string;
  amountPerPayment: string;
  totalPayments: number;
  remainingPayments: number;
  nextExecution: number;
  intervalSeconds: number;
  depositedAmount: string;
  status: ScheduleStatus;
  memo?: string;
  executorReward?: string;
}

export interface PaymentRecord {
  scheduleId: string;
  txHash: string;
  executedAt: number;
  amount: string;
  executor: string;
  status: "success" | "failed";
  reason?: string;
}
