# Migration Blueprint: NFT-based → Contract Ledger Architecture

## 1. NEW CANONICAL FLOWS

### Flow 1: Payment & Purchase

**User Flow:**

1. User → Frontend: Select tickets
2. Frontend → Backend: `POST /api/payment/initiate {eventId, ticketTypeId, quantity}`
3. Backend → Database: Soft lock tickets (Redis TTL 15min)
4. Backend → Payment Gateway: Create Momo/VNPAY order
5. Backend ← Payment Gateway: Payment URL
6. Backend → Database: Store pending payment `{orderId, userId, ticketIds, amount}`
7. Backend → Frontend: `{paymentUrl, orderId}`
8. Frontend → User: Redirect to payment gateway

**Payment Confirmation:**

1. Payment Gateway → Backend: `POST /webhook/payment {orderId, status, signature}`
2. Backend: Verify signature + idempotency
3. Backend → Database: Mark payment confirmed
4. Backend: Generate `payment_hash = keccak256(orderId, userId, ticketIds, amount, nonce)`
5. Backend → Database: Store `{payment_hash, orderId, userId, ticketIds}`
6. Backend → Frontend (SSE/polling): `{payment_hash, ticketIds}`

**On-Chain Execution:**

1. Frontend: Load user's EOA private key from secure storage
2. Frontend: Build TX = `TicketLedger.purchaseWithHash(eventId, ticketTypeId, quantity, payment_hash)`
3. Frontend: Sign TX with private key
4. Frontend → RPC: `eth_sendRawTransaction(signedTx)`
5. RPC → Contract: Execute `purchaseWithHash()`
6. Contract: Verify payment_hash not used
7. Contract: Mint tickets to `msg.sender` (user's EOA)
8. Contract: Emit `TicketPurchased(ticketId, buyer, eventId, price)`
9. Contract-Sync Service: Listen `TicketPurchased` event
10. Contract-Sync → Database: Update ticket status = MINTED, owner = userAddress

**Key Changes:**

- Backend issues `payment_hash` instead of minting NFT
- Frontend calls contract directly with signed TX
- Contract verifies hash and mints tickets atomically

---

### Flow 2: Resale - Market Sell

**Seller Lists Ticket:**

1. User → Frontend: List ticket for resale `{ticketId, price}`
2. Frontend: Build TX = `Marketplace.listTicket(ticketId, price)`
3. Frontend: Sign + submit TX
4. Contract: Transfer ticket to escrow
5. Contract: Emit `TicketListed(listingId, seller, ticketId, price)`
6. Contract-Sync → Database: Create listing record

**Buyer Purchases:**

1. Buyer → Frontend: Buy listed ticket
2. Frontend → Backend: `POST /api/marketplace/initiate-buy {listingId}`
3. Backend: Soft lock listing
4. Backend → Payment Gateway: Create order
5. [Payment flow same as Purchase]
6. Backend: Generate `payment_hash` for resale
7. Backend → Frontend: `{payment_hash}`
8. Frontend: Build TX = `Marketplace.buyWithHash(listingId, payment_hash)`
9. Frontend: Sign + submit TX
10. Contract: Verify payment_hash
11. Contract: Transfer ticket from escrow to buyer
12. Contract: Record seller payout = `price * 0.95` (5% platform fee)
13. Contract: Emit `TicketSold(listingId, buyer, seller, price)`
14. Contract-Sync → Database: Update ticket owner, listing status = SOLD
15. Contract-Sync → Database: Create payout_pending record for seller

---

### Flow 3: Resale - Limit Buy

**Buyer Places Limit Order:**

1. Buyer → Frontend: Place limit buy order `{eventId, ticketTypeId, maxPrice, quantity}`
2. Frontend → Backend: `POST /api/marketplace/limit-buy {eventId, ticketTypeId, maxPrice, quantity}`
3. Backend → Database: Create limit_order `{userId, eventId, ticketTypeId, maxPrice, quantity, status=OPEN}`

**Order Matching:**

1. [Seller lists ticket at or below maxPrice]
2. Contract: Emit `TicketListed(listingId, seller, ticketId, price)`
3. Contract-Sync: Detect new listing
4. Contract-Sync → Database: Check matching limit orders WHERE `price >= listing.price`
5. Contract-Sync: Find best match (highest price, earliest timestamp)
6. Contract-Sync → Notification: Alert buyer "Match found for your limit order"

**Buyer Confirms & Purchases:**

1. Buyer → Frontend: Confirm match
2. [Payment flow same as Market Buy]
3. Frontend: Build TX = `Marketplace.buyWithHash(listingId, payment_hash)`
4. Contract: Execute trade
5. Contract-Sync → Database: Update limit_order status = FILLED

---

### Flow 4: Check-in (QR per Account)

**QR Generation:**

1. User → Frontend: Navigate to "My Tickets" screen
2. Frontend: Display QR code = `{userAddress, timestamp, signature}`
   - `signature = sign(keccak256(userAddress, timestamp), privateKey)`

**Check-in Process:**

1. Staff Scanner → Staff Frontend: Scan QR
2. Staff Frontend: Parse `{userAddress, timestamp, signature}`
3. Staff Frontend: Verify signature locally (ecrecover)
4. Staff Frontend → Backend: `POST /api/checkin/verify {eventId, userAddress, signature}`
5. Backend: Verify signature again
6. Backend → Database: BEGIN TRANSACTION
7. Backend → Database: `SELECT tickets WHERE owner=userAddress AND eventId=eventId AND used=false FOR UPDATE`
8. Backend: Check ticket exists and not used
9. Backend → Database: `UPDATE tickets SET used=true, used_at=now() WHERE ticketId=X`
10. Backend → Database: COMMIT
11. Backend → Staff Frontend: `{success: true, ticketCount: N, userName: "..."}`

**Async On-Chain Sync:**

1. Backend → Queue: Enqueue `{eventId, userAddress, ticketIds, timestamp}`
2. Worker: Consume queue
3. Worker: Build TX = `TicketLedger.markUsedBatch(ticketIds)`
4. Worker: Sign with backend hot wallet
5. Worker → RPC: Submit TX
6. Contract: Update `ticket.used = true` on-chain
7. Contract: Emit `TicketUsed(ticketId, timestamp)`

**Key Changes:**

- QR contains `userAddress` (not ticketId)
- Backend checks ALL tickets for that user at that event
- On-chain sync is async (doesn't block check-in)

---

### Flow 5: Refund

**Request & Validation:**

1. User → Frontend: Request refund `{ticketId}`
2. Frontend → Backend: `POST /api/refund/request {ticketId, reason}`
3. Backend → Database: Check refund policy (event.refundDeadline, ticket.used)
4. Backend: Validate refund eligible
5. Backend → Database: Create refund_request `{ticketId, userId, amount, status=PENDING}`
6. Backend → Queue: Enqueue refund job

**On-Chain Cancellation:**

1. Worker: Consume refund job
2. Worker: Build TX = `TicketLedger.cancelTicket(ticketId)`
3. Worker: Sign + submit TX
4. Contract: Verify ticket not used
5. Contract: Burn ticket (or mark cancelled)
6. Contract: Emit `TicketCancelled(ticketId, refundAmount)`

**Completion:**

1. Contract-Sync: Listen `TicketCancelled`
2. Contract-Sync → Database: Update ticket status = CANCELLED
3. Contract-Sync → Database: Update refund_request status = APPROVED
4. Backend: Process payout
5. Backend → Payment Gateway: Initiate refund to user's payment method
6. Backend → Database: Update refund_request status = COMPLETED
7. Backend → Notification: SMS/email "Refund processed"

---

### Flow 6: Proof-of-Entry Badge

**Attendance Recording:**

1. [After successful check-in]
2. Contract-Sync: Detect `TicketUsed(ticketId, userAddress, eventId)`
3. Contract-Sync → Database: Record attendance `{userId, eventId, timestamp}`

**Badge Minting (Daily Batch):**

1. Badge Worker: Query Database for new attendances without badges
2. Badge Worker: Group by userAddress
3. Badge Worker: Build TX = `BadgeNFT.mintBatch(userAddresses[], eventIds[])`
4. Badge Worker: Sign + submit TX
5. Contract: Mint Badge NFT to each user
6. Contract: Emit `BadgeMinted(userAddress, eventId, badgeId, tier)`
7. Contract-Sync: Listen `BadgeMinted`
8. Contract-Sync → Database: Update user profile `{badgeCount++, tier=recalculate()}`

**Tiered Discount on Next Purchase:**

1. Frontend → Backend: `POST /api/payment/initiate {eventId, ...}`
2. Backend → Database: Check user tier (based on badge count)
3. Backend: Apply tier discount (e.g., tier 2 = 10% off)
4. Backend: Generate payment with discounted price
5. [Rest of purchase flow same]

---

## 2. CONTRACT SURFACE

### A. TicketLedger.sol (replaces TicketNFT)

**Storage Schema:**
solidity
struct Ticket {
uint256 ticketId;
uint256 eventId;
uint256 ticketTypeId;
address owner;
uint256 price;
bool used;
uint256 purchasedAt;
uint256 usedAt;
}

mapping(uint256 => Ticket) public tickets;
mapping(bytes32 => bool) public usedPaymentHashes;
mapping(address => uint256[]) public ownerTickets; // owner => ticketIds
uint256 public ticketCounter;

**Functions:**
solidity
function purchaseWithHash(
uint256 eventId,
uint256 ticketTypeId,
uint256 quantity,
bytes32 paymentHash
) external returns (uint256[] memory ticketIds);

function transferTicket(uint256 ticketId, address to) external;

function markUsedBatch(uint256[] calldata ticketIds) external onlyRole(CHECKIN_ROLE);

function cancelTicket(uint256 ticketId) external onlyRole(REFUND_ROLE);

function getTicketsByOwner(address owner) external view returns (uint256[] memory);

function getTicketsByEvent(uint256 eventId) external view returns (uint256[] memory);

**Events:**
solidity
event TicketPurchased(uint256 indexed ticketId, address indexed buyer, uint256 eventId, uint256 price, uint256 timestamp);
event TicketTransferred(uint256 indexed ticketId, address indexed from, address indexed to);
event TicketUsed(uint256 indexed ticketId, address indexed owner, uint256 eventId, uint256 timestamp);
event TicketCancelled(uint256 indexed ticketId, uint256 refundAmount);

**Invariants:**

- `usedPaymentHashes[hash]` must be set atomically with ticket minting
- `ticket.used == true` is irreversible
- `ticket.owner` must match `ownerTickets` mapping
- Only `CHECKIN_ROLE` can mark tickets used
- Only `REFUND_ROLE` can cancel tickets

---

### B. Marketplace.sol

**Storage Schema:**
solidity
struct Listing {
uint256 listingId;
uint256 ticketId;
address seller;
uint256 price;
bool active;
uint256 listedAt;
}

struct LimitOrder {
uint256 orderId;
address buyer;
uint256 eventId;
uint256 ticketTypeId;
uint256 maxPrice;
uint256 quantity;
uint256 filled;
bool active;
}

mapping(uint256 => Listing) public listings;
mapping(uint256 => LimitOrder) public limitOrders;
mapping(bytes32 => bool) public usedPaymentHashes;
mapping(address => uint256) public pendingPayouts; // seller => amount
uint256 public listingCounter;
uint256 public orderCounter;

**Functions:**
solidity
function listTicket(uint256 ticketId, uint256 price) external returns (uint256 listingId);

function cancelListing(uint256 listingId) external;

function buyWithHash(uint256 listingId, bytes32 paymentHash) external;

function placeLimitOrder(uint256 eventId, uint256 ticketTypeId, uint256 maxPrice, uint256 quantity)
external returns (uint256 orderId);

function cancelLimitOrder(uint256 orderId) external;

function getPendingPayout(address seller) external view returns (uint256);

**Events:**
solidity
event TicketListed(uint256 indexed listingId, address indexed seller, uint256 ticketId, uint256 price);
event TicketSold(uint256 indexed listingId, address indexed buyer, address indexed seller, uint256 price);
event ListingCancelled(uint256 indexed listingId);
event LimitOrderPlaced(uint256 indexed orderId, address indexed buyer, uint256 eventId, uint256 maxPrice);
event LimitOrderFilled(uint256 indexed orderId, uint256 listingId);

**Invariants:**

- Ticket must be transferred to Marketplace contract when listed
- `pendingPayouts[seller]` increments on sale (`price * 0.95`)
- Platform fee = 5% goes to treasury
- `usedPaymentHashes` prevents double-spend

---

### C. Handler.sol (EIP-7702 Delegation)

**Storage Schema:**
solidity
mapping(address => bool) public authorizedPaymasters;

**Functions:**
solidity
function executeWithPaymaster(
address target,
bytes calldata data,
address paymaster
) external returns (bytes memory);

function addPaymaster(address paymaster) external onlyOwner;

**Events:**
solidity
event PaymasterUsed(address indexed user, address indexed paymaster, uint256 gasUsed);

**Invariants:**

- Only authorized paymasters can sponsor gas
- User's EOA delegates to Handler via EIP-7702
- Handler forwards call to target contract

---

### D. Paymaster.sol

**Storage Schema:**
solidity
mapping(address => uint256) public gasCredits; // user => wei balance

**Functions:**
solidity
function refillGas(address user) external payable onlyRole(REFILL_ROLE);

function sponsorTransaction(address user, uint256 gasEstimate) external returns (bool);

**Events:**
solidity
event GasRefilled(address indexed user, uint256 amount);
event TransactionSponsored(address indexed user, uint256 gasCost);

**Invariants:**

- `gasCredits[user]` decremented per TX
- Backend refills gas before user submits TX

---

### E. BadgeNFT.sol (ERC-721)

**Storage Schema:**
solidity
struct Badge {
uint256 badgeId;
address owner;
uint256 eventId;
uint256 mintedAt;
}

mapping(uint256 => Badge) public badges;
mapping(address => uint256[]) public ownerBadges;
mapping(address => uint256) public badgeCount; // for tier calculation

**Functions:**
solidity
function mintBatch(address[] calldata users, uint256[] calldata eventIds)
external onlyRole(MINTER_ROLE);

function getBadgesByOwner(address owner) external view returns (uint256[] memory);

function getUserTier(address user) external view returns (uint256);

**Events:**
solidity
event BadgeMinted(address indexed owner, uint256 eventId, uint256 badgeId, uint256 tier);

**Invariants:**

- One badge per (user, event) pair
- `badgeCount[user]` determines tier (0-2: tier 1, 3-5: tier 2, 6+: tier 3)

---

## 3. BACKEND RESPONSIBILITIES

### A. Payment Hash Issuance

**Service:** `payment-orchestrator`

**API Endpoints:**
typescript
POST /api/payment/initiate
Body: {eventId, ticketTypeId, quantity}
Response: {paymentUrl, orderId}

POST /webhook/payment (from Momo/VNPAY)
Body: {orderId, status, signature}
Response: 200 OK

GET /api/payment/hash/:orderId (polling by frontend)
Response: {payment_hash, ticketIds, status}

**Logic:**

1. Verify payment webhook signature
2. Check idempotency (orderId already processed?)
3. Generate `payment_hash = keccak256(orderId, userId, ticketIds, amount, nonce)`
4. Store in DB: `payment_hashes` table
5. Emit SSE event or allow polling

---

### B. Contract Verification

**Service:** `contract-sync-service`

**Responsibilities:**

- Listen to all contract events via WebSocket RPC
- Index events into PostgreSQL
- Reconcile DB state with on-chain state
- Detect anomalies (e.g., ticket minted but no payment record)

**Database Schema:**
sql
CREATE TABLE indexed_events (
id SERIAL PRIMARY KEY,
event_name VARCHAR(100),
contract_address VARCHAR(42),
block_number BIGINT,
tx_hash VARCHAR(66),
log_index INT,
data JSONB,
indexed_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_event_name ON indexed_events(event_name);
CREATE INDEX idx_block_number ON indexed_events(block_number);

---

### C. Withdrawal Review

**Service:** `payout-service`

**API Endpoints:**
typescript
POST /api/payout/request
Body: {userId}
Response: {requestId, amount, status}

GET /api/payout/pending (admin only)
Response: [{requestId, userId, amount, createdAt}]

POST /api/payout/approve (admin only)
Body: {requestId}
Response: {success: true}

**Logic:**

1. User requests withdrawal
2. Backend checks `pendingPayouts[userAddress]` on-chain
3. Create `payout_request` record (status=PENDING)
4. Admin reviews + approves
5. Backend initiates bank transfer
6. Update status=COMPLETED

---

### D. Limit Order Matching

**Service:** `marketplace-service`

**Background Job:**
typescript
// Runs every time TicketListed event detected
async function matchLimitOrders(listing: Listing) {
const orders = await db.query(

        SELECT * FROM limit_orders
        WHERE event_id = $1
        AND ticket_type_id = $2
        AND max_price >= $3
        AND active = true
        ORDER BY max_price DESC, created_at ASC

, [listing.eventId, listing.ticketTypeId, listing.price]);

if (orders.length > 0) {
const bestOrder = orders[0];
await notificationService.send(bestOrder.userId, {
type: 'LIMIT_ORDER_MATCH',
listingId: listing.listingId,
price: listing.price
});
}
}

---

## 4. FRONTEND RESPONSIBILITIES

### A. EOA Creation + Key Storage

**Module:** `wallet-manager` (new)

**API:**
typescript
interface WalletManager {
createWallet(): Promise<{address: string, mnemonic: string}>;
storePrivateKey(privateKey: string): Promise<void>;
loadPrivateKey(): Promise<string>;
signTransaction(tx: Transaction): Promise<string>;
}

**Implementation:**
typescript
import { Wallet } from 'ethers';
import as SecureStore from 'expo-secure-store'; // React Native

export class WalletManager {
async createWallet() {
const wallet = Wallet.createRandom();
await SecureStore.setItemAsync('privateKey', wallet.privateKey);
await SecureStore.setItemAsync('mnemonic', wallet.mnemonic.phrase);
return {
address: wallet.address,
mnemonic: wallet.mnemonic.phrase
};
}

async loadPrivateKey() {
return await SecureStore.getItemAsync('privateKey');
}

async signTransaction(tx: Transaction) {
const privateKey = await this.loadPrivateKey();
const wallet = new Wallet(privateKey);
return await wallet.signTransaction(tx);
}
}

**Security:**

- Private key stored in device secure enclave (iOS Keychain / Android Keystore)
- Backup mnemonic encrypted + stored on backend (optional recovery)

---

### B. TX Signing + Submission

**Module:** `transaction-service` (new)

**API:**
typescript
interface TransactionService {
buildPurchaseTx(eventId: number, quantity: number, paymentHash: string): Promise<Transaction>;
submitTransaction(signedTx: string): Promise<{txHash: string}>;
waitForConfirmation(txHash: string): Promise<Receipt>;
}

**Implementation:**
typescript
import { ethers } from 'ethers';

export class TransactionService {
private provider = new ethers.JsonRpcProvider(RPCURL);

async buildPurchaseTx(eventId: number, quantity: number, paymentHash: string) {
const contract = new ethers.Contract(TICKET_LEDGER_ADDRESS, ABI, this.provider);
const data = contract.interface.encodeFunctionData('purchaseWithHash', [
eventId, 1, quantity, paymentHash
]);

       const gasEstimate = await this.provider.estimateGas({
           to: TICKET_LEDGER_ADDRESS,
           data
       });

       return {
           to: TICKET_LEDGER_ADDRESS,
           data,
           gasLimit: gasEstimate,
           gasPrice: await this.provider.getFeeData().gasPrice
       };

}

async submitTransaction(signedTx: string) {
const tx = await this.provider.broadcastTransaction(signedTx);
return { txHash: tx.hash };
}

async waitForConfirmation(txHash: string) {
return await this.provider.waitForTransaction(txHash, 1);
}
}

---

### C. QR Generation (per Account)

**Module:** `checkin-qr` (update existing)

**API:**
typescript
interface CheckinQR {
generateQR(userAddress: string): Promise<string>; // returns QR data URL
}

**Implementation:**
typescript
import QRCode from 'qrcode';
import { ethers } from 'ethers';

export class CheckinQR {
async generateQR(userAddress: string) {
const timestamp = Date.now();
const message = ethers.solidityPackedKeccak256(
['address', 'uint256'],
[userAddress, timestamp]
);

       const privateKey = await walletManager.loadPrivateKey();
       const wallet = new ethers.Wallet(privateKey);
       const signature = await wallet.signMessage(ethers.getBytes(message));

       const qrData = JSON.stringify({
           address: userAddress,
           timestamp,
           signature
       });

       return await QRCode.toDataURL(qrData);

}
}

---

## 5. PR PLAN

### PR #1: Contract Foundation - TicketLedger

**Scope:**

- Create `TicketLedger.sol` with storage schema
- Implement `purchaseWithHash()`, `transferTicket()`, `getTicketsByOwner()`
- Write Foundry tests (10 tests)

**Definition of Done:**

- [ ] Contract compiles without warnings
- [ ] All functions have NatSpec comments
- [ ] Test coverage ≥ 90%
- [ ] Tests pass: `forge test --match-contract TicketLedgerTest`
- [ ] Gas snapshot generated: `forge snapshot`

**Tests:**
solidity
// test/TicketLedger.t.sol
function testPurchaseWithHash() // happy path
function testPurchaseWithHash_RevertIfHashUsed() // double-spend
function testPurchaseWithHash_RevertIfInvalidHash() // unauthorized hash
function testTransferTicket() // ownership change
function testTransferTicket_RevertIfNotOwner() // unauthorized transfer
function testGetTicketsByOwner() // query tickets
function testMarkUsedBatch() // check-in
function testMarkUsedBatch_RevertIfNotRole() // access control
function testCancelTicket() // refund
function testCancelTicket_RevertIfUsed() // cannot refund used ticket

---

### PR #2: Contract - Marketplace

**Scope:**

- Create `Marketplace.sol`
- Implement `listTicket()`, `buyWithHash()`, `placeLimitOrder()`
- Integrate with TicketLedger (ticket escrow)
- Write Foundry tests (12 tests)

**Definition of Done:**

- [ ] Contract compiles
- [ ] Marketplace can hold tickets in escrow
- [ ] `pendingPayouts` correctly tracks seller balances
- [ ] Test coverage ≥ 90%
- [ ] Tests pass: `forge test --match-contract MarketplaceTest`

**Tests:**
solidity
function testListTicket() // create listing
function testListTicket_RevertIfNotOwner() // unauthorized list
function testBuyWithHash() // purchase listed ticket
function testBuyWithHash_RevertIfHashUsed() // double-spend
function testBuyWithHash_UpdatesPendingPayouts() // seller balance
function testCancelListing() // delist ticket
function testPlaceLimitOrder() // create limit order
function testPlaceLimitOrder_RevertIfInvalidPrice() // validation
function testCancelLimitOrder() // cancel order
function testPlatformFee() // 5% fee calculation
function testEscrowTransfer() // ticket custody
function testGetPendingPayout() // query seller balance

---

### PR #3: Contract - Handler + Paymaster (EIP-7702)

**Scope:**

- Create `Handler.sol` for delegation
- Update `Paymaster.sol` for per-tx refill
- Implement `refillGas()`, `sponsorTransaction()`
- Write Foundry tests (8 tests)

**Definition of Done:**

- [ ] Handler can forward calls to TicketLedger
- [ ] Paymaster deducts gas credits correctly
- [ ] Test coverage ≥ 85%
- [ ] Tests pass: `forge test --match-contract HandlerTest --match-contract PaymasterTest`

**Tests:**
solidity
function testExecuteWithPaymaster() // delegated call
function testExecuteWithPaymaster_RevertIfUnauthorized() // paymaster not whitelisted
function testRefillGas() // add gas credits
function testSponsorTransaction() // deduct gas credits
function testSponsorTransaction_RevertIfInsufficientCredits() // out of gas
function testPaymasterAuthorization() // add/remove paymaster
function testGasAccounting() // credits balance
function testMultipleTransactions() // sequential gas usage

---

### PR #4: Contract - BadgeNFT

**Scope:**

- Create `BadgeNFT.sol` (ERC-721)
- Implement `mintBatch()`, `getUserTier()`
- Write Foundry tests (6 tests)

**Definition of Done:**

- [ ] Badge minting restricted to MINTER_ROLE
- [ ] Tier calculation correct (0-2: tier 1, 3-5: tier 2, 6+: tier 3)
- [ ] Test coverage ≥ 90%
- [ ] Tests pass: `forge test --match-contract BadgeNFTTest`

**Tests:**
solidity
function testMintBatch() // mint badges
function testMintBatch_RevertIfNotRole() // access control
function testGetUserTier() // tier calculation
function testGetBadgesByOwner() // query badges
function testBadgeCount() // count tracking
function testDuplicateBadge_RevertIfExists() // one badge per event

---

### PR #5: Backend - Payment Hash Issuance

**Scope:**

- Update `payment-orchestrator` to generate payment hashes
- Add `/api/payment/hash/:orderId` endpoint
- Store hashes in `payment_hashes` table
- Write integration tests (5 tests)

**Definition of Done:**

- [ ] Webhook signature verification works for Momo + VNPAY
- [ ] Payment hash generated correctly: `keccak256(orderId, userId, ticketIds, amount, nonce)`
- [ ] Idempotency check prevents duplicate processing
- [ ] Tests pass: `pnpm test:integration payment-orchestrator`
- [ ] API documented in Swagger

**Tests:**
typescript
describe('Payment Hash Issuance', () => {
it('should generate payment hash after webhook', async () => {});
it('should reject invalid webhook signature', async () => {});
it('should handle idempotent webhook calls', async () => {});
it('should return payment hash via polling', async () => {});
it('should expire payment hash after 24h', async () => {});
});

---

### PR #6: Backend - Contract Sync Service

**Scope:**

- Create `contract-sync-service` with event listener
- Index `TicketPurchased`, `TicketSold`, `TicketUsed`, `BadgeMinted` events
- Reconcile DB state with on-chain state
- Write unit tests (8 tests)

**Definition of Done:**

- [ ] Service connects to RPC WebSocket
- [ ] Events indexed into `indexed_events` table
- [ ] DB state updated (tickets, listings, badges)
- [ ] Handles RPC disconnection + reconnection
- [ ] Tests pass: `pnpm test services/contract-sync`

**Tests:**
typescript
describe('Contract Sync', () => {
it('should index TicketPurchased event', async () => {});
it('should update ticket owner in DB', async () => {});
it('should index TicketSold event', async () => {});
it('should update listing status', async () => {});
it('should index TicketUsed event', async () => {});
it('should index BadgeMinted event', async () => {});
it('should handle missed blocks on reconnect', async () => {});
it('should detect state mismatch', async () => {});
});

---

### PR #7: Backend - Marketplace Service (Limit Orders)

**Scope:**

- Add `POST /api/marketplace/limit-buy` endpoint
- Implement order matching logic
- Integrate with notification service
- Write integration tests (6 tests)

**Definition of Done:**

- [ ] Limit orders stored in `limit_orders` table
- [ ] Matching triggered on `TicketListed` event
- [ ] Buyer notified when match found
- [ ] Tests pass: `pnpm test:integration marketplace-service`
- [ ] API documented in Swagger

**Tests:**
typescript
describe('Limit Orders', () => {
it('should create limit order', async () => {});
it('should match order when listing price <= maxPrice', async () => {});
it('should prioritize highest price order', async () => {});
it('should notify buyer on match', async () => {});
it('should cancel limit order', async () => {});
it('should mark order filled after purchase', async () => {});
});

---

### PR #8: Backend - Payout Service

**Scope:**

- Create `payout-service`
- Add `POST /api/payout/request`, `POST /api/payout/approve` endpoints
- Integrate with on-chain `pendingPayouts` query
- Write integration tests (5 tests)

**Definition of Done:**

- [ ] Payout requests stored in `payout_requests` table
- [ ] Admin approval flow works
- [ ] On-chain balance verified before payout
- [ ] Tests pass: `pnpm test:integration
