// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";

import "../src/Handler.sol";
import "../src/MarketplaceV2.sol";
import "../src/TicketLedger.sol";
import "../src/TicketPaymaster.sol";

contract DeployPlatform is Script {
    struct DeploymentResult {
        address ticketLedger;
        address marketplaceV2;
        address ticketPaymaster;
        address handler;
    }

    function run() external returns (DeploymentResult memory result) {
        address admin = vm.envAddress("DEPLOY_ADMIN");
        uint256 paymasterMaxRefillPerTx = vm.envOr("PAYMASTER_MAX_REFILL_PER_TX", uint256(0.01 ether));
        uint256 paymasterInitialDeposit =
            vm.envOr("PAYMASTER_INITIAL_DEPOSIT", uint256(1 ether));

        vm.startBroadcast();

        TicketLedger ticketLedger = new TicketLedger(admin);
        MarketplaceV2 marketplaceV2 = new MarketplaceV2(address(ticketLedger), admin);
        TicketPaymaster paymaster = new TicketPaymaster(admin, paymasterMaxRefillPerTx);
        Handler handler = new Handler(address(paymaster));

        paymaster.addHandler(address(handler));
        paymaster.addAllowedTarget(address(ticketLedger));
        paymaster.addAllowedTarget(address(marketplaceV2));
        if (paymasterInitialDeposit != 0) {
            paymaster.deposit{value: paymasterInitialDeposit}();
        }

        vm.stopBroadcast();

        result = DeploymentResult({
            ticketLedger: address(ticketLedger),
            marketplaceV2: address(marketplaceV2),
            ticketPaymaster: address(paymaster),
            handler: address(handler)
        });

        string memory root = "deployment";
        vm.serializeUint(root, "chainId", block.chainid);
        vm.serializeAddress(root, "deployAdmin", admin);
        vm.serializeAddress(root, "ticketLedger", result.ticketLedger);
        vm.serializeAddress(root, "marketplaceV2", result.marketplaceV2);
        vm.serializeAddress(root, "ticketPaymaster", result.ticketPaymaster);
        vm.serializeAddress(root, "handler", result.handler);
        string memory json = vm.serializeUint(root, "paymasterInitialDeposit", paymasterInitialDeposit);

        string memory outputPath = vm.envOr(
            "DEPLOY_OUTPUT_PATH",
            string("deployments/base-sepolia-addresses.json")
        );
        vm.writeJson(json, outputPath);
    }
}
