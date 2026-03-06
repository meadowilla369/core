// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/extensions/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/account/utils/EIP7702Utils.sol";

import "../interfaces/ITicketPaymaster.sol";

/// @title TicketPaymaster
/// @notice Same-tx reimbursement treasury for EIP-7702 delegated EOAs.
contract TicketPaymaster is AccessControlEnumerable, ITicketPaymaster {
    mapping(address => bool) public override authorizedHandlers;
    mapping(address => bool) public override allowedTargets;
    mapping(address => uint256) public override totalGasSponsored;

    uint256 public override maxRefillPerTx;

    constructor(address admin, uint256 initialMaxRefillPerTx) {
        require(admin != address(0), "TicketPaymaster: admin required");
        require(initialMaxRefillPerTx != 0, "TicketPaymaster: max refill required");

        maxRefillPerTx = initialMaxRefillPerTx;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function refillGas(address payable user, uint256 gasCostWei) external override returns (uint256 refunded) {
        require(user != address(0), "TicketPaymaster: user required");
        require(user == payable(msg.sender), "TicketPaymaster: user mismatch");
        require(gasCostWei != 0, "TicketPaymaster: gas cost required");

        address delegatedImplementation = EIP7702Utils.fetchDelegate(msg.sender);
        require(authorizedHandlers[delegatedImplementation], "TicketPaymaster: unauthorized handler");

        refunded = gasCostWei;
        if (refunded > maxRefillPerTx) {
            refunded = maxRefillPerTx;
        }

        require(address(this).balance >= refunded, "TicketPaymaster: insufficient balance");

        totalGasSponsored[user] += refunded;

        (bool success,) = user.call{value: refunded}("");
        require(success, "TicketPaymaster: refund failed");

        emit GasRefilled(user, gasCostWei, refunded);
    }

    function addHandler(address handler) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        require(handler != address(0), "TicketPaymaster: handler required");
        require(!authorizedHandlers[handler], "TicketPaymaster: handler already added");
        authorizedHandlers[handler] = true;
        emit HandlerAuthorizationUpdated(handler, true);
    }

    function removeHandler(address handler) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        require(authorizedHandlers[handler], "TicketPaymaster: handler not added");
        authorizedHandlers[handler] = false;
        emit HandlerAuthorizationUpdated(handler, false);
    }

    function addAllowedTarget(address target) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        require(target != address(0), "TicketPaymaster: target required");
        require(!allowedTargets[target], "TicketPaymaster: target already added");
        allowedTargets[target] = true;
        emit AllowedTargetUpdated(target, true);
    }

    function removeAllowedTarget(address target) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        require(allowedTargets[target], "TicketPaymaster: target not added");
        allowedTargets[target] = false;
        emit AllowedTargetUpdated(target, false);
    }

    function setMaxRefillPerTx(uint256 newMaxRefillPerTx) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newMaxRefillPerTx != 0, "TicketPaymaster: max refill required");
        uint256 previous = maxRefillPerTx;
        maxRefillPerTx = newMaxRefillPerTx;
        emit MaxRefillPerTxUpdated(previous, newMaxRefillPerTx);
    }

    function isAllowedTarget(address target) external view override returns (bool) {
        return allowedTargets[target];
    }

    function deposit() external payable override onlyRole(DEFAULT_ADMIN_ROLE) {}

    function withdraw(address payable to, uint256 amount) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        require(to != address(0), "TicketPaymaster: recipient required");
        require(address(this).balance >= amount, "TicketPaymaster: insufficient balance");

        (bool success,) = to.call{value: amount}("");
        require(success, "TicketPaymaster: withdraw failed");
    }

    receive() external payable {}
}
