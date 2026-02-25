import { loadConfig } from "./config.js";
import { log } from "./logger.js";
import { createRecoveryServer } from "./server.js";

const config = loadConfig();
const server = createRecoveryServer(config);

server.listen(config.port, config.host, () => {
  log(config.serviceName, "info", "Recovery service listening", {
    host: config.host,
    port: config.port,
    holdDurationSec: config.holdDurationSec,
    requiredVerificationChannels: config.requiredVerificationChannels,
    eligibilityScanIntervalMs: config.eligibilityScanIntervalMs
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
