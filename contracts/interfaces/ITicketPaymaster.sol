// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ITicketPaymaster
/// @notice Minimal ERC-4337 paymaster surface used by backend bundlers.
interface ITicketPaymaster {
    struct UserOperation {
        address sender;
        uint256 nonce;
        bytes initCode;
        bytes callData;
        uint256 callGasLimit;
        uint256 verificationGasLimit;
        uint256 preVerificationGas;
        uint256 maxFeePerGas;
        uint256 maxPriorityFeePerGas;
        bytes paymasterAndData;
        bytes signature;
    }

    enum PostOpMode {
        opSucceeded,
        opReverted,
        postOpReverted
    }

    event SessionPolicySet(address indexed user, bytes32 policyHash, uint256 expiresAt);
    event SessionSignerUpdated(address indexed previousSigner, address indexed newSigner);

    function validatePaymasterUserOp(
        UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 maxCost
    ) external returns (bytes memory context, uint256 validationData);

    function postOp(PostOpMode mode, bytes calldata context, uint256 actualGasCost) external;

    function sessionSigner() external view returns (address);

    function setSessionSigner(address newSigner) external;

    function setDailyGasBudget(address user, uint256 maxCost) external;
}
