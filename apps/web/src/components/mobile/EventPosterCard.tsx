import { Eye, MapPin, MoveUpRight } from "lucide-react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import type { PosterEventView } from "@/features/discover/event-posters";
import { cn } from "@/lib/utils";

interface EventPosterCardProps {
  event: PosterEventView;
  onPreview?: (event: PosterEventView) => void;
  variant?: "default" | "feature";
  className?: string;
}

const EventPosterCard = ({
  event,
  onPreview,
  variant = "default",
  className
}: EventPosterCardProps) => {
  const backgroundImage = event.imageUrl
    ? `linear-gradient(180deg, rgba(0,0,0,.02), rgba(0,0,0,.72)), url(${event.imageUrl})`
    : `linear-gradient(180deg, rgba(0,0,0,.02), rgba(0,0,0,.72)), ${event.posterPalette.backdrop}`;

  return (
    <article
      className={cn(
        "group relative overflow-hidden border border-white/10 bg-card text-foreground transition-transform duration-300 hover:-translate-y-0.5 hover:border-white/20",
        variant === "feature" ? "aspect-[4/5]" : "aspect-[4/5]",
        className
      )}
    >
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage,
          backgroundSize: event.imageUrl ? "cover" : "cover",
          backgroundPosition: "center"
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#050608] via-[#050608]/28 to-transparent" />

      <div className="absolute left-3 right-3 top-3 z-10 flex items-start justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {event.trustBadges.slice(0, 2).map((badge) => (
            <Badge
              key={badge}
              variant="outline"
              className="rounded-full border-white/15 bg-black/30 px-2 py-1 text-[9px] uppercase tracking-[0.18em] text-white backdrop-blur"
            >
              {badge}
            </Badge>
          ))}
        </div>
        {onPreview && (
          <button
            type="button"
            onClick={() => onPreview(event)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-black/30 text-white/90 backdrop-blur transition-colors hover:bg-black/50"
            aria-label={`Xem nhanh ${event.name}`}
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="absolute inset-x-0 bottom-0 z-10 p-3">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/60">
              {event.category}
            </p>
            <h3 className="mt-2 text-lg font-semibold leading-tight tracking-tight text-white">
              {event.name}
            </h3>
          </div>
          <div
            className="rounded-full border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-white"
            style={{
              borderColor: event.posterPalette.accent,
              background: event.posterPalette.chip
            }}
          >
            {event.mood}
          </div>
        </div>

        <div
          className="rounded-2xl border border-white/10 p-3 backdrop-blur-sm"
          style={{ background: event.posterPalette.panel }}
        >
          <div className="flex items-center gap-1.5 text-xs text-white/72">
            <MapPin className="h-3.5 w-3.5" />
            <span className="truncate">
              {event.date} · {event.location}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/48">
                Trust
              </p>
              <p className="mt-1 text-sm text-white/88">
                {event.syncLabel} · {event.interestCount}
              </p>
            </div>
            <div className="text-right">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/48">Giá</p>
              <p className="mt-1 font-medium text-white">{event.price}</p>
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="max-w-[70%] text-xs text-white/64">{event.highlight}</p>
          <Link
            to={`/event/${event.id}`}
            className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-black/30 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-white transition-colors hover:bg-black/50"
          >
            Chi tiết
            <MoveUpRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </article>
  );
};

export default EventPosterCard;
