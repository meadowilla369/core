import { loadConfig } from "./config.js";
import { log } from "./logger.js";
import { createKycServer } from "./server.js";

const config = loadConfig();
const server = createKycServer(config);

server.listen(config.port, config.host, () => {
  log(config.serviceName, "info", "KYC service listening", {
    host: config.host,
    port: config.port,
    provider: config.provider,
    fallbackProvider: config.fallbackProvider,
    minLivenessScore: config.minLivenessScore,
    minFaceMatchScore: config.minFaceMatchScore,
    internalApiKeyConfigured: Boolean(config.internalApiKey)
  });
});

function shutdown(signal: string): void {
  log(config.serviceName, "info", "Shutdown signal received", { signal });
  server.close(() => {
    log(config.serviceName, "info", "Server closed");
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
