import { QrCode, MapPin, Calendar, ChevronRight } from "lucide-react";
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
  if (source === "contract-sync") return "on-chain";
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
      className="group relative block overflow-hidden border border-foreground/20 bg-card transition-colors hover:border-foreground/40"
    >
      <div className="absolute left-0 top-0 h-full w-1 bg-foreground/70" />

      <div className="border-b border-dashed border-foreground/20 p-4 pl-5">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-foreground/50">
            {ticketType}
          </span>
          <div className="flex shrink-0 items-center gap-1">
            {source && (
              <span className="border border-foreground/15 px-2 py-1 font-mono text-[8px] uppercase tracking-wider text-foreground/45">
                {sourceLabel(source)}
              </span>
            )}
            {syncStatus === "partial" && (
              <span className="border border-yellow-500/30 px-2 py-1 font-mono text-[8px] uppercase tracking-wider text-yellow-200">
                partial
              </span>
            )}
          </div>
        </div>
        <h3 className="mt-2 text-xl font-medium leading-tight tracking-tight">{eventName}</h3>
      </div>

      <div className="grid grid-cols-[1fr_88px] gap-4 p-4 pl-5">
        <div className="min-w-0 space-y-3">
          <div className="flex items-start gap-2 text-foreground/65">
            <Calendar className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="font-mono text-xs leading-relaxed">
              {date} · {time}
            </span>
          </div>
          <div className="flex items-start gap-2 text-foreground/65">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="min-w-0 break-words font-mono text-xs leading-relaxed">
              {location}
            </span>
          </div>
          <span className="inline-flex max-w-full border border-foreground/10 bg-foreground/5 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-foreground/40">
            <span className="truncate">TOKEN {displayToken}</span>
          </span>
        </div>

        <div className="flex mx-[14px] my-[22px] flex-col items-center justify-center border border-foreground/20 bg-foreground/5 transition-colors group-hover:bg-foreground/10">
          <QrCode className="h-12 w-12 text-foreground/45" />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-foreground/10 bg-foreground/5 px-4 py-3 pl-5">
        <span className="font-mono text-[10px] uppercase tracking-wider text-foreground/40">
          Chạm để xem vé đầy đủ
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-foreground/35 transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
};

export default TicketCard;
