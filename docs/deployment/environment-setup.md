# Environment Setup Guide

## Frontend (`web/.env.local`)

- `NEXT_PUBLIC_RPC_URL`
- `NEXT_PUBLIC_ARC_CHAIN_ID`
- `NEXT_PUBLIC_ARC_CHAIN_NAME`
- `NEXT_PUBLIC_ARC_NATIVE_NAME`
- `NEXT_PUBLIC_ARC_NATIVE_SYMBOL`
- `NEXT_PUBLIC_EXPLORER_URL`
- `NEXT_PUBLIC_RECURRING_PAYMENT_ADDRESS`
- `NEXT_PUBLIC_USDC_TOKEN_ADDRESS`
- `NEXT_PUBLIC_EXECUTOR_REWARD_PERCENT`
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`
- `DATABASE_URL`

## Cross-chain bridge (CCTP) — optional overrides

Arc Network is always the CCTP source chain (burn happens on Arc; mint happens
on the user-selected destination chain). Defaults are Circle's official Arc
testnet CCTP values, so these are only needed if you deploy to Arc mainnet or
a custom Arc environment.

- `NEXT_PUBLIC_ARC_CCTP_DOMAIN` (default `26`, Circle's official Arc domain)
- `NEXT_PUBLIC_ARC_TOKEN_MESSENGER_ADDRESS` (default is the CCTP V2 testnet
  TokenMessenger address, used to burn USDC on Arc)
- `NEXT_PUBLIC_ARC_USDC_ADDRESS` (default is the official Arc Testnet USDC
  address)
- `NEXT_PUBLIC_CCTP_ATTESTATION_API_BASE` (default
  `https://iris-api-sandbox.circle.com`; use `https://iris-api.circle.com` for
  mainnet)
- `NEXT_PUBLIC_CCTP_EXECUTOR_ADDRESS` (executor wallet address that receives
  each due Arc payout before scheduler bridges to destination chain)

## Contracts (`contracts/.env`)

- `ARC_RPC_URL`
- `PRIVATE_KEY`
- `CONTRACT_OWNER`
- `ARC_CHAIN_ID`
- `USDC_TOKEN`

## Executor (`executor/.env`)

- `PRIVATE_KEY`
- `RPC_URL`
- `CONTRACT_ADDRESS`
- `CHAIN_ID`
- `DATABASE_URL`
- `RETRY_LIMIT`
- `CHECK_INTERVAL_MS`
- `NOTIFICATION_ENDPOINT`
- `LOG_LEVEL`
- `ARC_CCTP_DOMAIN` (default `26`)
- `ARC_TOKEN_MESSENGER_ADDRESS` (default CCTP V2 testnet TokenMessenger)
- `ARC_USDC_ADDRESS` (default Arc Testnet USDC)
- `CCTP_ATTESTATION_API_BASE` (default `https://iris-api-sandbox.circle.com`)
- `CCTP_ATTESTATION_POLL_MS` (default `5000`)
- `CCTP_ATTESTATION_MAX_ATTEMPTS` (default `180`)
- `CCTP_MIN_FINALITY_THRESHOLD` (default `2000`)
- `ETHEREUM_SEPOLIA_RPC_URL` (optional override)
- `AVALANCHE_FUJI_RPC_URL` (optional override)
- `OPTIMISM_SEPOLIA_RPC_URL` (optional override)
- `ARBITRUM_SEPOLIA_RPC_URL` (optional override)
- `BASE_SEPOLIA_RPC_URL` (optional override)
- `POLYGON_AMOY_RPC_URL` (optional override)
