import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Heart, Share2, MapPin, Calendar, Clock, Users } from "lucide-react";
import { Link } from "react-router-dom";
import MobileLayout from "@/components/mobile/MobileLayout";
import { eventDetailFallback, eventTicketTierFallback } from "@/lib/fallback-data";
import { useEventDetail } from "@/hooks/use-events";

const EventDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, isError } = useEventDetail(id);
  const eventData = data?.event ?? eventDetailFallback;
  const ticketTiers = data?.tiers ?? eventTicketTierFallback;
  const [selectedTierIndex, setSelectedTierIndex] = useState(0);

  const safeSelectedTierIndex =
    selectedTierIndex >= 0 && selectedTierIndex < ticketTiers.length ? selectedTierIndex : 0;

  return (
    <MobileLayout>
      {isError && (
        <div className="px-4 py-3 border-b border-yellow-500/30 bg-yellow-500/10">
          <p className="font-mono text-[10px] text-yellow-200">
            Chi tiết sự kiện đang dùng fallback vì event-service chưa phản hồi.
          </p>
        </div>
      )}

      {/* Hero */}
      <div className="relative aspect-[4/3] bg-muted border-b border-foreground/20">
        {eventData.heroImageDataUrl ? (
          <img
            src={eventData.heroImageDataUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />

        {/* Top Nav */}
        <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between z-10">
          <Link
            to="/"
            className="w-10 h-10 bg-background/80 backdrop-blur-sm border border-foreground/20 flex items-center justify-center"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex gap-2">
            <button className="w-10 h-10 bg-background/80 backdrop-blur-sm border border-foreground/20 flex items-center justify-center">
              <Heart className="w-4 h-4" />
            </button>
            <button className="w-10 h-10 bg-background/80 backdrop-blur-sm border border-foreground/20 flex items-center justify-center">
              <Share2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Event Title */}
        <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
          <span className="font-mono text-[10px] tracking-widest text-foreground/60">
            {eventData.category.toUpperCase()}
          </span>
          <h1 className="text-3xl font-medium tracking-tight mt-1">{eventData.name}</h1>
        </div>
      </div>

      {/* Quick Info */}
      <section className="grid grid-cols-2 border-b border-foreground/10">
        <div className="p-4 border-r border-foreground/10">
          <div className="flex items-center gap-2 text-foreground/60 mb-1">
            <Calendar className="w-3.5 h-3.5" />
            <span className="font-mono text-[10px]">NGÀY</span>
          </div>
          <p className="font-medium">{eventData.date}</p>
        </div>
        <div className="p-4">
          <div className="flex items-center gap-2 text-foreground/60 mb-1">
            <Clock className="w-3.5 h-3.5" />
            <span className="font-mono text-[10px]">GIỜ</span>
          </div>
          <p className="font-medium">{eventData.time}</p>
        </div>
      </section>

      <section className="p-4 border-b border-foreground/10">
        <div className="flex items-start gap-3">
          <MapPin className="w-4 h-4 text-foreground/60 mt-1" />
          <div>
            <p className="font-medium">{eventData.location}</p>
            <p className="font-mono text-xs text-foreground/50 mt-0.5">{eventData.address}</p>
          </div>
        </div>
      </section>

      {/* Attendees */}
      <section className="p-4 border-b border-foreground/10 flex items-center gap-3">
        <Users className="w-4 h-4 text-foreground/60" />
        <span className="font-mono text-sm">
          {eventData.attendees.toLocaleString()} người tham dự
        </span>
      </section>

      {/* Description */}
      <section className="p-4 border-b border-foreground/10">
        <h2 className="font-mono text-xs tracking-widest text-foreground/60 mb-3">
          [ GIỚI THIỆU ]
        </h2>
        <p className="text-foreground/80 leading-relaxed">{eventData.description}</p>
      </section>

      {/* Lineup */}
      <section className="p-4 border-b border-foreground/10">
        <h2 className="font-mono text-xs tracking-widest text-foreground/60 mb-3">
          [ DÀN NGHỆ SĨ ]
        </h2>
        {eventData.lineup.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {eventData.lineup.map((artist) => (
              <span
                key={artist}
                className="px-3 py-1.5 border border-foreground/20 font-mono text-xs"
              >
                {artist}
              </span>
            ))}
          </div>
        ) : (
          <p className="font-mono text-xs text-foreground/40">
            event-service hiện chưa cung cấp lineup chi tiết.
          </p>
        )}
      </section>

      {/* Tickets */}
      <section className="p-4">
        <h2 className="font-mono text-xs tracking-widest text-foreground/60 mb-4">[ CHỌN VÉ ]</h2>
        <div className="space-y-3">
          {ticketTiers.map((tier, index) => (
            <button
              key={tier.name}
              onClick={() => setSelectedTierIndex(index)}
              className={`w-full p-4 border text-left transition-colors group ${
                ticketTiers[safeSelectedTierIndex]?.name === tier.name
                  ? "border-foreground bg-foreground/5"
                  : "border-foreground/20 hover:bg-foreground/5"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">{tier.name}</span>
                <span className="font-mono text-lg">{tier.price}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {tier.perks.map((perk) => (
                  <span key={perk} className="font-mono text-[10px] text-foreground/50">
                    • {perk}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Sticky CTA */}
      <div className="sticky bottom-16 left-0 right-0 p-4 bg-background/95 backdrop-blur-sm border-t border-foreground/10">
        <button
          onClick={() => {
            if (!id) {
              return;
            }
            navigate(`/event/${id}/purchase?tier=${safeSelectedTierIndex}`);
          }}
          className="w-full py-4 bg-foreground text-background font-mono text-sm tracking-wider hover:bg-foreground/90 transition-colors"
        >
          MUA {ticketTiers[safeSelectedTierIndex]?.name?.toUpperCase() ?? "VÉ"} —{" "}
          {ticketTiers[safeSelectedTierIndex]?.price ?? `${eventData.price.min.toLocaleString()}₫`}
        </button>
      </div>
    </MobileLayout>
  );
};

export default EventDetailPage;
