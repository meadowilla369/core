import { Home, Search, ArrowLeftRight, Ticket, User } from "lucide-react";
import { NavLink } from "react-router-dom";

const navItems = [
  { icon: Home, label: "Trang chủ", path: "/" },
  { icon: Search, label: "Khám phá", path: "/discover" },
  { icon: ArrowLeftRight, label: "Trao đổi", path: "/marketplace" },
  { icon: Ticket, label: "Vé", path: "/tickets" },
  { icon: User, label: "Hồ sơ", path: "/profile" }
];

const BottomNav = () => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-t border-foreground/20 safe-area-bottom">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 px-4 py-2 transition-all ${
                isActive ? "text-foreground" : "text-foreground/40 hover:text-foreground/70"
              }`
            }
          >
            <item.icon className="w-5 h-5" strokeWidth={1.5} />
            <span className="text-[10px] font-mono uppercase tracking-wider">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
};

export default BottomNav;
