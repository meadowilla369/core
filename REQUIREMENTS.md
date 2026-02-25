# Ticket Platform - Requirements Specification

> **Project**: Blockchain-Based Event Ticketing Platform
> **Version**: 0.1 (MVP Phase 1)
> **Last Updated**: 2026-01-15
> **Status**: Requirements Gathering

---

## Executive Summary

A mobile ticketing platform with two primary goals:
1. **Seamless ticket purchasing** - fast, secure, accessible anywhere
2. **Anti-counterfeiting** - eliminate fake tickets using blockchain

Plus a **P2P resale marketplace** that:
- Provides legitimate ticket transfer (avoiding social media scams)
- Creates additional revenue for event organizers via royalties

---

## Critical Path Decisions

### 1. User Registration & Wallet Flow

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Wallet Strategy** | Embedded Wallet + Account Abstraction (ERC-4337) | Best UX for mainstream Vietnamese users. User registers with phone, wallet created invisibly, platform pays gas via Paymaster. |
| **Blockchain** | Base L2 (Coinbase) | Low gas fees, EVM compatible, good ecosystem |
| **Gas Sponsorship** | Platform pays via Paymaster | Users never see "gas", familiar Web2 experience |

#### Registration Flow
```
User Journey:
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ Phone Number │───▶│  OTP Verify  │───▶│Create Profile│───▶│ Wallet Ready │
│    Input     │    │   (SMS)      │    │  (Name,etc)  │    │ (Invisible)  │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
```

#### KYC Strategy (Hybrid Approach)

| Stage | KYC Required? | Details |
|-------|---------------|---------|
| Registration | No | Phone + OTP only (low friction) |
| Purchase | No | Limit 4 tickets per phone per event |
| Resale (List for sale) | **Yes** | VNeID verification required to list ticket |
| Future (v2) | Incentivized | "Verified Buyer" badge, priority queue for hot events |

**Rationale**: Balance user acquisition (low friction) with anti-scalping (can't profit without KYC)

#### eKYC Implementation

| Decision | Choice | Notes |
|----------|--------|-------|
| **Provider** | eKYC API (VNPT/FPT.AI) | Must have free tier for demo/MVP |
| **Method** | CCCD photo upload + face match | Standard eKYC flow |
| **Fallback** | VNeID App QR scan (v2) | For users who prefer official app |

#### Anti-Scalping Measures (Phase 1)

| Measure | Implementation |
|---------|----------------|
| Purchase limit | 4 tickets per phone number per event |
| Resale gate | Must complete eKYC to list ticket for resale |
| Future enhancement | VNeID-verified users get priority queue |

---

### 2. Payment → Minting Flow

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **VND Payment Confirmation** | Payment Gateway API (Momo/VNPAY webhook) | Most reliable, automatic confirmation |
| **Ticket Reservation Timeout** | 15 minutes | Safer for slow bank transfers, releases if unpaid |
| **Mint Timing** | Immediate Mint | Best UX, user sees ticket instantly after payment |
| **Mint Failure Handling** | Auto-retry (3x) + Support Queue | Handles 99% of cases, fallback for edge cases |

#### Payment Flow Diagram

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Select     │───▶│   Reserve    │───▶│  Pay via     │───▶│   Webhook    │
│   Ticket     │    │   Ticket     │    │  Momo/VNPAY  │    │   Confirms   │
└──────────────┘    │  (15 min)    │    └──────────────┘    └──────────────┘
                    └──────────────┘                              │
                          │                                       ▼
                          │ timeout                    ┌──────────────────┐
                          ▼                            │  Backend Mints   │
                    ┌──────────────┐                   │  NFT to User     │
                    │   Release    │                   │  Wallet          │
                    │   to Pool    │                   └──────────────────┘
                    └──────────────┘                              │
                                                                  ▼
                                                       ┌──────────────────┐
                                                       │  Ticket in App!  │
                                                       └──────────────────┘
```

#### Key Architecture: Who 

|
| **List for resale** | User (biometric) | Yes | Paymaster |
| **Buy resale ticket** | Buyer (biometric) | Yes | Paymaster |
| **Transfer ticket** | Owner (biometric) | Yes | Paymaster |

**Why user key not needed for minting?**
Minting is like receiving a gift - the contract sends NFT TO the user's address. User just receives, no signature needed.

#### Mint Flow (Technical)

```solidity
// Backend calls this after payment confirmed
function mint(address to, uint256 eventId, string calldata seatInfo)
    external
    onlyMinter  // Only platform backend can call
{
    require(mintedPerEvent[eventId] < maxSupply[eventId], "Sold out");
    _mint(to, nextTokenId);  // NFT sent to user's wallet
    ticketData[nextTokenId] = TicketInfo(eventId, seatInfo, false);
    nextTokenId++;
}
```

#### Cost Analysis (Base L2)

| Scale | Gas Cost per Mint | Total Gas Cost | % of Revenue (at $20/ticket) |
|-------|-------------------|----------------|------------------------------|
| 10,000 tickets | ~$0.03 | ~$300 | 0.15% |
| 100,000 tickets | ~$0.03 | ~$3,000 | 0.15% |
| 1,000,000 tickets | ~$0.03 | ~$30,000 | 0.15% |

**Conclusion**: Gas cost is negligible compared to platform fee (5-10%)

#### Failure Handling Flow

```
Payment Confirmed
       │
       ▼
   Mint Attempt #1 ───▶ Success? ───▶ Done!
       │                    │
       │ Fail               │ No
       ▼                    ▼
   Retry #2 (after 5s) ───▶ Success? ───▶ Done!
       │                    │
       │ Fail               │ No
       ▼                    ▼
   Retry #3 (after 30s) ──▶ Success? ───▶ Done!
       │                    │
       │ Fail               │ No
       ▼                    ▼
   Add to Support Queue
   User sees: "Processing - contact support if >1 hour"
```

---

### 3. Ticket Ownership & Resale Flow

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Resale Price Cap** | 110-120% of original price | Balanced: allows small profit to cover fees, limits scalping |
| **Fee Structure** | Seller pays all (10% total) | Simple, seller knows net proceeds upfront |
| **Platform Fee** | 5% | Platform revenue |
| **Organizer Royalty** | 5% | Unique value prop - organizers earn from resale |
| **Resale Currency** | VND only (Phase 1) | Familiar for mainstream users |
| **Payment Security** | Platform Escrow | Platform holds VND until NFT transferred |
| **Listing Mechanism** | Lock NFT in contract | Prevents double-selling, ensures availability |

#### Resale Flow Diagram

```
SELLER LISTS TICKET:
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  Tap "Sell"  │───▶│  Set Price   │───▶│   Confirm    │───▶│   Listed!    │
│              │    │ (max 120%)   │    │  (Face ID)   │    │              │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
                                              │
                                    NFT locked in Marketplace
                                    contract (user signs)
```

```
BUYER PURCHASES:
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  Browse      │───▶│  Select      │───▶│  Pay VND     │───▶│  Webhook     │
│  Listings    │    │  Ticket      │    │ (Momo/Bank)  │    │  Confirms    │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
                                                                   │
                                                                   ▼
                                                        ┌──────────────────┐
                                                        │ Platform Backend │
                                                        │ 1. Transfer NFT  │
                                                        │ 2. Release VND   │
                                                        └──────────────────┘
                                                                   │
                                              ┌────────────────────┼────────────────────┐
                                              ▼                    ▼                    ▼
                                        ┌──────────┐         ┌──────────┐         ┌──────────┐
                                        │  Seller  │         │ Platform │         │Organizer │
                                        │   90%    │         │    5%    │         │    5%    │
                                        └──────────┘         └──────────┘         └──────────┘
```

#### Price Cap Enforcement (Smart Contract)

```solidity
// Marketplace contract
mapping(uint256 => uint256) public originalPrice;  // Set at mint
uint256 public maxMarkupBps = 12000;  // 120% = 12000 basis points

function listForSale(uint256 tokenId, uint256 price) external {
    require(msg.sender == ticketNFT.ownerOf(tokenId), "Not owner");
    require(price <= originalPrice[tokenId] * maxMarkupBps / 10000, "Price too high");

    // Lock NFT in this contract
    ticketNFT.transferFrom(msg.sender, address(this), tokenId);

    listings[tokenId] = Listing({
        seller: msg.sender,
        price: price,
        active: true
    });
}
```

#### Escrow Flow (VND)

```
1. Buyer initiates purchase
   └── Backend creates pending order, generates payment request

2. Buyer pays via Momo/VNPAY
   └── VND goes to Platform's escrow account

3. Payment webhook received
   └── Backend calls marketplace.completeSale(tokenId, buyerAddress)
   └── NFT transferred from contract to buyer

4. Backend releases VND
   └── Seller receives: price - 10% fees
   └── Platform keeps: 5%
   └── Organizer receives: 5% royalty
```

#### Why Lock NFT in Contract?

| Without Lock | With Lock |
|--------------|-----------|
| Seller could transfer NFT while listed | NFT secured in contract |
| Buyer pays, seller already sold elsewhere | Impossible - contract holds NFT |
| Disputes, refunds, angry customers | Clean atomic transaction |

#### Edge Cases

| Scenario | Handling |
|----------|----------|
| Seller wants to cancel listing | Call `cancelListing()` → NFT returned to seller |
| Event starts while ticket listed | Auto-delist expired listings (cron job) |
| Buyer payment fails/times out | Order expires after 15 min, listing remains active |
| Platform escrow failure | Manual support intervention + refund |

---

### 4. Check-in & Verification Flow

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **QR Content** | Signed message (Token ID + timestamp + nonce + signature) | Proves ownership cryptographically |
| **QR Refresh** | Every 3 seconds with fresh signature | Minimizes window for QR sharing attacks |
| **Verification Method** | Backend check (online required) | Fast (50-100ms), atomic check prevents race condition |
| **Staff Device Mode** | Online only | Required for race condition prevention at multiple gates |
| **Used Marking** | Atomic database update + async chain sync | Instant check-in UX, blockchain updated in background |
| **QR Expiry** | 3-5 seconds (rotating) | Fresh signature each refresh, old QRs immediately invalid |

#### QR Code Structure

```json
{
  "tokenId": 12345,
  "eventId": "evt_abc123",
  "timestamp": 1736956800000,
  "nonce": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "walletAddress": "0xABC...",
  "signature": "0x1a2b3c4d..."
}
```

**Fields:**
| Field | Purpose |
|-------|---------|
| `tokenId` | NFT ticket identifier |
| `eventId` | Event identifier |
| `timestamp` | When QR was generated (for expiry check) |
| `nonce` | Unique random value (prevents replay even within same second) |
| `walletAddress` | Owner's wallet address |
| `signature` | ECDSA signature over all above fields |

#### How Cryptographic Signature Proves Ownership

```
ECDSA SIGNATURE FLOW:

┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   PRIVATE KEY ──────┐                                           │
│   (secret, only     │                                           │
│    user has it)     │                                           │
│                     ▼                                           │
│              ┌─────────────┐                                    │
│   MESSAGE ──▶│    SIGN     │──▶ SIGNATURE                       │
│              └─────────────┘                                    │
│                                                                 │
│   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│                                                                 │
│   SIGNATURE ────────┐                                           │
│                     │                                           │
│                     ▼                                           │
│              ┌─────────────┐                                    │
│   MESSAGE ──▶│   RECOVER   │──▶ PUBLIC ADDRESS (who signed)     │
│              └─────────────┘                                    │
│                                                                 │
│   NO PRIVATE KEY NEEDED TO VERIFY!                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

Key insight: Given a message + signature, anyone can mathematically
recover which public address created that signature.
```

#### User Generates QR (Mobile App)

```javascript
// Called once when user opens ticket screen (requires biometric)
async function initCheckInSession(tokenId, eventId) {
  // Biometric authentication to start signing session
  await embeddedWallet.authenticate({ biometric: true });

  // Start session - allows silent signing for 3 minutes
  const session = await embeddedWallet.startSigningSession({
    expiresIn: 180,
    revokeOnBackground: true
  });

  return { session, tokenId, eventId };
}

// Called every 3 seconds to refresh QR (no biometric needed)
async function generateCheckInQR(session, tokenId, eventId) {
  const timestamp = Date.now();
  const nonce = crypto.randomUUID(); // Unique per QR

  // Create message hash (includes nonce)
  const message = ethers.solidityPackedKeccak256(
    ["uint256", "string", "uint256", "string"],
    [tokenId, eventId, timestamp, nonce]
  );

  // Sign with session (silent, no biometric prompt, ~10-50ms)
  const signature = await session.signMessage(
    ethers.getBytes(message)
  );

  return JSON.stringify({
    tokenId,
    eventId,
    timestamp,
    nonce,
    walletAddress: embeddedWallet.address,
    signature
  });
}

// Usage in React Native component
function TicketQRScreen({ tokenId, eventId }) {
  const [qrData, setQrData] = useState(null);
  const sessionRef = useRef(null);

  useEffect(() => {
    // Initialize session with biometric
    initCheckInSession(tokenId, eventId).then(({ session }) => {
      sessionRef.current = session;

      // Generate initial QR
      refreshQR();

      // Refresh every 3 seconds
      const interval = setInterval(refreshQR, 3000);
      return () => clearInterval(interval);
    });
  }, []);

  async function refreshQR() {
    if (sessionRef.current) {
      const data = await generateCheckInQR(
        sessionRef.current, tokenId, eventId
      );
      setQrData(data);
    }
  }

  return (
    <ScreenshotPrevent> {/* Blocks screenshots */}
      <QRCode value={qrData} />
      <Text>Refreshes every 3 seconds</Text>
    </ScreenshotPrevent>
  );
}
```

#### Backend Verifies Signature & Atomic Check-in

```javascript
async function verifyAndCheckIn(qrData, gateId) {
  const { tokenId, eventId, timestamp, nonce, walletAddress, signature } = JSON.parse(qrData);

  // 1. Check timestamp (5 second expiry for rotating QR)
  if (Date.now() - timestamp > 5 * 1000) {
    return { valid: false, reason: "QR expired" };
  }

  // 2. Recreate the same message hash (includes nonce)
  const message = ethers.solidityPackedKeccak256(
    ["uint256", "string", "uint256", "string"],
    [tokenId, eventId, timestamp, nonce]
  );

  // 3. Recover signer address from signature (ECDSA)
  const recoveredAddress = ethers.verifyMessage(
    ethers.getBytes(message),
    signature
  );

  // 4. Check: Does recovered address match claimed address?
  if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
    return { valid: false, reason: "Invalid signature" };
  }

  // 5. ATOMIC check-in: Check ownership + mark used in single query
  //    This prevents race condition at multiple gates
  const result = await db.query(`
    UPDATE tickets
    SET
      used_at = NOW(),
      used_by_gate = $1,
      check_in_nonce = $2
    WHERE
      token_id = $3
      AND owner_address = $4
      AND event_id = $5
      AND used_at IS NULL
    RETURNING token_id, seat_info
  `, [gateId, nonce, tokenId, walletAddress.toLowerCase(), eventId]);

  // 6. Check result
  if (result.rowCount === 0) {
    // Either not owner, wrong event, or already used
    const ticket = await db.tickets.findOne({ tokenId });
    if (!ticket) {
      return { valid: false, reason: "Ticket not found" };
    }
    if (ticket.ownerAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      return { valid: false, reason: "Not the owner" };
    }
    if (ticket.eventId !== eventId) {
      return { valid: false, reason: "Wrong event" };
    }
    if (ticket.usedAt) {
      return { valid: false, reason: "Already checked in" };
    }
    return { valid: false, reason: "Check-in failed" };
  }

  // Success! First gate to scan wins
  const ticket = result.rows[0];

  // Queue async blockchain update (non-blocking)
  await queue.add('markTicketUsed', { tokenId });

  return { valid: true, seat: ticket.seat_info };
}
```

**Key Security Properties:**

| Property | Implementation |
|----------|----------------|
| **Race condition prevention** | Single atomic UPDATE query - first gate wins |
| **5-second QR expiry** | Timestamp check before any DB operations |
| **Nonce uniqueness** | Stored in DB, prevents replay of same QR |
| **Signature verification** | ECDSA recovery proves wallet ownership |
| **Async blockchain sync** | Check-in is instant, chain update queued |

#### Why This Proves the Person at Venue is the Owner

| Attack | How It's Prevented |
|--------|-------------------|
| Screenshot attempt | App blocks screenshots (FLAG_SECURE / isSecureTextEntry) |
| QR forwarded to friend | 3-second rotating QR + atomic DB check (first scan wins) |
| QR shared via email/messaging | QR only accessible in-app, not via email or links |
| Photo of screen with another phone | Atomic DB check - even if captured, only first scan succeeds |
| Fake QR with random data | Recovered address won't match ticket owner |
| Phone stolen | Biometric (Face ID/fingerprint) required to open QR screen |
| **Simultaneous scan at 2 gates** | Atomic database update - only first scan succeeds |

#### Check-in Flow Diagram

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  User opens  │───▶│  App signs   │───▶│  QR shown    │───▶│  Staff scans │
│  ticket      │    │  message     │    │  on screen   │    │  with device │
└──────────────┘    │  (biometric) │    └──────────────┘    └──────────────┘
                    └──────────────┘                              │
                                                                  ▼
                                                       ┌──────────────────┐
                                                       │  Backend API     │
                                                       │  /verify-ticket  │
                                                       └──────────────────┘
                                                                  │
                                         ┌────────────────────────┴────────────────────────┐
                                         ▼                                                 ▼
                                   ┌──────────┐                                      ┌──────────┐
                                   │  VALID   │                                      │ INVALID  │
                                   │  GREEN   │                                      │   RED    │
                                   └──────────┘                                      └──────────┘
                                         │                                                 │
                                         ▼                                                 ▼
                                   Mark as used                                      Show reason:
                                   in database                                       - Already used
                                         │                                           - Wrong event
                                         ▼                                           - Invalid sig
                                   Async: Update                                     - Expired QR
                                   blockchain flag                                   - Not owner
```

#### Multi-Layer QR Security

Staff devices must be online for race condition prevention. The security model uses multiple layers:

```
┌─────────────────────────────────────────────────────────────────┐
│                    MULTI-LAYER SECURITY                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Layer 1: App-Only QR + Biometric Session                       │
│  ├── QR only accessible in mobile app (not email/web)          │
│  ├── Biometric required to open QR screen                      │
│  └── Session-based signing (3 min, revokes on background)      │
│                                                                 │
│  Layer 2: Screenshot Prevention                                 │
│  ├── iOS: isSecureTextEntry / UIScreen.isCaptured              │
│  ├── Android: FLAG_SECURE on window                            │
│  └── Blocks casual screenshot sharing                          │
│                                                                 │
│  Layer 3: 3-Second Rotating QR                                  │
│  ├── Fresh timestamp + nonce every 3 seconds                   │
│  ├── Each QR cryptographically unique                          │
│  └── Reduces attack window from minutes to seconds             │
│                                                                 │
│  Layer 4: Atomic Database Check (ENFORCEMENT)                   │
│  ├── Single atomic UPDATE query                                │
│  ├── First gate to scan wins, second gets "Already used"       │
│  └── THE definitive protection against race conditions         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

| Layer | Purpose | Stops |
|-------|---------|-------|
| 1 | Require authentication | Unauthorized access |
| 2 | Block screenshots | Casual sharing |
| 3 | Rotating QR | Reduces attack window |
| 4 | Atomic DB check | **Race condition (enforcement)** |

**Note:** Layers 1-3 reduce the likelihood of sharing attempts. Layer 4 ensures that even if sharing occurs, only one scan succeeds.

#### Async Blockchain Sync

```solidity
// TicketNFT contract
mapping(uint256 => bool) public isUsed;

function markAsUsed(uint256 tokenId) external onlyOperator {
    require(!isUsed[tokenId], "Already used");
    isUsed[tokenId] = true;
    emit TicketUsed(tokenId, block.timestamp);
}

// Batch version for gas efficiency
function batchMarkAsUsed(uint256[] calldata tokenIds) external onlyOperator {
    for (uint i = 0; i < tokenIds.length; i++) {
        if (!isUsed[tokenIds[i]]) {
            isUsed[tokenIds[i]] = true;
            emit TicketUsed(tokenIds[i], block.timestamp);
        }
    }
}
```

Backend worker:
- Processes "mark used" queue every 5 minutes
- Batches multiple tickets into single transaction
- Retries on failure with exponential backoff

---

### 5. Event Cancellation & Refund Flow

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Cancellation Trigger** | Organizer via admin panel | Only organizer can cancel their event |
| **Resale Buyer Refund** | Original ticket price only | Buyer accepted premium risk; platform can't cover all losses |
| **Platform Fee** | Refund in full | Good customer experience, builds trust |
| **Organizer Royalty (from resale)** | Keep (already paid out) | Complex to claw back, small amounts |
| **Postponement Policy** | Ticket valid for new date + 7-day opt-in refund | Balances organizer needs with buyer rights |
| **Refund Method** | Original payment method (Momo/Bank) | Simplest, most familiar for users |
| **Refund Timeline** | 7-14 business days | Standard for VN payment systems |
| **NFT Handling** | Mark as "cancelled" (not burned) | Preserves audit trail, can still verify history |

#### Cancellation Scenarios

```
┌─────────────────────────────────────────────────────────────────┐
│                    CANCELLATION SCENARIOS                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. FULL CANCELLATION                                           │
│     ├── Organizer triggers via admin panel                      │
│     ├── All tickets become refundable                           │
│     ├── Active resale listings auto-cancelled                   │
│     ├── Listed NFTs returned to sellers                         │
│     └── NFTs marked as "cancelled" on-chain                     │
│                                                                 │
│  2. POSTPONEMENT (New Date Announced)                           │
│     ├── Tickets remain valid for new date                       │
│     ├── 7-day refund window opens                               │
│     ├── User can choose: keep ticket OR request refund          │
│     ├── Push notification sent to all ticket holders            │
│     └── After window closes, tickets locked to new date         │
│                                                                 │
│  3. VENUE CHANGE                                                │
│     ├── Same as postponement flow                               │
│     ├── 7-day refund window                                     │
│     └── User decides if new venue is acceptable                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Refund Amount by Buyer Type

| Buyer Type | Paid | Refund Amount | Loss |
|------------|------|---------------|------|
| **Primary buyer** | 1,000,000 VND | 1,000,000 VND | 0 |
| **Resale buyer (at 120%)** | 1,200,000 VND | 1,000,000 VND (original) | 200,000 VND |
| **Resale buyer (at 100%)** | 1,000,000 VND | 1,000,000 VND | 0 |
| **Resale seller (listed)** | N/A | NFT returned + can claim refund | 0 |

**Rationale for resale buyer policy:**
- Buyer paid premium voluntarily, accepting market risk
- Platform cannot subsidize premium losses at scale
- Clear terms shown at resale purchase time
- Original price refund is still fair (ticket value)

#### Cancellation Flow Diagram

```
ORGANIZER INITIATES CANCELLATION:

┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  Organizer   │───▶│   Confirm    │───▶│   Backend    │───▶│  Notify All  │
│  Admin Panel │    │  Cancellation│    │  Processes   │    │   Holders    │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
                                              │
                    ┌─────────────────────────┼─────────────────────────┐
                    ▼                         ▼                         ▼
             ┌─────────────┐          ┌─────────────┐          ┌─────────────┐
             │   Cancel    │          │   Return    │          │   Mark NFT  │
             │   Resale    │          │   Listed    │          │   Cancelled │
             │   Listings  │          │   NFTs      │          │   On-chain  │
             └─────────────┘          └─────────────┘          └─────────────┘
```

```
USER CLAIMS REFUND:

┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  User opens  │───▶│   Tap        │───▶│   Confirm    │───▶│   Refund     │
│  cancelled   │    │   "Request   │    │   Bank/Momo  │    │   Queued     │
│  ticket      │    │   Refund"    │    │   Account    │    │              │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
                                                                   │
                                                                   ▼
                                                        ┌──────────────────┐
                                                        │  7-14 days:      │
                                                        │  VND refunded to │
                                                        │  original method │
                                                        └──────────────────┘
```

#### Database Schema for Refunds

```sql
-- Event cancellation status
ALTER TABLE events ADD COLUMN status VARCHAR(20) DEFAULT 'active';
-- Values: 'active', 'postponed', 'cancelled'

ALTER TABLE events ADD COLUMN cancellation_reason TEXT;
ALTER TABLE events ADD COLUMN cancelled_at TIMESTAMP;
ALTER TABLE events ADD COLUMN refund_window_ends_at TIMESTAMP;
ALTER TABLE events ADD COLUMN new_event_date TIMESTAMP; -- for postponement

-- Refund tracking
CREATE TABLE refund_requests (
  id UUID PRIMARY KEY,
  ticket_id INTEGER REFERENCES tickets(token_id),
  user_id UUID REFERENCES users(id),

  -- Amounts
  original_purchase_price BIGINT NOT NULL,  -- What user paid
  refund_amount BIGINT NOT NULL,            -- What they get back

  -- Status tracking
  status VARCHAR(20) DEFAULT 'pending',
  -- Values: 'pending', 'processing', 'completed', 'failed'

  -- Payment info
  refund_method VARCHAR(20),  -- 'momo', 'bank_transfer'
  refund_reference VARCHAR(100),

  -- Timestamps
  requested_at TIMESTAMP DEFAULT NOW(),
  processed_at TIMESTAMP,
  completed_at TIMESTAMP,

  -- Error handling
  failure_reason TEXT,
  retry_count INTEGER DEFAULT 0
);
```

#### Smart Contract: Cancel Event

```solidity
// TicketNFT contract additions
mapping(uint256 => bool) public eventCancelled;

function cancelEvent(uint256 eventId) external onlyOrganizer(eventId) {
    require(!eventCancelled[eventId], "Already cancelled");
    eventCancelled[eventId] = true;
    emit EventCancelled(eventId, block.timestamp);
}

function isTicketRefundable(uint256 tokenId) public view returns (bool) {
    uint256 eventId = ticketData[tokenId].eventId;
    return eventCancelled[eventId] && !ticketData[tokenId].refundClaimed;
}

// Marketplace contract additions
function cancelAllListingsForEvent(uint256 eventId) external onlyOperator {
    // Called by backend when event is cancelled
    // Returns all listed NFTs to their sellers
    for (uint i = 0; i < activeListings[eventId].length; i++) {
        uint256 tokenId = activeListings[eventId][i];
        address seller = listings[tokenId].seller;

        // Return NFT to seller
        ticketNFT.transferFrom(address(this), seller, tokenId);

        // Clear listing
        delete listings[tokenId];

        emit ListingCancelled(tokenId, "Event cancelled");
    }
}
```

#### Backend Refund Processing

```javascript
// Refund worker (runs every hour)
async function processRefundQueue() {
  const pendingRefunds = await db.refundRequests.findAll({
    where: { status: 'pending' },
    limit: 100
  });

  for (const refund of pendingRefunds) {
    try {
      // Mark as processing
      await refund.update({ status: 'processing' });

      // Process based on payment method
      if (refund.refundMethod === 'momo') {
        await momoApi.refund({
          originalTransactionId: refund.originalPaymentRef,
          amount: refund.refundAmount,
          description: `Refund for cancelled event - Ticket #${refund.ticketId}`
        });
      } else if (refund.refundMethod === 'bank_transfer') {
        await bankApi.transfer({
          accountNumber: refund.userBankAccount,
          amount: refund.refundAmount,
          description: `Event refund #${refund.id}`
        });
      }

      // Mark completed
      await refund.update({
        status: 'completed',
        completedAt: new Date()
      });

      // Notify user
      await sendPushNotification(refund.userId, {
        title: 'Refund Completed',
        body: `Your refund of ${formatVND(refund.refundAmount)} has been processed.`
      });

    } catch (error) {
      await refund.update({
        status: refund.retryCount >= 3 ? 'failed' : 'pending',
        retryCount: refund.retryCount + 1,
        failureReason: error.message
      });
    }
  }
}
```

#### Edge Cases

| Scenario | Handling |
|----------|----------|
| User already checked in, event cancelled mid-way | Full refund (partial event = full refund for MVP) |
| Ticket transferred after purchase, event cancelled | Current owner gets refund (not original buyer) |
| User's Momo account closed | Prompt for bank account, manual processing |
| Refund fails 3 times | Flag for manual support intervention |
| Organizer disputes cancellation | Admin override required, legal terms apply |
| Partial day cancellation (multi-day event) | Pro-rata refund based on days missed (v2) |

#### User Communication

| Event | Notification |
|-------|--------------|
| Event cancelled | Push + SMS + Email with refund instructions |
| Event postponed | Push + SMS with new date and refund option |
| Refund requested | Push confirming request received |
| Refund completed | Push + SMS with amount and reference |
| Refund failed | Push with instructions to contact support |

---

### 6. Wallet/Device Lost Recovery Flow

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Primary Recovery** | Phone OTP (same as registration) | Familiar flow, user already verified this number |
| **Secondary Recovery** | Email OTP (if added) | Backup for SIM issues |
| **Security Hold** | 48-hour delay for high-value accounts | Prevents instant takeover, gives real owner time to react |
| **Key Rotation** | ERC-4337 guardian-based key swap | Change signing key without changing wallet address |
| **Ticket Protection** | Freeze transfers during recovery | Prevents thief from transferring tickets |
| **SIM Swap Protection** | Email confirmation required if new SIM detected | Blocks common attack vector |

#### Recovery Scenarios

```
┌─────────────────────────────────────────────────────────────────┐
│                    RECOVERY SCENARIOS                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. NEW PHONE (Same Phone Number)                               │
│     ├── User installs app on new device                         │
│     ├── Logs in with phone + OTP                                │
│     ├── Wallet automatically restored from embedded provider    │
│     └── All tickets visible immediately                         │
│                                                                 │
│  2. PHONE LOST/STOLEN                                           │
│     ├── User reports via web portal or support                  │
│     ├── Account immediately frozen (no transfers)              │
│     ├── 48-hour security hold begins                            │
│     ├── User verifies identity (phone OTP + email)              │
│     ├── New device linked, old device revoked                   │
│     └── Wallet key rotated via ERC-4337                         │
│                                                                 │
│  3. PHONE NUMBER CHANGED                                        │
│     ├── User must have email linked (prompted during onboard)  │
│     ├── Verify via email OTP                                    │
│     ├── Add new phone number                                    │
│     ├── 48-hour hold for high-value accounts                    │
│     └── Old phone number delinked                               │
│                                                                 │
│  4. APP DELETED (Same Phone)                                    │
│     ├── Reinstall app                                           │
│     ├── Login with phone + OTP                                  │
│     ├── Embedded wallet restored from provider cloud            │
│     └── No security hold needed (same device fingerprint)       │
│                                                                 │
│  5. SIM SWAP ATTACK DETECTED                                    │
│     ├── System detects OTP from new SIM + new device            │
│     ├── Recovery blocked until email confirmation               │
│     ├── Alert sent to registered email                          │
│     ├── Real owner can freeze account via email link            │
│     └── Requires both phone + email to complete recovery        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Recovery Flow Diagram (Phone Lost/Stolen)

```
USER REPORTS LOST DEVICE:

┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  Web Portal  │───▶│   Verify     │───▶│   Account    │───▶│  48-Hour     │
│  or Support  │    │   Identity   │    │   Frozen     │    │  Hold        │
└──────────────┘    │ (email/phone)│    │ (no xfers)   │    │  Begins      │
                    └──────────────┘    └──────────────┘    └──────────────┘
                                                                   │
                                                                   ▼
                                                        ┌──────────────────┐
                                                        │  After 48 Hours  │
                                                        └──────────────────┘
                                                                   │
                    ┌─────────────────────────────────────────────┴──────────┐
                    ▼                                                         ▼
             ┌─────────────────┐                                  ┌─────────────────┐
             │  No Dispute?    │                                  │  Owner Objects? │
             │  Complete       │                                  │  Extend Hold    │
             │  Recovery       │                                  │  + Manual Review│
             └─────────────────┘                                  └─────────────────┘
                    │
                    ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  Link New    │───▶│  Rotate      │───▶│   Revoke     │───▶│   Access     │
│  Device      │    │  Wallet Key  │    │   Old Device │    │   Restored   │
└──────────────┘    │  (ERC-4337)  │    └──────────────┘    └──────────────┘
                    └──────────────┘
```

#### ERC-4337 Key Rotation (Technical)

Account Abstraction enables key rotation without changing the wallet address:

```solidity
// Smart Contract Wallet (ERC-4337 Account)
contract TicketWallet {
    address public owner;           // Current signing key
    address public guardian;        // Platform recovery guardian
    uint256 public recoveryInitiated;
    address public pendingNewOwner;

    uint256 constant RECOVERY_DELAY = 48 hours;

    // Step 1: Guardian initiates recovery (platform backend)
    function initiateRecovery(address newOwner) external {
        require(msg.sender == guardian, "Not guardian");
        pendingNewOwner = newOwner;
        recoveryInitiated = block.timestamp;
        emit RecoveryInitiated(owner, newOwner, block.timestamp);
    }

    // Step 2: Complete after delay (or cancel if disputed)
    function completeRecovery() external {
        require(pendingNewOwner != address(0), "No recovery pending");
        require(
            block.timestamp >= recoveryInitiated + RECOVERY_DELAY,
            "Recovery delay not passed"
        );

        address oldOwner = owner;
        owner = pendingNewOwner;
        pendingNewOwner = address(0);
        recoveryInitiated = 0;

        emit RecoveryCompleted(oldOwner, owner);
    }

    // Owner can cancel if they regain access
    function cancelRecovery() external {
        require(msg.sender == owner, "Not owner");
        require(pendingNewOwner != address(0), "No recovery pending");

        pendingNewOwner = address(0);
        recoveryInitiated = 0;

        emit RecoveryCancelled();
    }

    // Freeze transfers during recovery
    modifier notInRecovery() {
        require(pendingNewOwner == address(0), "Recovery in progress");
        _;
    }
}
```

#### Embedded Wallet Provider Recovery

Most embedded wallet providers handle key management:

| Provider | Recovery Method | Key Storage |
|----------|-----------------|-------------|
| **Privy** | Email/Phone/Social login | MPC shards across devices + cloud |
| **Dynamic** | Email/Social + passkeys | MPC + secure enclave |
| **Thirdweb** | Email/Phone + device key | MPC shards |

```
┌─────────────────────────────────────────────────────────────────┐
│              EMBEDDED WALLET RECOVERY (MPC)                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  KEY SHARDS (2-of-3 required to sign):                          │
│                                                                 │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐           │
│  │   Shard 1   │   │   Shard 2   │   │   Shard 3   │           │
│  │   Device    │   │   Cloud     │   │   Provider  │           │
│  │             │   │  (encrypted)│   │   (backup)  │           │
│  └─────────────┘   └─────────────┘   └─────────────┘           │
│        │                  │                  │                  │
│        ▼                  ▼                  ▼                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Normal Use: Shard 1 (device) + Shard 2 (cloud)         │   │
│  │  Recovery:   Shard 2 (cloud) + Shard 3 (provider)       │   │
│  │              after identity verification                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Device lost? User verifies identity → Provider combines       │
│  Shard 2 + Shard 3 to restore wallet on new device             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Database Schema for Recovery

```sql
-- Device tracking
CREATE TABLE user_devices (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  device_fingerprint VARCHAR(255) NOT NULL,
  device_name VARCHAR(100),  -- "iPhone 15 Pro"
  last_active_at TIMESTAMP,
  is_current BOOLEAN DEFAULT false,
  revoked_at TIMESTAMP,
  revoked_reason VARCHAR(50),  -- 'lost', 'stolen', 'replaced'
  created_at TIMESTAMP DEFAULT NOW()
);

-- Recovery requests
CREATE TABLE recovery_requests (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),

  -- Request details
  request_type VARCHAR(20) NOT NULL,
  -- Values: 'device_lost', 'phone_changed', 'account_frozen'

  -- Verification status
  phone_verified BOOLEAN DEFAULT false,
  email_verified BOOLEAN DEFAULT false,

  -- Security hold
  initiated_at TIMESTAMP DEFAULT NOW(),
  hold_expires_at TIMESTAMP,  -- 48 hours from initiation

  -- Status
  status VARCHAR(20) DEFAULT 'pending',
  -- Values: 'pending', 'hold', 'completed', 'cancelled', 'disputed'

  -- New device
  new_device_fingerprint VARCHAR(255),

  -- Resolution
  completed_at TIMESTAMP,
  completed_by VARCHAR(50),  -- 'automatic', 'support_agent_id'

  -- Audit
  ip_address INET,
  user_agent TEXT
);

-- Account freeze status
ALTER TABLE users ADD COLUMN is_frozen BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN frozen_at TIMESTAMP;
ALTER TABLE users ADD COLUMN freeze_reason VARCHAR(50);
```

#### Backend Recovery Service

```javascript
class RecoveryService {
  async initiateRecovery(userId, requestType, newDeviceInfo) {
    // 1. Freeze account immediately
    await db.users.update(userId, {
      isFrozen: true,
      frozenAt: new Date(),
      freezeReason: 'recovery_in_progress'
    });

    // 2. Create recovery request
    const holdDuration = await this.calculateHoldDuration(userId);
    const recovery = await db.recoveryRequests.create({
      userId,
      requestType,
      holdExpiresAt: new Date(Date.now() + holdDuration),
      newDeviceFingerprint: newDeviceInfo.fingerprint
    });

    // 3. Revoke old device sessions
    await this.revokeAllSessions(userId);

    // 4. Notify user via all channels
    await this.sendRecoveryNotifications(userId, recovery);

    // 5. Initiate on-chain recovery (if using smart wallet)
    await this.initiateChainRecovery(userId, newDeviceInfo.walletAddress);

    return recovery;
  }

  async calculateHoldDuration(userId) {
    const user = await db.users.findById(userId);
    const ticketValue = await this.calculateTicketValue(userId);

    // Higher value = longer hold
    if (ticketValue > 10_000_000) return 72 * 60 * 60 * 1000; // 72 hours
    if (ticketValue > 1_000_000) return 48 * 60 * 60 * 1000;  // 48 hours
    return 24 * 60 * 60 * 1000;  // 24 hours for low value
  }

  async completeRecovery(recoveryId) {
    const recovery = await db.recoveryRequests.findById(recoveryId);

    // Verify hold period passed
    if (new Date() < recovery.holdExpiresAt) {
      throw new Error('Security hold not expired');
    }

    // Check for disputes
    if (recovery.status === 'disputed') {
      throw new Error('Recovery disputed - manual review required');
    }

    // 1. Complete on-chain key rotation
    await this.completeChainRecovery(recovery.userId);

    // 2. Link new device
    await db.userDevices.create({
      userId: recovery.userId,
      deviceFingerprint: recovery.newDeviceFingerprint,
      isCurrent: true
    });

    // 3. Unfreeze account
    await db.users.update(recovery.userId, {
      isFrozen: false,
      frozenAt: null,
      freezeReason: null
    });

    // 4. Restore wallet access via embedded provider
    await embeddedWalletProvider.restoreAccess(
      recovery.userId,
      recovery.newDeviceFingerprint
    );

    // 5. Mark complete
    await recovery.update({
      status: 'completed',
      completedAt: new Date(),
      completedBy: 'automatic'
    });

    // 6. Notify user
    await sendPushNotification(recovery.userId, {
      title: 'Account Recovered',
      body: 'Your account has been restored. Your tickets are safe.'
    });
  }
}
```

#### SIM Swap Protection

```javascript
async function detectSIMSwap(userId, phoneNumber, deviceInfo) {
  const user = await db.users.findById(userId);
  const lastDevice = await db.userDevices.findOne({
    userId,
    isCurrent: true
  });

  // Flags for suspicious activity
  const isNewDevice = !lastDevice ||
    lastDevice.deviceFingerprint !== deviceInfo.fingerprint;
  const isNewSIM = await checkCarrierSIMChange(phoneNumber); // Carrier API

  if (isNewDevice && isNewSIM) {
    // High risk: Require email verification
    return {
      allowed: false,
      reason: 'sim_swap_detected',
      requiredVerification: ['email'],
      message: 'For your security, please verify via email'
    };
  }

  if (isNewDevice) {
    // Medium risk: Send alert, allow with confirmation
    await sendSecurityAlert(userId, {
      type: 'new_device_login',
      deviceInfo,
      allowLink: generateConfirmationLink(userId, deviceInfo)
    });
  }

  return { allowed: true };
}
```

#### Edge Cases

| Scenario | Handling |
|----------|----------|
| User loses both phone AND email access | Support escalation with ID verification (CCCD photo match) |
| Thief tries to recover before owner | 48-hour hold + email alert gives owner time to freeze |
| User disputes recovery (attacker initiated) | Recovery cancelled, account stays frozen, manual review |
| Recovery during active event | Priority support queue, expedited verification |
| Multiple recovery attempts | Rate limit: 1 per 30 days, 3 per year max |
| User never added email (phone-only) | Prompt to add email on first high-value ticket purchase |

#### User Communication

| Event | Notification |
|-------|--------------|
| Recovery initiated | Push (old device) + SMS + Email: "Recovery requested. Not you? Tap to freeze" |
| Account frozen | SMS + Email with freeze confirmation and support contact |
| 24 hours remaining | SMS + Email reminder of pending recovery |
| Recovery complete | Push (new device) + SMS + Email confirmation |
| Suspicious login blocked | SMS + Email with details and freeze link |

---

### 7. Dispute Resolution Flow

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Escalation Tiers** | 3-Tier (Automated → Agent → Senior Review) | Balances speed with thoroughness |
| **SLA** | 24/48/72 hours based on value | Aggressive SLA builds trust |
| **Filing Window** | 7 days after event | Reasonable time for users to notice issues |
| **Evidence Sources** | Blockchain + Payment Gateway + DB Logs | Immutable, verifiable records |
| **External Arbitration** | Yes, for disputes > 5M VND | Independent resolution for high-stakes |
| **Goodwill Policy** | Platform credits for unresolvable cases | Maintains customer satisfaction |

#### Dispute Categories

```
┌─────────────────────────────────────────────────────────────────┐
│                    DISPUTE CATEGORIES                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. PAYMENT DISPUTES                                            │
│     ├── Paid but no ticket received                             │
│     ├── Double/duplicate charge                                 │
│     ├── Wrong amount charged                                    │
│     └── Payment timeout but money deducted                      │
│                                                                 │
│  2. RESALE DISPUTES                                             │
│     ├── Seller: Payment not received after sale                 │
│     ├── Buyer: Ticket not transferred after payment             │
│     ├── Ticket used/invalid after purchase                      │
│     └── Listing cancelled but payment processed                 │
│                                                                 │
│  3. CHECK-IN DISPUTES                                           │
│     ├── Valid ticket rejected at gate                           │
│     ├── Ticket marked used but user didn't attend               │
│     ├── QR scan failed due to technical issue                   │
│     └── Wrong seat/section assigned                             │
│                                                                 │
│  4. REFUND DISPUTES                                             │
│     ├── Refund not received after event cancellation            │
│     ├── Wrong refund amount                                     │
│     ├── Refund sent to wrong account                            │
│     └── Partial refund disagreement                             │
│                                                                 │
│  5. ACCOUNT/OWNERSHIP DISPUTES                                  │
│     ├── Ticket transferred without consent                      │
│     ├── Account recovery fraud                                  │
│     ├── Unauthorized resale listing                             │
│     └── NFT ownership mismatch                                  │
│                                                                 │
│  6. EVENT DISPUTES                                              │
│     ├── Event cancelled without proper notice                   │
│     ├── Event significantly different from advertised           │
│     ├── Partial event (ended early)                             │
│     └── Venue/date changed without consent                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 3-Tier Escalation Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                    3-TIER ESCALATION                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  TIER 1: AUTOMATED RESOLUTION                                   │
│  ├── Handles: Clear-cut cases with definitive evidence          │
│  ├── SLA: Instant to 1 hour                                     │
│  ├── Examples:                                                  │
│  │   • Payment confirmed + NFT not minted → Auto-mint           │
│  │   • Double payment detected → Auto-refund duplicate          │
│  │   • Resale escrow complete + NFT locked → Auto-transfer      │
│  │   • System error logged → Auto-compensate                    │
│  └── Resolution Rate: ~60% of disputes                          │
│                                                                 │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│                         ↓ Escalate if unresolved                │
│                                                                 │
│  TIER 2: SUPPORT AGENT                                          │
│  ├── Handles: Requires human judgment, evidence review          │
│  ├── SLA: 24-48 hours                                           │
│  ├── Tools: Blockchain explorer, payment logs, user history     │
│  ├── Examples:                                                  │
│  │   • Conflicting claims between buyer/seller                  │
│  │   • Check-in disputes requiring gate log review              │
│  │   • Account access issues needing identity verification      │
│  └── Resolution Rate: ~35% of disputes                          │
│                                                                 │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│                         ↓ Escalate if unresolved                │
│                                                                 │
│  TIER 3: SENIOR REVIEW / ARBITRATION                            │
│  ├── Handles: Complex cases, high value, policy exceptions      │
│  ├── SLA: 72 hours (internal) / 7 days (external arbitration)   │
│  ├── Authority: Can override policy, issue goodwill credits     │
│  ├── Examples:                                                  │
│  │   • Disputes > 5M VND                                        │
│  │   • Fraud investigation                                      │
│  │   • Organizer vs platform disputes                           │
│  │   • Cases requiring legal review                             │
│  └── Resolution Rate: ~5% of disputes                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### SLA by Dispute Value

| Dispute Value | Tier 1 (Auto) | Tier 2 (Agent) | Tier 3 (Senior) |
|---------------|---------------|----------------|-----------------|
| < 500K VND | Instant | 24 hours | 48 hours |
| 500K - 2M VND | 1 hour | 48 hours | 72 hours |
| 2M - 5M VND | 1 hour | 48 hours | 72 hours |
| > 5M VND | 1 hour | 24 hours | 72 hours + External option |

#### Evidence Sources & Verification

| Source | Data Available | Immutability |
|--------|----------------|--------------|
| **Blockchain (Base L2)** | NFT ownership, transfers, mint timestamps, used status | Immutable |
| **Payment Gateway (Momo/VNPAY)** | Transaction ID, amount, timestamp, status | Gateway-verified |
| **Platform Database** | User actions, API calls, check-in attempts, session logs | Timestamped, audited |
| **Device Logs** | QR generation times, biometric auth, app version | Client-reported |
| **Gate Devices** | Scan attempts, timestamps, gate ID, staff ID | Device-logged |

```
EVIDENCE VERIFICATION FLOW:

┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Dispute    │───▶│   Gather     │───▶│   Cross-     │
│   Filed      │    │   Evidence   │    │   Reference  │
└──────────────┘    └──────────────┘    └──────────────┘
                                               │
                    ┌──────────────────────────┴──────────────────────────┐
                    ▼                          ▼                          ▼
             ┌─────────────┐            ┌─────────────┐            ┌─────────────┐
             │  Blockchain │            │   Payment   │            │  Database   │
             │  - Owner?   │            │  - Paid?    │            │  - Actions? │
             │  - Minted?  │            │  - Amount?  │            │  - Logs?    │
             │  - Used?    │            │  - When?    │            │  - Errors?  │
             └─────────────┘            └─────────────┘            └─────────────┘
                    │                          │                          │
                    └──────────────────────────┼──────────────────────────┘
                                               ▼
                                        ┌─────────────┐
                                        │   Verdict   │
                                        │  (with      │
                                        │  confidence │
                                        │  score)     │
                                        └─────────────┘
```

#### Automatic Resolution Rules (Tier 1)

```javascript
const AUTO_RESOLUTION_RULES = {
  // Payment Disputes
  'payment_no_ticket': {
    condition: (dispute) =>
      dispute.paymentConfirmed &&
      !dispute.nftMinted &&
      dispute.timeSincePayment > 15 * 60 * 1000, // 15 min
    action: 'AUTO_MINT_OR_REFUND',
    priority: 'high'
  },

  'double_payment': {
    condition: (dispute) =>
      dispute.paymentCount > 1 &&
      dispute.uniqueTicketCount === 1,
    action: 'AUTO_REFUND_DUPLICATE',
    priority: 'high'
  },

  // Resale Disputes
  'resale_incomplete': {
    condition: (dispute) =>
      dispute.escrowPaymentConfirmed &&
      dispute.nftInEscrow &&
      dispute.transferNotCompleted &&
      dispute.timeSincePayment > 30 * 60 * 1000, // 30 min
    action: 'AUTO_COMPLETE_TRANSFER',
    priority: 'high'
  },

  // Check-in Disputes
  'checkin_system_error': {
    condition: (dispute) =>
      dispute.systemErrorLogged &&
      dispute.ticketValid &&
      dispute.notMarkedUsed,
    action: 'AUTO_ALLOW_ENTRY_OR_COMPENSATE',
    priority: 'critical'
  },

  // Refund Disputes
  'refund_not_processed': {
    condition: (dispute) =>
      dispute.eventCancelled &&
      dispute.refundRequested &&
      dispute.refundNotSent &&
      dispute.timeSinceRequest > 14 * 24 * 60 * 60 * 1000, // 14 days
    action: 'ESCALATE_AND_EXPEDITE_REFUND',
    priority: 'high'
  }
};

async function autoResolve(dispute) {
  for (const [ruleId, rule] of Object.entries(AUTO_RESOLUTION_RULES)) {
    if (rule.condition(dispute)) {
      await executeAction(dispute, rule.action);
      await dispute.update({
        status: 'resolved',
        resolvedBy: 'automated',
        ruleApplied: ruleId,
        resolvedAt: new Date()
      });
      await notifyUser(dispute.userId, {
        title: 'Dispute Resolved',
        body: `Your dispute has been automatically resolved. ${getActionMessage(rule.action)}`
      });
      return true;
    }
  }
  return false; // Escalate to Tier 2
}
```

#### Dispute Resolution Flow Diagram

```
USER FILES DISPUTE:

┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  In-App      │───▶│  Select      │───▶│  Provide     │───▶│  Submit      │
│  "Help"      │    │  Category    │    │  Details +   │    │  Dispute     │
└──────────────┘    └──────────────┘    │  Evidence    │    └──────────────┘
                                        └──────────────┘           │
                                                                   ▼
                                                        ┌──────────────────┐
                                                        │  TIER 1: AUTO    │
                                                        │  Check rules     │
                                                        └──────────────────┘
                                                                   │
                                              ┌────────────────────┴────────────────────┐
                                              ▼                                         ▼
                                       ┌─────────────┐                           ┌─────────────┐
                                       │  Resolved   │                           │  Escalate   │
                                       │  (Instant)  │                           │  to Tier 2  │
                                       └─────────────┘                           └─────────────┘
                                                                                        │
                                                                                        ▼
                                                                             ┌──────────────────┐
                                                                             │  TIER 2: AGENT   │
                                                                             │  Review evidence │
                                                                             │  Contact parties │
                                                                             └──────────────────┘
                                                                                        │
                                              ┌────────────────────┴────────────────────┐
                                              ▼                                         ▼
                                       ┌─────────────┐                           ┌─────────────┐
                                       │  Resolved   │                           │  Escalate   │
                                       │  (24-48hr)  │                           │  to Tier 3  │
                                       └─────────────┘                           └─────────────┘
                                                                                        │
                                                                                        ▼
                                                                             ┌──────────────────┐
                                                                             │  TIER 3: SENIOR  │
                                                                             │  Final decision  │
                                                                             │  or Arbitration  │
                                                                             └──────────────────┘
                                                                                        │
                                              ┌────────────────────┴────────────────────┐
                                              ▼                                         ▼
                                       ┌─────────────┐                           ┌─────────────┐
                                       │  Resolved   │                           │  External   │
                                       │  (72hr)     │                           │ Arbitration │
                                       └─────────────┘                           │  (>5M VND)  │
                                                                                 └─────────────┘
```

#### Database Schema for Disputes

```sql
-- Dispute tracking
CREATE TABLE disputes (
  id UUID PRIMARY KEY,

  -- Parties
  filed_by_user_id UUID REFERENCES users(id),
  against_user_id UUID REFERENCES users(id),  -- NULL if against platform/organizer
  against_organizer_id UUID REFERENCES organizers(id),

  -- Related entities
  ticket_id INTEGER REFERENCES tickets(token_id),
  event_id UUID REFERENCES events(id),
  transaction_id VARCHAR(100),  -- Payment reference
  resale_listing_id UUID REFERENCES resale_listings(id),

  -- Dispute details
  category VARCHAR(30) NOT NULL,
  -- Values: 'payment', 'resale', 'checkin', 'refund', 'account', 'event'
  subcategory VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  disputed_amount BIGINT,  -- In VND

  -- Status tracking
  status VARCHAR(20) DEFAULT 'open',
  -- Values: 'open', 'investigating', 'pending_response', 'resolved', 'closed', 'arbitration'
  current_tier INTEGER DEFAULT 1,  -- 1, 2, or 3

  -- Assignment
  assigned_to UUID REFERENCES support_agents(id),
  escalated_at TIMESTAMP,
  escalation_reason TEXT,

  -- Resolution
  resolution VARCHAR(30),
  -- Values: 'refund_full', 'refund_partial', 'transfer_completed',
  --         'goodwill_credit', 'no_action', 'user_at_fault', 'fraud_confirmed'
  resolution_amount BIGINT,
  resolution_notes TEXT,
  resolved_by VARCHAR(50),  -- 'automated', 'agent_id', 'senior_id', 'arbitration'
  resolved_at TIMESTAMP,

  -- Evidence
  evidence_blockchain JSONB,  -- { txHashes, ownership, transfers }
  evidence_payment JSONB,     -- { gatewayData, confirmations }
  evidence_logs JSONB,        -- { apiCalls, actions, errors }
  user_evidence_urls TEXT[],  -- Screenshots, etc.

  -- SLA tracking
  sla_deadline TIMESTAMP,
  sla_breached BOOLEAN DEFAULT false,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Dispute messages/thread
CREATE TABLE dispute_messages (
  id UUID PRIMARY KEY,
  dispute_id UUID REFERENCES disputes(id),
  sender_type VARCHAR(20) NOT NULL,  -- 'user', 'agent', 'system'
  sender_id UUID,
  message TEXT NOT NULL,
  attachments TEXT[],
  created_at TIMESTAMP DEFAULT NOW()
);

-- Dispute audit log
CREATE TABLE dispute_audit_log (
  id UUID PRIMARY KEY,
  dispute_id UUID REFERENCES disputes(id),
  action VARCHAR(50) NOT NULL,
  -- Values: 'created', 'assigned', 'escalated', 'message_sent',
  --         'evidence_added', 'resolution_proposed', 'resolved', 'reopened'
  performed_by VARCHAR(50),
  details JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Goodwill credits
CREATE TABLE goodwill_credits (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  dispute_id UUID REFERENCES disputes(id),
  amount BIGINT NOT NULL,  -- In VND
  reason TEXT,
  expires_at TIMESTAMP,  -- Credits expire after 1 year
  used_amount BIGINT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### Backend Dispute Service

```javascript
class DisputeService {
  async fileDispute(userId, disputeData) {
    // 1. Validate dispute window (7 days after event)
    if (disputeData.eventId) {
      const event = await db.events.findById(disputeData.eventId);
      const windowEnd = new Date(event.endDate.getTime() + 7 * 24 * 60 * 60 * 1000);
      if (new Date() > windowEnd) {
        throw new Error('Dispute window closed (7 days after event)');
      }
    }

    // 2. Gather evidence automatically
    const evidence = await this.gatherEvidence(disputeData);

    // 3. Calculate SLA deadline
    const slaDeadline = this.calculateSLA(disputeData.disputedAmount);

    // 4. Create dispute
    const dispute = await db.disputes.create({
      filedByUserId: userId,
      ...disputeData,
      evidenceBlockchain: evidence.blockchain,
      evidencePayment: evidence.payment,
      evidenceLogs: evidence.logs,
      slaDeadline,
      currentTier: 1
    });

    // 5. Attempt auto-resolution
    const autoResolved = await this.autoResolve(dispute);

    if (!autoResolved) {
      // 6. Assign to agent queue
      await this.assignToQueue(dispute);
    }

    // 7. Notify user
    await sendPushNotification(userId, {
      title: 'Dispute Received',
      body: autoResolved
        ? 'Your dispute has been resolved automatically.'
        : `We're reviewing your case. Expected resolution: ${formatDate(slaDeadline)}`
    });

    return dispute;
  }

  async gatherEvidence(disputeData) {
    const evidence = { blockchain: {}, payment: {}, logs: {} };

    // Blockchain evidence
    if (disputeData.ticketId) {
      const nft = await blockchain.getTicketInfo(disputeData.ticketId);
      evidence.blockchain = {
        currentOwner: nft.owner,
        mintedAt: nft.mintTimestamp,
        transfers: await blockchain.getTransferHistory(disputeData.ticketId),
        isUsed: nft.isUsed,
        usedAt: nft.usedTimestamp
      };
    }

    // Payment evidence
    if (disputeData.transactionId) {
      evidence.payment = await paymentGateway.getTransactionDetails(
        disputeData.transactionId
      );
    }

    // Platform logs
    evidence.logs = await db.auditLogs.find({
      userId: disputeData.filedByUserId,
      ticketId: disputeData.ticketId,
      createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
    });

    return evidence;
  }

  calculateSLA(disputedAmount) {
    const now = new Date();
    if (disputedAmount < 500_000) {
      return new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours
    } else if (disputedAmount < 2_000_000) {
      return new Date(now.getTime() + 48 * 60 * 60 * 1000); // 48 hours
    } else {
      return new Date(now.getTime() + 72 * 60 * 60 * 1000); // 72 hours
    }
  }

  async escalate(disputeId, reason) {
    const dispute = await db.disputes.findById(disputeId);

    if (dispute.currentTier >= 3) {
      // Already at highest tier - offer external arbitration
      if (dispute.disputedAmount > 5_000_000) {
        return this.initiateExternalArbitration(dispute);
      }
      throw new Error('Maximum escalation reached');
    }

    await dispute.update({
      currentTier: dispute.currentTier + 1,
      escalatedAt: new Date(),
      escalationReason: reason,
      assignedTo: null // Reassign at new tier
    });

    await this.assignToQueue(dispute);

    await db.disputeAuditLog.create({
      disputeId,
      action: 'escalated',
      performedBy: dispute.assignedTo || 'system',
      details: { fromTier: dispute.currentTier - 1, toTier: dispute.currentTier, reason }
    });
  }

  async resolve(disputeId, resolution, agentId) {
    const dispute = await db.disputes.findById(disputeId);

    // Execute resolution action
    switch (resolution.type) {
      case 'refund_full':
        await refundService.processRefund(dispute.ticketId, dispute.disputedAmount);
        break;
      case 'refund_partial':
        await refundService.processRefund(dispute.ticketId, resolution.amount);
        break;
      case 'transfer_completed':
        await this.forceCompleteTransfer(dispute.resaleListingId);
        break;
      case 'goodwill_credit':
        await this.issueGoodwillCredit(dispute.filedByUserId, resolution.amount, disputeId);
        break;
    }

    await dispute.update({
      status: 'resolved',
      resolution: resolution.type,
      resolutionAmount: resolution.amount,
      resolutionNotes: resolution.notes,
      resolvedBy: agentId,
      resolvedAt: new Date()
    });

    // Notify user
    await sendPushNotification(dispute.filedByUserId, {
      title: 'Dispute Resolved',
      body: this.getResolutionMessage(resolution)
    });
  }

  async issueGoodwillCredit(userId, amount, disputeId) {
    await db.goodwillCredits.create({
      userId,
      disputeId,
      amount,
      reason: 'Dispute resolution - goodwill gesture',
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
    });

    await sendPushNotification(userId, {
      title: 'Credit Added',
      body: `${formatVND(amount)} credit added to your account. Valid for 1 year.`
    });
  }
}
```

#### Fraud Detection & Prevention

```javascript
const FRAUD_INDICATORS = {
  // User behavior patterns
  multipleDisputesShortPeriod: (user) => user.disputeCount30Days > 3,
  highDisputeWinRate: (user) => user.disputeWinRate > 0.9 && user.disputeCount > 5,
  newAccountHighValue: (user) => user.accountAgeDays < 7 && user.disputedAmount > 2_000_000,

  // Transaction patterns
  immediateResaleDispute: (dispute) =>
    dispute.category === 'resale' &&
    dispute.timeSincePurchase < 60 * 60 * 1000, // < 1 hour

  chargebackHistory: (user) => user.chargebackCount > 0,

  // Account patterns
  multipleAccountsSameDevice: (user) => user.deviceSharedAccountCount > 1,
  recentRecovery: (user) => user.lastRecoveryDays < 7
};

async function assessFraudRisk(dispute) {
  const user = await db.users.findById(dispute.filedByUserId);
  const riskFactors = [];
  let riskScore = 0;

  for (const [indicator, check] of Object.entries(FRAUD_INDICATORS)) {
    if (check(user) || check(dispute)) {
      riskFactors.push(indicator);
      riskScore += RISK_WEIGHTS[indicator] || 10;
    }
  }

  if (riskScore > 50) {
    // High risk - flag for manual review
    await dispute.update({
      status: 'investigating',
      notes: `Fraud risk score: ${riskScore}. Factors: ${riskFactors.join(', ')}`
    });
    await escalateToFraudTeam(dispute);
  }

  return { riskScore, riskFactors };
}
```

#### External Arbitration (>5M VND)

| Aspect | Details |
|--------|---------|
| **Provider** | Third-party arbitration service (TBD - local VN provider) |
| **Trigger** | User requests after Tier 3, OR dispute value > 5M VND |
| **Cost** | Split 50/50 between parties (refunded to winner) |
| **Timeline** | 7-14 business days |
| **Binding** | Yes, final decision |
| **Evidence** | All platform data shared with arbitrator |

#### Edge Cases

| Scenario | Handling |
|----------|----------|
| Both parties claim fraud | Freeze assets, escalate to Tier 3, investigate both |
| Dispute filed after window | Reject with explanation, offer goodwill review for edge cases |
| User disputes during event | Priority queue, attempt real-time resolution |
| Organizer disputes platform fee | Separate organizer dispute process, contract terms apply |
| Repeat disputer (abuse) | Rate limit disputes, require deposit for filing |
| Dispute during account recovery | Pause dispute until recovery complete |
| Evidence contradicts user claim | Document clearly, explain blockchain is immutable |

#### User Communication

| Event | Notification |
|-------|--------------|
| Dispute received | Push + Email with case ID and expected timeline |
| Agent assigned | Push: "An agent is reviewing your case" |
| More info needed | Push + Email with questions, 48hr response window |
| Escalated | Push: "Your case has been escalated for senior review" |
| Resolution proposed | Push + Email with details, accept/reject option |
| Dispute resolved | Push + Email + SMS with outcome and any credits/refunds |
| SLA breach | Internal alert + user apology with compensation |

#### Metrics & Reporting

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Tier 1 auto-resolution rate | > 60% | < 50% |
| Average resolution time | < 24 hours | > 36 hours |
| SLA compliance | > 95% | < 90% |
| Customer satisfaction (CSAT) | > 4.0/5.0 | < 3.5 |
| Dispute rate (per 1000 tickets) | < 5 | > 10 |
| Fraud detection accuracy | > 90% | < 80% |

---

## Technical Architecture (High-Level)

### Stack Overview

| Layer | Technology | Purpose |
|-------|------------|---------|
| Mobile App | React Native | Cross-platform iOS/Android |
| Backend | Node.js | API, business logic, queue management |
| Database | PostgreSQL | User data, event data, off-chain metadata |
| Blockchain | Base L2 (Ethereum) | NFT tickets, ownership, smart contracts |
| Wallet | Embedded (Privy/Dynamic/Thirdweb) + ERC-4337 | Invisible wallet with account abstraction |
| Payments | VND (Bank/Momo) + USDT (BasalPay) | Dual payment support |
| eKYC | VNPT eKYC or FPT.AI | Identity verification for resale |

### Hybrid Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        MOBILE APP (React Native)                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      BACKEND API (Node.js)                      │
│  • User management    • Event management    • Queue system      │
│  • Payment processing • eKYC integration    • Analytics         │
└─────────────────────────────────────────────────────────────────┘
           │                                          │
           ▼                                          ▼
┌─────────────────────────────────────────────────────┐    ┌─────────────────────────────┐
│              OFF-CHAIN (Cloud)                      │    │     ON-CHAIN (Base L2)      │
│  • PostgreSQL (user, event data)                    │    │  • NFT Ticket Contract      │
│  • Redis (queue, cache)                             │    │  • Marketplace Contract     │
│  • File Storage (images)                            │    │  • Royalty Logic            │
│  • Handles: Performance, Speed                      │    │  • Ownership Records        │
└─────────────────────────────────────────────────────┘    └─────────────────────────────┘
```

### Smart Contract Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     SMART CONTRACTS (Base L2)                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐         ┌─────────────────────────────┐   │
│  │  TicketNFT      │         │  Marketplace                │   │
│  │  (ERC-721)      │         │                             │   │
│  ├─────────────────┤         ├─────────────────────────────┤   │
│  │ mint()          │◄───────▶│ listForSale()               │   │
│  │ transferFrom()  │         │ buy()                       │   │
│  │ approve()       │         │ cancelListing()             │   │
│  │ setRoyalty()    │         │ enforces price cap          │   │
│  └─────────────────┘         │ distributes royalties       │   │
│         ▲                    └─────────────────────────────┘   │
│         │                                                       │
│  ┌─────────────────┐         ┌─────────────────────────────┐   │
│  │  Paymaster      │         │  EntryPoint (ERC-4337)      │   │
│  │  (Sponsors Gas) │◄───────▶│  (Account Abstraction)      │   │
│  └─────────────────┘         └─────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Key Management Architecture

| Key Type | Owner | Storage | Purpose |
|----------|-------|---------|---------|
| **Platform Minter Key** | Platform backend | Cloud KMS (AWS/GCP) | Signs mint transactions |
| **User Wallet Key** | User | Embedded wallet (MPC/device) | Signs transfers, resale approvals |
| **Paymaster Funding Key** | Platform | HSM / Multi-sig | Funds gas sponsorship |

### Security Considerations

#### 1. Backend Minter Key Protection

| Threat | Mitigation |
|--------|------------|
| Key theft → unlimited minting | Store in Cloud KMS (AWS KMS / GCP Cloud HSM) |
| Single point of failure | Multi-sig for admin functions (upgrade, pause) |
| Unauthorized minting | Rate limiting in contract + off-chain checks |

```solidity
// Contract-level protection
uint256 public maxSupplyPerEvent;
mapping(uint256 => uint256) public mintedPerEvent;

modifier onlyMinter() {
    require(msg.sender == minterAddress, "Not minter");
    _;
}

function mint(...) external onlyMinter {
    require(mintedPerEvent[eventId] < maxSupply[eventId], "Sold out");
    // ... mint logic
}
```

#### 2. User Wallet Security (Embedded Wallet)

| Threat | Mitigation |
|--------|------------|
| Phone lost | Social recovery via email/phone |
| Biometric spoofing | Device secure enclave (iOS/Android) |
| Provider outage | Choose provider with key export option |

#### 3. Paymaster Drain Prevention

| Threat | Mitigation |
|--------|------------|
| Spam transactions | Rate limit per user (e.g., 10 tx/day) |
| Gas budget exhaustion | Daily/monthly caps, alerts |
| Unauthorized usage | Whitelist only app transactions |

```solidity
// Paymaster protection example
mapping(address => uint256) public dailyTxCount;
uint256 public maxDailyTxPerUser = 10;

function validatePaymasterUserOp(...) {
    require(dailyTxCount[user] < maxDailyTxPerUser, "Daily limit");
    dailyTxCount[user]++;
}
```

---

## Open Questions (To Be Decided)

### Payment Flow
- [x] Exact flow for VND payment → NFT minting ✅ Payment Gateway webhook → Immediate mint
- [x] Timeout for pending payments ✅ 15 minutes
- [ ] USDT payment flow via BasalPay (to be detailed)

### Resale Marketplace
- [x] Resale price cap ✅ 110-120% of original price
- [x] Fee structure ✅ Seller pays 10% (5% platform + 5% organizer)
- [x] Escrow mechanism ✅ Platform escrow for VND
- [x] Currency for resale ✅ VND only (Phase 1)

### Check-in
- [x] QR code content and signing mechanism ✅ Token ID + timestamp + nonce + signature, 3-second rotating QR
- [x] Offline check-in capability ✅ **Online required** - atomic DB check needed for race condition prevention
- [x] Ticket burn/mark-used mechanism ✅ Atomic DB update + async blockchain sync

### Edge Cases
- [x] Event cancellation and refund process ✅ Organizer-triggered, original price refund, 7-day postponement window
- [x] Wallet/device lost recovery ✅ Phone OTP + Email recovery, 48-hour security hold, ERC-4337 key rotation
- [x] Dispute resolution ✅ 3-tier escalation, blockchain evidence, 24-72hr SLA, automated + manual resolution

---

## Appendix

### Glossary

| Term | Definition |
|------|------------|
| **NFT** | Non-Fungible Token - unique digital asset representing ticket ownership |
| **ERC-4337** | Account Abstraction standard - enables smart contract wallets with gas sponsorship |
| **Paymaster** | Smart contract that pays gas fees on behalf of users |
| **Base L2** | Layer 2 blockchain by Coinbase, low fees, EVM compatible |
| **VNeID** | Vietnam's national digital ID system (CCCD gan chip) |
| **eKYC** | Electronic Know Your Customer - remote identity verification |

### References

- Project feasibility document (provided by stakeholder)
- Vietnam Digital Industry Law (effective 1/1/2026)
- Resolution 5/2025/NQ-CP
- Base L2 documentation: https://docs.base.org

---

## Change Log

| Date | Version | Changes |
|------|---------|---------|
| 2026-01-15 | 0.1 | Initial requirements - User Registration & Wallet decisions |
| 2026-01-15 | 0.2 | Added Payment → Minting flow, Key management, Security considerations |
| 2026-01-15 | 0.3 | Check-in flow: 3-second rotating QR, nonce field, atomic DB check, multi-layer security, online-only staff devices |
| 2026-01-15 | 0.4 | Event cancellation & refund flow: scenarios, refund amounts, database schema, smart contracts, edge cases |
| 2026-01-15 | 0.5 | Wallet/device recovery flow: scenarios, ERC-4337 key rotation, MPC recovery, SIM swap protection, security holds |
| 2026-01-15 | 0.6 | Dispute resolution flow: 3-tier escalation, auto-resolution rules, SLA by value, fraud detection, external arbitration |
