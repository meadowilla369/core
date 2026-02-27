import { useState } from "react";
import { useNavigate, Link } from "react-router";
import {
  ArrowLeft,
  AlertCircle,
  Clock,
  CheckCircle,
  Search,
  Filter,
  ChevronRight,
  User,
  Tag,
  Shield,
  Zap,
  RefreshCw,
} from "lucide-react";
import { mockDisputes } from "../../lib/mockData";
import { formatShortDate, getPriorityColor } from "../../lib/utils";
import { Dispute } from "../../lib/types";

type FilterTab = "all" | "open" | "investigating" | "resolved";

const STATUS_CONFIG = {
  open: {
    label: "Mở",
    Icon: AlertCircle,
    iconColor: "text-blue-600",
    bg: "bg-blue-50",
    badge: "bg-blue-100 text-blue-700",
  },
  investigating: {
    label: "Đang xử lý",
    Icon: Clock,
    iconColor: "text-amber-600",
    bg: "bg-amber-50",
    badge: "bg-amber-100 text-amber-700",
  },
  resolved: {
    label: "Đã giải quyết",
    Icon: CheckCircle,
    iconColor: "text-green-600",
    bg: "bg-green-50",
    badge: "bg-green-100 text-green-700",
  },
  closed: {
    label: "Đã đóng",
    Icon: CheckCircle,
    iconColor: "text-gray-400",
    bg: "bg-gray-50",
    badge: "bg-gray-100 text-gray-500",
  },
};

const TYPE_LABELS: Record<string, string> = {
  fraud: "Gian lận",
  refund: "Hoàn tiền",
  technical: "Kỹ thuật",
  other: "Khác",
};

const PRIORITY_LABELS: Record<string, string> = {
  urgent: "Khẩn cấp",
  high: "Cao",
  medium: "Trung bình",
  low: "Thấp",
};

function DisputeCard({ dispute, onClick }: { dispute: Dispute; onClick: () => void }) {
  const statusCfg = STATUS_CONFIG[dispute.status] || STATUS_CONFIG.open;
  const priorityCfg = getPriorityColor(dispute.priority);
  const StatusIcon = statusCfg.Icon;

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all p-5 group"
    >
      <div className="flex items-start gap-3 mb-3">
        <div className={`w-9 h-9 rounded-xl ${statusCfg.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
          <StatusIcon className={`w-4.5 h-4.5 ${statusCfg.iconColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusCfg.badge}`}>
              {statusCfg.label}
            </span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${priorityCfg.bg} ${priorityCfg.text} ${priorityCfg.border}`}>
              {PRIORITY_LABELS[dispute.priority]}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
              {TYPE_LABELS[dispute.type]}
            </span>
          </div>
          <div className="text-sm font-semibold text-gray-900 truncate">
            #{dispute.id} · {dispute.eventTitle || dispute.ticketId}
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1 group-hover:text-gray-600 transition-colors" />
      </div>

      <p className="text-sm text-gray-600 line-clamp-2 mb-3 pl-12">
        {dispute.description}
      </p>

      <div className="flex items-center gap-4 pl-12 text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <User className="w-3.5 h-3.5" />
          {dispute.reporterName || dispute.reporterId}
        </span>
        {dispute.amount && (
          <span className="flex items-center gap-1">
            <Tag className="w-3.5 h-3.5" />
            {dispute.amount.toLocaleString("vi-VN")} VND
          </span>
        )}
        <span className="ml-auto">
          {formatShortDate(dispute.createdAt)}
        </span>
        {dispute.assignedToName && (
          <span className="flex items-center gap-1 text-violet-500">
            <Shield className="w-3.5 h-3.5" />
            {dispute.assignedToName}
          </span>
        )}
      </div>
    </button>
  );
}

export function DisputeQueue() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = mockDisputes.filter((d) => {
    const matchTab =
      activeTab === "all" || d.status === activeTab;
    const matchSearch =
      !searchQuery ||
      d.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.reporterName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.eventTitle || "").toLowerCase().includes(searchQuery.toLowerCase());
    return matchTab && matchSearch;
  });

  const counts = {
    all: mockDisputes.length,
    open: mockDisputes.filter((d) => d.status === "open").length,
    investigating: mockDisputes.filter((d) => d.status === "investigating").length,
    resolved: mockDisputes.filter((d) => d.status === "resolved").length,
  };

  const urgentCount = mockDisputes.filter(
    (d) => d.priority === "urgent" && d.status !== "resolved"
  ).length;

  const TABS: { id: FilterTab; label: string; count: number }[] = [
    { id: "all", label: "Tất cả", count: counts.all },
    { id: "open", label: "Mở", count: counts.open },
    { id: "investigating", label: "Đang xử lý", count: counts.investigating },
    { id: "resolved", label: "Đã giải quyết", count: counts.resolved },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <Link to="/">
                <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center">
                  <ArrowLeft className="w-5 h-5 text-gray-600" />
                </button>
              </Link>
              <div>
                <h1 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  Hàng đợi tranh chấp
                  {urgentCount > 0 && (
                    <span className="flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-600 text-xs rounded-full">
                      <Zap className="w-3 h-3" />
                      {urgentCount} khẩn
                    </span>
                  )}
                </h1>
                <p className="text-xs text-gray-500">Platform Admin · Cập nhật thường xuyên</p>
              </div>
            </div>
            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-500">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm theo ID, người báo cáo, sự kiện..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 min-h-[44px] rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-rose-400 focus:ring-2 focus:ring-rose-100 focus:outline-none transition-all text-sm"
            />
          </div>

          {/* Tabs */}
          <div className="flex gap-0 overflow-x-auto -mb-px">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? "border-rose-600 text-rose-700"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.label}
                <span className={`px-2 py-0.5 rounded-full text-xs ${
                  activeTab === tab.id ? "bg-rose-100 text-rose-700" : "bg-gray-100 text-gray-500"
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Summary Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Tổng", value: counts.all, color: "text-gray-900" },
            { label: "Cần xử lý", value: counts.open, color: "text-blue-600" },
            { label: "Đang giải quyết", value: counts.investigating, color: "text-amber-600" },
            { label: "Đã giải quyết", value: counts.resolved, color: "text-green-600" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filter Row */}
        {filtered.length > 0 && (
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500">
              Hiển thị {filtered.length} tranh chấp
            </div>
            <button className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 px-3 py-2 hover:bg-white rounded-lg transition-colors">
              <Filter className="w-4 h-4" />
              Sắp xếp
            </button>
          </div>
        )}

        {/* Urgent Banner */}
        {urgentCount > 0 && activeTab !== "resolved" && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Zap className="w-5 h-5 text-red-600" />
            </div>
            <div className="flex-1">
              <div className="font-medium text-red-900 text-sm">
                {urgentCount} tranh chấp cần xử lý khẩn cấp
              </div>
              <div className="text-xs text-red-600">
                Vui lòng xử lý trong vòng 2 giờ theo SLA
              </div>
            </div>
          </div>
        )}

        {/* Dispute Cards */}
        {filtered.length > 0 ? (
          <div className="space-y-3">
            {filtered.map((d) => (
              <DisputeCard
                key={d.id}
                dispute={d}
                onClick={() => navigate(`/platform/dispute/${d.id}`)}
              />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
            <CheckCircle className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <div className="text-gray-600 font-medium">Không có tranh chấp nào</div>
            <div className="text-sm text-gray-400 mt-1">
              {searchQuery ? "Thử tìm kiếm với từ khóa khác" : "Tất cả tranh chấp đã được giải quyết"}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
