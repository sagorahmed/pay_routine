# PayRoutine Executor Service

Minute-interval automation service that executes due recurring payments.

## Features

- 24/7 schedule polling
- On-chain due verification
- Payment execution with retries
- DB payment history updates
- Notification dispatch
- PM2-ready process config

## What you need before starting

- Ubuntu VPS (recommended: 22.04 or 24.04)
- SSH access to the VPS
- Node.js LTS (20+ recommended)
- npm
- PM2
- A valid `.env` file with real values

## 1) Install system dependencies (VPS)

```bash
sudo apt update
sudo apt install -y git curl
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
node -v
npm -v
pm2 -v
```

This service makes only outbound connections (RPC, Postgres, attestation API, notification webhook) and doesn't listen on any port, so no inbound firewall rule is needed for it. If `ufw` is enabled on the VPS, just make sure SSH stays allowed:

```bash
sudo ufw allow OpenSSH
sudo ufw status
```

If `DATABASE_URL` points to a managed/remote Postgres instance (Neon, Supabase, RDS, etc.), append `?sslmode=require` unless the provider already documents a different SSL mode.

## 2) Clone project and move to executor

```bash
git clone https://github.com/sagorahmed/pay_routine.git 
cd pay_routine/executor
npm install
```

## 3) Create and fill environment file

```bash
cp .env.example .env
chmod 600 .env
```

`chmod 600` restricts the file to the owning user only — `.env` holds `PRIVATE_KEY`, so it should never be world/group readable on a shared VPS.

Set real values in `.env`:

Required:

- `PRIVATE_KEY`: executor wallet private key (test wallet only), with or without `0x` prefix
- `RPC_URL`: Arc RPC endpoint
- `CONTRACT_ADDRESS`: deployed RecurringPayment contract (42-char `0x` address)
- `CHAIN_ID`: Arc chain id
- `DATABASE_URL`: Postgres connection string

Optional (defaults shown are applied automatically if unset):

- `CHECK_INTERVAL_MS`: poll interval, default `60000`
- `RETRY_LIMIT`: retry attempts, default `5`
- `NOTIFICATION_ENDPOINT`: optional webhook/API URL for `notifications.ts`
- `LOG_LEVEL`: pino log level (`info`, `debug`, etc.), default `info`
- `ARC_CCTP_DOMAIN`: Arc's CCTP domain id, default `26`
- `ARC_TOKEN_MESSENGER_ADDRESS`: CCTP TokenMessenger on Arc, defaults to the testnet deployment
- `ARC_USDC_ADDRESS`: native USDC contract/precompile on Arc, defaults to the testnet address
- `CCTP_ATTESTATION_API_BASE`: Circle Iris attestation API base URL, default sandbox URL
- `CCTP_HTTP_TIMEOUT_MS`: HTTP timeout for attestation API calls, default `15000`
- `CCTP_ATTESTATION_POLL_MS`: delay between attestation polls, default `5000`
- `CCTP_ATTESTATION_MAX_ATTEMPTS`: max attestation poll attempts, default `180`
- `CCTP_MIN_FINALITY_THRESHOLD`: min finality threshold for `depositForBurn`, default `2000`
- `BRIDGE_OPERATION_TIMEOUT_MS`: max time per bridge attempt before fail-and-retry, default `120000`
- Destination RPC URLs (needed for any destination chain you actually bridge to): `ETHEREUM_SEPOLIA_RPC_URL`, `AVALANCHE_FUJI_RPC_URL`, `OPTIMISM_SEPOLIA_RPC_URL`, `ARBITRUM_SEPOLIA_RPC_URL`, `BASE_SEPOLIA_RPC_URL`, `POLYGON_AMOY_RPC_URL` — if omitted, the chain's public default RPC is used, which may be rate-limited

> The full validation schema lives in [src/lib/config.ts](src/lib/config.ts) — treat it as the source of truth if this list drifts.

**Fund the executor wallet:** the address derived from `PRIVATE_KEY` needs a native ARC balance on the Arc chain (for `executePayment`, CCTP `approve`, and `depositForBurn` gas) *and*, separately, native gas on every destination chain you bridge to (for `receiveMessage`). An empty/low balance causes cryptic `eth_estimateGas` / "out of gas" errors rather than a clear insufficient-funds message.

## 4) Start bot in 24/7 mode (recommended)

This command installs deps, starts PM2, enables reboot startup, and configures log rotation.

```bash
chmod +x ./scripts/bootstrap-pm2.sh
npm run bot:bootstrap
```

## 5) Verify bot is running

```bash
npm run bot:status
npm run bot:logs
```

Expected result:

- Process name: `payroutine-executor`
- Status: `online`

## 6) Confirm it survives terminal close

- Close MobaXterm/SSH window.
- Reconnect to VPS.
- Run:

```bash
cd PayRoutine/executor
npm run bot:status
```

If status is `online`, it is running independently of your terminal session.

## 7) Confirm it survives VPS reboot

```bash
sudo reboot
# reconnect after reboot
cd pay_routine/executor
npm run bot:status
```

If not online after reboot, run:

```bash
pm2 startup
pm2 save
```

Then reboot and check again.

## Daily operations

- Check status: `npm run bot:status`
- Tail logs: `npm run bot:logs`
- Restart with env refresh: `npm run bot:restart`
- Stop process: `npm run bot:stop`
- Remove process from PM2: `npm run bot:delete`

## Local run (without PM2)

```bash
cp .env.example .env
npm install
npm run start:runtime
```

## Manual PM2 run (alternative)

```bash
mkdir -p logs
pm2 start ecosystem.config.cjs --update-env
pm2 save
pm2 logs payroutine-executor
```

## Built-in reliability behavior

- Auto restart on crash with exponential backoff
- Memory-based restart protection (`max_memory_restart`)
- Reboot persistence via `pm2 startup` + `pm2 save`
- Daily scheduled recycle at `04:00 UTC`
- Rotating logs via `pm2-logrotate`

## Quick troubleshooting

- Build fails:
	- This does not block 24/7 bot run anymore because PM2 uses `npm run start:runtime`
	- Run `npm ci` again and retry `npm run build` only if you need `dist/` output
	- Confirm Node LTS is installed (`node -v`)
- Bot is not executing payments:
	- Check logs with `npm run bot:logs`
	- If you repeatedly see `Previous cycle still running, skipping this tick`, one bridge cycle is taking too long (attestation wait or RPC issues)
	- Confirm attestation API base and timeout in `.env` (`CCTP_ATTESTATION_API_BASE`, `CCTP_HTTP_TIMEOUT_MS`)
	- Confirm destination chain RPC URL env vars are set for your selected destination chain
	- Confirm wallet has gas balance
	- Confirm schedule is active and due
- `Transaction creation failed` / `out of gas: gas required exceeds: <small number>` on `approve`/`depositForBurn`/`executePayment`:
	- This almost always means the executor wallet's native ARC balance is too low to cover gas at the current `maxFeePerGas`. RPC nodes cap the `eth_estimateGas` search range to what the sender can afford, so a near-empty wallet produces a misleading low "required gas" number instead of a clear insufficient-funds error
	- Check the balance of the address derived from `PRIVATE_KEY` on the Arc chain and top it up
	- The executor now runs a pre-flight ARC balance check before CCTP `approve`/`depositForBurn` and will throw a clear `Insufficient Arc-chain gas balance` error instead of this viem error once funded correctly
- Duplicate executions:
	- Ensure only one PM2 instance is running (`npm run bot:status`)
