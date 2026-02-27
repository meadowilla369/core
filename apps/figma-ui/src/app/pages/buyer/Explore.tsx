import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Search, Ticket as TicketIcon, Home, Filter, SlidersHorizontal, MapPin, Calendar, Tag } from "lucide-react";
import { mockEvents } from "../../lib/mockData";
import { formatCurrency, formatShortDate } from "../../lib/utils";
import { EmptyState } from "../../components/ui/EmptyState";
import { Banner } from "../../components/ui/Banner";
import { loadExploreEvents } from "../../lib/live-data";
import type { Event } from "../../lib/types";

const CATEGORIES = [
  { id: "all", label: "Tất cả", emoji: "🎪" },
  { id: "Âm nhạc", label: "Âm nhạc", emoji: "🎵" },
  { id: "Sân khấu", label: "Sân khấu", emoji: "🎭" },
  { id: "Thể thao", label: "Thể thao", emoji: "⚽" },
  { id: "Giải trí", label: "Giải trí", emoji: "🎤" },
  { id: "Lễ hội", label: "Lễ hội", emoji: "🎉" },
  { id: "Hội thảo", label: "Hội thảo", emoji: "💼" },
];

function EventCard({ event }: { event: Event }) {
  const minPrice = Math.min(...event.tickets.map((t) => t.price));
  const hasAvailable = event.tickets.some((t) => t.available > 0);
  const totalAvailable = event.tickets.reduce((s, t) => s + t.available, 0);

  return (
    <Link to={`/event/${event.id}`} className="group block">
      <div className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border border-gray-100">
        <div className="relative aspect-[16/9] overflow-hidden">
          <img
            src={event.imageUrl}
            alt={event.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          {/* Category badge */}
          <div className="absolute top-3 left-3">
            <span className="px-2.5 py-1 bg-white/95 backdrop-blur-sm text-gray-800 text-xs font-medium rounded-full">
              {event.category}
            </span>
          </div>
          {/* Availability */}
          {!hasAvailable && (
            <div className="absolute top-3 right-3">
              <span className="px-2.5 py-1 bg-red-600 text-white text-xs font-medium rounded-full">
                Hết vé
              </span>
            </div>
          )}
          {hasAvailable && totalAvailable < 50 && (
            <div className="absolute top-3 right-3">
              <span className="px-2.5 py-1 bg-orange-500 text-white text-xs font-medium rounded-full">
                Còn {totalAvailable} vé
              </span>
            </div>
          )}
          {/* Resale badge */}
          <div className="absolute bottom-3 left-3">
            <span className="px-2 py-0.5 bg-violet-600/90 text-white text-xs rounded-full">
              Có vé resale
            </span>
          </div>
        </div>

        <div className="p-4">
          <h3 className="font-semibold text-gray-900 text-sm leading-snug mb-2 line-clamp-2 group-hover:text-violet-700 transition-colors">
            {event.title}
          </h3>

          <div className="space-y-1.5 mb-3">
            <div className="flex items-center gap-1.5 text-gray-500 text-xs">
              <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{formatShortDate(event.date)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-gray-500 text-xs">
              <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{event.venue}</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-gray-100">
            <div>
              <div className="text-xs text-gray-400">Từ</div>
              <div className="font-bold text-gray-900">
                {formatCurrency(minPrice)}
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs text-violet-600 bg-violet-50 px-2.5 py-1.5 rounded-full">
              <Tag className="w-3 h-3" />
              {event.tickets.length} loại vé
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

export function BuyerExplore() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [events, setEvents] = useState<Event[]>(mockEvents);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    loadExploreEvents()
      .then((next) => {
        if (!active) {
          return;
        }

        setEvents(next);
        setLoadError(null);
      })
      .catch((error) => {
        if (!active) {
          return;
        }

        setLoadError(error instanceof Error ? error.message : "Không thể tải dữ liệu live, dùng dữ liệu mock.");
      })
      .finally(() => {
        if (!active) {
          return;
        }

        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const filteredEvents = events.filter((event) => {
    const matchesSearch =
      searchQuery === "" ||
      event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.venue.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === "all" || event.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <Link
                to="/"
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                <Home className="w-5 h-5 text-gray-600" />
              </Link>
              <div>
                <h1 className="text-base font-bold text-gray-900">Khám phá sự kiện</h1>
                <p className="text-xs text-gray-500">{filteredEvents.length} sự kiện</p>
              </div>
            </div>
            <Link
              to="/tickets"
              className="relative p-2 hover:bg-gray-100 rounded-xl transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              <TicketIcon className="w-5 h-5 text-gray-700" />
              <span className="absolute top-1 right-1 w-4 h-4 bg-violet-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                3
              </span>
            </Link>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm kiếm sự kiện, địa điểm..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 min-h-[44px] rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-violet-400 focus:ring-2 focus:ring-violet-100 focus:outline-none transition-all text-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Category tabs */}
        <div className="max-w-7xl mx-auto px-4 pb-3">
          <div className="flex gap-2 overflow-x-auto pb-0 scrollbar-hide">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm whitespace-nowrap transition-all min-h-[36px] flex-shrink-0 ${
                  selectedCategory === cat.id
                    ? "bg-violet-600 text-white shadow-md shadow-violet-200"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                <span>{cat.emoji}</span>
                <span className="font-medium">{cat.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Featured Banner */}
      {selectedCategory === "all" && !searchQuery && (
        <div className="max-w-7xl mx-auto px-4 pt-5">
          <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-violet-600 to-indigo-700 p-5 sm:p-7 mb-6">
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2.5 py-1 bg-white/20 text-white text-xs rounded-full">
                  🔥 Nổi bật
                </span>
              </div>
              <h2 className="text-white text-xl sm:text-2xl font-bold mb-1">
                Mỹ Tâm Live in Concert 2026
              </h2>
              <p className="text-white/70 text-sm mb-4">
                15/04/2026 · Sân vận động Mỹ Đình, Hà Nội
              </p>
              <Link to="/event/evt-001">
                <button className="px-5 py-2.5 bg-white text-violet-700 rounded-xl font-medium text-sm hover:bg-gray-50 transition-colors min-h-[44px]">
                  Xem & đặt vé →
                </button>
              </Link>
            </div>
            <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-indigo-900/40 to-transparent pointer-events-none" />
          </div>
        </div>
      )}

      {/* Events Grid */}
      <div className="max-w-7xl mx-auto px-4 py-4 pb-10">
        {loadError && (
          <Banner type="warning" className="mb-4">
            {loadError}
          </Banner>
        )}

        {loading && (
          <div className="text-sm text-gray-500 mb-4">Đang tải sự kiện từ backend...</div>
        )}

        {filteredEvents.length > 0 ? (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium text-gray-600">
                {selectedCategory === "all" ? "Tất cả sự kiện" : selectedCategory}
                {" "}({filteredEvents.length})
              </h2>
              <button className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 px-3 py-2 hover:bg-white rounded-xl transition-colors min-h-[36px]">
                <SlidersHorizontal className="w-4 h-4" />
                Sắp xếp
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredEvents.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          </>
        ) : (
          <EmptyState
            icon={<Filter />}
            title="Không tìm thấy sự kiện"
            description="Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm"
          />
        )}
      </div>
    </div>
  );
}
