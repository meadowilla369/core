import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  server: {
    host: "::",
    port: 8080
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
