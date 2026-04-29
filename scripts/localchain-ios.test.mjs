import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

test("prints device-safe localchain environment for iOS builds", () => {
  const output = execFileSync("bash", ["scripts/localchain-ios.sh", "env"], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8",
    env: {
      ...process.env,
      LOCALCHAIN_PUBLIC_HOST: "10.0.0.5"
    }
  });

  const values = Object.fromEntries(
    output
      .trim()
      .split("\n")
      .map((line) => line.split("=", 2))
  );

  assert.equal(values.HOST, "0.0.0.0");
  assert.equal(values.ANVIL_HOST, "0.0.0.0");
  assert.equal(values.RPC_URL, "http://127.0.0.1:8545");
  assert.equal(values.VITE_API_BASE_URL, "http://10.0.0.5:3000");
  assert.equal(values.VITE_RPC_URL, "http://10.0.0.5:8545");
  assert.equal(values.CAPACITOR_SERVER_URL, "http://10.0.0.5:8080");
  assert.equal(values.VITE_DEV_HTTPS, "false");
});

test("uses Tailscale IPv4 as the default public host when available", () => {
  const binDir = mkdtempSync(join(tmpdir(), "localchain-ios-test-"));
  const tailscalePath = join(binDir, "tailscale");
  writeFileSync(
    tailscalePath,
    '#!/usr/bin/env sh\nif [ "$1" = "ip" ] && [ "$2" = "-4" ]; then printf "100.88.77.66\\n"; fi\n'
  );
  chmodSync(tailscalePath, 0o755);

  const output = execFileSync("bash", ["scripts/localchain-ios.sh", "env"], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8",
    env: {
      ...process.env,
      LOCALCHAIN_PUBLIC_HOST: "",
      PATH: `${binDir}:${process.env.PATH}`
    }
  });

  const values = Object.fromEntries(
    output
      .trim()
      .split("\n")
      .map((line) => line.split("=", 2))
  );

  assert.equal(values.LOCALCHAIN_PUBLIC_HOST, "100.88.77.66");
  assert.equal(values.CAPACITOR_SERVER_URL, "http://100.88.77.66:8080");
});

test("prints same-origin HTTPS URLs for iOS live reload when requested", () => {
  const output = execFileSync("bash", ["scripts/localchain-ios.sh", "env"], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8",
    env: {
      ...process.env,
      LOCALCHAIN_PUBLIC_HOST: "100.67.229.112",
      LOCALCHAIN_WEB_HTTPS: "true"
    }
  });

  const values = Object.fromEntries(
    output
      .trim()
      .split("\n")
      .map((line) => line.split("=", 2))
  );

  assert.equal(values.VITE_API_BASE_URL, "https://100.67.229.112:8080");
  assert.equal(values.VITE_RPC_URL, "https://100.67.229.112:8080/rpc");
  assert.equal(values.CAPACITOR_SERVER_URL, "https://100.67.229.112:8080");
  assert.equal(values.VITE_DEV_HTTPS, "true");
});

test("HTTPS mode overrides stale HTTP API and RPC values from env files", () => {
  const output = execFileSync("bash", ["scripts/localchain-ios.sh", "env"], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8",
    env: {
      ...process.env,
      LOCALCHAIN_PUBLIC_HOST: "100.67.229.112",
      LOCALCHAIN_WEB_HTTPS: "true",
      VITE_API_BASE_URL: "http://100.67.229.112:3000",
      VITE_RPC_URL: "http://100.67.229.112:8545"
    }
  });

  const values = Object.fromEntries(
    output
      .trim()
      .split("\n")
      .map((line) => line.split("=", 2))
  );

  assert.equal(values.VITE_API_BASE_URL, "https://100.67.229.112:8080");
  assert.equal(values.VITE_RPC_URL, "https://100.67.229.112:8080/rpc");
});
