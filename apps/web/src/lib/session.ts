import { webAppConfig } from "./config";

export function getSessionUserId(): string {
  return webAppConfig.demoUserId;
}

export function getSessionWalletAddress(): string {
  return webAppConfig.demoWalletAddress;
}
