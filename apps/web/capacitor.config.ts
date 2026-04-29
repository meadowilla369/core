/// <reference types="@capacitor/status-bar" />

import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.entr.ticketplatform",
  appName: "Entr",
  webDir: "dist",
  ios: {
    contentInset: "never"
  },
  plugins: {
    StatusBar: {
      overlaysWebView: true,
      style: "DARK"
    }
  }
};

export default config;
