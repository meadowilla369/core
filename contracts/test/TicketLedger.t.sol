// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/TicketLedger.sol";

contract TicketLedgerTest is Test {
    TicketLedger internal ledger;

    address internal admin = address(0xA11CE);
    address internal checkinOperator = address(0xC11EC);
    address internal refundOperator = address(0xF00D);
    address internal buyer = address(0xB0B);
    address internal otherUser = address(0xCAFE);

    function setUp() public {
        vm.prank(admin);
        ledger = new TicketLedger(admin);

        vm.startPrank(admin);
        ledger.grantRole(ledger.CHECKIN_ROLE(), checkinOperator);
        ledger.grantRole(ledger.REFUND_ROLE(), refundOperator);
        vm.stopPrank();
    }

    function testPurchaseWithHash() public {
        bytes32 paymentHash = keccak256("purchase-happy-path");
        _authorizeHash(paymentHash);

        vm.prank(buyer);
        uint256[] memory ticketIds = ledger.purchaseWithHash(1, 2, 2, paymentHash);

        assertEq(ticketIds.length, 2);
        assertEq(ledger.ticketCounter(), 2);
        assertTrue(ledger.usedPaymentHashes(paymentHash));
        assertFalse(ledger.isPaymentHashAuthorized(paymentHash));

        (uint256 ticketId,,, address owner,, bool used, uint256 purchasedAt,) = ledger.tickets(ticketIds[0]);
        assertEq(ticketId, ticketIds[0]);
        assertEq(owner, buyer);
        assertFalse(used);
        assertGt(purchasedAt, 0);
    }

    function testPurchaseWithHash_RevertIfHashUsed() public {
        bytes32 paymentHash = keccak256("purchase-double-spend");
        _authorizeHash(paymentHash);

        vm.prank(buyer);
        ledger.purchaseWithHash(1, 2, 1, paymentHash);

        vm.prank(buyer);
        vm.expectRevert("TicketLedger: payment hash used");
        ledger.purchaseWithHash(1, 2, 1, paymentHash);
    }

    function testPurchaseWithHash_RevertIfInvalidHash() public {
        bytes32 paymentHash = keccak256("not-authorized");

        vm.prank(buyer);
        vm.expectRevert("TicketLedger: unauthorized hash");
        ledger.purchaseWithHash(1, 2, 1, paymentHash);
    }

    function testTransferTicket() public {
        uint256 ticketId = _purchaseOneTicket(buyer, keccak256("transfer-success"));

        vm.prank(buyer);
        ledger.transferTicket(ticketId, otherUser);

        (,,, address owner,,,,) = ledger.tickets(ticketId);
        assertEq(owner, otherUser);

        uint256[] memory buyerTickets = ledger.getTicketsByOwner(buyer);
        uint256[] memory otherTickets = ledger.getTicketsByOwner(otherUser);

        assertEq(buyerTickets.length, 0);
        assertEq(otherTickets.length, 1);
        assertEq(otherTickets[0], ticketId);
    }

    function testTransferTicket_RevertIfNotOwner() public {
        uint256 ticketId = _purchaseOneTicket(buyer, keccak256("transfer-not-owner"));

        vm.prank(otherUser);
        vm.expectRevert("TicketLedger: caller is not owner");
        ledger.transferTicket(ticketId, admin);
    }

    function testGetTicketsByOwner() public {
        uint256[] memory ticketIds = _purchaseTwoTickets(buyer, keccak256("query-owner"));

        uint256[] memory owned = ledger.getTicketsByOwner(buyer);
        assertEq(owned.length, 2);
        assertEq(owned[0], ticketIds[0]);
        assertEq(owned[1], ticketIds[1]);
    }

    function testMarkUsedBatch() public {
        uint256[] memory ticketIds = _purchaseTwoTickets(buyer, keccak256("mark-used"));

        vm.prank(checkinOperator);
        ledger.markUsedBatch(ticketIds);

        for (uint256 i = 0; i < ticketIds.length; ++i) {
            (,,,,, bool used,, uint256 usedAt) = ledger.tickets(ticketIds[i]);
            assertTrue(used);
            assertGt(usedAt, 0);
        }
    }

    function testMarkUsedBatch_RevertIfNotRole() public {
        uint256[] memory ticketIds = _purchaseTwoTickets(buyer, keccak256("mark-used-role"));

        vm.prank(otherUser);
        vm.expectRevert();
        ledger.markUsedBatch(ticketIds);
    }

    function testCancelTicket() public {
        uint256 ticketId = _purchaseOneTicket(buyer, keccak256("cancel-ticket"));

        vm.prank(refundOperator);
        ledger.cancelTicket(ticketId);

        (,,, address owner,,,,) = ledger.tickets(ticketId);
        assertEq(owner, address(0));

        uint256[] memory owned = ledger.getTicketsByOwner(buyer);
        assertEq(owned.length, 0);
    }

    function testCancelTicket_RevertIfUsed() public {
        uint256 ticketId = _purchaseOneTicket(buyer, keccak256("cancel-used"));

        uint256[] memory ticketIds = new uint256[](1);
        ticketIds[0] = ticketId;

        vm.prank(checkinOperator);
        ledger.markUsedBatch(ticketIds);

        vm.prank(refundOperator);
        vm.expectRevert("TicketLedger: ticket already used");
        ledger.cancelTicket(ticketId);
    }

    function _authorizeHash(bytes32 paymentHash) internal {
        vm.prank(admin);
        ledger.authorizePaymentHash(paymentHash);
    }

    function _purchaseOneTicket(address recipient, bytes32 paymentHash) internal returns (uint256 ticketId) {
        _authorizeHash(paymentHash);

        vm.prank(recipient);
        uint256[] memory ticketIds = ledger.purchaseWithHash(1, 2, 1, paymentHash);
        return ticketIds[0];
    }

    function _purchaseTwoTickets(address recipient, bytes32 paymentHash) internal returns (uint256[] memory ticketIds) {
        _authorizeHash(paymentHash);

        vm.prank(recipient);
        return ledger.purchaseWithHash(1, 2, 2, paymentHash);
    }
}
