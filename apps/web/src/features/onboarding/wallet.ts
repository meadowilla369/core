import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

import type { OnboardingWalletDraft } from "./types";

export function createLocalWallet(): OnboardingWalletDraft {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);

  return {
    privateKey,
    walletAddress: account.address
  };
}

export function hydrateLocalWallet(privateKey: `0x${string}` | string): OnboardingWalletDraft {
  const account = privateKeyToAccount(privateKey as `0x${string}`);

  return {
    privateKey,
    walletAddress: account.address
  };
}
