#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";

const SOURCE_DROP = process.env.UI_IMPORT_SOURCE ?? "tmp/Event Ticketing Marketplace UI";
const OUTPUT_FILE = process.env.UI_IMPORT_MANIFEST_OUTPUT ?? "docs/ui/import-manifest.json";

const P0_PAGE_FILE_NAMES = [
  "Explore.tsx",
  "EventDetail.tsx",
  "Checkout.tsx",
  "TicketDetail.tsx",
  "ResaleCreate.tsx",
  "KYCStepper.tsx",
  "Scan.tsx",
  "ScanResult.tsx",
  "Dashboard.tsx",
  "DisputeQueue.tsx",
  "DisputeDetail.tsx"
];

async function walkFiles(rootDir) {
  const result = [];

  async function walk(currentDir) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        await walk(absolutePath);
        continue;
      }

      result.push(absolutePath);
    }
  }

  await walk(rootDir);
  return result;
}

function toPosixRelative(rootDir, absolutePath) {
  const relative = path.relative(rootDir, absolutePath);
  return relative.split(path.sep).join("/");
}

function roleFromPagePath(relativePath) {
  if (relativePath.includes("/buyer/")) {
    return "buyer";
  }
  if (relativePath.includes("/staff/")) {
    return "staff";
  }
  if (relativePath.includes("/organizer/")) {
    return "organizer";
  }
  if (relativePath.includes("/platform/")) {
    return "platform";
  }
  return "shared";
}

async function main() {
  const sourceRoot = path.resolve(process.cwd(), SOURCE_DROP);
  const outputPath = path.resolve(process.cwd(), OUTPUT_FILE);

  await fs.access(sourceRoot);

  const absoluteFiles = await walkFiles(sourceRoot);
  const files = absoluteFiles.map((filePath) => toPosixRelative(sourceRoot, filePath)).sort();

  const pageFiles = files.filter((filePath) => filePath.startsWith("src/app/pages/") && filePath.endsWith(".tsx"));
  const componentFiles = files.filter(
    (filePath) => filePath.startsWith("src/app/components/") && (filePath.endsWith(".tsx") || filePath.endsWith(".ts"))
  );
  const libFiles = files.filter((filePath) => filePath.startsWith("src/app/lib/") && filePath.endsWith(".ts"));
  const styleFiles = files.filter((filePath) => filePath.startsWith("src/styles/") && filePath.endsWith(".css"));

  const pageByRole = {
    buyer: [],
    staff: [],
    organizer: [],
    platform: [],
    shared: []
  };

  for (const pagePath of pageFiles) {
    pageByRole[roleFromPagePath(pagePath)].push(pagePath);
  }

  const filesUsingMockData = [];
  for (const absolutePath of absoluteFiles) {
    const relativePath = toPosixRelative(sourceRoot, absolutePath);
    if (!relativePath.endsWith(".ts") && !relativePath.endsWith(".tsx")) {
      continue;
    }

    const content = await fs.readFile(absolutePath, "utf8");
    if (content.includes("mockData")) {
      filesUsingMockData.push(relativePath);
    }
  }

  filesUsingMockData.sort();

  const existingP0Pages = pageFiles
    .map((filePath) => filePath.split("/").pop())
    .filter((name) => typeof name === "string");

  const p0Coverage = P0_PAGE_FILE_NAMES.map((fileName) => ({
    fileName,
    exists: existingP0Pages.includes(fileName)
  }));

  const manifest = {
    generatedAt: new Date().toISOString(),
    sourceDrop: SOURCE_DROP,
    sourceRoot,
    outputFile: OUTPUT_FILE,
    summary: {
      totalFiles: files.length,
      pageFiles: pageFiles.length,
      componentFiles: componentFiles.length,
      libFiles: libFiles.length,
      styleFiles: styleFiles.length,
      filesUsingMockData: filesUsingMockData.length
    },
    pages: pageByRole,
    libs: libFiles,
    styles: styleFiles,
    mockDataConsumers: filesUsingMockData,
    p0Coverage
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");

  process.stdout.write(`Generated ${OUTPUT_FILE}\n`);
}

main().catch((error) => {
  process.stderr.write(`Failed to generate import manifest: ${error.message}\n`);
  process.exitCode = 1;
});
