import { useState } from "react";
import { RefreshCw } from "lucide-react";
import MobileLayout from "@/components/mobile/MobileLayout";
import TicketCard from "@/components/mobile/TicketCard";
import { pastTicketsFallback, upcomingTicketsFallback } from "@/lib/fallback-data";
import { useMyTickets } from "@/hooks/use-tickets";

const tabs = ["Sắp tới", "Đã qua"];

const TicketsPage = () => {
  const [activeTab, setActiveTab] = useState("Sắp tới");
  const { data, isError, isLoading, isFetching, refetch } = useMyTickets();
  const upcomingTickets = data?.upcoming ?? (isError ? upcomingTicketsFallback : []);
  const pastTickets = data?.past ?? (isError ? pastTicketsFallback : []);
  const isPartial = data?.status === "partial";

  const tickets = activeTab === "Sắp tới" ? upcomingTickets : pastTickets;

  return (
    <MobileLayout>
      {/* Header */}
      <header className="sticky safe-area-sticky-top z-40 bg-background/95 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-3 border-b border-foreground/10 p-4">
          <h1 className="text-2xl font-medium tracking-tight">Vé Của Tôi</h1>
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

        {/* Tabs */}
        <div className="flex border-b border-foreground/10">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-4 font-mono text-xs tracking-wider transition-colors relative ${
                activeTab === tab
                  ? "text-foreground"
                  : "text-foreground/40 hover:text-foreground/70"
              }`}
            >
              {tab.toUpperCase()}
              {activeTab === tab && (
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

      {/* Tickets List */}
      <section className="p-4 space-y-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="h-36 animate-pulse border border-foreground/10 bg-foreground/5"
            />
          ))
        ) : tickets.length > 0 ? (
          tickets.map((ticket) => <TicketCard key={ticket.id} {...ticket} />)
        ) : (
          <div className="py-16 text-center">
            <p className="font-mono text-foreground/40">Chưa có vé nào</p>
            <a
              href="/discover"
              className="inline-block mt-4 px-6 py-3 border border-foreground font-mono text-xs tracking-wider hover:bg-foreground hover:text-background transition-colors"
            >
              TÌM SỰ KIỆN
            </a>
          </div>
        )}
      </section>

      {/* Ticket Count */}
      {!isLoading && tickets.length > 0 && (
        <div className="p-4 border-t border-foreground/10">
          <span className="font-mono text-xs text-foreground/40">
            {tickets.length} VÉ {activeTab.toUpperCase()}
          </span>
        </div>
      )}
    </MobileLayout>
  );
};

export default TicketsPage;
