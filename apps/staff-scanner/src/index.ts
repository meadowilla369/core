import { evaluateQrPayload, nextGateMetrics, type GateMetrics, type ScanInput, type ScanResult } from "./core/scanner.js";
export { toStaffScanInput, toStaffScanLabel } from "./integrations/ui-adapter.js";

export class StaffScannerApp {
  private readonly metricsByGate = new Map<string, GateMetrics>();

  scan(input: ScanInput): ScanResult {
    const result = evaluateQrPayload(input);

    const previous = this.metricsByGate.get(input.gateId) ?? {
      gateId: input.gateId,
      totalScans: 0,
      successCount: 0,
      duplicateCount: 0,
      failedCount: 0
    };

    this.metricsByGate.set(input.gateId, nextGateMetrics(previous, result));
    return result;
  }

  getGateMetrics(gateId: string): GateMetrics {
    return (
      this.metricsByGate.get(gateId) ?? {
        gateId,
        totalScans: 0,
        successCount: 0,
        duplicateCount: 0,
        failedCount: 0
      }
    );
  }
}

export function bootstrap(): StaffScannerApp {
  return new StaffScannerApp();
}
