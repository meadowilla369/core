// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/extensions/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @title TicketLedger
/// @notice Ticket ledger that stores ownership and lifecycle state directly in contract storage.
contract TicketLedger is AccessControlEnumerable {
    bytes32 private constant EIP712_DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 private constant NAME_HASH = keccak256(bytes("TicketLedger"));
    bytes32 private constant VERSION_HASH = keccak256(bytes("1"));
    bytes32 private constant PURCHASE_TYPEHASH =
        keccak256("Purchase(uint256 eventId,uint256 ticketTypeId,uint256 quantity,bytes32 paymentHash,address buyer)");

    /// @notice Immutable EIP-712 domain separator used for purchase signature verification.
    bytes32 private immutable DOMAIN_SEPARATOR;

    /// @notice Role allowed to mark tickets as used during check-in.
    bytes32 public constant CHECKIN_ROLE = keccak256("CHECKIN_ROLE");
    /// @notice Role allowed to cancel tickets for refund flows.
    bytes32 public constant REFUND_ROLE = keccak256("REFUND_ROLE");
    /// @notice Role allowed to authorize backend-issued payment hashes.
    bytes32 public constant PAYMENT_HASH_ROLE = keccak256("PAYMENT_HASH_ROLE");

    /// @notice Canonical on-chain representation of a ticket.
    struct Ticket {
        uint256 ticketId;
        uint256 eventId;
        uint256 ticketTypeId;
        address owner;
        uint256 price;
        bool used;
        uint256 purchasedAt;
        uint256 usedAt;
    }

    /// @notice Mapping from ticket id to ticket record.
    mapping(uint256 => Ticket) public tickets;
    /// @notice Replay-protection map for payment hashes consumed in purchases.
    mapping(bytes32 => bool) public usedPaymentHashes;
    /// @notice Reverse index of owned ticket ids.
    mapping(address => uint256[]) public ownerTickets;

    mapping(uint256 => uint256[]) private _eventTickets;

    /// @notice Running ticket id counter.
    uint256 public ticketCounter;

    /// @notice Emitted when a ticket is purchased.
    event TicketPurchased(
        uint256 indexed ticketId, address indexed buyer, uint256 eventId, uint256 price, uint256 timestamp
    );
    /// @notice Emitted when ownership changes by user transfer.
    event TicketTransferred(uint256 indexed ticketId, address indexed from, address indexed to);
    /// @notice Emitted when a ticket is marked as used.
    event TicketUsed(uint256 indexed ticketId, address indexed owner, uint256 eventId, uint256 timestamp);
    /// @notice Emitted when a ticket is cancelled for refund.
    event TicketCancelled(uint256 indexed ticketId, uint256 refundAmount);

    /// @param admin Address that receives default admin and operational roles.
    constructor(address admin) {
        require(admin != address(0), "TicketLedger: admin required");
        DOMAIN_SEPARATOR =
            keccak256(abi.encode(EIP712_DOMAIN_TYPEHASH, NAME_HASH, VERSION_HASH, block.chainid, address(this)));

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAYMENT_HASH_ROLE, admin);
        _grantRole(CHECKIN_ROLE, admin);
        _grantRole(REFUND_ROLE, admin);
    }

    /// @notice Mints one or more tickets for caller using backend EIP-712 authorization.
    /// @param eventId Event id the tickets belong to.
    /// @param ticketTypeId Ticket type id selected by buyer.
    /// @param quantity Number of tickets to mint.
    /// @param paymentHash One-time payment hash from backend.
    /// @param signature Backend signature over the purchase authorization payload.
    /// @return ticketIds List of newly minted ticket ids.
    function purchaseWithSignature(
        uint256 eventId,
        uint256 ticketTypeId,
        uint256 quantity,
        bytes32 paymentHash,
        bytes calldata signature
    ) external returns (uint256[] memory ticketIds) {
        require(eventId != 0, "TicketLedger: invalid eventId");
        require(ticketTypeId != 0, "TicketLedger: invalid ticketTypeId");
        require(quantity != 0, "TicketLedger: invalid quantity");
        require(paymentHash != bytes32(0), "TicketLedger: invalid payment hash");
        require(!usedPaymentHashes[paymentHash], "TicketLedger: payment hash used");

        bytes32 structHash =
            keccak256(abi.encode(PURCHASE_TYPEHASH, eventId, ticketTypeId, quantity, paymentHash, msg.sender));
        bytes32 digest = _hashTypedDataV4(structHash);
        (address signer, ECDSA.RecoverError error,) = ECDSA.tryRecoverCalldata(digest, signature);
        require(
            error == ECDSA.RecoverError.NoError && hasRole(PAYMENT_HASH_ROLE, signer), "TicketLedger: invalid signature"
        );

        usedPaymentHashes[paymentHash] = true;

        ticketIds = new uint256[](quantity);
        for (uint256 i = 0; i < quantity; ++i) {
            uint256 nextTicketId = ticketCounter + 1;
            ticketCounter = nextTicketId;

            tickets[nextTicketId] = Ticket({
                ticketId: nextTicketId,
                eventId: eventId,
                ticketTypeId: ticketTypeId,
                owner: msg.sender,
                price: 0,
                used: false,
                purchasedAt: block.timestamp,
                usedAt: 0
            });

            ownerTickets[msg.sender].push(nextTicketId);
            _eventTickets[eventId].push(nextTicketId);
            ticketIds[i] = nextTicketId;

            emit TicketPurchased(nextTicketId, msg.sender, eventId, 0, block.timestamp);
        }
    }

    /// @notice Transfers a ticket from caller to another address.
    /// @param ticketId Ticket id to transfer.
    /// @param to New owner address.
    function transferTicket(uint256 ticketId, address to) external {
        require(to != address(0), "TicketLedger: invalid recipient");

        Ticket storage ticket = tickets[ticketId];
        require(ticket.ticketId != 0, "TicketLedger: ticket not found");
        require(ticket.owner == msg.sender, "TicketLedger: caller is not owner");
        require(!ticket.used, "TicketLedger: ticket already used");

        address from = ticket.owner;
        _removeOwnerTicket(from, ticketId);
        ticket.owner = to;
        ownerTickets[to].push(ticketId);

        emit TicketTransferred(ticketId, from, to);
    }

    /// @notice Marks a batch of tickets as used during check-in.
    /// @param ticketIds List of ticket ids to update.
    function markUsedBatch(uint256[] calldata ticketIds) external onlyRole(CHECKIN_ROLE) {
        for (uint256 i = 0; i < ticketIds.length; ++i) {
            Ticket storage ticket = tickets[ticketIds[i]];
            require(ticket.ticketId != 0, "TicketLedger: ticket not found");
            require(ticket.owner != address(0), "TicketLedger: ticket inactive");
            require(!ticket.used, "TicketLedger: ticket already used");

            ticket.used = true;
            ticket.usedAt = block.timestamp;

            emit TicketUsed(ticket.ticketId, ticket.owner, ticket.eventId, block.timestamp);
        }
    }

    /// @notice Cancels a ticket for refund processing.
    /// @param ticketId Ticket id to cancel.
    function cancelTicket(uint256 ticketId) external onlyRole(REFUND_ROLE) {
        Ticket storage ticket = tickets[ticketId];
        require(ticket.ticketId != 0, "TicketLedger: ticket not found");
        require(ticket.owner != address(0), "TicketLedger: ticket inactive");
        require(!ticket.used, "TicketLedger: ticket already used");

        address previousOwner = ticket.owner;
        _removeOwnerTicket(previousOwner, ticketId);
        ticket.owner = address(0);

        emit TicketCancelled(ticketId, ticket.price);
    }

    /// @notice Returns all ticket ids currently owned by an account.
    /// @param owner Owner address.
    /// @return ticketIds Ticket ids mapped to owner.
    function getTicketsByOwner(address owner) external view returns (uint256[] memory ticketIds) {
        return ownerTickets[owner];
    }

    /// @notice Returns all ticket ids created for an event.
    /// @param eventId Event id.
    /// @return ticketIds Ticket ids minted under event.
    function getTicketsByEvent(uint256 eventId) external view returns (uint256[] memory ticketIds) {
        return _eventTickets[eventId];
    }

    function _removeOwnerTicket(address owner, uint256 ticketId) internal {
        uint256[] storage ticketIds = ownerTickets[owner];
        for (uint256 i = 0; i < ticketIds.length; ++i) {
            if (ticketIds[i] == ticketId) {
                uint256 lastIndex = ticketIds.length - 1;
                ticketIds[i] = ticketIds[lastIndex];
                ticketIds.pop();
                return;
            }
        }

        revert("TicketLedger: owner index missing");
    }

    function _hashTypedDataV4(bytes32 structHash) internal view returns (bytes32 digest) {
        return keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
    }
}
