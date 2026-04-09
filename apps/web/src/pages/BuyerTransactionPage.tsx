import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  Loader2,
  Shield,
  CreditCard,
  Copy,
  MessageSquare,
  AlertTriangle
} from "lucide-react";
import { Link } from "react-router-dom";
import MobileLayout from "@/components/mobile/MobileLayout";

const steps = [
  { id: 1, label: "Đặt mua", status: "done" as const, time: "15:08" },
  { id: 2, label: "Thanh toán", status: "active" as const, time: "15:10" },
  { id: 3, label: "Xác nhận blockchain", status: "pending" as const },
  { id: 4, label: "Chuyển quyền sở hữu", status: "pending" as const },
  { id: 5, label: "Vé về ví của bạn", status: "pending" as const }
];

const BuyerTransactionPage = () => {
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
          <div className="flex-1">
            <h1 className="text-lg font-medium tracking-tight">Đang Mua Vé</h1>
            <p className="font-mono text-[10px] text-foreground/50 tracking-wider">
              Giao dịch #TXN-2025-0847
            </p>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 border border-yellow-500/30 bg-yellow-500/10">
            <Clock className="w-3 h-3 text-yellow-600" />
            <span className="font-mono text-[9px] text-yellow-600 tracking-wider">09:42</span>
          </div>
        </div>
      </header>

      {/* Ticket being purchased */}
      <section className="p-4">
        <p className="text-lg leading-relaxed text-foreground/40">
          Bạn đang mua vé <span className="text-foreground font-medium">32B</span> hạng{" "}
          <span className="text-foreground font-medium">Premium</span> cho{" "}
          <span className="text-foreground font-medium">Sự Kiện ABC</span> với giá{" "}
          <span className="text-foreground font-medium">4.425.000₫</span>.
        </p>
      </section>

      {/* Disclaimer */}
      <section className="px-4 pb-4">
        <div className="border border-green-500/20 bg-green-500/5 p-3 flex items-start gap-3">
          <Shield className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <span className="text-xs font-medium">Bảo vệ bởi công nghệ Smart Contract</span>
            <p className="text-xs text-foreground/50 mt-1">
              Vé sẽ được tự động chuyển cho bạn sau khi thanh toán.
            </p>
          </div>
        </div>
      </section>

      {/* Timer warning */}
      <section className="px-4 pb-4">
        <div className="border border-yellow-500/30 bg-yellow-500/5 p-3 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <span className="text-xs font-medium text-yellow-600">
              Hoàn tất thanh toán trong 09:42
            </span>
            <p className="text-xs text-foreground/50 mt-0.5">
              Giao dịch sẽ tự động bị hủy khi hết thời gian.
            </p>
          </div>
        </div>
      </section>

      {/* Transaction Progress */}
      <section className="px-4 pb-4">
        <h3 className="font-mono text-[10px] tracking-widest text-foreground/50 mb-4">
          [ TIẾN TRÌNH ]
        </h3>
        <div className="space-y-0">
          {steps.map((step, i) => (
            <div key={step.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div
                  className={`w-6 h-6 flex items-center justify-center border ${
                    step.status === "done"
                      ? "border-green-600 bg-green-600"
                      : step.status === "active"
                        ? "border-foreground bg-foreground"
                        : "border-foreground/20"
                  }`}
                >
                  {step.status === "done" ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-background" />
                  ) : step.status === "active" ? (
                    <Loader2 className="w-3.5 h-3.5 text-background animate-spin" />
                  ) : (
                    <span className="font-mono text-[9px] text-foreground/30">{step.id}</span>
                  )}
                </div>
                {i < steps.length - 1 && (
                  <div
                    className={`w-px h-8 ${
                      step.status === "done" ? "bg-green-600" : "bg-foreground/10"
                    }`}
                  />
                )}
              </div>
              <div className="pb-8">
                <span
                  className={`text-sm font-medium tracking-tight ${
                    step.status === "pending" ? "text-foreground/30" : ""
                  }`}
                >
                  {step.label}
                </span>
                {step.time && (
                  <p className="font-mono text-[9px] text-foreground/40 mt-0.5">{step.time}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Payment Method */}
      <section className="px-4 pb-4">
        <h3 className="font-mono text-[10px] tracking-widest text-foreground/50 mb-3">
          [ PHƯƠNG THỨC THANH TOÁN ]
        </h3>
        <div className="space-y-2">
          {[
            { id: "wallet", label: "Ví Entr", balance: "5.200.000₫", active: true },
            { id: "card", label: "Visa •••• 4821", balance: null, active: false },
            { id: "crypto", label: "Ví Crypto (USDT)", balance: "~6.800.000₫", active: false }
          ].map((method) => (
            <button
              key={method.id}
              className={`w-full text-left border p-3 flex items-center justify-between transition-colors ${
                method.active
                  ? "border-foreground bg-foreground/5"
                  : "border-foreground/20 hover:border-foreground/40"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 border flex items-center justify-center ${
                    method.active ? "border-foreground bg-foreground" : "border-foreground/20"
                  }`}
                >
                  <CreditCard className={`w-3.5 h-3.5 ${method.active ? "text-background" : ""}`} />
                </div>
                <div>
                  <span className="text-sm font-medium tracking-tight">{method.label}</span>
                  {method.balance && (
                    <p className="font-mono text-[10px] text-foreground/50 mt-0.5">
                      Số dư: {method.balance}
                    </p>
                  )}
                </div>
              </div>
              <div
                className={`w-4 h-4 border flex items-center justify-center ${
                  method.active ? "border-foreground bg-foreground" : "border-foreground/30"
                }`}
              >
                {method.active && <div className="w-1.5 h-1.5 bg-background" />}
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Price Breakdown */}
      <section className="px-4 pb-4">
        <h3 className="font-mono text-[10px] tracking-widest text-foreground/50 mb-3">
          [ CHI TIẾT ]
        </h3>
        <div className="border border-foreground/20 divide-y divide-foreground/10">
          <div className="flex items-center justify-between p-3">
            <span className="font-mono text-xs text-foreground/60">Giá vé</span>
            <span className="font-mono text-xs">4.200.000₫</span>
          </div>
          <div className="flex items-center justify-between p-3">
            <span className="font-mono text-xs text-foreground/60">Phí nền tảng</span>
            <span className="font-mono text-xs">210.000₫</span>
          </div>
          <div className="flex items-center justify-between p-3">
            <span className="font-mono text-xs text-foreground/60">Phí blockchain</span>
            <span className="font-mono text-xs">15.000₫</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-foreground/5">
            <span className="font-mono text-sm font-medium">Tổng cộng</span>
            <span className="text-lg font-medium tracking-tight">4.425.000₫</span>
          </div>
        </div>
      </section>

      {/* Seller */}
      <section className="px-4 pb-4">
        <div className="border border-foreground/10 p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-foreground/40">Người bán:</span>
            <span className="font-mono text-xs">user_8x2k</span>
            <CheckCircle2 className="w-3 h-3 text-green-600" />
          </div>
          <button className="w-8 h-8 border border-foreground/20 flex items-center justify-center hover:bg-foreground/10 transition-colors">
            <MessageSquare className="w-3.5 h-3.5" />
          </button>
        </div>
      </section>

      {/* Blockchain */}
      <section className="px-4 pb-6">
        <div className="border border-foreground/10 p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-green-600" />
            <span className="font-mono text-[10px] text-foreground/50">0x8f3a...c4d2</span>
          </div>
          <button className="w-8 h-8 border border-foreground/20 flex items-center justify-center hover:bg-foreground/10 transition-colors">
            <Copy className="w-3.5 h-3.5" />
          </button>
        </div>
      </section>

      {/* CTA */}
      <div className="sticky bottom-16 p-4 bg-background/95 backdrop-blur-sm border-t border-foreground/10">
        <button className="w-full py-4 bg-foreground text-background font-medium tracking-tight hover:bg-foreground/90 transition-colors">
          Xác Nhận Thanh Toán · 4.425.000₫
        </button>
        <button className="w-full py-3 mt-2 border border-foreground/20 font-mono text-xs text-foreground/50 hover:bg-foreground/10 transition-colors">
          Hủy Giao Dịch
        </button>
      </div>
    </MobileLayout>
  );
};

export default BuyerTransactionPage;
