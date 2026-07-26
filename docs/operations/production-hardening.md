# Production Hardening Checklist

## Smart contracts

- Complete property-based tests and fuzzing.
- Add static analysis (Slither) and gas snapshots.
- Audit access controls and emergency controls.

## Frontend/API

- Add request-rate limits for API routes.
- Add strict input validation for all POST routes.
- Add CSP and security headers.

## Executor

- Multi-RPC fallback logic.
- Nonce management under restart conditions.
- Wallet balance guardrail alerts.
- Exponential backoff and dead-letter queue for persistent failures.

## Data

- Ensure unique constraints for schedule + tx hash patterns.
- Add periodic reconciliation job (DB vs chain).
- Backup policy and retention policy for Postgres.
