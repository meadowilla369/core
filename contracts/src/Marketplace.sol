// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/extensions/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "../interfaces/IMarketplace.sol";
import "../interfaces/ITicketNFT.sol";

/// @title Marketplace
/// @notice Custodial resale marketplace enforcing markup caps and escrow replay protection.
contract Marketplace is AccessControlEnumerable, Pausable, ReentrancyGuard, IERC721Receiver, IMarketplace {
    using ECDSA for bytes32;

    bytes32 public constant ESCROW_ROLE = keccak256("ESCROW_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    uint16 public constant MIN_MARKUP_BPS = 11000;
    uint16 public constant MAX_MARKUP_BPS = 12000;
    bytes3 private constant VND_CURRENCY = bytes3("VND");

    struct EscrowSettlementPayloadV1 {
        uint8 version;
        bytes16 settlementId;
        bytes16 listingId;
        bytes16 paymentId;
        uint256 tokenId;
        address seller;
        address buyer;
        uint128 grossAmount;
        uint128 sellerAmount;
        uint128 platformFee;
        uint128 organizerRoyalty;
        bytes3 currency;
        uint8 gateway;
        bytes32 gatewayReferenceHash;
        uint64 settledAt;
        bytes32 nonce;
    }

    ITicketNFT public immutable ticketNFT;
    IERC721 private immutable _ticketToken;

    uint16 public override maxMarkupBps = MAX_MARKUP_BPS;
    address public override escrowHook;

    mapping(uint256 => Listing) private _listings;
    mapping(bytes32 => bool) public consumedEscrowHashes;

    constructor(address ticketNFTAddress, address admin, address initialEscrowHook) {
        require(ticketNFTAddress != address(0), "Marketplace: ticketNFT required");
        require(admin != address(0), "Marketplace: admin required");

        ticketNFT = ITicketNFT(ticketNFTAddress);
        _ticketToken = IERC721(ticketNFTAddress);
        escrowHook = initialEscrowHook;

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function listForSale(uint256 tokenId, uint256 price, uint64 expiresAt)
        external
        override
        whenNotPaused
        nonReentrant
    {
        require(price > 0, "Marketplace: price required");
        require(!_listings[tokenId].active, "Marketplace: already listed");
        require(expiresAt == 0 || expiresAt > block.timestamp, "Marketplace: invalid expiry");

        address seller = _ticketToken.ownerOf(tokenId);
        require(seller == msg.sender, "Marketplace: not owner");

        ITicketNFT.TicketInfo memory info = ticketNFT.ticketData(tokenId);
        require(!ticketNFT.eventCancelled(info.eventId), "Marketplace: event cancelled");
        require(!info.isUsed, "Marketplace: used ticket");
        require(!info.refundClaimed, "Marketplace: refunded ticket");

        uint256 maxAllowedPrice = (uint256(info.originalPrice) * uint256(maxMarkupBps)) / 10_000;
        require(price <= maxAllowedPrice, "Marketplace: price too high");

        _listings[tokenId] = Listing({seller: seller, price: price, active: true, expiresAt: expiresAt});

        _ticketToken.safeTransferFrom(seller, address(this), tokenId);

        emit Listed(tokenId, seller, price, expiresAt);
    }

    function cancelListing(uint256 tokenId) external override whenNotPaused nonReentrant {
        Listing memory current = _listings[tokenId];
        require(current.active, "Marketplace: listing inactive");
        require(msg.sender == current.seller || hasRole(ESCROW_ROLE, msg.sender), "Marketplace: not authorized");

        delete _listings[tokenId];
        _ticketToken.safeTransferFrom(address(this), current.seller, tokenId);

        string memory reason = msg.sender == current.seller ? "seller_cancelled" : "operator_cancelled";
        emit ListingCancelled(tokenId, current.seller, reason);
    }

    function completeSale(uint256 tokenId, address buyer, bytes calldata escrowData)
        external
        override
        onlyRole(ESCROW_ROLE)
        whenNotPaused
        nonReentrant
    {
        _completeSale(tokenId, buyer, escrowData, bytes(""));
    }

    function completeSaleWithSignature(
        uint256 tokenId,
        address buyer,
        bytes calldata escrowData,
        bytes calldata escrowSignature
    ) external override onlyRole(ESCROW_ROLE) whenNotPaused nonReentrant {
        require(escrowSignature.length != 0, "Marketplace: signature required");
        _completeSale(tokenId, buyer, escrowData, escrowSignature);
    }

    function _completeSale(uint256 tokenId, address buyer, bytes calldata escrowData, bytes memory escrowSignature)
        internal
    {
        require(buyer != address(0), "Marketplace: buyer required");
        require(escrowData.length > 0, "Marketplace: escrowData required");

        Listing memory current = _listings[tokenId];
        require(current.active, "Marketplace: listing inactive");
        require(current.expiresAt == 0 || current.expiresAt >= block.timestamp, "Marketplace: listing expired");

        bytes32 escrowHash = keccak256(escrowData);
        require(!consumedEscrowHashes[escrowHash], "Marketplace: escrow replay");

        if (escrowSignature.length != 0) {
            require(escrowHook != address(0), "Marketplace: escrowHook not set");
            bytes32 digest = MessageHashUtils.toEthSignedMessageHash(escrowHash);
            address recovered = digest.recover(escrowSignature);
            require(recovered == escrowHook, "Marketplace: bad escrow signature");
            emit EscrowSignatureVerified(escrowHash, recovered);
        }

        consumedEscrowHashes[escrowHash] = true;

        _validateEscrowPayload(tokenId, buyer, current, escrowData);

        ITicketNFT.TicketInfo memory info = ticketNFT.ticketData(tokenId);
        require(!ticketNFT.eventCancelled(info.eventId), "Marketplace: event cancelled");
        require(!info.isUsed, "Marketplace: used ticket");
        require(!info.refundClaimed, "Marketplace: refunded ticket");

        delete _listings[tokenId];
        _ticketToken.safeTransferFrom(address(this), buyer, tokenId);

        emit SaleCompleted(tokenId, current.seller, buyer, current.price);
    }

    function setMaxMarkupBps(uint16 newMaxMarkupBps) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newMaxMarkupBps >= MIN_MARKUP_BPS && newMaxMarkupBps <= MAX_MARKUP_BPS, "Marketplace: invalid markup");
        uint16 previous = maxMarkupBps;
        maxMarkupBps = newMaxMarkupBps;
        emit MaxMarkupUpdated(previous, newMaxMarkupBps);
    }

    function setEscrowHook(address newHook) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        address previous = escrowHook;
        escrowHook = newHook;
        emit EscrowHookUpdated(previous, newHook);
    }

    function listing(uint256 tokenId) external view override returns (Listing memory) {
        return _listings[tokenId];
    }

    function onERC721Received(address operator, address, uint256, bytes calldata)
        external
        view
        override
        returns (bytes4)
    {
        require(msg.sender == address(_ticketToken), "Marketplace: unsupported NFT");
        require(operator == address(this), "Marketplace: direct transfer blocked");
        return IERC721Receiver.onERC721Received.selector;
    }

    function _validateEscrowPayload(uint256 tokenId, address buyer, Listing memory current, bytes calldata escrowData)
        internal
        view
    {
        EscrowSettlementPayloadV1 memory payload = abi.decode(escrowData, (EscrowSettlementPayloadV1));

        require(payload.version == 1, "Marketplace: bad payload version");
        require(payload.currency == VND_CURRENCY, "Marketplace: bad currency");
        require(payload.gateway == 1 || payload.gateway == 2, "Marketplace: bad gateway");
        require(payload.settledAt <= block.timestamp, "Marketplace: settlement in future");
        require(payload.nonce != bytes32(0), "Marketplace: nonce required");

        require(payload.tokenId == tokenId, "Marketplace: token mismatch");
        require(payload.seller == current.seller, "Marketplace: seller mismatch");
        require(payload.buyer == buyer, "Marketplace: buyer mismatch");
        require(payload.grossAmount == current.price, "Marketplace: amount mismatch");

        uint256 splitTotal =
            uint256(payload.sellerAmount) + uint256(payload.platformFee) + uint256(payload.organizerRoyalty);
        require(splitTotal == uint256(payload.grossAmount), "Marketplace: split mismatch");
    }

    function supportsInterface(bytes4 interfaceId) public view override(AccessControlEnumerable) returns (bool) {
        return interfaceId == type(IMarketplace).interfaceId || interfaceId == type(IERC721Receiver).interfaceId
            || super.supportsInterface(interfaceId);
    }
}
