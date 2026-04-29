import { useState } from "react";
import { ArrowLeft, Tag, Info, TrendingUp, TrendingDown, Minus } from "lucide-react";
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
    originalPrice: "3.500.000₫",
    date: "15 Th3"
  },
  {
    id: "t2",
    event: "Neon Nights Festival",
    tier: "Phổ Thông",
    section: "C",
    row: "25",
    seat: "14",
    originalPrice: "950.000₫",
    date: "22 Th4"
  },
  {
    id: "t3",
    event: "Summer Slam",
    tier: "Khán Đài",
    section: "B",
    row: "8",
    seat: "3",
    originalPrice: "2.100.000₫",
    date: "20 Th7"
  }
];

const priceHistory = [
  { label: "Sàn hiện tại", value: "3.200.000₫" },
  { label: "Trung bình 7 ngày", value: "3.450.000₫" },
  { label: "Cao nhất", value: "5.100.000₫" },
  { label: "Thấp nhất", value: "2.800.000₫" }
];

const ResaleSalePage = () => {
  const [selectedTicket, setSelectedTicket] = useState<string | null>(null);
  const [price, setPrice] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);

  const selected = myTickets.find((t) => t.id === selectedTicket);

  return (
    <MobileLayout>
      {/* Header */}
      <header className="sticky safe-area-sticky-top z-40 bg-background/95 backdrop-blur-sm border-b border-foreground/10">
        <div className="flex items-center gap-3 p-4">
          <Link
            to="/marketplace"
            className="w-10 h-10 border border-foreground/20 flex items-center justify-center hover:bg-foreground/10 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-lg font-medium tracking-tight">Đăng Bán Vé</h1>
            <p className="font-mono text-[10px] text-foreground/50 tracking-wider">
              Bán vé trên chợ thứ cấp
            </p>
          </div>
        </div>
      </header>

      {/* Step 1: Select Ticket */}
      <section className="p-4">
        <h3 className="font-mono text-[10px] tracking-widest text-foreground/50 mb-3">
          [ 01 — CHỌN VÉ ]
        </h3>
        <div className="space-y-2">
          {myTickets.map((ticket) => (
            <button
              key={ticket.id}
              onClick={() => setSelectedTicket(ticket.id)}
              className={`w-full text-left border p-4 transition-colors ${
                selectedTicket === ticket.id
                  ? "border-foreground bg-foreground/5"
                  : "border-foreground/20 hover:border-foreground/40"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium tracking-tight">{ticket.event}</h4>
                  <p className="font-mono text-[10px] text-foreground/50 mt-0.5">
                    {ticket.tier} · {ticket.section}-{ticket.row}-{ticket.seat} · {ticket.date}
                  </p>
                </div>
                <div
                  className={`w-5 h-5 border flex items-center justify-center ${
                    selectedTicket === ticket.id
                      ? "border-foreground bg-foreground"
                      : "border-foreground/30"
                  }`}
                >
                  {selectedTicket === ticket.id && <div className="w-2 h-2 bg-background" />}
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Tag className="w-3 h-3 text-foreground/40" />
                <span className="font-mono text-[10px] text-foreground/40">
                  Giá gốc: {ticket.originalPrice}
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Step 2: Market Data */}
      {selected && (
        <section className="px-4 pb-4">
          <h3 className="font-mono text-[10px] tracking-widest text-foreground/50 mb-3">
            [ 02 — THAM KHẢO GIÁ ]
          </h3>
          <div className="border border-foreground/20 divide-y divide-foreground/10">
            {priceHistory.map((item) => (
              <div key={item.label} className="flex items-center justify-between p-3">
                <span className="font-mono text-[10px] text-foreground/50">{item.label}</span>
                <span className="font-mono text-xs font-medium">{item.value}</span>
              </div>
            ))}
          </div>

          <div className="mt-3 border border-foreground/10 p-3 flex items-start gap-2">
            <TrendingUp className="w-3.5 h-3.5 text-green-600 mt-0.5 flex-shrink-0" />
            <p className="font-mono text-[10px] text-foreground/50">
              Giá sàn tăng 12% trong 7 ngày. Nhu cầu cao cho hạng {selected.tier}.
            </p>
          </div>
        </section>
      )}

      {/* Step 3: Set Price */}
      {selected && (
        <section className="px-4 pb-4">
          <h3 className="font-mono text-[10px] tracking-widest text-foreground/50 mb-3">
            [ 03 — ĐẶT GIÁ ]
          </h3>
          <div className="border border-foreground/20 p-4">
            <label className="font-mono text-[10px] text-foreground/50 block mb-2">
              Giá bán (₫)
            </label>
            <div className="flex items-center border border-foreground/20">
              <input
                type="text"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0"
                className="flex-1 bg-transparent px-4 py-3 text-xl font-medium tracking-tight outline-none placeholder:text-foreground/20"
              />
              <span className="pr-4 font-mono text-sm text-foreground/40">₫</span>
            </div>

            {/* Quick price buttons */}
            <div className="flex gap-2 mt-3">
              {[
                { label: "Sàn", icon: Minus, value: "3200000" },
                { label: "+10%", icon: TrendingUp, value: "3850000" },
                { label: "+20%", icon: TrendingUp, value: "4200000" }
              ].map((btn) => (
                <button
                  key={btn.label}
                  onClick={() => setPrice(btn.value)}
                  className="flex-1 py-2 border border-foreground/20 font-mono text-[10px] hover:bg-foreground/10 transition-colors"
                >
                  {btn.label}
                </button>
              ))}
            </div>

            {/* Fee preview */}
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-foreground/40">Phí nền tảng (5%)</span>
                <span className="font-mono text-[10px] text-foreground/40">
                  {price ? `${Math.round(Number(price) * 0.05).toLocaleString("vi-VN")}₫` : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-foreground/40">Bạn nhận được</span>
                <span className="font-mono text-xs font-medium">
                  {price ? `${Math.round(Number(price) * 0.95).toLocaleString("vi-VN")}₫` : "—"}
                </span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Terms */}
      {selected && price && (
        <section className="px-4 pb-4">
          <div className="border border-foreground/10 p-3 flex items-start gap-3">
            <Info className="w-4 h-4 text-foreground/40 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-mono text-[10px] text-foreground/50">
                Khi đăng bán, vé sẽ bị khóa và không thể sử dụng cho đến khi gỡ bán. Nếu bán thành
                công, vé sẽ tự động chuyển quyền sở hữu.
              </p>
              <button
                onClick={() => setAcceptTerms(!acceptTerms)}
                className="flex items-center gap-2 mt-3"
              >
                <div
                  className={`w-4 h-4 border flex items-center justify-center ${
                    acceptTerms ? "border-foreground bg-foreground" : "border-foreground/30"
                  }`}
                >
                  {acceptTerms && <div className="w-1.5 h-1.5 bg-background" />}
                </div>
                <span className="font-mono text-[10px] text-foreground/60">
                  Tôi đồng ý điều khoản bán lại
                </span>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      {selected && (
        <div className="sticky bottom-16 p-4 bg-background/95 backdrop-blur-sm border-t border-foreground/10">
          <button
            disabled={!price || !acceptTerms}
            className={`w-full py-4 font-medium tracking-tight transition-colors ${
              price && acceptTerms
                ? "bg-foreground text-background hover:bg-foreground/90"
                : "bg-foreground/20 text-foreground/40 cursor-not-allowed"
            }`}
          >
            Đăng Bán Vé
          </button>
        </div>
      )}
    </MobileLayout>
  );
};

export default ResaleSalePage;
