# Resale Flow Completion Design

**Date:** 2026-06-18
**Scope:** Hoàn thiện luồng listing for resale (Flow 2a) và resale purchase (Flow 2b)

---

## Bối cảnh

Trước thiết kế này, trạng thái hoàn thiện:

- `ResaleSalePage`: UI đủ nhưng dữ liệu hardcoded, nút "Đăng Bán" không làm gì
- `ResalePurchasePage`: flow mua hoạt động nhưng `onChainListingId` phải nhập tay
- `marketplace_listings`: schema quá nặng, lẫn metadata với state management
- Không có `buildMarketplaceListTx` trong SDK

---

## Quyết định kiến trúc

### 1. EIP-7702 cho cả listing và purchase

Seller tự ký batch tx khi đăng bán — không dùng relayer backend. Lý do:

- Contract ghi `msg.sender` làm seller: `_listings[listingId] = Listing({ seller: msg.sender, ... })` và `pendingPayouts[seller] += price`. Relayer làm `msg.sender` → tiền bán về ví relayer, không phải seller.
- Consistent với purchase flow đang có.
- Rủi ro Paymaster drain được mitigate bởi KYC requirement đã có sẵn.

### 2. Contract-sync là nguồn sự thật duy nhất cho on-chain state

`RpcListener` đã có sẵn `watchCurrentMarketplaceV2()` xử lý `TicketListed`, `TicketSold`, `ListingCancelled`. Marketplace-service không push synthetic events cho listing — contract-sync tự cập nhật qua WebSocket.

`token_ownerships.source_listing_id` = on-chain listingId (N). Không cần lưu thêm vào `marketplace_listings`.

### 3. `marketplace_listings` là metadata store thuần

Analogy: `marketplace_listings` ≈ `reservations` trong primary purchase. `token_ownerships` ≈ `tickets`.

Bảng chỉ lưu những gì on-chain không có:

```sql
marketplace_listings (
  id              TEXT PRIMARY KEY,   -- db uuid
  token_id        TEXT NOT NULL,      -- link sang token_ownerships
  event_id        TEXT NOT NULL,
  seller_user_id  TEXT NOT NULL,      -- user ID, không có on-chain
  seller_wallet_address TEXT NOT NULL,
  ask_price       INTEGER NOT NULL,   -- VND, cần cho display
  original_price  INTEGER NOT NULL,   -- VND, cần cho markup validation
  currency        TEXT NOT NULL DEFAULT 'VND',
  created_at      TIMESTAMPTZ NOT NULL
)
```

Không có: `status`, `on_chain_listing_id`, `buyer_user_id`, `payment_id`, `settlement_id`.

### 4. `onChainListingId` được ghép bởi marketplace-service

Khi serve listing cho buyer, marketplace-service query contract-sync `GET /tokens/:tokenId` → lấy `source_listing_id` → trả về cùng response. Frontend không nhập tay.

---

## Luồng Flow 2a: Seller đăng bán

```
1. ResaleSalePage load vé từ contract-sync
   GET /tokens?ownerWalletAddress=...
   filter: listing_status='none' AND is_used=false

2. POST /v1/marketplace/listings
   validate KYC (x-kyc-status: approved)
   validate markup ≤ maxMarkupBps
   check không trùng token_id đang active
   INSERT marketplace_listings (metadata only)
   → { listingId: "lst_..." }

3. buildMarketplaceListTx() [SDK mới]
   batch: [
     TicketLedger.transferTicket(tokenId, marketplaceAddress),
     MarketplaceV2.listTicket(tokenId, askPrice)
   ]

4. signAuthorization() + assembleTx4() + broadcast

5. Contract emit TicketListed(listingId=N, seller, tokenId, price)

6. [Độc lập, async] RPC Listener → token_ownerships:
   listing_status = 'active'
   source_listing_id = 'N'
```

Không có `broadcast-list` endpoint. Marketplace-service không cần biết tx xảy ra.

---

## Luồng Flow 2b: Buyer mua vé resale

```
1. GET /v1/marketplace/listings/:id
   marketplace-service ghép:
   - metadata từ marketplace_listings (ask_price, seller_user_id)
   - state từ contract-sync (listing_status, source_listing_id=N)
   → response: { ..., listingStatus: 'active', onChainListingId: N }

2. POST /v1/marketplace/listings/:id/initiate-buy
   { amount, buyerWalletAddress, onChainListingId: N }
   → INSERT marketplace_buy_hashes
   → { paymentHash, signature, domain }

3. buildMarketplaceBuyTx(listingId=N, paymentHash, sig) [đã có]
   signAuthorization() + assembleTx4() + broadcast

4. Contract: buyWithSignature(N, paymentHash, sig)
   → transferTicket(tokenId, buyer)
   → pendingPayouts[seller] += price
   emit TicketSold + TicketTransferred

5. [Độc lập, async] RPC Listener → token_ownerships:
   listing_status = 'completed'
   owner_wallet = buyer

6. POST /v1/marketplace/listings/:id/broadcast-buy
   { txHash, paymentId }
   → UPDATE marketplace_buy_hashes SET status='used'
   (không còn push sang contract-sync)
```

---

## Những gì cần build

### A. SDK — tx-builder mới

File: `packages/sdk-client/src/tx-builder/marketplace-list.ts`

```typescript
buildMarketplaceListTx({
  ticketLedgerAddress,
  marketplaceAddress,
  handlerAddress,
  tokenId, // bigint
  askPrice, // bigint (VND)
  chainId, // bigint
  nonce // bigint
});
// → { authorizationTuple, authorizationHash,
//     businessCalldata, executeBatchCalldata, calls, assemble() }
```

Batch gồm 2 calls:

1. `TicketLedger.transferTicket(tokenId, marketplaceAddress)`
2. `MarketplaceV2.listTicket(tokenId, askPrice)`

### B. Marketplace-service

**Schema thay đổi:**

- Xoá các cột: `status`, `buyer_user_id`, `payment_id`, `settlement_id`
- Xoá bảng: `marketplace_completed_sales`, `marketplace_settlement_ledger`
- Giữ: `marketplace_listings` (metadata), `marketplace_buy_hashes`, `marketplace_idempotency`

**Endpoint thay đổi:**

| Endpoint                                        | Thay đổi                                                     |
| ----------------------------------------------- | ------------------------------------------------------------ |
| `POST /marketplace/listings`                    | INSERT schema mới (không có status)                          |
| `GET /marketplace/listings`                     | Ghép `source_listing_id` + `listing_status` từ contract-sync |
| `GET /marketplace/listings/:id`                 | Tương tự, ghép contract-sync data                            |
| `POST /marketplace/listings/:id/initiate-buy`   | Kiểm tra `listing_status` từ contract-sync thay vì DB local  |
| `POST /marketplace/listings/:id/broadcast-buy`  | Chỉ mark buy_hash as used, bỏ push sang contract-sync        |
| `DELETE /marketplace/listings/:id`              | Vẫn cần — validate seller, ghi nhận cancel intent            |
| `POST /marketplace/listings/:id/broadcast-list` | **Xoá** — không cần nữa                                      |

### C. ResaleSalePage

- Thay hardcoded `myTickets` bằng `useMyTickets()`, filter `listingStatus === 'none'`
- Hiển thị `originalPrice` từ ticket data (cần thêm vào `TicketOwnershipView` hoặc query riêng)
- Nút "Đăng Bán": gọi `createMarketplaceListing` → `buildMarketplaceListTx` → sign → broadcast
- KYC status: dùng `"approved"` cho POC demo

### D. ResalePurchasePage

- Bỏ ô nhập tay `onChainListingId`
- Đọc `onChainListingId` từ `listing.onChainListingId` (marketplace-service đã ghép)
- Đơn giản hoá `broadcast-buy` call (bỏ `gateway`, `gatewayReference` fake)

---

## Những gì KHÔNG thay đổi

- `MarketplaceV2.sol` — contract không cần sửa
- `RpcListener` — đã xử lý đủ events
- `buildMarketplaceBuyTx` — giữ nguyên
- `initiateMarketplaceBuy`, `broadcastMarketplaceBuy` SDK methods — giữ, chỉ đơn giản hoá payload
- `useMarketplaceListing`, `useMarketplaceEvents` hooks — giữ, cập nhật type

---

## Sequence diagrams

- `docs/infra/architecture-diagrams/sequence-resale-list-onchain.puml` — Flow 2a
- `docs/infra/architecture-diagrams/sequence-resale-e2e.puml` — Flow 2a + 2b end-to-end
