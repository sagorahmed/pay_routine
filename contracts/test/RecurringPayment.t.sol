// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {RecurringPayment} from "../src/RecurringPayment.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";

contract RecurringPaymentTest is Test {
    RecurringPayment internal recurring;
    MockUSDC internal usdc;

    address internal creator = address(0xA11CE);
    address internal recipient = address(0xB0B);
    address internal executor = address(0xE0E);

    uint128 internal amountPerPayment = 300e6;
    uint32 internal paymentCount = 3;
    uint64 internal interval = 30 days;
    uint96 internal reward = 2e4;

    function setUp() public {
        recurring = new RecurringPayment(address(this));
        usdc = new MockUSDC();

        usdc.mint(creator, 2_000_000e6);

        vm.prank(creator);
        usdc.approve(address(recurring), type(uint256).max);
    }

    function testCreateScheduleEscrowsFullAmount() public {
        uint256 expectedEscrow = uint256(amountPerPayment + reward) * paymentCount;

        vm.prank(creator);
        uint256 id = recurring.createSchedule(
            recipient,
            address(usdc),
            amountPerPayment,
            paymentCount,
            uint64(block.timestamp + 1 days),
            interval,
            reward
        );

        RecurringPayment.Schedule memory schedule = recurring.getSchedule(id);
        assertEq(schedule.depositedAmount, expectedEscrow);
        assertEq(usdc.balanceOf(address(recurring)), expectedEscrow);
        assertEq(schedule.remainingPayments, paymentCount);
    }

    function testExecutePayment() public {
        vm.prank(creator);
        uint256 id = recurring.createSchedule(
            recipient,
            address(usdc),
            amountPerPayment,
            paymentCount,
            uint64(block.timestamp + 1 hours),
            interval,
            reward
        );

        vm.warp(block.timestamp + 1 hours + 1);

        vm.prank(executor);
        recurring.executePayment(id);

        RecurringPayment.Schedule memory schedule = recurring.getSchedule(id);

        assertEq(schedule.remainingPayments, paymentCount - 1);
        assertEq(usdc.balanceOf(recipient), amountPerPayment);
        assertEq(usdc.balanceOf(executor), reward);
    }

    function testPauseResumeAndCancel() public {
        vm.prank(creator);
        uint256 id = recurring.createSchedule(
            recipient,
            address(usdc),
            amountPerPayment,
            paymentCount,
            uint64(block.timestamp + 1 hours),
            interval,
            reward
        );

        vm.prank(creator);
        recurring.pauseSchedule(id);

        vm.expectRevert(RecurringPayment.ScheduleIsPaused.selector);
        vm.prank(executor);
        recurring.executePayment(id);

        vm.prank(creator);
        recurring.resumeSchedule(id);

        vm.prank(creator);
        recurring.cancelSchedule(id);

        vm.expectRevert(RecurringPayment.ScheduleInactive.selector);
        vm.prank(executor);
        recurring.executePayment(id);
    }

    function testWithdrawRemainingAfterCancel() public {
        vm.prank(creator);
        uint256 id = recurring.createSchedule(
            recipient,
            address(usdc),
            amountPerPayment,
            paymentCount,
            uint64(block.timestamp + 1 hours),
            interval,
            reward
        );

        vm.warp(block.timestamp + 1 hours + 1);

        vm.prank(executor);
        recurring.executePayment(id);

        vm.prank(creator);
        recurring.cancelSchedule(id);

        uint256 creatorBalanceBefore = usdc.balanceOf(creator);

        vm.prank(creator);
        recurring.withdrawRemaining(id);

        uint256 creatorBalanceAfter = usdc.balanceOf(creator);
        assertGt(creatorBalanceAfter, creatorBalanceBefore);
    }

    function testCompletesAfterFinalPayment() public {
        vm.prank(creator);
        uint256 id = recurring.createSchedule(
            recipient,
            address(usdc),
            amountPerPayment,
            paymentCount,
            uint64(block.timestamp + 1 hours),
            interval,
            reward
        );

        for (uint256 i; i < paymentCount; i++) {
            vm.warp(block.timestamp + interval + 1);
            vm.prank(executor);
            recurring.executePayment(id);
        }

        RecurringPayment.Schedule memory schedule = recurring.getSchedule(id);
        assertFalse(schedule.active);
        assertEq(schedule.remainingPayments, 0);
    }
}
