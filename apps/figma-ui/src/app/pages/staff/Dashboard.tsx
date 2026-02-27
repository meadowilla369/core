import { useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  ArrowLeft,
  ScanLine,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Calendar,
  MapPin,
  Ticket,
  BarChart2,
  RefreshCw,
  User,
  Activity,
  Zap,
  ChevronRight,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const HOURLY_SCANS = [
  { hour: "18:00", valid: 42, invalid: 1 },
  { hour: "18:30", valid: 128, invalid: 3 },
  { hour: "19:00", valid: 265, invalid: 5 },
  { hour: "19:30", valid: 198, invalid: 2 },
  { hour: "20:00", valid: 87, invalid: 1 },
  { hour: "20:30", valid: 45, invalid: 0 },
  { hour: "21:00", valid: 18, invalid: 0 },
];

const RECENT_SCANS = [
  { id: "TKT001", name: "Nguyễn Văn An", tier: "VIP", result: "valid", time: "20:32:14", gate: "Cổng A" },
  { id: "TKT002", name: "Lê Thị Mai", tier: "Hạng A", result: "valid", time: "20:31:58", gate: "Cổng B" },
  { id: "TKT003", name: "—", tier: "—", result: "invalid", time: "20:31:42", gate: "Cổng A", error: "QR hết hạn" },
  { id: "TKT004", name: "Phạm Văn Bình", tier: "Hạng B", result: "valid", time: "20:31:10", gate: "Cổng C" },
  { id: "TKT005", name: "Trần Thu Hà", tier: "Hạng A", result: "duplicate", time: "20:30:45", gate: "Cổng B", error: "Đã sử dụng" },
  { id: "TKT006", name: "Hoàng Quang Nam", tier: "VIP", result: "valid", time: "20:30:22", gate: "Cổng A" },
  { id: "TKT007", name: "Vũ Thị Lan", tier: "Hạng B", result: "valid", time: "20:29:55", gate: "Cổng C" },
  { id: "TKT008", name: "Đặng Minh Hiếu", tier: "Hạng A", result: "valid", time: "20:29:30", gate: "Cổng A" },
];

const GATE_STATS = [
  { gate: "Cổng A", scanned: 312, capacity: 600, staff: 2 },
  { gate: "Cổng B", scanned: 248, capacity: 500, staff: 2 },
  { gate: "Cổng C", scanned: 189, capacity: 400, staff: 1 },
  { gate: "VIP Gate", scanned: 78, capacity: 200, staff: 1 },
];

const ASSIGNED_EVENTS = [
  {
    id: "evt-001",
    title: "Mỹ Tâm Live in Concert 2026",
    venue: "Sân vận động Mỹ Đình",
    date: "15/04/2026 19:00",
    status: "upcoming",
    gate: "Cổng A",
  },
  {
    id: "evt-002",
    title: "Kịch Chuyện Tình Sài Gòn",
    venue: "Nhà hát Hòa Bình",
    date: "20/03/2026 20:00",
    status: "upcoming",
    gate: "Main Gate",
  },
];

export function StaffDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"overview" | "history" | "gates">("overview");

  const totalScanned = HOURLY_SCANS.reduce((s, h) => s + h.valid + h.invalid, 0);
  const totalValid = HOURLY_SCANS.reduce((s, h) => s + h.valid, 0);
  const totalInvalid = HOURLY_SCANS.reduce((s, h) => s + h.invalid, 0);
  const validPct = Math.round((totalValid / totalScanned) * 100);

  const TABS = [
    { id: "overview" as const, label: "Tổng quan" },
    { id: "history" as const, label: "Lịch sử" },
    { id: "gates" as const, label: "Cổng vào" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <Link to="/">
                <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center">
                  <ArrowLeft className="w-5 h-5 text-gray-600" />
                </button>
              </Link>
              <div>
                <h1 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-600" />
                  Bảng điều khiển Staff
                </h1>
                <p className="text-xs text-gray-500">Nhân viên kiểm vé · Ca tối 18:00–22:00</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-200 rounded-full text-xs text-green-700">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                Online
              </div>
              <Link to="/staff/scan">
                <button className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium transition-colors min-h-[44px]">
                  <ScanLine className="w-4 h-4" />
                  Quét vé
                </button>
              </Link>
            </div>
          </div>

          <div className="flex gap-0 overflow-x-auto -mb-px">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? "border-emerald-600 text-emerald-700"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        {activeTab === "overview" && (
          <div className="space-y-5">
            {/* Live stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Đã quét hôm nay", value: totalScanned.toString(), color: "text-gray-900", Icon: ScanLine, iconBg: "bg-emerald-500" },
                { label: "Hợp lệ", value: totalValid.toString(), color: "text-green-600", Icon: CheckCircle, iconBg: "bg-green-500" },
                { label: "Không hợp lệ", value: totalInvalid.toString(), color: "text-red-600", Icon: XCircle, iconBg: "bg-red-500" },
                { label: "Tỷ lệ thành công", value: `${validPct}%`, color: "text-emerald-600", Icon: Zap, iconBg: "bg-emerald-600" },
              ].map((s) => (
                <div key={s.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <div className={`w-9 h-9 rounded-xl ${s.iconBg} flex items-center justify-center mb-3`}>
                    <s.Icon className="w-4 h-4 text-white" />
                  </div>
                  <div className={`text-2xl font-bold mb-0.5 ${s.color}`}>{s.value}</div>
                  <div className="text-xs text-gray-500">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Scan chart */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Lượt quét theo giờ</h3>
                <div className="flex items-center gap-3 text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                    <span className="text-gray-500">Hợp lệ</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm bg-red-400" />
                    <span className="text-gray-500">Không hợp lệ</span>
                  </div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={HOURLY_SCANS} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "#9ca3af" }} />
                  <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} />
                  <Tooltip contentStyle={{ borderRadius: "12px", fontSize: "12px" }} />
                  <Bar dataKey="valid" name="Hợp lệ" fill="#10b981" radius={[3, 3, 0, 0]} stackId="a" />
                  <Bar dataKey="invalid" name="Không hợp lệ" fill="#f87171" radius={[3, 3, 0, 0]} stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Assigned Events */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900">Sự kiện được phân công</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {ASSIGNED_EVENTS.map((evt) => (
                  <div key={evt.id} className="flex items-center gap-4 px-5 py-4">
                    <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Calendar className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 text-sm truncate">{evt.title}</div>
                      <div className="text-xs text-gray-500 flex items-center gap-2">
                        <MapPin className="w-3 h-3" />
                        {evt.venue}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">{evt.date} · {evt.gate}</div>
                    </div>
                    <Link to="/staff/scan">
                      <button className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-medium hover:bg-emerald-100 transition-colors">
                        <ScanLine className="w-3.5 h-3.5" />
                        Quét
                      </button>
                    </Link>
                  </div>
                ))}
              </div>
            </div>

            {/* Staff Info */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <User className="w-4 h-4 text-gray-500" />
                Thông tin ca làm việc
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                {[
                  { label: "Nhân viên", value: "Trần Quang Hùng" },
                  { label: "Vị trí", value: "Cổng A" },
                  { label: "Ca", value: "18:00 – 22:00" },
                  { label: "Sự kiện", value: "Mỹ Tâm Concert" },
                ].map((item) => (
                  <div key={item.label} className="bg-gray-50 rounded-xl p-3">
                    <div className="text-xs text-gray-500 mb-0.5">{item.label}</div>
                    <div className="font-medium text-gray-900 text-xs">{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "history" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">{RECENT_SCANS.length} lần quét gần đây</h3>
              <button
                onClick={() => {}}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 px-3 py-2 hover:bg-white rounded-lg transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Làm mới
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="divide-y divide-gray-50">
                {RECENT_SCANS.map((scan, idx) => (
                  <div key={idx} className="flex items-center gap-4 px-5 py-3.5">
                    {/* Status icon */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      scan.result === "valid" ? "bg-green-50" :
                      scan.result === "duplicate" ? "bg-orange-50" : "bg-red-50"
                    }`}>
                      {scan.result === "valid" ? (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      ) : scan.result === "duplicate" ? (
                        <AlertTriangle className="w-4 h-4 text-orange-600" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-600" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium text-gray-900">
                          {scan.result === "valid" ? scan.name : "Vé không hợp lệ"}
                        </span>
                        {scan.result !== "valid" && (
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                            scan.result === "duplicate" ? "bg-orange-100 text-orange-700" : "bg-red-100 text-red-700"
                          }`}>
                            {scan.error}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 flex items-center gap-2">
                        <span className="font-mono">{scan.id}</span>
                        {scan.tier !== "—" && <span>· {scan.tier}</span>}
                        <span>· {scan.gate}</span>
                      </div>
                    </div>

                    <div className="text-xs text-gray-400 flex-shrink-0 font-mono">{scan.time}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Load more */}
            <button className="w-full py-3 text-sm text-gray-500 hover:text-gray-700 hover:bg-white rounded-xl transition-colors border border-dashed border-gray-200">
              Tải thêm lịch sử...
            </button>
          </div>
        )}

        {activeTab === "gates" && (
          <div className="space-y-4">
            {GATE_STATS.map((gate) => {
              const pct = Math.round((gate.scanned / gate.capacity) * 100);
              return (
                <div key={gate.gate} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">{gate.gate}</h3>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {gate.staff} nhân viên · {gate.scanned}/{gate.capacity} lượt vào
                      </div>
                    </div>
                    <span className={`text-sm font-bold ${pct >= 80 ? "text-orange-600" : "text-emerald-600"}`}>
                      {pct}%
                    </span>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${pct >= 80 ? "bg-orange-500" : "bg-emerald-500"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-400 mt-1.5">
                    <span>{gate.scanned} đã vào</span>
                    <span>{gate.capacity - gate.scanned} còn lại</span>
                  </div>
                </div>
              );
            })}

            {/* Quick actions */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between gap-3">
              <div>
                <div className="font-medium text-emerald-900 text-sm">Bắt đầu quét vé</div>
                <div className="text-xs text-emerald-600">QR động, xác thực tức thì</div>
              </div>
              <Link to="/staff/scan">
                <button className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium transition-colors">
                  <ScanLine className="w-4 h-4" />
                  Quét ngay
                </button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
