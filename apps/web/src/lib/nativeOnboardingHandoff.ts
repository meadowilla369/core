import type { ApiClient } from "@ticket-platform/sdk-client";

import { savePersistedSessionSnapshot } from "../features/onboarding/storage.ts";
import type { OnboardingPrefundState } from "../features/onboarding/types.ts";
import { createLocalWallet, hydrateLocalWallet } from "../features/onboarding/wallet.ts";
import { secureGet, secureSet, SECURE_KEY_PRIVATE_KEY, SECURE_KEY_WALLET_ADDRESS } from "./secureStorage.ts";
import { webAppConfig } from "./config.ts";

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

async function pollPrefund(
  client: ApiClient,
  walletAddress: string
): Promise<OnboardingPrefundState> {
  const deadline = Date.now() + webAppConfig.onboardingPrefundTimeoutMs;

  while (Date.now() <= deadline) {
    const result = await client.getWalletPrefundStatus(walletAddress);

    if (result.data.funded) {
      return {
        funded: true,
        txHash: result.data.txHash
      };
    }

    await sleep(webAppConfig.onboardingPrefundPollIntervalMs);
  }

  throw new Error("Waiting for native wallet prefund confirmation");
}

export async function bootstrapNativeWalletFromHandoff(client: ApiClient, handoffToken: string) {
  const exchanged = await client.exchangeOnboardingHandoffToken({
    handoffToken,
    deviceId: "entr-native",
    deviceName: "Entr native app",
    platform: "native"
  });

  // Reuse existing wallet from Keychain if available
  const securePrivateKey = await secureGet(SECURE_KEY_PRIVATE_KEY);
  const wallet = securePrivateKey
    ? hydrateLocalWallet(securePrivateKey as `0x${string}`)
    : createLocalWallet();

  // Persist to Keychain
  await secureSet(SECURE_KEY_PRIVATE_KEY, wallet.privateKey as string);
  await secureSet(SECURE_KEY_WALLET_ADDRESS, wallet.walletAddress as string);
  const registered = await client.registerPaymentWallet(
    { walletAddress: wallet.walletAddress },
    { userId: exchanged.data.userId }
  );
  const prefundState: OnboardingPrefundState = {
    funded: registered.data.prefunded,
    txHash: registered.data.prefundTxHash ?? null
  };
  const finalPrefund = prefundState.funded
    ? prefundState
    : await pollPrefund(client, wallet.walletAddress);

  savePersistedSessionSnapshot({
    userId: exchanged.data.userId,
    sessionId: exchanged.data.sessionId,
    phone: exchanged.data.phone,
    walletAddress: wallet.walletAddress,
    privateKey: wallet.privateKey,
    accessToken: exchanged.data.accessToken,
    refreshToken: exchanged.data.refreshToken,
    accessTokenExpiresAt: exchanged.data.accessTokenExpiresAt,
    refreshTokenExpiresAt: exchanged.data.refreshTokenExpiresAt
  });

  return {
    auth: exchanged.data,
    wallet,
    prefund: finalPrefund
  };
}
