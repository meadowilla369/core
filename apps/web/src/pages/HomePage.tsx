import { useState } from "react";
import { Bell, Settings, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

import EditorialSectionBlock from "@/components/mobile/EditorialSectionBlock";
import CategoryPill from "@/components/mobile/CategoryPill";
import EventPosterCard from "@/components/mobile/EventPosterCard";
import MobileLayout from "@/components/mobile/MobileLayout";
import PosterSpotlightHero from "@/components/mobile/PosterSpotlightHero";
import QuickPreviewModal from "@/components/mobile/QuickPreviewModal";
import TrustInfoModal from "@/components/mobile/TrustInfoModal";
import {
  buildHomeSections,
  getPosterCategories,
  toPosterEventViews,
  type PosterEventView
} from "@/features/discover/event-posters";
import { useEventCatalog } from "@/hooks/use-events";
import { homeFeaturedFallback, homeUpcomingFallback } from "@/lib/fallback-data";

const HomePage = () => {
  const [activeCategory, setActiveCategory] = useState("Tất cả");
  const [previewEvent, setPreviewEvent] = useState<PosterEventView>();
  const [trustOpen, setTrustOpen] = useState(false);
  const { data, isError, isLoading } = useEventCatalog();

  const catalog =
    data && data.length > 0 ? data : [...homeFeaturedFallback, ...homeUpcomingFallback];
  const posterEvents = toPosterEventViews(catalog);
  const categories = getPosterCategories(posterEvents);
  const filteredEvents =
    activeCategory === "Tất cả"
      ? posterEvents
      : posterEvents.filter((event) => event.category === activeCategory);
  const sections = buildHomeSections(filteredEvents.length > 0 ? filteredEvents : posterEvents);

  return (
    <MobileLayout>
      <header className="sticky safe-area-sticky-top z-40 border-b border-white/10 bg-background/92 backdrop-blur-md">
        <div className="flex items-center justify-between px-4 py-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/40">
              Ticket Platform
            </p>
            <span className="text-2xl font-semibold tracking-[-0.05em]">Entr</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTrustOpen(true)}
              className="inline-flex h-10 w-10 items-center justify-center border border-white/10 bg-white/[0.03] transition-colors hover:bg-white/[0.08]"
              aria-label="Mở giải thích trust"
            >
              <ShieldCheck className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center border border-white/10 bg-white/[0.03] transition-colors hover:bg-white/[0.08]"
              aria-label="Thông báo"
            >
              <Bell className="h-4 w-4" />
            </button>
            <Link
              to="/profile"
              className="inline-flex h-10 w-10 items-center justify-center border border-white/10 bg-white/[0.03] transition-colors hover:bg-white/[0.08]"
              aria-label="Hồ sơ"
            >
              <Settings className="h-4 w-4" />
            </Link>
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto px-4 pb-4 scrollbar-hide">
          {categories.map((category) => (
            <CategoryPill
              key={category}
              name={category}
              active={category === activeCategory}
              onClick={() => setActiveCategory(category)}
            />
          ))}
        </div>
      </header>

      {isError && (
        <div className="mx-4 mt-4 border border-yellow-500/20 bg-yellow-500/10 px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-yellow-100/80">
            event-service chưa sẵn sàng, đang hiển thị poster fallback.
          </p>
        </div>
      )}

      {isLoading ? (
        <section className="space-y-4 px-4 pt-4">
          <div className="min-h-[28rem] animate-pulse border border-white/10 bg-white/[0.04]" />
          <div className="grid grid-cols-2 gap-3">
            <div className="aspect-[4/5] animate-pulse border border-white/10 bg-white/[0.04]" />
            <div className="aspect-[4/5] animate-pulse border border-white/10 bg-white/[0.04]" />
          </div>
        </section>
      ) : (
        <>
          {sections.hero && (
            <PosterSpotlightHero
              event={sections.hero}
              onPreview={setPreviewEvent}
              onTrustOpen={() => setTrustOpen(true)}
            />
          )}

          <EditorialSectionBlock
            label="[ HOT NOW ]"
            title="Poster đang được mở nhiều nhất"
            description="Các event có nhiệt browse cao và trust metadata rõ ràng."
            actionLabel="Mở discover"
            actionHref="/discover"
          >
            <div className="grid grid-cols-2 gap-3">
              {sections.hotNow.map((event, index) => (
                <EventPosterCard
                  key={event.id}
                  event={event}
                  onPreview={setPreviewEvent}
                  className={index === 0 ? "col-span-2" : ""}
                  variant={index === 0 ? "feature" : "default"}
                />
              ))}
            </div>
          </EditorialSectionBlock>

          <EditorialSectionBlock
            label="[ NEAR YOU ]"
            title="Nhịp sự kiện để quyết nhanh"
            description="Gần với cách người dùng browse theo khu vực và những đêm dễ đi."
          >
            <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
              {sections.nearYou.map((event) => (
                <div key={event.id} className="min-w-[17rem] flex-1">
                  <EventPosterCard event={event} onPreview={setPreviewEvent} />
                </div>
              ))}
            </div>
          </EditorialSectionBlock>

          <EditorialSectionBlock
            label="[ EDITOR PICKS ]"
            title="Được sắp đặt để giữ chất ticket platform"
            description="Vẫn image-led, nhưng ưu tiên event có trust story đẹp và dễ ra quyết định."
          >
            <div className="space-y-3">
              {sections.editorPicks.map((event) => (
                <EventPosterCard key={event.id} event={event} onPreview={setPreviewEvent} />
              ))}
            </div>
          </EditorialSectionBlock>

          <EditorialSectionBlock
            label="[ BY MOOD ]"
            title="Browse theo vibe thay vì chỉ theo category"
            description="Giúp Home có nhiều nhịp hơn mà vẫn không bị xa rời logic bán vé."
          >
            <div className="grid grid-cols-2 gap-3">
              {sections.byMood.map((event) => (
                <EventPosterCard key={event.id} event={event} onPreview={setPreviewEvent} />
              ))}
            </div>
          </EditorialSectionBlock>
        </>
      )}

      <QuickPreviewModal
        event={previewEvent}
        open={Boolean(previewEvent)}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewEvent(undefined);
          }
        }}
      />
      <TrustInfoModal open={trustOpen} onOpenChange={setTrustOpen} />
    </MobileLayout>
  );
};

export default HomePage;
