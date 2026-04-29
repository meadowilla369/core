import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";

const devCertDir = path.resolve(__dirname, "./certs");
const useDevHttps = process.env.VITE_DEV_HTTPS === "true";
const devApiProxyTarget = process.env.VITE_DEV_API_PROXY_TARGET ?? "http://127.0.0.1:3000";
const devRpcProxyTarget = process.env.VITE_DEV_RPC_PROXY_TARGET ?? "http://127.0.0.1:8545";

export default defineConfig({
  server: {
    host: "::",
    port: 8080,
    https: useDevHttps
      ? {
          key: fs.readFileSync(path.join(devCertDir, "dev-key.pem")),
          cert: fs.readFileSync(path.join(devCertDir, "dev-cert.pem"))
        }
      : undefined,
    proxy: useDevHttps
      ? {
          "/v1": {
            target: devApiProxyTarget,
            changeOrigin: true
          },
          "/rpc": {
            target: devRpcProxyTarget,
            changeOrigin: true,
            rewrite: (requestPath) => requestPath.replace(/^\/rpc/, "")
          }
        }
      : undefined
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@ticket-platform/sdk-client": path.resolve(
        __dirname,
        "../../packages/sdk-client/src/index.ts"
      ),
      "@ticket-platform/shared-types": path.resolve(
        __dirname,
        "../../packages/shared-types/src/index.ts"
      ),
      "@ticket-platform/shared-ui": path.resolve(__dirname, "../../packages/shared-ui/src/index.ts")
    }
  }
});
