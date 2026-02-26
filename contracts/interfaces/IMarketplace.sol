// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IMarketplace
/// @notice Interface for the custodial resale marketplace contract.
interface IMarketplace {
    struct Listing {
        address seller;
        uint256 price;
        bool active;
        uint64 expiresAt;
    }

    event Listed(uint256 indexed tokenId, address indexed seller, uint256 price, uint64 expiresAt);
    event ListingCancelled(uint256 indexed tokenId, address indexed seller, string reason);
    event SaleCompleted(
        uint256 indexed tokenId,
        address indexed seller,
        address indexed buyer,
        uint256 price
    );
    event MaxMarkupUpdated(uint16 previousMaxMarkupBps, uint16 newMaxMarkupBps);
    event EscrowHookUpdated(address indexed previousHook, address indexed newHook);
    event EscrowSignatureVerified(bytes32 indexed escrowHash, address indexed signer);

    function listForSale(
        uint256 tokenId,
        uint256 price,
        uint64 expiresAt
    ) external;

    function cancelListing(uint256 tokenId) external;

    function completeSale(
        uint256 tokenId,
        address buyer,
        bytes calldata escrowData
    ) external;

    function completeSaleWithSignature(
        uint256 tokenId,
        address buyer,
        bytes calldata escrowData,
        bytes calldata escrowSignature
    ) external;

    function setMaxMarkupBps(uint16 newMaxMarkupBps) external;

    function setEscrowHook(address newHook) external;

    function listing(uint256 tokenId) external view returns (Listing memory);

    function maxMarkupBps() external view returns (uint16);

    function escrowHook() external view returns (address);
}
