#!/usr/bin/env bash
set -euo pipefail

APP_NAME="payroutine-executor"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXECUTOR_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${EXECUTOR_DIR}"

if [ ! -f ".env" ]; then
  echo "[error] Missing .env file in ${EXECUTOR_DIR}."
  echo "Create it first: cp .env.example .env"
  exit 1
fi

mkdir -p logs
npm ci
npm run build

pm2 start ecosystem.config.cjs --update-env
pm2 save

# Register PM2 startup service for reboot persistence.
if command -v systemctl >/dev/null 2>&1; then
  STARTUP_CMD="$(pm2 startup systemd -u "$USER" --hp "$HOME" | grep -E "sudo .*pm2 startup" | tail -n 1 || true)"
  if [ -n "${STARTUP_CMD}" ]; then
    eval "${STARTUP_CMD}"
    pm2 save
  fi
fi

# Install and configure log rotation if not already enabled.
pm2 install pm2-logrotate || true
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 14
pm2 set pm2-logrotate:compress true

pm2 status "${APP_NAME}"
echo "[ok] ${APP_NAME} is running under PM2."
