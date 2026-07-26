# PayRoutine Web App

Frontend for PayRoutine recurring USDC payments on Arc Network.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- wagmi + viem
- RainbowKit
- TanStack Query
- Framer Motion

## Run locally

```bash
cp .env.example .env.local
npm install
npm run dev
```

## Build and lint

```bash
npm run lint
npm run build
```

## Pages

- `/`
- `/features`
- `/how-it-works`
- `/dashboard`
- `/create`
- `/schedules/[id]`
- `/history`
- `/settings`
- `/notifications`
- `/help`

## API routes

- `/api/analytics`
- `/api/metadata`
- `/api/notifications`
