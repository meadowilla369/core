import { ArrowRight, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import type { MarketplaceEventView } from "@ticket-platform/shared-types";

type MarketplaceCardProps = MarketplaceEventView;

const MarketplaceCard = ({
  id,
  eventName,
  dayVolume,
  dayChange,
  floorPrice,
  floorChange,
  listings
}: MarketplaceCardProps) => {
  const primaryListing = listings[0];

  return (
    <div className="border border-foreground/20 bg-card">
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-muted border border-foreground/20 flex items-center justify-center">
            <span className="font-mono text-xs font-medium">{eventName.charAt(0)}</span>
          </div>
          <span className="font-medium tracking-tight">{eventName}</span>
        </div>
        <Link
          to={primaryListing ? `/marketplace/buy/${primaryListing.id}` : "/marketplace"}
          className="w-9 h-9 border border-foreground/20 flex items-center justify-center hover:bg-foreground hover:text-background transition-colors"
        >
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 px-4 pb-3">
        <div>
          <span className="font-mono text-[10px] text-foreground/50">Ngày</span>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="text-lg font-medium tracking-tight">{dayVolume}</span>
          </div>
          <span
            className={`font-mono text-xs ${dayChange >= 0 ? "text-green-600" : "text-red-500"}`}
          >
            {dayChange >= 0 ? "+" : ""}
            {dayChange}%
          </span>
        </div>
        <div>
          <span className="font-mono text-[10px] text-foreground/50">Sàn</span>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="text-lg font-medium tracking-tight">{floorPrice}</span>
          </div>
          <span
            className={`font-mono text-xs ${floorChange >= 0 ? "text-green-600" : "text-red-500"}`}
          >
            {floorChange >= 0 ? "+" : ""}
            {floorChange}%
          </span>
        </div>
      </div>

      {/* Ticket Listings - horizontal scroll */}
      <div className="flex gap-2 px-4 pb-4 overflow-x-auto scrollbar-hide">
        {listings.map((listing) => (
          <Link
            key={listing.id}
            to={`/marketplace/buy/${listing.id}`}
            className="relative flex-shrink-0 w-28 aspect-[3/4] bg-muted/50 border border-foreground/20 flex flex-col justify-between p-2.5 hover:border-foreground/50 transition-colors group"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[9px] text-foreground/40 uppercase tracking-wider">
                {listing.tier}
              </span>
              <div className="w-5 h-5 border border-foreground/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Plus className="w-3 h-3" />
              </div>
            </div>
            <div className="bg-foreground/10 backdrop-blur-sm px-1.5 py-1 self-start">
              <span className="font-mono text-[10px] font-medium">{listing.price}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default MarketplaceCard;
