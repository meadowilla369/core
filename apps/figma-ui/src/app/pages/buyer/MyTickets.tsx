import { useEffect, useState } from "react";
import { Link } from "react-router";
import {
  ArrowLeft,
  Ticket as TicketIcon,
  Calendar,
  MapPin,
  QrCode,
  TrendingUp,
  Search
} from "lucide-react";
import { EmptyState } from "../../components/ui/EmptyState";
import { mockTickets } from "../../lib/mockData";
import { formatCurrency, formatShortDate } from "../../lib/utils";
import { Banner } from "../../components/ui/Banner";
import { loadMyTickets } from "../../lib/live-data";
import type { Ticket } from "../../lib/types";

const STATUS_CONFIG = {
  active: { label: "Hợp lệ", color: "text-green-700", bg: "bg-green-100", dot: "bg-green-500" },
  resale: { label: "Đang bán lại", color: "text-orange-700", bg: "bg-orange-100", dot: "bg-orange-400" },
  used: { label: "Đã sử dụng", color: "text-gray-500", bg: "bg-gray-100", dot: "bg-gray-400" },
  expired: { label: "Hết hạn", color: "text-red-600", bg: "bg-red-100", dot: "bg-red-400" }
} as const;

function TicketCard({ ticket }: { ticket: Ticket }) {
  const statusCfg = STATUS_CONFIG[ticket.status];
  const isActive = ticket.status === "active" || ticket.status === "resale";

  return (
    <Link to={`/ticket/${ticket.id}`} className="block group">
      <div className={`bg-white rounded-2xl border overflow-hidden transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 ${isActive ? "border-gray-200" : "border-gray-100 opacity-70"}`}>
        <div className="relative p-4 pb-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${statusCfg.dot}`} />
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusCfg.color} ${statusCfg.bg}`}>
                {statusCfg.label}
              </span>
              <span className="text-xs px-2 py-0.5 bg-violet-100 text-violet-700 rounded-full font-medium">
                {ticket.tierName}
              </span>
            </div>
            <QrCode className="w-5 h-5 text-gray-300 group-hover:text-violet-400 transition-colors" />
          </div>

          <h3 className="font-semibold text-gray-900 text-sm leading-snug mb-3 line-clamp-2">{ticket.eventTitle}</h3>

          <div className="space-y-1.5 mb-4">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Calendar className="w-3.5 h-3.5 flex-shrink-0 text-violet-400" />
              <span>{formatShortDate(ticket.eventDate)}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-violet-400" />
              <span className="line-clamp-1">{ticket.eventVenue}</span>
            </div>
          </div>
        </div>

        <div className="relative mx-0 flex items-center">
          <div className="w-5 h-5 rounded-full bg-gray-50 border-r border-gray-200 -ml-2.5 flex-shrink-0" />
          <div className="flex-1 border-t-2 border-dashed border-gray-100 mx-2" />
          <div className="w-5 h-5 rounded-full bg-gray-50 border-l border-gray-200 -mr-2.5 flex-shrink-0" />
        </div>

        <div className="flex items-center justify-between px-4 py-3 bg-gray-50">
          <div>
            <div className="text-xs text-gray-400 mb-0.5">Giá gốc</div>
            <div className="text-sm font-bold text-gray-900">{formatCurrency(ticket.faceValue)}</div>
          </div>
          {ticket.status === "resale" && (
            <div className="flex items-center gap-1 text-xs text-orange-600 bg-orange-50 px-2.5 py-1.5 rounded-full">
              <TrendingUp className="w-3 h-3" />
              Đang niêm yết
            </div>
          )}
          {ticket.status === "active" && <div className="text-xs text-violet-600 font-medium">Nhấn để xem QR →</div>}
          {(ticket.status === "used" || ticket.status === "expired") && (
            <div className="text-xs text-gray-400">Không còn hiệu lực</div>
          )}
        </div>
      </div>
    </Link>
  );
}

export function MyTickets() {
  const [tickets, setTickets] = useState<Ticket[]>(mockTickets);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    loadMyTickets()
      .then((next) => {
        if (!active) {
          return;
        }

        setTickets(next);
        setLoadError(null);
      })
      .catch((error) => {
        if (!active) {
          return;
        }

        setLoadError(error instanceof Error ? error.message : "Không thể tải vé live.");
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

  const activeTickets = tickets.filter((ticket) => ticket.status === "active" || ticket.status === "resale");
  const usedTickets = tickets.filter((ticket) => ticket.status === "used" || ticket.status === "expired");

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Link
              to="/explore"
              className="p-2 hover:bg-gray-100 rounded-xl transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </Link>
            <div className="flex-1">
              <h1 className="text-base font-bold text-gray-900">Vé của tôi</h1>
              <p className="text-xs text-gray-500">{activeTickets.length} vé hiệu lực</p>
            </div>
            <button className="p-2 hover:bg-gray-100 rounded-xl transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-500">
              <Search className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-8">
        {loadError && <Banner type="warning">{loadError}</Banner>}
        {loading && <div className="text-sm text-gray-500">Đang tải vé từ backend...</div>}

        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">
              Vé đang có
              <span className="ml-2 text-sm font-normal text-gray-400">({activeTickets.length})</span>
            </h2>
            <Link to="/explore">
              <button className="text-xs text-violet-600 hover:text-violet-700 font-medium px-3 py-1.5 hover:bg-violet-50 rounded-lg transition-colors">
                + Mua thêm vé
              </button>
            </Link>
          </div>

          {activeTickets.length > 0 ? (
            <div className="space-y-4">
              {activeTickets.map((ticket) => (
                <TicketCard key={ticket.id} ticket={ticket} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<TicketIcon />}
              title="Chưa có vé nào"
              description="Khám phá các sự kiện và mua vé ngay"
              action={
                <Link to="/explore">
                  <button className="px-4 py-2.5 bg-violet-600 text-white rounded-xl hover:bg-violet-700 transition-colors min-h-[44px] text-sm font-medium">
                    Khám phá sự kiện
                  </button>
                </Link>
              }
            />
          )}
        </div>

        {usedTickets.length > 0 && (
          <div>
            <h2 className="font-semibold text-gray-900 mb-4">
              Đã sử dụng
              <span className="ml-2 text-sm font-normal text-gray-400">({usedTickets.length})</span>
            </h2>
            <div className="space-y-3">
              {usedTickets.map((ticket) => (
                <TicketCard key={ticket.id} ticket={ticket} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
