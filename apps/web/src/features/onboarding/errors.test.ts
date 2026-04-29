import assert from "node:assert/strict";
import test from "node:test";

import { ApiClientError } from "@ticket-platform/sdk-client";
import { normalizeOnboardingError } from "./errors.ts";

test("keeps backend OTP rate-limit errors as rate-limit", () => {
  const error = new ApiClientError(429, {
    success: false,
    error: {
      code: "OTP_RATE_LIMITED",
      message: "Too many OTP requests"
    }
  });

  const normalized = normalizeOnboardingError(
    error,
    "OTP_REQUEST_FAILED",
    "Khong the yeu cau OTP luc nay"
  );

  assert.equal(normalized.code, "OTP_RATE_LIMITED");
  assert.equal(normalized.message, "Too many OTP requests");
});

test("does not classify network OTP request failures as rate-limit", () => {
  const normalized = normalizeOnboardingError(
    new TypeError("Failed to fetch"),
    "OTP_REQUEST_FAILED",
    "Khong the ket noi backend OTP"
  );

  assert.equal(normalized.code, "OTP_REQUEST_FAILED");
  assert.equal(normalized.message, "Failed to fetch");
});
