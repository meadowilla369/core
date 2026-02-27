import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router";
import {
  ArrowLeft,
  CreditCard,
  CheckCircle,
  Lock,
  Calendar,
  MapPin,
  Ticket,
  Smartphone,
  Building2
} from "lucide-react";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Banner } from "../../components/ui/Banner";
import { LoadingState } from "../../components/ui/LoadingState";
import { mockEvents } from "../../lib/mockData";
import { formatCurrency, formatShortDate } from "../../lib/utils";
import { toast } from "sonner";
import { loadEvent, purchaseTickets } from "../../lib/live-data";
import type { Event } from "../../lib/types";

type PaymentMethod = "card" | "momo" | "banking";

export function Checkout() {
  const { eventId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const tierId = searchParams.get("tier");
  const quantity = parseInt(searchParams.get("quantity") || "1", 10);

  const [processing, setProcessing] = useState(false);
  const [loadingEvent, setLoadingEvent] = useState(true);
  const [eventLoadError, setEventLoadError] = useState<string | null>(null);
  const [event, setEvent] = useState<Event | null>(null);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("card");
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    cardNumber: "",
    cardExpiry: "",
    cardCvv: ""
  });

  useEffect(() => {
    if (!eventId) {
      setEvent(null);
      setLoadingEvent(false);
      return;
    }

    let active = true;
    setLoadingEvent(true);

    loadEvent(eventId)
      .then((next) => {
        if (!active) {
          return;
        }

        setEvent(next);
        setEventLoadError(null);
      })
      .catch((error) => {
        if (!active) {
          return;
        }

        setEvent(mockEvents.find((item) => item.id === eventId) ?? null);
        setEventLoadError(error instanceof Error ? error.message : "Không thể tải sự kiện từ backend.");
      })
      .finally(() => {
        if (!active) {
          return;
        }

        setLoadingEvent(false);
      });

    return () => {
      active = false;
    };
  }, [eventId]);

  const tier = event?.tickets.find((item) => item.id === tierId);

  if (loadingEvent || processing) {
    return <LoadingState fullScreen message="Đang xử lý thanh toán..." />;
  }

  if (!event || !tier) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <Card className="text-center max-w-md p-8">
          <h2 className="text-xl font-semibold mb-2">Thông tin không hợp lệ</h2>
          {eventLoadError && <p className="text-xs text-gray-500 mb-3">{eventLoadError}</p>}
          <Button onClick={() => navigate("/explore")}>Quay lại khám phá</Button>
        </Card>
      </div>
    );
  }

  const totalAmount = tier.price * quantity;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessing(true);

    try {
      await purchaseTickets({
        eventId: event.id,
        ticketTypeId: tier.id,
        quantity,
        paymentMethod
      });

      toast.success("Thanh toán thành công!", {
        description: "Vé đã được mint và đồng bộ từ backend."
      });
      navigate("/tickets");
    } catch (error) {
      toast.error("Thanh toán thất bại", {
        description: error instanceof Error ? error.message : "Không thể hoàn tất giao dịch."
      });
    } finally {
      setProcessing(false);
    }
  };

  const PAYMENT_METHODS = [
    { id: "card" as PaymentMethod, label: "Thẻ tín dụng/ATM", icon: CreditCard },
    { id: "momo" as PaymentMethod, label: "Ví MoMo", icon: Smartphone },
    { id: "banking" as PaymentMethod, label: "Chuyển khoản", icon: Building2 }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-gray-100 rounded-xl transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <div className="flex-1">
              <h1 className="text-base font-semibold text-gray-900">Thanh toán</h1>
              <div className="flex items-center gap-1.5 text-xs text-green-600 mt-0.5">
                <Lock className="w-3 h-3" />
                Kết nối bảo mật SSL
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-5">
            {eventLoadError && <Banner type="warning">{eventLoadError}</Banner>}

            <Card>
              <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-violet-600 text-white text-xs flex items-center justify-center font-bold">1</div>
                Thông tin người mua
              </h2>
              <div className="space-y-4">
                <Input
                  label="Họ và tên"
                  required
                  placeholder="Nguyễn Văn A"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Email"
                    type="email"
                    required
                    placeholder="email@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                  <Input
                    label="Số điện thoại"
                    type="tel"
                    required
                    placeholder="0912 345 678"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
              </div>
            </Card>

            <Card>
              <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-violet-600 text-white text-xs flex items-center justify-center font-bold">2</div>
                Phương thức thanh toán
              </h2>

              <div className="flex gap-3 mb-5">
                {PAYMENT_METHODS.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setPaymentMethod(id)}
                    className={`flex-1 flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all text-xs font-medium min-h-[70px] ${
                      paymentMethod === id
                        ? "border-violet-500 bg-violet-50 text-violet-700"
                        : "border-gray-200 hover:border-gray-300 text-gray-600"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {label}
                  </button>
                ))}
              </div>

              {paymentMethod === "card" && (
                <div className="space-y-4">
                  <Input
                    label="Số thẻ"
                    placeholder="1234 5678 9012 3456"
                    required
                    value={formData.cardNumber}
                    onChange={(e) => setFormData({ ...formData, cardNumber: e.target.value })}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Ngày hết hạn"
                      placeholder="MM/YY"
                      required
                      value={formData.cardExpiry}
                      onChange={(e) => setFormData({ ...formData, cardExpiry: e.target.value })}
                    />
                    <Input
                      label="CVV"
                      placeholder="123"
                      required
                      maxLength={3}
                      value={formData.cardCvv}
                      onChange={(e) => setFormData({ ...formData, cardCvv: e.target.value })}
                    />
                  </div>
                </div>
              )}

              {paymentMethod === "momo" && (
                <div className="text-center py-6 text-sm text-gray-500">
                  <Smartphone className="w-12 h-12 mx-auto mb-3 text-pink-500 opacity-70" />
                  Bạn sẽ được chuyển sang ứng dụng MoMo để hoàn tất thanh toán.
                </div>
              )}
            </Card>
          </div>

          <div className="space-y-5">
            <Card>
              <h3 className="font-semibold text-gray-900 mb-4">Tóm tắt đơn hàng</h3>

              <div className="space-y-2 pb-4 border-b border-gray-100">
                <div className="flex items-start gap-3">
                  <Ticket className="w-4 h-4 text-violet-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm font-medium text-gray-900 leading-snug">{event.title}</div>
                    <div className="text-xs text-violet-600 font-medium mt-0.5">{tier.name}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500 pl-7">
                  <Calendar className="w-3 h-3" />
                  {formatShortDate(event.date)}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500 pl-7">
                  <MapPin className="w-3 h-3" />
                  <span className="line-clamp-1">{event.venue}</span>
                </div>
              </div>

              <div className="space-y-2 py-4 border-b border-gray-100 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>
                    {tier.name} × {quantity}
                  </span>
                  <span>{formatCurrency(tier.price * quantity)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Phí dịch vụ</span>
                  <span className="text-green-600">Miễn phí</span>
                </div>
              </div>

              <div className="pt-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-semibold text-gray-900">Tổng thanh toán</span>
                  <span className="text-2xl font-bold text-violet-700">{formatCurrency(totalAmount)}</span>
                </div>
                <p className="text-xs text-gray-400">Giá đã bao gồm thuế và phí</p>
              </div>

              <Banner type="success" className="mt-4">
                Giá đã bao gồm tất cả. Không có phí phát sinh thêm.
              </Banner>
            </Card>

            <form onSubmit={handleSubmit}>
              <Button type="submit" fullWidth size="lg">
                <CheckCircle className="w-5 h-5" />
                Thanh toán {formatCurrency(totalAmount)}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
