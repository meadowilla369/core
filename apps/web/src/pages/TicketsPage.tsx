import { useState } from "react";
import MobileLayout from "@/components/mobile/MobileLayout";
import TicketCard from "@/components/mobile/TicketCard";
import { pastTicketsFallback, upcomingTicketsFallback } from "@/lib/fallback-data";
import { useMyTickets } from "@/hooks/use-tickets";

const tabs = ["Sắp tới", "Đã qua"];

const TicketsPage = () => {
  const [activeTab, setActiveTab] = useState("Sắp tới");
  const { data, isError } = useMyTickets();
  const upcomingTickets = data?.upcoming ?? upcomingTicketsFallback;
  const pastTickets = data?.past ?? pastTicketsFallback;

  const tickets = activeTab === "Sắp tới" ? upcomingTickets : pastTickets;

  return (
    <MobileLayout>
      {/* Header */}
      <header className="sticky safe-area-sticky-top z-40 bg-background/95 backdrop-blur-sm">
        <div className="p-4 border-b border-foreground/10">
          <h1 className="text-2xl font-medium tracking-tight">Vé Của Tôi</h1>
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

      {isError && (
        <div className="px-4 py-3 border-b border-yellow-500/30 bg-yellow-500/10">
          <p className="font-mono text-[10px] text-yellow-200">
            Ticketing chưa sẵn sàng. Đang dùng vé fallback cho demo.
          </p>
        </div>
      )}

      {/* Tickets List */}
      <section className="p-4 space-y-4">
        {tickets.length > 0 ? (
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
      {tickets.length > 0 && (
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
