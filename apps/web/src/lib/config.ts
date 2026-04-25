export interface WebAppConfig {
  apiBaseUrl: string;
  rpcUrl: string;
  demoUserId: string;
  demoWalletAddress: string;
  demoWalletPrivateKey: `0x${string}`;
  onboardingPrefundPollIntervalMs: number;
  onboardingPrefundTimeoutMs: number;
  defaultKycStatus: "pending" | "approved";
  handlerAddress: `0x${string}`;
  demoMomoWebhookSecret: string;
}

export const webAppConfig: WebAppConfig = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000",
  rpcUrl: import.meta.env.VITE_RPC_URL ?? "http://127.0.0.1:8545",
  demoUserId: import.meta.env.VITE_DEMO_USER_ID ?? "buyer_demo_web_3",
  demoWalletAddress:
    import.meta.env.VITE_DEMO_WALLET_ADDRESS ?? "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
  demoWalletPrivateKey:
    (import.meta.env.VITE_DEMO_WALLET_PRIVATE_KEY as `0x${string}` | undefined) ??
    "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
  onboardingPrefundPollIntervalMs: Number(
    import.meta.env.VITE_ONBOARDING_PREFUND_POLL_INTERVAL_MS ?? 1500
  ),
  onboardingPrefundTimeoutMs: Number(import.meta.env.VITE_ONBOARDING_PREFUND_TIMEOUT_MS ?? 45000),
  defaultKycStatus: "approved",
  handlerAddress:
    (import.meta.env.VITE_HANDLER_ADDRESS as `0x${string}` | undefined) ??
    "0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF",
  demoMomoWebhookSecret: import.meta.env.VITE_DEMO_MOMO_WEBHOOK_SECRET ?? "momo_dev_secret"
};
