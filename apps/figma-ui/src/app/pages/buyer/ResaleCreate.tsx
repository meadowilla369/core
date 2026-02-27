import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Banner } from "../../components/ui/Banner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter
} from "../../components/ui/dialog";
import { formatCurrency, calculateResaleMax, calculateSellerPayout, requiresKYC, isWithinResaleCutoff } from "../../lib/utils";
import { toast } from "sonner";
import { createResaleListing, isApiRequestError, loadEvent, loadTicketById } from "../../lib/live-data";
import type { Event, Ticket } from "../../lib/types";

export function ResaleCreate() {
  const { ticketId } = useParams();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [askPrice, setAskPrice] = useState("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showKYCDialog, setShowKYCDialog] = useState(false);

  useEffect(() => {
    if (!ticketId) {
      setLoading(false);
      return;
    }

    let active = true;

    Promise.all([loadTicketById(ticketId)])
      .then(async ([nextTicket]) => {
        if (!active) {
          return;
        }

        if (!nextTicket) {
          setTicket(null);
          setEvent(null);
          return;
        }

        setTicket(nextTicket);
        const nextEvent = await loadEvent(nextTicket.eventId);
        if (active) {
          setEvent(nextEvent);
        }
      })
      .catch(() => {
        if (active) {
          setTicket(null);
          setEvent(null);
        }
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

  if (loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Đang tải dữ liệu vé...</div>;
  }

  if (!ticket || !event) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <Card className="text-center max-w-md p-8">
          <h2 className="text-xl font-semibold mb-2">Không tìm thấy vé</h2>
          <Button onClick={() => navigate("/tickets")}>Quay lại danh sách vé</Button>
        </Card>
      </div>
    );
  }

  const faceValue = ticket.faceValue;
  const maxPrice = calculateResaleMax(faceValue);
  const askPriceNum = parseFloat(askPrice) || 0;
  const eventDate = new Date(event.date);
  const isResaleCutoff = isWithinResaleCutoff(eventDate);

  const isBelowFaceValue = askPriceNum > 0 && askPriceNum < faceValue;
  const isAboveMax = askPriceNum > maxPrice;
  const isValid = askPriceNum > 0 && !isAboveMax;

  const { sellerAmount, platformFee, organizerFee } = calculateSellerPayout(askPriceNum, faceValue);
  const needsKYC = requiresKYC(askPriceNum);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValid) return;

    if (isResaleCutoff) {
      toast.error("Đã quá thời hạn bán lại vé");
      return;
    }

    if (needsKYC) {
      setShowKYCDialog(true);
    } else {
      setShowConfirmDialog(true);
    }
  };

  const handleConfirmResale = async () => {
    try {
      await createResaleListing({
        ticketId: ticket.id,
        eventId: ticket.eventId,
        eventStartAt: event.date,
        originalPrice: faceValue,
        askPrice: askPriceNum
      });

      toast.success("Vé đã được niêm yết!", {
        description: "Vé của bạn đã được đưa lên sàn giao dịch"
      });
      navigate(`/ticket/${ticketId}`);
    } catch (error) {
      if (isApiRequestError(error) && error.code === "KYC_REQUIRED") {
        setShowConfirmDialog(false);
        setShowKYCDialog(true);
        return;
      }

      toast.error("Niêm yết thất bại", {
        description: error instanceof Error ? error.message : "Không thể tạo listing resale."
      });
    }
  };

  const handleKYCRedirect = () => {
    navigate("/kyc", { state: { returnTo: `/resale/create/${ticketId}` } });
  };

  if (isResaleCutoff) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(-1)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors min-w-[44px] min-h-[44px]"
              >
                <ArrowLeft className="w-6 h-6 text-gray-700" />
              </button>
              <h1 className="text-lg font-semibold text-gray-900">Bán lại vé</h1>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-6">
          <Banner type="error" title="Không thể bán lại vé">
            Đã quá thời hạn bán lại vé (trước sự kiện 30 phút). Tất cả giao dịch bán lại đã bị khóa.
          </Banner>
          <div className="mt-6">
            <Button onClick={() => navigate(`/ticket/${ticketId}`)} fullWidth>
              Xem chi tiết vé
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors min-w-[44px] min-h-[44px]"
            >
              <ArrowLeft className="w-6 h-6 text-gray-700" />
            </button>
            <h1 className="text-lg font-semibold text-gray-900">Bán lại vé</h1>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <Card>
          <h3 className="font-medium text-gray-900 mb-2">{ticket.eventTitle}</h3>
          <div className="text-sm text-gray-600">
            <div>Loại vé: {ticket.tierName}</div>
            <div>Giá gốc: {formatCurrency(faceValue)}</div>
          </div>
        </Card>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Đặt giá bán lại</h2>

            <Input
              label="Giá bán (VND)"
              type="number"
              value={askPrice}
              onChange={(e) => setAskPrice(e.target.value)}
              error={isAboveMax ? `Giá bán tối đa là ${formatCurrency(maxPrice)} (120% giá gốc)` : undefined}
              helperText={!isAboveMax && askPriceNum > 0 ? `Giá tối đa cho phép: ${formatCurrency(maxPrice)}` : undefined}
            />

            {isBelowFaceValue && (
              <Banner type="warning" className="mt-4">
                Bạn đang bán dưới giá gốc. Bạn sẽ bị lỗ {formatCurrency(faceValue - askPriceNum)}.
              </Banner>
            )}

            {needsKYC && isValid && (
              <Banner type="info" className="mt-4">
                <strong>Yêu cầu xác thực danh tính (KYC)</strong>
                <br />
                Giao dịch từ 5,000,000 VND trở lên yêu cầu xác thực danh tính theo quy định.
              </Banner>
            )}
          </Card>

          {isValid && (
            <Card>
              <h3 className="font-medium text-gray-900 mb-4">Chi tiết thanh toán</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Giá bán (người mua trả)</span>
                  <span className="font-medium">{formatCurrency(askPriceNum)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Phí nền tảng (5% giá bán)</span>
                  <span className="text-red-600">-{formatCurrency(platformFee)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Phí ban tổ chức (5% giá bán)</span>
                  <span className="text-red-600">-{formatCurrency(organizerFee)}</span>
                </div>
                <div className="pt-3 border-t border-gray-200 flex justify-between">
                  <span className="font-semibold text-gray-900">Bạn nhận được (90%)</span>
                  <span className="text-xl font-bold text-green-600">{formatCurrency(sellerAmount)}</span>
                </div>
              </div>
            </Card>
          )}

          <Button type="submit" fullWidth size="lg" disabled={!isValid}>
            {needsKYC ? "Xác thực danh tính và niêm yết" : "Niêm yết bán lại"}
          </Button>
        </form>
      </div>

      <Dialog open={showKYCDialog} onOpenChange={setShowKYCDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Yêu cầu xác thực danh tính</DialogTitle>
            <DialogDescription>
              Giao dịch của bạn vượt quá 5,000,000 VND và yêu cầu xác thực danh tính (KYC).
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-gray-700">
                Sau khi hoàn tất KYC, bạn có thể quay lại trang này để niêm yết resale.
              </p>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowKYCDialog(false)}>
              Hủy
            </Button>
            <Button onClick={handleKYCRedirect}>Bắt đầu xác thực</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xác nhận niêm yết</DialogTitle>
            <DialogDescription>Xác nhận thông tin bán lại vé của bạn</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Giá niêm yết</span>
                <span className="font-medium">{formatCurrency(askPriceNum)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Bạn nhận được</span>
                <span className="font-semibold text-green-600">{formatCurrency(sellerAmount)}</span>
              </div>
            </div>
            <Banner type="warning" className="mt-4">
              <AlertTriangle className="w-4 h-4" />
              Sau khi niêm yết, vé sẽ không thể sử dụng cho đến khi bạn hủy niêm yết hoặc vé được bán.
            </Banner>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Hủy
            </Button>
            <Button onClick={handleConfirmResale}>Xác nhận niêm yết</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
