export type PurchaseState = "idle" | "reserved" | "payment_pending" | "success" | "failed";

export interface PurchaseSession {
  reservationId: string;
  eventId: string;
  ticketTypeId: string;
  quantity: number;
  totalAmount: number;
  state: PurchaseState;
  reason?: string;
}

export function createReservation(
  eventId: string,
  ticketTypeId: string,
  quantity: number,
  unitPrice: number
): PurchaseSession {
  if (quantity < 1 || quantity > 4) {
    throw new Error("Quantity must be between 1 and 4");
  }

  return {
    reservationId: `res_${Date.now()}`,
    eventId,
    ticketTypeId,
    quantity,
    totalAmount: quantity * unitPrice,
    state: "reserved"
  };
}

export function markPaymentPending(session: PurchaseSession): PurchaseSession {
  return { ...session, state: "payment_pending" };
}

export function markPurchaseResult(session: PurchaseSession, success: boolean, reason?: string): PurchaseSession {
  return {
    ...session,
    state: success ? "success" : "failed",
    reason
  };
}
