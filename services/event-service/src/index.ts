import { loadConfig } from "./config.js";
import { log } from "./logger.js";
import { createEventServer } from "./server.js";

const config = loadConfig();
const server = createEventServer(config);

server.listen(config.port, config.host, () => {
  log(config.serviceName, "info", "Event service listening", {
    host: config.host,
    port: config.port
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
