import { useState } from "react";
import { Bell, Settings } from "lucide-react";
import { Link } from "react-router-dom";
import MobileLayout from "@/components/mobile/MobileLayout";
import EventCard from "@/components/mobile/EventCard";
import CategoryPill from "@/components/mobile/CategoryPill";
import { homeFeaturedFallback, homeUpcomingFallback } from "@/lib/fallback-data";
import { useEventCatalog } from "@/hooks/use-events";

const HomePage = () => {
  const [activeCategory, setActiveCategory] = useState("Tất cả");
  const { data, isError, isLoading } = useEventCatalog();
  const catalog =
    data && data.length > 0 ? data : [...homeFeaturedFallback, ...homeUpcomingFallback];
  const categories = ["Tất cả", ...Array.from(new Set(catalog.map((item) => item.category)))];
  const filteredCatalog =
    activeCategory === "Tất cả"
      ? catalog
      : catalog.filter((item) => item.category.toLowerCase() === activeCategory.toLowerCase());
  const featuredEvents = filteredCatalog.slice(0, 4);
  const upcomingEvents = filteredCatalog.slice(4);
  const trendingCategories = Array.from(
    filteredCatalog.reduce((map, item) => {
      map.set(item.category, (map.get(item.category) ?? 0) + 1);
      return map;
    }, new Map<string, number>())
  ).slice(0, 4);

  return (
    <MobileLayout>
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-foreground/10">
        <div className="flex items-center justify-between p-4">
          <div>
            <span className="text-2xl font-medium tracking-tighter">Entr</span>
          </div>
          <div className="flex items-center gap-3">
            <button className="w-10 h-10 flex items-center justify-center border border-foreground/20 hover:bg-foreground/10 transition-colors">
              <Bell className="w-4 h-4" />
            </button>
            <Link
              to="/profile"
              className="w-10 h-10 flex items-center justify-center border border-foreground/20 hover:bg-foreground/10 transition-colors"
            >
              <Settings className="w-4 h-4" />
            </Link>
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
            Không tải được event-service. Đang hiển thị dữ liệu fallback.
          </p>
        </div>
      )}

      {/* Featured Section */}
      <section className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-mono text-xs tracking-widest text-foreground/60">[ NỔI BẬT ]</h2>
          <Link
            to="/discover"
            className="font-mono text-[10px] tracking-wider text-foreground/40 hover:text-foreground transition-colors"
          >
            XEM TẤT CẢ →
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {featuredEvents.map((event) => (
            <EventCard key={event.id} {...event} featured />
          ))}
        </div>

        {isLoading && (
          <p className="mt-3 font-mono text-[10px] text-foreground/40">Đang đồng bộ sự kiện...</p>
        )}
      </section>

      {/* Upcoming Section */}
      <section className="mt-6">
        <div className="flex items-center justify-between px-4 mb-2">
          <h2 className="font-mono text-xs tracking-widest text-foreground/60">[ SẮP DIỄN RA ]</h2>
        </div>

        <div className="divide-y divide-foreground/10">
          {upcomingEvents.map((event) => (
            <EventCard key={event.id} {...event} />
          ))}
        </div>
      </section>

      {/* Trending Categories */}
      <section className="p-4 mt-6">
        <h2 className="font-mono text-xs tracking-widest text-foreground/60 mb-4">[ XU HƯỚNG ]</h2>
        <div className="grid grid-cols-2 gap-3">
          {trendingCategories.map(([name, count]) => (
            <Link
              key={name}
              to={`/discover?category=${name.toLowerCase()}`}
              className="group aspect-[2/1] border border-foreground/20 p-4 flex flex-col justify-end hover:bg-foreground hover:text-background transition-colors"
            >
              <span className="text-xl font-medium tracking-tight">{name}</span>
              <span className="font-mono text-[10px] text-foreground/50 group-hover:text-background/50 mt-1">
                {count} sự kiện
              </span>
            </Link>
          ))}
        </div>
      </section>
    </MobileLayout>
  );
};

export default HomePage;
