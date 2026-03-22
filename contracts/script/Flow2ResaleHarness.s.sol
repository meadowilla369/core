// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console2.sol";

import "@openzeppelin/contracts/account/utils/EIP7702Utils.sol";

import "../interfaces/IHandler.sol";
import "../src/Handler.sol";
import "../src/TicketLedger.sol";
import "../src/TicketPaymaster.sol";
import "../src/MarketplaceV2.sol";

/// @title Flow2ResaleHarness
/// @notice End-to-end Foundry script for Flow 2: initial purchase (Flow 1) then resale.
///
/// Environment variables required:
///   FLOW2_ADMIN_PRIVATE_KEY        - deployer / backend signer
///   FLOW2_SELLER_PRIVATE_KEY       - first buyer (becomes resale seller)
///   FLOW2_BUYER_PRIVATE_KEY        - resale buyer
///   FLOW2_EVENT_ID                 - event id for initial purchase
///   FLOW2_TICKET_TYPE_ID           - ticket type id
///   FLOW2_PURCHASE_PAYMENT_HASH    - payment hash for initial purchase
///   FLOW2_PURCHASE_SIGNATURE       - EIP-712 purchase signature from backend
///   FLOW2_RESALE_PRICE             - ask price for the resale listing
///   FLOW2_BUY_PAYMENT_HASH         - payment hash for resale buy
///   FLOW2_BUY_SIGNATURE            - EIP-712 buy signature from backend (MarketplaceV2 domain)
///
/// Verified conditions on exit (prints FLOW2_HARNESS_OK on success):
///   - TicketLedger: ticket owner == resale buyer
///   - MarketplaceV2: listing inactive
///   - MarketplaceV2: pendingPayouts[seller] == resalePrice
///   - MarketplaceV2: usedPaymentHashes[buyPaymentHash] == true
///   - TicketPaymaster: totalGasSponsored[seller] and [buyer] both increased
contract Flow2ResaleHarness is Script {
    function run() external {
        uint256 adminPrivateKey = vm.envUint("FLOW2_ADMIN_PRIVATE_KEY");
        uint256 sellerPrivateKey = vm.envUint("FLOW2_SELLER_PRIVATE_KEY");
        uint256 buyerPrivateKey = vm.envUint("FLOW2_BUYER_PRIVATE_KEY");
        uint256 eventId = vm.envUint("FLOW2_EVENT_ID");
        uint256 ticketTypeId = vm.envUint("FLOW2_TICKET_TYPE_ID");
        bytes32 purchasePaymentHash = vm.envBytes32("FLOW2_PURCHASE_PAYMENT_HASH");
        bytes memory purchaseSignature = vm.parseBytes(vm.envString("FLOW2_PURCHASE_SIGNATURE"));
        uint256 resalePrice = vm.envUint("FLOW2_RESALE_PRICE");
        bytes32 buyPaymentHash = vm.envBytes32("FLOW2_BUY_PAYMENT_HASH");
        bytes memory buySignature = vm.parseBytes(vm.envString("FLOW2_BUY_SIGNATURE"));

        address admin = vm.addr(adminPrivateKey);
        address payable seller = payable(vm.addr(sellerPrivateKey));
        address payable buyer = payable(vm.addr(buyerPrivateKey));

        vm.deal(admin, 50 ether);
        vm.deal(seller, 0.01 ether);
        vm.deal(buyer, 0.01 ether);
        vm.txGasPrice(1 gwei);

        // ── Deploy contracts ─────────────────────────────────────────────────────
        vm.startBroadcast(adminPrivateKey);
        TicketPaymaster paymaster = new TicketPaymaster(admin, 1 ether);
        Handler handler = new Handler(address(paymaster));
        TicketLedger ledger = new TicketLedger(admin);
        MarketplaceV2 marketplace = new MarketplaceV2(address(ledger), admin);

        paymaster.addHandler(address(handler));
        paymaster.addAllowedTarget(address(ledger));
        paymaster.addAllowedTarget(address(marketplace));
        paymaster.deposit{value: 10 ether}();

        // Grant marketplace CHECKIN_ROLE is not needed; transferTicket is open.
        // The marketplace needs PAYMENT_HASH_ROLE on itself (admin already has it; no-op needed).
        vm.stopBroadcast();

        // ── EIP-7702 delegate seller EOA to handler ──────────────────────────────
        vm.etch(address(seller), abi.encodePacked(bytes3(0xef0100), bytes20(address(handler))));
        require(
            EIP7702Utils.fetchDelegate(address(seller)) == address(handler),
            "Flow2ResaleHarness: seller delegation failed"
        );

        // ── Flow 1: Seller purchases ticket via TicketLedger.purchaseWithSignature ──
        IHandler.Call[] memory purchaseCalls = new IHandler.Call[](1);
        purchaseCalls[0] = IHandler.Call({
            target: address(ledger),
            value: 0,
            data: abi.encodeCall(
                TicketLedger.purchaseWithSignature, (eventId, ticketTypeId, 1, purchasePaymentHash, purchaseSignature)
            )
        });

        uint256 sellerSponsoredBefore = paymaster.totalGasSponsored(seller);

        vm.startBroadcast(sellerPrivateKey);
        bytes[] memory purchaseResults = IHandler(seller).executeBatch(purchaseCalls);
        vm.stopBroadcast();

        uint256[] memory purchasedTicketIds = abi.decode(purchaseResults[0], (uint256[]));
        require(purchasedTicketIds.length == 1, "Flow2ResaleHarness: ticket count mismatch");
        uint256 ticketId = purchasedTicketIds[0];

        (, , , address ownerAfterPurchase, , , ,) = ledger.tickets(ticketId);
        require(ownerAfterPurchase == seller, "Flow2ResaleHarness: seller should own ticket after purchase");
        require(paymaster.totalGasSponsored(seller) > sellerSponsoredBefore, "Flow2ResaleHarness: seller gas not sponsored for purchase");

        console2.log("Flow2: ticket purchased, id =", ticketId);

        // ── Flow 2a: Seller lists (transfer to marketplace + listTicket in batch) ──
        IHandler.Call[] memory listCalls = new IHandler.Call[](2);
        listCalls[0] = IHandler.Call({
            target: address(ledger),
            value: 0,
            data: abi.encodeCall(TicketLedger.transferTicket, (ticketId, address(marketplace)))
        });
        listCalls[1] = IHandler.Call({
            target: address(marketplace),
            value: 0,
            data: abi.encodeCall(MarketplaceV2.listTicket, (ticketId, resalePrice))
        });

        sellerSponsoredBefore = paymaster.totalGasSponsored(seller);

        vm.startBroadcast(sellerPrivateKey);
        bytes[] memory listResults = IHandler(seller).executeBatch(listCalls);
        vm.stopBroadcast();

        uint256 listingId = abi.decode(listResults[1], (uint256));
        require(listingId == 1, "Flow2ResaleHarness: unexpected listingId");

        IMarketplaceV2.Listing memory listing = marketplace.getListing(listingId);
        require(listing.active, "Flow2ResaleHarness: listing should be active");
        require(listing.ticketId == ticketId, "Flow2ResaleHarness: listing ticket mismatch");
        require(listing.seller == seller, "Flow2ResaleHarness: listing seller mismatch");
        require(listing.price == resalePrice, "Flow2ResaleHarness: listing price mismatch");
        require(paymaster.totalGasSponsored(seller) > sellerSponsoredBefore, "Flow2ResaleHarness: seller gas not sponsored for listing");

        (, , , address ownerDuringListing, , , ,) = ledger.tickets(ticketId);
        require(ownerDuringListing == address(marketplace), "Flow2ResaleHarness: marketplace should hold ticket during listing");

        console2.log("Flow2: ticket listed, listingId =", listingId);

        // ── Flow 2b: Buyer purchases via EIP-7702 + buyWithSignature ─────────────
        vm.etch(address(buyer), abi.encodePacked(bytes3(0xef0100), bytes20(address(handler))));
        require(
            EIP7702Utils.fetchDelegate(address(buyer)) == address(handler),
            "Flow2ResaleHarness: buyer delegation failed"
        );

        IHandler.Call[] memory buyCalls = new IHandler.Call[](1);
        buyCalls[0] = IHandler.Call({
            target: address(marketplace),
            value: 0,
            data: abi.encodeCall(MarketplaceV2.buyWithSignature, (listingId, buyPaymentHash, buySignature))
        });

        uint256 buyerSponsoredBefore = paymaster.totalGasSponsored(buyer);

        vm.startBroadcast(buyerPrivateKey);
        IHandler(buyer).executeBatch(buyCalls);
        vm.stopBroadcast();

        // ── Verify final state ───────────────────────────────────────────────────
        (, , , address ownerAfterBuy, , , ,) = ledger.tickets(ticketId);
        require(ownerAfterBuy == buyer, "Flow2ResaleHarness: buyer should own ticket after purchase");

        IMarketplaceV2.Listing memory finalListing = marketplace.getListing(listingId);
        require(!finalListing.active, "Flow2ResaleHarness: listing should be inactive after sale");

        require(
            marketplace.pendingPayouts(seller) == resalePrice,
            "Flow2ResaleHarness: seller payout not recorded correctly"
        );

        require(marketplace.usedPaymentHashes(buyPaymentHash), "Flow2ResaleHarness: buy payment hash not consumed");

        require(
            paymaster.totalGasSponsored(buyer) > buyerSponsoredBefore,
            "Flow2ResaleHarness: buyer gas not sponsored for buy"
        );

        console2.log("FLOW2_HARNESS_OK");
        console2.logAddress(address(ledger));
        console2.logAddress(address(marketplace));
        console2.logAddress(address(handler));
        console2.logAddress(address(paymaster));
    }
}
