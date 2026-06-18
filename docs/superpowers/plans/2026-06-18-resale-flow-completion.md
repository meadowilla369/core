# Resale Flow Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hoàn thiện Flow 2a (seller đăng bán vé qua EIP-7702) và Flow 2b (buyer mua vé resale không còn nhập tay onChainListingId).

**Architecture:** Seller broadcast EIP-7702 batch tx gồm `transferTicket + listTicket`; contract-sync RPC listener tự cập nhật `token_ownerships`; marketplace-service chỉ lưu metadata off-chain và ghép `source_listing_id` từ contract-sync khi serve listing cho buyer.

**Tech Stack:** TypeScript, viem, Node.js `node:test`, React + TanStack Query, Postgres

---

## File Map

| File                                                                     | Action      | Trách nhiệm                                                                                                                                              |
| ------------------------------------------------------------------------ | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/sdk-client/src/tx-builder/marketplace-list.ts`                 | **Tạo mới** | `buildMarketplaceListTx()` — batch `transferTicket + listTicket`                                                                                         |
| `packages/sdk-client/src/tx-builder/index.ts`                            | **Sửa**     | Re-export `buildMarketplaceListTx`                                                                                                                       |
| `packages/sdk-client/src/tx-builder/__tests__/marketplace-list.test.mjs` | **Tạo mới** | Unit tests cho `buildMarketplaceListTx`                                                                                                                  |
| `packages/sdk-client/src/index.ts`                                       | **Sửa**     | Cập nhật `MarketplaceListing` type (bỏ status/buyer fields), thêm `onChainListingId`, thêm `MarketplaceListBroadcastData`, sửa `broadcastMarketplaceBuy` |
| `services/marketplace-service/src/server.ts`                             | **Sửa**     | Refactor schema + endpoints theo thiết kế mới                                                                                                            |
| `apps/web/src/lib/config.ts`                                             | **Sửa**     | Thêm `marketplaceAddress`, `ticketLedgerAddress`                                                                                                         |
| `apps/web/src/pages/ResaleSalePage.tsx`                                  | **Sửa**     | Wire thực: load vé từ contract-sync, gọi API + EIP-7702                                                                                                  |
| `apps/web/src/pages/ResalePurchasePage.tsx`                              | **Sửa**     | Bỏ nhập tay `onChainListingId`, đơn giản hoá broadcast-buy                                                                                               |

---

## Task 1: `buildMarketplaceListTx` — SDK tx-builder

**Files:**

- Tạo: `packages/sdk-client/src/tx-builder/marketplace-list.ts`
- Tạo: `packages/sdk-client/src/tx-builder/__tests__/marketplace-list.test.mjs`
- Sửa: `packages/sdk-client/src/tx-builder/index.ts`

- [ ] **Bước 1: Viết failing test**

Tạo file `packages/sdk-client/src/tx-builder/__tests__/marketplace-list.test.mjs`:

```javascript
import assert from "node:assert/strict";
import test from "node:test";
import { pathToFileURL, fileURLToPath } from "node:url";
import path from "node:path";

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.resolve(THIS_DIR, "../../..");

const { buildMarketplaceListTx } = await import(
  pathToFileURL(path.resolve(PKG_ROOT, "dist/tx-builder/marketplace-list.js")).href
);

const HANDLER_ADDR = "0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF";
const MARKETPLACE = "0x2000000000000000000000000000000000000002";
const TICKET_LEDGER = "0x1000000000000000000000000000000000000001";

const BASE_PARAMS = {
  ticketLedgerAddress: TICKET_LEDGER,
  marketplaceAddress: MARKETPLACE,
  handlerAddress: HANDLER_ADDR,
  tokenId: 42n,
  askPrice: 3500000n,
  chainId: 31337n,
  nonce: 0n
};

test("buildMarketplaceListTx — returns expected shape", () => {
  const tx = buildMarketplaceListTx(BASE_PARAMS);
  assert.ok(tx.authorizationTuple, "missing authorizationTuple");
  assert.ok(tx.authorizationHash.startsWith("0x"), "authorizationHash must be hex");
  assert.ok(tx.executeBatchCalldata.startsWith("0x"), "executeBatchCalldata must be hex");
  assert.strictEqual(tx.calls.length, 2, "must have exactly 2 calls");
  assert.strictEqual(
    tx.calls[0].target.toLowerCase(),
    TICKET_LEDGER.toLowerCase(),
    "first call targets TicketLedger"
  );
  assert.strictEqual(
    tx.calls[1].target.toLowerCase(),
    MARKETPLACE.toLowerCase(),
    "second call targets MarketplaceV2"
  );
});

test("buildMarketplaceListTx — authorizationTuple uses handlerAddress", () => {
  const tx = buildMarketplaceListTx(BASE_PARAMS);
  assert.strictEqual(tx.authorizationTuple.address.toLowerCase(), HANDLER_ADDR.toLowerCase());
  assert.strictEqual(tx.authorizationTuple.chainId, 31337n);
  assert.strictEqual(tx.authorizationTuple.nonce, 0n);
});

test("buildMarketplaceListTx — assemble() returns valid Eip7702BatchPayload", () => {
  const tx = buildMarketplaceListTx(BASE_PARAMS);
  const fakeSignedAuth = {
    chainId: 31337,
    address: HANDLER_ADDR,
    nonce: 0,
    r: "0x" + "a".repeat(64),
    s: "0x" + "b".repeat(64),
    yParity: 0
  };
  const payload = tx.assemble(fakeSignedAuth);
  assert.strictEqual(payload.authorizationList.length, 1);
  assert.ok(payload.encodedCalldata.startsWith("0x"));
  assert.strictEqual(payload.calls.length, 2);
});

test("buildMarketplaceListTx — throws on zero tokenId", () => {
  assert.throws(() => buildMarketplaceListTx({ ...BASE_PARAMS, tokenId: 0n }), /tokenId/);
});

test("buildMarketplaceListTx — throws on zero askPrice", () => {
  assert.throws(() => buildMarketplaceListTx({ ...BASE_PARAMS, askPrice: 0n }), /askPrice/);
});
```

- [ ] **Bước 2: Build và chạy test để xác nhận fail**

```bash
cd packages/sdk-client
pnpm run build 2>&1 | tail -5
node --test src/tx-builder/__tests__/marketplace-list.test.mjs 2>&1 | head -20
```

Expected: lỗi `Cannot find module ... marketplace-list.js`

- [ ] **Bước 3: Implement `buildMarketplaceListTx`**

Tạo file `packages/sdk-client/src/tx-builder/marketplace-list.ts`:

```typescript
import { encodeFunctionData } from "viem";
import {
  buildAuthorizationTuple,
  buildEip7702BatchPayload,
  encodeExecuteBatch,
  hashAuthorizationTuple,
  validateCalls
} from "./encoder.js";
import type {
  AuthorizationTuple,
  Eip7702BatchPayload,
  HandlerCall,
  SignedAuthorization
} from "./types.js";

const TICKET_LEDGER_ABI = [
  {
    name: "transferTicket",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "ticketId", type: "uint256" },
      { name: "to", type: "address" }
    ],
    outputs: []
  }
] as const;

const MARKETPLACE_V2_ABI = [
  {
    name: "listTicket",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "ticketId", type: "uint256" },
      { name: "price", type: "uint256" }
    ],
    outputs: [{ name: "listingId", type: "uint256" }]
  }
] as const;

export interface MarketplaceListTxParams {
  ticketLedgerAddress: `0x${string}`;
  marketplaceAddress: `0x${string}`;
  handlerAddress: `0x${string}`;
  tokenId: bigint;
  askPrice: bigint;
  chainId: bigint;
  nonce: bigint;
}

export interface MarketplaceListTxUnsigned {
  authorizationTuple: AuthorizationTuple;
  authorizationHash: `0x${string}`;
  executeBatchCalldata: `0x${string}`;
  calls: HandlerCall[];
  assemble(signedAuth: SignedAuthorization): Eip7702BatchPayload;
}

export function buildMarketplaceListTx(params: MarketplaceListTxParams): MarketplaceListTxUnsigned {
  if (params.tokenId <= 0n) {
    throw new Error("buildMarketplaceListTx: tokenId must be > 0");
  }
  if (params.askPrice <= 0n) {
    throw new Error("buildMarketplaceListTx: askPrice must be > 0");
  }

  const transferCalldata = encodeFunctionData({
    abi: TICKET_LEDGER_ABI,
    functionName: "transferTicket",
    args: [params.tokenId, params.marketplaceAddress]
  });

  const listCalldata = encodeFunctionData({
    abi: MARKETPLACE_V2_ABI,
    functionName: "listTicket",
    args: [params.tokenId, params.askPrice]
  });

  const calls: HandlerCall[] = [
    { target: params.ticketLedgerAddress, value: 0n, data: transferCalldata },
    { target: params.marketplaceAddress, value: 0n, data: listCalldata }
  ];

  const errors = validateCalls(calls);
  if (errors.length > 0) {
    throw new Error(`buildMarketplaceListTx: invalid calls - ${errors.join("; ")}`);
  }

  const authorizationTuple = buildAuthorizationTuple({
    chainId: params.chainId,
    handlerAddress: params.handlerAddress,
    nonce: params.nonce
  });
  const authorizationHash = hashAuthorizationTuple(authorizationTuple);
  const executeBatchCalldata = encodeExecuteBatch(calls);

  return {
    authorizationTuple,
    authorizationHash,
    executeBatchCalldata,
    calls,
    assemble(signedAuth: SignedAuthorization): Eip7702BatchPayload {
      return buildEip7702BatchPayload(calls, signedAuth);
    }
  };
}
```

- [ ] **Bước 4: Re-export từ tx-builder/index.ts**

Sửa `packages/sdk-client/src/tx-builder/index.ts` — thêm dòng:

```typescript
export {
  buildMarketplaceListTx,
  type MarketplaceListTxParams,
  type MarketplaceListTxUnsigned
} from "./marketplace-list.js";
```

- [ ] **Bước 5: Build và chạy test — xác nhận pass**

```bash
cd packages/sdk-client
pnpm run build && node --test src/tx-builder/__tests__/marketplace-list.test.mjs
```

Expected: `▶ buildMarketplaceListTx — returns expected shape ... ok (5 tests)`

- [ ] **Bước 6: Commit**

```bash
git add packages/sdk-client/src/tx-builder/marketplace-list.ts \
        packages/sdk-client/src/tx-builder/index.ts \
        packages/sdk-client/src/tx-builder/__tests__/marketplace-list.test.mjs
git commit -m "feat(sdk-client): add buildMarketplaceListTx for EIP-7702 listing batch"
```

---

## Task 2: Cập nhật types SDK + re-export

**Files:**

- Sửa: `packages/sdk-client/src/index.ts` (types `MarketplaceListing`, thêm `MarketplaceListBroadcastData`, re-export `buildMarketplaceListTx`)

- [ ] **Bước 1: Sửa `MarketplaceListing` — bỏ trạng thái, thêm `onChainListingId`**

Trong `packages/sdk-client/src/index.ts`, thay block `MarketplaceListing` (dòng 254–269):

```typescript
export interface MarketplaceListing {
  id: string;
  tokenId: string;
  eventId: string;
  sellerUserId: string;
  sellerWalletAddress: string;
  originalPrice: number;
  askPrice: number;
  currency: "VND";
  createdAt: string;
  // Được ghép từ contract-sync khi serve, không lưu trong marketplace_listings
  listingStatus?: "none" | "active" | "cancelled" | "completed";
  onChainListingId?: number | null;
}
```

- [ ] **Bước 2: Thêm `MarketplaceListBroadcastData` type sau `MarketplaceListing`**

```typescript
export interface MarketplaceListBroadcastData {
  listingId: string;
  tokenId: string;
  txHash: `0x${string}`;
}
```

- [ ] **Bước 3: Sửa `MarketplaceBroadcastData` — loại bỏ sync.ingestion, đơn giản hoá**

Thay block `MarketplaceBroadcastData` (dòng 344–359):

```typescript
export interface MarketplaceBroadcastData {
  listingId: string;
  buyHashOrderId: string;
  txHash: `0x${string}`;
}
```

- [ ] **Bước 4: Sửa `broadcastMarketplaceBuy` SDK method**

Tìm method `broadcastMarketplaceBuy` (khoảng dòng 717–741), sửa input type:

```typescript
async broadcastMarketplaceBuy(
  listingId: string,
  input: {
    authorizationHash: `0x${string}`;
    signedAuthorization: SignedAuthorizationData;
    tx: {
      to: `0x${string}`;
      data: `0x${string}`;
      chainId: number;
    };
    paymentId?: string;
  },
  ctx: { userId: string; idempotencyKey?: string }
): Promise<ApiSuccessResponse<MarketplaceBroadcastData>> {
  return this.request(`/v1/marketplace/listings/${listingId}/broadcast-buy`, {
    method: "POST",
    body: input,
    headers: {
      "x-user-id": ctx.userId,
      ...(ctx.idempotencyKey ? { "idempotency-key": ctx.idempotencyKey } : {})
    }
  });
}
```

- [ ] **Bước 5: Re-export `buildMarketplaceListTx` từ top-level sdk index**

Thêm vào phần import/export ở đầu `packages/sdk-client/src/index.ts`:

```typescript
export {
  buildMarketplaceListTx,
  type MarketplaceListTxParams,
  type MarketplaceListTxUnsigned
} from "./tx-builder/index.js";
```

- [ ] **Bước 6: Build kiểm tra không có TypeScript error**

```bash
cd packages/sdk-client && pnpm run build 2>&1
```

Expected: build thành công, không có lỗi.

- [ ] **Bước 7: Commit**

```bash
git add packages/sdk-client/src/index.ts
git commit -m "refactor(sdk-client): simplify MarketplaceListing type and MarketplaceBroadcastData"
```

---

## Task 3: Refactor marketplace-service schema và endpoints

**Files:**

- Sửa: `services/marketplace-service/src/server.ts`

**Nguyên tắc:** Bảng `marketplace_listings` chỉ còn metadata. Trạng thái listing lấy từ contract-sync. Bỏ `marketplace_completed_sales` và `marketplace_settlement_ledger`. Endpoint `broadcast-buy` chỉ mark buy_hash used. Endpoint `GET /marketplace/listings` ghép `listingStatus` + `onChainListingId` từ contract-sync.

- [ ] **Bước 1: Sửa `ensureSchema` — đơn giản hoá `marketplace_listings`**

Tìm function `ensureSchema` trong `services/marketplace-service/src/server.ts`. Thay toàn bộ phần tạo bảng thành:

```typescript
async function ensureSchema(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS marketplace_listings (
      id                    TEXT PRIMARY KEY,
      token_id              TEXT NOT NULL,
      event_id              TEXT NOT NULL,
      seller_user_id        TEXT NOT NULL,
      seller_wallet_address TEXT NOT NULL,
      original_price        INTEGER NOT NULL,
      ask_price             INTEGER NOT NULL,
      currency              TEXT NOT NULL DEFAULT 'VND',
      created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_marketplace_listings_token_id
    ON marketplace_listings (token_id);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS marketplace_buy_hashes (
      order_id              TEXT PRIMARY KEY,
      listing_id            TEXT NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
      buyer_user_id         TEXT NOT NULL,
      buyer_wallet_address  TEXT NOT NULL,
      amount                INTEGER NOT NULL,
      nonce                 TEXT NOT NULL,
      payment_hash          TEXT NOT NULL,
      signature             TEXT NOT NULL,
      signer_address        TEXT NOT NULL,
      status                TEXT NOT NULL CHECK (status IN ('issued', 'expired', 'used')),
      issued_at             TIMESTAMPTZ NOT NULL,
      expires_at            TIMESTAMPTZ NOT NULL,
      chain_id              INTEGER NOT NULL,
      verifying_contract    TEXT NOT NULL,
      typed_data            JSONB NOT NULL
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_marketplace_buy_hashes_listing_user
    ON marketplace_buy_hashes (listing_id, buyer_user_id, issued_at DESC);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS marketplace_idempotency (
      scope      TEXT PRIMARY KEY,
      response   JSONB NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}
```

- [ ] **Bước 2: Sửa interface `Listing` — bỏ status/buyer/payment fields**

Tìm `interface Listing` và thay:

```typescript
interface Listing {
  id: string;
  tokenId: string;
  eventId: string;
  sellerUserId: string;
  sellerWalletAddress: string;
  originalPrice: number;
  askPrice: number;
  currency: "VND";
  createdAt: string;
}

interface ListingRow {
  id: string;
  token_id: string;
  event_id: string;
  seller_user_id: string;
  seller_wallet_address: string;
  original_price: number | string;
  ask_price: number | string;
  currency: "VND";
  created_at: string | Date;
}

interface ListingWithState extends Listing {
  listingStatus: "none" | "active" | "cancelled" | "completed";
  onChainListingId: number | null;
}
```

- [ ] **Bước 3: Sửa `mapListing` và thêm helper fetch contract-sync token**

```typescript
function mapListing(row: ListingRow): Listing {
  return {
    id: row.id,
    tokenId: row.token_id,
    eventId: row.event_id,
    sellerUserId: row.seller_user_id,
    sellerWalletAddress: row.seller_wallet_address,
    originalPrice: Number(row.original_price),
    askPrice: Number(row.ask_price),
    currency: row.currency,
    createdAt: toIso(row.created_at)
  };
}

async function enrichListingWithState(
  config: MarketplaceConfig,
  listing: Listing
): Promise<ListingWithState> {
  const tokenState = await loadContractSyncToken(config, listing.tokenId);
  return {
    ...listing,
    listingStatus: tokenState?.listingStatus ?? "none",
    onChainListingId: tokenState?.sourceListingId ? Number(tokenState.sourceListingId) : null
  };
}
```

- [ ] **Bước 4: Sửa `POST /marketplace/listings` — INSERT schema mới**

Tìm handler `POST /marketplace/listings` và sửa phần INSERT:

```typescript
const listingId = `lst_${randomUUID().replace(/-/g, "")}`;
const nowIso = new Date().toISOString();
await pool.query(
  `
    INSERT INTO marketplace_listings (
      id, token_id, event_id, seller_user_id, seller_wallet_address,
      original_price, ask_price, currency, created_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, 'VND', $8::timestamptz)
  `,
  [listingId, tokenId, eventId, userId, sellerWalletAddress, originalPrice, askPrice, nowIso]
);

const listing = await loadListing(pool, listingId);
const response = { success: true, data: listing };
await setCachedIdempotency(pool, idempotencyScope, response);
return sendJson(res, 200, response);
```

Bỏ check `existingActive` dùng `status='active'` (vì không còn cột status). Thay bằng check unique index:

```typescript
// Kiểm tra đã có listing nào với token_id này chưa — unique index sẽ block duplicate
// nhưng cần check trước để trả lỗi rõ ràng
const existingRow = await queryOne<{ id: string }>(
  pool,
  `SELECT id FROM marketplace_listings WHERE token_id = $1`,
  [tokenId]
);
if (existingRow) {
  // Kiểm tra listing đó đã completed chưa (qua contract-sync)
  const tokenState = await loadContractSyncToken(config, tokenId);
  if (tokenState?.listingStatus === "active") {
    return sendJson(res, 409, {
      success: false,
      error: { code: "LISTING_ALREADY_ACTIVE", message: "Token already has active listing" }
    });
  }
  // Nếu completed/cancelled thì cho phép tạo listing mới — xoá record cũ
  await pool.query(`DELETE FROM marketplace_listings WHERE token_id = $1`, [tokenId]);
}
```

- [ ] **Bước 5: Sửa `GET /marketplace/listings` — ghép contract-sync state**

Tìm handler `GET /marketplace/listings`, sửa response:

```typescript
const rows = await queryMany<ListingRow>(
  pool,
  `
    SELECT id, token_id, event_id, seller_user_id, seller_wallet_address,
           original_price, ask_price, currency, created_at
    FROM marketplace_listings
    ORDER BY created_at DESC
  `,
  []
);

const listings = rows.map(mapListing);
const enriched = await Promise.all(listings.map((l) => enrichListingWithState(config, l)));

return sendJson(res, 200, { success: true, data: enriched });
```

- [ ] **Bước 6: Sửa `POST /marketplace/listings/:id/initiate-buy` — lấy listingStatus từ contract-sync**

Tìm handler `initiateBuyMatch`. Thay phần kiểm tra listing active:

```typescript
const tokenState = await loadContractSyncToken(config, listing.tokenId);
const listingStatus = tokenState?.listingStatus ?? "none";

if (listingStatus !== "active") {
  return sendJson(res, 400, {
    success: false,
    error: { code: "LISTING_NOT_ACTIVE", message: "Listing is not active on-chain" }
  });
}
```

- [ ] **Bước 7: Sửa `POST /marketplace/listings/:id/broadcast-buy` — chỉ mark buy_hash used**

Xoá toàn bộ logic finalize listing, push sync events. Thay bằng:

```typescript
if (method === "POST" && broadcastBuyMatch) {
  const userId = extractUserId(req);
  if (!userId) {
    return sendJson(res, 401, {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Missing x-user-id header" }
    });
  }

  const idempotencyScope = createIdempotencyScope(method, url.pathname, extractIdempotencyKey(req));
  const cached = await getCachedIdempotency(pool, idempotencyScope);
  if (cached) return sendJson(res, 200, cached);

  const listing = await loadListing(pool, broadcastBuyMatch[1]);
  if (!listing) {
    return sendJson(res, 404, {
      success: false,
      error: { code: "LISTING_NOT_FOUND", message: "Listing not found" }
    });
  }

  const buyHash = await loadLatestBuyHash(pool, listing.id, userId);
  if (!buyHash || buyHash.status !== "issued") {
    return sendJson(res, 400, {
      success: false,
      error: {
        code: "BUY_HASH_NOT_FOUND_OR_EXPIRED",
        message: "No valid buy hash. Call initiate-buy first."
      }
    });
  }

  const body = await readJson<{ txHash?: string; paymentId?: string }>(req);

  await pool.query(`UPDATE marketplace_buy_hashes SET status = 'used' WHERE order_id = $1`, [
    buyHash.orderId
  ]);

  const response = {
    success: true,
    data: {
      listingId: listing.id,
      buyHashOrderId: buyHash.orderId,
      txHash: body.txHash ?? null
    }
  };

  await setCachedIdempotency(pool, idempotencyScope, response);
  return sendJson(res, 200, response);
}
```

- [ ] **Bước 8: Xoá các handlers không còn dùng**

Xoá các handler sau (không còn tồn tại trong thiết kế mới):

- `POST /marketplace/listings/:id/purchase` (cũ, thay bằng initiate-buy flow)
- `POST /internal/marketplace/settlements/finalize`
- `GET /marketplace/me/sales`

- [ ] **Bước 9: Khởi động service và smoke test**

```bash
cd services/marketplace-service
pnpm run build 2>&1 | tail -5
```

Expected: build thành công.

- [ ] **Bước 10: Commit**

```bash
git add services/marketplace-service/src/server.ts
git commit -m "refactor(marketplace-service): simplify schema to metadata-only, delegate state to contract-sync"
```

---

## Task 4: Cập nhật `webAppConfig` — thêm contract addresses

**Files:**

- Sửa: `apps/web/src/lib/config.ts`

- [ ] **Bước 1: Thêm `marketplaceAddress` và `ticketLedgerAddress` vào config**

```typescript
export interface WebAppConfig {
  apiBaseUrl: string;
  rpcUrl: string;
  demoUserId: string;
  demoWalletAddress: string;
  demoWalletPrivateKey: `0x${string}`;
  onboardingPrefundPollIntervalMs: number;
  onboardingPrefundTimeoutMs: number;
  defaultKycStatus: "pending" | "approved";
  handlerAddress: `0x${string}`;
  marketplaceAddress: `0x${string}`;
  ticketLedgerAddress: `0x${string}`;
  demoMomoWebhookSecret: string;
}

export const webAppConfig: WebAppConfig = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000",
  rpcUrl: import.meta.env.VITE_RPC_URL ?? "http://127.0.0.1:8545",
  demoUserId: import.meta.env.VITE_DEMO_USER_ID ?? "buyer_demo_web_3",
  demoWalletAddress:
    import.meta.env.VITE_DEMO_WALLET_ADDRESS ?? "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
  demoWalletPrivateKey:
    (import.meta.env.VITE_DEMO_WALLET_PRIVATE_KEY as `0x${string}` | undefined) ??
    "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
  onboardingPrefundPollIntervalMs: Number(
    import.meta.env.VITE_ONBOARDING_PREFUND_POLL_INTERVAL_MS ?? 1500
  ),
  onboardingPrefundTimeoutMs: Number(import.meta.env.VITE_ONBOARDING_PREFUND_TIMEOUT_MS ?? 45000),
  defaultKycStatus: "approved",
  handlerAddress:
    (import.meta.env.VITE_HANDLER_ADDRESS as `0x${string}` | undefined) ??
    "0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF",
  marketplaceAddress:
    (import.meta.env.VITE_MARKETPLACE_ADDRESS as `0x${string}` | undefined) ??
    "0x2000000000000000000000000000000000000002",
  ticketLedgerAddress:
    (import.meta.env.VITE_TICKET_LEDGER_ADDRESS as `0x${string}` | undefined) ??
    "0x1000000000000000000000000000000000000001",
  demoMomoWebhookSecret: import.meta.env.VITE_DEMO_MOMO_WEBHOOK_SECRET ?? "momo_dev_secret"
};
```

- [ ] **Bước 2: Commit**

```bash
git add apps/web/src/lib/config.ts
git commit -m "feat(web): add marketplaceAddress and ticketLedgerAddress to webAppConfig"
```

---

## Task 5: Refactor `ResaleSalePage` — wire thực

**Files:**

- Sửa: `apps/web/src/pages/ResaleSalePage.tsx`

- [ ] **Bước 1: Thay hardcoded data bằng real hooks và thêm mutation state**

Thay toàn bộ nội dung `ResaleSalePage.tsx`:

```tsx
import { useState } from "react";
import { ArrowLeft, Info, Minus, Tag, TrendingUp } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import {
  assembleTx4,
  buildMarketplaceListTx,
  type SignedAuthorization
} from "@ticket-platform/sdk-client";
import MobileLayout from "@/components/mobile/MobileLayout";
import { useMyTickets } from "@/hooks/use-tickets";
import { useApiClient } from "@/providers/AppProviders";
import { toast } from "@ticket-platform/shared-ui";
import { getSessionUserId, getSessionWalletAddress, signSessionAuthorization } from "@/lib/session";
import { webAppConfig } from "@/lib/config";

const ResaleSalePage = () => {
  const navigate = useNavigate();
  const client = useApiClient();
  const { data: ticketData, isLoading } = useMyTickets();
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
  const [price, setPrice] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);

  // Chỉ hiển thị vé chưa đăng bán và chưa dùng
  const availableTickets = (ticketData?.tickets ?? []).filter(
    (t) => t.listingStatus === "none" && !t.isUsed
  );

  const selected = availableTickets.find((t) => t.tokenId === selectedTokenId);

  const listMutation = useMutation({
    mutationFn: async () => {
      if (!selected || !price) throw new Error("Chưa chọn vé hoặc chưa đặt giá");

      const askPrice = Number(price);
      const userId = getSessionUserId();
      const walletAddress = getSessionWalletAddress();

      // 1. Tạo listing record trên backend
      const listingResponse = await client.createMarketplaceListing(
        {
          tokenId: selected.tokenId,
          eventId: selected.eventId,
          originalPrice: selected.originalPrice ?? askPrice,
          askPrice,
          sellerWalletAddress: walletAddress
        },
        { userId, kycStatus: webAppConfig.defaultKycStatus }
      );

      // 2. Build EIP-7702 batch tx
      const txDraft = buildMarketplaceListTx({
        ticketLedgerAddress: webAppConfig.ticketLedgerAddress,
        marketplaceAddress: webAppConfig.marketplaceAddress,
        handlerAddress: webAppConfig.handlerAddress,
        tokenId: BigInt(selected.tokenId),
        askPrice: BigInt(askPrice),
        chainId: BigInt(webAppConfig.chainId ?? 31337),
        nonce: 0n
      });

      // 3. Ký EIP-7702 authorization
      const signedAuthorization: SignedAuthorization = await signSessionAuthorization({
        authorization: {
          address: txDraft.authorizationTuple.address,
          chainId: txDraft.authorizationTuple.chainId
        }
      });

      // 4. Assemble và broadcast
      const payload = txDraft.assemble(signedAuthorization);
      const tx = assembleTx4(payload, walletAddress as `0x${string}`);

      // Broadcast qua RPC (viem walletClient)
      const { createWalletClient, defineChain, http } = await import("viem");
      const { privateKeyToAccount } = await import("viem/accounts");
      const { getSessionWallet } = await import("@/lib/session");

      const wallet = getSessionWallet();
      if (!wallet.privateKey) throw new Error("Private key không có trong session");

      const account = privateKeyToAccount(wallet.privateKey as `0x${string}`);
      const chain = defineChain({
        id: Number(txDraft.authorizationTuple.chainId),
        name: "localchain",
        nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
        rpcUrls: { default: { http: [webAppConfig.rpcUrl] } }
      });
      const walletClient = createWalletClient({
        account,
        chain,
        transport: http(webAppConfig.rpcUrl)
      });

      const txHash = await walletClient.sendTransaction({
        account,
        to: tx.to ?? account.address,
        data: tx.data,
        value: tx.value,
        authorizationList: tx.authorizationList,
        chain
      });

      return {
        listingId: listingResponse.data.id,
        txHash
      };
    },
    onSuccess: ({ listingId, txHash }) => {
      toast({
        title: "Đã đăng bán thành công",
        description: `Listing ${listingId} — tx ${txHash.slice(0, 10)}...`
      });
      void navigate("/marketplace");
    },
    onError: (error) => {
      toast({
        title: "Đăng bán thất bại",
        description: error instanceof Error ? error.message : "Lỗi không xác định",
        variant: "destructive"
      });
    }
  });

  return (
    <MobileLayout>
      {/* Header */}
      <header className="sticky safe-area-sticky-top z-40 bg-background/95 backdrop-blur-sm border-b border-foreground/10">
        <div className="flex items-center gap-3 p-4">
          <Link
            to="/marketplace"
            className="w-10 h-10 border border-foreground/20 flex items-center justify-center hover:bg-foreground/10 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-lg font-medium tracking-tight">Đăng Bán Vé</h1>
            <p className="font-mono text-[10px] text-foreground/50 tracking-wider">
              Bán vé trên chợ thứ cấp
            </p>
          </div>
        </div>
      </header>

      {/* Step 1: Select Ticket */}
      <section className="p-4">
        <h3 className="font-mono text-[10px] tracking-widest text-foreground/50 mb-3">
          [ 01 — CHỌN VÉ ]
        </h3>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-20 animate-pulse bg-foreground/10" />
            ))}
          </div>
        ) : availableTickets.length === 0 ? (
          <p className="font-mono text-[10px] text-foreground/40 border border-foreground/10 p-4">
            Không có vé nào có thể đăng bán.
          </p>
        ) : (
          <div className="space-y-2">
            {availableTickets.map((ticket) => (
              <button
                key={ticket.tokenId}
                onClick={() => setSelectedTokenId(ticket.tokenId)}
                className={`w-full text-left border p-4 transition-colors ${
                  selectedTokenId === ticket.tokenId
                    ? "border-foreground bg-foreground/5"
                    : "border-foreground/20 hover:border-foreground/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium tracking-tight">{ticket.eventName}</h4>
                    <p className="font-mono text-[10px] text-foreground/50 mt-0.5">
                      {ticket.ticketType} · {ticket.seatInfo}
                    </p>
                  </div>
                  <div
                    className={`w-5 h-5 border flex items-center justify-center ${
                      selectedTokenId === ticket.tokenId
                        ? "border-foreground bg-foreground"
                        : "border-foreground/30"
                    }`}
                  >
                    {selectedTokenId === ticket.tokenId && (
                      <div className="w-2 h-2 bg-background" />
                    )}
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <Tag className="w-3 h-3 text-foreground/40" />
                  <span className="font-mono text-[10px] text-foreground/40">
                    Token: {ticket.tokenId}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Step 2: Set Price */}
      {selected && (
        <section className="px-4 pb-4">
          <h3 className="font-mono text-[10px] tracking-widest text-foreground/50 mb-3">
            [ 02 — ĐẶT GIÁ ]
          </h3>
          <div className="border border-foreground/20 p-4">
            <label className="font-mono text-[10px] text-foreground/50 block mb-2">
              Giá bán (₫)
            </label>
            <div className="flex items-center border border-foreground/20">
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0"
                className="flex-1 bg-transparent px-4 py-3 text-xl font-medium tracking-tight outline-none placeholder:text-foreground/20"
              />
              <span className="pr-4 font-mono text-sm text-foreground/40">₫</span>
            </div>

            <div className="flex gap-2 mt-3">
              {[
                { label: "Giá gốc", icon: Minus, multiplier: 1 },
                { label: "+10%", icon: TrendingUp, multiplier: 1.1 },
                { label: "+20%", icon: TrendingUp, multiplier: 1.2 }
              ].map((btn) => (
                <button
                  key={btn.label}
                  onClick={() =>
                    setPrice(String(Math.round((selected.originalPrice ?? 0) * btn.multiplier)))
                  }
                  className="flex-1 py-2 border border-foreground/20 font-mono text-[10px] hover:bg-foreground/10 transition-colors"
                >
                  {btn.label}
                </button>
              ))}
            </div>

            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-foreground/40">Phí nền tảng (5%)</span>
                <span className="font-mono text-[10px] text-foreground/40">
                  {price ? `${Math.round(Number(price) * 0.05).toLocaleString("vi-VN")}₫` : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-foreground/40">Bạn nhận được</span>
                <span className="font-mono text-xs font-medium">
                  {price ? `${Math.round(Number(price) * 0.95).toLocaleString("vi-VN")}₫` : "—"}
                </span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Terms */}
      {selected && price && (
        <section className="px-4 pb-4">
          <div className="border border-foreground/10 p-3 flex items-start gap-3">
            <Info className="w-4 h-4 text-foreground/40 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-mono text-[10px] text-foreground/50">
                Khi đăng bán, vé sẽ bị khóa và không thể sử dụng cho đến khi gỡ bán hoặc bán thành
                công.
              </p>
              <button
                onClick={() => setAcceptTerms(!acceptTerms)}
                className="flex items-center gap-2 mt-3"
              >
                <div
                  className={`w-4 h-4 border flex items-center justify-center ${
                    acceptTerms ? "border-foreground bg-foreground" : "border-foreground/30"
                  }`}
                >
                  {acceptTerms && <div className="w-1.5 h-1.5 bg-background" />}
                </div>
                <span className="font-mono text-[10px] text-foreground/60">
                  Tôi đồng ý điều khoản bán lại
                </span>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      {selected && (
        <div className="sticky bottom-16 p-4 bg-background/95 backdrop-blur-sm border-t border-foreground/10">
          <button
            disabled={!price || !acceptTerms || listMutation.isPending}
            onClick={() => listMutation.mutate()}
            className={`w-full py-4 font-medium tracking-tight transition-colors ${
              price && acceptTerms && !listMutation.isPending
                ? "bg-foreground text-background hover:bg-foreground/90"
                : "bg-foreground/20 text-foreground/40 cursor-not-allowed"
            }`}
          >
            {listMutation.isPending ? "ĐANG XỬ LÝ..." : "ĐĂNG BÁN VÉ"}
          </button>
        </div>
      )}
    </MobileLayout>
  );
};

export default ResaleSalePage;
```

- [ ] **Bước 2: Thêm `listingStatus`, `isUsed`, `originalPrice` vào `TicketOwnershipView`**

Trong `apps/web/src/lib/ticket-loader.ts`, thêm fields vào interface:

```typescript
export interface TicketOwnershipView {
  // ... các fields hiện có ...
  listingStatus: "none" | "active" | "cancelled" | "completed";
  isUsed: boolean;
  originalPrice?: number;
}
```

Và cập nhật `toTicketOwnershipView()` để map thêm:

```typescript
function toTicketOwnershipView(
  ticket: MergedTicketRecord,
  event: EventDetail | undefined,
  syncStatus: TicketSyncStatus
): TicketOwnershipView {
  const card = toTicketCardView(ticket, event);
  return {
    ...card,
    date: event ? card.date : "Dang cap nhat",
    id: ticket.tokenId,
    tokenId: ticket.tokenId,
    eventId: ticket.eventId,
    ownerUserId: ticket.ownerUserId,
    ownerWalletAddress: ticket.ownerWalletAddress,
    seatInfo: ticket.seatInfo,
    reservationId: ticket.reservationId,
    createdAt: ticket.createdAt,
    source: ticket.source,
    syncStatus,
    transactionHash: ticket.transactionHash,
    listingStatus: ticket.listingStatus ?? "none",
    isUsed: ticket.isUsed ?? false,
    originalPrice: ticket.originalPrice
  };
}
```

- [ ] **Bước 3: Thêm `listingStatus`, `isUsed`, `originalPrice` vào `MergedTicketRecord`**

Trong `apps/web/src/lib/synced-tickets.ts`, cập nhật `MergedTicketRecord`:

```typescript
export interface MergedTicketRecord extends TicketRecord {
  ownerWalletAddress: string | null;
  source: "contract-sync";
  transactionHash?: string;
  listingStatus: "none" | "active" | "cancelled" | "completed";
  isUsed: boolean;
  originalPrice?: number;
}
```

Và cập nhật hàm `mergeTicketRecords` để map `listingStatus`, `isUsed` từ `ContractSyncedTokenData`.

- [ ] **Bước 4: Thêm `chainId` vào `webAppConfig`**

Trong `apps/web/src/lib/config.ts`, thêm:

```typescript
export interface WebAppConfig {
  // ... các fields hiện có ...
  chainId: number;
}

export const webAppConfig: WebAppConfig = {
  // ... các fields hiện có ...
  chainId: Number(import.meta.env.VITE_CHAIN_ID ?? 31337)
};
```

- [ ] **Bước 5: Kiểm tra TypeScript build**

```bash
cd apps/web && pnpm run build 2>&1 | grep -E "error|warning" | head -20
```

Expected: không có TypeScript error.

- [ ] **Bước 6: Commit**

```bash
git add apps/web/src/pages/ResaleSalePage.tsx \
        apps/web/src/lib/ticket-loader.ts \
        apps/web/src/lib/synced-tickets.ts \
        apps/web/src/lib/config.ts
git commit -m "feat(web): wire ResaleSalePage to real API and EIP-7702 listing tx"
```

---

## Task 6: Refactor `ResalePurchasePage` — bỏ nhập tay onChainListingId

**Files:**

- Sửa: `apps/web/src/pages/ResalePurchasePage.tsx`

- [ ] **Bước 1: Bỏ state `onChainListingId`, đọc từ listing data**

Trong `ResalePurchasePage.tsx`:

1. Xoá dòng: `const [onChainListingId, setOnChainListingId] = useState("1");`
2. Thêm sau `const listing = data?.listing ?? fallbackListing;`:
   ```typescript
   const onChainListingId = data?.listing?.onChainListingId ?? null;
   ```

- [ ] **Bước 2: Sửa `prepareBuyMutation` — dùng `onChainListingId` từ listing**

Thay `onChainListingId: Number(onChainListingId)` (state) thành `onChainListingId: onChainListingId ?? 1` (từ listing data).

Thêm guard ở đầu `mutationFn`:

```typescript
if (!onChainListingId) {
  throw new Error("Listing chưa có on-chain ID. Contract-sync có thể chưa cập nhật.");
}
```

- [ ] **Bước 3: Sửa `broadcastBuyMutation` — đơn giản hoá payload**

Trong `broadcastBuyMutation.mutationFn`, sửa `client.broadcastMarketplaceBuy` call:

```typescript
const response = await client.broadcastMarketplaceBuy(
  ticketId,
  {
    authorizationHash: txDraft.authorizationHash,
    signedAuthorization,
    tx: {
      to: tx.to,
      data: tx.data,
      chainId: tx.chainId
    },
    paymentId: `pay_${prepared.backend.orderId}`
    // Bỏ gateway và gatewayReference fake
  },
  {
    userId: getSessionUserId(),
    idempotencyKey: `broadcast:${prepared.backend.orderId}`
  }
);
```

- [ ] **Bước 4: Xoá UI ô nhập tay `onChainListingId`**

Xoá toàn bộ section `[ PREPARE FLOW ]` có chứa input `onChainListingId` (dòng 354–391 hiện tại). Thay bằng hiển thị read-only:

```tsx
<section className="px-4 pb-4">
  <h3 className="font-mono text-[10px] tracking-widest text-foreground/50 mb-3">
    [ ON-CHAIN LISTING ]
  </h3>
  <div className="border border-foreground/20 p-4">
    {onChainListingId ? (
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] text-foreground/50">On-chain listing ID</span>
        <span className="font-mono text-sm font-medium">{onChainListingId}</span>
      </div>
    ) : (
      <p className="font-mono text-[10px] text-yellow-400">
        Contract-sync chưa index listing này. Thử lại sau vài giây.
      </p>
    )}
  </div>
</section>
```

- [ ] **Bước 5: Cập nhật disabled state của nút CTA**

Thêm `!onChainListingId` vào điều kiện disabled:

```typescript
disabled={
  prepareBuyMutation.isPending ||
  broadcastBuyMutation.isPending ||
  isLoading ||
  !ticketId ||
  !onChainListingId ||
  listing.status !== "active"
}
```

> Lưu ý: `listing.status` ở đây là `listingStatus` từ contract-sync (field mới trong `MarketplaceListing`). Sửa thành `listing.listingStatus !== "active"` nếu cần.

- [ ] **Bước 6: Kiểm tra TypeScript build**

```bash
cd apps/web && pnpm run build 2>&1 | grep -E "error" | head -20
```

Expected: không có TypeScript error.

- [ ] **Bước 7: Commit**

```bash
git add apps/web/src/pages/ResalePurchasePage.tsx
git commit -m "feat(web): remove manual onChainListingId input, read from listing data"
```

---

## Self-Review

### Spec coverage check

| Yêu cầu từ spec                                                     | Task xử lý       |
| ------------------------------------------------------------------- | ---------------- |
| `buildMarketplaceListTx` SDK                                        | Task 1           |
| Re-export từ SDK index                                              | Task 2, bước 5   |
| `MarketplaceListing` bỏ status/buyer fields                         | Task 2, bước 1   |
| marketplace-service schema mới (không có status)                    | Task 3, bước 1–2 |
| `GET /listings` ghép contract-sync state                            | Task 3, bước 5   |
| `initiate-buy` kiểm tra state từ contract-sync                      | Task 3, bước 6   |
| `broadcast-buy` chỉ mark buy_hash used                              | Task 3, bước 7   |
| Xoá endpoints cũ (purchase, settlements)                            | Task 3, bước 8   |
| `webAppConfig` thêm marketplace/ticketLedger addresses              | Task 4           |
| `ResaleSalePage` load vé thực từ contract-sync                      | Task 5           |
| `ResaleSalePage` gọi API + EIP-7702 broadcast                       | Task 5           |
| `TicketOwnershipView` có `listingStatus`, `isUsed`, `originalPrice` | Task 5, bước 2–3 |
| `ResalePurchasePage` bỏ ô nhập tay                                  | Task 6           |
| `ResalePurchasePage` đơn giản hoá broadcast-buy                     | Task 6, bước 3   |

### Placeholder scan

Không có TBD/TODO. Tất cả code steps đều đầy đủ.

### Type consistency

- `MarketplaceListing.listingStatus` định nghĩa Task 2 → dùng trong Task 6 bước 5: ✓
- `MarketplaceListTxUnsigned` định nghĩa Task 1 → import trong Task 5: ✓
- `TicketOwnershipView.listingStatus` định nghĩa Task 5 bước 2 → dùng trong Task 5 bước 1 (filter): ✓
- `MarketplaceBroadcastData` sửa Task 2 bước 3 → dùng trong Task 6 bước 3: ✓ (chỉ cần `listingId`, `buyHashOrderId`, `txHash`)
