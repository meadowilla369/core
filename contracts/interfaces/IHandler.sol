// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IHandler
/// @notice Batched execution surface intended for EOAs delegated via EIP-7702.
interface IHandler {
    struct Call {
        address target;
        uint256 value;
        bytes data;
    }

    event BatchExecuted(address indexed user, uint256 callCount, uint256 gasCostWei);
    event GasRefillRequested(address indexed user, uint256 gasCostWei);

    function paymaster() external view returns (address);

    function executeBatch(Call[] calldata calls) external payable returns (bytes[] memory results);
}
