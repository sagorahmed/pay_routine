import axios from "axios";
import { config } from "../lib/config";
import { logger } from "../lib/logger";

export async function sendNotification(payload: Record<string, unknown>) {
  if (!config.NOTIFICATION_ENDPOINT) {
    return;
  }

  if (config.NOTIFICATION_ENDPOINT.includes("your-vercel-app.vercel.app")) {
    logger.info("Skipping notifications because NOTIFICATION_ENDPOINT is still placeholder value");
    return;
  }

  try {
    await axios.post(config.NOTIFICATION_ENDPOINT, payload, { timeout: 8000 });
  } catch (error) {
    logger.warn({ error }, "Failed to send notification");
  }
}
