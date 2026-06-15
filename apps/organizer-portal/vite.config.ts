import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

const certDir = path.join(__dirname, "../web/certs");
const useHttps = fs.existsSync(path.join(certDir, "dev-cert.pem"));

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5178,
    https: useHttps
      ? {
          key: fs.readFileSync(path.join(certDir, "dev-key.pem")),
          cert: fs.readFileSync(path.join(certDir, "dev-cert.pem"))
        }
      : undefined,
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
