// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import "../src/MarketplaceV2.sol";
import "../src/TicketLedger.sol";

contract MarketplaceV2Test is Test {
    TicketLedger internal ledger;
    MarketplaceV2 internal marketplace;

    uint256 internal adminPk = uint256(keccak256("admin-key"));
    uint256 internal signerPk = uint256(keccak256("signer-key"));
    address internal admin;
    address internal signer;
    address internal seller = address(0xCAFE);
    address internal buyer = address(0xB0B);

    uint256 internal constant EVENT_ID = 1;
    uint256 internal constant TICKET_TYPE_ID = 1;

    function setUp() public {
        admin = vm.addr(adminPk);
        signer = vm.addr(signerPk);

        vm.startPrank(admin);
        ledger = new TicketLedger(admin);
        marketplace = new MarketplaceV2(address(ledger), admin);

        // Grant marketplace the ability to transfer tickets (CHECKIN_ROLE not needed; transferTicket is public)
        // Grant signer PAYMENT_HASH_ROLE on marketplace
        marketplace.grantRole(marketplace.PAYMENT_HASH_ROLE(), signer);
        vm.stopPrank();
    }

    // ── helpers ──────────────────────────────────────────────────────────────────

    uint256 private _mintNonce;

    function _mintTicketToSeller() internal returns (uint256 ticketId) {
        uint256 nonce = ++_mintNonce;
        bytes32 paymentHash = keccak256(abi.encodePacked("mint-payment", nonce));
        uint256 quantity = 1;

        bytes32 structHash = keccak256(
            abi.encode(
                keccak256(
                    "Purchase(uint256 eventId,uint256 ticketTypeId,uint256 quantity,bytes32 paymentHash,address buyer)"
                ),
                EVENT_ID,
                TICKET_TYPE_ID,
                quantity,
                paymentHash,
                seller
            )
        );
        bytes32 domainSep = keccak256(
            abi.encode(
                keccak256(
                    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                ),
                keccak256(bytes("TicketLedger")),
                keccak256(bytes("1")),
                block.chainid,
                address(ledger)
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSep, structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(adminPk, digest);
        bytes memory sig = abi.encodePacked(r, s, v);

        vm.prank(seller);
        uint256[] memory ids = ledger.purchaseWithSignature(EVENT_ID, TICKET_TYPE_ID, quantity, paymentHash, sig);
        ticketId = ids[0];
    }

    function _buildBuyDigest(uint256 listingId, bytes32 paymentHash, address buyerAddr)
        internal
        view
        returns (bytes32 digest)
    {
        bytes32 domainSep = keccak256(
            abi.encode(
                keccak256(
                    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                ),
                keccak256(bytes("MarketplaceV2")),
                keccak256(bytes("1")),
                block.chainid,
                address(marketplace)
            )
        );
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256("Buy(uint256 listingId,bytes32 paymentHash,address buyer)"),
                listingId,
                paymentHash,
                buyerAddr
            )
        );
        digest = keccak256(abi.encodePacked("\x19\x01", domainSep, structHash));
    }

    function _signBuy(uint256 listingId, bytes32 paymentHash, address buyerAddr)
        internal
        view
        returns (bytes memory sig)
    {
        bytes32 digest = _buildBuyDigest(listingId, paymentHash, buyerAddr);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPk, digest);
        sig = abi.encodePacked(r, s, v);
    }

    // ── helpers: transfer then list ───────────────────────────────────────────────

    /// @dev Simulates the two-step batch: seller transfers ticket to marketplace, then lists.
    function _transferAndList(uint256 ticketId, uint256 price) internal returns (uint256 listingId) {
        vm.startPrank(seller);
        ledger.transferTicket(ticketId, address(marketplace));
        listingId = marketplace.listTicket(ticketId, price);
        vm.stopPrank();
    }

    // ── listTicket ────────────────────────────────────────────────────────────────

    function testListTicket_HappyPath() public {
        uint256 ticketId = _mintTicketToSeller();
        uint256 price = 500_000;

        uint256 listingId = _transferAndList(ticketId, price);

        assertEq(listingId, 1);
        assertEq(marketplace.listingCounter(), 1);

        IMarketplaceV2.Listing memory lst = marketplace.getListing(1);
        assertEq(lst.listingId, 1);
        assertEq(lst.ticketId, ticketId);
        assertEq(lst.seller, seller);
        assertEq(lst.price, price);
        assertTrue(lst.active);

        // Ticket ownership transferred to marketplace
        (, , , address owner, , , ,) = ledger.tickets(ticketId);
        assertEq(owner, address(marketplace));
    }

    function testListTicket_RevertsWhenTicketNotInEscrow() public {
        uint256 ticketId = _mintTicketToSeller();
        // Buyer tries to list a ticket they don't own (ticket still with seller, not in escrow)
        vm.prank(buyer);
        vm.expectRevert("MarketplaceV2: ticket not in escrow");
        marketplace.listTicket(ticketId, 500_000);
    }

    function testListTicket_RevertsOnZeroPrice() public {
        uint256 ticketId = _mintTicketToSeller();
        vm.startPrank(seller);
        ledger.transferTicket(ticketId, address(marketplace));
        vm.expectRevert("MarketplaceV2: price required");
        marketplace.listTicket(ticketId, 0);
        vm.stopPrank();
    }

    function testListTicket_RevertsWhenTicketUsed() public {
        uint256 ticketId = _mintTicketToSeller();
        // Transfer to marketplace then mark used (admin simulates edge case)
        vm.prank(seller);
        ledger.transferTicket(ticketId, address(marketplace));

        uint256[] memory ids = new uint256[](1);
        ids[0] = ticketId;
        vm.prank(admin);
        ledger.markUsedBatch(ids);

        vm.prank(seller);
        vm.expectRevert("MarketplaceV2: ticket used");
        marketplace.listTicket(ticketId, 500_000);
    }

    // ── cancelListing ─────────────────────────────────────────────────────────────

    function testCancelListing_BySellerReturnsTicket() public {
        uint256 ticketId = _mintTicketToSeller();
        uint256 listingId = _transferAndList(ticketId, 500_000);

        vm.prank(seller);
        marketplace.cancelListing(listingId);

        IMarketplaceV2.Listing memory lst = marketplace.getListing(listingId);
        assertFalse(lst.active);

        // Ticket returned to seller
        (, , , address owner, , , ,) = ledger.tickets(ticketId);
        assertEq(owner, seller);
    }

    function testCancelListing_RevertsWhenNotSeller() public {
        uint256 ticketId = _mintTicketToSeller();
        uint256 listingId = _transferAndList(ticketId, 500_000);

        vm.prank(buyer);
        vm.expectRevert("MarketplaceV2: not authorized");
        marketplace.cancelListing(listingId);
    }

    function testCancelListing_RevertsWhenInactive() public {
        uint256 ticketId = _mintTicketToSeller();
        uint256 listingId = _transferAndList(ticketId, 500_000);

        vm.prank(seller);
        marketplace.cancelListing(listingId);

        vm.prank(seller);
        vm.expectRevert("MarketplaceV2: listing inactive");
        marketplace.cancelListing(listingId);
    }

    // ── buyWithSignature ──────────────────────────────────────────────────────────

    function testBuyWithSignature_HappyPath() public {
        uint256 ticketId = _mintTicketToSeller();
        uint256 price = 500_000;
        uint256 listingId = _transferAndList(ticketId, price);

        bytes32 paymentHash = keccak256("buy-payment-001");
        bytes memory sig = _signBuy(listingId, paymentHash, buyer);

        vm.prank(buyer);
        marketplace.buyWithSignature(listingId, paymentHash, sig);

        // Ticket transferred to buyer
        (, , , address owner, , , ,) = ledger.tickets(ticketId);
        assertEq(owner, buyer);

        // Listing inactive
        IMarketplaceV2.Listing memory lst = marketplace.getListing(listingId);
        assertFalse(lst.active);

        // Pending payout recorded for seller
        assertEq(marketplace.pendingPayouts(seller), price);

        // Payment hash consumed
        assertTrue(marketplace.usedPaymentHashes(paymentHash));
    }

    function testBuyWithSignature_RevertsWhenInvalidSignature() public {
        uint256 ticketId = _mintTicketToSeller();
        uint256 listingId = _transferAndList(ticketId, 500_000);

        bytes32 paymentHash = keccak256("bad-sig-payment");
        // Sign with wrong key
        bytes32 digest = _buildBuyDigest(listingId, paymentHash, buyer);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(uint256(keccak256("wrong-key")), digest);
        bytes memory badSig = abi.encodePacked(r, s, v);

        vm.prank(buyer);
        vm.expectRevert("MarketplaceV2: invalid signature");
        marketplace.buyWithSignature(listingId, paymentHash, badSig);
    }

    function testBuyWithSignature_RevertsWhenPaymentHashReused() public {
        uint256 ticketId = _mintTicketToSeller();
        uint256 listingId = _transferAndList(ticketId, 500_000);

        bytes32 paymentHash = keccak256("replay-payment");
        bytes memory sig = _signBuy(listingId, paymentHash, buyer);

        vm.prank(buyer);
        marketplace.buyWithSignature(listingId, paymentHash, sig);

        // Attempt replay - need a fresh listed ticket
        uint256 ticketId2 = _mintTicketToSeller();
        uint256 listingId2 = _transferAndList(ticketId2, 500_000);
        bytes memory sig2 = _signBuy(listingId2, paymentHash, buyer);

        vm.prank(buyer);
        vm.expectRevert("MarketplaceV2: payment hash used");
        marketplace.buyWithSignature(listingId2, paymentHash, sig2);
    }

    function testBuyWithSignature_RevertsWhenListingInactive() public {
        uint256 ticketId = _mintTicketToSeller();
        uint256 listingId = _transferAndList(ticketId, 500_000);

        vm.prank(seller);
        marketplace.cancelListing(listingId);

        bytes32 paymentHash = keccak256("inactive-listing-payment");
        bytes memory sig = _signBuy(listingId, paymentHash, buyer);

        vm.prank(buyer);
        vm.expectRevert("MarketplaceV2: listing inactive");
        marketplace.buyWithSignature(listingId, paymentHash, sig);
    }

    function testBuyWithSignature_RevertsWhenSellerBuysOwnListing() public {
        uint256 ticketId = _mintTicketToSeller();
        uint256 listingId = _transferAndList(ticketId, 500_000);

        bytes32 paymentHash = keccak256("self-buy-payment");
        bytes memory sig = _signBuy(listingId, paymentHash, seller);

        vm.prank(seller);
        vm.expectRevert("MarketplaceV2: seller cannot buy own listing");
        marketplace.buyWithSignature(listingId, paymentHash, sig);
    }

    function testBuyWithSignature_RevertsOnZeroPaymentHash() public {
        uint256 ticketId = _mintTicketToSeller();
        uint256 listingId = _transferAndList(ticketId, 500_000);

        bytes32 paymentHash = bytes32(0);
        bytes memory sig = _signBuy(listingId, paymentHash, buyer);

        vm.prank(buyer);
        vm.expectRevert("MarketplaceV2: invalid payment hash");
        marketplace.buyWithSignature(listingId, paymentHash, sig);
    }

    // ── setMaxMarkupBps ───────────────────────────────────────────────────────────

    function testSetMaxMarkupBps_UpdatesByAdmin() public {
        vm.prank(admin);
        marketplace.setMaxMarkupBps(11000);
        assertEq(marketplace.maxMarkupBps(), 11000);
    }

    function testSetMaxMarkupBps_RevertsOutOfRange() public {
        vm.prank(admin);
        vm.expectRevert("MarketplaceV2: invalid markup");
        marketplace.setMaxMarkupBps(9999);
    }

    // ── full journey: list → buy (Flow 1 + Flow 2 combined) ──────────────────────

    function testFullJourney_BuyThenResell() public {
        // Seller purchases (simulates end of Flow 1)
        uint256 ticketId = _mintTicketToSeller();

        (, , , address ownerAfterMint, , , ,) = ledger.tickets(ticketId);
        assertEq(ownerAfterMint, seller, "seller should own ticket after mint");

        // Flow 2a: Seller transfers to marketplace then lists (two-step batch)
        uint256 listingId = _transferAndList(ticketId, 600_000);

        (, , , address ownerAfterList, , , ,) = ledger.tickets(ticketId);
        assertEq(ownerAfterList, address(marketplace), "marketplace should hold ticket during listing");

        // Flow 2b: Buyer buys via EIP-712 signed payment hash
        bytes32 paymentHash = keccak256("full-journey-payment");
        bytes memory sig = _signBuy(listingId, paymentHash, buyer);

        vm.prank(buyer);
        marketplace.buyWithSignature(listingId, paymentHash, sig);

        (, , , address ownerAfterBuy, , , ,) = ledger.tickets(ticketId);
        assertEq(ownerAfterBuy, buyer, "buyer should own ticket after purchase");

        assertEq(marketplace.pendingPayouts(seller), 600_000);
    }
}
