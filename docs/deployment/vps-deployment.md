# VPS Deployment Guide (Ubuntu 24.04)

## 1. Provision

```bash
sudo apt update
sudo apt install -y git curl
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

## 2. Deploy executor

```bash
git clone <your-repo>
cd PayRoutine/executor
cp .env.example .env
npm install
npm run build
mkdir -p logs
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

## 3. systemd safety (optional)

Use PM2 startup command output to register a boot service.

## 4. Log rotation

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 14
```

## 5. Health checks

- Monitor `pm2 status`
- Monitor last logs `pm2 logs payroutine-executor --lines 100`
- Alert on repeated failures and low wallet balance
