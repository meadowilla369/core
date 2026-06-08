import { createRequire } from "node:module";
import type { Config } from "tailwindcss";

const require = createRequire(import.meta.url);
const sharedPreset = require("../../packages/tailwind-config/preset.js") as Config;

export default {
  presets: [sharedPreset],
  content: ["./index.html", "./src/**/*.{ts,tsx}"]
} satisfies Config;
