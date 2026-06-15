import { loadConfig, loadRpcConfig } from "./config.js";
import { log } from "./logger.js";
import { RpcListener } from "./rpc-listener.js";
import { createContractSyncApp } from "./server.js";

const config = loadConfig();
const { server, ingestEvents, close } = await createContractSyncApp(config);

server.listen(config.port, config.host, () => {
  log(config.serviceName, "info", "Contract sync service listening", {
    host: config.host,
    port: config.port
  });
});

// ---------------------------------------------------------------------------
// Optional live RPC listener — only starts when env vars are fully configured
// ---------------------------------------------------------------------------

const rpcConfig = loadRpcConfig();
let rpcListener: RpcListener | null = null;

if (rpcConfig) {
  rpcListener = new RpcListener(
    { ...rpcConfig, serviceName: config.serviceName },
    ingestEvents,
    log
  );
  rpcListener.start();
} else {
  log(
    config.serviceName,
    "info",
    "RPC listener disabled (RPC_URL / TICKET_LEDGER_ADDRESS|TICKET_NFT_ADDRESS / MARKETPLACE_ADDRESS not set)",
    {}
  );
}

async function shutdown(signal: string): Promise<void> {
  log(config.serviceName, "info", "Shutdown signal received", { signal });
  rpcListener?.stop();
  await close();
  log(config.serviceName, "info", "Server closed");
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
