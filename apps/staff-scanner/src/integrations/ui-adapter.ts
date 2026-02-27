import type { ScanInput, ScanResult } from "../core/scanner.js";

export interface ImportedUiTicketForScan {
  tokenId: string;
}

export function toStaffScanInput(gateId: string, ticket: ImportedUiTicketForScan): ScanInput {
  return {
    gateId,
    qrPayload: `sig_imported_${ticket.tokenId}`
  };
}

export function toStaffScanLabel(result: ScanResult): string {
  if (result.code === "success") {
    return "accepted";
  }

  if (result.code === "duplicate") {
    return "already-used";
  }

  if (result.code === "expired") {
    return "expired";
  }

  return "rejected";
}
