import { RefreshCw, ShieldCheck, WifiOff } from "lucide-react";
import QRCode from "react-qr-code";

interface TicketQrPanelProps {
  value: string;
  source: "backend" | "local" | null;
  secondsRemaining: number;
  isLoading: boolean;
  isFetching: boolean;
  onRefresh: () => void;
}

const TicketQrPanel = ({
  value,
  source,
  secondsRemaining,
  isLoading,
  isFetching,
  onRefresh
}: TicketQrPanelProps) => {
  const isLocal = source === "local";
  const label =
    source === "backend" ? "Backend QR" : source === "local" ? "Local QR" : "QR chưa sẵn sàng";

  return (
    <section className="px-4 py-5">
      <div className="border border-foreground/20 bg-card p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {isLocal ? (
              <WifiOff className="h-4 w-4 text-yellow-300" />
            ) : (
              <ShieldCheck className="h-4 w-4 text-green-400" />
            )}
            <span className="font-mono text-[10px] uppercase text-foreground/60">{label}</span>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center border border-foreground/20 transition-colors hover:bg-foreground/10 disabled:opacity-50"
            disabled={isLoading || isFetching}
            aria-label="Làm mới QR"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </button>
        </div>

        <div className="mx-auto flex aspect-square w-full max-w-[280px] items-center justify-center bg-white p-4">
          {value ? (
            <QRCode value={value} size={240} bgColor="#ffffff" fgColor="#000000" />
          ) : (
            <span className="font-mono text-xs text-black/50">Đang tạo QR</span>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 font-mono text-[10px] text-foreground/50">
          <span>{isLocal ? "Dùng tạm khi backend QR lỗi" : "QR ngắn hạn"}</span>
          <span>{secondsRemaining > 0 ? `Làm mới sau ${secondsRemaining}s` : "Đang làm mới"}</span>
        </div>
      </div>
    </section>
  );
};

export default TicketQrPanel;
