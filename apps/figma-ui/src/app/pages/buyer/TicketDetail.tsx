import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router";
import { ArrowLeft, Calendar, MapPin, DollarSign, AlertCircle, RefreshCw, ShieldCheck, Clock } from "lucide-react";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Banner } from "../../components/ui/Banner";
import { QRCodeDisplay } from "../../components/QRCodeDisplay";
import { mockTickets, mockEvents } from "../../lib/mockData";
import { formatCurrency, formatDate, isWithinResaleCutoff } from "../../lib/utils";
import { toast } from "sonner";
import { cancelResaleListing, encodeQrPayload, loadEvent, loadTicketById, loadTicketQr } from "../../lib/live-data";
import type { Event, Ticket } from "../../lib/types";

export function TicketDetail() {
  const { ticketId } = useParams();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [qrValue, setQrValue] = useState("");
  const [countdown, setCountdown] = useState(3);
  const [canceling, setCanceling] = useState(false);

  useEffect(() => {
    if (!ticketId) {
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);

    loadTicketById(ticketId)
      .then(async (nextTicket) => {
        if (!active) {
          return;
        }

        if (!nextTicket) {
          setTicket(null);
          setEvent(null);
          return;
        }

        setTicket(nextTicket);

        try {
          const nextEvent = await loadEvent(nextTicket.eventId);
          if (active) {
            setEvent(nextEvent);
          }
        } catch {
          if (active) {
            setEvent(mockEvents.find((item) => item.id === nextTicket.eventId) ?? null);
          }
        }

        try {
          const qr = await loadTicketQr(nextTicket.id);
          if (active) {
            setQrValue(encodeQrPayload(qr));
          }
        } catch {
          if (active) {
            setQrValue(`${nextTicket.qrCode}-${Math.floor(Date.now() / 3000)}`);
          }
        }

        setLoadError(null);
      })
      .catch((error) => {
        if (!active) {
          return;
        }

        setTicket(mockTickets.find((item) => item.id === ticketId) ?? null);
        setEvent(mockEvents.find((item) => item.id === ticketId) ?? null);
        setLoadError(error instanceof Error ? error.message : "Không thể tải vé live.");
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [ticketId]);

  useEffect(() => {
    if (!ticket || ticket.status === "used" || ticket.status === "expired") {
      return;
    }

    let active = true;

    const qrInterval = setInterval(async () => {
      setCountdown(3);
      try {
        const qr = await loadTicketQr(ticket.id);
        if (active) {
          setQrValue(encodeQrPayload(qr));
        }
      } catch {
        if (active) {
          setQrValue(`${ticket.qrCode}-${Math.floor(Date.now() / 3000)}`);
        }
      }
    }, 3000);

    const countdownInterval = setInterval(() => {
      setCountdown((prev) => (prev > 1 ? prev - 1 : 3));
    }, 1000);

    return () => {
      active = false;
      clearInterval(qrInterval);
      clearInterval(countdownInterval);
    };
  }, [ticket]);

  if (loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Đang tải vé...</div>;
  }

  if (!ticket || !event) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <Card className="text-center max-w-md p-8">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Không tìm thấy vé</h2>
          <p className="text-gray-600 mb-6 text-sm">Vé này không tồn tại hoặc đã bị xóa.</p>
          <Button onClick={() => navigate("/tickets")}>Quay lại danh sách vé</Button>
        </Card>
      </div>
    );
  }

  const eventDate = new Date(event.date);
  const isResaleCutoff = isWithinResaleCutoff(eventDate);
  const canResale = ticket.status === "active" && !isResaleCutoff;

  const statusConfig = {
    active: { label: "Có hiệu lực", color: "text-green-700", bg: "bg-green-100" },
    resale: { label: "Đang bán lại", color: "text-orange-700", bg: "bg-orange-100" },
    used: { label: "Đã sử dụng", color: "text-gray-600", bg: "bg-gray-100" },
    expired: { label: "Đã hết hạn", color: "text-red-700", bg: "bg-red-100" }
  } as const;

  const statusCfg = statusConfig[ticket.status];

  const handleCancelListing = async () => {
    if (!ticket.resaleListingId) {
      return;
    }

    setCanceling(true);
    try {
      await cancelResaleListing(ticket.resaleListingId);
      setTicket({ ...ticket, status: "active", resaleListingId: undefined });
      toast.success("Đã hủy niêm yết resale.");
    } catch (error) {
      toast.error("Hủy niêm yết thất bại", {
        description: error instanceof Error ? error.message : "Không thể hủy niêm yết."
      });
    } finally {
      setCanceling(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <div className="flex-1">
              <h1 className="text-base font-semibold text-gray-900">Chi tiết vé</h1>
              <p className="text-xs text-gray-500">#{ticket.id}</p>
            </div>
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusCfg.color} ${statusCfg.bg}`}>
              {statusCfg.label}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
        {loadError && <Banner type="warning">{loadError}</Banner>}
        {ticket.status === "resale" && (
          <Banner type="info" title="Vé đang được bán lại">
            Vé này đang được niêm yết trên sàn giao dịch. Bạn có thể hủy niêm yết bất cứ lúc nào.
          </Banner>
        )}
        {isResaleCutoff && ticket.status === "active" && (
          <Banner type="warning" title="Đã khóa bán lại">
            Đã quá thời hạn T-30 phút. Vé không thể bán lại nữa — vui lòng sử dụng để vào sự kiện.
          </Banner>
        )}

        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
          <div className="relative h-28 overflow-hidden">
            <img src={event.imageUrl} alt={event.title} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/30 to-black/60" />
            <div className="absolute bottom-3 left-4 right-4">
              <div className="inline-block px-2.5 py-1 bg-white/20 backdrop-blur-sm rounded-full text-white text-xs mb-1">
                {ticket.tierName}
              </div>
              <h2 className="text-white font-semibold text-sm line-clamp-1">{ticket.eventTitle}</h2>
            </div>
          </div>

          <div className="p-6 text-center">
            <div className="relative inline-block mb-4">
              <div className="p-4 bg-white rounded-2xl shadow-inner border-2 border-gray-100 inline-block">
                <QRCodeDisplay value={qrValue || ticket.qrCode} size={200} />
              </div>
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1 bg-violet-600 text-white text-xs rounded-full shadow-lg">
                <RefreshCw className="w-3 h-3 animate-spin" style={{ animationDuration: "2s" }} />
                Làm mới sau {countdown}s
              </div>
            </div>

            <div className="mt-6 space-y-2">
              <div className="flex items-center justify-center gap-2 text-green-600">
                <ShieldCheck className="w-4 h-4" />
                <span className="text-sm font-medium">QR động bảo mật • Refresh mỗi 3 giây</span>
              </div>
              <p className="text-xs text-gray-400 font-mono">{ticket.qrCode}</p>
            </div>
          </div>
        </div>

        <Card>
          <h3 className="font-semibold text-gray-900 mb-4">Thông tin sự kiện</h3>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Calendar className="w-4 h-4 text-violet-500 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-xs text-gray-500">Thời gian</div>
                <div className="text-sm font-medium text-gray-900">{formatDate(ticket.eventDate)}</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MapPin className="w-4 h-4 text-violet-500 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-xs text-gray-500">Địa điểm</div>
                <div className="text-sm font-medium text-gray-900">{ticket.eventVenue}</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <DollarSign className="w-4 h-4 text-violet-500 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-xs text-gray-500">Giá gốc</div>
                <div className="text-sm font-medium text-gray-900">{formatCurrency(ticket.faceValue)}</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Clock className="w-4 h-4 text-violet-500 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-xs text-gray-500">Ngày mua</div>
                <div className="text-sm font-medium text-gray-900">{formatDate(ticket.purchaseDate)}</div>
              </div>
            </div>
          </div>
        </Card>

        <div className="space-y-3">
          {canResale && (
            <Link to={`/resale/create/${ticket.id}`}>
              <Button fullWidth variant="outline" size="lg">
                Bán lại vé
              </Button>
            </Link>
          )}
          {ticket.status === "resale" && (
            <Button fullWidth variant="destructive" size="lg" onClick={handleCancelListing} disabled={canceling}>
              {canceling ? "Đang hủy..." : "Hủy niêm yết"}
            </Button>
          )}
        </div>

        <Banner type="info">
          <strong>Bảo mật:</strong> Giữ QR code bảo mật. Nhân viên quét mã này tại cổng vào. Mỗi vé chỉ được quét một
          lần.
        </Banner>
      </div>
    </div>
  );
}
