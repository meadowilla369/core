export type AuthStatus = "signed_out" | "otp_requested" | "verifying" | "signed_in";

export interface AuthState {
  status: AuthStatus;
  phoneNumber?: string;
  userId?: string;
  walletAddress?: string;
  sessionId?: string;
}

export interface OtpRequestResult {
  requestId: string;
  expiresAt: string;
}

export interface OtpVerifyResult {
  userId: string;
  sessionId: string;
  walletAddress: string;
}

export function requestOtp(phoneNumber: string): OtpRequestResult {
  return {
    requestId: `otp_${Date.now()}`,
    expiresAt: new Date(Date.now() + 5 * 60_000).toISOString()
  };
}

export function verifyOtp(phoneNumber: string, otpCode: string): OtpVerifyResult {
  if (!phoneNumber || otpCode.length < 4) {
    throw new Error("Invalid OTP input");
  }

  return {
    userId: `usr_${phoneNumber.replace(/\D/g, "").slice(-8)}`,
    sessionId: `sess_${Date.now()}`,
    walletAddress: `0xwallet${phoneNumber.replace(/\D/g, "").slice(-8)}`
  };
}
