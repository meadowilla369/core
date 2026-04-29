import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const webSrcDir = resolve(testDir, "../..");
const webAppDir = resolve(webSrcDir, "..");

const readSrc = (path) => readFileSync(resolve(webSrcDir, path), "utf8");
const readApp = (path) => readFileSync(resolve(webAppDir, path), "utf8");

test("capacitor shell asks iOS to expose safe-area viewport insets", () => {
  const html = readApp("index.html");
  const capacitorConfig = readApp("capacitor.config.ts");
  const packageJson = JSON.parse(readApp("package.json"));
  const iosInfoPlist = readApp("ios/App/App/Info.plist");

  assert.match(html, /<meta\s+name="viewport"\s+content="[^"]*viewport-fit=cover[^"]*"/);
  assert.match(capacitorConfig, /ios:\s*{[^}]*contentInset:\s*"never"/s);
  assert.match(capacitorConfig, /StatusBar:\s*{[^}]*style:\s*"DARK"/s);
  assert.match(capacitorConfig, /StatusBar:\s*{[^}]*overlaysWebView:\s*true/s);
  assert.equal(Boolean(packageJson.dependencies?.["@capacitor/status-bar"]), true);
  assert.match(iosInfoPlist, /<key>UIViewControllerBasedStatusBarAppearance<\/key>\s*<true\/>/);
});

test("native app applies dark status bar text at runtime", () => {
  const main = readSrc("main.tsx");
  const nativeStatusBar = readSrc("lib/nativeStatusBar.ts");

  assert.match(main, /configureNativeStatusBar/);
  assert.match(main, /void\s+configureNativeStatusBar\(\)/);
  assert.match(nativeStatusBar, /Capacitor\.isNativePlatform\(\)/);
  assert.match(nativeStatusBar, /StatusBar\.setOverlaysWebView\(\{\s*overlay:\s*true\s*\}\)/);
  assert.match(nativeStatusBar, /StatusBar\.setStyle\(\{\s*style:\s*Style\.Dark\s*\}\)/);
});

test("mobile shell exposes safe-area tokens and utilities", () => {
  const css = readSrc("index.css");

  assert.match(css, /--safe-area-top:\s*env\(safe-area-inset-top,\s*0px\)/);
  assert.match(css, /--safe-area-top-padding:\s*calc\(var\(--safe-area-top\)\s*\*\s*0\.75\)/);
  assert.match(css, /--safe-area-right:\s*env\(safe-area-inset-right,\s*0px\)/);
  assert.match(css, /--safe-area-bottom:\s*env\(safe-area-inset-bottom,\s*0px\)/);
  assert.match(css, /--safe-area-bottom-padding:\s*calc\(var\(--safe-area-bottom\)\s*\/\s*2\)/);
  assert.match(css, /--safe-area-left:\s*env\(safe-area-inset-left,\s*0px\)/);
  assert.match(css, /\.safe-area-top\s*{[^}]*padding-top:\s*var\(--safe-area-top-padding\)/s);
  assert.match(css, /\.safe-area-top::before\s*{[^}]*position:\s*fixed/s);
  assert.match(css, /\.safe-area-top::before\s*{[^}]*height:\s*var\(--safe-area-top-padding\)/s);
  assert.match(
    css,
    /\.safe-area-top::before\s*{[^}]*background-color:\s*hsl\(var\(--background\)\s*\/\s*0\.98\)/s
  );
  assert.match(css, /\.safe-area-top::before\s*{[^}]*z-index:\s*39/s);
  assert.match(css, /\.safe-area-sticky-top\s*{[^}]*top:\s*var\(--safe-area-top-padding\)/s);
  assert.match(
    css,
    /\.safe-area-sticky-top\s*{[^}]*background-color:\s*hsl\(var\(--background\)\s*\/\s*0\.98\)/s
  );
  assert.match(
    css,
    /\.safe-area-sticky-top\s*{[^}]*-webkit-backdrop-filter:\s*blur\(18px\)\s+saturate\(1\.08\)/s
  );
  assert.match(
    css,
    /\.safe-area-sticky-top\s*{[^}]*backdrop-filter:\s*blur\(18px\)\s+saturate\(1\.08\)/s
  );
  assert.match(
    css,
    /\.safe-area-bottom\s*{[^}]*padding-bottom:\s*var\(--safe-area-bottom-padding\)/s
  );
  assert.match(css, /\.safe-area-x\s*{[^}]*padding-left:\s*var\(--safe-area-left\)/s);
});

test("mobile layout and fixed navigation reserve status and home indicator space", () => {
  const layout = readSrc("components/mobile/MobileLayout.tsx");
  const bottomNav = readSrc("components/mobile/BottomNav.tsx");
  const onboardingShell = readSrc("components/onboarding/OnboardingShell.tsx");
  const drawer = readSrc("components/ui/drawer.tsx");
  const sheet = readSrc("components/ui/sheet.tsx");
  const toast = readSrc("components/ui/toast.tsx");

  assert.match(layout, /safe-area-x/);
  assert.match(layout, /safe-area-top/);
  assert.match(layout, /var\(--mobile-bottom-nav-height\)/);
  assert.match(layout, /var\(--safe-area-bottom-padding\)/);
  assert.match(bottomNav, /safe-area-bottom/);
  assert.match(bottomNav, /var\(--mobile-bottom-nav-height\)/);
  assert.match(onboardingShell, /safe-area-y/);
  assert.match(drawer, /safe-area-bottom/);
  assert.match(sheet, /var\(--safe-area-top-padding\)/);
  assert.match(sheet, /var\(--safe-area-bottom-padding\)/);
  assert.match(toast, /var\(--safe-area-top-padding\)/);
  assert.match(toast, /var\(--safe-area-bottom-padding\)/);
});
