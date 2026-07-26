import { PaymentFrequency } from "@/types/schedule";

export const frequencyOptions: { label: string; value: PaymentFrequency; seconds: number }[] = [
  { label: "Every Minute", value: "minutely", seconds: 60 },
  { label: "Every Hour", value: "hourly", seconds: 60 * 60 },
  { label: "Daily", value: "daily", seconds: 60 * 60 * 24 },
  { label: "Weekly", value: "weekly", seconds: 60 * 60 * 24 * 7 },
  { label: "Biweekly", value: "biweekly", seconds: 60 * 60 * 24 * 14 },
  { label: "Monthly", value: "monthly", seconds: 60 * 60 * 24 * 30 },
  { label: "Quarterly", value: "quarterly", seconds: 60 * 60 * 24 * 90 },
  { label: "Yearly", value: "yearly", seconds: 60 * 60 * 24 * 365 },
];
