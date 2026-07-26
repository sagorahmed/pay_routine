import { boolean, integer, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const userProfiles = pgTable("user_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  walletAddress: varchar("wallet_address", { length: 42 }).notNull().unique(),
  displayName: text("display_name"),
  email: text("email"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const indexedSchedules = pgTable("indexed_schedules", {
  id: uuid("id").defaultRandom().primaryKey(),
  scheduleId: text("schedule_id").notNull().unique(),
  creator: varchar("creator", { length: 42 }).notNull(),
  recipient: varchar("recipient", { length: 42 }).notNull(),
  token: varchar("token", { length: 42 }).notNull(),
  amountPerPayment: text("amount_per_payment").notNull(),
  totalPayments: integer("total_payments").notNull(),
  remainingPayments: integer("remaining_payments").notNull(),
  nextExecution: timestamp("next_execution", { withTimezone: true }).notNull(),
  intervalSeconds: integer("interval_seconds").notNull(),
  depositedAmount: text("deposited_amount").notNull(),
  active: boolean("active").notNull().default(true),
  paused: boolean("paused").notNull().default(false),
  cancelled: boolean("cancelled").notNull().default(false),
  memo: text("memo"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const paymentHistory = pgTable("payment_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  scheduleId: text("schedule_id").notNull(),
  txHash: text("tx_hash").notNull().unique(),
  executor: varchar("executor", { length: 42 }).notNull(),
  amount: text("amount").notNull(),
  status: text("status").notNull(),
  reason: text("reason"),
  executedAt: timestamp("executed_at", { withTimezone: true }).notNull(),
});

export const crossChainSchedules = pgTable("cross_chain_schedules", {
  scheduleId: text("schedule_id").primaryKey(),
  creator: varchar("creator", { length: 42 }).notNull(),
  destinationChainId: integer("destination_chain_id").notNull(),
  destinationDomain: integer("destination_domain").notNull(),
  destinationRecipient: varchar("destination_recipient", { length: 42 }).notNull(),
  destinationUsdcAddress: varchar("destination_usdc_address", { length: 42 }).notNull(),
  messageTransmitterAddress: varchar("message_transmitter_address", { length: 42 }).notNull(),
  memo: text("memo"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const notificationPreferences = pgTable("notification_preferences", {
  id: uuid("id").defaultRandom().primaryKey(),
  walletAddress: varchar("wallet_address", { length: 42 }).notNull().unique(),
  email: text("email"),
  telegram: text("telegram"),
  discordWebhook: text("discord_webhook"),
  webhook: text("webhook"),
  onExecuted: boolean("on_executed").notNull().default(true),
  onCompleted: boolean("on_completed").notNull().default(true),
  onCancelled: boolean("on_cancelled").notNull().default(true),
  onFailure: boolean("on_failure").notNull().default(true),
  onLowExecutorBalance: boolean("on_low_executor_balance").notNull().default(true),
});
