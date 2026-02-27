import { AppStore } from "./core/store.js";
import { InMemorySecureStorage, type SecureStorage } from "./core/secure-storage.js";
import { dictionary, type Locale } from "./i18n/index.js";
import { createReservation, markPaymentPending, markPurchaseResult, type PurchaseSession } from "./features/purchase.js";
import { requestOtp, verifyOtp, type AuthState } from "./features/auth.js";
export { toMobileEventSummaries, toMobileListings, toMobileTickets } from "./integrations/ui-adapter.js";

export interface MobileAppState {
  locale: Locale;
  auth: AuthState;
  activePurchase?: PurchaseSession;
}

export class MobileBuyerApp {
  private readonly store: AppStore<MobileAppState>;
  private readonly secureStorage: SecureStorage;

  constructor(storage: SecureStorage = new InMemorySecureStorage()) {
    this.secureStorage = storage;
    this.store = new AppStore<MobileAppState>({
      locale: "vi",
      auth: {
        status: "signed_out"
      }
    });
  }

  getState(): MobileAppState {
    return this.store.getState();
  }

  subscribe(listener: (nextState: MobileAppState, previousState: MobileAppState) => void): () => void {
    return this.store.subscribe(listener);
  }

  i18n() {
    return dictionary(this.store.getState().locale);
  }

  setLocale(locale: Locale): void {
    this.store.patch({ locale });
  }

  requestOtp(phoneNumber: string): { requestId: string; expiresAt: string } {
    const otp = requestOtp(phoneNumber);
    this.store.patch({
      auth: {
        status: "otp_requested",
        phoneNumber
      }
    });
    return otp;
  }

  async verifyOtp(phoneNumber: string, otpCode: string): Promise<void> {
    this.store.patch({
      auth: {
        ...this.store.getState().auth,
        status: "verifying",
        phoneNumber
      }
    });

    const verified = verifyOtp(phoneNumber, otpCode);

    await this.secureStorage.setItem("access.userId", verified.userId);
    await this.secureStorage.setItem("access.sessionId", verified.sessionId);
    await this.secureStorage.setItem("access.walletAddress", verified.walletAddress);

    this.store.patch({
      auth: {
        status: "signed_in",
        phoneNumber,
        userId: verified.userId,
        sessionId: verified.sessionId,
        walletAddress: verified.walletAddress
      }
    });
  }

  startPurchase(eventId: string, ticketTypeId: string, quantity: number, unitPrice: number): PurchaseSession {
    const reservation = createReservation(eventId, ticketTypeId, quantity, unitPrice);
    this.store.patch({ activePurchase: reservation });
    return reservation;
  }

  markPurchasePending(): void {
    const current = this.store.getState().activePurchase;
    if (!current) {
      throw new Error("No active purchase");
    }
    this.store.patch({ activePurchase: markPaymentPending(current) });
  }

  finalizePurchase(success: boolean, reason?: string): void {
    const current = this.store.getState().activePurchase;
    if (!current) {
      throw new Error("No active purchase");
    }
    this.store.patch({ activePurchase: markPurchaseResult(current, success, reason) });
  }
}

export function bootstrap(): MobileBuyerApp {
  return new MobileBuyerApp();
}
