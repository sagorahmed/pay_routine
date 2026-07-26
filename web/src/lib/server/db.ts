import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("Missing DATABASE_URL");
}

declare global {
  // eslint-disable-next-line no-var
  var __payroutineWebPgPool: Pool | undefined;
}

export const db = global.__payroutineWebPgPool ?? new Pool({ connectionString });

if (process.env.NODE_ENV !== "production") {
  global.__payroutineWebPgPool = db;
}
