import "dotenv/config";
import { config } from "./lib/config";
import { db, ensureExecutorTables } from "./lib/db";
import { logger } from "./lib/logger";
import { runExecutionCycle } from "./services/executor";

let isRunning = false;
let isShuttingDown = false;
let ticker: NodeJS.Timeout | null = null;

async function safeCycle() {
  if (isShuttingDown) {
    return;
  }

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

async function shutdown(signal: NodeJS.Signals) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  logger.info({ signal }, "Shutdown signal received");

  if (ticker) {
    clearInterval(ticker);
    ticker = null;
  }

  while (isRunning) {
    logger.info("Waiting for active execution cycle to finish before shutdown");
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  await db.end();
  logger.info("Executor stopped cleanly");
  process.exit(0);
}

async function bootstrap() {
  await db.query("SELECT 1");
  await ensureExecutorTables();
  logger.info("DB connection established");

  ticker = setInterval(() => {
    void safeCycle();
  }, config.CHECK_INTERVAL_MS);

  ticker.unref();

  logger.info({ intervalMs: config.CHECK_INTERVAL_MS }, "PayRoutine executor started");
  await safeCycle();
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

bootstrap().catch((error) => {
  logger.error({ error }, "Fatal bootstrap failure");
  process.exit(1);
});
