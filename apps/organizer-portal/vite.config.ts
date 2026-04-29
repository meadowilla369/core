import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5178,
    proxy: {
      "/v1": {
        target: process.env.VITE_DEV_API_PROXY_TARGET ?? "http://127.0.0.1:3000",
        changeOrigin: true
      }
    }
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  }
});
