# Foundry Commands

```bash
cd contracts
forge install foundry-rs/forge-std OpenZeppelin/openzeppelin-contracts
forge build
forge test -vvv
```

Deploy (example):

```bash
cd contracts
source .env
forge script script/DeployRecurringPayment.s.sol:DeployRecurringPayment \
  --rpc-url $ARC_RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify
```

## Useful

- `forge fmt`
- `forge test --match-test testExecutePayment`
- `cast call <contract> "getSchedule(uint256)" 1 --rpc-url <rpc>`
