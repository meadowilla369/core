import { useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import MobileLayout from "@/components/mobile/MobileLayout";
import EventCard from "@/components/mobile/EventCard";
import CategoryPill from "@/components/mobile/CategoryPill";
import { discoverFallback } from "@/lib/fallback-data";
import { useEventCatalog } from "@/hooks/use-events";

const DiscoverPage = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("Tất cả");
  const [showFilters, setShowFilters] = useState(false);
  const { data, isError } = useEventCatalog();
  const allEvents = data && data.length > 0 ? data : discoverFallback;
  const categories = ["Tất cả", ...Array.from(new Set(allEvents.map((item) => item.category)))];

  const filteredEvents = allEvents.filter((event) => {
    const matchesSearch = event.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      activeCategory === "Tất cả" || event.category.toLowerCase() === activeCategory.toLowerCase();
    return matchesSearch && matchesCategory;
  });

  return (
    <MobileLayout>
      {/* Search Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-foreground/10">
        <div className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" />
              <input
                type="text"
                placeholder="Tìm kiếm sự kiện..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-muted/50 border border-foreground/20 pl-10 pr-4 py-3 font-mono text-sm placeholder:text-foreground/30 focus:outline-none focus:border-foreground/50 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  <X className="w-4 h-4 text-foreground/40" />
                </button>
              )}
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`w-12 h-12 flex items-center justify-center border transition-colors ${
                showFilters
                  ? "bg-foreground text-background border-foreground"
                  : "border-foreground/20 hover:bg-foreground/10"
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Categories */}
        <div className="flex gap-2 px-4 pb-4 overflow-x-auto scrollbar-hide">
          {categories.map((cat) => (
            <CategoryPill
              key={cat}
              name={cat}
              active={activeCategory === cat}
              onClick={() => setActiveCategory(cat)}
            />
          ))}
        </div>
      </header>

      {isError && (
        <div className="px-4 py-3 border-b border-yellow-500/30 bg-yellow-500/10">
          <p className="font-mono text-[10px] text-yellow-200">
            Discover đang dùng fallback vì event-service chưa phản hồi.
          </p>
        </div>
      )}

      {/* Results Count */}
      <div className="px-4 py-3 border-b border-foreground/10">
        <span className="font-mono text-xs text-foreground/50">
          TÌM THẤY {filteredEvents.length} SỰ KIỆN
        </span>
      </div>

      {/* Results Grid */}
      <section className="p-4">
        <div className="grid grid-cols-2 gap-3">
          {filteredEvents.map((event) => (
            <EventCard key={event.id} {...event} featured />
          ))}
        </div>

        {filteredEvents.length === 0 && (
          <div className="py-16 text-center">
            <p className="font-mono text-foreground/40">Không tìm thấy sự kiện</p>
            <button
              onClick={() => {
                setSearchQuery("");
                setActiveCategory("Tất cả");
              }}
              className="mt-4 font-mono text-xs underline"
            >
              Xóa bộ lọc
            </button>
          </div>
        )}
      </section>
    </MobileLayout>
  );
};

export default DiscoverPage;
