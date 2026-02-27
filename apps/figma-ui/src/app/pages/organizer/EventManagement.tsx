import { useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  ArrowLeft,
  Plus,
  Search,
  Calendar,
  Eye,
  Edit3,
  Copy,
  Trash2,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { mockEventStats } from "../../lib/mockData";

const EXTENDED_EVENTS = [
  ...mockEventStats,
  {
    id: "evt-new-001",
    title: "Đêm nhạc Jazz Hà Nội 2026",
    date: "05/05/2026",
    status: "upcoming" as const,
    ticketsSold: 0,
    totalTickets: 300,
    revenue: 0,
    resaleVolume: 0,
    occupancy: 0,
  },
];

const STATUS_CONFIG = {
  upcoming: { label: "Sắp diễn ra", Icon: Clock, color: "text-blue-600", bg: "bg-blue-50", badge: "bg-blue-100 text-blue-700" },
  ongoing: { label: "Đang diễn ra", Icon: CheckCircle, color: "text-green-600", bg: "bg-green-50", badge: "bg-green-100 text-green-700" },
  completed: { label: "Đã kết thúc", Icon: CheckCircle, color: "text-gray-500", bg: "bg-gray-50", badge: "bg-gray-100 text-gray-600" },
  cancelled: { label: "Đã hủy", Icon: XCircle, color: "text-red-600", bg: "bg-red-50", badge: "bg-red-100 text-red-700" },
};

type FilterStatus = "all" | "upcoming" | "ongoing" | "completed" | "cancelled";

function formatCompactLocal(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}

export function OrganizerEventManagement() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterStatus>("all");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const filtered = EXTENDED_EVENTS.filter((e) => {
    const matchSearch = !search || e.title.toLowerCase().includes(search.toLowerCase());
    const matchStatus = activeFilter === "all" || e.status === activeFilter;
    return matchSearch && matchStatus;
  });

  const totalRevenue = EXTENDED_EVENTS.reduce((s, e) => s + e.revenue, 0);
  const totalTickets = EXTENDED_EVENTS.reduce((s, e) => s + e.ticketsSold, 0);

  const FILTER_TABS: { id: FilterStatus; label: string }[] = [
    { id: "all", label: "Tất cả" },
    { id: "upcoming", label: "Sắp diễn ra" },
    { id: "ongoing", label: "Đang diễn ra" },
    { id: "completed", label: "Đã kết thúc" },
    { id: "cancelled", label: "Đã hủy" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <Link to="/organizer/dashboard">
                <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center">
                  <ArrowLeft className="w-5 h-5 text-gray-600" />
                </button>
              </Link>
              <div>
                <h1 className="text-base font-bold text-gray-900">Quản lý sự kiện</h1>
                <p className="text-xs text-gray-500">VMG Entertainment · {EXTENDED_EVENTS.length} sự kiện</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => toast.info("Chức năng xuất chưa khả dụng trong demo")}
                className="hidden sm:flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm min-h-[44px]"
              >
                <Download className="w-4 h-4" />
                Xuất
              </button>
              <Link to="/organizer/event/new">
                <button className="flex items-center gap-1.5 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-medium transition-colors min-h-[44px]">
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">Tạo sự kiện</span>
                  <span className="sm:hidden">Tạo</span>
                </button>
              </Link>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm tên sự kiện..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 min-h-[44px] rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-orange-400 focus:ring-2 focus:ring-orange-100 focus:outline-none transition-all text-sm"
            />
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-0 overflow-x-auto -mb-px">
            {FILTER_TABS.map((tab) => {
              const count = tab.id === "all"
                ? EXTENDED_EVENTS.length
                : EXTENDED_EVENTS.filter((e) => e.status === tab.id).length;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveFilter(tab.id)}
                  className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                    activeFilter === tab.id
                      ? "border-orange-500 text-orange-600"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tab.label}
                  {count > 0 && (
                    <span className={`px-1.5 py-0.5 rounded-full text-xs ${activeFilter === tab.id ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-500"}`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* KPI Row */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
            <div className="text-xl font-bold text-orange-500">{EXTENDED_EVENTS.length}</div>
            <div className="text-xs text-gray-500">Tổng sự kiện</div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
            <div className="text-xl font-bold text-gray-900">{totalTickets.toLocaleString("vi-VN")}</div>
            <div className="text-xs text-gray-500">Vé đã bán</div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
            <div className="text-xl font-bold text-green-600">{formatCompactLocal(totalRevenue)}</div>
            <div className="text-xs text-gray-500">VND doanh thu</div>
          </div>
        </div>

        {/* Events List */}
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
            <AlertCircle className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <div className="font-medium text-gray-600">Không có sự kiện nào</div>
            <div className="text-sm text-gray-400 mt-1">Tạo sự kiện mới để bắt đầu</div>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden sm:block bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-5 py-3.5 text-xs font-medium text-gray-500 uppercase">Sự kiện</th>
                    <th className="text-center px-4 py-3.5 text-xs font-medium text-gray-500 uppercase">Trạng thái</th>
                    <th className="text-right px-4 py-3.5 text-xs font-medium text-gray-500 uppercase">Vé</th>
                    <th className="text-right px-4 py-3.5 text-xs font-medium text-gray-500 uppercase">Lấp đầy</th>
                    <th className="text-right px-4 py-3.5 text-xs font-medium text-gray-500 uppercase">Doanh thu</th>
                    <th className="px-4 py-3.5 text-xs font-medium text-gray-500 uppercase text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((event) => {
                    const cfg = STATUS_CONFIG[event.status];
                    const StatusIcon = cfg.Icon;
                    return (
                      <tr key={event.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-4">
                          <div className="font-medium text-gray-900 text-sm">{event.title}</div>
                          <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                            <Calendar className="w-3 h-3" />
                            {event.date}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.badge}`}>
                            <StatusIcon className="w-3 h-3" />
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <div className="text-sm font-medium text-gray-900">{event.ticketsSold.toLocaleString("vi-VN")}</div>
                          <div className="text-xs text-gray-400">/ {event.totalTickets.toLocaleString("vi-VN")}</div>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-14 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-orange-500 rounded-full" style={{ width: `${event.occupancy}%` }} />
                            </div>
                            <span className="text-sm text-gray-600">{event.occupancy}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <div className="text-sm font-medium text-gray-900">
                            {event.revenue > 0 ? `${formatCompactLocal(event.revenue)} VND` : "—"}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => navigate(`/organizer/event/${event.id}`)}
                              className="p-2 hover:bg-blue-50 rounded-lg transition-colors text-gray-400 hover:text-blue-600"
                              title="Xem chi tiết"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => navigate(`/organizer/event/${event.id}/edit`)}
                              className="p-2 hover:bg-orange-50 rounded-lg transition-colors text-gray-400 hover:text-orange-600"
                              title="Chỉnh sửa"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => toast.success("Đã sao chép sự kiện")}
                              className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-600"
                              title="Sao chép"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                            {event.status !== "completed" && (
                              <div className="relative">
                                {showDeleteConfirm === event.id ? (
                                  <div className="absolute right-0 top-full mt-1 bg-white border border-red-200 rounded-xl shadow-xl z-10 p-3 w-48">
                                    <p className="text-xs text-gray-700 mb-2">Xác nhận xóa sự kiện này?</p>
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => { toast.error("Đã xóa sự kiện"); setShowDeleteConfirm(null); }}
                                        className="flex-1 py-1.5 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700"
                                      >Xóa</button>
                                      <button
                                        onClick={() => setShowDeleteConfirm(null)}
                                        className="px-2 py-1.5 border border-gray-200 text-gray-600 text-xs rounded-lg"
                                      >Hủy</button>
                                    </div>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setShowDeleteConfirm(event.id)}
                                    className="p-2 hover:bg-red-50 rounded-lg transition-colors text-gray-400 hover:text-red-600"
                                    title="Xóa"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="sm:hidden space-y-3">
              {filtered.map((event) => {
                const cfg = STATUS_CONFIG[event.status];
                const StatusIcon = cfg.Icon;
                return (
                  <div
                    key={event.id}
                    className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4"
                    onClick={() => navigate(`/organizer/event/${event.id}`)}
                  >
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <h3 className="font-medium text-gray-900 text-sm flex-1 leading-snug">{event.title}</h3>
                      <span className={`flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${cfg.badge}`}>
                        <StatusIcon className="w-3 h-3" />
                        {cfg.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-500 mb-3">
                      <Calendar className="w-3 h-3" />
                      {event.date}
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div>
                        <div className="text-sm font-bold text-gray-900">{event.occupancy}%</div>
                        <div className="text-xs text-gray-500">Lấp đầy</div>
                      </div>
                      <div>
                        <div className="text-sm font-bold text-gray-900">{event.ticketsSold}</div>
                        <div className="text-xs text-gray-500">Vé bán</div>
                      </div>
                      <div>
                        <div className="text-sm font-bold text-orange-500">
                          {event.revenue > 0 ? formatCompactLocal(event.revenue) : "—"}
                        </div>
                        <div className="text-xs text-gray-500">VND</div>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/organizer/event/${event.id}/edit`); }}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-gray-200 text-gray-700 rounded-lg text-xs hover:bg-gray-50 transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        Chỉnh sửa
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/organizer/event/${event.id}`); }}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-orange-50 border border-orange-200 text-orange-700 rounded-lg text-xs hover:bg-orange-100 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Chi tiết
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}