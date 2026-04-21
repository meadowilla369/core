import { CalendarDays, MapPin, ShieldCheck, Ticket } from "lucide-react";
import { Link } from "react-router-dom";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import type { PosterEventView } from "@/features/discover/event-posters";

interface QuickPreviewModalProps {
  event?: PosterEventView;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const QuickPreviewModal = ({ event, open, onOpenChange }: QuickPreviewModalProps) => {
  if (!event) {
    return null;
  }

  const backgroundImage = event.imageUrl
    ? `linear-gradient(180deg, rgba(0,0,0,.08), rgba(0,0,0,.8)), url(${event.imageUrl})`
    : `linear-gradient(180deg, rgba(0,0,0,.08), rgba(0,0,0,.8)), ${event.posterPalette.backdrop}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md overflow-hidden border-white/10 bg-[#090a0d] p-0 text-white">
        <div
          className="relative min-h-[22rem] border-b border-white/10 bg-cover bg-center"
          style={{ backgroundImage }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-[#050608] via-[#050608]/18 to-transparent" />
          <div className="absolute left-4 right-4 top-4 z-10 flex flex-wrap gap-2">
            {event.trustBadges.map((badge) => (
              <Badge
                key={badge}
                variant="outline"
                className="rounded-full border-white/15 bg-black/25 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-white backdrop-blur"
              >
                {badge}
              </Badge>
            ))}
          </div>
          <div className="absolute inset-x-0 bottom-0 z-10 p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/52">
              {event.mood}
            </p>
            <h3 className="mt-2 text-[2rem] font-semibold leading-[0.98] tracking-[-0.05em]">
              {event.name}
            </h3>
          </div>
        </div>

        <DialogHeader className="px-5 pt-4 text-left">
          <DialogTitle className="text-left text-lg tracking-tight text-white">
            Preview nhanh
          </DialogTitle>
          <DialogDescription className="text-left text-sm text-white/60">
            Poster-driven browse, nhưng vẫn đủ dữ liệu để quyết định nhanh.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 px-5 pb-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="border border-white/10 bg-white/[0.03] p-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/45">
                Ticket
              </p>
              <p className="mt-2 text-base font-medium">{event.startingPriceLabel}</p>
            </div>
            <div className="border border-white/10 bg-white/[0.03] p-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/45">
                Trust
              </p>
              <p className="mt-2 text-base font-medium">{event.syncLabel}</p>
            </div>
          </div>

          <div className="space-y-2 border border-white/10 bg-white/[0.03] p-4 text-sm text-white/72">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              <span>{event.date}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              <span>{event.location}</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              <span>{event.interestCount}</span>
            </div>
          </div>

          <p className="text-sm leading-6 text-white/64">{event.highlight}</p>

          <Link
            to={`/event/${event.id}`}
            className="inline-flex w-full items-center justify-center gap-2 bg-white px-4 py-3 font-mono text-[10px] uppercase tracking-[0.18em] text-black transition-colors hover:bg-white/88"
          >
            <Ticket className="h-4 w-4" />
            Xem event detail
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default QuickPreviewModal;
