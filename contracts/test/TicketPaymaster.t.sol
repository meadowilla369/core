// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

import "../src/TicketPaymaster.sol";
import "../interfaces/ITicketPaymaster.sol";

contract TicketPaymasterTest is Test {
    TicketPaymaster internal paymaster;

    address internal admin = address(0xA11CE);
    address internal entryPoint = address(0xE11E);
    address internal user = address(0xCAFE);

    uint256 internal sessionSignerPk = 0xA11CE123;
    address internal sessionSigner;

    function setUp() public {
        sessionSigner = vm.addr(sessionSignerPk);

        vm.prank(admin);
        paymaster = new TicketPaymaster(admin, entryPoint, sessionSigner);
    }

    function testValidateAndPostOpTracksGasSpend() public {
        bytes32 policyHash = keccak256("policy-1");
        uint256 expiresAt = block.timestamp + 1 days;
        uint256 maxCost = 900;
        bytes32 userOpHash = keccak256("user-op-1");

        _setBudgetAndPolicy(user, 1_000, policyHash, expiresAt);

        ITicketPaymaster.UserOperation memory userOp =
            _userOp(user, abi.encode(expiresAt, policyHash, _sign(userOpHash, user, policyHash, expiresAt, maxCost)));

        vm.prank(entryPoint);
        (bytes memory context, uint256 validationData) = paymaster.validatePaymasterUserOp(userOp, userOpHash, maxCost);
        assertEq(validationData, 0);

        vm.prank(entryPoint);
        paymaster.postOp(ITicketPaymaster.PostOpMode.opSucceeded, context, 700);

        assertEq(paymaster.spentDayIndex(user), block.timestamp / 1 days);
        assertEq(paymaster.spentToday(user), 700);
    }

    function testValidateRevertsWhenBudgetExceeded() public {
        bytes32 policyHash = keccak256("policy-2");
        uint256 expiresAt = block.timestamp + 1 days;
        uint256 maxCost = 1_001;
        bytes32 userOpHash = keccak256("user-op-2");

        _setBudgetAndPolicy(user, 1_000, policyHash, expiresAt);

        ITicketPaymaster.UserOperation memory userOp =
            _userOp(user, abi.encode(expiresAt, policyHash, _sign(userOpHash, user, policyHash, expiresAt, maxCost)));

        vm.prank(entryPoint);
        vm.expectRevert("TicketPaymaster: budget exceeded");
        paymaster.validatePaymasterUserOp(userOp, userOpHash, maxCost);
    }

    function testValidateRevertsWhenSignatureInvalid() public {
        bytes32 policyHash = keccak256("policy-3");
        uint256 expiresAt = block.timestamp + 1 days;
        uint256 maxCost = 500;
        bytes32 userOpHash = keccak256("user-op-3");

        _setBudgetAndPolicy(user, 1_000, policyHash, expiresAt);

        ITicketPaymaster.UserOperation memory userOp = _userOp(user, abi.encode(expiresAt, policyHash, bytes("bad")));

        vm.prank(entryPoint);
        vm.expectRevert();
        paymaster.validatePaymasterUserOp(userOp, userOpHash, maxCost);
    }

    function testValidateRevertsWhenPolicyUnknown() public {
        bytes32 policyHash = keccak256("policy-4");
        uint256 expiresAt = block.timestamp + 1 days;
        uint256 maxCost = 500;
        bytes32 userOpHash = keccak256("user-op-4");

        vm.prank(admin);
        paymaster.setDailyGasBudget(user, 1_000);

        ITicketPaymaster.UserOperation memory userOp =
            _userOp(user, abi.encode(expiresAt, policyHash, _sign(userOpHash, user, policyHash, expiresAt, maxCost)));

        vm.prank(entryPoint);
        vm.expectRevert("TicketPaymaster: unknown policy");
        paymaster.validatePaymasterUserOp(userOp, userOpHash, maxCost);
    }

    function testPostOpRevertsWhenCallerNotEntryPoint() public {
        vm.expectRevert("TicketPaymaster: only entrypoint");
        paymaster.postOp(ITicketPaymaster.PostOpMode.opSucceeded, abi.encode(user, 0), 100);
    }

    function testPostOpRevertsWhenActualCostExceedsBudget() public {
        bytes32 policyHash = keccak256("policy-5");
        uint256 expiresAt = block.timestamp + 1 days;
        uint256 maxCost = 900;
        bytes32 userOpHash = keccak256("user-op-5");

        _setBudgetAndPolicy(user, 1_000, policyHash, expiresAt);

        ITicketPaymaster.UserOperation memory userOp =
            _userOp(user, abi.encode(expiresAt, policyHash, _sign(userOpHash, user, policyHash, expiresAt, maxCost)));

        vm.prank(entryPoint);
        (bytes memory context,) = paymaster.validatePaymasterUserOp(userOp, userOpHash, maxCost);

        vm.prank(entryPoint);
        vm.expectRevert("TicketPaymaster: postOp budget exceeded");
        paymaster.postOp(ITicketPaymaster.PostOpMode.opSucceeded, context, 1_001);
    }

    function _setBudgetAndPolicy(address targetUser, uint256 budget, bytes32 policyHash, uint256 expiresAt) internal {
        vm.startPrank(admin);
        paymaster.setDailyGasBudget(targetUser, budget);
        paymaster.setSessionPolicy(targetUser, policyHash, expiresAt);
        vm.stopPrank();
    }

    function _userOp(address sender, bytes memory paymasterAndData)
        internal
        pure
        returns (ITicketPaymaster.UserOperation memory op)
    {
        op.sender = sender;
        op.nonce = 0;
        op.initCode = "";
        op.callData = "";
        op.callGasLimit = 100_000;
        op.verificationGasLimit = 100_000;
        op.preVerificationGas = 21_000;
        op.maxFeePerGas = 1;
        op.maxPriorityFeePerGas = 1;
        op.paymasterAndData = paymasterAndData;
        op.signature = "";
    }

    function _sign(bytes32 userOpHash, address sender, bytes32 policyHash, uint256 expiresAt, uint256 maxCost)
        internal
        view
        returns (bytes memory)
    {
        bytes32 digest = keccak256(
            abi.encode(address(paymaster), block.chainid, userOpHash, sender, policyHash, expiresAt, maxCost)
        );
        bytes32 signedDigest = MessageHashUtils.toEthSignedMessageHash(digest);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(sessionSignerPk, signedDigest);
        return abi.encodePacked(r, s, v);
    }
}
