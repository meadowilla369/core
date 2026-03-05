// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/TicketLedger.sol";

contract TicketLedgerTest is Test {
    TicketLedger internal ledger;

    bytes32 internal constant EIP712_DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 internal constant NAME_HASH = keccak256(bytes("TicketLedger"));
    bytes32 internal constant VERSION_HASH = keccak256(bytes("1"));
    bytes32 internal constant PURCHASE_TYPEHASH =
        keccak256("Purchase(uint256 eventId,uint256 ticketTypeId,uint256 quantity,bytes32 paymentHash,address buyer)");

    uint256 internal constant ADMIN_PK = 0xA11CE;
    uint256 internal constant UNAUTHORIZED_SIGNER_PK = 0xB0B0;

    address internal admin;
    address internal checkinOperator = address(0xC11EC);
    address internal refundOperator = address(0xF00D);
    address internal buyer = address(0xB0B);
    address internal otherUser = address(0xCAFE);

    function setUp() public {
        admin = vm.addr(ADMIN_PK);

        vm.prank(admin);
        ledger = new TicketLedger(admin);

        vm.startPrank(admin);
        ledger.grantRole(ledger.CHECKIN_ROLE(), checkinOperator);
        ledger.grantRole(ledger.REFUND_ROLE(), refundOperator);
        vm.stopPrank();
    }

    function testPurchaseWithSignature() public {
        bytes32 paymentHash = keccak256("purchase-happy-path");
        bytes memory signature = _signPurchaseAuthorization(ADMIN_PK, buyer, 1, 2, 2, paymentHash);

        vm.prank(buyer);
        uint256[] memory ticketIds = ledger.purchaseWithSignature(1, 2, 2, paymentHash, signature);

        assertEq(ticketIds.length, 2);
        assertEq(ledger.ticketCounter(), 2);
        assertTrue(ledger.usedPaymentHashes(paymentHash));

        (uint256 ticketId,,, address owner,, bool used, uint256 purchasedAt,) = ledger.tickets(ticketIds[0]);
        assertEq(ticketId, ticketIds[0]);
        assertEq(owner, buyer);
        assertFalse(used);
        assertGt(purchasedAt, 0);
    }

    function testPurchaseWithSignature_RevertIfInvalidSignature() public {
        bytes32 paymentHash = keccak256("purchase-invalid-signature");
        bytes memory signature = _signPurchaseAuthorization(ADMIN_PK, buyer, 1, 2, 1, paymentHash);

        vm.prank(otherUser);
        vm.expectRevert("TicketLedger: invalid signature");
        ledger.purchaseWithSignature(1, 2, 1, paymentHash, signature);
    }

    function testPurchaseWithSignature_RevertIfHashUsed() public {
        bytes32 paymentHash = keccak256("purchase-double-spend");
        bytes memory signature = _signPurchaseAuthorization(ADMIN_PK, buyer, 1, 2, 1, paymentHash);

        vm.prank(buyer);
        ledger.purchaseWithSignature(1, 2, 1, paymentHash, signature);

        vm.prank(buyer);
        vm.expectRevert("TicketLedger: payment hash used");
        ledger.purchaseWithSignature(1, 2, 1, paymentHash, signature);
    }

    function testPurchaseWithSignature_RevertIfSignerUnauthorized() public {
        bytes32 paymentHash = keccak256("unauthorized-signer");
        bytes memory signature = _signPurchaseAuthorization(UNAUTHORIZED_SIGNER_PK, buyer, 1, 2, 1, paymentHash);

        vm.prank(buyer);
        vm.expectRevert("TicketLedger: invalid signature");
        ledger.purchaseWithSignature(1, 2, 1, paymentHash, signature);
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

    function _purchaseOneTicket(address recipient, bytes32 paymentHash) internal returns (uint256 ticketId) {
        bytes memory signature = _signPurchaseAuthorization(ADMIN_PK, recipient, 1, 2, 1, paymentHash);

        vm.prank(recipient);
        uint256[] memory ticketIds = ledger.purchaseWithSignature(1, 2, 1, paymentHash, signature);
        return ticketIds[0];
    }

    function _purchaseTwoTickets(address recipient, bytes32 paymentHash) internal returns (uint256[] memory ticketIds) {
        bytes memory signature = _signPurchaseAuthorization(ADMIN_PK, recipient, 1, 2, 2, paymentHash);

        vm.prank(recipient);
        return ledger.purchaseWithSignature(1, 2, 2, paymentHash, signature);
    }

    function _signPurchaseAuthorization(
        uint256 signerPk,
        address recipient,
        uint256 eventId,
        uint256 ticketTypeId,
        uint256 quantity,
        bytes32 paymentHash
    ) internal view returns (bytes memory) {
        bytes32 domainSeparator = keccak256(
            abi.encode(EIP712_DOMAIN_TYPEHASH, NAME_HASH, VERSION_HASH, block.chainid, address(ledger))
        );
        bytes32 structHash =
            keccak256(abi.encode(PURCHASE_TYPEHASH, eventId, ticketTypeId, quantity, paymentHash, recipient));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPk, digest);
        return abi.encodePacked(r, s, v);
    }
}
