// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IMarketplaceV2
/// @notice Interface for the EIP-712-based resale marketplace that operates on TicketLedger.
interface IMarketplaceV2 {
    struct Listing {
        uint256 listingId;
        uint256 ticketId;
        address seller;
        uint256 price;
        bool active;
        uint256 listedAt;
    }

    event TicketListed(
        uint256 indexed listingId,
        address indexed seller,
        uint256 indexed ticketId,
        uint256 price
    );
    event ListingCancelled(uint256 indexed listingId, address indexed seller, string reason);
    event TicketSold(
        uint256 indexed listingId,
        address indexed buyer,
        address indexed seller,
        uint256 ticketId,
        uint256 price
    );
    event MaxMarkupUpdated(uint16 previousMaxMarkupBps, uint16 newMaxMarkupBps);
    event PendingPayoutRecorded(address indexed seller, uint256 amount);

    function listTicket(uint256 ticketId, uint256 price) external returns (uint256 listingId);

    function cancelListing(uint256 listingId) external;

    function buyWithSignature(
        uint256 listingId,
        bytes32 paymentHash,
        bytes calldata signature
    ) external;

    function setMaxMarkupBps(uint16 newMaxMarkupBps) external;

    function getListing(uint256 listingId) external view returns (Listing memory);

    function pendingPayouts(address seller) external view returns (uint256);

    function maxMarkupBps() external view returns (uint16);

    function listingCounter() external view returns (uint256);
}
