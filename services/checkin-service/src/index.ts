import { loadConfig } from "./config.js";
import { log } from "./logger.js";
import { createCheckinServer } from "./server.js";

const config = loadConfig();
const server = createCheckinServer(config);

server.listen(config.port, config.host, () => {
  log(config.serviceName, "info", "Check-in service listening", {
    host: config.host,
    port: config.port,
    maxQrAgeSec: config.maxQrAgeSec,
    maxClockSkewSec: config.maxClockSkewSec,
    markAsUsedPollMs: config.markAsUsedPollMs,
    markAsUsedMaxRetries: config.markAsUsedMaxRetries
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
