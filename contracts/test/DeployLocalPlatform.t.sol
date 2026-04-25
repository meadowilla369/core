// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import "../script/DeployLocalPlatform.s.sol";

contract DeployLocalPlatformTest is Test {
    function testDefaultPaymasterInitialDepositFundsOneHundredMaxRefills() public {
        address admin = 0x1804c8AB1F12E6bbf3894d4083f33e07309d1f38;
        vm.deal(admin, 100 ether);
        vm.setEnv("DEPLOY_ADMIN", vm.toString(admin));
        vm.setEnv("DEPLOY_OUTPUT_PATH", "deployments/test-localchain-addresses.json");

        DeployLocalPlatform.DeploymentResult memory deployment = new DeployLocalPlatform().run();

        assertEq(deployment.ticketPaymaster.balance, 1 ether);
        vm.removeFile("deployments/test-localchain-addresses.json");
    }
}
