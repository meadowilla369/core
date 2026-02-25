import { loadConfig } from "./config.js";
import { log } from "./logger.js";
import { createAuthServer } from "./server.js";

const config = loadConfig();
const server = createAuthServer(config);

server.listen(config.port, config.host, () => {
  log(config.serviceName, "info", "Auth service listening", {
    host: config.host,
    port: config.port,
    otpLength: config.otpLength,
    otpTtlSec: config.otpTtlSec
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
