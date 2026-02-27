import { useEffect, useState } from "react";
import { Link } from "react-router";
import {
  ArrowLeft,
  TrendingUp,
  Ticket,
  Users,
  DollarSign,
  BarChart2,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Filter,
  Download,
  Eye,
  CheckCircle,
  Clock,
  XCircle,
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
  Legend,
} from "recharts";
import { mockOrganizerStats, mockDailyRevenue, mockEventStats } from "../../lib/mockData";
import { formatCurrency } from "../../lib/utils";
import { Banner } from "../../components/ui/Banner";
import { loadOrganizerDashboardData } from "../../lib/live-data";

const TABS = ["Tổng quan", "Sự kiện", "Resale", "Giao dịch"];

function formatCompact(n: number) {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}

function StatCard({
  title,
  value,
  change,
  positive,
  icon: Icon,
  iconBg,
  sub,
}: {
  title: string;
  value: string;
  change?: string;
  positive?: boolean;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  sub?: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        {change && (
          <div
            className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
              positive
                ? "bg-green-100 text-green-700"
                : "bg-red-100 text-red-700"
            }`}
          >
            {positive ? (
              <ArrowUpRight className="w-3.5 h-3.5" />
            ) : (
              <ArrowDownRight className="w-3.5 h-3.5" />
            )}
            {change}
          </div>
        )}
      </div>
      <div className="text-2xl font-bold text-gray-900 mb-0.5">{value}</div>
      <div className="text-sm text-gray-500">{title}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

export function OrganizerDashboard() {
  const [activeTab, setActiveTab] = useState("Tổng quan");
  const [chartType, setChartType] = useState<"area" | "bar">("area");
  const [stats, setStats] = useState(mockOrganizerStats);
  const [dailyRevenue, setDailyRevenue] = useState(mockDailyRevenue);
  const [eventStats, setEventStats] = useState(mockEventStats);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    loadOrganizerDashboardData()
      .then((payload) => {
        if (!active) {
          return;
        }

        setStats(payload.organizerStats);
        setDailyRevenue(payload.dailyRevenue);
        setEventStats(payload.eventStats);
        setLoadError(null);
      })
      .catch((error) => {
        if (!active) {
          return;
        }

        setLoadError(error instanceof Error ? error.message : "Không thể tải dashboard từ backend.");
      });

    return () => {
      active = false;
    };
  }, []);

  const statusEventConfig = {
    upcoming: { label: "Sắp diễn ra", Icon: Clock, color: "text-blue-600", bg: "bg-blue-50" },
    ongoing: { label: "Đang diễn ra", Icon: CheckCircle, color: "text-green-600", bg: "bg-green-50" },
    completed: { label: "Đã kết thúc", Icon: CheckCircle, color: "text-gray-600", bg: "bg-gray-50" },
    cancelled: { label: "Đã hủy", Icon: XCircle, color: "text-red-600", bg: "bg-red-50" },
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <Link to="/">
                <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center">
                  <ArrowLeft className="w-5 h-5 text-gray-600" />
                </button>
              </Link>
              <div>
                <h1 className="text-base font-bold text-gray-900">Dashboard Ban Tổ Chức</h1>
                <p className="text-xs text-gray-500">VMG Entertainment · Cập nhật: vừa xong</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-600">
                <RefreshCw className="w-4 h-4" />
              </button>
              <Link to="/organizer/events">
                <button className="hidden sm:flex items-center gap-1.5 px-3 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors text-sm min-h-[44px]">
                  <Calendar className="w-4 h-4" />
                  Sự kiện
                </button>
              </Link>
              <button className="hidden sm:flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm min-h-[44px]">
                <Download className="w-4 h-4" />
                Xuất báo cáo
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-0 -mb-px overflow-x-auto">
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {loadError && (
          <Banner type="warning" className="mb-5">
            {loadError}
          </Banner>
        )}

        {activeTab === "Tổng quan" && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title="Tổng doanh thu"
                value={formatCompact(stats.totalRevenue) + " VND"}
                change="+18.4%"
                positive={true}
                icon={DollarSign}
                iconBg="bg-orange-500"
                sub="so với tháng trước"
              />
              <StatCard
                title="Vé đã bán"
                value={stats.totalTicketsSold.toLocaleString("vi-VN")}
                change="+12.1%"
                positive={true}
                icon={Ticket}
                iconBg="bg-violet-600"
                sub={`${stats.activeEvents} sự kiện`}
              />
              <StatCard
                title="Người tham dự"
                value={stats.totalAttendees.toLocaleString("vi-VN")}
                change="-2.3%"
                positive={false}
                icon={Users}
                iconBg="bg-blue-500"
                sub={`Tỷ lệ ${stats.avgOccupancy}% chỗ`}
              />
              <StatCard
                title="Doanh thu resale"
                value={formatCompact(stats.resaleRevenue) + " VND"}
                change="+34.7%"
                positive={true}
                icon={TrendingUp}
                iconBg="bg-emerald-500"
                sub="5% hoa hồng BTC"
              />
            </div>

            {/* Revenue Chart */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                <div>
                  <h2 className="font-semibold text-gray-900">Doanh thu 10 ngày gần nhất</h2>
                  <p className="text-sm text-gray-500">Tổng hợp vé gốc + vé resale</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setChartType("area")}
                    className={`p-2 rounded-lg transition-colors ${
                      chartType === "area" ? "bg-orange-100 text-orange-600" : "text-gray-400 hover:bg-gray-100"
                    }`}
                  >
                    <BarChart2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setChartType("bar")}
                    className={`p-2 rounded-lg transition-colors ${
                      chartType === "bar" ? "bg-orange-100 text-orange-600" : "text-gray-400 hover:bg-gray-100"
                    }`}
                  >
                    <Filter className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <ResponsiveContainer width="100%" height={260}>
                {chartType === "area" ? (
                  <AreaChart data={dailyRevenue} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                    <defs>
                      <linearGradient id="primaryGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="resaleGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9ca3af" }} />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#9ca3af" }}
                      tickFormatter={(v) => formatCompact(v)}
                    />
                    <Tooltip
                      formatter={(value: number, name: string) => [
                        formatCurrency(value),
                        name === "primary" ? "Vé gốc" : "Vé resale",
                      ]}
                      contentStyle={{
                        borderRadius: "12px",
                        border: "1px solid #e5e7eb",
                        fontSize: "12px",
                      }}
                    />
                    <Legend
                      formatter={(v) => (v === "primary" ? "Vé gốc" : "Vé resale")}
                    />
                    <Area
                      type="monotone"
                      dataKey="primary"
                      stroke="#f97316"
                      strokeWidth={2}
                      fill="url(#primaryGrad)"
                    />
                    <Area
                      type="monotone"
                      dataKey="resale"
                      stroke="#7c3aed"
                      strokeWidth={2}
                      fill="url(#resaleGrad)"
                    />
                  </AreaChart>
                ) : (
                  <BarChart data={dailyRevenue} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9ca3af" }} />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#9ca3af" }}
                      tickFormatter={(v) => formatCompact(v)}
                    />
                    <Tooltip
                      formatter={(value: number, name: string) => [
                        formatCurrency(value),
                        name === "primary" ? "Vé gốc" : "Vé resale",
                      ]}
                      contentStyle={{
                        borderRadius: "12px",
                        border: "1px solid #e5e7eb",
                        fontSize: "12px",
                      }}
                    />
                    <Legend
                      formatter={(v) => (v === "primary" ? "Vé gốc" : "Vé resale")}
                    />
                    <Bar dataKey="primary" fill="#f97316" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="resale" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>

            {/* Quick Event Summary */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 flex items-center justify-between border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">Sự kiện đang hoạt động</h2>
                <button
                  onClick={() => setActiveTab("Sự kiện")}
                  className="flex items-center gap-1 text-sm text-orange-600 hover:text-orange-700"
                >
                  Xem tất cả
                  <ArrowUpRight className="w-4 h-4" />
                </button>
              </div>
              <div className="divide-y divide-gray-50">
                {eventStats.slice(0, 3).map((event) => {
                  const cfg = statusEventConfig[event.status];
                  const StatusIcon = cfg.Icon;
                  return (
                    <div key={event.id} className="flex items-center gap-4 px-5 py-4">
                      <div className={`w-8 h-8 rounded-lg ${cfg.bg} flex items-center justify-center flex-shrink-0`}>
                        <StatusIcon className={`w-4 h-4 ${cfg.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 text-sm truncate">
                          {event.title}
                        </div>
                        <div className="text-xs text-gray-500 flex items-center gap-2">
                          <span>{event.ticketsSold}/{event.totalTickets} vé</span>
                          <span>·</span>
                          <span className={`${cfg.color}`}>{cfg.label}</span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-sm font-semibold text-gray-900">
                          {formatCompact(event.revenue)} VND
                        </div>
                        <div className="text-xs text-gray-500">
                          {event.occupancy}% chỗ
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {activeTab === "Sự kiện" && (
          <div className="space-y-5">
            {/* Table Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="font-semibold text-gray-900">
                Tất cả sự kiện ({eventStats.length})
              </h2>
              <button className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm min-h-[44px]">
                <Filter className="w-4 h-4" />
                Lọc
              </button>
            </div>

            {/* Events Table - Mobile Cards / Desktop Table */}
            <div className="hidden sm:block bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-5 py-3.5 text-xs font-medium text-gray-500 uppercase">
                      Sự kiện
                    </th>
                    <th className="text-center px-4 py-3.5 text-xs font-medium text-gray-500 uppercase">
                      Trạng thái
                    </th>
                    <th className="text-right px-4 py-3.5 text-xs font-medium text-gray-500 uppercase">
                      Vé bán
                    </th>
                    <th className="text-right px-4 py-3.5 text-xs font-medium text-gray-500 uppercase">
                      Lấp đầy
                    </th>
                    <th className="text-right px-4 py-3.5 text-xs font-medium text-gray-500 uppercase">
                      Doanh thu
                    </th>
                    <th className="text-right px-4 py-3.5 text-xs font-medium text-gray-500 uppercase">
                      Resale
                    </th>
                    <th className="px-4 py-3.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {eventStats.map((event) => {
                    const cfg = statusEventConfig[event.status];
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
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color}`}>
                            <StatusIcon className="w-3 h-3" />
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <div className="text-sm font-medium text-gray-900">
                            {event.ticketsSold.toLocaleString("vi-VN")}
                          </div>
                          <div className="text-xs text-gray-400">/ {event.totalTickets.toLocaleString("vi-VN")}</div>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-orange-500 rounded-full"
                                style={{ width: `${event.occupancy}%` }}
                              />
                            </div>
                            <span className="text-sm text-gray-600">{event.occupancy}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <div className="text-sm font-medium text-gray-900">
                            {formatCompact(event.revenue)} VND
                          </div>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <div className="text-sm text-violet-600">
                            {formatCompact(event.resaleVolume)} VND
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                            <Eye className="w-4 h-4 text-gray-400" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden space-y-3">
              {eventStats.map((event) => {
                const cfg = statusEventConfig[event.status];
                const StatusIcon = cfg.Icon;
                return (
                  <div key={event.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <h3 className="font-medium text-gray-900 text-sm flex-1 leading-snug">
                        {event.title}
                      </h3>
                      <span className={`flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {cfg.label}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div>
                        <div className="text-sm font-bold text-gray-900">{event.occupancy}%</div>
                        <div className="text-xs text-gray-500">Lấp đầy</div>
                      </div>
                      <div>
                        <div className="text-sm font-bold text-gray-900">
                          {formatCompact(event.revenue)}
                        </div>
                        <div className="text-xs text-gray-500">VND</div>
                      </div>
                      <div>
                        <div className="text-sm font-bold text-violet-600">
                          {formatCompact(event.resaleVolume)}
                        </div>
                        <div className="text-xs text-gray-500">Resale</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === "Resale" && (
          <div className="space-y-6">
            {/* Resale Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-center">
                <div className="text-3xl font-bold text-violet-600 mb-1">38</div>
                <div className="text-sm text-gray-500">Vé đang resale</div>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-center">
                <div className="text-3xl font-bold text-green-600 mb-1">
                  {formatCompact(stats.resaleRevenue)} VND
                </div>
                <div className="text-sm text-gray-500">Tổng volume resale</div>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-center">
                <div className="text-3xl font-bold text-orange-500 mb-1">5%</div>
                <div className="text-sm text-gray-500">Hoa hồng BTC nhận</div>
              </div>
            </div>

            {/* Resale Policy Info */}
            <div className="bg-violet-50 border border-violet-200 rounded-2xl p-5">
              <h3 className="font-semibold text-violet-900 mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Chính sách resale đang áp dụng
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-violet-800">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-violet-600 flex-shrink-0" />
                  Giá tối đa: 120% giá gốc
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-violet-600 flex-shrink-0" />
                  Hoa hồng BTC: 5% / giao dịch
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-violet-600 flex-shrink-0" />
                  Khóa resale: T-30 phút trước sự kiện
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-violet-600 flex-shrink-0" />
                  Người mua trả giá all-in
                </div>
              </div>
            </div>

            {/* Resale Volume per Event */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Volume resale theo sự kiện</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={eventStats.map((e) => ({
                    name: e.title.split(":")[0].substring(0, 15) + "...",
                    resale: e.resaleVolume,
                    commission: Math.round(e.resaleVolume * 0.05),
                  }))}
                  margin={{ top: 5, right: 5, left: 0, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#9ca3af" }} angle={-15} />
                  <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} tickFormatter={(v) => formatCompact(v)} />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      formatCurrency(value),
                      name === "resale" ? "Volume" : "Hoa hồng BTC",
                    ]}
                    contentStyle={{ borderRadius: "12px", fontSize: "12px" }}
                  />
                  <Bar dataKey="resale" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="commission" fill="#f97316" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {activeTab === "Giao dịch" && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="text-center py-12 text-gray-400">
              <BarChart2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <div className="font-medium text-gray-600">Lịch sử giao dịch chi tiết</div>
              <div className="text-sm mt-1">Kết nối với Supabase để xem dữ liệu thực</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
