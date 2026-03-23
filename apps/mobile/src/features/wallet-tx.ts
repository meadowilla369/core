/**
 * wallet-tx.ts
 *
 * Client-side helper that builds a ready-to-sign EIP-7702 batch payload for
 * the TicketLedger.purchaseWithSignature() flow.
 *
 * Call graph on-chain:
 *   EOA (delegated to Handler) → Handler.executeBatch([call])
 *     └─ TicketLedger.purchaseWithSignature(eventId, ticketTypeId, quantity, paymentHash, signature)
 *
 * The returned Eip7702BatchPayload contains:
 *   - encodedCalldata  → attach as tx.data
 *   - authorizationList → attach as tx.authorizationList
 *
 * The caller (wallet) must:
 *   1. Sign the authorizationTuple hash with the EOA private key to produce
 *      the SignedAuthorization (yParity, r, s).
 *   2. Submit a type-4 (SET_CODE) transaction using those values.
 *
 * No wallet, RPC, or network dependency here — pure encoding.
 */

import { encodeFunctionData } from "viem";
import {
  buildAuthorizationTuple,
  buildEip7702BatchPayload,
  hashAuthorizationTuple,
  validateCalls,
  type Eip7702BatchPayload,
  type AuthorizationTuple,
  type SignedAuthorization
} from "@ticket-platform/sdk-client";

// ---------------------------------------------------------------------------
// TicketLedger ABI — only the function we call from the client.
// Mirrors TicketLedger.sol purchaseWithSignature exactly.
// ---------------------------------------------------------------------------

const TICKET_LEDGER_ABI = [
  {
    name: "purchaseWithSignature",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "eventId", type: "uint256" },
      { name: "ticketTypeId", type: "uint256" },
      { name: "quantity", type: "uint256" },
      { name: "paymentHash", type: "bytes32" },
      { name: "signature", type: "bytes" }
    ],
    outputs: [{ name: "ticketIds", type: "uint256[]" }]
  }
] as const;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface PurchaseTxParams {
  /** On-chain address of the TicketLedger contract. */
  ticketLedgerAddress: `0x${string}`;
  /** On-chain address of the Handler implementation the EOA delegates to. */
  handlerAddress: `0x${string}`;
  /** Numeric event id (matches TicketLedger storage). */
  eventId: bigint;
  /** Numeric ticket type id. */
  ticketTypeId: bigint;
  /** Number of tickets to purchase. */
  quantity: bigint;
  /** One-time payment hash issued by the backend (bytes32). */
  paymentHash: `0x${string}`;
  /** Backend EIP-712 signature authorizing this purchase. */
  signature: `0x${string}`;
  /** Chain id for the EIP-7702 authorization tuple. */
  chainId: bigint;
  /** Current EOA nonce (for replay protection in the authorization tuple). */
  nonce: bigint;
}

export interface PurchaseTxUnsigned {
  /** The unsigned authorization tuple — wallet must sign its hash. */
  authorizationTuple: AuthorizationTuple;
  /** Hash the wallet signs to produce the SignedAuthorization. */
  authorizationHash: `0x${string}`;
  /**
   * Assembles the final payload once the wallet provides the signed auth.
   * Call this with the ECDSA components from the wallet to get the submittable tx.
   */
  assemble(signedAuth: SignedAuthorization): Eip7702BatchPayload;
}

// ---------------------------------------------------------------------------
// Core builder
// ---------------------------------------------------------------------------

/**
 * Builds the EIP-7702 purchase transaction payload (pre-signing step).
 *
 * Returns an unsigned intermediate that exposes:
 *  - authorizationTuple  — the tuple the wallet will sign
 *  - authorizationHash   — hash of the tuple (pass to wallet for signing)
 *  - assemble(signedAuth) — call after wallet signs to get final payload
 *
 * @throws if any call parameter fails structural validation
 */
export function buildPurchaseTx(params: PurchaseTxParams): PurchaseTxUnsigned {
  // 1. Encode TicketLedger.purchaseWithSignature() calldata
  const ledgerCalldata = encodeFunctionData({
    abi: TICKET_LEDGER_ABI,
    functionName: "purchaseWithSignature",
    args: [
      params.eventId,
      params.ticketTypeId,
      params.quantity,
      params.paymentHash,
      params.signature
    ]
  });

  // 2. Wrap as a HandlerCall (no ETH value — purchase is a state change only)
  const calls = [
    {
      target: params.ticketLedgerAddress,
      value: 0n,
      data: ledgerCalldata
    }
  ];

  // 3. Validate before encoding (surfaces errors early, before signing)
  const errors = validateCalls(calls);
  if (errors.length > 0) {
    throw new Error(`buildPurchaseTx: invalid calls — ${errors.join("; ")}`);
  }

  // 4. Build the unsigned authorization tuple
  const authorizationTuple = buildAuthorizationTuple({
    chainId: params.chainId,
    handlerAddress: params.handlerAddress,
    nonce: params.nonce
  });

  // 5. Compute the hash the wallet signs
  const authorizationHash = hashAuthorizationTuple(authorizationTuple);

  // 6. Return unsigned intermediate; wallet signs then calls assemble()
  return {
    authorizationTuple,
    authorizationHash,
    assemble(signedAuth: SignedAuthorization): Eip7702BatchPayload {
      return buildEip7702BatchPayload(calls, signedAuth);
    }
  };
}
