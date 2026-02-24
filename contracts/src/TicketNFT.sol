// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/extensions/AccessControlEnumerable.sol";

import "../interfaces/ITicketNFT.sol";

/// @title TicketNFT
/// @notice ERC-721 contract that mints on-chain tickets per DESIGN.md specification.
contract TicketNFT is ERC721Enumerable, Pausable, AccessControlEnumerable, ITicketNFT {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant EVENT_MANAGER_ROLE = keccak256("EVENT_MANAGER_ROLE");

    struct EventConfig {
        uint32 maxSupply; // 0 means unlimited
        bool exists;
    }

    struct TicketTypeConfig {
        uint64 price;
        bool exists;
    }

    uint256 private _nextTokenId = 1;
    string private _baseTokenURI; // optional metadata pointer

    mapping(uint256 => TicketInfo) private _ticketInfo; // tokenId => ticket data snapshot
    mapping(uint256 => bytes) private _seatInfo; // tokenId => seat payload (JSON/bytes)
    mapping(uint256 => EventConfig) private _eventConfigs; // eventId => capacity config
    mapping(uint256 => TicketTypeConfig) private _ticketTypes; // ticketTypeId => price snapshot
    mapping(uint256 => uint32) private _mintedPerEvent; // eventId => minted count
    mapping(uint256 => bool) private _eventCancelled; // eventId => cancellation flag

    address public currentMinter;

    event EventConfigured(uint256 indexed eventId, uint32 maxSupply);
    event TicketTypeConfigured(uint256 indexed ticketTypeId, uint64 price);
    event SeatInfoUpdated(uint256 indexed tokenId, bytes seatInfo);

    constructor(
        string memory name_,
        string memory symbol_,
        address admin
    ) ERC721(name_, symbol_) {
        require(admin != address(0), "TicketNFT: admin required");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);
        _grantRole(EVENT_MANAGER_ROLE, admin);
    }

    // -----------------
    // Admin operations
    // -----------------

    function configureEvent(uint256 eventId, uint32 maxSupply) external onlyRole(EVENT_MANAGER_ROLE) {
        require(eventId != 0, "TicketNFT: invalid eventId");
        _eventConfigs[eventId] = EventConfig({maxSupply: maxSupply, exists: true});
        emit EventConfigured(eventId, maxSupply);
    }

    function configureTicketType(uint256 ticketTypeId, uint64 price) external onlyRole(EVENT_MANAGER_ROLE) {
        require(ticketTypeId != 0, "TicketNFT: invalid ticketTypeId");
        _ticketTypes[ticketTypeId] = TicketTypeConfig({price: price, exists: true});
        emit TicketTypeConfigured(ticketTypeId, price);
    }

    function setBaseURI(string calldata newBaseURI) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _baseTokenURI = newBaseURI;
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function setMinter(address newMinter) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        address previous = currentMinter;
        if (previous != address(0)) {
            _revokeRole(MINTER_ROLE, previous);
        }
        currentMinter = newMinter;
        if (newMinter != address(0)) {
            _grantRole(MINTER_ROLE, newMinter);
        }
        emit MinterUpdated(previous, newMinter);
    }

    function setOperator(address operator, bool enabled) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (enabled) {
            _grantRole(OPERATOR_ROLE, operator);
        } else {
            _revokeRole(OPERATOR_ROLE, operator);
        }
    }

    function setEventManager(address manager, bool enabled) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (enabled) {
            _grantRole(EVENT_MANAGER_ROLE, manager);
        } else {
            _revokeRole(EVENT_MANAGER_ROLE, manager);
        }
    }

    // -----------------
    // Mint & lifecycle
    // -----------------

    function mint(
        address to,
        uint256 eventId,
        uint256 ticketTypeId,
        bytes calldata seatInfoData
    ) external override onlyRole(MINTER_ROLE) whenNotPaused {
        require(!_eventCancelled[eventId], "TicketNFT: event cancelled");
        EventConfig memory config = _eventConfigs[eventId];
        require(config.exists, "TicketNFT: event missing");

        TicketTypeConfig memory typeConfig = _ticketTypes[ticketTypeId];
        require(typeConfig.exists, "TicketNFT: ticket type missing");

        if (config.maxSupply != 0) {
            require(_mintedPerEvent[eventId] < config.maxSupply, "TicketNFT: sold out");
        }

        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);

        _ticketInfo[tokenId] = TicketInfo({
            eventId: eventId,
            ticketTypeId: ticketTypeId,
            originalPrice: typeConfig.price,
            isUsed: false,
            refundClaimed: false
        });

        if (seatInfoData.length > 0) {
            _seatInfo[tokenId] = seatInfoData;
            emit SeatInfoUpdated(tokenId, seatInfoData);
        }

        _mintedPerEvent[eventId] += 1;

        emit TicketMinted(tokenId, eventId, to);
    }

    function markAsUsed(uint256 tokenId) external override onlyRole(OPERATOR_ROLE) {
        require(_ownerOf(tokenId) != address(0), "TicketNFT: nonexistent token");
        TicketInfo storage info = _ticketInfo[tokenId];
        require(!_eventCancelled[info.eventId], "TicketNFT: event cancelled");
        require(!info.isUsed, "TicketNFT: already used");
        info.isUsed = true;
        emit TicketUsed(tokenId, block.timestamp);
    }

    function cancelEvent(uint256 eventId) external override onlyRole(EVENT_MANAGER_ROLE) {
        require(!_eventCancelled[eventId], "TicketNFT: already cancelled");
        _eventCancelled[eventId] = true;
        emit EventCancelled(eventId, block.timestamp);
    }

    function markRefundClaimed(uint256 tokenId, uint256 amount) external onlyRole(EVENT_MANAGER_ROLE) {
        require(_ownerOf(tokenId) != address(0), "TicketNFT: nonexistent token");
        TicketInfo storage info = _ticketInfo[tokenId];
        require(!info.refundClaimed, "TicketNFT: refund claimed");
        info.refundClaimed = true;
        emit TicketRefunded(tokenId, amount);
    }

    function updateSeatInfo(uint256 tokenId, bytes calldata seatInfoData) external onlyRole(OPERATOR_ROLE) {
        require(_ownerOf(tokenId) != address(0), "TicketNFT: nonexistent token");
        _seatInfo[tokenId] = seatInfoData;
        emit SeatInfoUpdated(tokenId, seatInfoData);
    }

    // -----------------
    // View helpers
    // -----------------

    function ticketData(uint256 tokenId) external view override returns (TicketInfo memory) {
        require(_ownerOf(tokenId) != address(0), "TicketNFT: nonexistent token");
        return _ticketInfo[tokenId];
    }

    function seatInfo(uint256 tokenId) external view returns (bytes memory) {
        require(_ownerOf(tokenId) != address(0), "TicketNFT: nonexistent token");
        return _seatInfo[tokenId];
    }

    function eventCancelled(uint256 eventId) public view override returns (bool) {
        return _eventCancelled[eventId];
    }

    function mintedPerEvent(uint256 eventId) public view override returns (uint32) {
        return _mintedPerEvent[eventId];
    }

    function eventConfig(uint256 eventId) external view returns (EventConfig memory) {
        return _eventConfigs[eventId];
    }

    function ticketTypeConfig(uint256 ticketTypeId) external view returns (TicketTypeConfig memory) {
        return _ticketTypes[ticketTypeId];
    }

    // -----------------
    // Internal hooks
    // -----------------

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721Enumerable)
        whenNotPaused
        returns (address)
    {
        return super._update(to, tokenId, auth);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721Enumerable, AccessControlEnumerable)
        returns (bool)
    {
        return interfaceId == type(ITicketNFT).interfaceId || super.supportsInterface(interfaceId);
    }
}
