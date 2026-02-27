import { useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Ticket,
  TrendingUp,
  DollarSign,
  ChevronRight,
  Edit3,
  Bell,
  Lock,
  LogOut,
  HelpCircle,
  CheckCircle,
  AlertCircle,
  Settings,
  CreditCard,
  Camera,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { mockTickets } from "../../lib/mockData";
import { formatCurrency } from "../../lib/utils";

const MOCK_USER = {
  id: "user-001",
  name: "Nguyễn Văn An",
  email: "an.nguyen@gmail.com",
  phone: "0901 234 567",
  kycStatus: "verified" as "verified" | "pending" | "not_started" | "rejected",
  joinedAt: "2025-11-15",
  totalPurchased: 8,
  totalSpent: 12_800_000,
  totalResold: 2,
  walletBalance: 1_200_000,
};

const MOCK_TRANSACTIONS = [
  { id: "TXN-8812", type: "purchase", event: "Mỹ Tâm Live in Concert 2026", amount: 2_000_000, date: "10/02/2026", status: "completed" },
  { id: "TXN-8741", type: "resale", event: "V.League 2026: Hà Nội FC", amount: 162_000, date: "28/01/2026", status: "completed" },
  { id: "TXN-8690", type: "purchase", event: "Kịch Chuyện Tình Sài Gòn", amount: 500_000, date: "15/02/2026", status: "completed" },
  { id: "TXN-8521", type: "purchase", event: "Stand-up Comedy: Trấn Thành", amount: 800_000, date: "05/01/2026", status: "refunded" },
];

const KYC_CONFIG = {
  verified: {
    label: "Đã xác minh",
    sublabel: "Tài khoản đầy đủ quyền",
    color: "text-green-700",
    bg: "bg-green-50",
    border: "border-green-200",
    Icon: ShieldCheck,
    iconColor: "text-green-600",
  },
  pending: {
    label: "Đang xử lý",
    sublabel: "Dự kiến 1–3 ngày làm việc",
    color: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
    Icon: Clock,
    iconColor: "text-amber-600",
  },
  not_started: {
    label: "Chưa KYC",
    sublabel: "Bắt buộc khi giao dịch ≥ 5M VND",
    color: "text-gray-700",
    bg: "bg-gray-50",
    border: "border-gray-200",
    Icon: ShieldAlert,
    iconColor: "text-gray-400",
  },
  rejected: {
    label: "Bị từ chối",
    sublabel: "Vui lòng nộp lại hồ sơ",
    color: "text-red-700",
    bg: "bg-red-50",
    border: "border-red-200",
    Icon: AlertCircle,
    iconColor: "text-red-600",
  },
};

const TABS = ["Hồ sơ", "Lịch sử", "Cài đặt"];

export function BuyerProfile() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("Hồ sơ");
  const [editMode, setEditMode] = useState(false);
  const [formName, setFormName] = useState(MOCK_USER.name);
  const [formPhone, setFormPhone] = useState(MOCK_USER.phone);

  const kycCfg = KYC_CONFIG[MOCK_USER.kycStatus];
  const KYCIcon = kycCfg.Icon;

  const activeTickets = mockTickets.filter((t) => t.status === "active").length;

  const handleSaveProfile = () => {
    setEditMode(false);
    toast.success("Đã cập nhật hồ sơ");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <Link to="/explore">
                <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center">
                  <ArrowLeft className="w-5 h-5 text-gray-600" />
                </button>
              </Link>
              <h1 className="text-base font-bold text-gray-900">Tài khoản</h1>
            </div>
            {activeTab === "Hồ sơ" && (
              <button
                onClick={() => setEditMode(!editMode)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-500"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex gap-0 overflow-x-auto -mb-px">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  activeTab === tab
                    ? "border-violet-600 text-violet-700"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
        {activeTab === "Hồ sơ" && (
          <div className="space-y-5">
            {/* Avatar + Name */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-16 h-16 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold">
                    {MOCK_USER.name.charAt(0)}
                  </div>
                  {editMode && (
                    <button className="absolute -bottom-1 -right-1 w-6 h-6 bg-violet-600 rounded-full flex items-center justify-center shadow-md">
                      <Camera className="w-3 h-3 text-white" />
                    </button>
                  )}
                </div>
                <div className="flex-1">
                  {editMode ? (
                    <input
                      type="text"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className="w-full px-3 py-2 border border-violet-300 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-violet-100 mb-1"
                    />
                  ) : (
                    <h2 className="text-lg font-bold text-gray-900">{MOCK_USER.name}</h2>
                  )}
                  <div className="text-sm text-gray-500">{MOCK_USER.email}</div>
                  <div className="text-xs text-gray-400 mt-0.5 font-mono">{MOCK_USER.id}</div>
                </div>
              </div>

              {editMode && (
                <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Số điện thoại</label>
                    <input
                      type="tel"
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:border-violet-400 focus:ring-2 focus:ring-violet-100 focus:outline-none"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={handleSaveProfile}
                      className="flex-1 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-medium hover:bg-violet-700 transition-colors"
                    >
                      Lưu thay đổi
                    </button>
                    <button
                      onClick={() => setEditMode(false)}
                      className="px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
                    >
                      Hủy
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* KYC Status */}
            <div className={`rounded-2xl border p-5 ${kycCfg.bg} ${kycCfg.border}`}>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/70 flex items-center justify-center flex-shrink-0">
                  <KYCIcon className={`w-5 h-5 ${kycCfg.iconColor}`} />
                </div>
                <div className="flex-1">
                  <div className={`font-semibold ${kycCfg.color}`}>KYC: {kycCfg.label}</div>
                  <div className={`text-sm mt-0.5 ${kycCfg.color} opacity-80`}>{kycCfg.sublabel}</div>
                  {MOCK_USER.kycStatus !== "verified" && (
                    <Link to="/kyc">
                      <button className="mt-3 px-4 py-2 bg-white text-violet-700 border border-violet-200 rounded-lg text-sm font-medium hover:bg-violet-50 transition-colors">
                        {MOCK_USER.kycStatus === "rejected" ? "Nộp lại hồ sơ" : "Xác minh ngay"}
                      </button>
                    </Link>
                  )}
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { icon: Ticket, label: "Vé active", value: activeTickets, color: "text-violet-600" },
                { icon: DollarSign, label: "Tổng chi tiêu", value: `${(MOCK_USER.totalSpent / 1_000_000).toFixed(1)}M`, color: "text-orange-500" },
                { icon: TrendingUp, label: "Đã bán lại", value: MOCK_USER.totalResold, color: "text-green-600" },
                { icon: CreditCard, label: "Số dư ví", value: `${(MOCK_USER.walletBalance / 1_000).toFixed(0)}K`, color: "text-blue-600" },
              ].map((s) => (
                <div key={s.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
                  <s.icon className={`w-5 h-5 mx-auto mb-1.5 ${s.color}`} />
                  <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
                  <div className="text-xs text-gray-500">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Contact Info */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Thông tin liên hệ</h3>
              <div className="space-y-3">
                {[
                  { Icon: Mail, label: "Email", value: MOCK_USER.email, verified: true },
                  { Icon: Phone, label: "Điện thoại", value: MOCK_USER.phone, verified: true },
                  { Icon: User, label: "Tham gia", value: new Date(MOCK_USER.joinedAt).toLocaleDateString("vi-VN"), verified: false },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
                    <item.Icon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="text-xs text-gray-400">{item.label}</div>
                      <div className="text-sm font-medium text-gray-900">{item.value}</div>
                    </div>
                    {item.verified && (
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Quick links */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {[
                { Icon: Ticket, label: "Vé của tôi", sub: `${mockTickets.length} vé`, action: () => navigate("/tickets") },
                { Icon: TrendingUp, label: "Lịch sử bán lại", sub: `${MOCK_USER.totalResold} giao dịch`, action: () => setActiveTab("Lịch sử") },
                { Icon: Shield, label: "Bảo mật & KYC", sub: kycCfg.label, action: () => navigate("/kyc") },
              ].map((item, idx) => (
                <button
                  key={idx}
                  onClick={item.action}
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
                >
                  <item.Icon className="w-5 h-5 text-violet-500 flex-shrink-0" />
                  <div className="flex-1 text-left">
                    <div className="text-sm font-medium text-gray-900">{item.label}</div>
                    <div className="text-xs text-gray-500">{item.sub}</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab === "Lịch sử" && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-center">
                <div className="text-2xl font-bold text-violet-600">{MOCK_USER.totalPurchased}</div>
                <div className="text-xs text-gray-500">Vé đã mua</div>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-center">
                <div className="text-2xl font-bold text-orange-500">
                  {(MOCK_USER.totalSpent / 1_000_000).toFixed(1)}M
                </div>
                <div className="text-xs text-gray-500">VND tổng chi tiêu</div>
              </div>
            </div>

            {/* Transaction List */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900">Lịch sử giao dịch</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {MOCK_TRANSACTIONS.map((txn) => (
                  <div key={txn.id} className="flex items-center gap-4 px-5 py-4">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      txn.type === "purchase" ? "bg-violet-50" : "bg-green-50"
                    }`}>
                      {txn.type === "purchase" ? (
                        <Ticket className="w-4 h-4 text-violet-600" />
                      ) : (
                        <TrendingUp className="w-4 h-4 text-green-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{txn.event}</div>
                      <div className="text-xs text-gray-500 flex items-center gap-1.5 mt-0.5">
                        <span className="font-mono">{txn.id}</span>
                        <span>·</span>
                        <span>{txn.date}</span>
                        <span>·</span>
                        <span>{txn.type === "purchase" ? "Mua vé" : "Bán lại"}</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className={`text-sm font-semibold ${txn.type === "resale" ? "text-green-600" : "text-gray-900"}`}>
                        {txn.type === "resale" ? "+" : ""}{txn.amount.toLocaleString("vi-VN")} VND
                      </div>
                      <span className={`text-xs ${
                        txn.status === "completed" ? "text-green-600" :
                        txn.status === "refunded" ? "text-blue-600" : "text-gray-400"
                      }`}>
                        {txn.status === "completed" ? "Hoàn tất" : "Hoàn tiền"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "Cài đặt" && (
          <div className="space-y-4">
            {/* Notifications */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-gray-50">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Thông báo</h3>
              </div>
              {[
                { label: "Thông báo qua email", sub: "Xác nhận mua vé, reminder sự kiện", defaultOn: true },
                { label: "SMS thông báo", sub: "Cảnh báo bảo mật, OTP", defaultOn: true },
                { label: "Thông báo khuyến mãi", sub: "Ưu đãi đặc biệt", defaultOn: false },
              ].map((item, idx) => (
                <NotifToggle key={idx} {...item} />
              ))}
            </div>

            {/* Security */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-gray-50">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Bảo mật</h3>
              </div>
              {[
                { Icon: Lock, label: "Đổi mật khẩu", sub: "Cập nhật mật khẩu định kỳ", action: () => toast.info("Chức năng đổi mật khẩu") },
                { Icon: Shield, label: "Xác thực 2 bước", sub: "Thêm lớp bảo vệ tài khoản", action: () => toast.info("Chức năng 2FA") },
                { Icon: ShieldCheck, label: "Xác minh KYC", sub: MOCK_USER.kycStatus === "verified" ? "Đã xác minh" : "Cần xác minh", action: () => navigate("/kyc") },
              ].map((item, idx) => (
                <button
                  key={idx}
                  onClick={item.action}
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
                >
                  <item.Icon className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  <div className="flex-1 text-left">
                    <div className="text-sm font-medium text-gray-900">{item.label}</div>
                    <div className="text-xs text-gray-500">{item.sub}</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                </button>
              ))}
            </div>

            {/* Help */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-gray-50">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Hỗ trợ</h3>
              </div>
              {[
                { Icon: HelpCircle, label: "Trung tâm hỗ trợ", action: () => toast.info("Mở FAQ") },
                { Icon: Info, label: "Điều khoản & chính sách", action: () => toast.info("Mở điều khoản") },
              ].map((item, idx) => (
                <button
                  key={idx}
                  onClick={item.action}
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
                >
                  <item.Icon className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  <span className="flex-1 text-left text-sm font-medium text-gray-900">{item.label}</span>
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                </button>
              ))}
            </div>

            {/* Logout */}
            <button
              onClick={() => toast.error("Đã đăng xuất")}
              className="w-full flex items-center justify-center gap-2 py-4 border-2 border-red-200 text-red-600 rounded-2xl hover:bg-red-50 transition-colors text-sm font-medium"
            >
              <LogOut className="w-4 h-4" />
              Đăng xuất
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function NotifToggle({ label, sub, defaultOn }: { label: string; sub: string; defaultOn: boolean }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50 last:border-0">
      <div>
        <div className="text-sm font-medium text-gray-900">{label}</div>
        <div className="text-xs text-gray-500">{sub}</div>
      </div>
      <button
        onClick={() => { setOn(!on); toast.success(on ? "Đã tắt thông báo" : "Đã bật thông báo"); }}
        className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${on ? "bg-violet-600" : "bg-gray-200"}`}
      >
        <div className={`absolute w-4.5 h-4.5 bg-white rounded-full top-0.5 transition-transform shadow-sm ${on ? "translate-x-5" : "translate-x-0.5"}`}
          style={{ width: "18px", height: "18px" }}
        />
      </button>
    </div>
  );
}
