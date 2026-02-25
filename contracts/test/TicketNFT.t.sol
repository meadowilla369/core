// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/TicketNFT.sol";
import "../interfaces/ITicketNFT.sol";

contract TicketNFTTest is Test {
    TicketNFT internal ticket;
    address internal admin = address(0xA11CE);
    address internal minter = address(0xBEEF);
    address internal user = address(0xCAFE);
    address internal otherUser = address(0xB0B);

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
        _mintTicketTo(user, "A1");
        assertEq(ticket.balanceOf(user), 1);
        assertEq(ticket.mintedPerEvent(1), 1);
    }

    function testTransferRevertsWhenTicketAlreadyUsed() public {
        uint256 tokenId = _mintTicketTo(user, "A2");

        vm.prank(admin);
        ticket.markAsUsed(tokenId);

        vm.prank(user);
        vm.expectRevert("TicketNFT: used ticket");
        ticket.transferFrom(user, otherUser, tokenId);
    }

    function testTransferRevertsWhenEventCancelled() public {
        uint256 tokenId = _mintTicketTo(user, "A3");

        vm.prank(admin);
        ticket.cancelEvent(1);

        vm.prank(user);
        vm.expectRevert("TicketNFT: event cancelled");
        ticket.transferFrom(user, otherUser, tokenId);
    }

    function testTransferRevertsWhenRefundClaimed() public {
        uint256 tokenId = _mintTicketTo(user, "A4");

        vm.startPrank(admin);
        ticket.cancelEvent(1);
        ticket.markRefundClaimed(tokenId, 1000);
        vm.stopPrank();

        vm.prank(user);
        vm.expectRevert("TicketNFT: refunded ticket");
        ticket.transferFrom(user, otherUser, tokenId);
    }

    function testMarkRefundClaimedRevertsWhenEventActive() public {
        uint256 tokenId = _mintTicketTo(user, "B1");

        vm.prank(admin);
        vm.expectRevert("TicketNFT: event active");
        ticket.markRefundClaimed(tokenId, 1000);
    }

    function testMarkRefundClaimedRevertsForUsedTicket() public {
        uint256 tokenId = _mintTicketTo(user, "B2");

        vm.startPrank(admin);
        ticket.markAsUsed(tokenId);
        ticket.cancelEvent(1);
        vm.expectRevert("TicketNFT: already used");
        ticket.markRefundClaimed(tokenId, 1000);
        vm.stopPrank();
    }

    function testMarkRefundClaimedSucceedsForCancelledUnusedTicket() public {
        uint256 tokenId = _mintTicketTo(user, "B3");

        vm.startPrank(admin);
        ticket.cancelEvent(1);
        ticket.markRefundClaimed(tokenId, 1000);
        vm.stopPrank();

        ITicketNFT.TicketInfo memory info = ticket.ticketData(tokenId);
        assertTrue(info.refundClaimed);
        assertFalse(info.isUsed);
    }

    function _mintTicketTo(address to, bytes memory seatInfo) internal returns (uint256 tokenId) {
        vm.prank(minter);
        ticket.mint(to, 1, 1, seatInfo);
        return ticket.totalSupply();
    }
}
