import assert from "node:assert/strict";
import test from "node:test";

import { buildOnboardingViewModel } from "./view-model.ts";
import {
  createInitialOnboardingState,
  reduceOnboardingState,
  shouldResumeFromStorage,
  toPersistedSessionSnapshot
} from "./machine.ts";

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
    },
    error: null
  } as const;

  const session = toPersistedSessionSnapshot(ready);
  assert.equal(session?.userId, "usr_901234567");
  assert.equal(session?.walletAddress, "0x000000000000000000000000000000000000dead");
  assert.equal(session?.privateKey, "0xabc123");
});

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
    view.timeline.some((item) => item.label === "Chờ xác nhận từ blockchain"),
    true
  );
  assert.equal(view.availableHelp.includes("why-initial-gas"), true);
  assert.equal(view.availableErrors.includes("prefund-retry"), true);
});

test("onboarding view model uses Vietnamese labels for visible copy", () => {
  const otpView = buildOnboardingViewModel({
    stage: "otp_requested",
    phone: "+84901234567",
    requestId: "req_dev_001",
    error: null
  });

  assert.equal(otpView.eyebrow, "Xác minh");
  assert.deepEqual(
    otpView.timeline.map((item) => item.label),
    ["Đã nhập số điện thoại", "Đã gửi yêu cầu OTP", "Đang xác nhận quyền sở hữu số điện thoại"]
  );

  const readyView = buildOnboardingViewModel({
    stage: "ready",
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
    },
    error: null
  });

  assert.equal(readyView.eyebrow, "Sẵn sàng");
  assert.deepEqual(readyView.trustBadges, [
    "Phiên đăng nhập hoạt động",
    "Ví đã được cấp gas",
    "Sẵn sàng khám phá"
  ]);
});

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
    },
    error: null
  });

  assert.equal(resumed.stage, "ready");
});
