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

  assert.equal(calls.length, 1);
  assert.equal(JSON.parse(calls[0].init.body).phone, "+84901234567");
  assert.equal(result.data.requestId, "req_dev_001");
  assert.equal(result.data.expiresIn, 300);
  assert.equal(result.data.retryAfter, 60);
  assert.equal(result.data.otpCode, "123456");
});

test("verifyOtp sends requestId and otp fields expected by auth-service", async () => {
  const calls = [];
  globalThis.fetch = async (input, init) => {
    calls.push({ input: String(input), init });
    return new Response(
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
  };

  const client = new ApiClient({ baseUrl: "http://localhost:3000" });
  const result = await client.verifyOtp({
    phone: "+84901234567",
    requestId: "req_dev_001",
    otp: "123456",
    deviceId: "web-chrome",
    deviceName: "Chrome",
    platform: "web"
  });

  assert.equal(calls.length, 1);
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.phone, "+84901234567");
  assert.equal(body.requestId, "req_dev_001");
  assert.equal(body.otp, "123456");
  assert.equal(body.deviceId, "web-chrome");
  assert.equal(body.deviceName, "Chrome");
  assert.equal(body.platform, "web");
  assert.equal(result.data.sessionId, "ses_dev_001");
  assert.equal(result.data.refreshToken, "rtk_001");
});

test("getWalletPrefundStatus reads the prefund polling payload", async () => {
  const calls = [];
  globalThis.fetch = async (input, init) => {
    calls.push({ input: String(input), init });
    return new Response(
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
  };

  const client = new ApiClient({ baseUrl: "http://localhost:3000" });
  const result = await client.getWalletPrefundStatus("0x000000000000000000000000000000000000dead");

  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].input,
    "http://localhost:3000/v1/wallet/prefund/0x000000000000000000000000000000000000dead"
  );
  assert.equal(result.data.walletAddress, "0x000000000000000000000000000000000000dead");
  assert.equal(result.data.funded, true);
  assert.equal(result.data.txHash, "0xabc");
  assert.equal(result.data.amountWei, "1000000000000000");
  assert.equal(result.data.fundedAt, "2026-04-21T10:00:00.000Z");
});
