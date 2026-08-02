# PayRoutine Executor Service

Minute-interval automation service that executes due recurring payments.

## Features

- 24/7 schedule polling
- On-chain due verification
- Payment execution with retries
- DB payment history updates
- Notification dispatch
- PM2-ready process config

## Local run

```bash
cp .env.example .env
npm install
npm run build
npm run start
```

## PM2 run

```bash
mkdir -p logs
pm2 start ecosystem.config.cjs
pm2 logs payroutine-executor
```

## VPS 24/7 runbook

```bash
cp .env.example .env
npm ci
npm run build
chmod +x ./scripts/bootstrap-pm2.sh
npm run bot:bootstrap
```

Useful commands:

```bash
npm run bot:status
npm run bot:logs
npm run bot:restart
npm run bot:stop
```

This setup provides:

- Auto-restart on crashes with exponential backoff
- Boot persistence via PM2 startup service
- Daily scheduled recycle at 04:00 UTC
- Rotating logs via `pm2-logrotate`
