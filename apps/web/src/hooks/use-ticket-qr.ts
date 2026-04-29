import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import type { TicketOwnershipView } from "@/lib/ticket-loader";
import {
  buildLocalTicketQrPayload,
  getTicketQrAgeMs,
  getTicketQrRefreshDelayMs,
  serializeTicketQrPayload,
  type TicketQrPayload
} from "@/lib/ticket-qr";
import { getSessionUserId } from "@/lib/session";
import { useApiClient } from "@/providers/AppProviders";

const QR_TTL_MS = 30_000;

export function useTicketQr(ticket: TicketOwnershipView | null) {
  const client = useApiClient();
  const userId = getSessionUserId();
  const [nowMs, setNowMs] = useState(Date.now());

  const query = useQuery({
    queryKey: ["ticket-qr", ticket?.tokenId, userId],
    enabled: Boolean(ticket),
    retry: 1,
    queryFn: async (): Promise<TicketQrPayload> => {
      if (!ticket) {
        throw new Error("Ticket is required");
      }

      const response = await client.createTicketQr(ticket.tokenId, {
        userId,
        ownerWalletAddress: ticket.ownerWalletAddress
      });
      return { ...response.data, source: "backend" };
    }
  });

  const fallbackPayload = useMemo(() => {
    if (!ticket || !query.isError || !ticket.ownerWalletAddress) {
      return null;
    }

    return buildLocalTicketQrPayload({
      tokenId: ticket.tokenId,
      eventId: ticket.eventId,
      walletAddress: ticket.ownerWalletAddress,
      nowMs: Date.now()
    });
  }, [query.isError, ticket]);

  const payload = query.data ?? fallbackPayload;
  const qrValue = payload ? serializeTicketQrPayload(payload) : "";
  const ageMs = payload ? getTicketQrAgeMs(payload, nowMs) : 0;
  const secondsRemaining = payload ? Math.max(0, Math.ceil((QR_TTL_MS - ageMs) / 1000)) : 0;
  const refetch = query.refetch;

  useEffect(() => {
    if (!payload) {
      return undefined;
    }

    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [payload]);

  useEffect(() => {
    if (!payload || payload.source !== "backend") {
      return undefined;
    }

    const delay = getTicketQrRefreshDelayMs(payload, Date.now(), QR_TTL_MS);
    const timer = window.setTimeout(() => {
      void refetch();
    }, delay);
    return () => window.clearTimeout(timer);
  }, [payload, refetch]);

  return {
    payload,
    qrValue,
    secondsRemaining,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isBackendError: query.isError,
    source: payload?.source ?? null,
    refresh: query.refetch
  };
}
