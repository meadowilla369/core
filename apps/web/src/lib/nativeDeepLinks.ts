import { Capacitor } from "@capacitor/core";
import type { NavigateFunction } from "react-router-dom";

import { parseEntrDeepLink } from "./appLinks.ts";

type ExchangeHandoff = (handoffToken: string) => Promise<void> | void;

export async function applyEntrDeepLink(
  url: string,
  navigate: (path: string) => void,
  exchangeHandoff: ExchangeHandoff
) {
  const parsed = parseEntrDeepLink(url);

  if (parsed.handoffToken) {
    await exchangeHandoff(parsed.handoffToken);
  }

  navigate(parsed.path);
}

export async function configureEntrNativeDeepLinks(
  navigate: NavigateFunction,
  exchangeHandoff: ExchangeHandoff
) {
  if (!Capacitor.isNativePlatform()) {
    return undefined;
  }

  const { App } = await import("@capacitor/app");
  const launchUrl = await App.getLaunchUrl();

  if (launchUrl?.url) {
    await applyEntrDeepLink(launchUrl.url, navigate, exchangeHandoff);
  }

  const listener = await App.addListener("appUrlOpen", (event) => {
    void applyEntrDeepLink(event.url, navigate, exchangeHandoff);
  });

  return () => {
    void listener.remove();
  };
}
