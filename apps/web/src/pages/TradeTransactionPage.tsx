import {
  ArrowLeft,
  ArrowLeftRight,
  CheckCircle2,
  Shield,
  Clock,
  MessageSquare,
  User,
  ArrowDown,
  ArrowUp
} from "lucide-react";
import { Link } from "react-router-dom";
import MobileLayout from "@/components/mobile/MobileLayout";

const theirTickets = [
  { id: "o1", event: "Summer Slam", tier: "VIP", seat: "8A" },
  { id: "o2", event: "Đêm Hài Kịch", tier: "Phổ Thông", seat: "15C" },
  { id: "o3", event: "Jazz In The Park", tier: "Premium", seat: "3D" }
];

const myTicket = {
  id: "m1",
  event: "Sự Kiện ABC",
  tier: "Premium",
  seat: "32B"
};

const TradeTransactionPage = () => {
  return (
    <MobileLayout>
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-foreground/10">
        <div className="flex items-center gap-3 p-4">
          <Link
            to="/marketplace/trade"
            className="w-10 h-10 border border-foreground/20 flex items-center justify-center hover:bg-foreground/10 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-medium tracking-tight">Đề Nghị Trao Đổi</h1>
            <p className="font-mono text-[10px] text-foreground/50 tracking-wider">
              TRADE-2025-0193
            </p>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 border border-foreground/20">
            <Clock className="w-3 h-3 text-foreground/50" />
            <span className="font-mono text-[9px] text-foreground/50">CHỜ</span>
          </div>
        </div>
      </header>

      {/* Trade Box — Steam style */}
      <section className="p-4">
        <div className="border border-foreground/20">
          {/* Their offer */}
          <div className="p-3 border-b border-foreground/10 bg-foreground/5">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-muted border border-foreground/20 flex items-center justify-center">
                <User className="w-3 h-3 text-foreground/50" />
              </div>
              <span className="text-xs font-medium">user_a2lq</span>
              <CheckCircle2 className="w-3 h-3 text-green-600" />
              <span className="font-mono text-[9px] text-foreground/40 ml-auto">đề nghị:</span>
            </div>
          </div>

          <div className="p-3">
            <div className="flex gap-2 flex-wrap">
              {theirTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="w-[calc(33.333%-6px)] aspect-square border border-foreground/20 bg-muted/30 flex flex-col overflow-hidden"
                >
                  {/* Seat number as mockup image */}
                  <div className="flex-1 flex items-center justify-center bg-foreground/10">
                    <span className="font-mono text-3xl font-bold text-foreground/20">
                      {ticket.seat}
                    </span>
                  </div>
                  <div className="p-2">
                    <span className="text-[11px] font-medium tracking-tight leading-tight block truncate">
                      {ticket.event}
                    </span>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="font-mono text-[8px] tracking-wider text-foreground/40 uppercase truncate">
                        {ticket.tier}
                      </span>
                      <span className="font-mono text-[8px] text-foreground/50">{ticket.seat}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="font-mono text-[9px] text-foreground/30">
                {theirTickets.length} vé
              </span>
              <span className="font-mono text-[10px] text-foreground/50">~6.200.000₫</span>
            </div>
          </div>

          {/* Swap divider */}
          <div className="flex items-center justify-center py-1.5 border-y border-foreground/10 bg-foreground/5">
            <div className="flex items-center gap-2">
              <ArrowDown className="w-3.5 h-3.5 text-foreground/30" />
              <ArrowUp className="w-3.5 h-3.5 text-foreground/30" />
            </div>
          </div>

          {/* Your ticket */}
          <div className="p-3 border-b border-foreground/10 bg-foreground/5">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-foreground text-background flex items-center justify-center">
                <span className="font-mono text-[9px] font-medium">B</span>
              </div>
              <span className="text-xs font-medium">Bạn</span>
              <span className="font-mono text-[9px] text-foreground/40 ml-auto">đổi lấy:</span>
            </div>
          </div>

          <div className="p-3">
            <div className="flex gap-2">
              <div className="w-[calc(33.333%-6px)] aspect-square border-2 border-foreground bg-muted/30 flex flex-col overflow-hidden">
                <div className="flex-1 flex items-center justify-center bg-foreground/10">
                  <span className="font-mono text-3xl font-bold text-foreground/20">
                    {myTicket.seat}
                  </span>
                </div>
                <div className="p-2">
                  <span className="text-[11px] font-medium tracking-tight leading-tight block truncate">
                    {myTicket.event}
                  </span>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="font-mono text-[8px] tracking-wider text-foreground/40 uppercase truncate">
                      {myTicket.tier}
                    </span>
                    <span className="font-mono text-[8px] text-foreground/50">{myTicket.seat}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="font-mono text-[9px] text-foreground/30">1 vé</span>
              <span className="font-mono text-[10px] text-foreground/50">~4.200.000₫</span>
            </div>
          </div>
        </div>
      </section>

      {/* Value summary — compact */}
      <section className="px-4 pb-3">
        <div className="border border-green-600/30 bg-green-600/5 p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-green-600" />
            <span className="font-mono text-[10px] text-green-600">Có lợi cho bạn</span>
          </div>
          <span className="font-mono text-xs font-medium text-green-600">+2.000.000₫</span>
        </div>
      </section>

      {/* Verification */}
      <section className="px-4 pb-3">
        <div className="flex items-center gap-4 py-2">
          {["Xác thực blockchain", "Atomic swap", "Hoàn tiền bảo đảm"].map((tag) => (
            <div key={tag} className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-green-600" />
              <span className="font-mono text-[8px] text-foreground/40">{tag}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Proposer info */}
      <section className="px-4 pb-4">
        <div className="border border-foreground/10 p-3 flex items-center justify-between">
          <div>
            <p className="font-mono text-[10px] text-foreground/50">
              ★ 5.0 · 31 giao dịch · Đề nghị 2h trước
            </p>
          </div>
          <button className="w-8 h-8 border border-foreground/20 flex items-center justify-center hover:bg-foreground/10 transition-colors">
            <MessageSquare className="w-3.5 h-3.5" />
          </button>
        </div>
      </section>

      {/* CTAs */}
      <div className="sticky bottom-16 p-4 bg-background/95 backdrop-blur-sm border-t border-foreground/10">
        <button className="w-full py-3 bg-foreground text-background text-sm font-medium tracking-tight hover:bg-foreground/90 transition-colors flex items-center justify-center gap-2">
          <ArrowLeftRight className="w-3.5 h-3.5" />
          Chấp Nhận Trao Đổi
        </button>
        <div className="flex gap-2 mt-1.5">
          <button className="flex-1 py-2 border border-foreground/20 font-mono text-[10px] text-foreground/50 hover:bg-foreground/10 transition-colors">
            Đàm Phán
          </button>
          <button className="flex-1 py-2 border border-red-500/30 font-mono text-[10px] text-red-500 hover:bg-red-500/10 transition-colors">
            Từ Chối
          </button>
        </div>
      </div>
    </MobileLayout>
  );
};

export default TradeTransactionPage;
