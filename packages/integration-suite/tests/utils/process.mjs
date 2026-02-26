import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_TIMEOUT_MS = 15_000;
const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const RUNNER = path.resolve(THIS_DIR, "run-service.mjs");

export function buildEnv(overrides = {}) {
  return {
    ...process.env,
    NODE_NO_WARNINGS: "1",
    ...overrides
  };
}

export function startService(name, serviceKey, env = {}, cwd = process.cwd()) {
  const child = spawn(process.execPath, [RUNNER, serviceKey], {
    cwd,
    env: buildEnv(env),
    stdio: ["ignore", "pipe", "pipe"]
  });

  let logs = "";
  child.stdout.on("data", (chunk) => {
    logs += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    logs += chunk.toString();
  });

  return {
    name,
    serviceKey,
    child,
    getLogs() {
      return logs;
    }
  };
}

export async function waitForHealth(baseUrl, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/healthz`, { method: "GET" });
      if (response.ok) {
        return;
      }
      lastError = new Error(`healthz status ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await delay(150);
  }

  throw new Error(`Service at ${baseUrl} did not become healthy in time: ${String(lastError)}`);
}

export async function stopService(handle) {
  if (!handle || !handle.child || handle.child.killed) {
    return;
  }

  handle.child.kill("SIGTERM");

  const exitPromise = new Promise((resolve) => {
    handle.child.once("exit", resolve);
  });

  const timeoutPromise = delay(3_000).then(() => {
    if (!handle.child.killed) {
      handle.child.kill("SIGKILL");
    }
  });

  await Promise.race([exitPromise, timeoutPromise]);
}

export async function stopServices(handles) {
  const reversed = [...handles].reverse();
  for (const handle of reversed) {
    await stopService(handle);
  }
}

export async function withServices(services, testFn) {
  const handles = services.map((service) => startService(service.name, service.serviceKey, service.env, service.cwd));

  try {
    await Promise.all(services.map((service) => waitForHealth(service.baseUrl)));
    return await testFn(handles);
  } catch (error) {
    const details = handles
      .map((handle) => {
        const logs = handle.getLogs().trim();
        if (!logs) {
          return `=== ${handle.name} logs ===\n(no logs)`;
        }
        return `=== ${handle.name} logs ===\n${logs}`;
      })
      .join("\n\n");

    const message = `${error instanceof Error ? error.message : String(error)}\n\n${details}`;
    throw new Error(message);
  } finally {
    await stopServices(handles);
  }
}
