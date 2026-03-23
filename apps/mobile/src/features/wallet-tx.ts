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
  assembleTx4,
  hashAuthorizationTuple,
  validateCalls,
  type Eip7702BatchPayload,
  type AuthorizationTuple,
  type SignedAuthorization,
  type Tx4Request,
  type WalletSigner
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
// Orchestrated flow result
// ---------------------------------------------------------------------------

/**
 * The result of a complete prepare → sign → assemble cycle.
 *
 * `tx4` is broadcast-ready except for the RPC-dependent fields (nonce, gas,
 * maxFeePerGas, maxPriorityFeePerGas) which are marked `undefined`.  The
 * caller fills those from an `eth_estimateGas` / `eth_feeHistory` call before
 * passing to `eth_sendRawTransaction`.
 */
export interface PurchaseFlowResult {
  /** The signed EIP-7702 payload (authorizationList + encodedCalldata + raw calls). */
  payload: Eip7702BatchPayload;
  /**
   * Broadcast-ready type-4 transaction request.
   * RPC-dependent fields (nonce, gas, maxFeePerGas, maxPriorityFeePerGas) are
   * `undefined` — fill them from the RPC before broadcast.
   */
  tx4: Tx4Request;
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

// ---------------------------------------------------------------------------
// Orchestrated prepare → sign → assemble flow
// ---------------------------------------------------------------------------

/**
 * Runs the full client-side prepare → sign → assemble cycle.
 *
 * This is the single entry-point the mobile UI calls once the backend has
 * returned a paymentHash + signature and the user is authenticated.
 *
 * Steps:
 *   1. buildPurchaseTx()     — encode calldata, build authorizationTuple
 *   2. signer.signAuthorization() — wallet signs the authorization hash
 *   3. assemble(signedAuth)  — merge signature into final Eip7702BatchPayload
 *   4. assembleTx4()         — wrap into a broadcast-ready Tx4Request
 *
 * The returned tx4 has type=4 and all chain-data fields filled.  The caller
 * must still fetch nonce / gas / fee data from the RPC before broadcasting.
 *
 * REMAINING GAP:
 *   Broadcast requires a live RPC connection (e.g. viem PublicClient +
 *   WalletClient pointed at a Pectra-enabled node).  That wiring is out of
 *   scope for this client-only workstream and is explicitly left undefined in
 *   tx4.nonce / tx4.gas / tx4.maxFeePerGas / tx4.maxPriorityFeePerGas.
 *
 * @param params  Purchase parameters (same as buildPurchaseTx).
 * @param signer  WalletSigner implementation.  Use MockEOASigner for tests.
 * @returns       PurchaseFlowResult with fully-assembled payload and Tx4Request.
 */
export async function executePurchaseFlow(
  params: PurchaseTxParams,
  signer: WalletSigner
): Promise<PurchaseFlowResult> {
  // 1. Prepare — pure encoding, no async
  const unsigned = buildPurchaseTx(params);

  // 2. Sign — async call to wallet (may show UI prompt in real implementation)
  const signedAuth = await signer.signAuthorization(
    unsigned.authorizationTuple,
    unsigned.authorizationHash
  );

  // 3. Assemble — merge signature into final payload
  const payload = unsigned.assemble(signedAuth);

  // 4. Wrap into type-4 tx request (from address = signer.address)
  const tx4 = assembleTx4(payload, signer.address);

  return { payload, tx4 };
}

// Re-export the types the mobile app layer needs from its public surface
export type { WalletSigner, Tx4Request, Eip7702BatchPayload, SignedAuthorization };
