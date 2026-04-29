import { Capacitor } from "@capacitor/core";

export const configureNativeStatusBar = async () => {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");

    await StatusBar.setOverlaysWebView({ overlay: true });
    await StatusBar.setStyle({ style: Style.Dark });
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn("Unable to configure native status bar", error);
    }
  }
};
