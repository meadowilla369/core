import { useDeferredValue, useState } from "react";
import { Search, X } from "lucide-react";
import { useSearchParams } from "react-router-dom";

import CategoryPill from "@/components/mobile/CategoryPill";
import DiscoverFilterSheet from "@/components/mobile/DiscoverFilterSheet";
import EditorialSectionBlock from "@/components/mobile/EditorialSectionBlock";
import EventPosterCard from "@/components/mobile/EventPosterCard";
import MobileLayout from "@/components/mobile/MobileLayout";
import QuickPreviewModal from "@/components/mobile/QuickPreviewModal";
import {
  filterPosterEvents,
  getPosterCategories,
  getPosterMoods,
  toPosterEventViews,
  type PosterEventView
} from "@/features/discover/event-posters";
import { useEventCatalog } from "@/hooks/use-events";
import { discoverFallback } from "@/lib/fallback-data";

const DiscoverPage = () => {
  const [searchParams] = useSearchParams();
  const initialCategory = searchParams.get("category");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState(initialCategory ?? "Tất cả");
  const [activeMood, setActiveMood] = useState("Tất cả");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [budgetOnly, setBudgetOnly] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [previewEvent, setPreviewEvent] = useState<PosterEventView>();
  const deferredQuery = useDeferredValue(searchQuery);
  const { data, isError, isLoading } = useEventCatalog();

  const catalog = data && data.length > 0 ? data : discoverFallback;
  const posterEvents = toPosterEventViews(catalog);
  const categories = getPosterCategories(posterEvents);
  const moods = getPosterMoods(posterEvents);
  const selectedCategory =
    categories.find((category) => category.toLowerCase() === activeCategory.toLowerCase()) ??
    activeCategory;
  const filteredEvents = filterPosterEvents(posterEvents, {
    query: deferredQuery,
    category: selectedCategory,
    mood: activeMood,
    verifiedOnly,
    budgetOnly
  });

  const featuredEvent = filteredEvents[0];
  const secondaryEvents = filteredEvents.slice(1);

  return (
    <MobileLayout>
      <header className="sticky top-0 z-40 border-b border-white/10 bg-background/92 backdrop-blur-md">
        <div className="border-b border-white/10 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/38" />
              <input
                type="text"
                placeholder="Tim event, nghe si, dia diem..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="h-12 w-full border border-white/10 bg-white/[0.03] pl-10 pr-10 font-mono text-sm text-foreground outline-none transition-colors placeholder:text-foreground/28 focus:border-white/20"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/38 transition-colors hover:text-foreground"
                  aria-label="Xóa tìm kiếm"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <DiscoverFilterSheet
              open={filterOpen}
              onOpenChange={setFilterOpen}
              categories={categories}
              moods={moods}
              filters={{
                query: searchQuery,
                category: selectedCategory,
                mood: activeMood,
                verifiedOnly,
                budgetOnly
              }}
              onCategoryChange={setActiveCategory}
              onMoodChange={setActiveMood}
              onVerifiedToggle={() => setVerifiedOnly((current) => !current)}
              onBudgetToggle={() => setBudgetOnly((current) => !current)}
              onReset={() => {
                setActiveCategory("Tất cả");
                setActiveMood("Tất cả");
                setVerifiedOnly(false);
                setBudgetOnly(false);
              }}
            />
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto px-4 py-3 scrollbar-hide">
          {categories.map((category) => (
            <CategoryPill
              key={category}
              name={category}
              active={selectedCategory === category}
              onClick={() => setActiveCategory(category)}
            />
          ))}
        </div>

        <div className="flex gap-2 overflow-x-auto border-t border-white/10 px-4 py-3 scrollbar-hide">
          {moods.map((mood) => (
            <button
              key={mood}
              type="button"
              onClick={() => setActiveMood(mood)}
              className={`whitespace-nowrap rounded-full border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] transition-colors ${
                activeMood === mood
                  ? "border-white/20 bg-white text-black"
                  : "border-white/10 bg-white/[0.03] text-foreground/68 hover:bg-white/[0.08] hover:text-foreground"
              }`}
            >
              {mood}
            </button>
          ))}
        </div>
      </header>

      {isError && (
        <div className="mx-4 mt-4 border border-yellow-500/20 bg-yellow-500/10 px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-yellow-100/80">
            discover dang dung fallback data nhung van giu poster feed day du.
          </p>
        </div>
      )}

      <div className="border-b border-white/10 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-foreground/45">
            {filteredEvents.length} ket qua
          </span>
          <div className="flex flex-wrap justify-end gap-2">
            {verifiedOnly && (
              <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-foreground/60">
                Verified
              </span>
            )}
            {budgetOnly && (
              <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-foreground/60">
                Duoi 1M
              </span>
            )}
          </div>
        </div>
      </div>

      {isLoading ? (
        <section className="space-y-4 px-4 py-4">
          <div className="min-h-[24rem] animate-pulse border border-white/10 bg-white/[0.04]" />
          <div className="grid grid-cols-2 gap-3">
            <div className="aspect-[4/5] animate-pulse border border-white/10 bg-white/[0.04]" />
            <div className="aspect-[4/5] animate-pulse border border-white/10 bg-white/[0.04]" />
          </div>
        </section>
      ) : filteredEvents.length > 0 ? (
        <>
          {featuredEvent && (
            <EditorialSectionBlock
              label="[ DISCOVER ]"
              title="Poster mosaic, nhung van giu trust layer ro rang"
              description="Feed duoc sap xep de nhin nhu mot mat bang kham pha event thuc su."
            >
              <div className="grid grid-cols-2 gap-3">
                <EventPosterCard
                  event={featuredEvent}
                  onPreview={setPreviewEvent}
                  variant="feature"
                  className="col-span-2"
                />
                {secondaryEvents.map((event, index) => (
                  <EventPosterCard
                    key={event.id}
                    event={event}
                    onPreview={setPreviewEvent}
                    className={index % 5 === 2 ? "col-span-2" : ""}
                  />
                ))}
              </div>
            </EditorialSectionBlock>
          )}
        </>
      ) : (
        <section className="px-4 py-16 text-center">
          <div className="border border-white/10 bg-white/[0.03] px-6 py-10">
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-foreground/42">
              Empty discover
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight">
              Khong co event nao khop bo loc hien tai
            </h2>
            <p className="mx-auto mt-3 max-w-[20rem] text-sm text-foreground/58">
              Thu bo verified-only, doi mood, hoac xoa query de quay lai feed chinh.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setActiveCategory("Tất cả");
                setActiveMood("Tất cả");
                setVerifiedOnly(false);
                setBudgetOnly(false);
              }}
              className="mt-5 inline-flex border border-white/10 bg-white px-4 py-3 font-mono text-[10px] uppercase tracking-[0.18em] text-black transition-colors hover:bg-white/88"
            >
              Xoa bo loc
            </button>
          </div>
        </section>
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
    </MobileLayout>
  );
};

export default DiscoverPage;
