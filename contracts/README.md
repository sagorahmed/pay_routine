# PayRoutine Contracts

## Prerequisites

- Foundry installed
- Arc RPC endpoint
- Funded deployer wallet

## Setup

```bash
cp .env.example .env
forge install foundry-rs/forge-std OpenZeppelin/openzeppelin-contracts
forge build
forge test -vvv
```

## Deploy the contract on blockchain

```bash
cd "d:\Blockchain project\Arc Network\PayRoutine\contracts"
source .env
forge script script/DeployRecurringPayment.s.sol:DeployRecurringPayment \
  --rpc-url $ARC_RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast
```

## Contract

- `src/RecurringPayment.sol`
- `src/mocks/MockUSDC.sol`
