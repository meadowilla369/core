/**
 * event-mapper.ts
 *
 * Pure functions that translate decoded on-chain log objects (from viem
 * watchContractEvent) into the ContractEventInput shape consumed by applyEvent()
 * in server.ts.  All functions are side-effect-free so they can be unit-tested
 * without any live RPC connection.
 */

export interface ContractEventInput {
  chainId?: number;
  blockNumber?: number;
  transactionHash?: string;
  logIndex?: number;
  eventName?: string;
  contractAddress?: string;
  occurredAt?: string;
  payload?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Shared log metadata extracted by viem for every watched event
// ---------------------------------------------------------------------------

export interface RawLogMeta {
  chainId: number;
  blockNumber: bigint;
  transactionHash: `0x${string}`;
  logIndex: number;
  address: `0x${string}`;
  blockTimestamp?: bigint; // not present on all transports; optional
}

// ---------------------------------------------------------------------------
// TicketNFT events
// ---------------------------------------------------------------------------

/**
 * Transfer(address from, address to, uint256 tokenId)
 *
 * Maps to the service's "Transfer" event, recording new owner.
 * toUserId is not on-chain; it stays null here and can be enriched by a
 * separate user-lookup pass after ingestion if needed.
 */
export function mapTransfer(
  args: { from: `0x${string}`; to: `0x${string}`; tokenId: bigint },
  meta: RawLogMeta
): ContractEventInput {
  return {
    chainId: meta.chainId,
    blockNumber: Number(meta.blockNumber),
    transactionHash: meta.transactionHash,
    logIndex: meta.logIndex,
    eventName: "Transfer",
    contractAddress: meta.address,
    occurredAt: meta.blockTimestamp ? blockTsToIso(meta.blockTimestamp) : undefined,
    payload: {
      tokenId: String(args.tokenId),
      from: args.from,
      to: args.to
    }
  };
}

/**
 * TicketUsed(uint256 tokenId, uint256 usedAt)
 */
export function mapTicketUsed(
  args: { tokenId: bigint; usedAt: bigint },
  meta: RawLogMeta
): ContractEventInput {
  const usedAtIso = new Date(Number(args.usedAt) * 1000).toISOString();
  return {
    chainId: meta.chainId,
    blockNumber: Number(meta.blockNumber),
    transactionHash: meta.transactionHash,
    logIndex: meta.logIndex,
    eventName: "TicketUsed",
    contractAddress: meta.address,
    occurredAt: usedAtIso,
    payload: {
      tokenId: String(args.tokenId),
      usedAt: usedAtIso
    }
  };
}

/**
 * TicketRefunded(uint256 tokenId, uint256 amount)
 */
export function mapTicketRefunded(
  args: { tokenId: bigint; amount: bigint },
  meta: RawLogMeta
): ContractEventInput {
  const refundedAtIso = meta.blockTimestamp
    ? blockTsToIso(meta.blockTimestamp)
    : new Date().toISOString();
  return {
    chainId: meta.chainId,
    blockNumber: Number(meta.blockNumber),
    transactionHash: meta.transactionHash,
    logIndex: meta.logIndex,
    eventName: "TicketRefunded",
    contractAddress: meta.address,
    occurredAt: refundedAtIso,
    payload: {
      tokenId: String(args.tokenId),
      amount: String(args.amount),
      refundedAt: refundedAtIso
    }
  };
}

// ---------------------------------------------------------------------------
// Marketplace events
// ---------------------------------------------------------------------------

/**
 * Listed(uint256 tokenId, address seller, uint256 price, uint64 expiresAt)
 *
 * Maps to "ListingStatusChanged" with status="active".
 */
export function mapListed(
  args: { tokenId: bigint; seller: `0x${string}`; price: bigint; expiresAt: bigint },
  meta: RawLogMeta
): ContractEventInput {
  return {
    chainId: meta.chainId,
    blockNumber: Number(meta.blockNumber),
    transactionHash: meta.transactionHash,
    logIndex: meta.logIndex,
    eventName: "ListingStatusChanged",
    contractAddress: meta.address,
    occurredAt: meta.blockTimestamp ? blockTsToIso(meta.blockTimestamp) : undefined,
    payload: {
      tokenId: String(args.tokenId),
      status: "active",
      seller: args.seller,
      price: String(args.price),
      expiresAt: Number(args.expiresAt)
    }
  };
}

/**
 * ListingCancelled(uint256 tokenId, address seller, string reason)
 *
 * Maps to "ListingStatusChanged" with status="cancelled".
 */
export function mapListingCancelled(
  args: { tokenId: bigint; seller: `0x${string}`; reason: string },
  meta: RawLogMeta
): ContractEventInput {
  return {
    chainId: meta.chainId,
    blockNumber: Number(meta.blockNumber),
    transactionHash: meta.transactionHash,
    logIndex: meta.logIndex,
    eventName: "ListingStatusChanged",
    contractAddress: meta.address,
    occurredAt: meta.blockTimestamp ? blockTsToIso(meta.blockTimestamp) : undefined,
    payload: {
      tokenId: String(args.tokenId),
      status: "cancelled",
      seller: args.seller,
      reason: args.reason
    }
  };
}

/**
 * SaleCompleted(uint256 tokenId, address seller, address buyer, uint256 price)
 *
 * Maps to "ListingStatusChanged" with status="completed".
 * Note: the on-chain Transfer event for the same tx will also arrive and
 * update ownership; dedup by txHash:logIndex handles the ordering.
 */
export function mapSaleCompleted(
  args: { tokenId: bigint; seller: `0x${string}`; buyer: `0x${string}`; price: bigint },
  meta: RawLogMeta
): ContractEventInput {
  return {
    chainId: meta.chainId,
    blockNumber: Number(meta.blockNumber),
    transactionHash: meta.transactionHash,
    logIndex: meta.logIndex,
    eventName: "ListingStatusChanged",
    contractAddress: meta.address,
    occurredAt: meta.blockTimestamp ? blockTsToIso(meta.blockTimestamp) : undefined,
    payload: {
      tokenId: String(args.tokenId),
      status: "completed",
      seller: args.seller,
      buyer: args.buyer,
      price: String(args.price)
    }
  };
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function blockTsToIso(ts: bigint): string {
  return new Date(Number(ts) * 1000).toISOString();
}
