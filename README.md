# PayRoutine

PayRoutine is a production-ready recurring USDC payment dApp for Arc Network.

## What is included

- Solidity smart contract with escrowed recurring payments and optional executor rewards.
- Foundry deployment scripts and comprehensive contract tests.
- Next.js App Router frontend with wallet integration, dashboard, schedule creation, and API routes.
- PostgreSQL schema for indexed schedules, payment history, and notification preferences.
- VPS executor bot (Node.js + viem + PM2) for minute-level automated execution.
- Complete deployment and operations documentation.

## Project structure

- `contracts/` Foundry smart contracts, scripts, and tests.
- `web/` Next.js frontend and serverless API routes.
- `executor/` VPS automation service.
- `docs/` Architecture, deployment, and troubleshooting guides.

## Delivery phases (implemented)

1. Smart contract architecture
2. Foundry project structure
3. Contract implementation
4. Comprehensive tests
5. Next.js frontend
6. Wallet integration
7. Database integration
8. Vercel deployment prep
9. VPS automation service
10. End-to-end testing plan
11. Production hardening checklist
12. Complete documentation

## Quick start

### 1) Frontend

```bash
cd web
cp .env.example .env.local
npm install
npm run dev
```

### 2) Executor

```bash
cd executor
cp .env.example .env
npm install
npm run build
npm run start
```

### 3) Contracts (Foundry)

```bash
cd contracts
# Install Foundry first: https://book.getfoundry.sh/getting-started/installation
forge install foundry-rs/forge-std OpenZeppelin/openzeppelin-contracts
forge build
forge test
```

## Important security guarantees

- Full escrow required at schedule creation.
- No private keys stored in frontend or Vercel API routes.
- Contract uses OpenZeppelin `SafeERC20` + `ReentrancyGuard`.
- Executor performs on-chain verification before every execution.
- DB is indexing/analytics only; chain remains source of truth.

## Docs index

- `docs/architecture/architecture.md`
- `docs/architecture/database-schema.md`
- `docs/architecture/contract-documentation.md`
- `docs/deployment/environment-setup.md`
- `docs/deployment/foundry-commands.md`
- `docs/deployment/vercel-deployment.md`
- `docs/deployment/vps-deployment.md`
- `docs/operations/production-hardening.md`
- `docs/operations/troubleshooting.md`
- `docs/operations/end-to-end-testing.md`
