/**
 * EIP-7702 Transaction Builder — core types.
 *
 * These mirror the on-chain IHandler.Call struct and the EIP-7702 authorization
 * tuple so that client code stays in sync with the contract without importing
 * Solidity artefacts directly.
 */

/** Mirrors IHandler.Call: one atomic call in the batch. */
export interface HandlerCall {
  /** Contract address to call (must be on paymaster's allowlist). */
  target: `0x${string}`;
  /** ETH value to forward with the call (in wei, bigint). */
  value: bigint;
  /** Encoded calldata for the target function. */
  data: `0x${string}`;
}

/**
 * EIP-7702 authorization tuple (before signing).
 * Per EIP-7702 §3: (chain_id, address, nonce)
 */
export interface AuthorizationTuple {
  /** Chain ID the delegation is valid for. Use 0 for any-chain (not recommended). */
  chainId: bigint;
  /** Address of the Handler implementation to delegate the EOA to. */
  address: `0x${string}`;
  /** EOA nonce at the time of signing (prevents replay). */
  nonce: bigint;
}

/**
 * A signed EIP-7702 authorization tuple ready to include in a type-4 tx.
 * yParity + r + s are the ECDSA components over the authorisation hash.
 */
export interface SignedAuthorization extends AuthorizationTuple {
  yParity: 0 | 1;
  r: `0x${string}`;
  s: `0x${string}`;
}

/**
 * Complete EIP-7702 batch payload ready to hand off to a wallet or RPC.
 * The caller assembles this and submits it as a type-4 (SET_CODE) transaction.
 */
export interface Eip7702BatchPayload {
  /** Authorization list: one entry per EOA being delegated in this tx. */
  authorizationList: SignedAuthorization[];
  /** Encoded calldata for Handler.executeBatch(Call[]) to attach as tx.data. */
  encodedCalldata: `0x${string}`;
  /** Raw Call structs kept alongside the encoded form for logging/debugging. */
  calls: HandlerCall[];
}

/**
 * A broadcast-ready EIP-7702 (type-4, SET_CODE) transaction request.
 *
 * Field names match viem's `sendTransaction` / `eth_sendTransaction` shape so
 * callers can pass this directly to `walletClient.sendTransaction(tx4)` once a
 * real RPC connection is available.
 *
 * Fields left as `undefined` must be filled in by the broadcast layer:
 *  - `from`    — the EOA address (known after wallet sign-in)
 *  - `to`      — the Handler address (same as authorizationList[0].address)
 *  - `nonce`   — transaction nonce (may differ from authorization nonce)
 *  - `gas`     — estimated gas (requires RPC call to eth_estimateGas)
 *  - `maxFeePerGas` / `maxPriorityFeePerGas` — requires RPC fee data
 */
export interface Tx4Request {
  /** Always 4 for EIP-7702 SET_CODE transactions. */
  type: 4;
  /** The EOA address sending the transaction. Fill in from authenticated wallet. */
  from: `0x${string}` | undefined;
  /** Handler contract address (receives the executeBatch call). */
  to: `0x${string}`;
  /** ABI-encoded Handler.executeBatch(calls) calldata. */
  data: `0x${string}`;
  /** ETH value forwarded with the transaction (in wei). 0n for pure state changes. */
  value: bigint;
  /** EIP-7702 authorization list — one entry per delegated EOA. */
  authorizationList: SignedAuthorization[];
  /**
   * Remaining fields that require RPC/wallet context to fill.
   * They are typed but left undefined here to make the gap explicit.
   */
  nonce: number | undefined;
  gas: bigint | undefined;
  maxFeePerGas: bigint | undefined;
  maxPriorityFeePerGas: bigint | undefined;
  /** Chain ID the transaction targets (from the authorization tuple). */
  chainId: bigint;
}
