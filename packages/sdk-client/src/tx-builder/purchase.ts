import { encodeFunctionData } from "viem";

import {
  buildAuthorizationTuple,
  buildEip7702BatchPayload,
  hashAuthorizationTuple,
  validateCalls
} from "./encoder.js";
import type { AuthorizationTuple, Eip7702BatchPayload, SignedAuthorization } from "./types.js";

const TICKET_LEDGER_ABI = [
  {
    name: "purchaseWithSignature",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "eventId", type: "uint256" },
      { name: "ticketTypeId", type: "uint256" },
      { name: "quantity", type: "uint256" },
      { name: "price", type: "uint256" },
      { name: "paymentHash", type: "bytes32" },
      { name: "signature", type: "bytes" }
    ],
    outputs: [{ name: "ticketIds", type: "uint256[]" }]
  }
] as const;

export interface PurchaseTxParams {
  ticketLedgerAddress: `0x${string}`;
  handlerAddress: `0x${string}`;
  eventId: bigint;
  ticketTypeId: bigint;
  quantity: bigint;
  /** Off-chain purchase price in VND, stored in the Ticket struct for on-chain markup cap checks. */
  price: bigint;
  paymentHash: `0x${string}`;
  signature: `0x${string}`;
  chainId: bigint;
  nonce: bigint;
}

export interface PurchaseTxUnsigned {
  authorizationTuple: AuthorizationTuple;
  authorizationHash: `0x${string}`;
  calls: Array<{
    target: `0x${string}`;
    value: bigint;
    data: `0x${string}`;
  }>;
  businessCalldata: `0x${string}`;
  assemble(signedAuth: SignedAuthorization): Eip7702BatchPayload;
}

export function buildPurchaseTx(params: PurchaseTxParams): PurchaseTxUnsigned {
  const businessCalldata = encodeFunctionData({
    abi: TICKET_LEDGER_ABI,
    functionName: "purchaseWithSignature",
    args: [
      params.eventId,
      params.ticketTypeId,
      params.quantity,
      params.price,
      params.paymentHash,
      params.signature
    ]
  });

  const calls = [
    {
      target: params.ticketLedgerAddress,
      value: 0n,
      data: businessCalldata
    }
  ];

  const errors = validateCalls(calls);
  if (errors.length > 0) {
    throw new Error(`buildPurchaseTx: invalid calls - ${errors.join("; ")}`);
  }

  const authorizationTuple = buildAuthorizationTuple({
    chainId: params.chainId,
    handlerAddress: params.handlerAddress,
    nonce: params.nonce
  });
  const authorizationHash = hashAuthorizationTuple(authorizationTuple);

  return {
    authorizationTuple,
    authorizationHash,
    calls,
    businessCalldata,
    assemble(signedAuth: SignedAuthorization): Eip7702BatchPayload {
      return buildEip7702BatchPayload(calls, signedAuth);
    }
  };
}
