# My Tickets Experience Design

## Goal

Complete the attendee "Ve Cua Toi" experience for the first production-shaped milestone: a reliable ticket list and a usable ticket detail screen with backend-issued short-lived QR as the primary QR path.

## Scope

This scope includes:

- `/tickets` list view with trustworthy loading, empty, partial, and error states.
- `/ticket/:id` detail view reachable from each ticket card.
- Production QR path based on backend-issued short-lived QR payloads.
- A clearly labeled local/dev fallback only when backend QR cannot be issued but the app still has local or synced ownership evidence.
- Tests for ticket merging, detail lookup, QR payload handling, SDK API paths, and route-level behavior.

This scope excludes:

- Full staff scanner implementation.
- Offline venue mode with TOTP or per-ticket client secrets.
- Marketplace resale UX beyond preserving entry points and metadata needed later.
- Reworking checkin-service HMAC semantics.

## Current Context

The app already has `/tickets`, `TicketCard`, `useMyTickets`, ticket merging from ticketing-service, contract-sync, and local purchase metadata. `TicketCard` links to `/ticket/${id}`, but `App.tsx` has no `/ticket/:id` route. The SDK has `getMyTickets` and `listSyncedTokens`, but no `getTicket` or `createTicketQr`.

The ticketing-service already exposes `POST /tickets/:tokenId/qr` through the gateway as `POST /v1/tickets/:tokenId/qr`. It returns a QR payload with token, event, timestamp, nonce, wallet address, and signature. This endpoint is the production path. The web app should request this payload on the ticket detail page and refresh it per TTL, not every second.

## QR Architecture

The production path is backend-issued short-lived QR:

1. User opens `/ticket/:tokenId`.
2. Web resolves the ticket from the same merged ownership source as `/tickets`.
3. Web calls `POST /v1/tickets/:tokenId/qr` with `x-user-id`.
4. Backend validates ownership and ticket state, then returns a signed short-lived payload.
5. Web renders the payload as QR and runs a local countdown.
6. Near expiry, web requests the next payload.

The web app must not store a production QR signing secret. Any client-generated QR is a degraded local/dev fallback and must be visibly labeled `Local QR`.

## Data Model

Add a web-facing ticket view model that includes list card data plus fields required by the detail page:

- `id`
- `eventId`
- `eventName`
- `date`
- `time`
- `location`
- `ticketType`
- `tokenId`
- `ownerUserId`
- `ownerWalletAddress`
- `seatInfo`
- `reservationId`
- `createdAt`
- `source`: `ticketing`, `contract-sync`, or `local-cache`
- `syncStatus`: `ready`, `syncing`, or `partial`
- optional `transactionHash`

The list can continue to render compact cards, but detail should use the richer model.

## UI Design

### List

The list should remain mobile-first and operational:

- Sticky header with title and tabs.
- Dense ticket cards with tier badge, event name, time, venue, token short code, and sync/source status.
- Skeleton rows while loading.
- Empty state with CTA to Discover.
- Partial status strip when some services fail but real/local ticket data is available.
- Full fallback demo data only when no reliable ownership data can be loaded.

### Detail

The detail screen should act like a wallet pass:

- Header: back button, event name, short token id.
- Status strip: QR source (`Backend QR`, `Refreshing`, `Local QR`, `Expired`, `Unavailable`).
- Large fixed-size QR panel with high contrast.
- Countdown: "Lam moi sau Xs".
- Actions: refresh QR, copy token id, copy QR payload for debugging.
- Ticket facts: tier, date, location, token id, event id, owner wallet, reservation, transaction hash when available.
- Partial data is acceptable, but the UI must say what is missing instead of hiding the ticket.

## Error Handling

- If `/tickets/me` fails but contract-sync/local cache has data, show real tickets and mark partial.
- If event lookup fails, keep the ticket in upcoming with "Dang cap nhat" metadata.
- If backend QR fails but local metadata confirms ownership, render Local QR and keep retry available.
- If no ticket is found for `/ticket/:id`, show a not-found state with a link back to `/tickets`.
- QR refresh should stop when leaving the page.

## Testing

Tests should cover:

- Ticket merge precedence: ticketing data wins, contract-sync fills gaps, local cache fills recently purchased tokens.
- Detail lookup finds tickets from all ownership sources.
- QR payload serialization includes token, event, timestamp, nonce, wallet, signature, and source.
- Backend QR request uses `POST /v1/tickets/:tokenId/qr` and `x-user-id`.
- QR refresh does not call backend every second; countdown is local and refresh is per TTL.
- `/ticket/:id` route renders the detail component.

## Implementation Notes

Use existing React, React Query, Tailwind, and lucide patterns. Add a QR rendering dependency only if the repo has no QR renderer in web; `react-qr-code` is acceptable because it is already used in the sibling DID app and keeps implementation straightforward.

Avoid a broad redesign. Keep changes local to the attendee ticket flow and shared helpers needed by that flow.
