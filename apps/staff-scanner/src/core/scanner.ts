export interface ScanInput {
  gateId: string;
  qrPayload: string;
}

export type ScanResultCode = "success" | "duplicate" | "invalid_signature" | "expired" | "unknown";

export interface ScanResult {
  code: ScanResultCode;
  message: string;
  tokenId?: string;
}

export interface GateMetrics {
  gateId: string;
  totalScans: number;
  successCount: number;
  duplicateCount: number;
  failedCount: number;
}

export function evaluateQrPayload(input: ScanInput): ScanResult {
  if (!input.qrPayload || input.qrPayload.length < 10) {
    return { code: "unknown", message: "QR payload missing" };
  }

  if (!input.qrPayload.startsWith("sig_")) {
    return { code: "invalid_signature", message: "Invalid QR signature" };
  }

  const tokenId = input.qrPayload.split("_")[2] ?? "unknown";
  return { code: "success", message: "Check-in accepted", tokenId };
}

export function nextGateMetrics(previous: GateMetrics, result: ScanResult): GateMetrics {
  const next: GateMetrics = {
    ...previous,
    totalScans: previous.totalScans + 1
  };

  if (result.code === "success") {
    next.successCount += 1;
  } else if (result.code === "duplicate") {
    next.duplicateCount += 1;
  } else {
    next.failedCount += 1;
  }

  return next;
}
