import { useState } from "react";
import { ArrowLeft, ArrowLeftRight, Search, CheckCircle2, X } from "lucide-react";
import { Link } from "react-router-dom";
import MobileLayout from "@/components/mobile/MobileLayout";

const myTickets = [
  {
    id: "t1",
    event: "Cyber Symphony 2025",
    tier: "VIP",
    section: "A",
    row: "12",
    seat: "7",
    date: "15 Th3"
  },
  {
    id: "t2",
    event: "Neon Nights Festival",
    tier: "Phổ Thông",
    section: "C",
    row: "25",
    seat: "14",
    date: "22 Th4"
  }
];

const availableTrades = [
  {
    id: "tr1",
    user: "user_9f3m",
    verified: true,
    rating: 4.8,
    offering: { event: "Summer Slam", tier: "Khán Đài", date: "20 Th7" },
    seeking: ["Cyber Symphony 2025", "Neon Nights Festival"]
  },
  {
    id: "tr2",
    user: "user_k1px",
    verified: true,
    rating: 4.6,
    offering: { event: "Phantom Opera", tier: "VIP", date: "12 Th9" },
    seeking: ["Cyber Symphony 2025"]
  },
  {
    id: "tr3",
    user: "user_w7nj",
    verified: false,
    rating: 4.2,
    offering: { event: "Echo Chamber", tier: "Phổ Thông", date: "08 Th6" },
    seeking: ["Neon Nights Festival", "Đêm Hài Kịch"]
  },
  {
    id: "tr4",
    user: "user_a2lq",
    verified: true,
    rating: 5.0,
    offering: { event: "World Cup Final", tier: "VIP", date: "18 Th11" },
    seeking: ["Cyber Symphony 2025"]
  }
];

const TradePage = () => {
  const [selectedMyTicket, setSelectedMyTicket] = useState<string | null>(null);
  const [selectedTrade, setSelectedTrade] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"browse" | "create">("browse");

  const filteredTrades = availableTrades.filter((trade) =>
    trade.offering.event.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <MobileLayout>
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-foreground/10">
        <div className="flex items-center gap-3 p-4">
          <Link
            to="/marketplace"
            className="w-10 h-10 border border-foreground/20 flex items-center justify-center hover:bg-foreground/10 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-lg font-medium tracking-tight">Trao Đổi Vé</h1>
            <p className="font-mono text-[10px] text-foreground/50 tracking-wider">
              Đổi vé ngang hàng P2P
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-foreground/10">
          {(["browse", "create"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 font-mono text-[10px] tracking-widest transition-colors ${
                activeTab === tab
                  ? "text-foreground border-b-2 border-foreground"
                  : "text-foreground/40 hover:text-foreground/60"
              }`}
            >
              {tab === "browse" ? "TÌM ĐỔI" : "TẠO ĐỀ NGHỊ"}
            </button>
          ))}
        </div>
      </header>

      {activeTab === "browse" ? (
        <>
          {/* My ticket selection */}
          <section className="p-4 border-b border-foreground/10">
            <h3 className="font-mono text-[10px] tracking-widest text-foreground/50 mb-3">
              [ VÉ CỦA BẠN ]
            </h3>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide">
              {myTickets.map((ticket) => (
                <button
                  key={ticket.id}
                  onClick={() => setSelectedMyTicket(ticket.id)}
                  className={`flex-shrink-0 border p-3 min-w-[160px] text-left transition-colors ${
                    selectedMyTicket === ticket.id
                      ? "border-foreground bg-foreground/5"
                      : "border-foreground/20 hover:border-foreground/40"
                  }`}
                >
                  <span className="text-xs font-medium tracking-tight block">{ticket.event}</span>
                  <span className="font-mono text-[9px] text-foreground/50 block mt-1">
                    {ticket.tier} · {ticket.date}
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* Search */}
          <div className="px-4 py-3 border-b border-foreground/10">
            <div className="flex items-center gap-2 border border-foreground/20 px-3 py-2">
              <Search className="w-4 h-4 text-foreground/40" />
              <input
                type="text"
                placeholder="Tìm vé muốn đổi..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent font-mono text-xs w-full outline-none placeholder:text-foreground/30"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")}>
                  <X className="w-3.5 h-3.5 text-foreground/40" />
                </button>
              )}
            </div>
          </div>

          {/* Available Trades */}
          <section className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-mono text-[10px] tracking-widest text-foreground/50">
                [ ĐỀ NGHỊ ĐỔI ]
              </h3>
              <span className="font-mono text-[9px] text-foreground/40">
                {filteredTrades.length} kết quả
              </span>
            </div>

            <div className="space-y-3">
              {filteredTrades.map((trade) => (
                <button
                  key={trade.id}
                  onClick={() => setSelectedTrade(trade.id)}
                  className={`w-full text-left border transition-colors ${
                    selectedTrade === trade.id
                      ? "border-foreground"
                      : "border-foreground/20 hover:border-foreground/40"
                  }`}
                >
                  {/* What they offer */}
                  <div className="p-3 bg-foreground/5">
                    <span className="font-mono text-[8px] tracking-widest text-foreground/40">
                      ĐANG CÓ
                    </span>
                    <h4 className="text-sm font-medium tracking-tight mt-1">
                      {trade.offering.event}
                    </h4>
                    <p className="font-mono text-[10px] text-foreground/50 mt-0.5">
                      {trade.offering.tier} · {trade.offering.date}
                    </p>
                  </div>

                  {/* Swap icon */}
                  <div className="flex items-center justify-center py-1.5 border-y border-foreground/10">
                    <ArrowLeftRight className="w-3.5 h-3.5 text-foreground/30" />
                  </div>

                  {/* What they want */}
                  <div className="p-3">
                    <span className="font-mono text-[8px] tracking-widest text-foreground/40">
                      ĐANG TÌM
                    </span>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {trade.seeking.map((s) => (
                        <span
                          key={s}
                          className="px-2 py-0.5 border border-foreground/20 font-mono text-[9px]"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* User info */}
                  <div className="px-3 pb-3 flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-[9px] text-foreground/50">{trade.user}</span>
                      {trade.verified && <CheckCircle2 className="w-3 h-3 text-green-600" />}
                    </div>
                    <span className="font-mono text-[9px] text-foreground/40">
                      ★ {trade.rating}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* Trade CTA */}
          {selectedMyTicket && selectedTrade && (
            <div className="sticky bottom-16 p-4 bg-background/95 backdrop-blur-sm border-t border-foreground/10">
              <button className="w-full py-4 bg-foreground text-background font-medium tracking-tight hover:bg-foreground/90 transition-colors flex items-center justify-center gap-2">
                <ArrowLeftRight className="w-4 h-4" />
                Đề Nghị Trao Đổi
              </button>
            </div>
          )}
        </>
      ) : (
        /* Create Trade Tab */
        <>
          {/* Select your ticket */}
          <section className="p-4">
            <h3 className="font-mono text-[10px] tracking-widest text-foreground/50 mb-3">
              [ 01 — VÉ BẠN MUỐN ĐỔI ]
            </h3>
            <div className="space-y-2">
              {myTickets.map((ticket) => (
                <button
                  key={ticket.id}
                  onClick={() => setSelectedMyTicket(ticket.id)}
                  className={`w-full text-left border p-3 transition-colors ${
                    selectedMyTicket === ticket.id
                      ? "border-foreground bg-foreground/5"
                      : "border-foreground/20 hover:border-foreground/40"
                  }`}
                >
                  <span className="text-sm font-medium tracking-tight">{ticket.event}</span>
                  <p className="font-mono text-[10px] text-foreground/50 mt-0.5">
                    {ticket.tier} · {ticket.section}-{ticket.row}-{ticket.seat}
                  </p>
                </button>
              ))}
            </div>
          </section>

          {/* What you want */}
          <section className="px-4 pb-4">
            <h3 className="font-mono text-[10px] tracking-widest text-foreground/50 mb-3">
              [ 02 — BẠN MUỐN ĐỔI LẤY ]
            </h3>
            <div className="border border-foreground/20 p-4">
              <label className="font-mono text-[10px] text-foreground/50 block mb-2">
                Tên sự kiện
              </label>
              <input
                type="text"
                placeholder="VD: Summer Slam, Phantom Opera..."
                className="w-full bg-transparent border border-foreground/20 px-3 py-2.5 font-mono text-xs outline-none placeholder:text-foreground/20 focus:border-foreground/50 transition-colors"
              />

              <label className="font-mono text-[10px] text-foreground/50 block mb-2 mt-4">
                Hạng vé mong muốn
              </label>
              <div className="flex gap-2 flex-wrap">
                {["Phổ Thông", "VIP", "Platinum", "Bất kỳ"].map((tier) => (
                  <button
                    key={tier}
                    className="px-3 py-1.5 border border-foreground/20 font-mono text-[10px] hover:bg-foreground/10 transition-colors"
                  >
                    {tier}
                  </button>
                ))}
              </div>

              <label className="font-mono text-[10px] text-foreground/50 block mb-2 mt-4">
                Ghi chú thêm
              </label>
              <textarea
                placeholder="Mô tả thêm về yêu cầu trao đổi..."
                className="w-full bg-transparent border border-foreground/20 px-3 py-2.5 font-mono text-xs outline-none placeholder:text-foreground/20 focus:border-foreground/50 transition-colors resize-none h-20"
              />
            </div>
          </section>

          {/* Create CTA */}
          <div className="sticky bottom-16 p-4 bg-background/95 backdrop-blur-sm border-t border-foreground/10">
            <button
              disabled={!selectedMyTicket}
              className={`w-full py-4 font-medium tracking-tight transition-colors ${
                selectedMyTicket
                  ? "bg-foreground text-background hover:bg-foreground/90"
                  : "bg-foreground/20 text-foreground/40 cursor-not-allowed"
              }`}
            >
              Đăng Đề Nghị Trao Đổi
            </button>
          </div>
        </>
      )}
    </MobileLayout>
  );
};

export default TradePage;
