// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract RecurringPayment is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public nextScheduleId;

    error InvalidRecipient();
    error InvalidToken();
    error InvalidAmount();
    error InvalidPaymentCount();
    error InvalidInterval();
    error InvalidStartTime();
    error Unauthorized();
    error ScheduleInactive();
    error ScheduleIsPaused();
    error ScheduleIsCancelled();
    error NotDueYet();
    error NoRemainingPayments();
    error NothingToWithdraw();

    struct Schedule {
        address creator;
        address recipient;
        address token;
        uint128 amountPerPayment;
        uint32 totalPayments;
        uint32 remainingPayments;
        uint64 nextExecution;
        uint64 intervalSeconds;
        uint128 depositedAmount;
        bool active;
        bool paused;
        bool cancelled;
        uint96 executorReward;
    }

    mapping(uint256 => Schedule) private schedules;
    mapping(address => uint256[]) private schedulesByUser;

    event ScheduleCreated(
        uint256 indexed scheduleId,
        address indexed creator,
        address indexed recipient,
        address token,
        uint128 amountPerPayment,
        uint32 totalPayments,
        uint64 nextExecution,
        uint64 intervalSeconds,
        uint96 executorReward,
        uint128 depositedAmount
    );

    event PaymentExecuted(
        uint256 indexed scheduleId,
        address indexed recipient,
        address indexed executor,
        uint128 amount,
        uint96 executorReward,
        uint32 remainingPayments,
        uint64 nextExecution
    );

    event SchedulePaused(uint256 indexed scheduleId);
    event ScheduleResumed(uint256 indexed scheduleId, uint64 nextExecution);
    event ScheduleCancelled(uint256 indexed scheduleId);
    event ScheduleCompleted(uint256 indexed scheduleId);

    constructor(address initialOwner) Ownable(initialOwner) {}

    function createSchedule(
        address recipient,
        address token,
        uint128 amountPerPayment,
        uint32 totalPayments,
        uint64 startTime,
        uint64 intervalSeconds,
        uint96 executorReward
    ) external nonReentrant returns (uint256 scheduleId) {
        if (recipient == address(0) || recipient == msg.sender) revert InvalidRecipient();
        if (token == address(0)) revert InvalidToken();
        if (amountPerPayment == 0) revert InvalidAmount();
        if (totalPayments == 0) revert InvalidPaymentCount();
        if (intervalSeconds == 0) revert InvalidInterval();

        uint64 scheduledStart = startTime;
        if (scheduledStart == 0) {
            scheduledStart = uint64(block.timestamp);
        }
        if (scheduledStart < block.timestamp) revert InvalidStartTime();

        uint256 singleExecution = uint256(amountPerPayment) + uint256(executorReward);
        uint256 totalDeposit = singleExecution * uint256(totalPayments);

        if (totalDeposit > type(uint128).max) revert InvalidAmount();

        scheduleId = nextScheduleId++;

        schedules[scheduleId] = Schedule({
            creator: msg.sender,
            recipient: recipient,
            token: token,
            amountPerPayment: amountPerPayment,
            totalPayments: totalPayments,
            remainingPayments: totalPayments,
            nextExecution: scheduledStart,
            intervalSeconds: intervalSeconds,
            depositedAmount: uint128(totalDeposit),
            active: true,
            paused: false,
            cancelled: false,
            executorReward: executorReward
        });

        schedulesByUser[msg.sender].push(scheduleId);

        IERC20(token).safeTransferFrom(msg.sender, address(this), totalDeposit);

        emit ScheduleCreated(
            scheduleId,
            msg.sender,
            recipient,
            token,
            amountPerPayment,
            totalPayments,
            scheduledStart,
            intervalSeconds,
            executorReward,
            uint128(totalDeposit)
        );
    }

    function pauseSchedule(uint256 scheduleId) external {
        Schedule storage schedule = schedules[scheduleId];
        _assertCreator(schedule);
        if (!schedule.active) revert ScheduleInactive();
        if (schedule.cancelled) revert ScheduleIsCancelled();
        if (schedule.paused) revert ScheduleIsPaused();

        schedule.paused = true;
        emit SchedulePaused(scheduleId);
    }

    function resumeSchedule(uint256 scheduleId) external {
        Schedule storage schedule = schedules[scheduleId];
        _assertCreator(schedule);
        if (!schedule.active) revert ScheduleInactive();
        if (schedule.cancelled) revert ScheduleIsCancelled();
        if (!schedule.paused) revert ScheduleInactive();

        schedule.paused = false;
        schedule.nextExecution = uint64(block.timestamp) + schedule.intervalSeconds;
        emit ScheduleResumed(scheduleId, schedule.nextExecution);
    }

    function cancelSchedule(uint256 scheduleId) external {
        Schedule storage schedule = schedules[scheduleId];
        _assertCreator(schedule);
        if (!schedule.active) revert ScheduleInactive();
        if (schedule.cancelled) revert ScheduleIsCancelled();

        schedule.active = false;
        schedule.paused = false;
        schedule.cancelled = true;

        emit ScheduleCancelled(scheduleId);
    }

    function executePayment(uint256 scheduleId) external nonReentrant {
        Schedule storage schedule = schedules[scheduleId];
        if (!schedule.active) revert ScheduleInactive();
        if (schedule.paused) revert ScheduleIsPaused();
        if (schedule.cancelled) revert ScheduleIsCancelled();
        if (schedule.remainingPayments == 0) revert NoRemainingPayments();
        if (block.timestamp < schedule.nextExecution) revert NotDueYet();

        uint256 payout = uint256(schedule.amountPerPayment);
        uint256 reward = uint256(schedule.executorReward);
        uint256 totalDebit = payout + reward;

        schedule.remainingPayments -= 1;
        schedule.depositedAmount -= uint128(totalDebit);

        IERC20(schedule.token).safeTransfer(schedule.recipient, payout);

        if (reward > 0) {
            IERC20(schedule.token).safeTransfer(msg.sender, reward);
        }

        if (schedule.remainingPayments == 0) {
            schedule.active = false;
            emit ScheduleCompleted(scheduleId);
        } else {
            schedule.nextExecution += schedule.intervalSeconds;
        }

        emit PaymentExecuted(
            scheduleId,
            schedule.recipient,
            msg.sender,
            schedule.amountPerPayment,
            schedule.executorReward,
            schedule.remainingPayments,
            schedule.nextExecution
        );
    }

    function withdrawRemaining(uint256 scheduleId) external nonReentrant {
        Schedule storage schedule = schedules[scheduleId];
        _assertCreator(schedule);

        if (!schedule.cancelled && schedule.active) revert ScheduleInactive();
        uint256 amount = schedule.depositedAmount;
        if (amount == 0) revert NothingToWithdraw();

        schedule.depositedAmount = 0;
        IERC20(schedule.token).safeTransfer(schedule.creator, amount);
    }

    function getSchedule(uint256 scheduleId) external view returns (Schedule memory) {
        return schedules[scheduleId];
    }

    function getSchedulesByUser(address user) external view returns (uint256[] memory) {
        return schedulesByUser[user];
    }

    function _assertCreator(Schedule storage schedule) private view {
        if (schedule.creator == address(0) || schedule.creator != msg.sender) revert Unauthorized();
    }
}
