export type TicketQrErrorCode =
  | "WALLET_MISMATCH"
  | "MISSING_PRIVATE_KEY"
  | "UNKNOWN";

export interface TicketQrErrorDetails {
  code: TicketQrErrorCode;
  userMessage: string;
}

export function getTicketQrErrorDetails(error: unknown): TicketQrErrorDetails {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const normalized = message.toLowerCase();

  if (normalized.includes("private key") && normalized.includes("khong khop")) {
    return {
      code: "WALLET_MISMATCH",
      userMessage:
        "Session wallet hien tai khong khop voi vi chu so huu ve nay. Hay dang nhap lai dung vi hoac chay lai onboarding."
    };
  }

  if (normalized.includes("khong co private key")) {
    return {
      code: "MISSING_PRIVATE_KEY",
      userMessage:
        "Session wallet hien tai khong con private key de ky QR. Hay chay lai onboarding hoac dang nhap lai."
    };
  }

  return {
    code: "UNKNOWN",
    userMessage: "Khong tao duoc owner-signed QR. Hay thu lam moi hoac kiem tra lai session wallet."
  };
}
