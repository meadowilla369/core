// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console2.sol";

import "@openzeppelin/contracts/account/utils/EIP7702Utils.sol";

import "../interfaces/IHandler.sol";
import "../src/Handler.sol";
import "../src/TicketLedger.sol";
import "../src/TicketPaymaster.sol";

/// @title Flow4CheckinHarness
/// @notice End-to-end Foundry script for Flow 4: purchase a ticket (Flow 1), then
///         asynchronously mark it as used via TicketLedger.markUsedBatch (CHECKIN_ROLE).
///
/// Environment variables required:
///   FLOW4_ADMIN_PRIVATE_KEY     - deployer / backend signer (holds CHECKIN_ROLE)
///   FLOW4_BUYER_PRIVATE_KEY     - ticket buyer
///   FLOW4_EVENT_ID              - event id for the purchase
///   FLOW4_TICKET_TYPE_ID        - ticket type id
///   FLOW4_PAYMENT_HASH          - EIP-712 payment hash from backend
///   FLOW4_SIGNATURE             - EIP-712 purchase signature from backend
///
/// Verified conditions on exit (prints FLOW4_HARNESS_OK on success):
///   - TicketLedger: ticket.owner == buyer
///   - TicketLedger: ticket.used == true
///   - TicketLedger: ticket.usedAt > 0
///   - TicketPaymaster: totalGasSponsored[buyer] increased after purchase
contract Flow4CheckinHarness is Script {
    function run() external {
        uint256 adminPrivateKey = vm.envUint("FLOW4_ADMIN_PRIVATE_KEY");
        uint256 buyerPrivateKey = vm.envUint("FLOW4_BUYER_PRIVATE_KEY");
        uint256 eventId = vm.envUint("FLOW4_EVENT_ID");
        uint256 ticketTypeId = vm.envUint("FLOW4_TICKET_TYPE_ID");
        bytes32 paymentHash = vm.envBytes32("FLOW4_PAYMENT_HASH");
        bytes memory signature = vm.parseBytes(vm.envString("FLOW4_SIGNATURE"));
        uint256 price = vm.envOr("FLOW4_PRICE", uint256(900000));

        address admin = vm.addr(adminPrivateKey);
        address payable buyer = payable(vm.addr(buyerPrivateKey));

        vm.deal(admin, 50 ether);
        vm.deal(buyer, 0.01 ether);
        vm.txGasPrice(1 gwei);

        // ── Deploy contracts ─────────────────────────────────────────────────────
        vm.startBroadcast(adminPrivateKey);
        TicketPaymaster paymaster = new TicketPaymaster(admin, 1 ether);
        Handler handler = new Handler(address(paymaster));
        TicketLedger ledger = new TicketLedger(admin);

        paymaster.addHandler(address(handler));
        paymaster.addAllowedTarget(address(ledger));
        paymaster.deposit{value: 10 ether}();
        vm.stopBroadcast();

        // ── EIP-7702 delegate buyer EOA to handler ────────────────────────────────
        vm.etch(address(buyer), abi.encodePacked(bytes3(0xef0100), bytes20(address(handler))));
        require(
            EIP7702Utils.fetchDelegate(address(buyer)) == address(handler),
            "Flow4CheckinHarness: buyer delegation failed"
        );

        // ── Flow 1: Buyer purchases ticket via TicketLedger.purchaseWithSignature ─
        IHandler.Call[] memory purchaseCalls = new IHandler.Call[](1);
        purchaseCalls[0] = IHandler.Call({
            target: address(ledger),
            value: 0,
            data: abi.encodeCall(
                TicketLedger.purchaseWithSignature, (eventId, ticketTypeId, 1, price, paymentHash, signature)
            )
        });

        uint256 sponsoredBefore = paymaster.totalGasSponsored(buyer);

        vm.startBroadcast(buyerPrivateKey);
        bytes[] memory purchaseResults = IHandler(buyer).executeBatch(purchaseCalls);
        vm.stopBroadcast();

        uint256[] memory purchasedTicketIds = abi.decode(purchaseResults[0], (uint256[]));
        require(purchasedTicketIds.length == 1, "Flow4CheckinHarness: ticket count mismatch");
        uint256 ticketId = purchasedTicketIds[0];

        (, , , address ownerAfterPurchase, , bool usedAfterPurchase,,) = ledger.tickets(ticketId);
        require(ownerAfterPurchase == buyer, "Flow4CheckinHarness: buyer should own ticket after purchase");
        require(!usedAfterPurchase, "Flow4CheckinHarness: ticket should not be used yet");
        require(paymaster.totalGasSponsored(buyer) > sponsoredBefore, "Flow4CheckinHarness: buyer gas not sponsored");

        console2.log("Flow4: ticket purchased, id =", ticketId);

        // ── Flow 4: Admin (CHECKIN_ROLE) marks ticket as used via markUsedBatch ──
        uint256[] memory batchIds = new uint256[](1);
        batchIds[0] = ticketId;

        vm.startBroadcast(adminPrivateKey);
        ledger.markUsedBatch(batchIds);
        vm.stopBroadcast();

        // ── Verify final state ───────────────────────────────────────────────────
        (, , , address ownerAfterCheckin, , bool usedAfterCheckin,, uint256 usedAt) = ledger.tickets(ticketId);
        require(ownerAfterCheckin == buyer, "Flow4CheckinHarness: buyer should still own ticket after check-in");
        require(usedAfterCheckin, "Flow4CheckinHarness: ticket should be marked used");
        require(usedAt > 0, "Flow4CheckinHarness: usedAt should be set");

        uint256[] memory ownedIds = ledger.getTicketsByOwner(buyer);
        require(ownedIds.length == 1, "Flow4CheckinHarness: buyer should still hold ticket in owner index");

        console2.log("Flow4: ticket marked used, usedAt =", usedAt);
        console2.log("FLOW4_HARNESS_OK");
        console2.logAddress(address(ledger));
        console2.logAddress(address(handler));
        console2.logAddress(address(paymaster));
    }
}
