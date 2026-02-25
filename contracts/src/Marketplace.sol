// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/extensions/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "../interfaces/IMarketplace.sol";
import "../interfaces/ITicketNFT.sol";

/// @title Marketplace
/// @notice Custodial resale marketplace enforcing markup caps and escrow replay protection.
contract Marketplace is
    AccessControlEnumerable,
    Pausable,
    ReentrancyGuard,
    IERC721Receiver,
    IMarketplace
{
    bytes32 public constant ESCROW_ROLE = keccak256("ESCROW_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    uint16 public constant MIN_MARKUP_BPS = 11000;
    uint16 public constant MAX_MARKUP_BPS = 12000;

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

    function listForSale(
        uint256 tokenId,
        uint256 price,
        uint64 expiresAt
    ) external override whenNotPaused nonReentrant {
        require(price > 0, "Marketplace: price required");
        require(!_listings[tokenId].active, "Marketplace: already listed");
        require(expiresAt == 0 || expiresAt > block.timestamp, "Marketplace: invalid expiry");

        address seller = _ticketToken.ownerOf(tokenId);
        require(seller == msg.sender, "Marketplace: not owner");

        ITicketNFT.TicketInfo memory info = ticketNFT.ticketData(tokenId);
        require(!ticketNFT.eventCancelled(info.eventId), "Marketplace: event cancelled");

        uint256 maxAllowedPrice = (uint256(info.originalPrice) * uint256(maxMarkupBps)) / 10_000;
        require(price <= maxAllowedPrice, "Marketplace: price too high");

        _listings[tokenId] = Listing({seller: seller, price: price, active: true, expiresAt: expiresAt});

        _ticketToken.safeTransferFrom(seller, address(this), tokenId);

        emit Listed(tokenId, seller, price, expiresAt);
    }

    function cancelListing(uint256 tokenId) external override whenNotPaused nonReentrant {
        Listing memory current = _listings[tokenId];
        require(current.active, "Marketplace: listing inactive");
        require(
            msg.sender == current.seller || hasRole(ESCROW_ROLE, msg.sender),
            "Marketplace: not authorized"
        );

        delete _listings[tokenId];
        _ticketToken.safeTransferFrom(address(this), current.seller, tokenId);

        string memory reason = msg.sender == current.seller
            ? "seller_cancelled"
            : "operator_cancelled";
        emit ListingCancelled(tokenId, current.seller, reason);
    }

    function completeSale(
        uint256 tokenId,
        address buyer,
        bytes calldata escrowData
    ) external override onlyRole(ESCROW_ROLE) whenNotPaused nonReentrant {
        require(buyer != address(0), "Marketplace: buyer required");
        require(escrowData.length > 0, "Marketplace: escrowData required");

        Listing memory current = _listings[tokenId];
        require(current.active, "Marketplace: listing inactive");
        require(current.expiresAt == 0 || current.expiresAt >= block.timestamp, "Marketplace: listing expired");

        bytes32 escrowHash = keccak256(escrowData);
        require(!consumedEscrowHashes[escrowHash], "Marketplace: escrow replay");
        consumedEscrowHashes[escrowHash] = true;

        delete _listings[tokenId];
        _ticketToken.safeTransferFrom(address(this), buyer, tokenId);

        emit SaleCompleted(tokenId, current.seller, buyer, current.price);
    }

    function setMaxMarkupBps(uint16 newMaxMarkupBps) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        require(
            newMaxMarkupBps >= MIN_MARKUP_BPS && newMaxMarkupBps <= MAX_MARKUP_BPS,
            "Marketplace: invalid markup"
        );
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

    function onERC721Received(
        address operator,
        address,
        uint256,
        bytes calldata
    ) external view override returns (bytes4) {
        require(msg.sender == address(_ticketToken), "Marketplace: unsupported NFT");
        require(operator == address(this), "Marketplace: direct transfer blocked");
        return IERC721Receiver.onERC721Received.selector;
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(AccessControlEnumerable)
        returns (bool)
    {
        return
            interfaceId == type(IMarketplace).interfaceId ||
            interfaceId == type(IERC721Receiver).interfaceId ||
            super.supportsInterface(interfaceId);
    }
}
