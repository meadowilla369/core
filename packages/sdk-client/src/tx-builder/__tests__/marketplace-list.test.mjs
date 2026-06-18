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
