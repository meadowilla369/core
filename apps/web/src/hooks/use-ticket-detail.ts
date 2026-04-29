import { useMemo } from "react";

import { useMyTickets } from "@/hooks/use-tickets";
import { findTicketByTokenId } from "@/lib/ticket-loader";

export function useTicketDetail(tokenId: string | undefined) {
  const query = useMyTickets();
  const ticket = useMemo(
    () => (tokenId && query.data ? findTicketByTokenId(query.data.tickets, tokenId) : null),
    [query.data, tokenId]
  );

  return {
    ...query,
    ticket
  };
}
