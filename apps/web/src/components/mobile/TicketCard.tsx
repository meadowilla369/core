import { QrCode, MapPin, Calendar } from "lucide-react";
import { Link } from "react-router-dom";
import type { TicketCardView } from "@ticket-platform/shared-types";

type TicketCardProps = TicketCardView;

const TicketCard = ({ id, eventName, date, time, location, ticketType }: TicketCardProps) => {
  return (
    <Link
      to={`/ticket/${id}`}
      className="group block border border-foreground/20 bg-card overflow-hidden"
    >
      {/* Ticket Header */}
      <div className="p-4 border-b border-dashed border-foreground/20">
        <span className="font-mono text-[10px] tracking-widest text-foreground/50 uppercase">
          {ticketType}
        </span>
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
        <span className="font-mono text-[10px] tracking-wider text-foreground/40">
          CHẠM ĐỂ XEM VÉ ĐẦY ĐỦ
        </span>
      </div>
    </Link>
  );
};

export default TicketCard;
