# Flow 0 Registration + Wallet Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a real `apps/web` onboarding route that takes a real phone number through dev OTP verification, local wallet generation, backend wallet bootstrap, and one-time localchain prefund, while `entr-landing` hands users into that flow without becoming an auth surface.

**Architecture:** First align the shared API client with the actual `auth-service` and `payment-orchestrator` contracts so the web app stops guessing request and response shapes. Then add a persisted onboarding domain layer in `apps/web` that survives refresh, drives the UI state machine, and feeds a dedicated `/onboarding` route with modal-rich status screens. Keep `entr-landing` acquisition-only by limiting it to CTA and copy handoff into the web onboarding route.

**Tech Stack:** React 18, TypeScript, Vite, TanStack Query, shadcn/ui, input-otp, viem, Node built-in test runner, local integration suite

---

## File Map

- `packages/sdk-client/src/index.ts`
  - Align OTP request and verify types with the actual backend contract.
  - Add wallet prefund status lookup for polling.
- `packages/sdk-client/src/auth-wallet-client.test.mjs`
  - Mock `fetch` to lock the shared client contract before web code consumes it.
- `packages/sdk-client/package.json`
  - Add a targeted client contract test script.

- `apps/web/package.json`
  - Add `viem` for local wallet generation and a focused onboarding test script.
- `apps/web/src/lib/config.ts`
  - Add explicit onboarding-related runtime config defaults if needed.
- `apps/web/src/lib/session.ts`
  - Replace pure demo getters with persisted session reads plus demo fallback.
- `apps/web/src/App.tsx`
  - Register the `/onboarding` route.

- `apps/web/src/features/onboarding/types.ts`
  - Shared types for persisted draft, auth session, wallet draft, and UI stages.
- `apps/web/src/features/onboarding/storage.ts`
  - Local storage helpers for saving, loading, and clearing onboarding state.
- `apps/web/src/features/onboarding/wallet.ts`
  - Local EOA generation and hydration helpers built on `viem/accounts`.
- `apps/web/src/features/onboarding/machine.ts`
  - Pure transition helpers for stage progression, resume rules, and error mapping.
- `apps/web/src/features/onboarding/view-model.ts`
  - Screen and timeline derivation so UI stays declarative and testable.
- `apps/web/src/features/onboarding/onboarding-machine.test.ts`
  - Pure tests for state transitions, resume behavior, and modal availability.
- `apps/web/src/features/onboarding/useOnboardingController.ts`
  - React Query powered orchestrator for OTP request, verify, wallet register, and prefund polling.

- `apps/web/src/components/onboarding/OnboardingShell.tsx`
  - Shared layout, step header, progress rail, and action footer.
- `apps/web/src/components/onboarding/PhoneEntryScreen.tsx`
  - Phone input and `WhyPhoneModal` trigger.
- `apps/web/src/components/onboarding/OtpVerifyScreen.tsx`
  - OTP input, countdown, resend, and `OtpHelpModal` trigger.
- `apps/web/src/components/onboarding/WalletBootstrapScreen.tsx`
  - Wallet creation and registration timeline with `WhatIsThisWalletModal`.
- `apps/web/src/components/onboarding/PrefundPendingScreen.tsx`
  - Trust-heavy prefund status screen with retry affordances and `WhyInitialGasModal`.
- `apps/web/src/components/onboarding/ReadyScreen.tsx`
  - Wallet-ready confirmation with CTA into the app.
- `apps/web/src/components/onboarding/WhyPhoneModal.tsx`
- `apps/web/src/components/onboarding/OtpHelpModal.tsx`
- `apps/web/src/components/onboarding/WhatIsThisWalletModal.tsx`
- `apps/web/src/components/onboarding/WhyInitialGasModal.tsx`
- `apps/web/src/components/onboarding/OtpExpiredModal.tsx`
- `apps/web/src/components/onboarding/RateLimitModal.tsx`
- `apps/web/src/components/onboarding/BootstrapFailedModal.tsx`
- `apps/web/src/components/onboarding/PrefundRetrySheet.tsx`
- `apps/web/src/components/onboarding/WalletReadySheet.tsx`
  - Dedicated modal and sheet surfaces required by the spec.
- `apps/web/src/pages/OnboardingPage.tsx`
  - Dedicated route that binds the controller, screens, and modal registry.

- `packages/integration-suite/tests/integration/flow0-registration-wallet-bootstrap.test.mjs`
  - Real API-level happy path plus idempotent retry coverage for Flow 0.
- `packages/integration-suite/package.json`
  - Add a dedicated `test:flow0` script.

- `/Users/nguyentruong/Documents/entr-landing/src/components/landing/LandingPage.tsx`
  - Update CTA hierarchy and Flow 0 copy without moving business logic into landing.
- `/Users/nguyentruong/Documents/entr-landing/README.md`
  - Document the handoff URL env knob if one is introduced.

### Task 1: Align shared auth and wallet client contracts

**Files:**

- Create: `packages/sdk-client/src/auth-wallet-client.test.mjs`
- Modify: `packages/sdk-client/src/index.ts`
- Modify: `packages/sdk-client/package.json`

- [ ] **Step 1: Write the failing test**

```js
import assert from "node:assert/strict";
import test from "node:test";

import { ApiClient } from "./index.ts";

test("requestOtp sends backend-compatible phone payload and returns request metadata", async () => {
  const calls = [];
  globalThis.fetch = async (input, init) => {
    calls.push({ input: String(input), init });
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          requestId: "req_dev_001",
          expiresIn: 300,
          retryAfter: 60,
          otpCode: "123456"
        }
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  };

  const client = new ApiClient({ baseUrl: "http://localhost:3000" });
  const result = await client.requestOtp({ phone: "+84901234567" });

  assert.equal(JSON.parse(calls[0].init.body).phone, "+84901234567");
  assert.equal(result.data.requestId, "req_dev_001");
  assert.equal(result.data.otpCode, "123456");
});

test("verifyOtp sends requestId and otp fields expected by auth-service", async () => {
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        success: true,
        data: {
          userId: "usr_901234567",
          sessionId: "ses_dev_001",
          accessToken: "atk_001",
          accessTokenExpiresAt: "2026-04-21T10:00:00.000Z",
          refreshToken: "rtk_001",
          refreshTokenExpiresAt: "2026-05-21T10:00:00.000Z"
        }
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );

  const client = new ApiClient({ baseUrl: "http://localhost:3000" });
  const result = await client.verifyOtp({
    phone: "+84901234567",
    requestId: "req_dev_001",
    otp: "123456",
    deviceId: "web-chrome",
    platform: "web"
  });

  assert.equal(result.data.sessionId, "ses_dev_001");
  assert.equal(result.data.refreshToken, "rtk_001");
});

test("getWalletPrefundStatus reads the prefund polling payload", async () => {
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        success: true,
        data: {
          walletAddress: "0x000000000000000000000000000000000000dead",
          funded: true,
          txHash: "0xabc",
          amountWei: "1000000000000000",
          fundedAt: "2026-04-21T10:00:00.000Z"
        }
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );

  const client = new ApiClient({ baseUrl: "http://localhost:3000" });
  const result = await client.getWalletPrefundStatus("0x000000000000000000000000000000000000dead");

  assert.equal(result.data.funded, true);
  assert.equal(result.data.txHash, "0xabc");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/sdk-client && node --test --experimental-strip-types src/auth-wallet-client.test.mjs`
Expected: FAIL because `requestOtp` and `verifyOtp` still use `phoneNumber` and `otpCode`, and `getWalletPrefundStatus` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Update `packages/sdk-client/src/index.ts` to align with the backend:

```ts
export interface OtpRequestInput {
  phone: string;
}

export interface OtpRequestData {
  requestId: string;
  expiresIn: number;
  retryAfter: number;
  otpCode?: string;
}

export interface OtpVerifyInput {
  phone: string;
  requestId: string;
  otp: string;
  deviceId?: string;
  deviceName?: string;
  platform?: string;
}

export interface AuthTokenData {
  accessToken: string;
  refreshToken: string;
  userId: string;
  sessionId: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
}

export interface WalletPrefundStatusData {
  walletAddress: string;
  funded: boolean;
  txHash: string | null;
  amountWei: string | null;
  fundedAt: string | null;
}

async requestOtp(input: OtpRequestInput): Promise<ApiSuccessResponse<OtpRequestData>> {
  return this.request("/v1/auth/otp/request", { method: "POST", body: input });
}

async verifyOtp(input: OtpVerifyInput): Promise<ApiSuccessResponse<AuthTokenData>> {
  return this.request("/v1/auth/otp/verify", { method: "POST", body: input });
}

async getWalletPrefundStatus(
  walletAddress: string
): Promise<ApiSuccessResponse<WalletPrefundStatusData>> {
  return this.request(`/v1/wallet/prefund/${walletAddress}`, { method: "GET" });
}
```

Add a package script:

```json
"test:auth-wallet": "node --test --experimental-strip-types src/auth-wallet-client.test.mjs"
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/sdk-client && pnpm test:auth-wallet`
Expected: PASS with all three client contract tests green.

- [ ] **Step 5: Commit**

```bash
git add packages/sdk-client/package.json packages/sdk-client/src/index.ts packages/sdk-client/src/auth-wallet-client.test.mjs
git commit -m "feat(sdk-client): align auth and wallet bootstrap contracts"
```

### Task 2: Add persisted onboarding domain and wallet helpers in `apps/web`

**Files:**

- Create: `apps/web/src/features/onboarding/types.ts`
- Create: `apps/web/src/features/onboarding/storage.ts`
- Create: `apps/web/src/features/onboarding/wallet.ts`
- Create: `apps/web/src/features/onboarding/machine.ts`
- Create: `apps/web/src/features/onboarding/onboarding-machine.test.ts`
- Modify: `apps/web/package.json`

- [ ] **Step 1: Write the failing test**

```ts
import test from "node:test";
import assert from "node:assert/strict";

import {
  createInitialOnboardingState,
  reduceOnboardingState,
  shouldResumeFromStorage,
  toPersistedSessionSnapshot
} from "./machine";

test("OTP verification snapshot is resumable without restarting phone entry", () => {
  const afterVerify = reduceOnboardingState(createInitialOnboardingState(), {
    type: "OTP_VERIFIED",
    payload: {
      phone: "+84901234567",
      requestId: "req_dev_001",
      userId: "usr_901234567",
      sessionId: "ses_dev_001",
      accessToken: "atk_001",
      refreshToken: "rtk_001",
      accessTokenExpiresAt: "2026-04-21T10:00:00.000Z",
      refreshTokenExpiresAt: "2026-05-21T10:00:00.000Z"
    }
  });

  assert.equal(afterVerify.stage, "otp_verified");
  assert.equal(shouldResumeFromStorage(afterVerify).stage, "otp_verified");
});

test("ready snapshot exposes userId and walletAddress for the rest of the app", () => {
  const ready = {
    stage: "ready",
    phone: "+84901234567",
    auth: {
      userId: "usr_901234567",
      sessionId: "ses_dev_001",
      accessToken: "atk_001",
      refreshToken: "rtk_001",
      accessTokenExpiresAt: "2026-04-21T10:00:00.000Z",
      refreshTokenExpiresAt: "2026-05-21T10:00:00.000Z"
    },
    wallet: {
      walletAddress: "0x000000000000000000000000000000000000dead",
      privateKey: "0xabc123"
    },
    prefund: {
      funded: true,
      txHash: "0xprefund"
    }
  };

  const session = toPersistedSessionSnapshot(ready);
  assert.equal(session.userId, "usr_901234567");
  assert.equal(session.walletAddress, "0x000000000000000000000000000000000000dead");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && node --test --experimental-strip-types src/features/onboarding/onboarding-machine.test.ts`
Expected: FAIL because the onboarding feature folder and reducer helpers do not exist yet.

- [ ] **Step 3: Write minimal implementation**

Create small focused helpers:

```ts
export type OnboardingStage =
  | "phone_entry"
  | "otp_requested"
  | "otp_verifying"
  | "otp_verified"
  | "wallet_generating"
  | "wallet_registering"
  | "prefund_pending"
  | "prefund_confirmed"
  | "ready";

export function createInitialOnboardingState(): OnboardingState {
  return {
    stage: "phone_entry",
    phone: "",
    requestId: null,
    auth: null,
    wallet: null,
    prefund: null,
    error: null
  };
}

export function toPersistedSessionSnapshot(state: OnboardingState) {
  if (!state.auth || !state.wallet) {
    return null;
  }

  return {
    userId: state.auth.userId,
    walletAddress: state.wallet.walletAddress,
    phone: state.phone,
    accessToken: state.auth.accessToken,
    refreshToken: state.auth.refreshToken
  };
}
```

Add `viem` and a focused test script to `apps/web/package.json`:

```json
"dependencies": {
  "viem": "^2.21.0"
},
"scripts": {
  "test:onboarding": "node --test --experimental-strip-types src/features/onboarding/onboarding-machine.test.ts"
}
```

Implement `wallet.ts` with a single responsibility:

```ts
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

export function createLocalWallet() {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  return {
    privateKey,
    walletAddress: account.address
  };
}
```

Add `storage.ts` helpers for `localStorage` keys:

- onboarding draft
- persisted session snapshot
- clear functions after hard failure or sign out

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && pnpm test:onboarding`
Expected: PASS with state transition and session snapshot coverage green.

- [ ] **Step 5: Commit**

```bash
git add apps/web/package.json apps/web/src/features/onboarding/types.ts apps/web/src/features/onboarding/storage.ts apps/web/src/features/onboarding/wallet.ts apps/web/src/features/onboarding/machine.ts apps/web/src/features/onboarding/onboarding-machine.test.ts
git commit -m "feat(web): add onboarding domain state and wallet helpers"
```

### Task 3: Derive onboarding screen view models and required modal states

**Files:**

- Create: `apps/web/src/features/onboarding/view-model.ts`
- Modify: `apps/web/src/features/onboarding/onboarding-machine.test.ts`
- Create: `apps/web/src/components/onboarding/OnboardingShell.tsx`
- Create: `apps/web/src/components/onboarding/PhoneEntryScreen.tsx`
- Create: `apps/web/src/components/onboarding/OtpVerifyScreen.tsx`
- Create: `apps/web/src/components/onboarding/WalletBootstrapScreen.tsx`
- Create: `apps/web/src/components/onboarding/PrefundPendingScreen.tsx`
- Create: `apps/web/src/components/onboarding/ReadyScreen.tsx`
- Create: `apps/web/src/components/onboarding/WhyPhoneModal.tsx`
- Create: `apps/web/src/components/onboarding/OtpHelpModal.tsx`
- Create: `apps/web/src/components/onboarding/WhatIsThisWalletModal.tsx`
- Create: `apps/web/src/components/onboarding/WhyInitialGasModal.tsx`
- Create: `apps/web/src/components/onboarding/OtpExpiredModal.tsx`
- Create: `apps/web/src/components/onboarding/RateLimitModal.tsx`
- Create: `apps/web/src/components/onboarding/BootstrapFailedModal.tsx`
- Create: `apps/web/src/components/onboarding/PrefundRetrySheet.tsx`
- Create: `apps/web/src/components/onboarding/WalletReadySheet.tsx`

- [ ] **Step 1: Write the failing test**

Extend `apps/web/src/features/onboarding/onboarding-machine.test.ts` with view-model expectations:

```ts
import { buildOnboardingViewModel } from "./view-model";

test("prefund pending exposes trust timeline and retry-capable surfaces", () => {
  const view = buildOnboardingViewModel({
    stage: "prefund_pending",
    phone: "+84901234567",
    requestId: "req_dev_001",
    auth: {
      userId: "usr_901234567",
      sessionId: "ses_dev_001",
      accessToken: "atk_001",
      refreshToken: "rtk_001",
      accessTokenExpiresAt: "2026-04-21T10:00:00.000Z",
      refreshTokenExpiresAt: "2026-05-21T10:00:00.000Z"
    },
    wallet: {
      walletAddress: "0x000000000000000000000000000000000000dead",
      privateKey: "0xabc123"
    },
    prefund: {
      funded: false,
      txHash: null
    },
    error: {
      code: "PREFUND_DELAYED",
      message: "Waiting for localchain confirmation"
    }
  });

  assert.equal(view.screen, "prefund_pending");
  assert.equal(
    view.timeline.some((item) => item.label === "Waiting blockchain confirmation"),
    true
  );
  assert.equal(view.availableHelp.includes("why-initial-gas"), true);
  assert.equal(view.availableErrors.includes("prefund-retry"), true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm test:onboarding`
Expected: FAIL because `view-model.ts` and the prefund timeline mapping do not exist yet.

- [ ] **Step 3: Write minimal implementation**

Create a pure screen derivation layer first:

```ts
export function buildOnboardingViewModel(state: OnboardingState) {
  switch (state.stage) {
    case "phone_entry":
      return {
        screen: "phone_entry",
        title: "Đăng nhập bằng số điện thoại",
        availableHelp: ["why-phone"],
        availableErrors: [],
        timeline: []
      };
    case "prefund_pending":
      return {
        screen: "prefund_pending",
        title: "Đang cấp gas khởi tạo",
        availableHelp: ["why-initial-gas"],
        availableErrors: state.error ? ["prefund-retry"] : [],
        timeline: [
          { label: "Wallet registered", status: "done" },
          {
            label: "Prefund transaction submitted",
            status: state.prefund?.txHash ? "done" : "current"
          },
          { label: "Waiting blockchain confirmation", status: "current" }
        ]
      };
    default:
      return {
        screen: state.stage,
        title: "Flow 0",
        availableHelp: [],
        availableErrors: [],
        timeline: []
      };
  }
}
```

Then create the UI surfaces against that contract:

- `OnboardingShell.tsx`
  - dark-surface wrapper
  - step title
  - timeline rail
  - footer CTA area
- `PhoneEntryScreen.tsx`
  - phone field
  - `Nhận mã OTP`
  - `WhyPhoneModal`
- `OtpVerifyScreen.tsx`
  - `input-otp`
  - resend timer
  - dev OTP helper disclosure
- `WalletBootstrapScreen.tsx`
  - reassure users the wallet is generated for them
  - show `wallet_generating` and `wallet_registering`
- `PrefundPendingScreen.tsx`
  - trust-heavy timeline
  - tx hash placeholder when available
  - delayed and retry affordances
- `ReadyScreen.tsx`
  - shortened wallet
  - tx hash
  - CTA into `/discover`

Keep modal and sheet surfaces focused:

- `WhyPhoneModal`
- `OtpHelpModal`
- `WhatIsThisWalletModal`
- `WhyInitialGasModal`
- `OtpExpiredModal`
- `RateLimitModal`
- `BootstrapFailedModal`
- `PrefundRetrySheet`
- `WalletReadySheet`

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && pnpm test:onboarding`
Expected: PASS with the new view-model assertions green.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/onboarding/view-model.ts apps/web/src/features/onboarding/onboarding-machine.test.ts apps/web/src/components/onboarding/OnboardingShell.tsx apps/web/src/components/onboarding/PhoneEntryScreen.tsx apps/web/src/components/onboarding/OtpVerifyScreen.tsx apps/web/src/components/onboarding/WalletBootstrapScreen.tsx apps/web/src/components/onboarding/PrefundPendingScreen.tsx apps/web/src/components/onboarding/ReadyScreen.tsx apps/web/src/components/onboarding/WhyPhoneModal.tsx apps/web/src/components/onboarding/OtpHelpModal.tsx apps/web/src/components/onboarding/WhatIsThisWalletModal.tsx apps/web/src/components/onboarding/WhyInitialGasModal.tsx apps/web/src/components/onboarding/OtpExpiredModal.tsx apps/web/src/components/onboarding/RateLimitModal.tsx apps/web/src/components/onboarding/BootstrapFailedModal.tsx apps/web/src/components/onboarding/PrefundRetrySheet.tsx apps/web/src/components/onboarding/WalletReadySheet.tsx
git commit -m "feat(web): add onboarding screens and support surfaces"
```

### Task 4: Wire the `/onboarding` route, controller, and persisted session handoff

**Files:**

- Create: `apps/web/src/features/onboarding/useOnboardingController.ts`
- Create: `apps/web/src/pages/OnboardingPage.tsx`
- Modify: `apps/web/src/lib/session.ts`
- Modify: `apps/web/src/lib/config.ts`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/features/onboarding/onboarding-machine.test.ts`

- [ ] **Step 1: Write the failing test**

Extend `apps/web/src/features/onboarding/onboarding-machine.test.ts` with resume and ready-state assertions:

```ts
import { shouldResumeFromStorage } from "./machine";

test("prefunded wallet snapshot resumes directly into ready", () => {
  const resumed = shouldResumeFromStorage({
    stage: "prefund_pending",
    phone: "+84901234567",
    requestId: "req_dev_001",
    auth: {
      userId: "usr_901234567",
      sessionId: "ses_dev_001",
      accessToken: "atk_001",
      refreshToken: "rtk_001",
      accessTokenExpiresAt: "2026-04-21T10:00:00.000Z",
      refreshTokenExpiresAt: "2026-05-21T10:00:00.000Z"
    },
    wallet: {
      walletAddress: "0x000000000000000000000000000000000000dead",
      privateKey: "0xabc123"
    },
    prefund: {
      funded: true,
      txHash: "0xprefund"
    }
  });

  assert.equal(resumed.stage, "ready");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm test:onboarding`
Expected: FAIL until resume logic upgrades funded prefund snapshots into `ready`.

- [ ] **Step 3: Write minimal implementation**

Build the controller around the aligned `ApiClient`:

```ts
export function useOnboardingController() {
  const client = useApiClient();
  const [state, setState] = useState(() => hydrateOnboardingState());

  const requestOtp = useMutation({
    mutationFn: async (phone: string) => client.requestOtp({ phone }),
    onSuccess: (result, phone) => {
      setState((current) =>
        reduceOnboardingState(current, {
          type: "OTP_REQUESTED",
          payload: {
            phone,
            requestId: result.data.requestId,
            otpCode: result.data.otpCode ?? null,
            expiresIn: result.data.expiresIn,
            retryAfter: result.data.retryAfter
          }
        })
      );
    }
  });
```

Continue the controller with:

- `verifyOtp`
  - send `phone`, `requestId`, `otp`, `deviceId`, `deviceName`, `platform`
- local wallet generation after OTP verify
- `registerPaymentWallet` with `x-user-id`
- `getWalletPrefundStatus` polling until `funded === true`
- retry handler that resumes from wallet or prefund stages instead of restarting phone entry

Wire the route:

```tsx
<Route path="/onboarding" element={<OnboardingPage />} />
```

Replace demo-only getters in `apps/web/src/lib/session.ts`:

```ts
import { loadPersistedSessionSnapshot } from "@/features/onboarding/storage";
import { webAppConfig } from "./config";

export function getSessionUserId(): string {
  return loadPersistedSessionSnapshot()?.userId ?? webAppConfig.demoUserId;
}

export function getSessionWalletAddress(): string {
  return loadPersistedSessionSnapshot()?.walletAddress ?? webAppConfig.demoWalletAddress;
}
```

Keep demo fallback intact so existing flows still work before onboarding is completed.

- [ ] **Step 4: Run test and app verification to verify it passes**

Run: `cd apps/web && pnpm test:onboarding`
Expected: PASS.

Run: `cd apps/web && pnpm typecheck`
Expected: PASS.

Run: `cd apps/web && pnpm build`
Expected: PASS with `/onboarding` included in the build.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/onboarding/useOnboardingController.ts apps/web/src/pages/OnboardingPage.tsx apps/web/src/lib/session.ts apps/web/src/lib/config.ts apps/web/src/App.tsx apps/web/src/features/onboarding/onboarding-machine.test.ts
git commit -m "feat(web): wire onboarding route and session handoff"
```

### Task 5: Add backend-level Flow 0 integration coverage

**Files:**

- Create: `packages/integration-suite/tests/integration/flow0-registration-wallet-bootstrap.test.mjs`
- Modify: `packages/integration-suite/package.json`

- [ ] **Step 1: Write the failing test**

```js
import assert from "node:assert/strict";
import test from "node:test";

import { disposeServer, invokeJson } from "../utils/server-harness.mjs";

test("flow0: phone verify + wallet bootstrap + one-time prefund", async () => {
  const { createAuthServer } = await importFromRepo("services/auth-service/dist/server.js");
  const { createPaymentOrchestratorServer } = await importFromRepo(
    "services/payment-orchestrator/dist/server.js"
  );

  const authServer = createAuthServer({
    serviceName: "auth-service",
    host: "127.0.0.1",
    port: 3001,
    otpLength: 6,
    otpTtlSec: 300,
    otpMaxRequestsPerWindow: 5,
    otpRateWindowSec: 900,
    accessTokenTtlSec: 900,
    refreshTokenTtlSec: 2_592_000,
    exposeOtpInResponse: true
  });

  const paymentServer = createPaymentOrchestratorServer({
    serviceName: "payment-orchestrator",
    host: "127.0.0.1",
    port: 3006,
    allowedGateways: ["momo", "vnpay"],
    momoWebhookSecret: "momo_dev_secret",
    vnpayWebhookSecret: "vnpay_dev_secret",
    webhookMaxSkewSec: 300,
    webhookNonceTtlSec: 1800,
    maxWebhookRetries: 5,
    retryBaseDelaySec: 1,
    prefundAmountWei: "1000000000000000",
    backendSignerPrivateKey: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
    ticketLedgerChainId: 84532,
    ticketLedgerAddress: "0x1000000000000000000000000000000000000001"
  });

  try {
    const phone = "+84901234567";
    const otp = await invokeJson(authServer, {
      method: "POST",
      path: "/auth/otp/request",
      body: { phone }
    });
    const verified = await invokeJson(authServer, {
      method: "POST",
      path: "/auth/otp/verify",
      body: {
        phone,
        requestId: otp.payload.data.requestId,
        otp: otp.payload.data.otpCode,
        deviceId: "web-chrome",
        platform: "web"
      }
    });
    const first = await invokeJson(paymentServer, {
      method: "POST",
      path: "/api/wallet/register",
      headers: {
        "x-user-id": verified.payload.data.userId
      },
      body: {
        walletAddress: "0x000000000000000000000000000000000000dead"
      }
    });
    const second = await invokeJson(paymentServer, {
      method: "POST",
      path: "/api/wallet/register",
      headers: {
        "x-user-id": verified.payload.data.userId
      },
      body: {
        walletAddress: "0x000000000000000000000000000000000000dead"
      }
    });
    const prefund = await invokeJson(paymentServer, {
      method: "GET",
      path: "/api/wallet/prefund/0x000000000000000000000000000000000000dead"
    });

    assert.equal(first.payload.success, true);
    assert.equal(second.payload.data.prefundTxHash, first.payload.data.prefundTxHash);
    assert.equal(prefund.payload.data.funded, true);
  } finally {
    disposeServer(paymentServer);
    disposeServer(authServer);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/integration-suite && npm run build:services && node --test --test-concurrency=1 tests/integration/flow0-registration-wallet-bootstrap.test.mjs`
Expected: FAIL until the new test file exists and the service build is current.

- [ ] **Step 3: Write minimal implementation**

Add the focused Flow 0 integration file and package script:

```json
"test:flow0": "npm run build:services && node --test --test-concurrency=1 tests/integration/flow0-registration-wallet-bootstrap.test.mjs"
```

Keep the assertions narrow and useful:

- OTP request returns `requestId` and `otpCode` in dev
- OTP verify returns `userId` and `sessionId`
- first wallet register returns `prefunded: true`
- second wallet register returns the same `prefundTxHash`
- prefund polling endpoint returns `funded: true`

This test becomes the direct API/script validation path required by the spec.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/integration-suite && npm run test:flow0`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/integration-suite/package.json packages/integration-suite/tests/integration/flow0-registration-wallet-bootstrap.test.mjs
git commit -m "test(integration): cover flow0 registration and wallet bootstrap"
```

### Task 6: Update `entr-landing` handoff and document the demo entry point

**Files:**

- Modify: `/Users/nguyentruong/Documents/entr-landing/src/components/landing/LandingPage.tsx`
- Modify: `/Users/nguyentruong/Documents/entr-landing/README.md`

- [ ] **Step 1: Write the failing smoke expectation**

Use the landing build as the guardrail for the copy and CTA changes:

Run: `cd /Users/nguyentruong/Documents/entr-landing && npm run build`
Expected: PASS before the edit. The step fails later if the new CTA wiring or env usage breaks the build.

- [ ] **Step 2: Make the minimal handoff changes**

Update the CTA hierarchy inside `LandingPage.tsx`:

```tsx
const webDemoHref =
  import.meta.env.VITE_WEB_ONBOARDING_URL ?? "http://localhost:8080/onboarding";

<a
  href="#waitlist"
  className="font-mono text-[11px] tracking-widest opacity-50 hover:opacity-100 transition-opacity flex items-center gap-2"
>
  TẢI APP <ArrowUpRight className="w-3 h-3" />
</a>

<a
  href={webDemoHref}
  className="font-mono text-[11px] tracking-widest opacity-50 hover:opacity-100 transition-opacity flex items-center gap-2"
>
  TRẢI NGHIỆM WEB DEMO <ArrowUpRight className="w-3 h-3" />
</a>
```

Update the `No Wallet Needed` copy:

```ts
{ num: "04", title: "No Wallet Needed", items: [
  "Phone OTP — đăng nhập bằng số điện thoại",
  "Invisible wallet — ví tự tạo tự động",
  "First gas prefund — sẵn sàng giao dịch đầu tiên"
] }
```

Update the waitlist CTA block so the user sees two exits:

- `Tải app`
- `Mở onboarding demo trên web`

Document the env knob in `entr-landing/README.md`:

```md
## Web demo handoff

Set `VITE_WEB_ONBOARDING_URL` to control the secondary CTA target.

Example:

`VITE_WEB_ONBOARDING_URL=http://localhost:8080/onboarding`
```

- [ ] **Step 3: Run verification to verify it passes**

Run: `cd /Users/nguyentruong/Documents/entr-landing && npm run build`
Expected: PASS.

Run: `cd apps/web && pnpm build`
Expected: PASS so the handoff target remains valid.

- [ ] **Step 4: Commit**

```bash
git add /Users/nguyentruong/Documents/entr-landing/src/components/landing/LandingPage.tsx /Users/nguyentruong/Documents/entr-landing/README.md
git commit -m "feat(landing): hand off to flow0 web onboarding"
```

## Final Verification

- [ ] Run: `cd packages/sdk-client && pnpm test:auth-wallet`
  - Expected: PASS
- [ ] Run: `cd apps/web && pnpm test:onboarding`
  - Expected: PASS
- [ ] Run: `cd apps/web && pnpm typecheck`
  - Expected: PASS
- [ ] Run: `cd apps/web && pnpm build`
  - Expected: PASS
- [ ] Run: `cd packages/integration-suite && npm run test:flow0`
  - Expected: PASS
- [ ] Run: `cd /Users/nguyentruong/Documents/entr-landing && npm run build`
  - Expected: PASS

## Manual QA Checklist

- [ ] Open `http://localhost:8081` and confirm the landing page now exposes `Tải app` and `Trải nghiệm web demo` as distinct actions.
- [ ] Open `http://localhost:8080/onboarding` and complete the happy path:
  - real phone number entry
  - dev OTP request
  - OTP verify
  - wallet generation
  - wallet registration
  - prefund confirmation
  - ready state
- [ ] Refresh during `otp_requested` and confirm the OTP screen resumes without losing `requestId`.
- [ ] Refresh during `prefund_pending` and confirm polling resumes instead of restarting onboarding.
- [ ] Re-run wallet bootstrap for the same user and confirm no second prefund is generated.
- [ ] From the ready screen, use the CTA into `/discover` and confirm the rest of the app reads the persisted session snapshot instead of the demo wallet.
