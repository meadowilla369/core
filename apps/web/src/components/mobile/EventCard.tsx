import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import type { EventCardView } from "@ticket-platform/shared-types";

interface EventCardProps extends EventCardView {
  featured?: boolean;
}

const EventCard = ({
  id,
  name,
  date,
  location,
  category,
  price,
  featured = false
}: EventCardProps) => {
  if (featured) {
    return (
      <Link
        to={`/event/${id}`}
        className="group block relative aspect-[4/3] border border-foreground/20 overflow-hidden hover:border-foreground/50 transition-colors"
      >
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/30 z-10" />

        {/* Pattern background */}
        <div className="absolute inset-0 bg-muted/30">
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: `linear-gradient(45deg, hsl(var(--foreground)) 25%, transparent 25%), 
                              linear-gradient(-45deg, hsl(var(--foreground)) 25%, transparent 25%), 
                              linear-gradient(45deg, transparent 75%, hsl(var(--foreground)) 75%), 
                              linear-gradient(-45deg, transparent 75%, hsl(var(--foreground)) 75%)`,
              backgroundSize: "20px 20px",
              backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px"
            }}
          />
        </div>

        {/* Category badge */}
        <div className="absolute top-2 left-2 z-20">
          <span className="px-1.5 py-0.5 bg-foreground/10 backdrop-blur-sm border border-foreground/20 font-mono text-[8px] tracking-widest uppercase">
            {category}
          </span>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-2.5 z-20">
          <h3 className="text-sm font-medium tracking-tight group-hover:text-glow transition-all leading-tight truncate">
            {name}
          </h3>
          <div className="flex items-center justify-between mt-1.5 gap-1">
            <span className="font-mono text-[8px] text-foreground/60 truncate">
              {date} · {location}
            </span>
            <span className="font-mono text-[10px] font-medium whitespace-nowrap">{price}</span>
          </div>
        </div>

        <ArrowUpRight className="absolute top-2 right-2 w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity z-20" />
      </Link>
    );
  }

  return (
    <Link
      to={`/event/${id}`}
      className="group flex items-center gap-4 p-4 border-b border-foreground/10 hover:bg-foreground/5 transition-colors"
    >
      <div className="w-24 h-16 bg-muted/50 border border-foreground/20 flex-shrink-0" />

      <div className="flex-1 min-w-0">
        <span className="font-mono text-[10px] tracking-widest text-foreground/50 uppercase">
          {category}
        </span>
        <h3 className="font-medium tracking-tight truncate">{name}</h3>
        <p className="font-mono text-xs text-foreground/50 mt-0.5">
          {date} · {location}
        </p>
      </div>

      <div className="text-right">
        <span className="font-mono text-sm">{price}</span>
        <ArrowUpRight className="w-4 h-4 ml-auto mt-1 opacity-40 group-hover:opacity-100 transition-opacity" />
      </div>
    </Link>
  );
};

export default EventCard;
