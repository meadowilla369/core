/**
 * rpc-listener.ts
 *
 * Live RPC log subscription using viem's watchContractEvent.
 *
 * RpcListener subscribes to:
 *   - TicketNFT: Transfer, TicketUsed, TicketRefunded
 *   - Marketplace: Listed, ListingCancelled, SaleCompleted
 *
 * Each decoded log is mapped to ContractEventInput via event-mapper.ts and
 * forwarded to the ingestEvents() function exposed by the HTTP server, so
 * both the HTTP push path and the live RPC path share identical processing.
 *
 * Usage:
 *   const listener = new RpcListener(config, ingestFn, logger);
 *   listener.start();   // begins watching; idempotent
 *   listener.stop();    // unsubscribes all watchers
 */

import { createPublicClient, http, webSocket, type Abi, type PublicClient } from "viem";

import type { ContractEventInput, RawLogMeta } from "./event-mapper.js";
import {
  mapTransfer,
  mapTicketUsed,
  mapTicketRefunded,
  mapListed,
  mapListingCancelled,
  mapSaleCompleted
} from "./event-mapper.js";
import type { LogFn } from "./logger.js";

// ---------------------------------------------------------------------------
// Minimal ABI fragments — only the events we care about
// ---------------------------------------------------------------------------

const TICKET_NFT_EVENTS = [
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: true }
    ]
  },
  {
    type: "event",
    name: "TicketUsed",
    inputs: [
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "usedAt", type: "uint256", indexed: false }
    ]
  },
  {
    type: "event",
    name: "TicketRefunded",
    inputs: [
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "amount", type: "uint256", indexed: false }
    ]
  }
] as const satisfies Abi;

const MARKETPLACE_EVENTS = [
  {
    type: "event",
    name: "Listed",
    inputs: [
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "seller", type: "address", indexed: true },
      { name: "price", type: "uint256", indexed: false },
      { name: "expiresAt", type: "uint64", indexed: false }
    ]
  },
  {
    type: "event",
    name: "ListingCancelled",
    inputs: [
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "seller", type: "address", indexed: true },
      { name: "reason", type: "string", indexed: false }
    ]
  },
  {
    type: "event",
    name: "SaleCompleted",
    inputs: [
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "seller", type: "address", indexed: true },
      { name: "buyer", type: "address", indexed: true },
      { name: "price", type: "uint256", indexed: false }
    ]
  }
] as const satisfies Abi;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RpcListenerConfig {
  rpcUrl: string;
  chainId: number;
  ticketNftAddress: `0x${string}`;
  marketplaceAddress: `0x${string}`;
  serviceName: string;
}

/** Callback signature that matches the server's ingestEvents export */
export type IngestFn = (events: ContractEventInput[]) => void;

type UnwatchFn = () => void;

// ---------------------------------------------------------------------------
// RpcListener
// ---------------------------------------------------------------------------

export class RpcListener {
  private readonly config: RpcListenerConfig;
  private readonly ingest: IngestFn;
  private readonly log: LogFn;
  private client: PublicClient | null = null;
  private unwatchers: UnwatchFn[] = [];
  private running = false;

  constructor(config: RpcListenerConfig, ingest: IngestFn, log: LogFn) {
    this.config = config;
    this.ingest = ingest;
    this.log = log;
  }

  start(): void {
    if (this.running) {
      return;
    }
    this.running = true;

    const { rpcUrl, chainId, ticketNftAddress, marketplaceAddress, serviceName } = this.config;

    // Choose transport: prefer WebSocket (persistent connection), fall back to HTTP polling
    const transport = rpcUrl.startsWith("ws") ? webSocket(rpcUrl) : http(rpcUrl);

    this.client = createPublicClient({
      transport,
      chain: {
        id: chainId,
        name: "custom",
        nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
        rpcUrls: { default: { http: [rpcUrl] } }
      }
    });

    this.log(serviceName, "info", "RpcListener starting", {
      rpcUrl: rpcUrl.replace(/\/[^/]+$/, "/***"), // redact key/path
      chainId,
      ticketNftAddress,
      marketplaceAddress
    });

    this.watchTicketNft(ticketNftAddress, chainId);
    this.watchMarketplace(marketplaceAddress, chainId);
  }

  stop(): void {
    for (const unwatch of this.unwatchers) {
      try {
        unwatch();
      } catch {
        // best-effort
      }
    }
    this.unwatchers = [];
    this.running = false;
    this.log(this.config.serviceName, "info", "RpcListener stopped", {});
  }

  // ---------------------------------------------------------------------------
  // Private watchers
  // ---------------------------------------------------------------------------

  private buildMeta(
    log: {
      blockNumber: bigint | null;
      transactionHash: `0x${string}` | null;
      logIndex: number | null;
      address: `0x${string}`;
    },
    chainId: number
  ): RawLogMeta {
    return {
      chainId,
      blockNumber: log.blockNumber ?? 0n,
      transactionHash: log.transactionHash ?? "0x",
      logIndex: log.logIndex ?? 0,
      address: log.address
    };
  }

  private watchTicketNft(address: `0x${string}`, chainId: number): void {
    const client = this.client!;
    const { serviceName } = this.config;

    const unwatchTransfer = client.watchContractEvent({
      address,
      abi: TICKET_NFT_EVENTS,
      eventName: "Transfer",
      onLogs: (logs) => {
        const events: ContractEventInput[] = [];
        for (const l of logs) {
          if (!l.args) continue;
          const args = l.args as { from: `0x${string}`; to: `0x${string}`; tokenId: bigint };
          events.push(mapTransfer(args, this.buildMeta(l, chainId)));
        }
        if (events.length > 0) {
          this.log(serviceName, "info", "RPC Transfer events received", { count: events.length });
          this.ingest(events);
        }
      },
      onError: (err) => {
        this.log(serviceName, "error", "RPC Transfer watch error", { error: String(err) });
      }
    });

    const unwatchUsed = client.watchContractEvent({
      address,
      abi: TICKET_NFT_EVENTS,
      eventName: "TicketUsed",
      onLogs: (logs) => {
        const events: ContractEventInput[] = [];
        for (const l of logs) {
          if (!l.args) continue;
          const args = l.args as { tokenId: bigint; usedAt: bigint };
          events.push(mapTicketUsed(args, this.buildMeta(l, chainId)));
        }
        if (events.length > 0) {
          this.log(serviceName, "info", "RPC TicketUsed events received", { count: events.length });
          this.ingest(events);
        }
      },
      onError: (err) => {
        this.log(serviceName, "error", "RPC TicketUsed watch error", { error: String(err) });
      }
    });

    const unwatchRefunded = client.watchContractEvent({
      address,
      abi: TICKET_NFT_EVENTS,
      eventName: "TicketRefunded",
      onLogs: (logs) => {
        const events: ContractEventInput[] = [];
        for (const l of logs) {
          if (!l.args) continue;
          const args = l.args as { tokenId: bigint; amount: bigint };
          events.push(mapTicketRefunded(args, this.buildMeta(l, chainId)));
        }
        if (events.length > 0) {
          this.log(serviceName, "info", "RPC TicketRefunded events received", {
            count: events.length
          });
          this.ingest(events);
        }
      },
      onError: (err) => {
        this.log(serviceName, "error", "RPC TicketRefunded watch error", { error: String(err) });
      }
    });

    this.unwatchers.push(unwatchTransfer, unwatchUsed, unwatchRefunded);
  }

  private watchMarketplace(address: `0x${string}`, chainId: number): void {
    const client = this.client!;
    const { serviceName } = this.config;

    const unwatchListed = client.watchContractEvent({
      address,
      abi: MARKETPLACE_EVENTS,
      eventName: "Listed",
      onLogs: (logs) => {
        const events: ContractEventInput[] = [];
        for (const l of logs) {
          if (!l.args) continue;
          const args = l.args as {
            tokenId: bigint;
            seller: `0x${string}`;
            price: bigint;
            expiresAt: bigint;
          };
          events.push(mapListed(args, this.buildMeta(l, chainId)));
        }
        if (events.length > 0) {
          this.log(serviceName, "info", "RPC Listed events received", { count: events.length });
          this.ingest(events);
        }
      },
      onError: (err) => {
        this.log(serviceName, "error", "RPC Listed watch error", { error: String(err) });
      }
    });

    const unwatchCancelled = client.watchContractEvent({
      address,
      abi: MARKETPLACE_EVENTS,
      eventName: "ListingCancelled",
      onLogs: (logs) => {
        const events: ContractEventInput[] = [];
        for (const l of logs) {
          if (!l.args) continue;
          const args = l.args as { tokenId: bigint; seller: `0x${string}`; reason: string };
          events.push(mapListingCancelled(args, this.buildMeta(l, chainId)));
        }
        if (events.length > 0) {
          this.log(serviceName, "info", "RPC ListingCancelled events received", {
            count: events.length
          });
          this.ingest(events);
        }
      },
      onError: (err) => {
        this.log(serviceName, "error", "RPC ListingCancelled watch error", { error: String(err) });
      }
    });

    const unwatchSale = client.watchContractEvent({
      address,
      abi: MARKETPLACE_EVENTS,
      eventName: "SaleCompleted",
      onLogs: (logs) => {
        const events: ContractEventInput[] = [];
        for (const l of logs) {
          if (!l.args) continue;
          const args = l.args as {
            tokenId: bigint;
            seller: `0x${string}`;
            buyer: `0x${string}`;
            price: bigint;
          };
          events.push(mapSaleCompleted(args, this.buildMeta(l, chainId)));
        }
        if (events.length > 0) {
          this.log(serviceName, "info", "RPC SaleCompleted events received", {
            count: events.length
          });
          this.ingest(events);
        }
      },
      onError: (err) => {
        this.log(serviceName, "error", "RPC SaleCompleted watch error", { error: String(err) });
      }
    });

    this.unwatchers.push(unwatchListed, unwatchCancelled, unwatchSale);
  }
}
