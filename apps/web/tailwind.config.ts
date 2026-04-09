import type { Config } from "tailwindcss";
import sharedPreset from "../../packages/tailwind-config/preset.js";

export default {
  presets: [sharedPreset],
  content: ["./index.html", "./src/**/*.{ts,tsx}", "../../packages/shared-ui/src/**/*.{ts,tsx}"]
} satisfies Config;
