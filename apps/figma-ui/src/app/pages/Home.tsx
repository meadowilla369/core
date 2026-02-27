import { Link } from "react-router";
import {
  Ticket,
  UserCheck,
  LayoutDashboard,
  Shield,
  ArrowRight,
  CheckCircle,
  TrendingUp,
  Zap,
  ScanLine,
  Users,
  CalendarPlus,
  Activity,
  BarChart2,
  ShieldAlert,
  ChevronRight,
} from "lucide-react";

interface RoleLink {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface Role {
  title: string;
  subtitle: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
  lightText: string;
  links: RoleLink[];
}

const ROLES: Role[] = [
  {
    title: "Khách hàng",
    subtitle: "Buyer / Seller",
    description: "Mua vé, bán lại vé resale, quản lý QR động",
    icon: Ticket,
    gradient: "from-violet-600 to-indigo-600",
    lightText: "text-violet-400",
    links: [
      { label: "Khám phá sự kiện", path: "/explore", icon: Ticket },
      { label: "Vé của tôi", path: "/tickets", icon: Ticket },
      { label: "Tài khoản & KYC", path: "/profile", icon: Users },
    ],
  },
  {
    title: "Nhân viên kiểm vé",
    subtitle: "Staff",
    description: "Quét QR xác thực vé tại cổng, xử lý real-time",
    icon: UserCheck,
    gradient: "from-emerald-600 to-teal-600",
    lightText: "text-emerald-400",
    links: [
      { label: "Dashboard ca làm", path: "/staff/dashboard", icon: Activity },
      { label: "Quét vé ngay", path: "/staff/scan", icon: ScanLine },
    ],
  },
  {
    title: "Ban tổ chức",
    subtitle: "BTC Organizer",
    description: "Dashboard sự kiện, doanh thu, phân tích resale",
    icon: LayoutDashboard,
    gradient: "from-orange-500 to-amber-500",
    lightText: "text-orange-400",
    links: [
      { label: "Dashboard tổng quan", path: "/organizer/dashboard", icon: BarChart2 },
      { label: "Quản lý sự kiện", path: "/organizer/events", icon: CalendarPlus },
      { label: "Tạo sự kiện mới", path: "/organizer/event/new", icon: CalendarPlus },
    ],
  },
  {
    title: "Quản trị nền tảng",
    subtitle: "Platform Admin",
    description: "Giám sát, xử lý tranh chấp, quản lý người dùng",
    icon: Shield,
    gradient: "from-rose-600 to-pink-600",
    lightText: "text-rose-400",
    links: [
      { label: "Platform Analytics", path: "/platform/analytics", icon: Activity },
      { label: "Hàng đợi tranh chấp", path: "/platform/disputes", icon: ShieldAlert },
      { label: "Quản lý người dùng", path: "/platform/users", icon: Users },
    ],
  },
];

const POLICIES = [
  { icon: TrendingUp, text: "Giá bán lại tối đa 120% giá gốc" },
  { icon: CheckCircle, text: "Phân chia: 90% seller · 5% platform · 5% BTC" },
  { icon: Zap, text: "Dừng giao dịch T-30 phút trước sự kiện" },
  { icon: Shield, text: "KYC bắt buộc từ 5.000.000 VND" },
  { icon: Ticket, text: "QR code động, làm mới mỗi 3 giây" },
  { icon: UserCheck, text: "Người mua trả giá all-in (seller chịu phí)" },
];

const PAGE_MAP: { label: string; path: string; role: string; color: string }[] = [
  { label: "Khám phá sự kiện", path: "/explore", role: "Buyer", color: "bg-violet-100 text-violet-700" },
  { label: "Chi tiết sự kiện", path: "/event/evt-001", role: "Buyer", color: "bg-violet-100 text-violet-700" },
  { label: "Thanh toán vé", path: "/checkout/evt-001", role: "Buyer", color: "bg-violet-100 text-violet-700" },
  { label: "Vé của tôi", path: "/tickets", role: "Buyer", color: "bg-violet-100 text-violet-700" },
  { label: "QR Ticket", path: "/ticket/tkt-001", role: "Buyer", color: "bg-violet-100 text-violet-700" },
  { label: "Tạo resale", path: "/resale/create/tkt-001", role: "Buyer", color: "bg-violet-100 text-violet-700" },
  { label: "KYC Stepper", path: "/kyc", role: "Buyer", color: "bg-violet-100 text-violet-700" },
  { label: "Hồ sơ cá nhân", path: "/profile", role: "Buyer", color: "bg-violet-100 text-violet-700" },
  { label: "Staff Dashboard", path: "/staff/dashboard", role: "Staff", color: "bg-emerald-100 text-emerald-700" },
  { label: "Staff Scan", path: "/staff/scan", role: "Staff", color: "bg-emerald-100 text-emerald-700" },
  { label: "Kết quả quét", path: "/staff/scan-result", role: "Staff", color: "bg-emerald-100 text-emerald-700" },
  { label: "Organizer Dashboard", path: "/organizer/dashboard", role: "BTC", color: "bg-orange-100 text-orange-700" },
  { label: "Quản lý sự kiện", path: "/organizer/events", role: "BTC", color: "bg-orange-100 text-orange-700" },
  { label: "Chi tiết sự kiện BTC", path: "/organizer/event/evt-001", role: "BTC", color: "bg-orange-100 text-orange-700" },
  { label: "Tạo/Sửa sự kiện", path: "/organizer/event/new", role: "BTC", color: "bg-orange-100 text-orange-700" },
  { label: "Platform Analytics", path: "/platform/analytics", role: "Admin", color: "bg-rose-100 text-rose-700" },
  { label: "Quản lý users", path: "/platform/users", role: "Admin", color: "bg-rose-100 text-rose-700" },
  { label: "Hàng đợi tranh chấp", path: "/platform/disputes", role: "Admin", color: "bg-rose-100 text-rose-700" },
  { label: "Chi tiết tranh chấp", path: "/platform/dispute/dsp-001", role: "Admin", color: "bg-rose-100 text-rose-700" },
];

export function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 relative overflow-hidden">
      {/* Background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-violet-600/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-40 w-80 h-80 bg-indigo-600/15 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/3 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full text-sm text-white/80 mb-6">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            Multi-Platform Ticketing · Vietnam · Figma Make Prototype
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-4 leading-tight">
            Sàn Vé Sự Kiện
            <span className="bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-transparent">
              {" "}Việt Nam
            </span>
          </h1>
          <p className="text-lg text-white/60 max-w-2xl mx-auto">
            Hệ thống UI đầy đủ cho 3 nhóm vai trò: Buyer/Seller · Staff · BTC Organizer · Platform Admin
          </p>
        </div>

        {/* Role Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-10">
          {ROLES.map((role) => {
            const Icon = role.icon;
            return (
              <div
                key={role.subtitle}
                className="bg-white/8 backdrop-blur-sm border border-white/12 rounded-2xl overflow-hidden hover:border-white/25 transition-all duration-300"
              >
                {/* Top gradient bar */}
                <div className={`h-1 w-full bg-gradient-to-r ${role.gradient}`} />

                <div className="p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${role.gradient} flex items-center justify-center shadow-lg flex-shrink-0`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-white font-bold">{role.title}</h2>
                      <p className={`text-xs font-medium ${role.lightText}`}>{role.subtitle}</p>
                    </div>
                  </div>
                  <p className="text-white/60 text-sm leading-relaxed mb-4">{role.description}</p>

                  {/* Quick links */}
                  <div className="space-y-1.5">
                    {role.links.map((link) => (
                      <Link
                        key={link.path}
                        to={link.path}
                        className="flex items-center gap-2 px-3 py-2.5 bg-white/8 hover:bg-white/15 border border-white/10 rounded-xl transition-all group"
                      >
                        <link.icon className="w-3.5 h-3.5 text-white/50 flex-shrink-0" />
                        <span className="text-sm text-white/80 flex-1">{link.label}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-white/30 group-hover:text-white/60 group-hover:translate-x-0.5 transition-all" />
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* All Screens Sitemap */}
        <div className="bg-white/6 backdrop-blur-sm border border-white/12 rounded-2xl p-6 mb-8">
          <div className="flex items-center gap-2 mb-5">
            <LayoutDashboard className="w-4 h-4 text-violet-400" />
            <h3 className="text-white font-semibold">Tất cả màn hình ({PAGE_MAP.length} screens)</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
            {PAGE_MAP.map((page) => (
              <Link
                key={page.path}
                to={page.path}
                className="flex items-center gap-2 px-3 py-2.5 bg-white/5 hover:bg-white/10 border border-white/8 rounded-xl transition-all group"
              >
                <span className={`text-xs px-1.5 py-0.5 rounded-md flex-shrink-0 font-medium ${page.color}`}>
                  {page.role}
                </span>
                <span className="text-sm text-white/70 group-hover:text-white/90 truncate">{page.label}</span>
                <ChevronRight className="w-3 h-3 text-white/20 flex-shrink-0 ml-auto" />
              </Link>
            ))}
          </div>
        </div>

        {/* Policy Rules */}
        <div className="bg-white/6 backdrop-blur-sm border border-white/12 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <Shield className="w-5 h-5 text-violet-400" />
            <h3 className="text-white font-semibold">Quy định giao dịch bắt buộc (non-negotiable)</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {POLICIES.map(({ icon: PolicyIcon, text }) => (
              <div
                key={text}
                className="flex items-start gap-3 p-3 bg-white/5 rounded-xl border border-white/8"
              >
                <PolicyIcon className="w-4 h-4 text-violet-400 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-white/70">{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-white/25 text-xs mt-8">
          UI System Prototype · 19 screens · 4 role groups · Figma Make · Dữ liệu mẫu
        </p>
      </div>
    </div>
  );
}
