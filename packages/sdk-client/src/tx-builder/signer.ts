/**
 * signer.ts — WalletSigner signing-boundary abstraction.
 *
 * Defines the minimal interface a wallet must implement to participate in the
 * EIP-7702 purchase flow.  The real implementation will be injected by the
 * wallet provider (WalletConnect, embedded wallet SDK, hardware key, etc.).
 *
 * MockEOASigner is a deterministic stub for unit tests and demo harnesses.
 * It does NOT produce valid ECDSA signatures — it is solely for structural
 * testing that the orchestration wiring is correct.
 *
 * REMAINING GAP:
 *   A production WalletSigner must use the EOA private key (held inside a
 *   secure enclave / WalletConnect session / hardware wallet) to compute a
 *   real secp256k1 ECDSA signature over authorizationHash.  The mock below
 *   fills in fixed bytes so tests can exercise the full call graph without a
 *   key.  Plugging in a real signer requires only replacing MockEOASigner with
 *   a provider-backed implementation — the interface contract stays the same.
 */

import type { AuthorizationTuple, SignedAuthorization } from "./types.js";

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

/**
 * Minimal wallet signing contract.
 *
 * A wallet provider (WalletConnect, embedded key, hardware wallet) implements
 * this and returns it to the mobile app.  The app calls signAuthorization()
 * once per purchase and never handles private key material directly.
 */
export interface WalletSigner {
  /** EOA address whose private key backs this signer. */
  readonly address: `0x${string}`;

  /**
   * Signs the EIP-7702 authorization tuple hash.
   *
   * The implementor must:
   *   1. Compute the secp256k1 ECDSA signature over `authorizationHash`.
   *   2. Return the (yParity, r, s) components merged into the tuple.
   *
   * @param tuple             The unsigned authorization tuple.
   * @param authorizationHash The 32-byte hash to sign (from hashAuthorizationTuple).
   * @returns A Promise resolving to the fully-signed authorization.
   * @throws  If the user rejects the signing request or the key is unavailable.
   */
  signAuthorization(
    tuple: AuthorizationTuple,
    authorizationHash: `0x${string}`
  ): Promise<SignedAuthorization>;
}

// ---------------------------------------------------------------------------
// MockEOASigner — test/demo stub
// ---------------------------------------------------------------------------

/**
 * Deterministic mock signer for unit tests and demo harnesses.
 *
 * ⚠️  NOT cryptographically valid.  Do NOT use in production or for any
 *     transaction intended to be broadcast to a real network.
 *
 * Returns fixed r/s bytes derived from the input hash so tests can assert
 * on determinism without a real secp256k1 implementation.
 */
export class MockEOASigner implements WalletSigner {
  readonly address: `0x${string}`;

  constructor(address: `0x${string}` = "0xMockEOA00000000000000000000000000000000") {
    this.address = address;
  }

  async signAuthorization(
    tuple: AuthorizationTuple,
    authorizationHash: `0x${string}`
  ): Promise<SignedAuthorization> {
    // Derive mock r/s from the hash so the output is deterministic per input.
    // In a real implementation this would be secp256k1.sign(hash, privateKey).
    const hashHex = authorizationHash.slice(2); // strip 0x
    const r = `0x${hashHex.padStart(64, "0")}` as `0x${string}`;
    const s = `0x${hashHex.split("").reverse().join("").padStart(64, "0")}` as `0x${string}`;

    return {
      ...tuple,
      yParity: 0,
      r,
      s
    };
  }
}
