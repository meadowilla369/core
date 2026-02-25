// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import "../src/Marketplace.sol";
import "../src/TicketNFT.sol";

contract MarketplaceTest is Test {
    TicketNFT internal ticket;
    Marketplace internal marketplace;

    address internal admin = address(0xA11CE);
    address internal minter = address(0xBEEF);
    address internal escrow = address(0xE5C0);
    address internal seller = address(0xCAFE);
    address internal secondSeller = address(0xD00D);
    address internal buyer = address(0xB0B);

    uint256 internal constant EVENT_ID = 1;
    uint256 internal constant TICKET_TYPE_ID = 1;
    uint64 internal constant ORIGINAL_PRICE = 100_000;

    function setUp() public {
        vm.prank(admin);
        ticket = new TicketNFT("Ticket", "TIX", admin);

        vm.startPrank(admin);
        ticket.setMinter(minter);
        ticket.configureEvent(EVENT_ID, 100);
        ticket.configureTicketType(TICKET_TYPE_ID, ORIGINAL_PRICE);
        marketplace = new Marketplace(address(ticket), admin, address(0));
        marketplace.grantRole(marketplace.ESCROW_ROLE(), escrow);
        vm.stopPrank();
    }

    function testLifecycleListCancelRelistCompleteSale() public {
        uint256 tokenId = _mintTicketTo(seller, "A1");
        _approveMarketplace(seller);

        uint256 price = _maxAllowedPrice(tokenId);
        uint64 expiry = uint64(block.timestamp + 1 days);

        vm.prank(seller);
        marketplace.listForSale(tokenId, price, expiry);

        IMarketplace.Listing memory listed = marketplace.listing(tokenId);
        assertEq(ticket.ownerOf(tokenId), address(marketplace));
        assertEq(listed.seller, seller);
        assertEq(listed.price, price);
        assertTrue(listed.active);
        assertEq(listed.expiresAt, expiry);

        vm.prank(seller);
        marketplace.cancelListing(tokenId);

        IMarketplace.Listing memory cancelled = marketplace.listing(tokenId);
        assertEq(ticket.ownerOf(tokenId), seller);
        assertEq(cancelled.seller, address(0));
        assertFalse(cancelled.active);

        vm.prank(seller);
        marketplace.listForSale(tokenId, price, expiry);
        assertEq(ticket.ownerOf(tokenId), address(marketplace));

        vm.prank(escrow);
        marketplace.completeSale(tokenId, buyer, bytes("payment-001"));

        IMarketplace.Listing memory sold = marketplace.listing(tokenId);
        assertEq(ticket.ownerOf(tokenId), buyer);
        assertEq(sold.seller, address(0));
        assertFalse(sold.active);
    }

    function testListForSaleRevertsWhenPriceExceedsCap() public {
        uint256 tokenId = _mintTicketTo(seller, "A2");
        _approveMarketplace(seller);

        uint256 maxPrice = _maxAllowedPrice(tokenId);
        uint256 invalidPrice = maxPrice + 1;

        vm.prank(seller);
        vm.expectRevert("Marketplace: price too high");
        marketplace.listForSale(tokenId, invalidPrice, uint64(block.timestamp + 1 days));
    }

    function testMaxMarkupCanBeTightenedWithinRange() public {
        uint256 tokenId = _mintTicketTo(seller, "A3");
        _approveMarketplace(seller);

        vm.prank(admin);
        marketplace.setMaxMarkupBps(11000);

        uint256 maxPriceAt110 = _maxAllowedPrice(tokenId);

        vm.prank(seller);
        marketplace.listForSale(tokenId, maxPriceAt110, uint64(block.timestamp + 1 days));
        assertEq(ticket.ownerOf(tokenId), address(marketplace));
    }

    function testCompleteSaleRejectsEscrowReplay() public {
        uint256 tokenOne = _mintTicketTo(seller, "B1");
        uint256 tokenTwo = _mintTicketTo(secondSeller, "B2");
        _approveMarketplace(seller);
        _approveMarketplace(secondSeller);

        uint64 expiry = uint64(block.timestamp + 1 days);
        uint256 tokenOnePrice = _maxAllowedPrice(tokenOne);
        uint256 tokenTwoPrice = _maxAllowedPrice(tokenTwo);

        vm.prank(seller);
        marketplace.listForSale(tokenOne, tokenOnePrice, expiry);

        bytes memory escrowData = bytes("shared-payment-id");

        vm.prank(escrow);
        marketplace.completeSale(tokenOne, buyer, escrowData);
        assertEq(ticket.ownerOf(tokenOne), buyer);

        vm.prank(secondSeller);
        marketplace.listForSale(tokenTwo, tokenTwoPrice, expiry);

        vm.prank(escrow);
        vm.expectRevert("Marketplace: escrow replay");
        marketplace.completeSale(tokenTwo, buyer, escrowData);
    }

    function _mintTicketTo(address to, bytes memory seatInfo) internal returns (uint256 tokenId) {
        vm.prank(minter);
        ticket.mint(to, EVENT_ID, TICKET_TYPE_ID, seatInfo);
        return ticket.totalSupply();
    }

    function _approveMarketplace(address owner) internal {
        vm.prank(owner);
        ticket.setApprovalForAll(address(marketplace), true);
    }

    function _maxAllowedPrice(uint256 tokenId) internal view returns (uint256) {
        ITicketNFT.TicketInfo memory info = ticket.ticketData(tokenId);
        return (uint256(info.originalPrice) * uint256(marketplace.maxMarkupBps())) / 10_000;
    }
}
