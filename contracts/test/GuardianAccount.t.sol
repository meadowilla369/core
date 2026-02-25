// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import "../src/GuardianAccount.sol";

contract CounterTarget {
    uint256 public value;

    function increment() external {
        value += 1;
    }
}

contract GuardianAccountTest is Test {
    GuardianAccount internal account;
    CounterTarget internal target;

    address internal owner = address(0xA11CE);
    address internal guardian = address(0xBEEF);
    address internal newOwner = address(0xCAFE);

    function setUp() public {
        account = new GuardianAccount(owner, guardian, 2 days);
        target = new CounterTarget();
    }

    function testInitiateRecoverySetsPendingOwner() public {
        vm.prank(guardian);
        account.initiateRecovery(newOwner);

        assertTrue(account.isRecoveryPending());
        assertEq(account.pendingNewOwner(), newOwner);
        assertEq(account.recoveryInitiated(), block.timestamp);
    }

    function testCompleteRecoveryRevertsBeforeDelay() public {
        vm.prank(guardian);
        account.initiateRecovery(newOwner);

        vm.prank(guardian);
        vm.expectRevert("GuardianAccount: recovery delay active");
        account.completeRecovery();
    }

    function testCompleteRecoveryUpdatesOwnerAfterDelay() public {
        vm.prank(guardian);
        account.initiateRecovery(newOwner);

        vm.warp(block.timestamp + 2 days);

        vm.prank(guardian);
        account.completeRecovery();

        assertEq(account.owner(), newOwner);
        assertFalse(account.isRecoveryPending());
    }

    function testOwnerCanCancelRecovery() public {
        vm.prank(guardian);
        account.initiateRecovery(newOwner);

        vm.prank(owner);
        account.cancelRecovery();

        assertFalse(account.isRecoveryPending());
        assertEq(account.pendingNewOwner(), address(0));
    }

    function testExecuteByOwnerCallsTarget() public {
        bytes memory callData = abi.encodeWithSelector(CounterTarget.increment.selector);

        vm.prank(owner);
        account.execute(address(target), 0, callData);

        assertEq(target.value(), 1);
    }

    function testExecuteRevertsWhileRecoveryPending() public {
        vm.prank(guardian);
        account.initiateRecovery(newOwner);

        bytes memory callData = abi.encodeWithSelector(CounterTarget.increment.selector);

        vm.prank(owner);
        vm.expectRevert("GuardianAccount: recovery pending");
        account.execute(address(target), 0, callData);
    }

    function testNonGuardianCannotInitiateRecovery() public {
        vm.prank(owner);
        vm.expectRevert("GuardianAccount: not guardian");
        account.initiateRecovery(newOwner);
    }
}
