// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ITicketNFT
/// @notice Interface for the primary ticket NFT contract described in DESIGN.md.
interface ITicketNFT {
    struct TicketInfo {
        uint256 eventId;
        uint256 ticketTypeId;
        uint64 originalPrice;
        bool isUsed;
        bool refundClaimed;
    }

    event TicketMinted(uint256 indexed tokenId, uint256 indexed eventId, address indexed owner);
    event TicketUsed(uint256 indexed tokenId, uint256 usedAt);
    event EventCancelled(uint256 indexed eventId, uint256 cancelledAt);
    event TicketRefunded(uint256 indexed tokenId, uint256 amount);
    event MinterUpdated(address indexed previousMinter, address indexed newMinter);

    function mint(
        address to,
        uint256 eventId,
        uint256 ticketTypeId,
        bytes calldata seatInfo
    ) external;

    function markAsUsed(uint256 tokenId) external;

    function cancelEvent(uint256 eventId) external;

    function setMinter(address newMinter) external;

    function ticketData(uint256 tokenId) external view returns (TicketInfo memory);

    function eventCancelled(uint256 eventId) external view returns (bool);

    function mintedPerEvent(uint256 eventId) external view returns (uint32);
}
