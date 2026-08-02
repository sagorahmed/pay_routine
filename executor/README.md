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

## 2) Clone project and move to executor

```bash
git clone https://github.com/sagorahmed/pay_routine.git 
cd pay_routine/executor
npm install
```

## 3) Create and fill environment file

```bash
cp .env.example .env
```

Set real values in `.env`:

- `PRIVATE_KEY`: executor wallet private key (test wallet only)
- `RPC_URL`: Arc RPC endpoint
- `CONTRACT_ADDRESS`: deployed RecurringPayment contract
- `CHAIN_ID`: Arc chain id
- `DATABASE_URL`: Postgres connection string
- `CHECK_INTERVAL_MS`: poll interval, usually `60000`
- `RETRY_LIMIT`: retry attempts, usually `5`
- `NOTIFICATION_ENDPOINT`: optional webhook/API URL
- `LOG_LEVEL`: usually `info`
- `CCTP_HTTP_TIMEOUT_MS`: HTTP timeout for attestation API calls, usually `15000`

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
- Duplicate executions:
	- Ensure only one PM2 instance is running (`npm run bot:status`)
