// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";

import "../src/TicketLedger.sol";

contract SmokeSyncEvent is Script {
    bytes32 private constant EIP712_DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 private constant NAME_HASH = keccak256(bytes("TicketLedger"));
    bytes32 private constant VERSION_HASH = keccak256(bytes("1"));
    bytes32 private constant PURCHASE_TYPEHASH =
        keccak256("Purchase(uint256 eventId,uint256 ticketTypeId,uint256 quantity,bytes32 paymentHash,address buyer)");

    function run() external {
        uint256 adminPrivateKey = vm.envUint("LOCALCHAIN_SMOKE_ADMIN_PRIVATE_KEY");
        uint256 buyerPrivateKey = vm.envUint("LOCALCHAIN_SMOKE_BUYER_PRIVATE_KEY");
        uint256 eventId = vm.envOr("LOCALCHAIN_SMOKE_EVENT_ID", uint256(900001));
        uint256 ticketTypeId = vm.envOr("LOCALCHAIN_SMOKE_TICKET_TYPE_ID", uint256(1));
        uint256 quantity = vm.envOr("LOCALCHAIN_SMOKE_QUANTITY", uint256(1));
        uint256 price = vm.envOr("LOCALCHAIN_SMOKE_PRICE", uint256(900000));
        address ledgerAddress = vm.envAddress("TICKET_LEDGER_ADDRESS");
        string memory outputPath = vm.envOr(
            "LOCALCHAIN_SMOKE_OUTPUT_PATH",
            string("deployments/localchain-smoke.json")
        );

        TicketLedger ledger = TicketLedger(ledgerAddress);
        address payable buyer = payable(vm.addr(buyerPrivateKey));
        uint256 nextTicketId = ledger.ticketCounter() + 1;

        bytes32 paymentHash = keccak256(
            abi.encodePacked("localchain-smoke", block.chainid, ledgerAddress, buyer, nextTicketId)
        );

        bytes32 domainSeparator = keccak256(
            abi.encode(EIP712_DOMAIN_TYPEHASH, NAME_HASH, VERSION_HASH, block.chainid, ledgerAddress)
        );
        bytes32 structHash =
            keccak256(abi.encode(PURCHASE_TYPEHASH, eventId, ticketTypeId, quantity, paymentHash, buyer));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(adminPrivateKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.startBroadcast(adminPrivateKey);
        if (buyer.balance < 0.01 ether) {
            (bool funded,) = buyer.call{value: 0.05 ether}("");
            require(funded, "SmokeSyncEvent: buyer prefund failed");
        }
        vm.stopBroadcast();

        vm.startBroadcast(buyerPrivateKey);
        uint256[] memory tokenIds =
            ledger.purchaseWithSignature(eventId, ticketTypeId, quantity, price, paymentHash, signature);
        vm.stopBroadcast();

        string memory root = "smoke";
        vm.serializeUint(root, "chainId", block.chainid);
        vm.serializeAddress(root, "ledger", ledgerAddress);
        vm.serializeAddress(root, "buyer", buyer);
        vm.serializeUint(root, "eventId", eventId);
        vm.serializeUint(root, "ticketTypeId", ticketTypeId);
        vm.serializeBytes32(root, "paymentHash", paymentHash);
        string memory json = vm.serializeUint(root, "tokenId", tokenIds[0]);

        vm.writeJson(json, outputPath);
    }
}
