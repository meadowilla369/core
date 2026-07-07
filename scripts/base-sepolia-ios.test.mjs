import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

test("prints device-safe Base Sepolia environment for iOS builds", () => {
  const output = execFileSync("bash", ["scripts/base-sepolia-ios.sh", "env"], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8",
    env: {
      ...process.env,
      BASE_SEPOLIA_PUBLIC_HOST: "10.0.0.5"
    }
  });

  const values = Object.fromEntries(
    output
      .trim()
      .split("\n")
      .map((line) => line.split("=", 2))
  );

  assert.equal(values.BASE_SEPOLIA_PUBLIC_HOST, "10.0.0.5");
  assert.equal(values.HOST, "0.0.0.0");
  assert.equal(values.VITE_API_BASE_URL, "http://10.0.0.5:3000");
  assert.equal(
    values.VITE_RPC_URL,
    "https://base-sepolia.infura.io/v3/87d8f0675c114566a395060f35a9b6fe"
  );
  assert.equal(values.CAPACITOR_SERVER_URL, "http://10.0.0.5:8080");
});

test("uses Tailscale IPv4 as the default public host when available", () => {
  const binDir = mkdtempSync(join(tmpdir(), "base-sepolia-ios-test-"));
  const tailscalePath = join(binDir, "tailscale");
  writeFileSync(
    tailscalePath,
    '#!/usr/bin/env sh\nif [ "$1" = "ip" ] && [ "$2" = "-4" ]; then printf "100.88.77.66\\n"; fi\n'
  );
  chmodSync(tailscalePath, 0o755);

  const output = execFileSync("bash", ["scripts/base-sepolia-ios.sh", "env"], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8",
    env: {
      ...process.env,
      BASE_SEPOLIA_PUBLIC_HOST: "",
      PATH: `${binDir}:${process.env.PATH}`
    }
  });

  const values = Object.fromEntries(
    output
      .trim()
      .split("\n")
      .map((line) => line.split("=", 2))
  );

  assert.equal(values.BASE_SEPOLIA_PUBLIC_HOST, "100.88.77.66");
  assert.equal(values.CAPACITOR_SERVER_URL, "http://100.88.77.66:8080");
  assert.equal(values.VITE_API_BASE_URL, "http://100.88.77.66:3000");
});

test("prints HTTPS device-safe Base Sepolia environment when VITE_DEV_HTTPS is enabled", () => {
  const output = execFileSync("bash", ["scripts/base-sepolia-ios.sh", "env"], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8",
    env: {
      ...process.env,
      BASE_SEPOLIA_PUBLIC_HOST: "10.0.0.5",
      VITE_DEV_HTTPS: "true"
    }
  });

  const values = Object.fromEntries(
    output
      .trim()
      .split("\n")
      .map((line) => line.split("=", 2))
  );

  assert.equal(values.VITE_DEV_HTTPS, "true");
  assert.equal(values.VITE_API_BASE_URL, "https://10.0.0.5:8080");
  assert.equal(values.VITE_RPC_URL, "https://10.0.0.5:8080/rpc");
  assert.equal(values.CAPACITOR_SERVER_URL, "https://10.0.0.5:8080");
});

test("overrides stale Capacitor server URL when HTTPS mode is enabled", () => {
  const output = execFileSync("bash", ["scripts/base-sepolia-ios.sh", "env"], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8",
    env: {
      ...process.env,
      BASE_SEPOLIA_PUBLIC_HOST: "10.0.0.5",
      VITE_DEV_HTTPS: "true",
      CAPACITOR_SERVER_URL: "https://:8080"
    }
  });

  const values = Object.fromEntries(
    output
      .trim()
      .split("\n")
      .map((line) => line.split("=", 2))
  );

  assert.equal(values.CAPACITOR_SERVER_URL, "https://10.0.0.5:8080");
});
