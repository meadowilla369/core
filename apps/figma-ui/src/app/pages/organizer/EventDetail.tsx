import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Users,
  Ticket,
  TrendingUp,
  DollarSign,
  Edit3,
  QrCode,
  Download,
  Share2,
  BarChart2,
  CheckCircle,
  Clock,
  AlertCircle,
  ScanLine,
  RefreshCw,
  Percent,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import { toast } from "sonner";
import { mockEvents, mockEventStats } from "../../lib/mockData";
import { formatCurrency } from "../../lib/utils";

function formatCompact(n: number) {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}

const HOURLY_SALES = [
  { hour: "09:00", count: 12 }, { hour: "10:00", count: 28 }, { hour: "11:00", count: 45 },
  { hour: "12:00", count: 38 }, { hour: "13:00", count: 22 }, { hour: "14:00", count: 56 },
  { hour: "15:00", count: 72 }, { hour: "16:00", count: 89 }, { hour: "17:00", count: 104 },
  { hour: "18:00", count: 65 }, { hour: "19:00", count: 43 }, { hour: "20:00", count: 18 },
];

const DAILY_CHECKINS = [
  { day: "T2", checkin: 0 }, { day: "T3", checkin: 0 }, { day: "T4", checkin: 0 },
  { day: "T5", checkin: 120 }, { day: "T6", checkin: 480 }, { day: "T7", checkin: 850 },
  { day: "CN", checkin: 1450 },
];

const MOCK_CHECKINS = [
  { id: "tkt-001", name: "Nguyễn Văn An", tier: "VIP", time: "18:32", gate: "Cổng A" },
  { id: "tkt-002", name: "Lê Thị Mai", tier: "Hạng A", time: "18:35", gate: "Cổng B" },
  { id: "tkt-003", name: "Phạm Văn Bình", tier: "Hạng A", time: "18:41", gate: "Cổng A" },
  { id: "tkt-004", name: "Trần Quỳnh Anh", tier: "Hạng B", time: "18:48", gate: "Cổng C" },
  { id: "tkt-005", name: "Hoàng Minh Tuấn", tier: "VIP", time: "19:02", gate: "Cổng A" },
  { id: "tkt-006", name: "Nguyễn Thu Hà", tier: "Hạng B", time: "19:08", gate: "Cổng B" },
];

const TABS = ["Tổng quan", "Vé & Check-in", "Resale", "Thống kê"];

export function OrganizerEventDetail() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("Tổng quan");

  // Find event from mock data
  const event = mockEvents.find((e) => e.id === eventId);
  const eventStat = mockEventStats.find((e) => e.id === eventId);

  // Fallback for "new" or unknown IDs
  const displayEvent = event || {
    id: eventId || "evt-001",
    title: "Mỹ Tâm Live in Concert 2026",
    description: "Đêm nhạc đặc biệt kỷ niệm 25 năm ca hát của Mỹ Tâm với những ca khúc bất hủ và nhiều bất ngờ.",
    venue: "Sân vận động Mỹ Đình, Hà Nội",
    date: "2026-04-15T19:00:00",
    imageUrl: "https://images.unsplash.com/photo-1656283384093-1e227e621fad?w=800",
    category: "Âm nhạc",
    organizerId: "org-001",
    organizerName: "VMG Entertainment",
    tickets: [
      { id: "tier-001", name: "VIP", price: 3_500_000, available: 45, total: 200 },
      { id: "tier-002", name: "Hạng A", price: 2_000_000, available: 180, total: 500 },
      { id: "tier-003", name: "Hạng B", price: 1_200_000, available: 320, total: 1000 },
    ],
  };

  const stat = eventStat || {
    ticketsSold: 1450,
    totalTickets: 1700,
    revenue: 248_500_000,
    resaleVolume: 8_200_000,
    occupancy: 85,
    status: "upcoming" as const,
  };

  const totalCheckedIn = 892;
  const checkInPct = Math.round((totalCheckedIn / stat.ticketsSold) * 100);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <Link to="/organizer/events">
                <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center">
                  <ArrowLeft className="w-5 h-5 text-gray-600" />
                </button>
              </Link>
              <div className="min-w-0">
                <h1 className="text-base font-bold text-gray-900 truncate">{displayEvent.title}</h1>
                <p className="text-xs text-gray-500">{displayEvent.organizerName}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => toast.info("Đang làm mới dữ liệu...")}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-500"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                onClick={() => navigate(`/organizer/event/${eventId}/edit`)}
                className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm min-h-[44px]"
              >
                <Edit3 className="w-4 h-4" />
                <span className="hidden sm:inline">Chỉnh sửa</span>
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-0 overflow-x-auto -mb-px">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  activeTab === tab
                    ? "border-orange-500 text-orange-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {activeTab === "Tổng quan" && (
          <div className="space-y-5">
            {/* Event Hero */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <img
                src={displayEvent.imageUrl}
                alt={displayEvent.title}
                className="w-full h-48 object-cover"
              />
              <div className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">{displayEvent.title}</h2>
                    <p className="text-sm text-gray-500 mt-1 leading-relaxed">{displayEvent.description}</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => toast.success("Đã sao chép link chia sẻ")}
                      className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-gray-500"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => toast.info("Đang tải QR...")}
                      className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-gray-500"
                    >
                      <QrCode className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => toast.info("Đang tải báo cáo...")}
                      className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-gray-500"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Calendar className="w-4 h-4 text-orange-500 flex-shrink-0" />
                    {new Date(displayEvent.date).toLocaleDateString("vi-VN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <MapPin className="w-4 h-4 text-rose-500 flex-shrink-0" />
                    {displayEvent.venue}
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <Ticket className="w-4 h-4 text-violet-500 flex-shrink-0" />
                    {displayEvent.tickets.length} hạng vé
                  </div>
                </div>
              </div>
            </div>

            {/* KPI Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { icon: Ticket, label: "Vé đã bán", value: stat.ticketsSold.toLocaleString("vi-VN"), sub: `/ ${stat.totalTickets.toLocaleString("vi-VN")}`, iconBg: "bg-violet-500" },
                { icon: DollarSign, label: "Doanh thu", value: formatCompact(stat.revenue) + " VND", sub: "vé gốc", iconBg: "bg-orange-500" },
                { icon: TrendingUp, label: "Resale volume", value: formatCompact(stat.resaleVolume) + " VND", sub: "5% hoa hồng BTC", iconBg: "bg-emerald-500" },
                { icon: Users, label: "Đã check-in", value: `${totalCheckedIn.toLocaleString("vi-VN")}`, sub: `${checkInPct}% / ${stat.ticketsSold}`, iconBg: "bg-blue-500" },
              ].map((kpi) => (
                <div key={kpi.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <div className={`w-9 h-9 rounded-xl ${kpi.iconBg} flex items-center justify-center mb-3`}>
                    <kpi.icon className="w-4 h-4 text-white" />
                  </div>
                  <div className="text-xl font-bold text-gray-900">{kpi.value}</div>
                  <div className="text-sm text-gray-500">{kpi.label}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{kpi.sub}</div>
                </div>
              ))}
            </div>

            {/* Occupancy progress */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900">Tỷ lệ lấp đầy</h3>
                <span className="text-lg font-bold text-orange-500">{stat.occupancy}%</span>
              </div>
              <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-orange-400 to-orange-600 rounded-full transition-all"
                  style={{ width: `${stat.occupancy}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-400 mt-2">
                <span>{stat.ticketsSold.toLocaleString("vi-VN")} vé đã bán</span>
                <span>{(stat.totalTickets - stat.ticketsSold).toLocaleString("vi-VN")} vé còn lại</span>
              </div>
            </div>

            {/* Hourly Sales Chart */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Lịch sử bán vé theo giờ (hôm nay)</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={HOURLY_SALES} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "#9ca3af" }} />
                  <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} />
                  <Tooltip
                    formatter={(v: number) => [`${v} vé`, "Đã bán"]}
                    contentStyle={{ borderRadius: "12px", fontSize: "12px" }}
                  />
                  <Bar dataKey="count" fill="#f97316" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Ticket Tiers */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Chi tiết hạng vé</h3>
              <div className="space-y-3">
                {displayEvent.tickets.map((tier) => {
                  const sold = tier.total - tier.available;
                  const pct = Math.round((sold / tier.total) * 100);
                  return (
                    <div key={tier.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-xl">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-medium text-gray-900 text-sm">{tier.name}</span>
                          <span className="text-sm text-gray-600">
                            {sold}/{tier.total} · {pct}%
                          </span>
                        </div>
                        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full bg-orange-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          {tier.price.toLocaleString("vi-VN")} VND · {tier.available} còn lại
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {activeTab === "Vé & Check-in" && (
          <div className="space-y-5">
            {/* Check-in Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-center">
                <div className="text-2xl font-bold text-green-600 mb-1">{totalCheckedIn}</div>
                <div className="text-xs text-gray-500">Đã check-in</div>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-center">
                <div className="text-2xl font-bold text-gray-900 mb-1">{stat.ticketsSold - totalCheckedIn}</div>
                <div className="text-xs text-gray-500">Chưa check-in</div>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-center">
                <div className="text-2xl font-bold text-orange-500 mb-1">{checkInPct}%</div>
                <div className="text-xs text-gray-500">Tỷ lệ</div>
              </div>
            </div>

            {/* Check-in timeline chart */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <ScanLine className="w-4 h-4 text-gray-500" />
                Check-in theo ngày (dự phóng)
              </h3>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={DAILY_CHECKINS} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id="checkinGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#9ca3af" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} />
                  <Tooltip contentStyle={{ borderRadius: "12px", fontSize: "12px" }} />
                  <Area type="monotone" dataKey="checkin" stroke="#10b981" strokeWidth={2} fill="url(#checkinGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Recent Check-ins */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Check-in gần đây</h3>
                <button
                  onClick={() => toast.info("Đang tải tất cả...")}
                  className="text-sm text-orange-600 hover:text-orange-700"
                >
                  Xem tất cả
                </button>
              </div>
              <div className="divide-y divide-gray-50">
                {MOCK_CHECKINS.map((ci) => (
                  <div key={ci.id} className="flex items-center gap-4 px-5 py-3.5">
                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900">{ci.name}</div>
                      <div className="text-xs text-gray-500">{ci.tier} · {ci.gate}</div>
                    </div>
                    <div className="text-xs text-gray-400 flex-shrink-0">{ci.time}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "Resale" && (
          <div className="space-y-5">
            {/* Resale Policy Box */}
            <div className="bg-violet-50 border border-violet-200 rounded-2xl p-5">
              <h3 className="font-semibold text-violet-900 mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Chính sách resale đang áp dụng
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-sm text-violet-800">
                {[
                  "Trần giá 120% giá gốc",
                  "Hoa hồng BTC: 5% / giao dịch",
                  "Khóa resale: T-30 phút",
                  "Payout seller: T+1 ngày",
                ].map((rule) => (
                  <div key={rule} className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-violet-600 flex-shrink-0" />
                    {rule}
                  </div>
                ))}
              </div>
            </div>

            {/* Resale KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Listing active", value: "38", color: "text-violet-600" },
                { label: "Đã bán", value: "92", color: "text-green-600" },
                { label: "Volume tổng", value: formatCompact(stat.resaleVolume) + " VND", color: "text-gray-900" },
                { label: "Hoa hồng BTC", value: formatCompact(Math.round(stat.resaleVolume * 0.05)) + " VND", color: "text-orange-500" },
              ].map((s) => (
                <div key={s.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-center">
                  <div className={`text-xl font-bold mb-1 ${s.color}`}>{s.value}</div>
                  <div className="text-xs text-gray-500">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Resale Listings Table */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900">Danh sách resale đang active</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {[
                  { id: "rsl-001", tier: "Hạng A", askPrice: 2_400_000, faceValue: 2_000_000, pct: 120, seller: "Nguyễn V.A.", listedAt: "3 giờ trước" },
                  { id: "rsl-002", tier: "VIP", askPrice: 3_780_000, faceValue: 3_500_000, pct: 108, seller: "Trần T.B.", listedAt: "5 giờ trước" },
                  { id: "rsl-003", tier: "Hạng B", askPrice: 1_320_000, faceValue: 1_200_000, pct: 110, seller: "Lê M.H.", listedAt: "1 ngày trước" },
                  { id: "rsl-004", tier: "Hạng A", askPrice: 2_200_000, faceValue: 2_000_000, pct: 110, seller: "Phạm Q.K.", listedAt: "1 ngày trước" },
                ].map((listing) => (
                  <div key={listing.id} className="flex items-center gap-4 px-5 py-3.5">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900">{listing.tier}</div>
                      <div className="text-xs text-gray-500">Người bán: {listing.seller} · {listing.listedAt}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-gray-900">
                        {listing.askPrice.toLocaleString("vi-VN")} VND
                      </div>
                      <div className={`text-xs ${listing.pct >= 120 ? "text-red-600" : "text-green-600"}`}>
                        {listing.pct}% giá gốc
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "Thống kê" && (
          <div className="space-y-5">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-gray-500" />
                Phân tích doanh thu
              </h3>
              <div className="space-y-4">
                {displayEvent.tickets.map((tier) => {
                  const sold = tier.total - tier.available;
                  const revenue = sold * tier.price;
                  const totalRevenue = stat.revenue;
                  const pct = totalRevenue > 0 ? Math.round((revenue / totalRevenue) * 100) : 0;
                  return (
                    <div key={tier.id}>
                      <div className="flex justify-between text-sm mb-1.5">
                        <span className="text-gray-700">{tier.name}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-gray-500 text-xs">{pct}%</span>
                          <span className="font-semibold text-gray-900">{formatCurrency(revenue)}</span>
                        </div>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-orange-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[
                { label: "AOV (avg. order value)", value: formatCompact(Math.round(stat.revenue / stat.ticketsSold)) + " VND", icon: DollarSign },
                { label: "Conversion rate", value: "34.2%", icon: Percent },
                { label: "Resale penetration", value: "6.3%", icon: TrendingUp },
                { label: "Refund rate", value: "0.8%", icon: AlertCircle },
                { label: "NPS score", value: "72", icon: CheckCircle },
                { label: "Avg. scan time", value: "1.2s", icon: Clock },
              ].map((s) => (
                <div key={s.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <s.icon className="w-4 h-4 text-orange-500 mb-2" />
                  <div className="text-lg font-bold text-gray-900">{s.value}</div>
                  <div className="text-xs text-gray-500">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}