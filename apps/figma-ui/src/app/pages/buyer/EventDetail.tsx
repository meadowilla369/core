import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router";
import {
  Calendar,
  MapPin,
  ArrowLeft,
  User,
  AlertCircle,
  Clock,
  TrendingUp,
  Minus,
  Plus,
  Info,
  Tag
} from "lucide-react";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Banner } from "../../components/ui/Banner";
import { LoadingState } from "../../components/ui/LoadingState";
import { mockEvents } from "../../lib/mockData";
import { formatCurrency, formatDate, calculateResaleMax } from "../../lib/utils";
import { loadEvent, loadResaleListings } from "../../lib/live-data";
import type { Event } from "../../lib/types";

interface ResaleCardItem {
  id: string;
  tier: string;
  askPrice: number;
  faceValue: number;
}

export function EventDetail() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [selectedTierId, setSelectedTierId] = useState<string>("");
  const [quantity, setQuantity] = useState(1);
  const [event, setEvent] = useState<Event | null>(null);
  const [resaleListings, setResaleListings] = useState<ResaleCardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"primary" | "resale">("primary");

  useEffect(() => {
    if (!eventId) {
      setEvent(null);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);

    Promise.all([loadEvent(eventId), loadResaleListings(eventId)])
      .then(([nextEvent, listings]) => {
        if (!active) {
          return;
        }

        const fallbackFaceValue =
          nextEvent.tickets.length > 0
            ? Math.min(...nextEvent.tickets.map((ticketType) => ticketType.price))
            : 0;

        setEvent(nextEvent);
        setResaleListings(
          listings.map((listing, index) => ({
            id: listing.id,
            tier: `Resale #${index + 1}`,
            askPrice: listing.askPrice,
            faceValue: fallbackFaceValue
          }))
        );
        setLoadError(null);
      })
      .catch((error) => {
        if (!active) {
          return;
        }

        setEvent(mockEvents.find((item) => item.id === eventId) ?? null);
        setResaleListings([]);
        setLoadError(error instanceof Error ? error.message : "Không thể tải dữ liệu live.");
      })
      .finally(() => {
        if (!active) {
          return;
        }

        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [eventId]);

  if (!event && !loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <Card className="text-center max-w-md p-8">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Không tìm thấy sự kiện</h2>
          <p className="text-gray-600 mb-6 text-sm">Sự kiện này không tồn tại hoặc đã bị xóa.</p>
          <Link to="/explore">
            <Button>Quay lại khám phá</Button>
          </Link>
        </Card>
      </div>
    );
  }

  if (loading) return <LoadingState fullScreen message="Đang tải thông tin sự kiện..." />;
  if (!event) return null;

  const selectedTier = event.tickets.find((t) => t.id === selectedTierId);
  const canProceed = selectedTier && selectedTier.available >= quantity;

  const handleCheckout = () => {
    if (canProceed) {
      navigate(`/checkout/${event.id}?tier=${selectedTierId}&quantity=${quantity}`);
    }
  };

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
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-semibold text-gray-900 truncate">Chi tiết sự kiện</h1>
              <p className="text-xs text-gray-500 truncate">{event.title}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto">
        <div className="relative">
          <div className="aspect-[16/7] overflow-hidden">
            <img src={event.imageUrl} alt={event.title} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
          </div>
          <div className="absolute bottom-0 left-0 right-0 px-4 sm:px-6 pb-5">
            <span className="inline-block px-3 py-1 bg-white/20 backdrop-blur-sm border border-white/30 text-white text-xs font-medium rounded-full mb-2">
              {event.category}
            </span>
            <h1 className="text-white text-xl sm:text-2xl font-bold leading-tight">{event.title}</h1>
          </div>
        </div>

        <div className="px-4 sm:px-6 py-5 space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-white rounded-xl border border-gray-100 p-3.5 flex items-center gap-3">
              <Calendar className="w-5 h-5 text-violet-500 flex-shrink-0" />
              <div>
                <div className="text-xs text-gray-500">Ngày</div>
                <div className="text-sm font-medium text-gray-900">{formatDate(event.date)}</div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-3.5 flex items-center gap-3">
              <MapPin className="w-5 h-5 text-violet-500 flex-shrink-0" />
              <div>
                <div className="text-xs text-gray-500">Địa điểm</div>
                <div className="text-sm font-medium text-gray-900 line-clamp-1">{event.venue}</div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-3.5 flex items-center gap-3">
              <User className="w-5 h-5 text-violet-500 flex-shrink-0" />
              <div>
                <div className="text-xs text-gray-500">Ban tổ chức</div>
                <div className="text-sm font-medium text-gray-900 line-clamp-1">{event.organizerName}</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <h3 className="font-medium text-gray-900 mb-2">Giới thiệu</h3>
            <p className="text-sm text-gray-600 leading-relaxed">{event.description}</p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
            <div className="flex border-b border-gray-100">
              <button
                onClick={() => setActiveTab("primary")}
                className={`flex-1 py-3.5 text-sm font-medium transition-colors ${
                  activeTab === "primary"
                    ? "border-b-2 border-violet-600 text-violet-700 bg-violet-50/50"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Vé gốc
              </button>
              <button
                onClick={() => setActiveTab("resale")}
                className={`flex-1 py-3.5 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                  activeTab === "resale"
                    ? "border-b-2 border-violet-600 text-violet-700 bg-violet-50/50"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <TrendingUp className="w-4 h-4" />
                Resale
                <span className="px-1.5 py-0.5 bg-violet-100 text-violet-700 text-xs rounded-full">
                  {resaleListings.length}
                </span>
              </button>
            </div>

            <div className="p-5">
              {loadError && (
                <Banner type="warning" className="mb-4">
                  {loadError}
                </Banner>
              )}

              {activeTab === "primary" && (
                <div className="space-y-4">
                  <div className="space-y-3">
                    {event.tickets.map((tier) => {
                      const isSelected = selectedTierId === tier.id;
                      const isAvailable = tier.available > 0;
                      const pct = Math.round((tier.available / tier.total) * 100);

                      return (
                        <button
                          key={tier.id}
                          onClick={() => isAvailable && setSelectedTierId(tier.id)}
                          disabled={!isAvailable}
                          className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                            isSelected
                              ? "border-violet-500 bg-violet-50 shadow-md shadow-violet-100"
                              : isAvailable
                                ? "border-gray-200 hover:border-gray-300 bg-white"
                                : "border-gray-100 bg-gray-50 cursor-not-allowed opacity-50"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${isSelected ? "border-violet-600 bg-violet-600" : "border-gray-300"}`}>
                                {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                              </div>
                              <span className="font-semibold text-gray-900">{tier.name}</span>
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-gray-900">{formatCurrency(tier.price)}</div>
                              <div className="text-xs text-gray-400">all-in</div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 pl-6">
                            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  pct < 20 ? "bg-red-500" : pct < 50 ? "bg-orange-400" : "bg-green-500"
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className={`text-xs ${isAvailable ? "text-gray-500" : "text-red-500 font-medium"}`}>
                              {isAvailable ? `${tier.available} vé còn` : "Hết vé"}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {selectedTier && (
                    <div className="bg-gray-50 rounded-xl p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">Số lượng</span>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => setQuantity(Math.max(1, quantity - 1))}
                            className="w-10 h-10 rounded-xl border-2 border-gray-200 bg-white hover:bg-gray-50 flex items-center justify-center transition-colors"
                          >
                            <Minus className="w-4 h-4 text-gray-600" />
                          </button>
                          <span className="w-8 text-center font-bold text-gray-900">{quantity}</span>
                          <button
                            onClick={() => setQuantity(Math.min(selectedTier.available, quantity + 1))}
                            className="w-10 h-10 rounded-xl border-2 border-gray-200 bg-white hover:bg-gray-50 flex items-center justify-center transition-colors"
                          >
                            <Plus className="w-4 h-4 text-gray-600" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-xl text-xs text-blue-700">
                    <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    Giá đã bao gồm tất cả phí. Không có phí phát sinh thêm khi thanh toán.
                  </div>
                </div>
              )}

              {activeTab === "resale" && (
                <div className="space-y-4">
                  <div className="flex items-start gap-2 p-3 bg-violet-50 rounded-xl text-xs text-violet-700">
                    <TrendingUp className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    Vé resale từ người dùng khác. Giá đã bao gồm phí. Tối đa 120% giá gốc.
                  </div>

                  <div className="space-y-2">
                    {resaleListings.map((listing) => {
                      const maxAllowed = calculateResaleMax(listing.faceValue);
                      const isAtCap = listing.askPrice >= maxAllowed * 0.99;
                      return (
                        <div
                          key={listing.id}
                          className="flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-200 hover:border-violet-300 hover:shadow-sm transition-all"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium text-gray-900">{listing.tier}</span>
                              {isAtCap && (
                                <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full">
                                  Gần giới hạn
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <Tag className="w-3 h-3" />
                              <span>Giá gốc {formatCurrency(listing.faceValue)}</span>
                              <span>·</span>
                              <span>+{Math.round((listing.askPrice / listing.faceValue - 1) * 100)}%</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-gray-900 text-sm">{formatCurrency(listing.askPrice)}</div>
                            <button className="mt-1 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs rounded-lg transition-colors min-h-[32px]">
                              Mua ngay
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {resaleListings.length === 0 && (
                    <div className="text-sm text-gray-500">Chưa có listing resale khả dụng cho sự kiện này.</div>
                  )}

                  <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-xl text-xs text-amber-700">
                    <Clock className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    Giao dịch resale tự động đóng trước sự kiện 30 phút theo quy định.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {activeTab === "primary" && (
          <div className="sticky bottom-0 bg-white border-t border-gray-100 px-4 sm:px-6 py-4 shadow-lg">
            <div className="max-w-4xl mx-auto flex items-center gap-4">
              <div className="flex-1 min-w-0">
                {selectedTier ? (
                  <>
                    <div className="text-xs text-gray-500">Tổng thanh toán</div>
                    <div className="text-xl font-bold text-violet-700">{formatCurrency(selectedTier.price * quantity)}</div>
                  </>
                ) : (
                  <div className="text-sm text-gray-500">Chọn loại vé để tiếp tục</div>
                )}
              </div>
              <Button size="lg" disabled={!canProceed} onClick={handleCheckout} className="flex-shrink-0">
                Tiếp tục →
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
