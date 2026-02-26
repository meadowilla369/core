import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(THIS_DIR, "../../../..");

const SERVICE_MODULES = {
  "api-gateway": {
    configPath: "services/api-gateway/dist/config.js",
    serverPath: "services/api-gateway/dist/server.js",
    createExport: "createGatewayServer"
  },
  "auth-service": {
    configPath: "services/auth-service/dist/config.js",
    serverPath: "services/auth-service/dist/server.js",
    createExport: "createAuthServer"
  },
  "event-service": {
    configPath: "services/event-service/dist/config.js",
    serverPath: "services/event-service/dist/server.js",
    createExport: "createEventServer"
  },
  "ticketing-service": {
    configPath: "services/ticketing-service/dist/config.js",
    serverPath: "services/ticketing-service/dist/server.js",
    createExport: "createTicketingServer"
  },
  "payment-orchestrator": {
    configPath: "services/payment-orchestrator/dist/config.js",
    serverPath: "services/payment-orchestrator/dist/server.js",
    createExport: "createPaymentOrchestratorServer"
  },
  "worker-mint": {
    configPath: "services/worker-mint/dist/config.js",
    serverPath: "services/worker-mint/dist/server.js",
    createExport: "createWorkerMintServer"
  },
  "marketplace-service": {
    configPath: "services/marketplace-service/dist/config.js",
    serverPath: "services/marketplace-service/dist/server.js",
    createExport: "createMarketplaceServer"
  },
  "checkin-service": {
    configPath: "services/checkin-service/dist/config.js",
    serverPath: "services/checkin-service/dist/server.js",
    createExport: "createCheckinServer"
  },
  "refund-service": {
    configPath: "services/refund-service/dist/config.js",
    serverPath: "services/refund-service/dist/server.js",
    createExport: "createRefundServer"
  },
  "recovery-service": {
    configPath: "services/recovery-service/dist/config.js",
    serverPath: "services/recovery-service/dist/server.js",
    createExport: "createRecoveryServer"
  },
  "dispute-service": {
    configPath: "services/dispute-service/dist/config.js",
    serverPath: "services/dispute-service/dist/server.js",
    createExport: "createDisputeServer"
  },
  "kyc-service": {
    configPath: "services/kyc-service/dist/config.js",
    serverPath: "services/kyc-service/dist/server.js",
    createExport: "createKycServer"
  }
};

async function main() {
  const serviceKey = process.argv[2];
  if (!serviceKey || !SERVICE_MODULES[serviceKey]) {
    const supported = Object.keys(SERVICE_MODULES).join(", ");
    throw new Error(`Unknown service key: ${serviceKey ?? "<empty>"}. Supported: ${supported}`);
  }

  const definition = SERVICE_MODULES[serviceKey];

  const configModule = await import(pathToFileURL(path.resolve(REPO_ROOT, definition.configPath)).href);
  const serverModule = await import(pathToFileURL(path.resolve(REPO_ROOT, definition.serverPath)).href);

  const loadConfig = configModule.loadConfig;
  const createServer = serverModule[definition.createExport];

  if (typeof loadConfig !== "function") {
    throw new Error(`loadConfig() not found for ${serviceKey}`);
  }

  if (typeof createServer !== "function") {
    throw new Error(`${definition.createExport}() not found for ${serviceKey}`);
  }

  const config = loadConfig();
  const server = createServer(config);

  server.listen(config.port, config.host);

  const shutdown = () => {
    server.close(() => process.exit(0));
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
