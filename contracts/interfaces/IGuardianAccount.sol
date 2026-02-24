// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IGuardianAccount
/// @notice ERC-4337 smart-account surface that supports guardian-based recovery delays.
interface IGuardianAccount {
    event RecoveryInitiated(address indexed oldOwner, address indexed newOwner, uint256 timestamp);
    event RecoveryCompleted(address indexed previousOwner, address indexed newOwner);
    event RecoveryCancelled(address indexed owner);

    function owner() external view returns (address);

    function guardian() external view returns (address);

    function pendingNewOwner() external view returns (address);

    function recoveryInitiated() external view returns (uint256);

    function RECOVERY_DELAY() external view returns (uint256);

    function isRecoveryPending() external view returns (bool);

    function initiateRecovery(address newOwner) external;

    function completeRecovery() external;

    function cancelRecovery() external;
}
