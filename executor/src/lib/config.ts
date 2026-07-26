import "dotenv/config";
import { z } from "zod";

const privateKeySchema = z
  .string()
  .trim()
  .transform((value) => (value.startsWith("0x") ? value : `0x${value}`))
  .refine((value) => /^0x[0-9a-fA-F]{64}$/.test(value), {
    message: "PRIVATE_KEY must be a 32-byte hex string, with or without 0x prefix",
  });

const envSchema = z.object({
  PRIVATE_KEY: privateKeySchema,
  RPC_URL: z.string().url(),
  CONTRACT_ADDRESS: z.string().startsWith("0x").length(42),
  CHAIN_ID: z.coerce.number().int().positive(),
  DATABASE_URL: z.string().min(1),
  CHECK_INTERVAL_MS: z.coerce.number().int().positive().default(60_000),
  RETRY_LIMIT: z.coerce.number().int().positive().default(5),
  ARC_CCTP_DOMAIN: z.coerce.number().int().nonnegative().default(26),
  ARC_TOKEN_MESSENGER_ADDRESS: z
    .string()
    .startsWith("0x")
    .length(42)
    .default("0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA"),
  ARC_USDC_ADDRESS: z
    .string()
    .startsWith("0x")
    .length(42)
    .default("0x3600000000000000000000000000000000000000"),
  CCTP_ATTESTATION_API_BASE: z.string().url().default("https://iris-api-sandbox.circle.com"),
  CCTP_ATTESTATION_POLL_MS: z.coerce.number().int().positive().default(5000),
  CCTP_ATTESTATION_MAX_ATTEMPTS: z.coerce.number().int().positive().default(180),
  CCTP_MIN_FINALITY_THRESHOLD: z.coerce.number().int().min(1000).default(2000),
  ETHEREUM_SEPOLIA_RPC_URL: z.string().url().optional(),
  AVALANCHE_FUJI_RPC_URL: z.string().url().optional(),
  OPTIMISM_SEPOLIA_RPC_URL: z.string().url().optional(),
  ARBITRUM_SEPOLIA_RPC_URL: z.string().url().optional(),
  BASE_SEPOLIA_RPC_URL: z.string().url().optional(),
  POLYGON_AMOY_RPC_URL: z.string().url().optional(),
  NOTIFICATION_ENDPOINT: z.string().url().optional(),
});

export const config = envSchema.parse(process.env);
