import { loadConfig } from "./config.js";
import { log } from "./logger.js";
import { createDisputeServer } from "./server.js";

const config = loadConfig();
const server = createDisputeServer(config);

server.listen(config.port, config.host, () => {
  log(config.serviceName, "info", "Dispute service listening", {
    host: config.host,
    port: config.port,
    slaTier1Hours: config.slaTier1Hours,
    slaTier2Hours: config.slaTier2Hours,
    slaTier3Hours: config.slaTier3Hours,
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
