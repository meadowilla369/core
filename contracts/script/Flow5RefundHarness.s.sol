// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console2.sol";

import "@openzeppelin/contracts/account/utils/EIP7702Utils.sol";

import "../interfaces/IHandler.sol";
import "../src/Handler.sol";
import "../src/TicketLedger.sol";
import "../src/TicketPaymaster.sol";

/// @title Flow5RefundHarness
/// @notice End-to-end Foundry script for Flow 5: purchase a ticket (Flow 1), then
///         cancel it for refund via TicketLedger.cancelTicket (REFUND_ROLE).
///
/// Environment variables required:
///   FLOW5_ADMIN_PRIVATE_KEY     - deployer / backend signer (holds REFUND_ROLE)
///   FLOW5_BUYER_PRIVATE_KEY     - ticket buyer
///   FLOW5_EVENT_ID              - event id for the purchase
///   FLOW5_TICKET_TYPE_ID        - ticket type id
///   FLOW5_PAYMENT_HASH          - EIP-712 payment hash from backend
///   FLOW5_SIGNATURE             - EIP-712 purchase signature from backend
///
/// Verified conditions on exit (prints FLOW5_HARNESS_OK on success):
///   - TicketLedger: ticket.owner == address(0)  (cancelled)
///   - TicketLedger: ticket.used == false         (was not used before cancel)
///   - TicketLedger: getTicketsByOwner(buyer) == [] (removed from reverse index)
///   - TicketPaymaster: totalGasSponsored[buyer] increased after purchase
contract Flow5RefundHarness is Script {
    function run() external {
        uint256 adminPrivateKey = vm.envUint("FLOW5_ADMIN_PRIVATE_KEY");
        uint256 buyerPrivateKey = vm.envUint("FLOW5_BUYER_PRIVATE_KEY");
        uint256 eventId = vm.envUint("FLOW5_EVENT_ID");
        uint256 ticketTypeId = vm.envUint("FLOW5_TICKET_TYPE_ID");
        bytes32 paymentHash = vm.envBytes32("FLOW5_PAYMENT_HASH");
        bytes memory signature = vm.parseBytes(vm.envString("FLOW5_SIGNATURE"));
        uint256 price = vm.envOr("FLOW5_PRICE", uint256(900000));

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
            "Flow5RefundHarness: buyer delegation failed"
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
        require(purchasedTicketIds.length == 1, "Flow5RefundHarness: ticket count mismatch");
        uint256 ticketId = purchasedTicketIds[0];

        (, , , address ownerAfterPurchase, , bool usedAfterPurchase,,) = ledger.tickets(ticketId);
        require(ownerAfterPurchase == buyer, "Flow5RefundHarness: buyer should own ticket after purchase");
        require(!usedAfterPurchase, "Flow5RefundHarness: ticket should not be used before refund");
        require(paymaster.totalGasSponsored(buyer) > sponsoredBefore, "Flow5RefundHarness: buyer gas not sponsored");

        uint256[] memory ownedBefore = ledger.getTicketsByOwner(buyer);
        require(ownedBefore.length == 1, "Flow5RefundHarness: buyer should have 1 ticket before cancel");

        console2.log("Flow5: ticket purchased, id =", ticketId);

        // ── Flow 5: Admin (REFUND_ROLE) cancels ticket via cancelTicket ───────────
        vm.startBroadcast(adminPrivateKey);
        ledger.cancelTicket(ticketId);
        vm.stopBroadcast();

        // ── Verify final state ───────────────────────────────────────────────────
        (, , , address ownerAfterCancel, , bool usedAfterCancel,,) = ledger.tickets(ticketId);
        require(ownerAfterCancel == address(0), "Flow5RefundHarness: ticket owner should be zero after cancel");
        require(!usedAfterCancel, "Flow5RefundHarness: ticket should not be marked used on cancel");

        uint256[] memory ownedAfter = ledger.getTicketsByOwner(buyer);
        require(ownedAfter.length == 0, "Flow5RefundHarness: buyer owner index should be empty after cancel");

        console2.log("Flow5: ticket cancelled, id =", ticketId);
        console2.log("FLOW5_HARNESS_OK");
        console2.logAddress(address(ledger));
        console2.logAddress(address(handler));
        console2.logAddress(address(paymaster));
    }
}
