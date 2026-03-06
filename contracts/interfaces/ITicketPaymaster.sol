// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ITicketPaymaster
/// @notice Same-tx gas reimbursement treasury used by delegated EOAs executing through `Handler.sol`.
interface ITicketPaymaster {
    event GasRefilled(address indexed user, uint256 gasCostWei, uint256 refunded);
    event HandlerAuthorizationUpdated(address indexed handler, bool allowed);
    event AllowedTargetUpdated(address indexed target, bool allowed);
    event MaxRefillPerTxUpdated(uint256 previousMaxRefillPerTx, uint256 newMaxRefillPerTx);

    function maxRefillPerTx() external view returns (uint256);

    function totalGasSponsored(address user) external view returns (uint256);

    function authorizedHandlers(address handler) external view returns (bool);

    function allowedTargets(address target) external view returns (bool);

    function refillGas(address payable user, uint256 gasCostWei) external returns (uint256 refunded);

    function addHandler(address handler) external;

    function removeHandler(address handler) external;

    function addAllowedTarget(address target) external;

    function removeAllowedTarget(address target) external;

    function setMaxRefillPerTx(uint256 newMaxRefillPerTx) external;

    function isAllowedTarget(address target) external view returns (bool);

    function deposit() external payable;

    function withdraw(address payable to, uint256 amount) external;
}
