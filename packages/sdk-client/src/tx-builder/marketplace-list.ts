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
  },
  {
    name: "cancelListing",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "listingId", type: "uint256" }],
    outputs: []
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

export interface MarketplaceCancelTxParams {
  marketplaceAddress: `0x${string}`;
  handlerAddress: `0x${string}`;
  listingId: bigint;
  chainId: bigint;
  nonce: bigint;
}

export function buildMarketplaceCancelTx(
  params: MarketplaceCancelTxParams
): MarketplaceListTxUnsigned {
  if (params.listingId <= 0n) {
    throw new Error("buildMarketplaceCancelTx: listingId must be > 0");
  }

  const cancelCalldata = encodeFunctionData({
    abi: MARKETPLACE_V2_ABI,
    functionName: "cancelListing",
    args: [params.listingId]
  });

  const calls: HandlerCall[] = [
    { target: params.marketplaceAddress, value: 0n, data: cancelCalldata }
  ];

  const errors = validateCalls(calls);
  if (errors.length > 0) {
    throw new Error(`buildMarketplaceCancelTx: invalid calls - ${errors.join("; ")}`);
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
