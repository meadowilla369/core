// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/IGuardianAccount.sol";

/// @title GuardianAccount
/// @notice Minimal guardian-controlled recovery account with delay and transfer freeze during recovery.
contract GuardianAccount is IGuardianAccount {
    address private _owner;
    address private _guardian;

    address public override pendingNewOwner;
    uint256 public override recoveryInitiated;
    uint256 public immutable override RECOVERY_DELAY;

    modifier onlyOwner() {
        require(msg.sender == _owner, "GuardianAccount: not owner");
        _;
    }

    modifier onlyGuardian() {
        require(msg.sender == _guardian, "GuardianAccount: not guardian");
        _;
    }

    constructor(address initialOwner, address initialGuardian, uint256 recoveryDelay) {
        require(initialOwner != address(0), "GuardianAccount: owner required");
        require(initialGuardian != address(0), "GuardianAccount: guardian required");
        _owner = initialOwner;
        _guardian = initialGuardian;
        RECOVERY_DELAY = recoveryDelay;
    }

    function owner() external view override returns (address) {
        return _owner;
    }

    function guardian() external view override returns (address) {
        return _guardian;
    }

    function isRecoveryPending() public view override returns (bool) {
        return pendingNewOwner != address(0);
    }

    function initiateRecovery(address newOwner) external override onlyGuardian {
        require(newOwner != address(0), "GuardianAccount: owner required");
        require(newOwner != _owner, "GuardianAccount: same owner");
        require(!isRecoveryPending(), "GuardianAccount: recovery pending");

        pendingNewOwner = newOwner;
        recoveryInitiated = block.timestamp;
        emit RecoveryInitiated(_owner, newOwner, block.timestamp);
    }

    function completeRecovery() external override onlyGuardian {
        require(isRecoveryPending(), "GuardianAccount: no recovery");
        require(block.timestamp >= recoveryInitiated + RECOVERY_DELAY, "GuardianAccount: recovery delay active");

        address previousOwner = _owner;
        _owner = pendingNewOwner;
        pendingNewOwner = address(0);
        recoveryInitiated = 0;

        emit RecoveryCompleted(previousOwner, _owner);
    }

    function cancelRecovery() external override onlyOwner {
        require(isRecoveryPending(), "GuardianAccount: no recovery");
        pendingNewOwner = address(0);
        recoveryInitiated = 0;
        emit RecoveryCancelled(_owner);
    }

    function execute(address target, uint256 value, bytes calldata data) external onlyOwner returns (bytes memory) {
        require(!isRecoveryPending(), "GuardianAccount: recovery pending");
        require(target != address(0), "GuardianAccount: target required");

        (bool success, bytes memory result) = target.call{value: value}(data);
        require(success, "GuardianAccount: call failed");
        return result;
    }

    receive() external payable {}
}
