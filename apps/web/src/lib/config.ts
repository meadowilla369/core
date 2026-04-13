export interface WebAppConfig {
  apiBaseUrl: string;
  rpcUrl: string;
  demoUserId: string;
  demoWalletAddress: string;
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
  defaultKycStatus: "approved",
  handlerAddress:
    (import.meta.env.VITE_HANDLER_ADDRESS as `0x${string}` | undefined) ??
    "0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF",
  demoMomoWebhookSecret: import.meta.env.VITE_DEMO_MOMO_WEBHOOK_SECRET ?? "momo_dev_secret"
};
