/**
 * EIP-7702 Transaction Builder — encoding helpers.
 *
 * Provides pure functions for:
 *  1. Encoding Handler.executeBatch(Call[]) calldata.
 *  2. Building the EIP-7702 authorization tuple hash for off-chain signing.
 *  3. Assembling the full Eip7702BatchPayload from calls + signed auth.
 *
 * No wallet or RPC dependency — these are pure client-side construction helpers.
 */

import { encodeFunctionData, getAddress } from "viem";
import { hashAuthorization } from "viem/utils";
import type {
  HandlerCall,
  AuthorizationTuple,
  SignedAuthorization,
  Eip7702BatchPayload,
  Tx4Request
} from "./types.js";

// ---------------------------------------------------------------------------
// ABI definition — mirrors IHandler exactly
// ---------------------------------------------------------------------------

const HANDLER_ABI = [
  {
    name: "executeBatch",
    type: "function",
    stateMutability: "payable",
    inputs: [
      {
        name: "calls",
        type: "tuple[]",
        components: [
          { name: "target", type: "address" },
          { name: "value", type: "uint256" },
          { name: "data", type: "bytes" }
        ]
      }
    ],
    outputs: [{ name: "results", type: "bytes[]" }]
  }
] as const;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Encodes the calldata for `Handler.executeBatch(Call[] calls)`.
 *
 * @param calls  One or more HandlerCall structs. Must be non-empty (Handler enforces this on-chain too).
 * @returns ABI-encoded calldata `0x…` ready to attach as `tx.data`.
 */
export function encodeExecuteBatch(calls: HandlerCall[]): `0x${string}` {
  if (calls.length === 0) {
    throw new Error("encodeExecuteBatch: calls must be non-empty");
  }

  return encodeFunctionData({
    abi: HANDLER_ABI,
    functionName: "executeBatch",
    args: [
      calls.map((c) => ({
        target: c.target,
        value: c.value,
        data: c.data
      }))
    ]
  });
}

/**
 * Computes the EIP-7702 authorization hash that the EOA must sign.
 *
 * Uses viem's canonical EIP-7702 helper:
 *   keccak256(0x05 || rlp([chain_id, address, nonce]))
 *
 * @param tuple  The unsigned authorization tuple.
 * @returns The 32-byte authorization hash as a hex string.
 */
export function hashAuthorizationTuple(tuple: AuthorizationTuple): `0x${string}` {
  if (!Number.isSafeInteger(Number(tuple.chainId))) {
    throw new Error(
      "hashAuthorizationTuple: chainId must be a safe integer for viem compatibility"
    );
  }
  if (!Number.isSafeInteger(Number(tuple.nonce))) {
    throw new Error("hashAuthorizationTuple: nonce must be a safe integer for viem compatibility");
  }

  return hashAuthorization({
    chainId: Number(tuple.chainId),
    address: getAddress(tuple.address),
    nonce: Number(tuple.nonce)
  });
}

/**
 * Constructs an unsigned AuthorizationTuple.
 * A convenience factory — callers may also build the object directly.
 */
export function buildAuthorizationTuple(params: {
  chainId: bigint | number;
  handlerAddress: `0x${string}`;
  nonce: bigint | number;
}): AuthorizationTuple {
  return {
    chainId: BigInt(params.chainId),
    address: params.handlerAddress,
    nonce: BigInt(params.nonce)
  };
}

/**
 * Assembles the complete Eip7702BatchPayload from the calls + a pre-signed authorization.
 *
 * The returned payload can be submitted directly as a type-4 (SET_CODE) transaction:
 *   - `authorizationList` → `tx.authorizationList`
 *   - `encodedCalldata`   → `tx.data`
 *
 * @param calls              Batch of calls to execute.
 * @param signedAuth         The signed EIP-7702 authorization (from wallet).
 */
export function buildEip7702BatchPayload(
  calls: HandlerCall[],
  signedAuth: SignedAuthorization
): Eip7702BatchPayload {
  return {
    authorizationList: [signedAuth],
    encodedCalldata: encodeExecuteBatch(calls),
    calls
  };
}

/**
 * Converts a fully-assembled Eip7702BatchPayload into a broadcast-ready Tx4Request.
 *
 * The returned object maps onto viem's `sendTransaction` / `eth_sendTransaction` shape.
 * Fields that require RPC context (nonce, gas, fee data, from) are left `undefined`
 * so the caller can fill them in from the wallet session + an RPC fee-estimation call.
 *
 * @param payload     The assembled EIP-7702 batch payload (from buildEip7702BatchPayload).
 * @param from        The EOA address that will sign + send (optional — set after wallet auth).
 * @returns           A Tx4Request ready for fee-estimation and broadcast.
 */
export function assembleTx4(payload: Eip7702BatchPayload, from?: `0x${string}`): Tx4Request {
  if (payload.authorizationList.length === 0) {
    throw new Error("assembleTx4: authorizationList must not be empty");
  }
  const auth = payload.authorizationList[0]!;
  return {
    type: 4,
    from: from,
    to: auth.address,
    data: payload.encodedCalldata,
    value: 0n,
    authorizationList: payload.authorizationList,
    chainId: auth.chainId,
    // RPC-dependent fields — caller must fill these before broadcasting
    nonce: undefined,
    gas: undefined,
    maxFeePerGas: undefined,
    maxPriorityFeePerGas: undefined
  };
}

/**
 * Validates that a HandlerCall is structurally sound before encoding.
 * Returns a list of error strings; empty means valid.
 */
export function validateCalls(calls: HandlerCall[]): string[] {
  const errors: string[] = [];
  if (calls.length === 0) {
    errors.push("calls: must contain at least one entry");
  }
  for (let i = 0; i < calls.length; i++) {
    const c = calls[i]!;
    if (!c.target || c.target === "0x0000000000000000000000000000000000000000") {
      errors.push(`calls[${i}].target: must be a non-zero address`);
    }
    if (!c.target.startsWith("0x") || c.target.length !== 42) {
      errors.push(`calls[${i}].target: must be a 20-byte hex address`);
    }
    if (c.value < 0n) {
      errors.push(`calls[${i}].value: must be >= 0`);
    }
    if (!c.data.startsWith("0x")) {
      errors.push(`calls[${i}].data: must start with 0x`);
    }
  }
  return errors;
}
