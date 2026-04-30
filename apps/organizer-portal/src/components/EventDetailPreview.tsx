import { Calendar, Clock, MapPin, Users } from "lucide-react";
import type { EventPreviewModel } from "@/domain/event-create";
import { formatVnd } from "@/lib/format";

interface EventDetailPreviewProps {
  preview: EventPreviewModel;
}

export function EventDetailPreview({ preview }: EventDetailPreviewProps) {
  const { event, tiers } = preview;
  const selectedTier = tiers[0];

  return (
    <div className="overflow-hidden rounded-lg border border-[--op-border] bg-slate-950 text-white shadow-sm">
      <div className="relative aspect-[4/3] bg-slate-800">
        {event.heroImageDataUrl ? (
          <img
            src={event.heroImageDataUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-white/60">
            {event.category}
          </p>
          <h3 className="mt-1 text-2xl font-semibold tracking-tight">{event.name}</h3>
        </div>
      </div>
      <div className="grid grid-cols-2 border-b border-white/10">
        <div className="border-r border-white/10 p-4">
          <div className="mb-1 flex items-center gap-2 text-white/60">
            <Calendar className="h-3.5 w-3.5" />
            <span className="font-mono text-[10px]">NGÀY</span>
          </div>
          <p className="text-sm font-medium">{event.date}</p>
        </div>
        <div className="p-4">
          <div className="mb-1 flex items-center gap-2 text-white/60">
            <Clock className="h-3.5 w-3.5" />
            <span className="font-mono text-[10px]">GIỜ</span>
          </div>
          <p className="text-sm font-medium">{event.time}</p>
        </div>
      </div>
      <div className="border-b border-white/10 p-4">
        <div className="flex items-start gap-3">
          <MapPin className="mt-1 h-4 w-4 text-white/60" />
          <div>
            <p className="font-medium">{event.location}</p>
            <p className="mt-0.5 font-mono text-xs text-white/50">{event.address}</p>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 border-b border-white/10 p-4">
        <Users className="h-4 w-4 text-white/60" />
        <span className="font-mono text-sm">
          {event.attendees.toLocaleString("en")} người tham dự
        </span>
      </div>
      <div className="border-b border-white/10 p-4">
        <p className="mb-3 font-mono text-xs tracking-widest text-white/60">[ GIỚI THIỆU ]</p>
        <p className="text-sm leading-relaxed text-white/80">{event.description}</p>
      </div>
      <div className="border-b border-white/10 p-4">
        <p className="mb-3 font-mono text-xs tracking-widest text-white/60">[ DÀN NGHỆ SĨ ]</p>
        {event.lineup.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {event.lineup.map((artist) => (
              <span key={artist} className="border border-white/20 px-3 py-1.5 font-mono text-xs">
                {artist}
              </span>
            ))}
          </div>
        ) : (
          <p className="font-mono text-xs text-white/40">
            event-service hiện chưa cung cấp lineup chi tiết.
          </p>
        )}
      </div>
      <div className="p-4">
        <p className="mb-4 font-mono text-xs tracking-widest text-white/60">[ CHỌN VÉ ]</p>
        <div className="space-y-3">
          {tiers.map((tier) => (
            <div key={tier.name} className="border border-white/20 p-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="font-medium">{tier.name}</span>
                <span className="shrink-0 font-mono text-lg">{tier.price}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {tier.perks.map((perk) => (
                  <span key={perk} className="font-mono text-[10px] text-white/50">
                    • {perk}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="mt-4 w-full bg-white px-3 py-3 font-mono text-sm tracking-wider text-slate-950"
        >
          MUA {selectedTier?.name.toUpperCase() ?? "VÉ"} -{" "}
          {selectedTier?.price ?? formatVnd(event.price.min)}
        </button>
      </div>
    </div>
  );
}
