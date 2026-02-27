import { useState } from "react";
import { Link } from "react-router";
import {
  ArrowLeft,
  Search,
  Filter,
  Users,
  UserCheck,
  UserX,
  ShieldCheck,
  ShieldAlert,
  Clock,
  ChevronRight,
  MoreVertical,
  Download,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Eye,
  Lock,
  Unlock,
  Mail,
} from "lucide-react";
import { toast } from "sonner";

type UserRole = "buyer" | "seller" | "organizer";
type KYCStatus = "verified" | "pending" | "rejected" | "not_started";
type AccountStatus = "active" | "suspended" | "locked";

interface PlatformUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  kycStatus: KYCStatus;
  accountStatus: AccountStatus;
  joinedAt: string;
  totalTransactions: number;
  totalSpent: number;
  flagCount: number;
}

const MOCK_USERS: PlatformUser[] = [
  {
    id: "user-001",
    name: "Nguyễn Văn An",
    email: "an.nguyen@gmail.com",
    phone: "0901 234 567",
    role: "buyer",
    kycStatus: "verified",
    accountStatus: "active",
    joinedAt: "2025-11-15",
    totalTransactions: 8,
    totalSpent: 12_800_000,
    flagCount: 0,
  },
  {
    id: "user-002",
    name: "Lê Thị Mai",
    email: "mai.le@gmail.com",
    phone: "0912 345 678",
    role: "buyer",
    kycStatus: "verified",
    accountStatus: "active",
    joinedAt: "2025-10-08",
    totalTransactions: 14,
    totalSpent: 28_400_000,
    flagCount: 1,
  },
  {
    id: "user-003",
    name: "Phạm Văn Bình",
    email: "binh.pham@outlook.com",
    phone: "0978 456 789",
    role: "seller",
    kycStatus: "verified",
    accountStatus: "active",
    joinedAt: "2025-09-22",
    totalTransactions: 22,
    totalSpent: 45_600_000,
    flagCount: 2,
  },
  {
    id: "user-004",
    name: "Nguyễn Thị Hoa",
    email: "hoa.nguyen@yahoo.com",
    phone: "0934 567 890",
    role: "buyer",
    kycStatus: "not_started",
    accountStatus: "active",
    joinedAt: "2026-01-10",
    totalTransactions: 2,
    totalSpent: 7_000_000,
    flagCount: 0,
  },
  {
    id: "user-005",
    name: "Trần Minh Đức",
    email: "duc.tran@vn.com",
    phone: "0967 678 901",
    role: "seller",
    kycStatus: "pending",
    accountStatus: "active",
    joinedAt: "2026-01-28",
    totalTransactions: 5,
    totalSpent: 15_200_000,
    flagCount: 0,
  },
  {
    id: "user-006",
    name: "Võ Thị Linh",
    email: "linh.vo@email.com",
    phone: "0945 789 012",
    role: "buyer",
    kycStatus: "rejected",
    accountStatus: "suspended",
    joinedAt: "2025-12-05",
    totalTransactions: 1,
    totalSpent: 500_000,
    flagCount: 3,
  },
  {
    id: "user-007",
    name: "Hoàng Văn Nam",
    email: "nam.hoang@tech.vn",
    phone: "0923 890 123",
    role: "organizer",
    kycStatus: "verified",
    accountStatus: "active",
    joinedAt: "2025-08-14",
    totalTransactions: 48,
    totalSpent: 280_000_000,
    flagCount: 0,
  },
  {
    id: "user-008",
    name: "Đặng Quốc Khánh",
    email: "khanh.dang@bot.vn",
    phone: "0911 901 234",
    role: "buyer",
    kycStatus: "verified",
    accountStatus: "locked",
    joinedAt: "2026-02-01",
    totalTransactions: 0,
    totalSpent: 0,
    flagCount: 5,
  },
];

const KYC_CONFIG: Record<KYCStatus, { label: string; color: string; bg: string; Icon: React.ComponentType<{ className?: string }> }> = {
  verified: { label: "Đã xác minh", color: "text-green-700", bg: "bg-green-50", Icon: ShieldCheck },
  pending: { label: "Đang xử lý", color: "text-amber-700", bg: "bg-amber-50", Icon: Clock },
  rejected: { label: "Bị từ chối", color: "text-red-700", bg: "bg-red-50", Icon: ShieldAlert },
  not_started: { label: "Chưa KYC", color: "text-gray-600", bg: "bg-gray-50", Icon: UserX },
};

const ACCOUNT_CONFIG: Record<AccountStatus, { label: string; color: string; bg: string }> = {
  active: { label: "Hoạt động", color: "text-green-700", bg: "bg-green-100" },
  suspended: { label: "Tạm khóa", color: "text-orange-700", bg: "bg-orange-100" },
  locked: { label: "Đã khóa", color: "text-red-700", bg: "bg-red-100" },
};

const ROLE_LABELS: Record<UserRole, string> = {
  buyer: "Người mua",
  seller: "Người bán",
  organizer: "Ban tổ chức",
};

type FilterTab = "all" | "verified" | "pending" | "flagged";

export function PlatformUserManagement() {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [selectedUser, setSelectedUser] = useState<PlatformUser | null>(null);
  const [actionMenuUser, setActionMenuUser] = useState<string | null>(null);

  const filtered = MOCK_USERS.filter((u) => {
    const matchSearch =
      !search ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.id.toLowerCase().includes(search.toLowerCase());
    const matchTab =
      activeTab === "all" ||
      (activeTab === "verified" && u.kycStatus === "verified") ||
      (activeTab === "pending" && u.kycStatus === "pending") ||
      (activeTab === "flagged" && u.flagCount > 0);
    return matchSearch && matchTab;
  });

  const counts = {
    all: MOCK_USERS.length,
    verified: MOCK_USERS.filter((u) => u.kycStatus === "verified").length,
    pending: MOCK_USERS.filter((u) => u.kycStatus === "pending").length,
    flagged: MOCK_USERS.filter((u) => u.flagCount > 0).length,
  };

  const TABS: { id: FilterTab; label: string }[] = [
    { id: "all", label: "Tất cả" },
    { id: "verified", label: "Đã KYC" },
    { id: "pending", label: "Chờ duyệt" },
    { id: "flagged", label: "Bị flag" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <Link to="/">
                <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center">
                  <ArrowLeft className="w-5 h-5 text-gray-600" />
                </button>
              </Link>
              <div>
                <h1 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-rose-600" />
                  Quản lý người dùng
                </h1>
                <p className="text-xs text-gray-500">Platform Admin · {MOCK_USERS.length} tài khoản</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => toast.success("Đã làm mới danh sách")}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-500"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                onClick={() => toast.info("Xuất CSV chưa khả dụng trong demo")}
                className="hidden sm:flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm min-h-[44px]"
              >
                <Download className="w-4 h-4" />
                Xuất
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm tên, email, ID người dùng..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
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
                <span className={`px-1.5 py-0.5 rounded-full text-xs ${activeTab === tab.id ? "bg-rose-100 text-rose-700" : "bg-gray-100 text-gray-500"}`}>
                  {counts[tab.id]}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* User List */}
          <div className={`${selectedUser ? "lg:col-span-2" : "lg:col-span-3"} space-y-3`}>
            {/* Stats row */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: "Tổng TK", value: counts.all, color: "text-gray-900", Icon: Users },
                { label: "Đã KYC", value: counts.verified, color: "text-green-600", Icon: UserCheck },
                { label: "Chờ KYC", value: counts.pending, color: "text-amber-600", Icon: Clock },
                { label: "Bị flag", value: counts.flagged, color: "text-red-600", Icon: AlertTriangle },
              ].map((s) => (
                <div key={s.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-center">
                  <s.Icon className={`w-4 h-4 mx-auto mb-1 ${s.color}`} />
                  <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
                  <div className="text-xs text-gray-500">{s.label}</div>
                </div>
              ))}
            </div>

            {filtered.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
                <Users className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <div className="text-gray-600 font-medium">Không tìm thấy người dùng</div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="divide-y divide-gray-50">
                  {filtered.map((user) => {
                    const kycCfg = KYC_CONFIG[user.kycStatus];
                    const accCfg = ACCOUNT_CONFIG[user.accountStatus];
                    const KYCIcon = kycCfg.Icon;

                    return (
                      <div
                        key={user.id}
                        className={`flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors cursor-pointer ${
                          selectedUser?.id === user.id ? "bg-rose-50/50" : ""
                        }`}
                        onClick={() => setSelectedUser(selectedUser?.id === user.id ? null : user)}
                      >
                        {/* Avatar */}
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                          user.accountStatus === "locked" ? "bg-red-100 text-red-700" :
                          user.accountStatus === "suspended" ? "bg-orange-100 text-orange-700" :
                          "bg-violet-100 text-violet-700"
                        }`}>
                          {user.name.charAt(0)}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <span className="font-medium text-gray-900 text-sm">{user.name}</span>
                            {user.flagCount > 0 && (
                              <span className="flex items-center gap-0.5 text-xs text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full">
                                <AlertTriangle className="w-3 h-3" />
                                {user.flagCount}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500">{user.email}</div>
                          <div className="text-xs text-gray-400 mt-0.5">{ROLE_LABELS[user.role]} · {user.totalTransactions} giao dịch</div>
                        </div>

                        {/* KYC Badge */}
                        <div className={`hidden sm:flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${kycCfg.bg} ${kycCfg.color}`}>
                          <KYCIcon className="w-3 h-3" />
                          {kycCfg.label}
                        </div>

                        {/* Account Status */}
                        <span className={`hidden lg:block text-xs px-2 py-1 rounded-full font-medium ${accCfg.bg} ${accCfg.color}`}>
                          {accCfg.label}
                        </span>

                        {/* Action Menu */}
                        <div className="relative flex-shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActionMenuUser(actionMenuUser === user.id ? null : user.id);
                            }}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            <MoreVertical className="w-4 h-4 text-gray-400" />
                          </button>
                          {actionMenuUser === user.id && (
                            <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-xl shadow-xl z-30 py-1.5">
                              <button
                                onClick={(e) => { e.stopPropagation(); setSelectedUser(user); setActionMenuUser(null); }}
                                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                              >
                                <Eye className="w-4 h-4 text-gray-400" />
                                Xem chi tiết
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); toast.success("Email đã gửi"); setActionMenuUser(null); }}
                                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                              >
                                <Mail className="w-4 h-4 text-gray-400" />
                                Gửi email
                              </button>
                              {user.accountStatus === "active" ? (
                                <button
                                  onClick={(e) => { e.stopPropagation(); toast.success(`Đã tạm khóa ${user.name}`); setActionMenuUser(null); }}
                                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-orange-600 hover:bg-orange-50"
                                >
                                  <Lock className="w-4 h-4" />
                                  Tạm khóa
                                </button>
                              ) : (
                                <button
                                  onClick={(e) => { e.stopPropagation(); toast.success(`Đã mở khóa ${user.name}`); setActionMenuUser(null); }}
                                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-green-600 hover:bg-green-50"
                                >
                                  <Unlock className="w-4 h-4" />
                                  Mở khóa
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        <ChevronRight className={`w-4 h-4 text-gray-300 flex-shrink-0 transition-transform ${selectedUser?.id === user.id ? "rotate-90" : ""}`} />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* User Detail Sidebar */}
          {selectedUser && (
            <div className="space-y-4">
              {/* Profile Card */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold ${
                    selectedUser.accountStatus === "locked" ? "bg-red-100 text-red-700" :
                    "bg-violet-100 text-violet-700"
                  }`}>
                    {selectedUser.name.charAt(0)}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">{selectedUser.name}</div>
                    <div className="text-xs text-gray-500">{ROLE_LABELS[selectedUser.role]}</div>
                    <div className="text-xs text-gray-400 font-mono">{selectedUser.id}</div>
                  </div>
                </div>

                <div className="space-y-2.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Email</span>
                    <span className="text-blue-600 text-xs">{selectedUser.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">SĐT</span>
                    <span className="text-gray-900">{selectedUser.phone}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Tham gia</span>
                    <span className="text-gray-900">{new Date(selectedUser.joinedAt).toLocaleDateString("vi-VN")}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-gray-100">
                    <span className="text-gray-500">Tổng chi tiêu</span>
                    <span className="font-semibold text-gray-900">
                      {selectedUser.totalSpent.toLocaleString("vi-VN")} VND
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Giao dịch</span>
                    <span className="font-semibold text-gray-900">{selectedUser.totalTransactions}</span>
                  </div>
                </div>
              </div>

              {/* Status Card */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <h3 className="font-semibold text-gray-900 mb-3">Trạng thái</h3>
                <div className="space-y-3">
                  {/* KYC */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Xác minh KYC</span>
                    <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${KYC_CONFIG[selectedUser.kycStatus].bg} ${KYC_CONFIG[selectedUser.kycStatus].color}`}>
                      {selectedUser.kycStatus === "verified" ? <CheckCircle className="w-3 h-3" /> :
                       selectedUser.kycStatus === "pending" ? <Clock className="w-3 h-3" /> :
                       <XCircle className="w-3 h-3" />}
                      {KYC_CONFIG[selectedUser.kycStatus].label}
                    </div>
                  </div>
                  {/* Account */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Tài khoản</span>
                    <span className={`text-xs px-2 py-1 rounded-full ${ACCOUNT_CONFIG[selectedUser.accountStatus].bg} ${ACCOUNT_CONFIG[selectedUser.accountStatus].color}`}>
                      {ACCOUNT_CONFIG[selectedUser.accountStatus].label}
                    </span>
                  </div>
                  {/* Flags */}
                  {selectedUser.flagCount > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Lần bị flag</span>
                      <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded-full">
                        {selectedUser.flagCount} lần
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <h3 className="font-semibold text-gray-900 mb-3">Hành động quản trị</h3>
                <div className="space-y-2">
                  {selectedUser.kycStatus === "pending" && (
                    <>
                      <button
                        onClick={() => toast.success("Đã duyệt KYC")}
                        className="w-full flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 text-green-800 rounded-xl text-sm font-medium hover:bg-green-100 transition-colors min-h-[44px]"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Duyệt KYC
                      </button>
                      <button
                        onClick={() => toast.error("Đã từ chối KYC")}
                        className="w-full flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-sm font-medium hover:bg-red-100 transition-colors min-h-[44px]"
                      >
                        <XCircle className="w-4 h-4" />
                        Từ chối KYC
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => toast.success("Email đã gửi")}
                    className="w-full flex items-center gap-2 px-4 py-3 bg-gray-50 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-100 transition-colors min-h-[44px]"
                  >
                    <Mail className="w-4 h-4" />
                    Gửi email thông báo
                  </button>
                  {selectedUser.accountStatus === "active" ? (
                    <button
                      onClick={() => toast.success(`Đã tạm khóa ${selectedUser.name}`)}
                      className="w-full flex items-center gap-2 px-4 py-3 bg-orange-50 border border-orange-200 text-orange-800 rounded-xl text-sm font-medium hover:bg-orange-100 transition-colors min-h-[44px]"
                    >
                      <Lock className="w-4 h-4" />
                      Tạm khóa tài khoản
                    </button>
                  ) : (
                    <button
                      onClick={() => toast.success(`Đã mở khóa ${selectedUser.name}`)}
                      className="w-full flex items-center gap-2 px-4 py-3 bg-blue-50 border border-blue-200 text-blue-800 rounded-xl text-sm font-medium hover:bg-blue-100 transition-colors min-h-[44px]"
                    >
                      <Unlock className="w-4 h-4" />
                      Mở khóa tài khoản
                    </button>
                  )}
                  <button
                    onClick={() => toast.info("Đã ghi nhận cảnh báo vi phạm")}
                    className="w-full flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-medium hover:bg-red-100 transition-colors min-h-[44px]"
                  >
                    <AlertTriangle className="w-4 h-4" />
                    Flag vi phạm
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
