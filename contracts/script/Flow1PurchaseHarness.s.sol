// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console2.sol";

import "@openzeppelin/contracts/account/utils/EIP7702Utils.sol";

import "../interfaces/IHandler.sol";
import "../src/Handler.sol";
import "../src/TicketLedger.sol";
import "../src/TicketPaymaster.sol";

contract Flow1PurchaseHarness is Script {
    function run() external {
        uint256 adminPrivateKey = vm.envUint("FLOW1_ADMIN_PRIVATE_KEY");
        uint256 buyerPrivateKey = vm.envUint("FLOW1_BUYER_PRIVATE_KEY");
        uint256 eventId = vm.envUint("FLOW1_EVENT_ID");
        uint256 ticketTypeId = vm.envUint("FLOW1_TICKET_TYPE_ID");
        uint256 quantity = vm.envUint("FLOW1_QUANTITY");
        uint256 price = vm.envOr("FLOW1_PRICE", uint256(900000));

        address admin = vm.addr(adminPrivateKey);
        address payable buyer = payable(vm.addr(buyerPrivateKey));
        address expectedLedgerAddress = vm.envAddress("FLOW1_TICKET_LEDGER_ADDRESS");
        bytes32 paymentHash = vm.envBytes32("FLOW1_PAYMENT_HASH");
        bytes memory signature = vm.parseBytes(vm.envString("FLOW1_SIGNATURE"));

        vm.deal(admin, 50 ether);
        vm.deal(buyer, 0.01 ether);
        vm.txGasPrice(1 gwei);

        vm.startBroadcast(adminPrivateKey);
        TicketPaymaster paymaster = new TicketPaymaster(admin, 1 ether);
        Handler handler = new Handler(address(paymaster));
        TicketLedger ledger = new TicketLedger(admin);

        require(address(ledger) == expectedLedgerAddress, "Flow1PurchaseHarness: ledger address mismatch");

        paymaster.addHandler(address(handler));
        paymaster.addAllowedTarget(address(ledger));
        paymaster.deposit{value: 10 ether}();
        vm.stopBroadcast();

        vm.etch(address(buyer), abi.encodePacked(bytes3(0xef0100), bytes20(address(handler))));
        require(
            EIP7702Utils.fetchDelegate(address(buyer)) == address(handler), "Flow1PurchaseHarness: delegation failed"
        );

        IHandler.Call[] memory calls = new IHandler.Call[](1);
        calls[0] = IHandler.Call({
            target: address(ledger),
            value: 0,
            data: abi.encodeCall(
                TicketLedger.purchaseWithSignature, (eventId, ticketTypeId, quantity, price, paymentHash, signature)
            )
        });

        uint256 buyerBalanceBefore = buyer.balance;
        uint256 sponsoredBefore = paymaster.totalGasSponsored(buyer);

        vm.startBroadcast(buyerPrivateKey);
        bytes[] memory results = IHandler(buyer).executeBatch(calls);
        vm.stopBroadcast();

        uint256[] memory purchasedTicketIds = abi.decode(results[0], (uint256[]));
        require(purchasedTicketIds.length == quantity, "Flow1PurchaseHarness: ticket count mismatch");
        require(ledger.ticketCounter() == quantity, "Flow1PurchaseHarness: ledger counter mismatch");
        require(ledger.usedPaymentHashes(paymentHash), "Flow1PurchaseHarness: payment hash unused");
        require(paymaster.totalGasSponsored(buyer) > sponsoredBefore, "Flow1PurchaseHarness: sponsorship missing");
        require(buyer.balance > buyerBalanceBefore, "Flow1PurchaseHarness: buyer was not refilled");

        uint256[] memory ownedTicketIds = ledger.getTicketsByOwner(buyer);
        require(ownedTicketIds.length == quantity, "Flow1PurchaseHarness: owner ticket mismatch");

        for (uint256 i = 0; i < purchasedTicketIds.length; ++i) {
            (uint256 ticketId, uint256 storedEventId, uint256 storedTicketTypeId, address owner,, bool used,,) =
                ledger.tickets(purchasedTicketIds[i]);
            require(ticketId == purchasedTicketIds[i], "Flow1PurchaseHarness: ticket id mismatch");
            require(storedEventId == eventId, "Flow1PurchaseHarness: event id mismatch");
            require(storedTicketTypeId == ticketTypeId, "Flow1PurchaseHarness: ticket type mismatch");
            require(owner == buyer, "Flow1PurchaseHarness: owner mismatch");
            require(!used, "Flow1PurchaseHarness: ticket already used");
        }

        console2.log("FLOW1_HARNESS_OK");
        console2.logAddress(address(ledger));
        console2.logAddress(address(handler));
        console2.logAddress(address(paymaster));
    }
}
