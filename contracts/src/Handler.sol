// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/IHandler.sol";
import "../interfaces/ITicketPaymaster.sol";

/// @title Handler
/// @notice Stateless execution handler intended to run under an EIP-7702 delegated EOA.
/// @dev Configuration lives in `TicketPaymaster` because delegated EOAs use their own storage, not the
/// implementation contract's storage. This contract therefore only keeps immutable references.
contract Handler is IHandler {
    /// @notice Approximate overhead reserved for the paymaster refill call and final bookkeeping.
    uint256 public constant REFILL_OVERHEAD = 35_000;

    /// @notice Paymaster treasury that reimburses gas to the delegated EOA.
    address public immutable override paymaster;

    constructor(address paymasterAddress) {
        require(paymasterAddress != address(0), "Handler: paymaster required");
        paymaster = paymasterAddress;
    }

    /// @notice Executes a batch of business calls and then asks the paymaster to reimburse gas in the same tx.
    /// @param calls Target calls to execute atomically from the delegated EOA.
    /// @return results Return data from each call in order.
    function executeBatch(Call[] calldata calls) external payable override returns (bytes[] memory results) {
        require(calls.length != 0, "Handler: calls required");

        uint256 gasStart = gasleft();
        results = new bytes[](calls.length);

        for (uint256 i = 0; i < calls.length; ++i) {
            Call calldata current = calls[i];
            require(current.target != address(0), "Handler: target required");
            require(ITicketPaymaster(paymaster).isAllowedTarget(current.target), "Handler: target not allowed");

            (bool success, bytes memory result) = current.target.call{value: current.value}(current.data);
            if (!success) {
                _bubbleRevert(result);
            }

            results[i] = result;
        }

        uint256 gasCostWei = ((gasStart - gasleft()) + REFILL_OVERHEAD) * tx.gasprice;
        emit GasRefillRequested(address(this), gasCostWei);

        if (gasCostWei != 0) {
            ITicketPaymaster(paymaster).refillGas(payable(address(this)), gasCostWei);
        }

        emit BatchExecuted(address(this), calls.length, gasCostWei);
    }

    receive() external payable {}

    function _bubbleRevert(bytes memory revertData) private pure {
        if (revertData.length == 0) {
            revert("Handler: call failed");
        }

        assembly ("memory-safe") {
            revert(add(revertData, 0x20), mload(revertData))
        }
    }
}
