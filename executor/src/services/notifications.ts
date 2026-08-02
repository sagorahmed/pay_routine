import axios from "axios";
import { config } from "../lib/config";
import { logger } from "../lib/logger";

function normalizeEndpoint(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl.trim());
    parsed.pathname = parsed.pathname.replace(/\/\/{2,}/g, "/");
    return parsed.toString();
  } catch {
    return rawUrl.trim();
  }
}

export async function sendNotification(payload: Record<string, unknown>) {
  if (!config.NOTIFICATION_ENDPOINT) {
    return;
  }

  if (config.NOTIFICATION_ENDPOINT.includes("your-vercel-app.vercel.app")) {
    logger.info("Skipping notifications because NOTIFICATION_ENDPOINT is still placeholder value");
    return;
  }

  const endpoint = normalizeEndpoint(config.NOTIFICATION_ENDPOINT);

  try {
    await axios.post(endpoint, payload, { timeout: 8000 });
  } catch (error) {
    logger.warn({ error, endpoint }, "Failed to send notification");
  }
}
