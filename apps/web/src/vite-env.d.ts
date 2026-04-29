/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_RPC_URL?: string;
  readonly VITE_ENTR_UNIVERSAL_LINK_ORIGIN?: string;
  readonly VITE_DEMO_USER_ID?: string;
  readonly VITE_DEMO_WALLET_ADDRESS?: string;
  readonly VITE_DEMO_WALLET_PRIVATE_KEY?: `0x${string}`;
  readonly VITE_ONBOARDING_PREFUND_POLL_INTERVAL_MS?: string;
  readonly VITE_ONBOARDING_PREFUND_TIMEOUT_MS?: string;
  readonly VITE_HANDLER_ADDRESS?: `0x${string}`;
  readonly VITE_DEMO_MOMO_WEBHOOK_SECRET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
