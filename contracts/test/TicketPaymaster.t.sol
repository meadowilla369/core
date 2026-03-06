// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import "@openzeppelin/contracts/account/utils/EIP7702Utils.sol";

import "../src/Handler.sol";
import "../src/TicketPaymaster.sol";

contract TicketPaymasterTest is Test {
    address internal admin = address(0xA11CE);
    address payable internal user = payable(address(0xCAFE));

    TicketPaymaster internal paymaster;
    Handler internal handlerImplementation;

    function setUp() public {
        vm.deal(admin, 20 ether);
        vm.deal(user, 1 ether);

        vm.prank(admin);
        paymaster = new TicketPaymaster(admin, 0.5 ether);

        handlerImplementation = new Handler(address(paymaster));

        vm.startPrank(admin);
        paymaster.addHandler(address(handlerImplementation));
        paymaster.deposit{value: 5 ether}();
        vm.stopPrank();
    }

    function testRefillGasCapsAtMaxPerTx() public {
        _delegateUserToHandler();

        uint256 beforeBalance = user.balance;

        vm.prank(user);
        uint256 refunded = paymaster.refillGas(user, 1 ether);

        assertEq(refunded, 0.5 ether);
        assertEq(paymaster.totalGasSponsored(user), 0.5 ether);
        assertEq(user.balance, beforeBalance + 0.5 ether);
    }

    function testRefillGas_RevertIfUnauthorizedHandler() public {
        vm.prank(user);
        vm.expectRevert("TicketPaymaster: unauthorized handler");
        paymaster.refillGas(user, 1 wei);
    }

    function testRefillGas_RevertIfUserMismatch() public {
        _delegateUserToHandler();

        vm.prank(user);
        vm.expectRevert("TicketPaymaster: user mismatch");
        paymaster.refillGas(payable(address(0xBEEF)), 1 wei);
    }

    function testPaymasterAuthorization() public {
        assertTrue(paymaster.authorizedHandlers(address(handlerImplementation)));

        vm.prank(admin);
        paymaster.removeHandler(address(handlerImplementation));
        assertFalse(paymaster.authorizedHandlers(address(handlerImplementation)));

        vm.prank(admin);
        paymaster.addHandler(address(handlerImplementation));
        assertTrue(paymaster.authorizedHandlers(address(handlerImplementation)));
    }

    function testGasAccountingAcrossRefunds() public {
        _delegateUserToHandler();

        vm.prank(user);
        paymaster.refillGas(user, 0.1 ether);

        vm.prank(user);
        paymaster.refillGas(user, 0.2 ether);

        assertEq(paymaster.totalGasSponsored(user), 0.3 ether);
    }

    function _delegateUserToHandler() internal {
        vm.etch(address(user), abi.encodePacked(bytes3(0xef0100), bytes20(address(handlerImplementation))));
        assertEq(EIP7702Utils.fetchDelegate(user), address(handlerImplementation));
    }
}
