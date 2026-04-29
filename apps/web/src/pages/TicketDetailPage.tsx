import { ArrowLeft, Copy, ExternalLink } from "lucide-react";
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

  const copyText = async (value: string, label: string) => {
    await navigator.clipboard.writeText(value);
    toast({ title: "Da copy", description: `${label} da duoc copy` });
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
            Ve Cua Toi
          </Link>
        </header>
        <section className="p-4 py-16 text-center">
          <p className="font-mono text-sm text-foreground/50">
            {isError ? "Khong tai duoc du lieu ve" : "Khong tim thay ve nay"}
          </p>
          <Link
            to="/tickets"
            className="mt-4 inline-flex min-h-[44px] items-center border border-foreground px-5 font-mono text-xs uppercase"
          >
            Quay lai danh sach
          </Link>
        </section>
      </MobileLayout>
    );
  }

  const facts: Array<[string, string]> = [
    ["Loai ve", ticket.ticketType],
    ["Ngay gio", `${ticket.date} - ${ticket.time}`],
    ["Dia diem", ticket.location],
    ["Nguon du lieu", ticket.source],
    ["Trang thai sync", ticket.syncStatus],
    ["Event ID", ticket.eventId],
    ["Token ID", ticket.tokenId],
    ["Owner wallet", ticket.ownerWalletAddress ?? "Dang cap nhat"],
    ["Reservation", ticket.reservationId],
    ["Tx hash", ticket.transactionHash ?? "Chua co"]
  ];

  return (
    <MobileLayout>
      <header className="sticky safe-area-sticky-top z-40 border-b border-foreground/10 bg-background/95 backdrop-blur-sm">
        <div className="flex items-center gap-3 p-4">
          <Link
            to="/tickets"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center border border-foreground/20"
            aria-label="Quay lai danh sach ve"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-medium tracking-tight">{ticket.eventName}</h1>
            <p className="font-mono text-[10px] uppercase text-foreground/50">
              Token {shortId(ticket.tokenId)}
            </p>
          </div>
        </div>
      </header>

      {data?.status === "partial" && (
        <div className="border-b border-yellow-500/30 bg-yellow-500/10 px-4 py-3">
          <p className="font-mono text-[10px] text-yellow-200">
            Mot phan du lieu ticketing chua san sang. Dang hien thi du lieu da sync/local.
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
              Backend QR chua tao duoc. Local QR chi dung cho dev/fallback.
            </p>
          </div>
        )}

        <div className="divide-y divide-foreground/10 border border-foreground/20">
          {facts.map(([label, value]) => (
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
            onClick={() => void copyText(ticket.tokenId, "Token ID")}
            className="flex min-h-[44px] items-center justify-center gap-2 border border-foreground/20 px-3 font-mono text-[10px] uppercase"
          >
            <Copy className="h-4 w-4" />
            Copy token
          </button>
          <button
            type="button"
            onClick={() => void copyText(qr.qrValue, "QR payload")}
            disabled={!qr.qrValue}
            className="flex min-h-[44px] items-center justify-center gap-2 border border-foreground/20 px-3 font-mono text-[10px] uppercase disabled:opacity-50"
          >
            <Copy className="h-4 w-4" />
            Copy QR
          </button>
        </div>

        <Link
          to="/marketplace/sell"
          className="mt-3 flex min-h-[44px] items-center justify-center gap-2 border border-foreground/20 px-3 font-mono text-[10px] uppercase"
        >
          <ExternalLink className="h-4 w-4" />
          Ban lai tren marketplace
        </Link>
      </section>
    </MobileLayout>
  );
};

export default TicketDetailPage;
