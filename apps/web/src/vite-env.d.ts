/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_RPC_URL?: string;
  readonly VITE_DEMO_USER_ID?: string;
  readonly VITE_DEMO_WALLET_ADDRESS?: string;
  readonly VITE_HANDLER_ADDRESS?: `0x${string}`;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
