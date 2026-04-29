import { QrCode, MapPin, Calendar } from "lucide-react";
import { Link } from "react-router-dom";
import type { TicketCardView } from "@ticket-platform/shared-types";
import type { TicketDataSource, TicketSyncStatus } from "@/lib/ticket-loader";

type TicketCardProps = TicketCardView & {
  tokenId?: string;
  source?: TicketDataSource;
  syncStatus?: TicketSyncStatus;
};

const sourceLabel = (source: TicketDataSource) => {
  if (source === "local-cache") return "local";
  if (source === "contract-sync") return "synced";
  return "ticketing";
};

const TicketCard = ({
  id,
  eventName,
  date,
  time,
  location,
  ticketType,
  tokenId,
  source,
  syncStatus
}: TicketCardProps) => {
  const displayToken = tokenId ?? id;

  return (
    <Link
      to={`/ticket/${displayToken}`}
      className="group block border border-foreground/20 bg-card overflow-hidden"
    >
      {/* Ticket Header */}
      <div className="p-4 border-b border-dashed border-foreground/20">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[10px] tracking-widest text-foreground/50 uppercase">
            {ticketType}
          </span>
          <div className="flex shrink-0 items-center gap-1">
            {source && (
              <span className="border border-foreground/15 px-2 py-1 font-mono text-[8px] uppercase text-foreground/45">
                {sourceLabel(source)}
              </span>
            )}
            {syncStatus === "partial" && (
              <span className="border border-yellow-500/30 px-2 py-1 font-mono text-[8px] uppercase text-yellow-200">
                partial
              </span>
            )}
          </div>
        </div>
        <h3 className="text-lg font-medium tracking-tight mt-1">{eventName}</h3>
      </div>

      {/* Ticket Body */}
      <div className="p-4 flex items-center gap-4">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2 text-foreground/60">
            <Calendar className="w-3.5 h-3.5" />
            <span className="font-mono text-xs">
              {date} · {time}
            </span>
          </div>
          <div className="flex items-center gap-2 text-foreground/60">
            <MapPin className="w-3.5 h-3.5" />
            <span className="font-mono text-xs">{location}</span>
          </div>
        </div>

        <div className="w-16 h-16 bg-foreground/10 border border-foreground/20 flex items-center justify-center">
          <QrCode className="w-8 h-8 text-foreground/40" />
        </div>
      </div>

      {/* Ticket Footer */}
      <div className="px-4 py-3 bg-foreground/5 border-t border-foreground/10">
        <span className="block truncate font-mono text-[10px] tracking-wider text-foreground/40">
          {displayToken ? `TOKEN ${displayToken}` : "CHAM DE XEM VE DAY DU"}
        </span>
      </div>
    </Link>
  );
};

export default TicketCard;
