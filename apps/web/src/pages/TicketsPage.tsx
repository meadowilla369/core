import { useState } from "react";
import { CalendarClock, History, RefreshCw, Ticket } from "lucide-react";
import { Link } from "react-router-dom";
import MobileLayout from "@/components/mobile/MobileLayout";
import TicketCard from "@/components/mobile/TicketCard";
import { pastTicketsFallback, upcomingTicketsFallback } from "@/lib/fallback-data";
import { useMyTickets } from "@/hooks/use-tickets";

const tabs = [
  { id: "upcoming", label: "Sắp tới", icon: CalendarClock },
  { id: "past", label: "Đã qua", icon: History }
] as const;

const TicketsPage = () => {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]["id"]>("upcoming");
  const { data, isError, isLoading, isFetching, refetch } = useMyTickets();
  const upcomingTickets = data?.upcoming ?? (isError ? upcomingTicketsFallback : []);
  const pastTickets = data?.past ?? (isError ? pastTicketsFallback : []);
  const isPartial = data?.status === "partial";

  const tickets = activeTab === "upcoming" ? upcomingTickets : pastTickets;
  const activeLabel = tabs.find((tab) => tab.id === activeTab)?.label ?? "Sắp tới";

  return (
    <MobileLayout>
      <header className="sticky safe-area-sticky-top z-40 bg-background/95 backdrop-blur-sm">
        <div className="border-b border-foreground/10 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-medium tracking-tight">Vé Của Tôi</h1>
            </div>
            <button
              type="button"
              onClick={() => void refetch()}
              disabled={isFetching}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center border border-foreground/20 transition-colors hover:bg-foreground/10 disabled:opacity-50"
              aria-label="Lam moi danh sach ve"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 border-b border-foreground/10">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex min-h-[52px] items-center justify-center gap-2 font-mono text-xs uppercase tracking-wider transition-colors ${
                activeTab === tab.id
                  ? "text-foreground"
                  : "text-foreground/40 hover:text-foreground/70"
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
              <span className="text-foreground/35">
                {tab.id === "upcoming" ? upcomingTickets.length : pastTickets.length}
              </span>
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-foreground" />
              )}
            </button>
          ))}
        </div>
      </header>

      {(isError || isPartial) && (
        <div className="px-4 py-3 border-b border-yellow-500/30 bg-yellow-500/10">
          <p className="font-mono text-[10px] text-yellow-200">
            {isError
              ? "Ticketing chưa sẵn sàng. Đang dùng vé fallback cho demo."
              : "Một phần ticketing chưa sẵn sàng. Đang hiển thị vé đã sync/local trước."}
          </p>
        </div>
      )}

      <section className="p-4 space-y-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="h-48 animate-pulse border border-foreground/10 bg-foreground/5"
            />
          ))
        ) : tickets.length > 0 ? (
          tickets.map((ticket) => <TicketCard key={ticket.id} {...ticket} />)
        ) : (
          <div className="py-16 text-center">
            <p className="font-mono text-foreground/40">Chưa có vé nào</p>
            <Link
              to="/discover"
              className="mt-5 inline-flex min-h-[44px] items-center justify-center border border-foreground px-6 font-mono text-xs uppercase tracking-wider transition-colors hover:bg-foreground hover:text-background"
            >
              TÌM SỰ KIỆN
            </Link>
          </div>
        )}
      </section>

      {!isLoading && tickets.length > 0 && (
        <div className="p-4 border-t border-foreground/10">
          <span className="font-mono text-xs text-foreground/40">
            {tickets.length} VÉ {activeLabel.toUpperCase()}
          </span>
        </div>
      )}
    </MobileLayout>
  );
};

export default TicketsPage;
