// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../src/Marketplace.sol";
import "../src/TicketNFT.sol";

/// @notice Echidna property harness for marketplace invariants.
contract MarketplaceProperties {
    TicketNFT internal ticket;
    Marketplace internal marketplace;

    address internal admin;
    address internal minter;
    address internal escrow;

    uint256 internal constant EVENT_ID = 1;
    uint256 internal constant TICKET_TYPE_ID = 1;
    uint64 internal constant ORIGINAL_PRICE = 100_000;

    constructor() {
        admin = address(this);
        minter = address(0xBEEF);
        escrow = address(0xE5C0);

        ticket = new TicketNFT("Ticket", "TIX", admin);
        ticket.setMinter(minter);
        ticket.configureEvent(EVENT_ID, 1000);
        ticket.configureTicketType(TICKET_TYPE_ID, ORIGINAL_PRICE);

        marketplace = new Marketplace(address(ticket), admin, address(0));
        marketplace.grantRole(marketplace.ESCROW_ROLE(), escrow);
    }

    function echidna_markup_bps_within_bounds() public view returns (bool) {
        uint16 bps = marketplace.maxMarkupBps();
        return bps >= marketplace.MIN_MARKUP_BPS() && bps <= marketplace.MAX_MARKUP_BPS();
    }

    function echidna_consumed_escrow_hash_never_clears(bytes32 hash) public view returns (bool) {
        if (!marketplace.consumedEscrowHashes(hash)) {
            return true;
        }
        return marketplace.consumedEscrowHashes(hash);
    }

    function echidna_escrow_hook_setter_stable(address maybeHook) public returns (bool) {
        marketplace.setEscrowHook(maybeHook);
        return marketplace.escrowHook() == maybeHook;
    }
}
