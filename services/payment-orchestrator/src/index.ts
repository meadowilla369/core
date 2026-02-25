import { loadConfig } from "./config.js";
import { log } from "./logger.js";
import { createPaymentOrchestratorServer } from "./server.js";

const config = loadConfig();
const server = createPaymentOrchestratorServer(config);

server.listen(config.port, config.host, () => {
  log(config.serviceName, "info", "Payment orchestrator listening", {
    host: config.host,
    port: config.port,
    allowedGateways: config.allowedGateways,
    webhookMaxSkewSec: config.webhookMaxSkewSec,
    maxWebhookRetries: config.maxWebhookRetries
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
