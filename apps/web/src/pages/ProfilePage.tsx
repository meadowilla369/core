import { ChevronRight, LogOut, CreditCard, Bell, HelpCircle, Shield, Moon } from "lucide-react";
import { Link } from "react-router-dom";
import MobileLayout from "@/components/mobile/MobileLayout";
import ProfileAvatar from "@/components/mobile/ProfileAvatar";
import { profileFallback } from "@/lib/fallback-data";
import { getInitials } from "@/lib/format";
import { useProfileCustomization, useProfileSummary } from "@/hooks/use-profile";
import { useLogout } from "@/hooks/use-logout";

const menuItems = [
  { icon: CreditCard, label: "Phương thức thanh toán", path: "/profile/payments" },
  { icon: Bell, label: "Thông báo", path: "/profile/notifications" },
  { icon: Shield, label: "Bảo mật & Quyền riêng tư", path: "/profile/privacy" },
  { icon: HelpCircle, label: "Trợ giúp & Hỗ trợ", path: "/profile/help" }
];

const ProfilePage = () => {
  const { data, isError } = useProfileSummary();
  const { customization } = useProfileCustomization();
  const { logout, isLoggingOut } = useLogout();
  const profile = data ?? profileFallback;
  const displayName = customization.displayName ?? profile.displayName;
  const avatarInitials = customization.displayName
    ? getInitials(customization.displayName)
    : profile.avatarInitials;

  return (
    <MobileLayout>
      {/* Header */}
      <header className="p-4 border-b border-foreground/10">
        <h1 className="text-2xl font-medium tracking-tight">Hồ Sơ</h1>
      </header>

      {isError && (
        <div className="px-4 py-3 border-b border-yellow-500/30 bg-yellow-500/10">
          <p className="font-mono text-[10px] text-yellow-200">
            Profile đang hiển thị fallback vì user-service hoặc ticketing chưa phản hồi.
          </p>
        </div>
      )}

      {/* User Info */}
      <section className="p-4 border-b border-foreground/10">
        <div className="flex items-center gap-4">
          <ProfileAvatar avatar={customization.avatar} initials={avatarInitials} />
          <div className="flex-1">
            <h2 className="text-lg font-medium">{displayName}</h2>
            <p className="font-mono text-xs text-foreground/50">{profile.email}</p>
          </div>
          <Link
            to="/profile/edit"
            className="px-4 py-2 border border-foreground/20 font-mono text-xs hover:bg-foreground/10 transition-colors"
          >
            SỬA
          </Link>
        </div>
      </section>

      {/* Stats */}
      <section className="grid min-w-0 grid-cols-3 border-b border-foreground/10">
        <div className="min-w-0 px-2 py-4 text-center border-r border-foreground/10 sm:px-4">
          <span className="block text-2xl font-medium leading-tight tabular-nums">
            {profile.attendedEvents}
          </span>
          <p className="font-mono text-[10px] text-foreground/50 mt-1">Sự kiện</p>
        </div>
        <div className="min-w-0 px-2 py-4 text-center border-r border-foreground/10 sm:px-4">
          <span className="block text-2xl font-medium leading-tight tabular-nums">
            {profile.upcomingEvents}
          </span>
          <p className="font-mono text-[10px] text-foreground/50 mt-1">Sắp tới</p>
        </div>
        <div className="min-w-0 px-2 py-4 text-center sm:px-4">
          <span className="block w-full max-w-full whitespace-normal break-words text-[clamp(0.875rem,4.6vw,1.5rem)] font-medium leading-tight tabular-nums [overflow-wrap:anywhere]">
            {profile.spendSummary}
          </span>
          <p className="font-mono text-[10px] text-foreground/50 mt-1">Đã chi</p>
        </div>
      </section>

      {/* Menu Items */}
      <section className="divide-y divide-foreground/10">
        {menuItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className="flex items-center gap-4 p-4 hover:bg-foreground/5 transition-colors"
          >
            <item.icon className="w-5 h-5 text-foreground/60" />
            <span className="flex-1 font-medium">{item.label}</span>
            <ChevronRight className="w-4 h-4 text-foreground/40" />
          </Link>
        ))}

        {/* Dark Mode Toggle */}
        <div className="flex items-center gap-4 p-4">
          <Moon className="w-5 h-5 text-foreground/60" />
          <span className="flex-1 font-medium">Chế độ tối</span>
          <div className="w-12 h-6 bg-foreground/20 border border-foreground/30 relative">
            <div className="absolute right-0.5 top-0.5 w-5 h-5 bg-foreground" />
          </div>
        </div>
      </section>

      {/* Logout */}
      <section className="p-4 mt-6">
        <button
          type="button"
          onClick={() => void logout()}
          disabled={isLoggingOut}
          className="w-full flex items-center justify-center gap-2 py-4 border border-destructive/50 text-destructive font-mono text-sm hover:bg-destructive/10 transition-colors disabled:opacity-50"
        >
          <LogOut className="w-4 h-4" />
          {isLoggingOut ? "ĐANG ĐĂNG XUẤT..." : "ĐĂNG XUẤT"}
        </button>
      </section>

      {/* Version */}
      <div className="p-4 text-center">
        <span className="font-mono text-[10px] text-foreground/30">ENTR v1.0.0</span>
      </div>
    </MobileLayout>
  );
};

export default ProfilePage;
