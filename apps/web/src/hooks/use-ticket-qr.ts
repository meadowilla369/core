import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import type { TicketOwnershipView } from "@/lib/ticket-loader";
import { getTicketQrErrorDetails } from "@/lib/ticket-qr-errors";
import {
  getTicketQrAgeMs,
  getTicketQrRefreshDelayMs,
  serializeTicketQrPayload,
  type SignedTicketQrPayload
} from "@/lib/ticket-qr";
import { getSessionUserId, signSessionTypedData } from "@/lib/session";
import { useApiClient } from "@/providers/AppProviders";

export function useTicketQr(ticket: TicketOwnershipView | null) {
  const client = useApiClient();
  const userId = getSessionUserId();
  const [nowMs, setNowMs] = useState(Date.now());

  const query = useQuery({
    queryKey: ["ticket-qr", ticket?.tokenId, userId],
    enabled: Boolean(ticket),
    retry: 1,
    queryFn: async (): Promise<SignedTicketQrPayload> => {
      if (!ticket) {
        throw new Error("Ticket is required");
      }

      const response = await client.createTicketQr(ticket.tokenId, {
        userId,
        ownerWalletAddress: ticket.ownerWalletAddress
      });
      const signature = await signSessionTypedData(response.data);
      return { ...response.data, signature };
    }
  });
  const payload = query.data ?? null;
  const errorDetails = query.error ? getTicketQrErrorDetails(query.error) : null;
  const qrValue = payload ? serializeTicketQrPayload(payload) : "";
  const ageMs = payload ? getTicketQrAgeMs(payload, nowMs) : 0;
  const secondsRemaining = payload
    ? Math.max(0, Math.ceil(payload.message.expiresAt - nowMs / 1000))
    : 0;
  const refetch = query.refetch;

  useEffect(() => {
    if (!payload) {
      return undefined;
    }

    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [payload]);

  useEffect(() => {
    if (!payload) {
      return undefined;
    }

    const delay = getTicketQrRefreshDelayMs(payload, Date.now());
    const timer = window.setTimeout(() => {
      void refetch();
    }, delay);
    return () => window.clearTimeout(timer);
  }, [payload, refetch]);

  // Failsafe: if QR is already expired when the component mounts (e.g. after
  // backgrounding the app), trigger an immediate refetch.
  useEffect(() => {
    if (secondsRemaining === 0 && payload && !query.isFetching) {
      void refetch();
    }
  }, [secondsRemaining, payload, query.isFetching, refetch]);

  return {
    payload,
    qrValue,
    secondsRemaining,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isBackendError: query.isError,
    errorDetails,
    rawErrorMessage: query.error instanceof Error ? query.error.message : null,
    source: payload ? ("signed" as const) : null,
    refresh: query.refetch
  };
}
