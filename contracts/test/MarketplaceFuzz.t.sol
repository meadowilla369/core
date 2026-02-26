// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import "../src/Marketplace.sol";
import "../src/TicketNFT.sol";

contract MarketplaceFuzzTest is Test {
    TicketNFT internal ticket;
    Marketplace internal marketplace;

    address internal admin = address(0xA11CE);
    address internal minter = address(0xBEEF);
    address internal escrow = address(0xE5C0);
    address internal seller = address(0xCAFE);
    address internal buyer = address(0xB0B);

    uint256 internal constant EVENT_ID = 1;
    uint256 internal constant TICKET_TYPE_ID = 1;
    uint64 internal constant ORIGINAL_PRICE = 100_000;

    struct EscrowPayloadV1 {
        uint8 version;
        bytes16 settlementId;
        bytes16 listingId;
        bytes16 paymentId;
        uint256 tokenId;
        address sellerAddr;
        address buyerAddr;
        uint128 grossAmount;
        uint128 sellerAmount;
        uint128 platformFee;
        uint128 organizerRoyalty;
        bytes3 currency;
        uint8 gateway;
        bytes32 gatewayReferenceHash;
        uint64 settledAt;
        bytes32 nonce;
    }

    function setUp() public {
        vm.prank(admin);
        ticket = new TicketNFT("Ticket", "TIX", admin);

        vm.startPrank(admin);
        ticket.setMinter(minter);
        ticket.configureEvent(EVENT_ID, 1000);
        ticket.configureTicketType(TICKET_TYPE_ID, ORIGINAL_PRICE);
        marketplace = new Marketplace(address(ticket), admin, address(0));
        marketplace.grantRole(marketplace.ESCROW_ROLE(), escrow);
        vm.stopPrank();
    }

    function testFuzz_ListingPriceCap(uint16 markupBps) public {
        uint256 tokenId = _mintTicketTo(seller);

        vm.prank(seller);
        ticket.setApprovalForAll(address(marketplace), true);

        markupBps = uint16(bound(markupBps, 10_000, 13_000));
        uint256 attemptedPrice = (uint256(ORIGINAL_PRICE) * uint256(markupBps)) / 10_000;

        if (markupBps > marketplace.maxMarkupBps()) {
            vm.prank(seller);
            vm.expectRevert("Marketplace: price too high");
            marketplace.listForSale(tokenId, attemptedPrice, uint64(block.timestamp + 1 days));
        } else {
            vm.prank(seller);
            marketplace.listForSale(tokenId, attemptedPrice, uint64(block.timestamp + 1 days));
            IMarketplace.Listing memory listed = marketplace.listing(tokenId);
            assertTrue(listed.active);
            assertEq(listed.price, attemptedPrice);
        }
    }

    function testFuzz_ReplayProtection(bytes32 nonce) public {
        nonce = nonce == bytes32(0) ? bytes32("non-zero") : nonce;

        uint256 tokenId = _mintTicketTo(seller);

        vm.prank(seller);
        ticket.setApprovalForAll(address(marketplace), true);

        vm.prank(seller);
        marketplace.listForSale(tokenId, ORIGINAL_PRICE, uint64(block.timestamp + 1 days));

        bytes memory escrowData = _escrowData(tokenId, seller, buyer, ORIGINAL_PRICE, nonce);

        vm.prank(escrow);
        marketplace.completeSale(tokenId, buyer, escrowData);

        assertEq(ticket.ownerOf(tokenId), buyer);

        uint256 tokenId2 = _mintTicketTo(seller);
        vm.prank(seller);
        marketplace.listForSale(tokenId2, ORIGINAL_PRICE, uint64(block.timestamp + 1 days));

        vm.prank(escrow);
        vm.expectRevert("Marketplace: escrow replay");
        marketplace.completeSale(tokenId2, buyer, escrowData);
    }

    function testFuzz_CompleteSaleVsCancelListingRace(bool escrowExecutesFirst) public {
        uint256 tokenId = _mintTicketTo(seller);

        vm.prank(seller);
        ticket.setApprovalForAll(address(marketplace), true);

        vm.prank(seller);
        marketplace.listForSale(tokenId, ORIGINAL_PRICE, uint64(block.timestamp + 1 days));

        bytes memory escrowData = _escrowData(tokenId, seller, buyer, ORIGINAL_PRICE, bytes32("race-case"));

        if (escrowExecutesFirst) {
            vm.prank(escrow);
            marketplace.completeSale(tokenId, buyer, escrowData);
            assertEq(ticket.ownerOf(tokenId), buyer);

            vm.prank(seller);
            vm.expectRevert("Marketplace: listing inactive");
            marketplace.cancelListing(tokenId);
        } else {
            vm.prank(seller);
            marketplace.cancelListing(tokenId);
            assertEq(ticket.ownerOf(tokenId), seller);

            vm.prank(escrow);
            vm.expectRevert("Marketplace: listing inactive");
            marketplace.completeSale(tokenId, buyer, escrowData);
        }
    }

    function _mintTicketTo(address to) internal returns (uint256 tokenId) {
        vm.prank(minter);
        ticket.mint(to, EVENT_ID, TICKET_TYPE_ID, bytes("A1"));
        return ticket.totalSupply();
    }

    function _escrowData(uint256 tokenId, address sellerAddr, address buyerAddr, uint256 grossAmount, bytes32 nonce)
        internal
        view
        returns (bytes memory)
    {
        uint128 sellerAmount = uint128((grossAmount * 90) / 100);
        uint128 platformFee = uint128((grossAmount * 5) / 100);
        uint128 organizerRoyalty = uint128(grossAmount - uint256(sellerAmount) - uint256(platformFee));

        EscrowPayloadV1 memory payload = EscrowPayloadV1({
            version: 1,
            settlementId: bytes16(uint128(tokenId + 1)),
            listingId: bytes16(uint128(tokenId + 2)),
            paymentId: bytes16(uint128(tokenId + 3)),
            tokenId: tokenId,
            sellerAddr: sellerAddr,
            buyerAddr: buyerAddr,
            grossAmount: uint128(grossAmount),
            sellerAmount: sellerAmount,
            platformFee: platformFee,
            organizerRoyalty: organizerRoyalty,
            currency: bytes3("VND"),
            gateway: 1,
            gatewayReferenceHash: keccak256("gateway-ref"),
            settledAt: uint64(block.timestamp),
            nonce: nonce
        });

        return abi.encode(
            payload.version,
            payload.settlementId,
            payload.listingId,
            payload.paymentId,
            payload.tokenId,
            payload.sellerAddr,
            payload.buyerAddr,
            payload.grossAmount,
            payload.sellerAmount,
            payload.platformFee,
            payload.organizerRoyalty,
            payload.currency,
            payload.gateway,
            payload.gatewayReferenceHash,
            payload.settledAt,
            payload.nonce
        );
    }
}
