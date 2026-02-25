import { loadConfig } from "./config.js";
import { log } from "./logger.js";
import { createGatewayServer } from "./server.js";

const config = loadConfig();
const server = createGatewayServer(config);

server.listen(config.port, config.host, () => {
  log(config.serviceName, "info", "API gateway listening", {
    host: config.host,
    port: config.port,
    authServiceBaseUrl: config.authServiceBaseUrl,
    userServiceBaseUrl: config.userServiceBaseUrl,
    kycServiceBaseUrl: config.kycServiceBaseUrl,
    eventServiceBaseUrl: config.eventServiceBaseUrl,
    ticketingServiceBaseUrl: config.ticketingServiceBaseUrl
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
