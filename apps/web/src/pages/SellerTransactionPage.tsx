import { ArrowLeft, Clock, CheckCircle2, Loader2, Shield, Copy, MessageSquare } from "lucide-react";
import { Link } from "react-router-dom";
import MobileLayout from "@/components/mobile/MobileLayout";

const steps = [
  { id: 1, label: "Đăng bán", status: "done" as const, time: "14:32" },
  { id: 2, label: "Có người muốn mua", status: "done" as const, time: "15:08" },
  { id: 3, label: "Đang thanh toán", status: "active" as const, time: "15:10" },
  { id: 4, label: "Xác nhận blockchain", status: "pending" as const },
  { id: 5, label: "Chuyển quyền sở hữu", status: "pending" as const },
  { id: 6, label: "Hoàn tất", status: "pending" as const }
];

const SellerTransactionPage = () => {
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
            <h1 className="text-lg font-medium tracking-tight">Đang Bán Vé</h1>
            <p className="font-mono text-[10px] text-foreground/50 tracking-wider">
              Giao dịch #TXN-2025-0847
            </p>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 border border-yellow-500/30 bg-yellow-500/10">
            <Loader2 className="w-3 h-3 text-yellow-600 animate-spin" />
            <span className="font-mono text-[9px] text-yellow-600 tracking-wider">ĐANG XỬ LÝ</span>
          </div>
        </div>
      </header>

      {/* Ticket being sold */}
      <section className="p-4">
        <p className="text-lg leading-relaxed text-foreground/40">
          Bạn đang bán vé <span className="text-foreground font-medium">32B</span> hạng{" "}
          <span className="text-foreground font-medium">Premium</span> cho{" "}
          <span className="text-foreground font-medium">Sự Kiện ABC</span> với giá{" "}
          <span className="text-foreground font-medium">4.200.000₫</span>.
        </p>
      </section>

      {/* Disclaimer */}
      <section className="px-4 pb-4">
        <div className="border border-green-500/20 bg-green-500/5 p-3">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-green-600 flex-shrink-0" />
            <span className="text-xs font-medium leading-none">
              Bảo vệ bởi công nghệ Smart Contract
            </span>
          </div>
          <div className="pl-6 mt-2 space-y-0.5">
            <p className="text-xs text-foreground/50">
              Vé của bạn sẽ được tự động chuyển cho người mua sau khi họ thanh toán.
            </p>
            <p className="text-xs text-foreground/50">Bạn không cần làm gì thêm.</p>
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
            <div key={step.id} className="flex gap-3 items-start">
              {/* Timeline line + dot */}
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

              {/* Content */}
              <div className="pb-8">
                <span
                  className={`block text-sm font-medium tracking-tight leading-6 ${
                    step.status === "pending" ? "text-foreground/30" : ""
                  }`}
                >
                  {step.label}
                </span>
                {step.time && (
                  <p className="font-mono text-[9px] text-foreground/40 mt-0.5">{step.time}</p>
                )}
                {step.status === "active" && (
                  <p className="font-mono text-[10px] text-foreground/50 mt-1">
                    Người mua đang xác nhận thanh toán...
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Buyer Info */}
      <section className="px-4 pb-4">
        <h3 className="font-mono text-[10px] tracking-widest text-foreground/50 mb-3">
          [ NGƯỜI MUA ]
        </h3>
        <div className="border border-foreground/20 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-muted border border-foreground/20 flex items-center justify-center">
                <span className="font-mono text-xs">N</span>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium">user_n4kp</span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                </div>
                <p className="font-mono text-[10px] text-foreground/50">★ 4.7 · 15 giao dịch</p>
              </div>
            </div>
            <button className="w-9 h-9 border border-foreground/20 flex items-center justify-center hover:bg-foreground/10 transition-colors">
              <MessageSquare className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* Earnings Breakdown */}
      <section className="px-4 pb-4">
        <h3 className="font-mono text-[10px] tracking-widest text-foreground/50 mb-3">
          [ THU NHẬP ]
        </h3>
        <div className="border border-foreground/20 divide-y divide-foreground/10">
          <div className="flex items-center justify-between p-3">
            <span className="font-mono text-xs text-foreground/60">Giá bán</span>
            <span className="font-mono text-xs">4.200.000₫</span>
          </div>
          <div className="flex items-center justify-between p-3">
            <span className="font-mono text-xs text-foreground/60">Phí nền tảng (5%)</span>
            <span className="font-mono text-xs text-red-500">-210.000₫</span>
          </div>
          <div className="flex items-center justify-between p-3">
            <span className="font-mono text-xs text-foreground/60">Phí blockchain</span>
            <span className="font-mono text-xs text-red-500">-15.000₫</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-foreground/5">
            <span className="font-mono text-sm font-medium">Bạn nhận được</span>
            <span className="text-lg font-medium tracking-tight">3.975.000₫</span>
          </div>
        </div>
      </section>

      {/* Transaction ID */}
      <section className="px-4 pb-6">
        <div className="border border-foreground/10 p-3 flex items-center justify-between">
          <div>
            <span className="font-mono text-[9px] text-foreground/40 block">Mã giao dịch</span>
            <span className="font-mono text-xs">0x8f3a...c4d2</span>
          </div>
          <button className="w-8 h-8 border border-foreground/20 flex items-center justify-center hover:bg-foreground/10 transition-colors">
            <Copy className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex items-start gap-2 mt-3 border border-foreground/10 p-3">
          <Shield className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
          <p className="font-mono text-[10px] text-foreground/50">
            Tiền sẽ được chuyển vào ví của bạn ngay khi giao dịch hoàn tất trên blockchain.
          </p>
        </div>
      </section>

      {/* Action */}
      <div className="sticky bottom-16 p-4 bg-background/95 backdrop-blur-sm border-t border-foreground/10">
        <button className="w-full py-3 border border-red-500/30 text-red-500 font-mono text-xs tracking-wider hover:bg-red-500/10 transition-colors">
          HỦY GIAO DỊCH
        </button>
      </div>
    </MobileLayout>
  );
};

export default SellerTransactionPage;
