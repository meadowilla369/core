#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];
    if (token === "--base" || token === "--override" || token === "--output") {
      if (!next || next.startsWith("--")) {
        throw new Error(`Missing value for ${token}`);
      }
      args[token.slice(2)] = next;
      i += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }
  return args;
}

function readEnvFile(path) {
  const result = new Map();
  const lines = readFileSync(path, "utf8").split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = rawLine.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = rawLine.slice(0, separatorIndex).trim();
    const value = rawLine.slice(separatorIndex + 1);
    if (key) {
      result.set(key, value);
    }
  }

  return result;
}

function shouldSkipOverride(key) {
  return (
    key === "DATABASE_URL" ||
    key === "REDIS_URL" ||
    key === "COMPOSE_PROJECT_NAME" ||
    key.startsWith("POSTGRES_") ||
    key.startsWith("MINIO_")
  );
}

function mergeEnvFiles(basePath, overridePath) {
  const merged = readEnvFile(basePath);
  const overrides = readEnvFile(overridePath);

  for (const [key, value] of overrides.entries()) {
    if (shouldSkipOverride(key)) {
      continue;
    }
    merged.set(key, value);
  }

  return merged;
}

function serializeEnv(entries) {
  return Array.from(entries.entries())
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
}

function main() {
  const args = parseArgs(process.argv);
  if (!args.base || !args.override || !args.output) {
    throw new Error("Usage: --base <path> --override <path> --output <path>");
  }

  const basePath = resolve(args.base);
  const overridePath = resolve(args.override);
  const outputPath = resolve(args.output);

  const merged = mergeEnvFiles(basePath, overridePath);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${serializeEnv(merged)}\n`);

  console.log(`Wrote merged env: ${outputPath}`);
}

main();
