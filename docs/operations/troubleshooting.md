# Troubleshooting Guide

## Foundry not installed

- Install via Foundry official docs.
- Re-run `forge --version` and `forge build`.

## Wallet connect issues

- Verify `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`.
- Verify Arc chain RPC URL and chain ID.

## Execution not happening

- Confirm PM2 process alive (`pm2 status`).
- Check executor wallet has native gas token.
- Verify schedule is active, not paused/cancelled, and due.

## Duplicate payment concerns

- Ensure only one executor instance is active.
- Keep DB unique tx hash constraints.
- Keep in-cycle lock (`isRunning`) enabled.

## Notification failures

- Validate webhook URL and response code.
- Inspect executor logs for timeout/retry errors.
