/**
 * rpc-listener.ts
 *
 * Live RPC log subscription using viem's watchContractEvent.
 *
 * This listener supports both the legacy TicketNFT/Marketplace event set and
 * the current TicketLedger/MarketplaceV2 event set used by local-chain flows.
 */

import { createPublicClient, http, webSocket, type Abi, type PublicClient } from "viem";

import type { EventProcessingResult } from "./server.js";
import type { ContractEventInput, RawLogMeta } from "./event-mapper.js";
import {
  mapListed,
  mapListingCancelled,
  mapMarketplaceListingCancelled,
  mapSaleCompleted,
  mapTicketCancelled,
  mapTicketListed,
  mapTicketPurchased,
  mapTicketRefunded,
  mapTicketSold,
  mapTicketTransferred,
  mapTicketUsed,
  mapTransfer
} from "./event-mapper.js";
import type { LogFn } from "./logger.js";

const LEGACY_TICKET_EVENTS = [
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

const CURRENT_TICKET_LEDGER_EVENTS = [
  {
    type: "event",
    name: "TicketPurchased",
    inputs: [
      { name: "ticketId", type: "uint256", indexed: true },
      { name: "buyer", type: "address", indexed: true },
      { name: "eventId", type: "uint256", indexed: false },
      { name: "price", type: "uint256", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false }
    ]
  },
  {
    type: "event",
    name: "TicketTransferred",
    inputs: [
      { name: "ticketId", type: "uint256", indexed: true },
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true }
    ]
  },
  {
    type: "event",
    name: "TicketUsed",
    inputs: [
      { name: "ticketId", type: "uint256", indexed: true },
      { name: "owner", type: "address", indexed: true },
      { name: "eventId", type: "uint256", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false }
    ]
  },
  {
    type: "event",
    name: "TicketCancelled",
    inputs: [
      { name: "ticketId", type: "uint256", indexed: true },
      { name: "refundAmount", type: "uint256", indexed: false }
    ]
  }
] as const satisfies Abi;

const LEGACY_MARKETPLACE_EVENTS = [
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

const CURRENT_MARKETPLACE_V2_EVENTS = [
  {
    type: "event",
    name: "TicketListed",
    inputs: [
      { name: "listingId", type: "uint256", indexed: true },
      { name: "seller", type: "address", indexed: true },
      { name: "ticketId", type: "uint256", indexed: true },
      { name: "price", type: "uint256", indexed: false }
    ]
  },
  {
    type: "event",
    name: "ListingCancelled",
    inputs: [
      { name: "listingId", type: "uint256", indexed: true },
      { name: "seller", type: "address", indexed: true },
      { name: "reason", type: "string", indexed: false }
    ]
  },
  {
    type: "event",
    name: "TicketSold",
    inputs: [
      { name: "listingId", type: "uint256", indexed: true },
      { name: "buyer", type: "address", indexed: true },
      { name: "seller", type: "address", indexed: true },
      { name: "ticketId", type: "uint256", indexed: false },
      { name: "price", type: "uint256", indexed: false }
    ]
  },
  {
    type: "function",
    name: "getListing",
    stateMutability: "view",
    inputs: [{ name: "listingId", type: "uint256" }],
    outputs: [
      { name: "listingId", type: "uint256" },
      { name: "ticketId", type: "uint256" },
      { name: "seller", type: "address" },
      { name: "price", type: "uint256" },
      { name: "active", type: "bool" },
      { name: "listedAt", type: "uint256" }
    ]
  }
] as const satisfies Abi;

export interface RpcListenerConfig {
  rpcUrl: string;
  chainId: number;
  ticketContractAddress: `0x${string}`;
  marketplaceAddress: `0x${string}`;
  serviceName: string;
}

export type IngestFn = (events: ContractEventInput[]) => EventProcessingResult[];

type UnwatchFn = () => void;

type LogMeta = {
  blockNumber: bigint | null;
  transactionHash: `0x${string}` | null;
  logIndex: number | null;
  address: `0x${string}`;
};

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

    const { rpcUrl, chainId, ticketContractAddress, marketplaceAddress, serviceName } = this.config;
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
      rpcUrl: rpcUrl.replace(/\/[^/]+$/, "/***"),
      chainId,
      ticketContractAddress,
      marketplaceAddress
    });

    this.watchLegacyTicketContract(ticketContractAddress, chainId);
    this.watchCurrentTicketLedger(ticketContractAddress, chainId);
    this.watchLegacyMarketplace(marketplaceAddress, chainId);
    this.watchCurrentMarketplaceV2(marketplaceAddress, chainId);
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

  private buildMeta(log: LogMeta, chainId: number): RawLogMeta {
    return {
      chainId,
      blockNumber: log.blockNumber ?? 0n,
      transactionHash: log.transactionHash ?? "0x",
      logIndex: log.logIndex ?? 0,
      address: log.address
    };
  }

  private ingestAndLog(message: string, events: ContractEventInput[]): void {
    if (events.length === 0) {
      return;
    }

    const results = this.ingest(events);
    const processed = results.filter((result) => result.status === "processed").length;
    const duplicates = results.filter((result) => result.status === "duplicate").length;
    const rejected = results.filter((result) => result.status === "rejected");

    this.log(this.config.serviceName, rejected.length > 0 ? "warn" : "info", message, {
      count: events.length,
      processed,
      duplicates,
      rejected: rejected.length,
      rejectedReasons: rejected.map((result) => result.reason).filter(Boolean)
    });
  }

  private watchLegacyTicketContract(address: `0x${string}`, chainId: number): void {
    const client = this.client!;

    const unwatchTransfer = client.watchContractEvent({
      address,
      abi: LEGACY_TICKET_EVENTS,
      eventName: "Transfer",
      onLogs: (logs) => {
        const events: ContractEventInput[] = [];
        for (const log of logs) {
          if (!log.args) continue;
          const args = log.args as { from: `0x${string}`; to: `0x${string}`; tokenId: bigint };
          events.push(mapTransfer(args, this.buildMeta(log, chainId)));
        }
        this.ingestAndLog("RPC legacy Transfer events received", events);
      },
      onError: (error) => {
        this.log(this.config.serviceName, "error", "RPC legacy Transfer watch error", {
          error: String(error)
        });
      }
    });

    const unwatchUsed = client.watchContractEvent({
      address,
      abi: LEGACY_TICKET_EVENTS,
      eventName: "TicketUsed",
      onLogs: (logs) => {
        const events: ContractEventInput[] = [];
        for (const log of logs) {
          if (!log.args) continue;
          const args = log.args as { tokenId: bigint; usedAt: bigint };
          events.push(mapTicketUsed(args, this.buildMeta(log, chainId)));
        }
        this.ingestAndLog("RPC legacy TicketUsed events received", events);
      },
      onError: (error) => {
        this.log(this.config.serviceName, "error", "RPC legacy TicketUsed watch error", {
          error: String(error)
        });
      }
    });

    const unwatchRefunded = client.watchContractEvent({
      address,
      abi: LEGACY_TICKET_EVENTS,
      eventName: "TicketRefunded",
      onLogs: (logs) => {
        const events: ContractEventInput[] = [];
        for (const log of logs) {
          if (!log.args) continue;
          const args = log.args as { tokenId: bigint; amount: bigint };
          events.push(mapTicketRefunded(args, this.buildMeta(log, chainId)));
        }
        this.ingestAndLog("RPC legacy TicketRefunded events received", events);
      },
      onError: (error) => {
        this.log(this.config.serviceName, "error", "RPC legacy TicketRefunded watch error", {
          error: String(error)
        });
      }
    });

    this.unwatchers.push(unwatchTransfer, unwatchUsed, unwatchRefunded);
  }

  private watchCurrentTicketLedger(address: `0x${string}`, chainId: number): void {
    const client = this.client!;

    const unwatchPurchased = client.watchContractEvent({
      address,
      abi: CURRENT_TICKET_LEDGER_EVENTS,
      eventName: "TicketPurchased",
      onLogs: (logs) => {
        const events: ContractEventInput[] = [];
        for (const log of logs) {
          if (!log.args) continue;
          const args = log.args as {
            ticketId: bigint;
            buyer: `0x${string}`;
            eventId: bigint;
            price: bigint;
            timestamp: bigint;
          };
          events.push(mapTicketPurchased(args, this.buildMeta(log, chainId)));
        }
        this.ingestAndLog("RPC TicketPurchased events received", events);
      },
      onError: (error) => {
        this.log(this.config.serviceName, "error", "RPC TicketPurchased watch error", {
          error: String(error)
        });
      }
    });

    const unwatchTransferred = client.watchContractEvent({
      address,
      abi: CURRENT_TICKET_LEDGER_EVENTS,
      eventName: "TicketTransferred",
      onLogs: (logs) => {
        const events: ContractEventInput[] = [];
        for (const log of logs) {
          if (!log.args) continue;
          const args = log.args as {
            ticketId: bigint;
            from: `0x${string}`;
            to: `0x${string}`;
          };
          events.push(mapTicketTransferred(args, this.buildMeta(log, chainId)));
        }
        this.ingestAndLog("RPC TicketTransferred events received", events);
      },
      onError: (error) => {
        this.log(this.config.serviceName, "error", "RPC TicketTransferred watch error", {
          error: String(error)
        });
      }
    });

    const unwatchUsed = client.watchContractEvent({
      address,
      abi: CURRENT_TICKET_LEDGER_EVENTS,
      eventName: "TicketUsed",
      onLogs: (logs) => {
        const events: ContractEventInput[] = [];
        for (const log of logs) {
          if (!log.args) continue;
          const args = log.args as {
            ticketId: bigint;
            owner: `0x${string}`;
            eventId: bigint;
            timestamp: bigint;
          };
          events.push(
            mapTicketUsed(
              { tokenId: args.ticketId, usedAt: args.timestamp },
              this.buildMeta(log, chainId)
            )
          );
        }
        this.ingestAndLog("RPC current TicketUsed events received", events);
      },
      onError: (error) => {
        this.log(this.config.serviceName, "error", "RPC current TicketUsed watch error", {
          error: String(error)
        });
      }
    });

    const unwatchCancelled = client.watchContractEvent({
      address,
      abi: CURRENT_TICKET_LEDGER_EVENTS,
      eventName: "TicketCancelled",
      onLogs: (logs) => {
        const events: ContractEventInput[] = [];
        for (const log of logs) {
          if (!log.args) continue;
          const args = log.args as { ticketId: bigint; refundAmount: bigint };
          events.push(mapTicketCancelled(args, this.buildMeta(log, chainId)));
        }
        this.ingestAndLog("RPC TicketCancelled events received", events);
      },
      onError: (error) => {
        this.log(this.config.serviceName, "error", "RPC TicketCancelled watch error", {
          error: String(error)
        });
      }
    });

    this.unwatchers.push(unwatchPurchased, unwatchTransferred, unwatchUsed, unwatchCancelled);
  }

  private watchLegacyMarketplace(address: `0x${string}`, chainId: number): void {
    const client = this.client!;

    const unwatchListed = client.watchContractEvent({
      address,
      abi: LEGACY_MARKETPLACE_EVENTS,
      eventName: "Listed",
      onLogs: (logs) => {
        const events: ContractEventInput[] = [];
        for (const log of logs) {
          if (!log.args) continue;
          const args = log.args as {
            tokenId: bigint;
            seller: `0x${string}`;
            price: bigint;
            expiresAt: bigint;
          };
          events.push(mapListed(args, this.buildMeta(log, chainId)));
        }
        this.ingestAndLog("RPC legacy Listed events received", events);
      },
      onError: (error) => {
        this.log(this.config.serviceName, "error", "RPC legacy Listed watch error", {
          error: String(error)
        });
      }
    });

    const unwatchSale = client.watchContractEvent({
      address,
      abi: LEGACY_MARKETPLACE_EVENTS,
      eventName: "SaleCompleted",
      onLogs: (logs) => {
        const events: ContractEventInput[] = [];
        for (const log of logs) {
          if (!log.args) continue;
          const args = log.args as {
            tokenId: bigint;
            seller: `0x${string}`;
            buyer: `0x${string}`;
            price: bigint;
          };
          events.push(mapSaleCompleted(args, this.buildMeta(log, chainId)));
        }
        this.ingestAndLog("RPC legacy SaleCompleted events received", events);
      },
      onError: (error) => {
        this.log(this.config.serviceName, "error", "RPC legacy SaleCompleted watch error", {
          error: String(error)
        });
      }
    });

    this.unwatchers.push(unwatchListed, unwatchSale);
  }

  private watchCurrentMarketplaceV2(address: `0x${string}`, chainId: number): void {
    const client = this.client!;

    const unwatchListed = client.watchContractEvent({
      address,
      abi: CURRENT_MARKETPLACE_V2_EVENTS,
      eventName: "TicketListed",
      onLogs: (logs) => {
        const events: ContractEventInput[] = [];
        for (const log of logs) {
          if (!log.args) continue;
          const args = log.args as {
            listingId: bigint;
            seller: `0x${string}`;
            ticketId: bigint;
            price: bigint;
          };
          events.push(mapTicketListed(args, this.buildMeta(log, chainId)));
        }
        this.ingestAndLog("RPC TicketListed events received", events);
      },
      onError: (error) => {
        this.log(this.config.serviceName, "error", "RPC TicketListed watch error", {
          error: String(error)
        });
      }
    });

    const unwatchCancelled = client.watchContractEvent({
      address,
      abi: CURRENT_MARKETPLACE_V2_EVENTS,
      eventName: "ListingCancelled",
      onLogs: async (logs) => {
        const events: ContractEventInput[] = [];
        for (const log of logs) {
          if (!log.args) continue;
          const args = log.args as {
            listingId: bigint;
            seller: `0x${string}`;
            reason: string;
          };
          const ticketId = await this.resolveMarketplaceTicketId(address, args.listingId);
          if (ticketId !== null) {
            events.push(
              mapMarketplaceListingCancelled(args, this.buildMeta(log, chainId), ticketId)
            );
          } else {
            events.push(
              mapListingCancelled(
                {
                  tokenId: args.listingId,
                  seller: args.seller,
                  reason: args.reason
                },
                this.buildMeta(log, chainId)
              )
            );
          }
        }
        this.ingestAndLog("RPC current ListingCancelled events received", events);
      },
      onError: (error) => {
        this.log(this.config.serviceName, "error", "RPC current ListingCancelled watch error", {
          error: String(error)
        });
      }
    });

    const unwatchSold = client.watchContractEvent({
      address,
      abi: CURRENT_MARKETPLACE_V2_EVENTS,
      eventName: "TicketSold",
      onLogs: (logs) => {
        const events: ContractEventInput[] = [];
        for (const log of logs) {
          if (!log.args) continue;
          const args = log.args as {
            listingId: bigint;
            buyer: `0x${string}`;
            seller: `0x${string}`;
            ticketId: bigint;
            price: bigint;
          };
          events.push(mapTicketSold(args, this.buildMeta(log, chainId)));
        }
        this.ingestAndLog("RPC TicketSold events received", events);
      },
      onError: (error) => {
        this.log(this.config.serviceName, "error", "RPC TicketSold watch error", {
          error: String(error)
        });
      }
    });

    this.unwatchers.push(unwatchListed, unwatchCancelled, unwatchSold);
  }

  private async resolveMarketplaceTicketId(
    marketplaceAddress: `0x${string}`,
    listingId: bigint
  ): Promise<bigint | null> {
    const client = this.client;
    if (!client) {
      return null;
    }

    try {
      const listing = await client.readContract({
        address: marketplaceAddress,
        abi: CURRENT_MARKETPLACE_V2_EVENTS,
        functionName: "getListing",
        args: [listingId]
      });

      return Array.isArray(listing) ? (listing[1] as bigint) : null;
    } catch (error) {
      this.log(this.config.serviceName, "warn", "Marketplace listing lookup failed", {
        listingId: String(listingId),
        error: String(error)
      });
      return null;
    }
  }
}
