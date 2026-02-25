// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/extensions/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

import "../interfaces/ITicketPaymaster.sol";

/// @title TicketPaymaster
/// @notice Minimal ERC-4337-style paymaster with signed session policy and per-user daily gas budgets.
contract TicketPaymaster is AccessControlEnumerable, Pausable, ITicketPaymaster {
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    uint256 private constant DAY = 1 days;

    address public immutable entryPoint;
    address public override sessionSigner;

    mapping(address => uint256) public dailyGasBudget;
    mapping(address => uint256) public spentDayIndex;
    mapping(address => uint256) public spentToday;
    mapping(address => mapping(bytes32 => uint256)) public policyExpiresAt;

    event DailyGasBudgetUpdated(address indexed user, uint256 previousBudget, uint256 newBudget);

    constructor(address admin, address entryPointAddress, address initialSessionSigner) {
        require(admin != address(0), "TicketPaymaster: admin required");
        require(entryPointAddress != address(0), "TicketPaymaster: entrypoint required");
        require(initialSessionSigner != address(0), "TicketPaymaster: signer required");

        entryPoint = entryPointAddress;
        sessionSigner = initialSessionSigner;

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function setSessionSigner(address newSigner) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newSigner != address(0), "TicketPaymaster: signer required");
        address previous = sessionSigner;
        sessionSigner = newSigner;
        emit SessionSignerUpdated(previous, newSigner);
    }

    function setDailyGasBudget(address user, uint256 maxCost) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        require(user != address(0), "TicketPaymaster: user required");
        uint256 previous = dailyGasBudget[user];
        dailyGasBudget[user] = maxCost;
        emit DailyGasBudgetUpdated(user, previous, maxCost);
    }

    function setSessionPolicy(address user, bytes32 policyHash, uint256 expiresAt)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(user != address(0), "TicketPaymaster: user required");
        require(policyHash != bytes32(0), "TicketPaymaster: policy required");
        require(expiresAt > block.timestamp, "TicketPaymaster: expiry required");
        policyExpiresAt[user][policyHash] = expiresAt;
        emit SessionPolicySet(user, policyHash, expiresAt);
    }

    function validatePaymasterUserOp(UserOperation calldata userOp, bytes32 userOpHash, uint256 maxCost)
        external
        view
        override
        whenNotPaused
        returns (bytes memory context, uint256 validationData)
    {
        require(msg.sender == entryPoint, "TicketPaymaster: only entrypoint");
        require(userOp.sender != address(0), "TicketPaymaster: sender required");

        (uint256 expiresAt, bytes32 policyHash, bytes memory signature) =
            abi.decode(userOp.paymasterAndData, (uint256, bytes32, bytes));
        require(expiresAt > block.timestamp, "TicketPaymaster: session expired");

        uint256 registeredExpiry = policyExpiresAt[userOp.sender][policyHash];
        require(registeredExpiry == expiresAt, "TicketPaymaster: unknown policy");

        uint256 dayIndex = block.timestamp / DAY;
        uint256 budget = dailyGasBudget[userOp.sender];
        require(budget != 0, "TicketPaymaster: budget not set");
        require(_spentForDay(userOp.sender, dayIndex) + maxCost <= budget, "TicketPaymaster: budget exceeded");

        bytes32 digest = keccak256(
            abi.encode(address(this), block.chainid, userOpHash, userOp.sender, policyHash, expiresAt, maxCost)
        );
        bytes32 signedDigest = MessageHashUtils.toEthSignedMessageHash(digest);
        address recoveredSigner = ECDSA.recover(signedDigest, signature);
        require(recoveredSigner == sessionSigner, "TicketPaymaster: bad signature");

        return (abi.encode(userOp.sender, dayIndex), 0);
    }

    function postOp(PostOpMode, bytes calldata context, uint256 actualGasCost) external override whenNotPaused {
        require(msg.sender == entryPoint, "TicketPaymaster: only entrypoint");
        (address user, uint256 dayIndex) = abi.decode(context, (address, uint256));
        require(user != address(0), "TicketPaymaster: user required");

        if (spentDayIndex[user] != dayIndex) {
            spentDayIndex[user] = dayIndex;
            spentToday[user] = 0;
        }

        uint256 newSpent = spentToday[user] + actualGasCost;
        require(newSpent <= dailyGasBudget[user], "TicketPaymaster: postOp budget exceeded");
        spentToday[user] = newSpent;
    }

    function _spentForDay(address user, uint256 dayIndex) internal view returns (uint256) {
        if (spentDayIndex[user] != dayIndex) {
            return 0;
        }
        return spentToday[user];
    }
}
