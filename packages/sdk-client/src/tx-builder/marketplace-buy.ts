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

const MARKETPLACE_V2_ABI = [
  {
    name: "buyWithSignature",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "listingId", type: "uint256" },
      { name: "paymentHash", type: "bytes32" },
      { name: "signature", type: "bytes" }
    ],
    outputs: []
  }
] as const;

export interface MarketplaceBuyTxParams {
  marketplaceAddress: `0x${string}`;
  handlerAddress: `0x${string}`;
  listingId: bigint;
  paymentHash: `0x${string}`;
  signature: `0x${string}`;
  chainId: bigint;
  nonce: bigint;
}

export interface MarketplaceBuyTxUnsigned {
  authorizationTuple: AuthorizationTuple;
  authorizationHash: `0x${string}`;
  businessCalldata: `0x${string}`;
  executeBatchCalldata: `0x${string}`;
  calls: HandlerCall[];
  assemble(signedAuth: SignedAuthorization): Eip7702BatchPayload;
}

export function buildMarketplaceBuyTx(params: MarketplaceBuyTxParams): MarketplaceBuyTxUnsigned {
  const businessCalldata = encodeFunctionData({
    abi: MARKETPLACE_V2_ABI,
    functionName: "buyWithSignature",
    args: [params.listingId, params.paymentHash, params.signature]
  });

  const calls: HandlerCall[] = [
    {
      target: params.marketplaceAddress,
      value: 0n,
      data: businessCalldata
    }
  ];

  const errors = validateCalls(calls);
  if (errors.length > 0) {
    throw new Error(`buildMarketplaceBuyTx: invalid calls - ${errors.join("; ")}`);
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
    businessCalldata,
    executeBatchCalldata,
    calls,
    assemble(signedAuth: SignedAuthorization): Eip7702BatchPayload {
      return buildEip7702BatchPayload(calls, signedAuth);
    }
  };
}
