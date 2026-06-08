import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import {
  Activity,
  Banknote,
  Gauge,
  HeartPulse,
  LifeBuoy,
  QrCode,
  Ticket,
  WalletCards
} from "lucide-react";

const navItems = [
  { to: "/", label: "Overview", icon: Gauge },
  { to: "/events", label: "Events", icon: Ticket },
  { to: "/inventory", label: "Ticket inventory", icon: WalletCards },
  { to: "/check-in", label: "Live check-in", icon: QrCode },
  { to: "/refunds", label: "Refunds", icon: Banknote },
  { to: "/disputes", label: "Disputes", icon: LifeBuoy },
  { to: "/settlement", label: "Settlement", icon: Activity },
  { to: "/health", label: "System health", icon: HeartPulse }
];

interface AppShellProps {
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
}

export function AppShell({ title, description, action, children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-[--op-bg] text-[--op-text]">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[240px_1fr]">
        <aside className="border-r border-[--op-border] bg-white px-4 py-5">
          <div className="mb-6">
            <p className="text-lg font-bold text-blue-700">ENTR BTC</p>
            <p className="text-xs text-[--op-muted]">Organizer Admin</p>
          </div>
          <nav className="space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  `flex min-h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-blue-50 text-blue-700"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                  }`
                }
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="mt-8 rounded-lg border border-[--op-border] bg-slate-50 p-3 text-xs text-[--op-muted]">
            <p className="font-semibold text-slate-700">org_rockfest</p>
            <p>Admin session</p>
          </div>
        </aside>
        <main className="min-w-0 px-4 py-5 sm:px-6 lg:px-8">
          <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-950">{title}</h1>
              <p className="mt-1 text-sm text-[--op-muted]">{description}</p>
            </div>
            {action}
          </header>
          {children}
        </main>
      </div>
    </div>
  );
}
