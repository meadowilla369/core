// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";

import "../src/TicketNFT.sol";
import "../src/Marketplace.sol";
import "../src/TicketPaymaster.sol";
import "../src/GuardianAccount.sol";

contract DeployPlatform is Script {
    struct DeploymentResult {
        address ticketNFT;
        address marketplace;
        address ticketPaymaster;
        address guardianAccount;
    }

    function run() external returns (DeploymentResult memory result) {
        address admin = vm.envAddress("DEPLOY_ADMIN");
        address entryPoint = vm.envAddress("ENTRYPOINT_ADDRESS");
        address sessionSigner = vm.envAddress("SESSION_SIGNER");
        address guardian = vm.envAddress("GUARDIAN_ADDRESS");
        address guardianOwner = vm.envAddress("GUARDIAN_OWNER");
        address escrowHook = vm.envOr("ESCROW_HOOK", address(0));
        uint256 recoveryDelay = vm.envOr("GUARDIAN_RECOVERY_DELAY", uint256(1 days));

        vm.startBroadcast();

        TicketNFT ticket = new TicketNFT("Ticket Platform", "TPASS", admin);
        Marketplace market = new Marketplace(address(ticket), admin, escrowHook);
        TicketPaymaster paymaster = new TicketPaymaster(admin, entryPoint, sessionSigner);
        GuardianAccount guardianAccount = new GuardianAccount(guardianOwner, guardian, recoveryDelay);

        ticket.setMinter(admin);
        ticket.setOperator(admin, true);
        ticket.setEventManager(admin, true);

        market.grantRole(market.ESCROW_ROLE(), admin);

        vm.stopBroadcast();

        result = DeploymentResult({
            ticketNFT: address(ticket),
            marketplace: address(market),
            ticketPaymaster: address(paymaster),
            guardianAccount: address(guardianAccount)
        });
    }
}
