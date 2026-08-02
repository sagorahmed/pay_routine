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
npm ci
chmod +x ./scripts/bootstrap-pm2.sh
npm run bot:bootstrap
```

## 3. Start and manage bot

```bash
npm run bot:status
npm run bot:logs
npm run bot:restart
```

## 4. Log rotation

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 14
pm2 set pm2-logrotate:compress true
```

## 5. Health checks

- Monitor `pm2 status`
- Monitor last logs `pm2 logs payroutine-executor --lines 100`
- Alert on repeated failures and low wallet balance

## 6. Reboot validation

```bash
sudo reboot
# after reconnect
pm2 status payroutine-executor
pm2 logs payroutine-executor --lines 50
```

If process is not back after reboot, run the printed command from `pm2 startup` and then `pm2 save`.
