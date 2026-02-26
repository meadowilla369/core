export type RecoveryState = "idle" | "initiated" | "hold" | "completed" | "cancelled";

export interface RecoveryRequest {
  recoveryId: string;
  state: RecoveryState;
  holdEndsAt?: string;
}

export function initiateRecovery(holdMinutes: number): RecoveryRequest {
  return {
    recoveryId: `rec_${Date.now()}`,
    state: "initiated",
    holdEndsAt: new Date(Date.now() + holdMinutes * 60_000).toISOString()
  };
}

export function moveToHold(input: RecoveryRequest): RecoveryRequest {
  return { ...input, state: "hold" };
}
