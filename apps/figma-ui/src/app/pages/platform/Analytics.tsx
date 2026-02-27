import { useState } from "react";
import { Link } from "react-router";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Users,
  Ticket,
  DollarSign,
  ShieldAlert,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Zap,
  BarChart2,
  PieChart,
  AlertTriangle,
  CheckCircle,
  Clock,
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
  PieChart as RechartsPie,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from "recharts";
import { formatCurrency } from "../../lib/utils";

function formatCompact(n: number) {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

const platformRevenueData = [
  { date: "18/02", gmv: 185_000_000, fees: 9_250_000, resale: 18_500_000 },
  { date: "19/02", gmv: 162_000_000, fees: 8_100_000, resale: 14_200_000 },
  { date: "20/02", gmv: 241_000_000, fees: 12_050_000, resale: 22_300_000 },
  { date: "21/02", gmv: 198_000_000, fees: 9_900_000, resale: 19_800_000 },
  { date: "22/02", gmv: 134_000_000, fees: 6_700_000, resale: 11_100_000 },
  { date: "23/02", gmv: 118_000_000, fees: 5_900_000, resale: 9_800_000 },
  { date: "24/02", gmv: 276_000_000, fees: 13_800_000, resale: 31_200_000 },
  { date: "25/02", gmv: 312_000_000, fees: 15_600_000, resale: 37_400_000 },
  { date: "26/02", gmv: 258_000_000, fees: 12_900_000, resale: 28_900_000 },
  { date: "27/02", gmv: 203_000_000, fees: 10_150_000, resale: 21_600_000 },
];

const categoryData = [
  { name: "Âm nhạc", value: 42, color: "#7c3aed" },
  { name: "Thể thao", value: 22, color: "#f97316" },
  { name: "Sân khấu", value: 15, color: "#0ea5e9" },
  { name: "Giải trí", value: 12, color: "#10b981" },
  { name: "Hội thảo", value: 5, color: "#f59e0b" },
  { name: "Lễ hội", value: 4, color: "#ec4899" },
];

const hourlyActivity = [
  { hour: "00", txns: 12 }, { hour: "02", txns: 5 }, { hour: "04", txns: 3 },
  { hour: "06", txns: 8 }, { hour: "08", txns: 48 }, { hour: "10", txns: 92 },
  { hour: "12", txns: 110 }, { hour: "14", txns: 87 }, { hour: "16", txns: 134 },
  { hour: "18", txns: 198 }, { hour: "20", txns: 245 }, { hour: "22", txns: 89 },
];

const fraudSignals = [
  { date: "23/02", flagged: 3, confirmed: 1 },
  { date: "24/02", flagged: 7, confirmed: 2 },
  { date: "25/02", flagged: 12, confirmed: 4 },
  { date: "26/02", flagged: 8, confirmed: 3 },
  { date: "27/02", flagged: 5, confirmed: 1 },
];

const KPI_DATA = [
  {
    title: "GMV 30 ngày",
    value: "2.09B VND",
    change: "+22.4%",
    positive: true,
    icon: DollarSign,
    iconBg: "bg-violet-600",
    sub: "so với tháng trước",
  },
  {
    title: "Người dùng hoạt động",
    value: "14,820",
    change: "+8.1%",
    positive: true,
    icon: Users,
    iconBg: "bg-blue-500",
    sub: "DAU trung bình",
  },
  {
    title: "Vé được bán",
    value: "38,940",
    change: "+15.7%",
    positive: true,
    icon: Ticket,
    iconBg: "bg-orange-500",
    sub: "tháng này",
  },
  {
    title: "Tỷ lệ gian lận",
    value: "0.31%",
    change: "-0.08%",
    positive: true,
    icon: ShieldAlert,
    iconBg: "bg-rose-600",
    sub: "dưới ngưỡng SLA 0.5%",
  },
];

const RESALE_COMPLIANCE = [
  { label: "Tuân thủ trần giá 120%", value: 97.4, color: "bg-green-500" },
  { label: "Hoàn tất KYC đúng hạn", value: 94.2, color: "bg-blue-500" },
  { label: "QR hợp lệ khi scan", value: 99.1, color: "bg-violet-500" },
  { label: "Thanh toán T+1 cho seller", value: 96.8, color: "bg-orange-500" },
];

const LIVE_ALERTS = [
  { id: 1, type: "fraud", msg: "3 vé tkt-XXX bị flag mua từ cùng 1 IP", time: "2 phút trước", color: "text-red-600", bg: "bg-red-50", border: "border-red-200", Icon: ShieldAlert },
  { id: 2, type: "spike", msg: "Volume resale evt-001 tăng 340% trong 1h", time: "8 phút trước", color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-200", Icon: TrendingUp },
  { id: 3, type: "kyc", msg: "12 KYC pending quá 48h, cần duyệt thủ công", time: "15 phút trước", color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200", Icon: AlertTriangle },
  { id: 4, type: "ok", msg: "Batch payout T+1: 892 seller đã nhận", time: "1 giờ trước", color: "text-green-700", bg: "bg-green-50", border: "border-green-200", Icon: CheckCircle },
];

const TABS = ["Tổng quan", "Giao dịch", "Resale", "Bảo mật"];

function KPICard({ title, value, change, positive, icon: Icon, iconBg, sub }: typeof KPI_DATA[0]) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${positive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
          {positive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
          {change}
        </div>
      </div>
      <div className="text-2xl font-bold text-gray-900 mb-0.5">{value}</div>
      <div className="text-sm text-gray-500">{title}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

export function PlatformAnalytics() {
  const [activeTab, setActiveTab] = useState("Tổng quan");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1200);
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
                <h1 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-rose-600" />
                  Platform Analytics
                </h1>
                <p className="text-xs text-gray-500">Admin Console · Real-time data</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-200 rounded-full text-xs text-green-700">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                Live
              </div>
              <button
                onClick={handleRefresh}
                className={`p-2 hover:bg-gray-100 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-500 ${isRefreshing ? "animate-spin" : ""}`}
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <Link to="/platform/disputes">
                <button className="hidden sm:flex items-center gap-1.5 px-3 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors text-sm min-h-[44px]">
                  <ShieldAlert className="w-4 h-4" />
                  Tranh chấp
                </button>
              </Link>
            </div>
          </div>

          <div className="flex gap-0 -mb-px overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  activeTab === tab
                    ? "border-rose-600 text-rose-700"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Live Alerts Banner */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <Zap className="w-4 h-4 text-amber-500" />
              Cảnh báo real-time
            </div>
            <span className="text-xs text-gray-400">{LIVE_ALERTS.length} hoạt động</span>
          </div>
          <div className="divide-y divide-gray-50">
            {LIVE_ALERTS.map((alert) => (
              <div key={alert.id} className={`flex items-start gap-3 px-5 py-3 ${alert.bg}`}>
                <alert.Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${alert.color}`} />
                <div className="flex-1 min-w-0">
                  <span className={`text-sm ${alert.color} font-medium`}>{alert.msg}</span>
                </div>
                <span className="text-xs text-gray-400 flex-shrink-0">{alert.time}</span>
              </div>
            ))}
          </div>
        </div>

        {activeTab === "Tổng quan" && (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {KPI_DATA.map((kpi) => (
                <KPICard key={kpi.title} {...kpi} />
              ))}
            </div>

            {/* GMV Chart */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                <div>
                  <h2 className="font-semibold text-gray-900">GMV & Doanh thu nền tảng (10 ngày)</h2>
                  <p className="text-sm text-gray-500">Tổng giá trị giao dịch · Phí nền tảng · Volume resale</p>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={platformRevenueData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id="gmvGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="feesGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="resaleGrad2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9ca3af" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} tickFormatter={(v) => formatCompact(v)} />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      formatCurrency(value),
                      name === "gmv" ? "GMV" : name === "fees" ? "Phí nền tảng" : "Resale volume",
                    ]}
                    contentStyle={{ borderRadius: "12px", border: "1px solid #e5e7eb", fontSize: "12px" }}
                  />
                  <Legend formatter={(v) => v === "gmv" ? "GMV" : v === "fees" ? "Phí nền tảng" : "Resale volume"} />
                  <Area type="monotone" dataKey="gmv" stroke="#7c3aed" strokeWidth={2} fill="url(#gmvGrad)" />
                  <Area type="monotone" dataKey="fees" stroke="#f97316" strokeWidth={2} fill="url(#feesGrad)" />
                  <Area type="monotone" dataKey="resale" stroke="#0ea5e9" strokeWidth={2} fill="url(#resaleGrad2)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Category + Hourly grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Category Breakdown */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <h2 className="font-semibold text-gray-900 mb-5 flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-gray-500" />
                  Phân bổ GMV theo thể loại
                </h2>
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <ResponsiveContainer width={160} height={160}>
                    <RechartsPie>
                      <Pie data={categoryData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" paddingAngle={2}>
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </RechartsPie>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-2">
                    {categoryData.map((cat) => (
                      <div key={cat.name} className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                        <span className="text-sm text-gray-600 flex-1">{cat.name}</span>
                        <span className="text-sm font-semibold text-gray-900">{cat.value}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Hourly Activity */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <h2 className="font-semibold text-gray-900 mb-5 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-500" />
                  Hoạt động theo giờ hôm nay
                </h2>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={hourlyActivity} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "#9ca3af" }} />
                    <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} />
                    <Tooltip
                      formatter={(value: number) => [`${value} giao dịch`, "Giao dịch"]}
                      contentStyle={{ borderRadius: "12px", fontSize: "12px" }}
                    />
                    <Bar dataKey="txns" fill="#7c3aed" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Compliance */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h2 className="font-semibold text-gray-900 mb-5 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-gray-500" />
                Chỉ số tuân thủ chính sách (tháng này)
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {RESALE_COMPLIANCE.map((item) => (
                  <div key={item.label}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="text-gray-600">{item.label}</span>
                      <span className="font-semibold text-gray-900">{item.value}%</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${item.color} rounded-full transition-all`}
                        style={{ width: `${item.value}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {activeTab === "Giao dịch" && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Tổng giao dịch hôm nay", value: "1,248", color: "text-gray-900" },
                { label: "Thành công", value: "1,204", color: "text-green-600" },
                { label: "Đang xử lý", value: "28", color: "text-amber-600" },
                { label: "Thất bại", value: "16", color: "text-red-600" },
              ].map((s) => (
                <div key={s.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-center">
                  <div className={`text-2xl font-bold mb-1 ${s.color}`}>{s.value}</div>
                  <div className="text-xs text-gray-500">{s.label}</div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h2 className="font-semibold text-gray-900 mb-4">Volume giao dịch theo giờ</h2>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={hourlyActivity} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="hour" tick={{ fontSize: 11, fill: "#9ca3af" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} />
                  <Tooltip contentStyle={{ borderRadius: "12px", fontSize: "12px" }} />
                  <Line type="monotone" dataKey="txns" stroke="#7c3aed" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">Giao dịch gần đây</h2>
              </div>
              <div className="divide-y divide-gray-50">
                {[
                  { id: "TXN-8821", type: "Mua vé", event: "Mỹ Tâm Live 2026", amount: 2_000_000, status: "completed", time: "2 phút trước" },
                  { id: "TXN-8820", type: "Resale", event: "Stand-up Comedy", amount: 900_000, status: "completed", time: "5 phút trước" },
                  { id: "TXN-8819", type: "Mua vé", event: "Vietnam Tech Summit", amount: 3_500_000, status: "pending", time: "8 phút trước" },
                  { id: "TXN-8818", type: "Hoàn tiền", event: "V.League 2026", amount: 150_000, status: "refunded", time: "12 phút trước" },
                  { id: "TXN-8817", type: "Mua vé", event: "Kịch Chuyện Tình SG", amount: 500_000, status: "failed", time: "15 phút trước" },
                ].map((txn) => (
                  <div key={txn.id} className="flex items-center gap-4 px-5 py-3.5">
                    <span className="font-mono text-xs text-gray-500 flex-shrink-0">{txn.id}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900">{txn.type}</div>
                      <div className="text-xs text-gray-500 truncate">{txn.event}</div>
                    </div>
                    <div className="text-sm font-semibold text-gray-900 flex-shrink-0">
                      {txn.amount.toLocaleString("vi-VN")} VND
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full flex-shrink-0 ${
                      txn.status === "completed" ? "bg-green-100 text-green-700" :
                      txn.status === "pending" ? "bg-amber-100 text-amber-700" :
                      txn.status === "refunded" ? "bg-blue-100 text-blue-700" :
                      "bg-red-100 text-red-700"
                    }`}>
                      {txn.status === "completed" ? "Hoàn tất" :
                       txn.status === "pending" ? "Đang xử lý" :
                       txn.status === "refunded" ? "Hoàn tiền" : "Thất bại"}
                    </span>
                    <span className="text-xs text-gray-400 flex-shrink-0">{txn.time}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "Resale" && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Listing đang active", value: "342", color: "text-violet-600" },
                { label: "Bán thành công hôm nay", value: "128", color: "text-green-600" },
                { label: "Bị từ chối (vi phạm 120%)", value: "7", color: "text-red-600" },
                { label: "Hết hạn T-30", value: "43", color: "text-amber-600" },
              ].map((s) => (
                <div key={s.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-center">
                  <div className={`text-2xl font-bold mb-1 ${s.color}`}>{s.value}</div>
                  <div className="text-xs text-gray-500">{s.label}</div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-gray-500" />
                Payout split thực tế (tháng này)
              </h2>
              <div className="space-y-4">
                {[
                  { label: "Người bán nhận (90%)", amount: 87_480_000, pct: 90, color: "bg-violet-500" },
                  { label: "Nền tảng giữ (5%)", amount: 4_860_000, pct: 5, color: "bg-orange-400" },
                  { label: "Ban tổ chức nhận (5%)", amount: 4_860_000, pct: 5, color: "bg-blue-400" },
                ].map((row) => (
                  <div key={row.label}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="text-gray-600">{row.label}</span>
                      <span className="font-semibold text-gray-900">{row.amount.toLocaleString("vi-VN")} VND</span>
                    </div>
                    <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full ${row.color} rounded-full`} style={{ width: `${row.pct * 10}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 p-3 bg-violet-50 rounded-xl text-sm text-violet-800">
                <span className="font-medium">Tổng resale volume tháng này:</span> 97,200,000 VND
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h2 className="font-semibold text-gray-900 mb-4">Resale volume theo sự kiện (top 5)</h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={[
                    { name: "Mỹ Tâm", volume: 32_400_000 },
                    { name: "Trấn Thành", volume: 21_800_000 },
                    { name: "V.League", volume: 18_100_000 },
                    { name: "Tech Summit", volume: 14_600_000 },
                    { name: "Kịch SG", volume: 10_300_000 },
                  ]}
                  margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
                  layout="vertical"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: "#9ca3af" }} tickFormatter={(v) => formatCompact(v)} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: "#6b7280" }} width={70} />
                  <Tooltip formatter={(v: number) => [formatCurrency(v), "Volume"]} contentStyle={{ borderRadius: "12px", fontSize: "12px" }} />
                  <Bar dataKey="volume" fill="#7c3aed" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {activeTab === "Bảo mật" && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Flag gian lận (7 ngày)", value: "38", color: "text-red-600" },
                { label: "Xác nhận gian lận", value: "11", color: "text-rose-700" },
                { label: "Tài khoản bị khóa", value: "4", color: "text-orange-600" },
                { label: "KYC đang chờ", value: "12", color: "text-amber-600" },
              ].map((s) => (
                <div key={s.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-center">
                  <div className={`text-2xl font-bold mb-1 ${s.color}`}>{s.value}</div>
                  <div className="text-xs text-gray-500">{s.label}</div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h2 className="font-semibold text-gray-900 mb-4">Tín hiệu gian lận (5 ngày gần nhất)</h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={fraudSignals} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9ca3af" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} />
                  <Tooltip contentStyle={{ borderRadius: "12px", fontSize: "12px" }} />
                  <Legend />
                  <Bar dataKey="flagged" name="Bị flag" fill="#fca5a5" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="confirmed" name="Xác nhận gian lận" fill="#ef4444" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h2 className="font-semibold text-gray-900 mb-4">Quy trình KYC</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: "Chưa bắt đầu", value: 1820, color: "bg-gray-200" },
                  { label: "Đang xử lý", value: 47, color: "bg-amber-400" },
                  { label: "Đã xác minh", value: 3241, color: "bg-green-500" },
                  { label: "Bị từ chối", value: 18, color: "bg-red-400" },
                ].map((item) => (
                  <div key={item.label} className="text-center p-4 bg-gray-50 rounded-xl">
                    <div className={`w-10 h-10 ${item.color} rounded-full mx-auto mb-2 flex items-center justify-center`}>
                      <span className="text-white text-xs font-bold">{item.value > 100 ? formatCompact(item.value) : item.value}</span>
                    </div>
                    <div className="text-xs text-gray-600">{item.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Policy Violations */}
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5">
              <h2 className="font-semibold text-rose-900 mb-4 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                Vi phạm chính sách gần đây
              </h2>
              <div className="space-y-3">
                {[
                  { rule: "Giá resale vượt 120%", count: 7, action: "Auto-rejected" },
                  { rule: "Scan QR ngoài sự kiện", count: 3, action: "Flagged" },
                  { rule: "Multi-account purchase", count: 2, action: "Pending review" },
                  { rule: "KYC bypass attempt", count: 1, action: "Account locked" },
                ].map((v) => (
                  <div key={v.rule} className="flex items-center justify-between py-2 border-b border-rose-100 last:border-0">
                    <div>
                      <div className="text-sm font-medium text-rose-900">{v.rule}</div>
                      <div className="text-xs text-rose-600">{v.action}</div>
                    </div>
                    <span className="text-lg font-bold text-rose-700">{v.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}