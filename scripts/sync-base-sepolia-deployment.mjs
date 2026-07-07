#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];
    if (
      token === "--deployment" ||
      token === "--registry" ||
      token === "--env-output" ||
      token === "--template"
    ) {
      if (!next || next.startsWith("--")) {
        throw new Error(`Missing value for ${token}`);
      }
      args[token.slice(2)] = next;
      i += 1;
    } else if (token === "--network") {
      if (!next || next.startsWith("--")) {
        throw new Error(`Missing value for ${token}`);
      }
      args.network = next;
      i += 1;
    } else {
      throw new Error(`Unknown argument: ${token}`);
    }
  }

  return args;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function pickAddress(source, keys, label) {
  for (const key of keys) {
    const value = source?.[key];
    if (typeof value === "string" && value.startsWith("0x")) {
      return value;
    }
  }

  throw new Error(`Missing ${label} address in deployment output`);
}

function ensureNetworkRegistry(registry, network, chainId) {
  if (!registry.networks) {
    registry.networks = {};
  }

  if (!registry.networks[network]) {
    registry.networks[network] = { chainId, contracts: {} };
  }

  registry.networks[network].chainId = chainId;
  if (!registry.networks[network].contracts) {
    registry.networks[network].contracts = {};
  }

  return registry.networks[network];
}

function buildRuntimeEnv(template, deployment, chainId, rpcUrl) {
  const ticketLedger = pickAddress(deployment, ["ticketLedger", "ticketNFT"], "TicketLedger");
  const marketplace = pickAddress(deployment, ["marketplaceV2", "marketplace"], "MarketplaceV2");
  const ticketPaymaster = pickAddress(deployment, ["ticketPaymaster"], "TicketPaymaster");
  const handler = pickAddress(deployment, ["handler"], "Handler");

  const generated = [
    "",
    "# Generated contract addresses for Base Sepolia",
    `CHAIN_ID=${chainId}`,
    `TICKET_LEDGER_CHAIN_ID=${chainId}`,
    `MARKETPLACE_CHAIN_ID=${chainId}`,
    `RPC_URL=${rpcUrl}`,
    `BASE_RPC_URL=${rpcUrl}`,
    `TICKET_LEDGER_ADDRESS=${ticketLedger}`,
    `TICKET_NFT_ADDRESS=${ticketLedger}`,
    `MARKETPLACE_ADDRESS=${marketplace}`,
    `TICKET_PAYMASTER_ADDRESS=${ticketPaymaster}`,
    `HANDLER_ADDRESS=${handler}`,
    `VITE_CHAIN_ID=${chainId}`,
    `VITE_RPC_URL=${rpcUrl}`,
    `VITE_TICKET_LEDGER_ADDRESS=${ticketLedger}`,
    `VITE_MARKETPLACE_ADDRESS=${marketplace}`,
    `VITE_TICKET_PAYMASTER_ADDRESS=${ticketPaymaster}`,
    `VITE_HANDLER_ADDRESS=${handler}`
  ];

  return `${template.trimEnd()}\n${generated.join("\n")}\n`;
}

function main() {
  const args = parseArgs(process.argv);
  if (args.network !== "base-sepolia") {
    throw new Error(`Unsupported network: ${args.network}`);
  }

  const deploymentPath = resolve(args.deployment);
  const registryPath = resolve(args.registry);
  const templatePath = resolve(args.template);
  const envOutputPath = resolve(args["env-output"]);

  const deployment = readJson(deploymentPath);
  const chainId = Number(deployment.chainId ?? 84532);
  if (chainId !== 84532) {
    throw new Error(`Expected Base Sepolia chainId 84532, got ${chainId}`);
  }

  const registry = readJson(registryPath);
  const networkRegistry = ensureNetworkRegistry(registry, args.network, chainId);
  networkRegistry.contracts.TicketLedger = pickAddress(
    deployment,
    ["ticketLedger", "ticketNFT"],
    "TicketLedger"
  );
  networkRegistry.contracts.MarketplaceV2 = pickAddress(
    deployment,
    ["marketplaceV2", "marketplace"],
    "MarketplaceV2"
  );
  networkRegistry.contracts.TicketPaymaster = pickAddress(
    deployment,
    ["ticketPaymaster"],
    "TicketPaymaster"
  );
  networkRegistry.contracts.Handler = pickAddress(deployment, ["handler"], "Handler");
  registry.updatedAt = new Date().toISOString();
  writeJson(registryPath, registry);

  const template = readFileSync(templatePath, "utf8");
  const rpcUrl =
    process.env.RPC_URL?.trim() ||
    deployment.rpcUrl ||
    "https://base-sepolia.infura.io/v3/87d8f0675c114566a395060f35a9b6fe";
  writeFileSync(envOutputPath, buildRuntimeEnv(template, deployment, chainId, rpcUrl));

  console.log(`Updated registry: ${registryPath}`);
  console.log(`Wrote runtime env: ${envOutputPath}`);
}

main();
