import { spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const port = Number(process.env.UI_PORT ?? "4310");
const host = process.env.UI_HOST ?? "127.0.0.1";

const projects = [
  "apps/mobile/tsconfig.json",
  "apps/staff-scanner/tsconfig.json",
  "apps/organizer-portal/tsconfig.json"
];

function buildApps() {
  if (process.env.UI_SKIP_BUILD === "1") {
    return;
  }

  for (const project of projects) {
    const result = spawnSync("npx", ["tsc", "-p", project], {
      cwd: repoRoot,
      stdio: "inherit",
      env: process.env
    });

    if (result.status !== 0) {
      process.exit(result.status ?? 1);
    }
  }
}

function contentType(filePath) {
  if (filePath.endsWith(".html")) {
    return "text/html; charset=utf-8";
  }

  if (filePath.endsWith(".js")) {
    return "application/javascript; charset=utf-8";
  }

  if (filePath.endsWith(".css")) {
    return "text/css; charset=utf-8";
  }

  if (filePath.endsWith(".json")) {
    return "application/json; charset=utf-8";
  }

  if (filePath.endsWith(".map")) {
    return "application/json; charset=utf-8";
  }

  return "application/octet-stream";
}

function resolvePath(urlPath) {
  if (urlPath === "/" || urlPath === "/index.html") {
    return path.join(__dirname, "index.html");
  }

  if (urlPath === "/app.js") {
    return path.join(__dirname, "app.js");
  }

  if (urlPath === "/styles.css") {
    return path.join(__dirname, "styles.css");
  }

  if (urlPath.startsWith("/mobile/")) {
    return path.join(repoRoot, "apps/mobile/dist", urlPath.replace("/mobile/", ""));
  }

  if (urlPath.startsWith("/staff/")) {
    return path.join(repoRoot, "apps/staff-scanner/dist", urlPath.replace("/staff/", ""));
  }

  if (urlPath.startsWith("/organizer/")) {
    return path.join(repoRoot, "apps/organizer-portal/dist", urlPath.replace("/organizer/", ""));
  }

  return null;
}

buildApps();

const server = createServer(async (req, res) => {
  const requestUrl = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const target = resolvePath(requestUrl.pathname);

  if (!target) {
    res.statusCode = 404;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ success: false, error: "Not found" }));
    return;
  }

  try {
    const file = await readFile(target);
    res.statusCode = 200;
    res.setHeader("content-type", contentType(target));
    res.end(file);
  } catch {
    res.statusCode = 404;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ success: false, error: "File not found" }));
  }
});

server.listen(port, host, () => {
  console.log(`[ui-simulator] running at http://${host}:${port}`);
});
