import "dotenv/config";
import cron from "node-cron";
import { config } from "./lib/config";
import { db, ensureExecutorTables } from "./lib/db";
import { logger } from "./lib/logger";
import { runExecutionCycle } from "./services/executor";

let isRunning = false;

async function safeCycle() {
  if (isRunning) {
    logger.warn("Previous cycle still running, skipping this tick");
    return;
  }

  isRunning = true;

  try {
    await runExecutionCycle();
  } catch (error) {
    logger.error({ error }, "Execution cycle failed");
  } finally {
    isRunning = false;
  }
}

async function bootstrap() {
  await db.query("SELECT 1");
  await ensureExecutorTables();
  logger.info("DB connection established");

  cron.schedule("*/1 * * * *", () => {
    void safeCycle();
  });

  logger.info({ intervalMs: config.CHECK_INTERVAL_MS }, "PayRoutine executor started");
  await safeCycle();
}

bootstrap().catch((error) => {
  logger.error({ error }, "Fatal bootstrap failure");
  process.exit(1);
});
