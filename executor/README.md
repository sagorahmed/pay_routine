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
