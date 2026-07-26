# PayRoutine Architecture

```mermaid
flowchart LR
  U[User Wallet] -->|createSchedule| C[RecurringPayment Contract]
  C -->|escrowed USDC| V[(On-chain State)]
  E[Executor Bot on VPS] -->|read due schedules| DB[(PostgreSQL)]
  E -->|verify schedule| C
  E -->|executePayment| C
  C -->|transfer USDC| R[Recipient Wallet]
  E -->|write history| DB
  W[Next.js App + API Routes] -->|read indexed data| DB
  W -->|on-chain reads/writes| C
  N[Notification APIs] -->|email/telegram/discord/webhook| U
```

## Components

- Smart contract: single source of payment execution rules.
- Frontend: user UX, wallet actions, dashboards.
- API routes: metadata, analytics, notification plumbing.
- PostgreSQL: indexed query layer, analytics, notification preferences.
- VPS executor: liveness engine for overdue payment execution.

## Trust model

- Blockchain state is canonical.
- Database is non-authoritative cache/index.
- No custody of user keys on web infrastructure.
