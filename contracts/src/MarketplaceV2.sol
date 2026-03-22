// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/extensions/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "../interfaces/IMarketplaceV2.sol";
import "./TicketLedger.sol";

/// @title MarketplaceV2
/// @notice Custodial resale marketplace for TicketLedger tickets.
///         Uses EIP-712 BUY_TYPE signatures for payment authorization instead of an escrow operator.
contract MarketplaceV2 is AccessControlEnumerable, Pausable, ReentrancyGuard, IMarketplaceV2 {
    using ECDSA for bytes32;

    bytes32 private constant EIP712_DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 private constant NAME_HASH = keccak256(bytes("MarketplaceV2"));
    bytes32 private constant VERSION_HASH = keccak256(bytes("1"));
    bytes32 private constant BUY_TYPEHASH =
        keccak256("Buy(uint256 listingId,bytes32 paymentHash,address buyer)");

    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    /// @notice Role allowed to sign resale payment authorization hashes.
    bytes32 public constant PAYMENT_HASH_ROLE = keccak256("PAYMENT_HASH_ROLE");

    uint16 public constant MIN_MARKUP_BPS = 10000;
    uint16 public constant MAX_MARKUP_BPS = 12000;

    /// @notice Immutable EIP-712 domain separator.
    bytes32 private immutable DOMAIN_SEPARATOR;

    TicketLedger public immutable ticketLedger;

    uint16 public override maxMarkupBps = MAX_MARKUP_BPS;
    uint256 public override listingCounter;

    mapping(uint256 => Listing) private _listings;
    mapping(bytes32 => bool) public usedPaymentHashes;
    mapping(address => uint256) public override pendingPayouts;

    constructor(address ticketLedgerAddress, address admin) {
        require(ticketLedgerAddress != address(0), "MarketplaceV2: ticketLedger required");
        require(admin != address(0), "MarketplaceV2: admin required");

        ticketLedger = TicketLedger(ticketLedgerAddress);

        DOMAIN_SEPARATOR =
            keccak256(abi.encode(EIP712_DOMAIN_TYPEHASH, NAME_HASH, VERSION_HASH, block.chainid, address(this)));

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
        _grantRole(PAYMENT_HASH_ROLE, admin);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /// @notice Lists a ticket for resale.
    ///         In the EIP-7702 batch pattern the seller's EOA first calls
    ///         `TicketLedger.transferTicket(ticketId, marketplace)` and then this function
    ///         in the same Handler.executeBatch call. By the time this runs, the marketplace
    ///         already holds the ticket.
    /// @param ticketId Ticket id to list (must already be held by this contract).
    /// @param price Ask price in off-chain currency units (VND).
    /// @return listingId Auto-incremented listing id.
    function listTicket(uint256 ticketId, uint256 price)
        external
        override
        whenNotPaused
        nonReentrant
        returns (uint256 listingId)
    {
        require(price > 0, "MarketplaceV2: price required");

        (uint256 storedTicketId,,,address owner, uint256 originalPrice, bool used,,) = ticketLedger.tickets(ticketId);
        require(storedTicketId != 0, "MarketplaceV2: ticket not found");
        // Ticket must have been transferred to this contract (by the caller in a prior batch step).
        require(owner == address(this), "MarketplaceV2: ticket not in escrow");
        require(!used, "MarketplaceV2: ticket used");

        if (originalPrice > 0) {
            uint256 maxAllowedPrice = (originalPrice * uint256(maxMarkupBps)) / 10_000;
            require(price <= maxAllowedPrice, "MarketplaceV2: price too high");
        }

        listingId = ++listingCounter;
        // Record msg.sender as seller – they are the EOA that initiated the batch transfer.
        _listings[listingId] = Listing({
            listingId: listingId,
            ticketId: ticketId,
            seller: msg.sender,
            price: price,
            active: true,
            listedAt: block.timestamp
        });

        emit TicketListed(listingId, msg.sender, ticketId, price);
    }

    /// @notice Cancels an active listing and returns ticket to seller.
    /// @param listingId Listing id to cancel.
    function cancelListing(uint256 listingId) external override whenNotPaused nonReentrant {
        Listing storage current = _listings[listingId];
        require(current.active, "MarketplaceV2: listing inactive");
        require(msg.sender == current.seller || hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "MarketplaceV2: not authorized");

        address seller = current.seller;
        uint256 ticketId = current.ticketId;
        current.active = false;

        ticketLedger.transferTicket(ticketId, seller);

        emit ListingCancelled(listingId, seller, msg.sender == seller ? "seller_cancelled" : "admin_cancelled");
    }

    /// @notice Completes a resale purchase using a backend-signed EIP-712 BUY authorization.
    /// @param listingId Active listing to purchase.
    /// @param paymentHash One-time payment hash from backend (replay-protected).
    /// @param signature Backend EIP-712 signature over (listingId, paymentHash, buyer).
    function buyWithSignature(uint256 listingId, bytes32 paymentHash, bytes calldata signature)
        external
        override
        whenNotPaused
        nonReentrant
    {
        require(paymentHash != bytes32(0), "MarketplaceV2: invalid payment hash");
        require(!usedPaymentHashes[paymentHash], "MarketplaceV2: payment hash used");

        Listing storage current = _listings[listingId];
        require(current.active, "MarketplaceV2: listing inactive");
        require(msg.sender != current.seller, "MarketplaceV2: seller cannot buy own listing");

        bytes32 structHash = keccak256(abi.encode(BUY_TYPEHASH, listingId, paymentHash, msg.sender));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
        (address signer, ECDSA.RecoverError recoveryError,) = ECDSA.tryRecoverCalldata(digest, signature);
        require(
            recoveryError == ECDSA.RecoverError.NoError && hasRole(PAYMENT_HASH_ROLE, signer),
            "MarketplaceV2: invalid signature"
        );

        usedPaymentHashes[paymentHash] = true;

        address seller = current.seller;
        uint256 ticketId = current.ticketId;
        uint256 price = current.price;
        current.active = false;

        // Transfer ticket from marketplace escrow to buyer
        ticketLedger.transferTicket(ticketId, msg.sender);

        pendingPayouts[seller] += price;

        emit TicketSold(listingId, msg.sender, seller, ticketId, price);
        emit PendingPayoutRecorded(seller, price);
    }

    function setMaxMarkupBps(uint16 newMaxMarkupBps) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newMaxMarkupBps >= MIN_MARKUP_BPS && newMaxMarkupBps <= MAX_MARKUP_BPS, "MarketplaceV2: invalid markup");
        uint16 previous = maxMarkupBps;
        maxMarkupBps = newMaxMarkupBps;
        emit MaxMarkupUpdated(previous, newMaxMarkupBps);
    }

    function getListing(uint256 listingId) external view override returns (Listing memory) {
        return _listings[listingId];
    }

    function supportsInterface(bytes4 interfaceId) public view override(AccessControlEnumerable) returns (bool) {
        return interfaceId == type(IMarketplaceV2).interfaceId || super.supportsInterface(interfaceId);
    }
}
