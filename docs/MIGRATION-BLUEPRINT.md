# Migration Blueprint: NFT-based → Contract Ledger Architecture

## 0. GAS SPONSORSHIP MODEL

**Principles:**

1. User creates an account and frontend creates a local EOA wallet.
2. Backend sends a one-time native-token prefund to that wallet so the first user transaction has gas.
3. Every user-initiated on-chain transaction is sent as an EIP-7702 delegated transaction pointing the EOA to `Handler.sol`.
4. `Handler.executeBatch()` performs the business call (`TicketLedger` or `Marketplace`) and then calls `Paymaster.refillGas()` in the same transaction.
5. Gas is refilled after the business state change succeeds, so the wallet is replenished automatically without another backend round-trip.
6. This model does not require a third-party bundler. The user still sends a normal transaction from their EOA; EIP-7702 only changes the execution logic for that transaction.

**Why this model exists:**

- A normal EOA can only target one contract call at a time.
- Delegating to `Handler.sol` via EIP-7702 gives the EOA batched smart-account behavior while keeping the same address.
- The one-time prefund solves the bootstrap problem for the very first transaction.

## 1. NEW CANONICAL FLOWS

### Flow 0: Wallet Bootstrap + Initial Gas Prefund

1. User → Frontend: Create account
2. Frontend: Create local EOA wallet
3. Frontend → Backend: Register wallet address `{userId, walletAddress}`
4. Backend: Check wallet has not been prefunded before
5. Backend → User EOA: Send one-time native-token prefund
6. Backend → Database: Store `{walletAddress, prefundTxHash, prefundAmount, fundedAt}`
7. Backend → Frontend: Return `{prefunded: true, prefundTxHash}`
8. Frontend: Wait for prefund confirmation before enabling the first delegated transaction

**Key Changes:**

- Backend participates in gas only once during wallet bootstrap
- The initial prefund is just enough to get the first user transaction mined
- All later gas replenishment is handled on-chain by `Handler + Paymaster`

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

**On-Chain Execution (Delegated + Same-TX Refill):**

1. Backend: Sign purchase authorization off-chain using EIP-712
   - `signature = signTypedData(domain, PURCHASE_TYPE, {eventId, ticketTypeId, quantity, paymentHash, buyer})`
2. Backend → Frontend: Send `{paymentHash, signature}`
3. Frontend: Load user's EOA private key from secure storage
4. Frontend: Encode business call = `TicketLedger.purchaseWithSignature(eventId, ticketTypeId, quantity, paymentHash, signature)`
5. Frontend: Encode delegated call = `Handler.executeBatch([{target: TicketLedger, value: 0, data: purchaseCall}])`
6. Frontend: Build EIP-7702 transaction:
   - `authorizationList` delegates the user's EOA to `Handler.sol` for this tx
   - `to` = user's EOA
   - `data` = encoded `Handler.executeBatch(...)`
7. Frontend: Sign delegated transaction with the user's private key
8. Frontend → RPC: Submit signed delegated transaction directly
9. Handler: Execute batched business call against `TicketLedger`
10. TicketLedger: Recover signer from EIP-712 signature using `ECDSA.recover()`
11. TicketLedger: Verify signer has `PAYMENT_HASH_ROLE`
12. TicketLedger: Verify paymentHash not used
13. TicketLedger: Mint tickets to `msg.sender` (user's EOA)
14. Handler: Measure gas used and call `Paymaster.refillGas(user, gasCostWei)` in the same tx
15. Paymaster: Transfer refill amount back to the user's EOA
16. TicketLedger: Emit `TicketPurchased(ticketId, buyer, eventId, price)`
17. Contract-Sync Service: Listen `TicketPurchased` event
18. Contract-Sync → Database: Update ticket status = MINTED, owner = userAddress

**Key Changes:**

- Backend signs purchase authorization off-chain using EIP-712 but is not in the per-tx gas loop
- User wallet receives gas from backend only once during wallet bootstrap
- Every user tx attaches an EIP-7702 delegation to `Handler.sol`
- `Handler.executeBatch()` performs the business call and triggers `Paymaster.refillGas()` in the same tx
- No third-party bundler is required for gas sponsorship

---

### Flow 2: Resale - Market Sell

**Seller Lists Ticket:**

1. User → Frontend: List ticket for resale `{ticketId, price}`
2. Frontend: Encode business call = `Marketplace.listTicket(ticketId, price)`
3. Frontend: Build delegated tx = `Handler.executeBatch([{target: Marketplace, value: 0, data: listCall}])`
4. Frontend: Sign + submit delegated tx
5. Handler: Call `Marketplace.listTicket()` then `Paymaster.refillGas()` in the same tx
6. Marketplace: Transfer ticket to escrow
7. Marketplace: Emit `TicketListed(listingId, seller, ticketId, price)`
8. Contract-Sync → Database: Create listing record

**Buyer Purchases:**

1. Buyer → Frontend: Buy listed ticket
2. Frontend → Backend: `POST /api/marketplace/initiate-buy {listingId}`
3. Backend: Soft lock listing
4. Backend → Payment Gateway: Create order
5. [Payment flow same as Purchase]
6. Backend: Generate `payment_hash` for resale
7. Backend: Sign resale authorization using EIP-712
   - `signature = signTypedData(domain, BUY_TYPE, {listingId, paymentHash, buyer})`
8. Backend → Frontend: `{paymentHash, signature}`
9. Frontend: Encode business call = `Marketplace.buyWithSignature(listingId, paymentHash, signature)`
10. Frontend: Build delegated tx = `Handler.executeBatch([{target: Marketplace, value: 0, data: buyCall}])`
11. Frontend: Sign + submit delegated tx
12. Handler: Call `Marketplace.buyWithSignature()` then `Paymaster.refillGas()` in the same tx
13. Marketplace: Recover signer from EIP-712 signature
14. Marketplace: Verify signer has `PAYMENT_HASH_ROLE`
15. Marketplace: Verify payment_hash
16. Marketplace: Transfer ticket from escrow to buyer
17. Marketplace: Record seller payout = `price * 0.95` (5% platform fee)
18. Marketplace: Emit `TicketSold(listingId, buyer, seller, price)`
19. Contract-Sync → Database: Update ticket owner, listing status = SOLD
20. Contract-Sync → Database: Create payout_pending record for seller

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
3. Frontend: Encode business call = `Marketplace.buyWithSignature(listingId, paymentHash, signature)`
4. Frontend: Build delegated tx = `Handler.executeBatch([{target: Marketplace, value: 0, data: buyCall}])`
5. Frontend: Sign + submit delegated tx
6. Handler: Call `Marketplace.buyWithSignature()` then `Paymaster.refillGas()` in the same tx
7. Marketplace: Execute trade
8. Contract-Sync → Database: Update limit_order status = FILLED

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

// EIP-712 domain separator (immutable for signature verification)
bytes32 private immutable DOMAIN_SEPARATOR;

// Type hashes for EIP-712
bytes32 private constant PURCHASE_TYPEHASH =
keccak256("Purchase(uint256 eventId,uint256 ticketTypeId,uint256 quantity,bytes32 paymentHash,address buyer)");

**Functions:**
solidity
function purchaseWithSignature(
uint256 eventId,
uint256 ticketTypeId,
uint256 quantity,
bytes32 paymentHash,
bytes calldata signature
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

**Signature Verification Logic:**
solidity
// Inside purchaseWithSignature()
bytes32 digest = \_hashTypedDataV4(keccak256(abi.encode(
PURCHASE_TYPEHASH,
eventId,
ticketTypeId,
quantity,
paymentHash,
msg.sender
)));

address signer = ECDSA.recover(digest, signature);
require(hasRole(PAYMENT_HASH_ROLE, signer), "TicketLedger: invalid signature");

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

function buyWithSignature(
uint256 listingId,
bytes32 paymentHash,
bytes calldata signature
) external;

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

### C. Handler.sol (EIP-7702 Delegated Executor)

**Storage Schema:**
solidity
struct Call {
address target;
uint256 value;
bytes data;
}

address public paymaster;
mapping(address => bool) public allowedTargets;

**Functions:**
solidity
function executeBatch(Call[] calldata calls) external returns (bytes[] memory results);

function setPaymaster(address paymaster_) external onlyOwner;

function addAllowedTarget(address target) external onlyOwner;

function removeAllowedTarget(address target) external onlyOwner;

**Events:**
solidity
event BatchExecuted(address indexed user, uint256 callCount, uint256 gasCostWei);
event GasRefillRequested(address indexed user, uint256 gasCostWei);

**Execution Logic:**
solidity
function executeBatch(Call[] calldata calls) external returns (bytes[] memory results) {
uint256 gasStart = gasleft();

// Execute business calls first (TicketLedger / Marketplace)
for (uint256 i = 0; i < calls.length; i++) {
require(allowedTargets[calls[i].target], "Handler: target not allowed");
}

// After successful state changes, refill the user's gas in the same tx
uint256 gasUsed = (gasStart - gasleft()) + HANDLER_OVERHEAD;
uint256 gasCostWei = gasUsed * tx.gasprice;
IPaymaster(paymaster).refillGas(payable(msg.sender), gasCostWei);
}

**Invariants:**

- User's EOA delegates to `Handler` via EIP-7702 on every tx
- `Handler.executeBatch()` solves the EOA single-target limitation by batching multiple calls atomically
- Only whitelisted business targets (`TicketLedger`, `Marketplace`) can be called
- `Handler` always requests `Paymaster.refillGas()` after successful business execution
- This flow does not rely on `EntryPoint` or any third-party bundler

---

### D. Paymaster.sol (Same-TX Gas Refill Treasury)

**Storage Schema:**
solidity
mapping(address => bool) public authorizedHandlers;
mapping(address => uint256) public totalGasSponsored; // user => cumulative wei refunded
uint256 public maxRefillPerTx;

**Functions:**
solidity
function refillGas(address payable user, uint256 gasCostWei)
external returns (uint256 refunded);

function addHandler(address handler) external onlyOwner;

function removeHandler(address handler) external onlyOwner;

function deposit() external payable onlyOwner;

function withdraw(address payable to, uint256 amount) external onlyOwner;

**Events:**
solidity
event GasRefilled(address indexed user, uint256 gasCostWei, uint256 refunded);
event HandlerAuthorizationUpdated(address indexed handler, bool allowed);

**Invariants:**

- Backend/team funds the Paymaster treasury, but backend only prefunds the user wallet once during onboarding
- Only authorized `Handler` contracts can call `refillGas()`
- Gas refill happens in the same transaction immediately after the business call succeeds
- Subsequent user transactions do not require another backend top-up
- Paymaster reimburses gas after-the-fact; it does not use a bundler-based sponsorship model

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

### A. Wallet Bootstrap + Initial Gas Prefund

**Service:** `wallet-bootstrap-service`

**API Endpoints:**
typescript
POST /api/wallet/register
Body: {walletAddress}
Response: {prefunded: boolean, prefundTxHash?: string}

GET /api/wallet/prefund/:walletAddress
Response: {funded: boolean, txHash?: string, amount?: string}

**Logic:**

1. Frontend creates an EOA locally and registers the address with backend
2. Backend checks whether that wallet has already received the bootstrap prefund
3. Backend sends a small native-token balance directly to the user's EOA
4. Backend stores `prefund_tx_hash`, funded amount, and timestamp
5. Frontend waits for confirmation before allowing the first delegated transaction
6. This bootstrap transfer happens once only; later gas refill is handled on-chain by `Handler + Paymaster`

---

### B. Payment Hash Issuance

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
4. Sign using EIP-712:
   - `domain = {name: "TicketLedger", version: "1", chainId: CHAIN_ID, verifyingContract: TICKET_LEDGER_ADDRESS}`
   - `typeHash = keccak256("Purchase(uint256 eventId,uint256 ticketTypeId,uint256 quantity,bytes32 paymentHash,address buyer)")`
   - `digest = hashTypedData(domain, typeHash, {eventId, ticketTypeId, quantity, paymentHash, buyer})`
   - `signature = sign(digest, backendPrivateKey)` (where backend has PAYMENT_HASH_ROLE)
5. Store in DB: `payment_hashes` table with signature
6. Return to frontend: `{paymentHash, signature, ticketIds}`
7. Emit SSE event or allow polling
8. Do not perform per-tx gas top-ups here; gas refill after onboarding is handled in the delegated transaction itself

---

### C. Contract Verification

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

### D. Withdrawal Review

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

### E. Limit Order Matching

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

### A. EOA Creation + Delegation Readiness

**Module:** `wallet-manager` (new)

**API:**
typescript
interface WalletManager {
createWallet(): Promise<{address: string, mnemonic: string}>;
loadPrivateKey(): Promise<string>;
waitForInitialPrefund(address: string): Promise<void>;
build7702Authorization(handlerAddress: string): Promise<unknown>;
signDelegatedTransaction(tx: Transaction): Promise<string>;
}

**Implementation:**
typescript
import { Wallet } from 'ethers';
import * as SecureStore from 'expo-secure-store'; // React Native

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

async waitForInitialPrefund(address: string) {
// Poll backend/RPC until the one-time bootstrap transfer is confirmed
}

async build7702Authorization(handlerAddress: string) {
const privateKey = await this.loadPrivateKey();
const wallet = new Wallet(privateKey);

return await sign7702Authorization(wallet, {
chainId: CHAIN_ID,
contractAddress: handlerAddress
});
}

async signDelegatedTransaction(tx: Transaction) {
const privateKey = await this.loadPrivateKey();
const wallet = new Wallet(privateKey);
return await wallet.signTransaction(tx);
}
}

**Security:**

- Private key stored in device secure enclave (iOS Keychain / Android Keystore)
- Backup mnemonic encrypted + stored on backend (optional recovery)
- Backend only sends the bootstrap prefund once after wallet registration
- Every later tx is still signed by the user's EOA; delegation does not transfer key custody

---

### B. Delegated TX Building + Submission

**Module:** `delegated-transaction-service` (new)

**API:**
typescript
interface DelegatedTransactionService {
buildPurchaseTx(eventId: number, ticketTypeId: number, quantity: number, paymentHash: string, signature: string): Promise<Transaction>;
buildListTicketTx(ticketId: number, price: number): Promise<Transaction>;
buildBuyListingTx(listingId: number, paymentHash: string, signature: string): Promise<Transaction>;
submitTransaction(signedTx: string): Promise<{txHash: string}>;
waitForConfirmation(txHash: string): Promise<Receipt>;
}

**Implementation:**
typescript
import { ethers } from 'ethers';

type Call = {
target: string;
value: bigint;
data: string;
};

export class DelegatedTransactionService {
private provider = new ethers.JsonRpcProvider(RPC_URL);
private handler = new ethers.Interface(HANDLER_ABI);
private ticketLedger = new ethers.Interface(TICKET_LEDGER_ABI);

async buildPurchaseTx(
eventId: number,
ticketTypeId: number,
quantity: number,
paymentHash: string,
signature: string
) {
const purchaseCall = this.ticketLedger.encodeFunctionData('purchaseWithSignature', [
eventId,
ticketTypeId,
quantity,
paymentHash,
signature
]);

const batchedCalls: Call[] = [{
target: TICKET_LEDGER_ADDRESS,
value: 0n,
data: purchaseCall
}];

const handlerCall = this.handler.encodeFunctionData('executeBatch', [batchedCalls]);
const authorization = await walletManager.build7702Authorization(HANDLER_ADDRESS);

return {
type: 4,
to: userEOAAddress,
data: handlerCall,
authorizationList: [authorization],
gasLimit: await this.provider.estimateGas({
from: userEOAAddress,
to: userEOAAddress,
data: handlerCall
})
};
}

// Listing and resale use the same pattern:
// 1. encode Marketplace call
// 2. wrap it in Handler.executeBatch(...)
// 3. attach EIP-7702 authorization
// 4. let Handler trigger Paymaster.refillGas() after execution

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

- Create `TicketLedger.sol` with EIP-712 domain separator
- Implement `purchaseWithSignature()`, `transferTicket()`, `getTicketsByOwner()`
- Support EIP-712 signature verification for purchase authorization
- Write Foundry tests (11 tests)

**Definition of Done:**

- [x] Contract compiles without warnings
- [x] All functions have NatSpec comments
- [x] EIP-712 domain separator correctly configured (immutable)
- [x] ECDSA signature recovery works correctly
- [x] Test coverage ≥ 90%
- [x] Tests pass: `forge test --match-contract TicketLedgerTest`
- [x] Gas snapshot generated: `forge snapshot`

**Tests:**
solidity
// test/TicketLedger.t.sol
function testPurchaseWithSignature() // happy path with valid signature
function testPurchaseWithSignature_RevertIfInvalidSignature() // bad signature
function testPurchaseWithSignature_RevertIfHashUsed() // double-spend protection
function testPurchaseWithSignature_RevertIfSignerUnauthorized() // signer not PAYMENT_HASH_ROLE
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
- Implement `listTicket()`, `buyWithSignature()`, `placeLimitOrder()`
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
function testBuyWithSignature() // purchase listed ticket with EIP-712 signature
function testBuyWithSignature_RevertIfInvalidSignature() // bad signature
function testBuyWithSignature_RevertIfHashUsed() // double-spend protection
function testBuyWithSignature_UpdatesPendingPayouts() // seller balance
function testCancelListing() // delist ticket
function testPlaceLimitOrder() // create limit order
function testPlaceLimitOrder_RevertIfInvalidPrice() // validation
function testCancelLimitOrder() // cancel order
function testPlatformFee() // 5% fee calculation
function testEscrowTransfer() // ticket custody

---

### PR #3: Contract - Handler + Paymaster Gas Sponsorship (EIP-7702)

**Scope:**

- Create `Handler.sol` as the delegated executor for EIP-7702
- Implement `executeBatch()` so one EOA tx can call business contracts and then trigger gas refill
- Update `Paymaster.sol` to reimburse gas in the same tx
- Whitelist allowed business targets (`TicketLedger`, `Marketplace`)
- Write Foundry tests (9 tests)

**Definition of Done:**

- [ ] User EOA can delegate to `Handler.sol` on every tx via EIP-7702
- [ ] `Handler.executeBatch()` can execute business calls atomically
- [ ] `Handler` triggers `Paymaster.refillGas()` after the state change in the same tx
- [ ] First user tx works after one-time backend prefund
- [ ] Subsequent user txs do not require backend gas top-up
- [ ] No third-party bundler is required for this flow
- [ ] Test coverage ≥ 85%
- [ ] Tests pass: `forge test --match-contract HandlerTest --match-contract PaymasterTest`

**Tests:**
solidity
function testExecuteBatch() // delegated batch call
function testExecuteBatch_RevertIfTargetNotAllowed() // target whitelist
function testRefillGas() // same-tx reimbursement
function testRefillGas_RevertIfUnauthorizedHandler() // only handler can refill
function testInitialPrefundBootstrap() // first tx works after one-time prefund
function testSequentialTransactionsWithoutBackendTopUp() // later txs self-replenish
function testPaymasterAuthorization() // add/remove handler
function testGasAccounting() // reimbursement tracking
function testMultipleCallsInSingleBatch() // one tx, multiple state changes

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

### PR #5: Backend - Payment Hash & Signature Issuance

**Scope:**

- Add wallet bootstrap endpoint/worker for one-time gas prefund
- Update `payment-orchestrator` to generate payment hashes AND EIP-712 signatures
- Add `/api/payment/hash/:orderId` endpoint that returns both hash and signature
- Store hashes in `payment_hashes` table
- Implement backend signer with PAYMENT_HASH_ROLE
- Write integration tests (6 tests)

**Definition of Done:**

- [ ] Wallet bootstrap prefund is sent only once per wallet
- [ ] Webhook signature verification works for Momo + VNPAY
- [ ] Payment hash generated correctly: `keccak256(orderId, userId, ticketIds, amount, nonce)`
- [ ] EIP-712 signature generated using domain separator and PURCHASE_TYPEHASH
- [ ] Signature recovers to authorized backend signer
- [ ] Idempotency check prevents duplicate processing
- [ ] Tests pass: `pnpm test:integration payment-orchestrator`
- [ ] API documented in Swagger

**Tests:**
typescript
describe('Payment Hash & Signature Issuance', () => {
it('should prefund wallet only once', async () => {});
it('should generate payment hash after webhook', async () => {});
it('should sign payment hash using EIP-712', async () => {});
it('should recover backend signer from signature', async () => {});
it('should reject invalid webhook signature', async () => {});
it('should handle idempotent webhook calls', async () => {});
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
- [ ] Tests pass: `pnpm test:integration payout-service`
- [ ] API documented in Swagger

**Tests:**
typescript
describe('Payout Service', () => {
it('should create payout request', async () => {});
it('should reject payout when on-chain balance is insufficient', async () => {});
it('should approve payout request', async () => {});
it('should mark payout completed after bank transfer', async () => {});
it('should prevent duplicate payout approval', async () => {});
});
