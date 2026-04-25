import type { SignedAuthorization, Tx4Request } from "@ticket-platform/sdk-client";
import { createWalletClient, defineChain, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { loadOnboardingDraft, loadPersistedSessionSnapshot } from "@/features/onboarding/storage";
import { webAppConfig } from "./config";

export interface SessionWallet {
  walletAddress: `0x${string}` | string;
  privateKey: `0x${string}` | string | null;
}

export function getSessionUserId(): string {
  return loadPersistedSessionSnapshot()?.userId ?? webAppConfig.demoUserId;
}

export function getSessionWalletAddress(): string {
  return getSessionWallet().walletAddress;
}

export function getSessionWallet(): SessionWallet {
  const onboardingDraft = loadOnboardingDraft();
  const persistedSession = loadPersistedSessionSnapshot();
  const draftWallet = onboardingDraft?.wallet;
  const hasPersistedWallet = Boolean(persistedSession?.walletAddress);

  return {
    walletAddress:
      draftWallet?.walletAddress ??
      persistedSession?.walletAddress ??
      webAppConfig.demoWalletAddress,
    privateKey:
      draftWallet?.privateKey ??
      persistedSession?.privateKey ??
      (hasPersistedWallet ? null : webAppConfig.demoWalletPrivateKey)
  };
}

export function signSessionAuthorization(input: {
  authorization: {
    address: `0x${string}`;
    chainId: bigint;
  };
}): Promise<SignedAuthorization> {
  const { walletAddress, privateKey } = getSessionWallet();
  if (!privateKey) {
    throw new Error("Session wallet khong co private key. Hay chay lai onboarding de tao signer hop le.");
  }

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  if (account.address.toLowerCase() !== walletAddress.toLowerCase()) {
    throw new Error("Session wallet private key khong khop voi wallet address hien tai");
  }

  const chain = defineChain({
    id: Number(input.authorization.chainId),
    name: `localchain-${input.authorization.chainId}`,
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18
    },
    rpcUrls: {
      default: {
        http: [webAppConfig.rpcUrl]
      }
    }
  });
  const client = createWalletClient({
    account,
    chain,
    transport: http(webAppConfig.rpcUrl)
  });

  return client.signAuthorization({
    account,
    contractAddress: input.authorization.address,
    chainId: Number(input.authorization.chainId),
    executor: "self"
  });
}

export function getSignedSessionTransactionInput(tx: Tx4Request): {
  privateKey: `0x${string}`;
  tx: Tx4Request;
} {
  const { walletAddress, privateKey } = getSessionWallet();
  if (!privateKey) {
    throw new Error("Session wallet khong co private key. Hay chay lai onboarding de broadcast purchase.");
  }

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  if (account.address.toLowerCase() !== walletAddress.toLowerCase()) {
    throw new Error("Session wallet private key khong khop voi wallet address hien tai");
  }

  return {
    privateKey: privateKey as `0x${string}`,
    tx: {
      ...tx,
      from: account.address
    }
  };
}
