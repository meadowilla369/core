import { ShieldCheck, Ticket, Info, MoveRight } from "lucide-react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import type { PosterEventView } from "@/features/discover/event-posters";

interface PosterSpotlightHeroProps {
  event: PosterEventView;
  onPreview?: (event: PosterEventView) => void;
  onTrustOpen?: () => void;
}

const PosterSpotlightHero = ({ event, onPreview, onTrustOpen }: PosterSpotlightHeroProps) => {
  const backgroundImage = event.heroImageUrl
    ? `linear-gradient(180deg, rgba(0,0,0,.06), rgba(0,0,0,.82)), url(${event.heroImageUrl})`
    : `linear-gradient(180deg, rgba(0,0,0,.06), rgba(0,0,0,.82)), ${event.posterPalette.backdrop}`;

  return (
    <section className="px-4 pt-4">
      <div className="overflow-hidden border border-white/10 bg-card">
        <div
          className="relative min-h-[28rem] bg-cover bg-center"
          style={{ backgroundImage, backgroundPosition: "center" }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-[#06070a] via-[#06070a]/28 to-transparent" />
          <div className="absolute left-4 right-4 top-4 z-10 flex items-start justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {event.trustBadges.map((badge) => (
                <Badge
                  key={badge}
                  variant="outline"
                  className="rounded-full border-white/15 bg-black/25 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-white backdrop-blur"
                >
                  {badge}
                </Badge>
              ))}
            </div>
            {onTrustOpen && (
              <button
                type="button"
                onClick={onTrustOpen}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/25 text-white/90 backdrop-blur transition-colors hover:bg-black/45"
                aria-label="Giải thích trust"
              >
                <Info className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="absolute inset-x-0 bottom-0 z-10 p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-white/58">
              {event.spotlightLabel}
            </p>
            <h1 className="mt-3 max-w-[16rem] text-[2.35rem] font-semibold leading-[0.96] tracking-[-0.05em] text-white">
              {event.name}
            </h1>
            <p className="mt-3 max-w-[24rem] text-sm text-white/70">{event.highlight}</p>

            <div
              className="mt-5 grid gap-3 border border-white/10 p-4 backdrop-blur-sm sm:grid-cols-[1fr_auto]"
              style={{ background: event.posterPalette.panel }}
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/48">
                    Vé từ
                  </p>
                  <p className="mt-1 text-base font-medium text-white">{event.price}</p>
                </div>
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/48">
                    Quan tâm
                  </p>
                  <p className="mt-1 text-base font-medium text-white">{event.interestCount}</p>
                </div>
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/48">
                    Trust
                  </p>
                  <p className="mt-1 text-sm text-white/84">{event.syncLabel}</p>
                </div>
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/48">
                    Nơi diễn ra
                  </p>
                  <p className="mt-1 text-sm text-white/84">{event.location}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-end justify-end gap-2">
                {onPreview && (
                  <button
                    type="button"
                    onClick={() => onPreview(event)}
                    className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/25 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-white transition-colors hover:bg-black/40"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Xem nhanh
                  </button>
                )}
                <Link
                  to={`/event/${event.id}`}
                  className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-black transition-colors hover:bg-white/85"
                >
                  <Ticket className="h-3.5 w-3.5" />
                  Mở chi tiết
                  <MoveRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PosterSpotlightHero;
