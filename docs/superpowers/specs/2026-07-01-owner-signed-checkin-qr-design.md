# Owner-Signed Check-In QR Design

## Summary

This spec replaces the current backend-HMAC ticket QR flow with an owner-signed
EIP-712 challenge-response flow for check-in.

The MVP product path is:

1. the buyer opens a ticket detail screen
2. the web app requests a short-lived check-in challenge for that specific ticket
3. the buyer's embedded wallet signs the challenge locally
4. the QR shown to gate staff contains the signed challenge payload
5. the check-in service verifies the EIP-712 signature, freshness, ownership,
   and replay constraints before accepting the scan

This design aligns the implementation with the thesis claim that admission proof
comes from the ticket owner's wallet rather than a backend-held QR secret.

## Goals

- Replace backend-HMAC QR signing with owner-signed EIP-712 QR signing.
- Keep the buyer flow centered on the existing ticket detail screen in `apps/web`.
- Preserve first-scan-wins semantics and replay protection in `checkin-service`.
- Keep gate verification fast and off-chain, with on-chain used-state updates
  remaining asynchronous.
- Reuse the existing embedded wallet/session model already present in the web app.

## Non-Goals

- Adding a new on-chain verifier contract for check-in in this phase.
- Requiring live RPC ownership reads during every gate scan.
- Introducing gate-specific QR scope in MVP.
- Extending the check-in signing flow to `apps/mobile` in this phase.
- Refactoring unrelated resale, refund, recovery, or dispute flows.

## Chosen Product Direction

### User Journey

The chosen buyer journey is:

1. Buyer opens `TicketDetailPage`.
2. Buyer taps the QR surface or enters the existing QR view for a specific ticket.
3. Frontend requests a backend-generated challenge for that `tokenId`.
4. Backend checks that the wallet in session is the current projected owner.
5. Frontend signs the challenge using the local embedded wallet private key.
6. Frontend renders a QR that encodes the typed challenge message and signature.
7. Gate staff scan the QR and submit it to `checkin-service`.
8. `checkin-service` verifies signature, freshness, replay constraints, gate
   validity, and projected ownership before recording the check-in.

This keeps the QR flow simple for the buyer while making the trust boundary
match the intended blockchain ownership model.

### Scope Choice

The chosen MVP scope for `gateScope` is:

- valid for the full event
- not restricted to a single gate

The challenge still contains `gateScope`, but for MVP it is a constant event-wide
scope rather than a gate-specific identifier. This keeps room for future gate
scoping without complicating current buyer UX.

## Security Model

### Trust Boundary

The new design deliberately splits trust across three roles:

- `ticketing-service` issues short-lived check-in challenges only after verifying
  that the caller is the projected owner of the ticket
- the buyer wallet proves possession of the owner private key by signing the
  challenge locally
- `checkin-service` independently verifies the signature and replay/freshness
  conditions before accepting a scan

The backend is no longer the signer of admission proof. The backend only issues
the challenge context and enforces eligibility rules before the user signs.

### Why EIP-712

EIP-712 is preferred over raw string signing because it provides:

- explicit domain separation
- typed message structure
- lower ambiguity across environments and future flows
- better alignment with the thesis language around typed wallet signatures

### Domain

The check-in signing domain should be:

- `name`: `EntrCheckIn`
- `version`: `1`
- `chainId`: current configured chain id
- `verifyingContract`: current `TicketLedger` contract address

Using `TicketLedger` as the verifying contract tightly binds the QR signature to
the deployed ticket ledger for the current environment. This prevents accidental
cross-environment reuse between localchain and Base testnet.

### Challenge Type

The EIP-712 primary type is:

- `CheckInChallenge`

Fields:

- `tokenId: uint256`
- `eventId: uint256`
- `ownerWallet: address`
- `gateScope: string`
- `nonce: bytes32`
- `issuedAt: uint256`
- `expiresAt: uint256`

### Why These Fields Matter

- `tokenId` binds the proof to one specific ticket.
- `eventId` binds the proof to one specific event.
- `ownerWallet` makes the expected signer explicit.
- `gateScope` reserves the policy boundary for future gate-scoped QR variants.
- `nonce` provides one-time replay resistance.
- `issuedAt` and `expiresAt` create a short validity window.

`chainId` and `verifyingContract` are carried by the EIP-712 domain rather than
the message body.

## Backend Design

### `ticketing-service`

`ticketing-service` remains the boundary that creates check-in challenges for a
ticket detail screen.

The current endpoint:

- `POST /tickets/:tokenId/qr`

will be retained as the public frontend entry point, but its behavior changes:

- today: returns backend-HMAC QR data
- new: returns a typed EIP-712 challenge payload for local wallet signing

The endpoint will:

1. authenticate user via `x-user-id`
2. read `ownerWalletAddress` from request/session context
3. resolve projected ownership from `contract-sync-service`
4. reject if the ticket does not exist, is refunded, or is not owned by the
   supplied wallet
5. build the event-scoped check-in challenge
6. return EIP-712 domain, types, primary type, message, and metadata needed for
   frontend signing

The service should not sign the challenge itself.

### `checkin-service`

`checkin-service` becomes the verifier of EIP-712 admission proof.

It must:

1. parse QR payload into `{domain, primaryType, types, message, signature}`
2. validate domain values against local configuration
3. check `expiresAt` and allowed clock skew
4. recover signer from typed-data signature
5. verify signer matches `message.ownerWallet`
6. confirm the current projected owner for `tokenId` still matches the signer
7. verify gate exists and belongs to the event
8. enforce first-scan-wins and nonce replay protection through DB constraints
9. enqueue asynchronous `markUsedBatch`

The check-in service must no longer depend on `QR_SIGNATURE_SECRET`.

### `contract-sync-service`

`contract-sync-service` remains the query layer for ownership projection.

For this phase, `ticketing-service` and `checkin-service` may continue using the
existing projection-backed integration pattern. No live on-chain ownership lookup
is required in the hot path.

## Frontend Design

### Ticket Detail Flow

The ticket detail page remains the entry point.

The updated frontend flow is:

1. request challenge from `POST /tickets/:tokenId/qr`
2. sign the returned typed data locally using the existing wallet/session key
3. serialize `{type, domain, message, signature}`
4. render that serialized payload as the visible QR value

This means `useTicketQr()` becomes a challenge-fetch plus typed-sign hook rather
than a direct backend-QR fetch hook.

### Local Wallet Signing

The web app already stores the buyer wallet private key in session/secure
storage. The same wallet signing foundation used for transaction authorization
should be extended to sign EIP-712 typed data for check-in.

The QR flow must not use a local fake fallback signature. If challenge creation
or signing fails, the UI should show a recoverable error state rather than emit a
best-effort placeholder QR.

### QR Refresh

Frontend should continue rotating the QR automatically.

The QR refresh cycle becomes:

1. fetch fresh challenge
2. sign fresh challenge
3. render fresh QR

The QR should refresh shortly before `expiresAt`.

## Data and Persistence

### Challenge Persistence

The backend does not need to persist every issued challenge for MVP if replay is
fully enforced on the verification side using the signed `nonce`.

However, the verifier must persist enough data to reject:

- reused nonce for the same event
- duplicate check-in for the same ticket and event

Existing `check_ins` uniqueness constraints already support this pattern.

### Nonce Requirements

The nonce must be:

- cryptographically random
- unique with overwhelming probability
- represented in a stable serialized format

Recommended representation:

- 32-byte random value encoded as hex

Avoid timestamp-only or deterministic nonce generation.

## Error Handling

### Buyer-Facing

Frontend should surface clear retryable states for:

- challenge generation failed
- wallet signing unavailable
- ownership projection unavailable
- QR expired before scan

### Gate-Facing

`checkin-service` should distinguish:

- invalid payload
- domain mismatch
- signature invalid
- QR expired
- owner mismatch
- nonce replayed
- already used
- gate not found
- gate inactive

These reasons are operationally useful for organizer analytics and support.

## Testing Strategy

Required coverage:

- unit tests for challenge serialization and typed-data construction
- unit tests for signature verification and signer recovery
- integration tests for `ticketing-service` challenge issuance
- integration tests for `checkin-service` valid scan, replay rejection, expiry
  rejection, and owner mismatch
- end-to-end update of the existing Flow 4 check-in test so it uses owner-signed
  EIP-712 QR instead of HMAC

## Rollout Sequence

1. add typed challenge issuance in `ticketing-service`
2. add frontend typed signing and QR serialization
3. add EIP-712 verification in `checkin-service`
4. remove HMAC QR generation and verification
5. update tests and docs

## Open Decisions Resolved

- QR entry point: ticket detail screen
- token identity source: `tokenId` from request path after explicit ticket
  selection by the buyer
- gate scope in MVP: full event scope
- ownership source for verification: `contract-sync` projection
- signature scheme: owner-signed EIP-712 typed data
