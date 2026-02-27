# Ticket Platform - System Architecture Document

> **Project**: Blockchain-Based Event Ticketing Platform  
> **Version**: 0.1 (Draft)  
> **Date**: 2026-02-16  
> **Owner**: Architecture Guild

---

## Table of Contents
1. [Architecture Goals & Constraints](#architecture-goals--constraints)
2. [System Context](#system-context)
3. [Logical Architecture](#logical-architecture)
4. [Runtime Component Model](#runtime-component-model)
5. [Key Data Stores & Schemas](#key-data-stores--schemas)
6. [Relational Schema Specification](#relational-schema-specification)
7. [Smart Contract Suite](#smart-contract-suite)
8. [Core Interaction Sequences](#core-interaction-sequences)
9. [Infrastructure & DevOps Pipeline](#infrastructure--devops-pipeline)
10. [Security Architecture Alignment](#security-architecture-alignment)
11. [Observability & Operations](#observability--operations)
12. [Scalability & Performance Considerations](#scalability--performance-considerations)
13. [Future Enhancements & Open Questions](#future-enhancements--open-questions)

---

## Architecture Goals & Constraints

| Goal | Description | Drivers |
|------|-------------|---------|
| G1 | Deliver seamless ticket purchase + blockchain-backed authenticity | MVP promise, differentiation |
| G2 | Abstract crypto UX using embedded wallets & sponsored gas | Mainstream VN consumer adoption |
| G3 | Enforce anti-scalping via purchase caps, KYC gating, and escrow | Organizer trust, regulatory friendliness |
| G4 | Support real-time check-in with cryptographic QR verification | Venue operations, fraud prevention |
| G5 | Operate within VN compliance (VND-only payments, data residency) | Legal, payment partnerships |
| G6 | Provide modular components to pivot off-chain if required | Regulatory contingency |

**Constraints**
- Mobile apps must run on React Native with OTA update path.
- Backend stack: Node.js + TypeScript + Express, PostgreSQL 15.
- Blockchain: Base L2 (EVM) with ERC-4337 account abstraction via Privy wallets.
- Payments: Momo primary, VNPAY backup; both via webhook confirmations.
- All personal data stored in VN-based cloud region (AWS ap-southeast-1 or Viettel Cloud equivalent).

---

## System Context

```
                           +---------------------+
                           |   Event Organizers   |
                           |  (Admin Portal)      |
                           +----------+----------+
                                      |
                                      | REST + OAuth
                                      v
+-----------+      HTTPS       +------+--------+       HTTPS/MQ       +----------------+
| Mobile    |<---------------->|  API Gateway |<-------------------->| Internal Tools |
| Apps (RN) |                  +------+--------+                     | (Support, BI)  |
+-----------+                         |                               +----------------+
      |                                |
      | Embedded wallet SDK            | Routes to services / queues
      v                                v
+-----------+   gRPC/HTTPS   +---------------------+      Webhooks      +-----------------+
| Privy     |<-------------->| Backend Services    |<------------------>| Payment Gateways |
| Wallets   |                | (Auth, Ticketing,   |                    | (Momo, VNPAY)    |
+-----------+                | Marketplace, Check) |                    +-----------------+
                             +----------+----------+
                                        |
                                        | JSON-RPC / Relayer
                                        v
                                +---------------+
                                | Base L2 Chain |
                                +---------------+
```

Key external systems: Privy, Base RPC, Paymaster, KYC provider (FPT.AI), SMS/OTP (Twilio/Infobip), analytics (Segment), logging (Datadog/New Relic).

---

## Logical Architecture

| Layer | Components | Responsibilities |
|-------|------------|------------------|
| Experience | React Native App (Buyer/Seller), Organizer Web Portal, Staff Check-in App | UI flows, biometric unlock, QR display, scanning, organizer dashboards |
| Edge | API Gateway (Kong/NGINX), CDN (CloudFront) | Request routing, auth enforcement, caching, WAF |
| Application Services | Auth Service, User Profile Service, Ticketing Service, Marketplace Service, Payment Orchestrator, Check-in Service, Notification Service | Core business logic, state machines, external API orchestration |
| Data & Messaging | PostgreSQL cluster, Redis cache, Kafka/SQS queues, Object Storage (S3-compatible) | Durable persistence, caching, async workflows, media storage |
| Blockchain & Wallet | TicketNFT contract, Marketplace contract, Paymaster, Guardian Service, Privy Wallet API | NFT lifecycle, account abstraction, gas sponsorship |
| Observability & Ops | Prometheus, Loki, Datadog APM, PagerDuty, Feature Flag service | Metrics, tracing, alerting, feature gating |

---

## Runtime Component Model

### Component Diagram

```
+----------------------------------------------------------------------------------+
|                                Application Network                               |
|                                                                                  |
|  +-----------------------+           +-------------------------+                 |
|  |  React Native Client  |<--------->|  API Gateway / WAF      |                 |
|  |  (Buyer/Seller)       |  HTTPS    |  (Kong)                 |                 |
|  +----------+------------+           +----+--------------------+                 |
|             |                             |                                        |
|             | GraphQL/REST                 | Internal mTLS                          |
|             v                             v                                        |
|     +-------+--------+          +---------+-----------+                            |
|     |  BFF / Edge     |          |  Auth & User Svc   |<-----> Redis (sessions)    |
|     |  (Apollo/Express)|         +---------+-----------+                            |
|     +-------+--------+                    |                                         |
|             |                             | gRPC                                    |
|             v                             v                                         |
|   +---------+----------+        +---------+-----------+      +------------------+    |
|   | Ticketing Service  |<-----> | Payment Orchestrator |<--->| Payment Webhook  |    |
|   +---------+----------+  gRPC  +---------+-----------+      +------------------+    |
|             |                             |                                         |
|             |                             | Emits events                            |
|             v                             v                                         |
|   +---------+----------+        +---------+-----------+      +------------------+    |
|   | Marketplace Svc    |<-----> | Check-in Service    |<---> | Staff Scanner App|    |
|   +---------+----------+        +---------+-----------+      +------------------+    |
|             |                             |                                         |
|             v                             v                                         |
|        PostgreSQL (RDS)           Queues (Kafka/SQS)                                 |
|             |                             |                                         |
|             +-----------------------------+--------------------------+              |
|                                           |                          |              |
|                                           v                          v              |
|                                   Worker Fleet                Notification Svc       |
|                                   (Mint, Refund, Recovery)     (SES/SMS)            |
+----------------------------------------------------------------------------------+

External Connectors: Privy Wallet API (REST), Base RPC (JSON-RPC), Paymaster (4337 bundler), eKYC provider, Momo/VNPAY.
```

### Deployment Groups
- **Edge Tier**: CloudFront CDN + regional API Gateway (active-active).
- **App Tier**: Stateless Node.js containers on AWS ECS/Fargate or Kubernetes, autoscaled via CPU/RPS.
- **Worker Tier**: Separate queue consumer deployments (mint-worker, refund-worker, notification-worker).
- **Data Tier**: PostgreSQL primary + replica, Redis cluster, Kafka/SQS for events, S3 for media/logs.
- **Blockchain Tier**: Managed RPC provider (QuickNode/Alchemy) plus fallback self-hosted Base node; custom Paymaster & bundler service.

---

## Key Data Stores & Schemas

| Store | Technology | Purpose | Notes |
|-------|------------|---------|-------|
| `users`, `devices`, `recovery_requests` | PostgreSQL | Account state, device fingerprints, freeze flags | Encryption at rest + row-level security for support views |
| `events`, `ticket_types`, `tickets` | PostgreSQL | Primary ticket inventory | Ticket table keyed by `token_id`, stores seat, status, ownership cache |
| `listings`, `purchases`, `escrow_accounts` | PostgreSQL | Resale marketplace state | Includes audit fields and listing lifecycle timestamps |
| `payments`, `refund_requests`, `webhook_events` | PostgreSQL | Payment evidence + reconciliation | `webhook_events` ensures idempotency with digest + status |
| `check_ins` | PostgreSQL | Atomic check-in log (gate, nonce, device) | Backed by unique constraint `(token_id, used_at IS NULL)` |
| Redis | Redis 7 | Session cache, OTP rate limiting, rotating QR session tokens | TTL-managed, backup disabled for OTP store |
| Object Storage | S3-compatible | KYC images, event media | Server-side encryption + lifecycle rules |
| Analytics Lake | S3 + Athena | De-identified behavioral data | PIIs stripped before ingestion |

---

## Relational Schema Specification

Guiding principles: strict referential integrity, immutable audit columns (`created_at`, `updated_at`, `version`), and composite indexes tuned for hot paths (reservations, check-ins, listings).

### User & Identity Domain

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number VARCHAR(15) NOT NULL UNIQUE,
  email VARCHAR(255),
  full_name VARCHAR(120),
  wallet_address BYTEA NOT NULL UNIQUE,
  country_code CHAR(2) DEFAULT 'VN',
  kyc_status VARCHAR(20) DEFAULT 'pending',
  is_frozen BOOLEAN DEFAULT false,
  frozen_at TIMESTAMP,
  freeze_reason VARCHAR(50),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_users_email_not_null ON users(email) WHERE email IS NOT NULL;

CREATE TABLE user_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_fingerprint VARCHAR(255) NOT NULL,
  device_name VARCHAR(100),
  platform VARCHAR(20),
  is_current BOOLEAN DEFAULT true,
  last_active_at TIMESTAMP,
  revoked_at TIMESTAMP,
  revoked_reason VARCHAR(50),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, device_fingerprint)
);
CREATE INDEX idx_user_devices_current ON user_devices(user_id) WHERE is_current = true;

CREATE TABLE kyc_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(30) NOT NULL,
  status VARCHAR(20) NOT NULL,
  cccd_number VARCHAR(20),
  reviewed_by VARCHAR(50),
  reviewed_at TIMESTAMP,
  payload_hash BYTEA NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE recovery_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_type VARCHAR(20) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  phone_verified BOOLEAN DEFAULT false,
  email_verified BOOLEAN DEFAULT false,
  hold_expires_at TIMESTAMP,
  new_device_fingerprint VARCHAR(255),
  initiated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP,
  failure_reason TEXT
);
CREATE INDEX idx_recovery_active ON recovery_requests(user_id)
  WHERE status IN ('pending','hold');
```

### Event & Ticketing Domain

```sql
CREATE TABLE venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(160) NOT NULL,
  address TEXT NOT NULL,
  city VARCHAR(80) NOT NULL,
  capacity INTEGER CHECK (capacity > 0),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id UUID NOT NULL REFERENCES users(id),
  venue_id UUID NOT NULL REFERENCES venues(id),
  title VARCHAR(200) NOT NULL,
  description TEXT,
  start_at TIMESTAMP NOT NULL,
  end_at TIMESTAMP NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  refund_window_ends_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  cancellation_reason TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CHECK (end_at > start_at)
);
CREATE INDEX idx_events_organizer ON events(organizer_id);
CREATE INDEX idx_events_start ON events(start_at);

CREATE TABLE ticket_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  price_cents BIGINT NOT NULL CHECK (price_cents >= 0),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  sold_count INTEGER DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_ticket_types_event ON ticket_types(event_id);

CREATE TABLE tickets (
  token_id BIGINT PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(id),
  ticket_type_id UUID NOT NULL REFERENCES ticket_types(id),
  owner_id UUID NOT NULL REFERENCES users(id),
  owner_address BYTEA NOT NULL,
  seat_info VARCHAR(80),
  original_price_cents BIGINT NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  is_used BOOLEAN DEFAULT false,
  used_at TIMESTAMP,
  used_by_gate UUID,
  check_in_nonce UUID,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_tickets_owner ON tickets(owner_id);
CREATE INDEX idx_tickets_event_status ON tickets(event_id, status);
CREATE UNIQUE INDEX idx_tickets_active_unique ON tickets(token_id)
  WHERE status = 'active';

CREATE TABLE reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_type_id UUID NOT NULL REFERENCES ticket_types(id),
  user_id UUID NOT NULL REFERENCES users(id),
  quantity SMALLINT NOT NULL CHECK (quantity BETWEEN 1 AND 4),
  status VARCHAR(20) DEFAULT 'pending',
  expires_at TIMESTAMP NOT NULL,
  payment_intent_id VARCHAR(64),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_reservations_active ON reservations(ticket_type_id, status)
  WHERE status IN ('pending','paid');
```

### Marketplace & Escrow Domain

```sql
CREATE TABLE listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id BIGINT NOT NULL REFERENCES tickets(token_id),
  seller_id UUID NOT NULL REFERENCES users(id),
  price_cents BIGINT NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  expires_at TIMESTAMP,
  listed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  cancelled_at TIMESTAMP
);
CREATE UNIQUE INDEX idx_listings_ticket_active ON listings(ticket_id)
  WHERE status = 'active';

CREATE TABLE purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings(id),
  buyer_id UUID NOT NULL REFERENCES users(id),
  payment_id UUID NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  completed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_purchases_buyer_status ON purchases(buyer_id, status);

CREATE TABLE escrow_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id UUID NOT NULL UNIQUE,
  listing_id UUID NOT NULL REFERENCES listings(id),
  payment_id UUID NOT NULL REFERENCES payments(id),
  token_id BIGINT NOT NULL REFERENCES tickets(token_id),
  seller_id UUID NOT NULL REFERENCES users(id),
  buyer_id UUID NOT NULL REFERENCES users(id),
  gross_amount BIGINT NOT NULL,
  seller_amount BIGINT NOT NULL,
  platform_fee BIGINT NOT NULL,
  organizer_royalty BIGINT NOT NULL,
  escrow_data BYTEA NOT NULL,
  escrow_data_hash BYTEA NOT NULL UNIQUE,
  escrow_data_version SMALLINT NOT NULL DEFAULT 1,
  backend_signature BYTEA NOT NULL,
  backend_signer VARCHAR(42) NOT NULL,
  signed_at TIMESTAMP NOT NULL,
  submit_tx_hash CHAR(66),
  confirm_tx_hash CHAR(66),
  status VARCHAR(20) DEFAULT 'pending',
  failure_reason TEXT,
  released_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_escrow_status ON escrow_transfers(status);
```

### Payments & Refunds Domain

```sql
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  reservation_id UUID REFERENCES reservations(id),
  ticket_id BIGINT REFERENCES tickets(token_id),
  amount_cents BIGINT NOT NULL,
  currency CHAR(3) DEFAULT 'VND',
  method VARCHAR(20) NOT NULL,
  gateway VARCHAR(20) NOT NULL,
  gateway_reference VARCHAR(80) NOT NULL,
  status VARCHAR(20) DEFAULT 'initiated',
  confirmed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(gateway, gateway_reference)
);
CREATE INDEX idx_payments_user_status ON payments(user_id, status);

CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway VARCHAR(20) NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  payload_hash BYTEA NOT NULL,
  received_at TIMESTAMP NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMP,
  status VARCHAR(20) DEFAULT 'pending',
  UNIQUE(gateway, payload_hash)
);
CREATE INDEX idx_webhook_status ON webhook_events(status);

CREATE TABLE refund_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id BIGINT NOT NULL REFERENCES tickets(token_id),
  user_id UUID NOT NULL REFERENCES users(id),
  payment_id UUID REFERENCES payments(id),
  refund_amount BIGINT NOT NULL,
  refund_method VARCHAR(20),
  status VARCHAR(20) DEFAULT 'pending',
  requested_at TIMESTAMP NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMP,
  completed_at TIMESTAMP,
  failure_reason TEXT
);
CREATE INDEX idx_refund_status ON refund_requests(status);
```

### Check-in, Support & Logging Domain

```sql
CREATE TABLE check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id BIGINT NOT NULL REFERENCES tickets(token_id),
  gate_id UUID NOT NULL,
  staff_id UUID NOT NULL REFERENCES users(id),
  scanned_at TIMESTAMP NOT NULL DEFAULT NOW(),
  qr_nonce UUID NOT NULL,
  result VARCHAR(20) NOT NULL,
  UNIQUE(ticket_id, result) WHERE result = 'success'
);
CREATE INDEX idx_check_ins_gate ON check_ins(gate_id, scanned_at DESC);

CREATE TABLE disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id BIGINT REFERENCES tickets(token_id),
  filed_by UUID NOT NULL REFERENCES users(id),
  category VARCHAR(30) NOT NULL,
  status VARCHAR(20) DEFAULT 'open',
  current_tier SMALLINT DEFAULT 1,
  resolution TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_disputes_status ON disputes(status);

CREATE TABLE dispute_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id UUID NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
  sender_type VARCHAR(20) NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE goodwill_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  dispute_id UUID REFERENCES disputes(id),
  amount_cents BIGINT NOT NULL,
  expires_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_goodwill_active ON goodwill_credits(user_id)
  WHERE expires_at IS NULL OR expires_at > NOW();
```

These definitions will be codified via Prisma/Knex migrations with automated lint checks ensuring every foreign key has an associated index, and each enum-like column is backed by database constraints or PostgreSQL enums where practical.

---

## Smart Contract Suite

### Architecture Overview

- Contracts reside on Base L2; upgradeability managed via transparent proxy controlled by a 3-of-5 Safe (Platform Eng + Biz Ops + Security).
- Core contracts (TicketNFT + Marketplace) deployed once per environment; parameters (price caps, minters, paymasters) configurable via governance functions throttled by timelock (12h staging, 48h prod).
- Off-chain services (Mint Worker, Marketplace Service, Recovery Service) interact through minimal method surface to reduce attackable code.

| Contract | Purpose | Access Control |
|----------|---------|----------------|
| `TicketNFT` | Primary minting, ownership cache, usage flags, event cancellation state | Roles: `DEFAULT_ADMIN_ROLE`, `MINTER_ROLE`, `OPERATOR_ROLE` |
| `Marketplace` | Custody + resale, price cap enforcement, escrow hooks | Roles: `DEFAULT_ADMIN_ROLE`, `ESCROW_ROLE` (backend), `PAUSER_ROLE` |
| `Paymaster/Bundler` | Sponsors user ops (ERC-4337) with policy enforcement | Owned by Safe; backend signs session policies |
| `GuardianAccount` (ERC-4337) | User smart wallets with recovery delay | Guardian = platform contract; owner = embedded wallet key |

### TicketNFT Contract

Key storage layout:
```solidity
struct TicketInfo {
    uint256 eventId;
    uint256 ticketTypeId;
    uint64 originalPrice;
    bool isUsed;
    bool refundClaimed;
}
mapping(uint256 => TicketInfo) public ticketData;
mapping(uint256 => bool) public eventCancelled;
mapping(uint256 => uint32) public mintedPerEvent;
```

Function surface:
| Function | Description | Checks/Invariants |
|----------|-------------|-------------------|
| `mint(address to, uint256 eventId, uint256 ticketTypeId, bytes seatInfo)` | Mint NFT to embedded wallet after payment | `msg.sender` ∈ `MINTER_ROLE`; `mintedPerEvent < ticketType.supply`; `event.status = active` |
| `markAsUsed(uint256 tokenId)` | Flag ticket post check-in batch | Only `OPERATOR_ROLE`; reverts if already used or event cancelled |
| `cancelEvent(uint256 eventId)` | Organizer/platform cancels event | Callable by Safe or event organizer contract; emits `EventCancelled` |
| `setMinter(address)` | Update backend allowed minter | Admin-only, emits `MinterUpdated` |

Events:
```
event TicketMinted(uint256 indexed tokenId, uint256 indexed eventId, address indexed owner);
event TicketUsed(uint256 indexed tokenId, uint256 usedAt);
event EventCancelled(uint256 indexed eventId, uint256 cancelledAt);
event TicketRefunded(uint256 indexed tokenId, uint256 amount);
```

Gas optimizations: use OZ ERC721A-style sequential token IDs; pack `TicketInfo` struct (use `uint64` for price, `uint32` counters). Pause guard toggled if audit finds critical issue.

### Marketplace Contract

Responsibilities: custody NFT during listing, enforce markup cap (110-120%), enforce resale cutoff/count/KYC policy, trigger escrow release.

Key storage:
```solidity
struct Listing {
    address seller;
    uint256 price;
    bool active;
    uint64 expiresAt;
}
mapping(uint256 => Listing) public listings;
uint16 public maxMarkupBps = 12000;
address public escrowHook; // backend webhook signer
```

Flow summary:
1. `listForSale(tokenId, price, expiresAt)` requires caller = owner, price ≤ `originalPrice * maxMarkupBps / 10000`, and valid expiry. Transfers NFT to contract and records listing.
2. `cancelListing(tokenId)` returns NFT if `msg.sender` = seller or backend (e.g., event cancellation).
3. `completeSale(tokenId, buyer, bytes calldata escrowData)` callable by `ESCROW_ROLE` after fiat confirmation; transfers NFT to buyer and emits payout splits consumed by backend.

Policy overlay (see `docs/product/POLICY_MATRIX.md`):
- Resale create/purchase cutoff at `T-30 minutes` before event start (`Asia/Ho_Chi_Minh`).
- Active listings auto-cancel at cutoff.
- Seller-provided `expiresAt` cannot exceed cutoff.
- Maximum 2 resale cycles per ticket.
- KYC enforced for acting user when resale amount >= `5,000,000 VND`.
- Payout split fixed at seller/platform/organizer = `90/5/5`.

#### EscrowData Payload Specification (V1)

Canonical payload type:
```solidity
// Encoded with abi.encode in exact field order below.
struct EscrowSettlementPayloadV1 {
  uint8 version;              // = 1
  bytes16 settlementId;       // UUID binary
  bytes16 listingId;          // UUID binary
  bytes16 paymentId;          // UUID binary
  uint256 tokenId;
  address seller;
  address buyer;
  uint128 grossAmount;        // minor units (existing *_cents convention)
  uint128 sellerAmount;       // minor units
  uint128 platformFee;        // minor units
  uint128 organizerRoyalty;   // minor units
  bytes3 currency;            // "VND"
  uint8 gateway;              // enum in backend: 1=MOMO, 2=VNPAY
  bytes32 gatewayReferenceHash;
  uint64 settledAt;           // unix seconds
  bytes32 nonce;              // unique per settlement
}
```

Encoding and serialization rules:
1. `escrowData = abi.encode(EscrowSettlementPayloadV1)` in the exact field order above.
2. Signature material is out-of-band; do not include backend signature bytes in `escrowData`.
3. UUIDs are serialized to binary `bytes16` before encoding.
4. `gatewayReferenceHash = keccak256(bytes(gateway_reference))` in backend canonicalization.

#### EscrowData Validation Rules

Before submitting `completeSale`, backend must enforce:
1. `version == 1` and `currency == "VND"`.
2. `seller`, `buyer`, `tokenId`, and `listingId` match the active listing snapshot being settled.
3. `grossAmount == sellerAmount + platformFee + organizerRoyalty`.
4. `paymentId` references a `payments` row in `confirmed` status.
5. `nonce` is unique in backend settlement ledger.
6. `escrowDataHash = keccak256(escrowData)` is reserved as idempotency key before transaction submit.

#### Backend Integrity Model

Settlement integrity controls:
1. Backend signs `escrowDataHash` using the private key corresponding to `escrowHook` (EIP-191 message signing).
2. Store signature evidence in settlement ledger/audit fields: `backend_signature`, `backend_signer`, `signed_at`.
3. Verify recovered signer address equals `escrowHook` before calling `completeSale`.
4. On-chain replay guard remains hash-based (`keccak256(escrowData)` consumed once).

#### Internal Backend Settlement API Contract

Endpoint:
```text
POST /internal/marketplace/settlements/finalize
```

Request contract:
```json
{
  "version": 1,
  "settlementId": "uuid",
  "listingId": "uuid",
  "paymentId": "uuid",
  "tokenId": "12345",
  "seller": "0x...",
  "buyer": "0x...",
  "grossAmount": "120000",
  "sellerAmount": "108000",
  "platformFee": "6000",
  "organizerRoyalty": "6000",
  "currency": "VND",
  "gateway": 1,
  "gatewayReference": "gateway-ref",
  "settledAt": 1739400000,
  "nonce": "0x..."
}
```

Response contract:
```json
{
  "settlementId": "uuid",
  "escrowDataHash": "0x...",
  "submitTxHash": "0x...",
  "status": "submitted"
}
```

Idempotency:
1. Client sends `Idempotency-Key: <escrowDataHash>`.
2. Backend enforces uniqueness via `escrow_transfers.escrow_data_hash`.

Events:
```
event Listed(uint256 indexed tokenId, address indexed seller, uint256 price);
event ListingCancelled(uint256 indexed tokenId, address indexed seller, string reason);
event SaleCompleted(uint256 indexed tokenId, address indexed seller, address indexed buyer, uint256 price);
```

Security controls:
- Reentrancy guard on state mutating functions.
- `escrowData` uses canonical ABI v1 payload and hash-based replay prevention.
- Backend signature is out-of-band and validated against `escrowHook` before submit.
- Resale policy matrix enforcement for cutoff, payout split, transfer count, and KYC threshold.

### Paymaster / Bundler

- Implements ERC-4337 `IPaymaster`; validates user ops by checking session token signature from backend (contains max gas, expiry, allowed call target).
- Deducts gas budget from per-user daily allowance stored off-chain; on-chain guard ensures `contextHash` matches off-chain expectation to prevent mismatched settlement.
- Bundler monitors mempool for relevant ops, prioritizes check-in/listing operations to guarantee UX.

Pseudo-flow:
```
function validatePaymasterUserOp(UserOperation calldata op, bytes32, uint256) external returns (bytes memory context, uint256 validationData) {
    Session memory session = decode(op.paymasterAndData);
    require(session.expiry > block.timestamp, "expired");
    require(validSignature(session), "bad sig");
    require(allowedTarget(op.callData), "target");
    return (abi.encode(session.user, op.callGasLimit), 0);
}
```

### Guardian / Recovery Account

- User wallets follow ERC-4337 modular account with guardian set to platform contract.
- Recovery sequence: backend calls `initiateRecovery(newOwner)`; contract stores timestamp + pending owner, freezes outgoing transfers via modifier. After `RECOVERY_DELAY`, backend completes rotation unless user cancels (`onlyOwner`).
- Each wallet exposes view `isRecoveryPending()` so mobile app can warn user; backend tracks events for auditing.

### Contract Interaction Diagram

```
Mint Worker ---> TicketNFT.mint()
Marketplace Svc ---> TicketNFT.transferFrom() ---> Marketplace custody
Payment Orchestrator ---> Marketplace.completeSale() ---> Escrow Hook (off-chain)
Check-in Worker ---> TicketNFT.markAsUsed()
Recovery Service ---> GuardianAccount.initiateRecovery() / completeRecovery()
Paymaster ---> validates EOAs/Smart wallets for user ops
```

### Testing & Verification Plan

| Layer | Tooling | Scope |
|-------|---------|-------|
| Unit | Foundry + forge-std | Ticket mint/burn, listing lifecycle, recovery timers |
| Property-based | Echidna | Price-cap enforcement, escrow invariants, guardian delay |
| Fuzz | Foundry Fuzz | Reentrancy attempts, concurrent completeSale/cancelListing |
| Integration | Hardhat + forked Base | End-to-end payment→mint + listing purchase |
| Audit | External (Trail of Bits / PeckShield) | Focus on marketplace custody + paymaster |

#### Escrow Settlement Test Matrix

| Scenario | Expected Result | Suggested Layer |
|----------|-----------------|-----------------|
| Deterministic ABI encoding produces stable bytes/hash for same input (golden vectors) | Same payload input always yields identical `escrowData` and `escrowDataHash` | Unit (backend serializer) |
| Amount split mismatch (`grossAmount` != sum of components) | Validation failure before chain submit | Unit |
| Listing/entity mismatch (`listingId`/`tokenId`/`seller`/`buyer`) | Validation failure before chain submit | Unit + Integration |
| Duplicate `escrowDataHash` submitted | Backend rejects as duplicate idempotency key | Unit + Integration |
| Replay of identical `escrowData` on-chain | `completeSale` reverts on consumed hash | Integration + Property-based |
| Signature recovers to address different from `escrowHook` | Backend rejects settlement and stores failure reason | Unit |
| Duplicate webhook/payment callback for same payment | No new settlement row, existing settlement returned | Integration |
| Submit tx fails and backend retries | No double transfer, idempotency preserved across retries | Integration + Fuzz |

#### Verification Schedule & Artifact Links

| Task | Tooling / Partner | Owner | Target Window (2026) | Expected Artifact |
|------|-------------------|-------|----------------------|-------------------|
| V1 | Foundry unit suite (`forge test`) covering TicketNFT + Marketplace primitives | Smart Contract Eng | Feb 23-27 | `planning/contracts/reports/foundry-unit-report.md` |
| V2 | Echidna property tests for markup cap, escrow invariants, guardian delay | Security Eng | Mar 2-6 | `planning/contracts/reports/echidna-properties.md` |
| V3 | Foundry fuzz harness (reentrancy + concurrent sale/cancel) | Smart Contract Eng | Mar 9-11 | `planning/contracts/reports/foundry-fuzz-log.md` |
| V4 | Hardhat forked-Base integration sim (payment→mint→resale) | Backend + Chain Team | Mar 12-14 | `planning/contracts/reports/hardhat-integration.md` |
| V5 | External audit (Trail of Bits requested, PeckShield fallback) | Vendor Security | Mar 23-Apr 3 | `planning/contracts/reports/audit-summary.pdf` + vendor full report |
| V6 | Remediation verification & sign-off meeting | Product + Security | Apr 6 | Minutes appended to `planning/contracts/reports/audit-remediation.md` |

Each artifact path above will be updated with the actual report immediately after the task completes, and hyperlinks here will be kept current so stakeholders can trace readiness before implementation is approved.

Deployment safeguards: `simulate` script before promote, `pause` + `upgrade` runbooks documented, on-chain monitoring via Forta/Blocknative for anomalous mint/list events.

---

## Core Interaction Sequences

### 1. Registration + Wallet Provisioning

```
User -> Mobile App -> Auth Service -> OTP Provider
User -> Mobile App -> Privy SDK -> Privy API -> TicketNFT (no action yet)
Auth Service -> User Service -> PostgreSQL (create user, wallet_addr)
Auth Service -> Notification Svc -> SMS (welcome)
```
Key safeguards: OTP 5/15 min limit, device fingerprint storage, Privy attestation.

### 2. Payment → Minting Flow

```
1. App calls Ticketing Service `POST /reservations` (locks inventory + 15 min TTL).
2. Ticketing Service creates reservation row + emits `reservation.created` to queue.
3. App redirects user to Momo/VNPAY; Payment Orchestrator tracks `reservation_id`.
4. Gateway sends webhook → API Gateway (signature verified) → Payment Orchestrator.
5. Payment Orchestrator marks reservation paid, enqueues `mint.ticket` job.
6. Mint Worker uses platform minter key (via KMS) to call `TicketNFT.mint`.
7. Worker updates `tickets` + sends push notification; failure triggers retry + support queue.
```

### 3. Resale Listing & Purchase

```
Seller App -> Marketplace Svc (biometric-signed request)
Marketplace Svc -> TicketNFT (transfer to contract) -> updates `listings`
Buyer App -> Marketplace Svc -> Payment Orchestrator -> gateway
Webhook confirmed -> Payment Orchestrator -> Marketplace Svc
Marketplace Svc assembles EscrowSettlementPayloadV1 -> abi.encode -> escrowData
Marketplace Svc computes escrowDataHash -> signs hash -> persists escrow ledger
Marketplace Svc submits `completeSale(tokenId, buyer, escrowData)`
Marketplace Svc records submit tx hash/finality -> releases payout via banking API
```
Controls: price cap enforced on-chain, escrow ledger, seller KYC validation hook.

### 4. Check-in & Verification

```
Attendee App -> Embedded Wallet session -> Generates signed QR every 3s
Staff Scanner App -> Check-in API `/verify-ticket`
Check-in Service -> PostgreSQL `UPDATE ... WHERE used_at IS NULL RETURNING ...`
Check-in Service -> Queue `markUsed` -> Worker -> TicketNFT `markAsUsed`
Check-in Service -> Response (green/red) within 100ms p95
```
Key attributes: gate ID logged, nonce stored, asynchronous blockchain sync.

### 5. Account Recovery

```
User (web) -> Recovery Service -> freeze account, create recovery request
Recovery Service -> Guardian Contract `initiateRecovery`
After hold, Recovery Service verifies dual-channel OTP -> Guardian `completeRecovery`
Recovery Service -> User Devices table update -> send notifications
```

---

## Infrastructure & DevOps Pipeline

| Area | Choice | Notes |
|------|--------|-------|
| Hosting | AWS (primary), Viettel Cloud DR | Meets VN residency; DR sync nightly |
| Container Platform | AWS ECS on Fargate | Simplifies ops; blue/green deploy via CodeDeploy |
| IaC | Terraform + Terragrunt | Separate stacks per environment (dev/stage/prod) |
| CI/CD | GitHub Actions -> CodeBuild | Steps: lint/tests → contract compilation → image build → deploy |
| Secrets Mgmt | AWS Secrets Manager + KMS | Rotated quarterly; short-lived IAM roles |
| Blockchain Ops | Dedicated bundler & paymaster pods, metrics exported via Prometheus | Auto-pauses when budget exceeded |
| Backups | PostgreSQL PITR + nightly snapshot; S3 versioning for KYC artifacts | Restore runbooks documented |

---

## Security Architecture Alignment

Highlights from threat modeling:
- Zero trust edge: mTLS between gateway and services, JWT from Auth Svc, feature flags to kill risky flows.
- Privileged access: admin/staff portals behind SSO + hardware-backed MFA; RBAC stored in `user_roles` table.
- Data protection: PII columns encrypted using pgcrypto; KYC assets stored encrypted with separate key.
- Event sourcing for admin actions; immutable logs streamed to SIEM (Datadog + AWS CloudTrail).
- Runtime policies: OPA sidecar or AWS Verified Permissions to enforce fine-grained checks.
- Paymaster limits + guardian monitoring alerts routed to PagerDuty.

---

## Observability & Operations

| Telemetry | Implementation |
|-----------|----------------|
| Metrics | Prometheus scraping sidecars; key KPIs: mint latency, check-in p95, webhook error rate |
| Tracing | OpenTelemetry instrumentation across services; traces exported to Datadog APM |
| Logging | Structured JSON to Loki/CloudWatch; PII redaction middleware |
| Alerting | PagerDuty policies per domain (payments, blockchain, auth) with runbooks |
| Feature Flags | LaunchDarkly/Unleash controlling risky functionality (resale, recovery) |
| Chaos & DR | Quarterly game days (webhook outage, Base RPC failover) + annual DR drill |

---

## Scalability & Performance Considerations

- **Ticketing & Marketplace**: Horizontal scale via stateless services; Redis cache for event catalog; read replicas for reporting.
- **Check-in**: Dedicated high-priority autoscaling group near venue region; request coalescing + connection pooling.
- **Blockchain Throughput**: Batch `markAsUsed` transactions, monitor Base gas spikes; backlog queue for off-peak processing.
- **Payments**: Webhook ingestion limited by idempotent store; fallback polling if gateways delayed.
- **Rate Limiting**: API Gateway enforces per-IP/per-user buckets; adaptive controls triggered via anomaly detection.

Performance budgets: <200ms API p95, <50ms QR render, <100ms check-in verification, <30s mint finality, 1k check-ins/sec burst.

---

## Future Enhancements & Open Questions

1. **Multi-region readiness**: Evaluate active-active in VN + Singapore if Base hosts local RPC.
2. **Organizer self-service analytics**: Build dedicated OLAP store; ensure privacy controls.
3. **Passkey support**: Replace SMS OTP with FIDO2 for high-value users.
4. **Dynamic pricing engine**: Integrate ML-based demand pricing without compromising anti-scalping goals.
5. **On-chain royalty automation**: Explore ERC-2981 style payouts once regulations allow.
6. **Compliance posture**: Track Vietnam data protection updates; plan for ISO 27001 certification.

---
