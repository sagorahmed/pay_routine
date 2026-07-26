# End-to-End Testing Guide

## Scope

Validate full flow:

1. User creates schedule on frontend.
2. Contract escrows full amount.
3. Schedule appears in DB index.
4. Executor detects due payment.
5. `executePayment()` succeeds on-chain.
6. Payment history updates in DB.
7. Notification is delivered.

## Test matrix

- Daily, weekly, monthly, custom 1h/12h intervals
- Pause/resume lifecycle
- Cancellation and withdraw remaining
- Reward on/off scenarios
- Retry behavior on transient RPC failure
- Duplicate prevention across executor restarts

## Success criteria

- No duplicate executions
- Remaining payment counter decrements correctly
- Final payment closes schedule and emits completion event
