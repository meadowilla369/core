// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/TicketNFT.sol";

contract TicketNFTTest is Test {
    TicketNFT internal ticket;
    address internal admin = address(0xA11CE);
    address internal minter = address(0xBEEF);
    address internal user = address(0xCAFE);

    function setUp() public {
        vm.prank(admin);
        ticket = new TicketNFT("Ticket", "TIX", admin);
        vm.startPrank(admin);
        ticket.setMinter(minter);
        ticket.configureEvent(1, 10);
        ticket.configureTicketType(1, 1000);
        vm.stopPrank();
    }

    function testMintIncrementsSupply() public {
        vm.prank(minter);
        ticket.mint(user, 1, 1, "A1");
        assertEq(ticket.balanceOf(user), 1);
        assertEq(ticket.mintedPerEvent(1), 1);
    }
}
