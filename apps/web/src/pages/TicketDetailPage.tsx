import { ArrowLeft, ChevronDown, Copy, ExternalLink } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "@ticket-platform/shared-ui";

import MobileLayout from "@/components/mobile/MobileLayout";
import TicketQrPanel from "@/components/mobile/TicketQrPanel";
import { useTicketDetail } from "@/hooks/use-ticket-detail";
import { useTicketQr } from "@/hooks/use-ticket-qr";

function shortId(value: string): string {
  return value.length > 14 ? `${value.slice(0, 8)}...${value.slice(-4)}` : value;
}

const fieldClass = "font-mono text-[10px] uppercase text-foreground/40";

const TicketDetailPage = () => {
  const { id } = useParams();
  const { ticket, isLoading, isError, data } = useTicketDetail(id);
  const qr = useTicketQr(ticket);

  const [showTechDetails, setShowTechDetails] = useState(false);

  const copyText = async (value: string, label: string) => {
    await navigator.clipboard.writeText(value);
    toast({ title: "Đã copy", description: `${label} đã được copy` });
  };

  if (isLoading) {
    return (
      <MobileLayout>
        <div className="p-4">
          <div className="h-10 w-36 animate-pulse bg-foreground/10" />
          <div className="mt-6 aspect-square animate-pulse bg-foreground/10" />
          <div className="mt-6 h-44 animate-pulse bg-foreground/10" />
        </div>
      </MobileLayout>
    );
  }

  if (!ticket) {
    return (
      <MobileLayout>
        <header className="sticky safe-area-sticky-top z-40 border-b border-foreground/10 bg-background/95 p-4 backdrop-blur-sm">
          <Link
            to="/tickets"
            className="flex min-h-[44px] items-center gap-2 text-sm text-foreground/70"
          >
            <ArrowLeft className="h-4 w-4" />
            Vé Của Tôi
          </Link>
        </header>
        <section className="p-4 py-16 text-center">
          <p className="font-mono text-sm text-foreground/50">
            {isError ? "Không tải được dữ liệu vé" : "Không tìm thấy vé này"}
          </p>
          <Link
            to="/tickets"
            className="mt-4 inline-flex min-h-[44px] items-center border border-foreground px-5 font-mono text-xs uppercase"
          >
            Quay lại danh sách
          </Link>
        </section>
      </MobileLayout>
    );
  }

  const userFacts: Array<[string, string]> = [
    ["Loại vé", ticket.ticketType],
    ["Ngày giờ", `${ticket.date} · ${ticket.time}`],
    ["Địa điểm", ticket.location],
    ["Chỗ ngồi", ticket.seatInfo]
  ];

  const techFacts: Array<[string, string]> = [
    ["Token ID", ticket.tokenId],
    ["Event ID", ticket.eventId],
    ["Owner wallet", ticket.ownerWalletAddress ?? "Chưa có"],
    ["Reservation", ticket.reservationId],
    ["Tx hash", ticket.transactionHash ?? "Chưa có"],
    ["Nguồn dữ liệu", ticket.source],
    ["Trạng thái sync", ticket.syncStatus]
  ];

  return (
    <MobileLayout>
      <header className="sticky safe-area-sticky-top z-40 border-b border-foreground/10 bg-background/95 backdrop-blur-sm">
        <div className="flex items-center gap-3 p-4">
          <Link
            to="/tickets"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center border border-foreground/20"
            aria-label="Quay lại danh sách vé"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-medium tracking-tight">{ticket.eventName}</h1>
            <p className="font-mono text-[10px] uppercase text-foreground/50">
              {ticket.ticketType}
            </p>
          </div>
        </div>
      </header>

      {data?.status === "partial" && (
        <div className="border-b border-yellow-500/30 bg-yellow-500/10 px-4 py-3">
          <p className="font-mono text-[10px] text-yellow-200">
            Một phần dữ liệu chưa sẵn sàng. Đang hiển thị dữ liệu đã sync.
          </p>
        </div>
      )}

      <TicketQrPanel
        value={qr.qrValue}
        source={qr.source}
        secondsRemaining={qr.secondsRemaining}
        isLoading={qr.isLoading}
        isFetching={qr.isFetching}
        onRefresh={() => void qr.refresh()}
      />

      <section className="px-4 pb-6">
        {qr.isBackendError && qr.source === "local" && (
          <div className="mb-4 border border-yellow-500/30 bg-yellow-500/10 p-3">
            <p className="font-mono text-[10px] text-yellow-200">
              Backend QR chưa tạo được. Local QR chỉ dùng cho dev/fallback.
            </p>
          </div>
        )}

        <div className="divide-y divide-foreground/10 border border-foreground/20">
          {userFacts.map(([label, value]) => (
            <div key={label} className="flex items-start justify-between gap-4 p-3">
              <span className={fieldClass}>{label}</span>
              <span className="max-w-[62%] break-all text-right font-mono text-xs text-foreground/80">
                {value}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => void copyText(qr.qrValue, "QR payload")}
            disabled={!qr.qrValue}
            className="flex min-h-[44px] items-center justify-center gap-2 border border-foreground/20 px-3 font-mono text-[10px] uppercase disabled:opacity-50"
          >
            <Copy className="h-4 w-4" />
            Copy QR
          </button>
          <Link
            to="/marketplace/sell"
            className="flex min-h-[44px] items-center justify-center gap-2 border border-foreground/20 px-3 font-mono text-[10px] uppercase"
          >
            <ExternalLink className="h-4 w-4" />
            Bán lại
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setShowTechDetails((v) => !v)}
          className="mt-6 flex w-full items-center justify-between border-t border-foreground/10 pt-4 font-mono text-[10px] uppercase text-foreground/35 hover:text-foreground/55"
        >
          Chi tiết kỹ thuật
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform ${showTechDetails ? "rotate-180" : ""}`}
          />
        </button>

        {showTechDetails && (
          <div className="mt-3 divide-y divide-foreground/10 border border-foreground/15">
            {techFacts.map(([label, value]) => (
              <div key={label} className="flex items-start justify-between gap-4 p-3">
                <span className={fieldClass}>{label}</span>
                <div className="flex max-w-[62%] items-center gap-1.5">
                  <span className="break-all text-right font-mono text-[10px] text-foreground/50">
                    {value}
                  </span>
                  <button
                    type="button"
                    onClick={() => void copyText(value, label)}
                    className="shrink-0 text-foreground/30 hover:text-foreground/60"
                    aria-label={`Copy ${label}`}
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </MobileLayout>
  );
};

export default TicketDetailPage;
