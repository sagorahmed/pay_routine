# Database Schema

PayRoutine stores indexed and operational metadata only.

## Tables

- `user_profiles`
- `indexed_schedules`
- `payment_history`
- `notification_preferences`

Schema is implemented in `web/src/db/schema.ts`.

## Principles

- Never treat DB records as payment truth.
- Always reconcile execution state with on-chain `getSchedule()`.
- Keep wallet addresses normalized and indexed.
- Upsert by `tx_hash` to avoid duplicates.
