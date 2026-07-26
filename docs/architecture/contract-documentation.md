# Contract Documentation

Contract file: `contracts/src/RecurringPayment.sol`

## Core functions

- `createSchedule()`
- `pauseSchedule()`
- `resumeSchedule()`
- `cancelSchedule()`
- `executePayment()`
- `withdrawRemaining()`
- `getSchedule()`
- `getSchedulesByUser()`

## Events

- `ScheduleCreated`
- `PaymentExecuted`
- `SchedulePaused`
- `ScheduleResumed`
- `ScheduleCancelled`
- `ScheduleCompleted`

## Escrow model

At creation, user deposits:

`(amountPerPayment + executorReward) * totalPayments`

This guarantees all scheduled payouts are funded upfront.

## Security controls

- OpenZeppelin `SafeERC20`
- OpenZeppelin `ReentrancyGuard`
- Creator authorization checks for schedule management
- Due-time checks for execution (`block.timestamp >= nextExecution`)
- No loop-based batch processing in contract
