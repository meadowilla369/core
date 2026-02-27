import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Image,
  Plus,
  Trash2,
  Save,
  Eye,
  AlertCircle,
  Info,
  Check,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { mockEvents } from "../../lib/mockData";

const CATEGORIES = ["Âm nhạc", "Sân khấu", "Thể thao", "Giải trí", "Lễ hội", "Hội thảo", "Khác"];

interface TicketTierForm {
  id: string;
  name: string;
  price: string;
  total: string;
  description: string;
}

export function OrganizerEventEditor() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const isNew = eventId === "new";

  const existingEvent = !isNew ? mockEvents.find((e) => e.id === eventId) : null;

  const [form, setForm] = useState({
    title: existingEvent?.title || "",
    description: existingEvent?.description || "",
    category: existingEvent?.category || "Âm nhạc",
    venue: existingEvent?.venue || "",
    date: existingEvent?.date ? existingEvent.date.split("T")[0] : "",
    time: existingEvent?.date ? existingEvent.date.split("T")[1]?.substring(0, 5) : "19:00",
    imageUrl: existingEvent?.imageUrl || "",
    resaleEnabled: true,
    resaleMaxPct: 120,
    resaleCutoffMinutes: 30,
  });

  const [tiers, setTiers] = useState<TicketTierForm[]>(
    existingEvent?.tickets.map((t) => ({
      id: t.id,
      name: t.name,
      price: t.price.toString(),
      total: t.total.toString(),
      description: "",
    })) || [{ id: "tier-new-1", name: "Hạng thường", price: "500000", total: "200", description: "" }]
  );

  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<"info" | "tickets" | "resale">("info");

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast.error("Vui lòng nhập tên sự kiện");
      return;
    }
    if (!form.venue.trim()) {
      toast.error("Vui lòng nhập địa điểm");
      return;
    }
    if (!form.date) {
      toast.error("Vui lòng chọn ngày tổ chức");
      return;
    }
    if (tiers.length === 0) {
      toast.error("Cần ít nhất 1 hạng vé");
      return;
    }

    setSaving(true);
    await new Promise((r) => setTimeout(r, 1200));
    setSaving(false);
    toast.success(isNew ? "Đã tạo sự kiện thành công!" : "Đã lưu thay đổi!");
    navigate("/organizer/events");
  };

  const addTier = () => {
    setTiers((prev) => [
      ...prev,
      {
        id: `tier-new-${Date.now()}`,
        name: "",
        price: "",
        total: "",
        description: "",
      },
    ]);
  };

  const removeTier = (id: string) => {
    setTiers((prev) => prev.filter((t) => t.id !== id));
  };

  const updateTier = (id: string, field: keyof TicketTierForm, value: string) => {
    setTiers((prev) => prev.map((t) => (t.id === id ? { ...t, [field]: value } : t)));
  };

  const SECTIONS = [
    { id: "info" as const, label: "Thông tin cơ bản" },
    { id: "tickets" as const, label: "Hạng vé" },
    { id: "resale" as const, label: "Cài đặt resale" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <Link to={isNew ? "/organizer/events" : `/organizer/event/${eventId}`}>
                <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center">
                  <ArrowLeft className="w-5 h-5 text-gray-600" />
                </button>
              </Link>
              <div>
                <h1 className="text-base font-bold text-gray-900">
                  {isNew ? "Tạo sự kiện mới" : "Chỉnh sửa sự kiện"}
                </h1>
                <p className="text-xs text-gray-500">VMG Entertainment</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!isNew && (
                <button
                  onClick={() => navigate(`/organizer/event/${eventId}`)}
                  className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm min-h-[44px]"
                >
                  <Eye className="w-4 h-4" />
                  <span className="hidden sm:inline">Xem trước</span>
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white rounded-xl text-sm font-medium transition-colors min-h-[44px]"
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {saving ? "Đang lưu..." : "Lưu"}
              </button>
            </div>
          </div>

          {/* Section tabs */}
          <div className="flex gap-0 overflow-x-auto -mb-px">
            {SECTIONS.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  activeSection === section.id
                    ? "border-orange-500 text-orange-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {section.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        {activeSection === "info" && (
          <div className="space-y-5">
            {/* Basic Info */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h2 className="font-semibold text-gray-900 mb-5">Thông tin sự kiện</h2>
              <div className="space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Tên sự kiện <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="VD: Mỹ Tâm Live in Concert 2026"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:border-orange-400 focus:ring-2 focus:ring-orange-100 focus:outline-none transition-all"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Mô tả</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Mô tả chi tiết về sự kiện..."
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:border-orange-400 focus:ring-2 focus:ring-orange-100 focus:outline-none transition-all resize-none"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Thể loại</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:border-orange-400 focus:ring-2 focus:ring-orange-100 focus:outline-none transition-all bg-white appearance-none"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                {/* Date + Time */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      <Calendar className="w-3.5 h-3.5 inline mr-1" />
                      Ngày tổ chức <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={form.date}
                      onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:border-orange-400 focus:ring-2 focus:ring-orange-100 focus:outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Giờ bắt đầu</label>
                    <input
                      type="time"
                      value={form.time}
                      onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:border-orange-400 focus:ring-2 focus:ring-orange-100 focus:outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Venue */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    <MapPin className="w-3.5 h-3.5 inline mr-1" />
                    Địa điểm <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.venue}
                    onChange={(e) => setForm((f) => ({ ...f, venue: e.target.value }))}
                    placeholder="VD: Sân vận động Mỹ Đình, Hà Nội"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:border-orange-400 focus:ring-2 focus:ring-orange-100 focus:outline-none transition-all"
                  />
                </div>

                {/* Image URL */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    <Image className="w-3.5 h-3.5 inline mr-1" />
                    Ảnh đại diện (URL)
                  </label>
                  <input
                    type="url"
                    value={form.imageUrl}
                    onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
                    placeholder="https://..."
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:border-orange-400 focus:ring-2 focus:ring-orange-100 focus:outline-none transition-all"
                  />
                  {form.imageUrl && (
                    <div className="mt-3 relative aspect-video rounded-xl overflow-hidden border border-gray-200">
                      <img src={form.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Nav hint */}
            <button
              onClick={() => setActiveSection("tickets")}
              className="w-full flex items-center justify-between p-4 bg-white border border-gray-100 rounded-2xl shadow-sm hover:bg-orange-50 hover:border-orange-200 transition-all group"
            >
              <span className="text-sm font-medium text-gray-700 group-hover:text-orange-700">
                Tiếp theo: Cài đặt hạng vé →
              </span>
              <span className="text-xs text-gray-400">{tiers.length} hạng</span>
            </button>
          </div>
        )}

        {activeSection === "tickets" && (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
              <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                Mỗi hạng vé sẽ có QR code động, refresh mỗi 3 giây. Giá tối thiểu 10,000 VND.
              </div>
            </div>

            {tiers.map((tier, idx) => (
              <div key={tier.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900">Hạng vé {idx + 1}</h3>
                  {tiers.length > 1 && (
                    <button
                      onClick={() => removeTier(tier.id)}
                      className="p-2 hover:bg-red-50 rounded-lg transition-colors text-gray-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                      Tên hạng <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={tier.name}
                      onChange={(e) => updateTier(tier.id, "name", e.target.value)}
                      placeholder="VD: VIP, Hạng A, Standard..."
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:border-orange-400 focus:ring-2 focus:ring-orange-100 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                      Giá vé (VND) <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={tier.price}
                        onChange={(e) => updateTier(tier.id, "price", e.target.value)}
                        placeholder="500000"
                        min="10000"
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:border-orange-400 focus:ring-2 focus:ring-orange-100 focus:outline-none pr-16"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">VND</span>
                    </div>
                    {tier.price && Number(tier.price) > 0 && (
                      <div className="text-xs text-gray-400 mt-1">
                        Resale max: {Math.round(Number(tier.price) * 1.2).toLocaleString("vi-VN")} VND
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                      Tổng số vé <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={tier.total}
                      onChange={(e) => updateTier(tier.id, "total", e.target.value)}
                      placeholder="100"
                      min="1"
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:border-orange-400 focus:ring-2 focus:ring-orange-100 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Ghi chú hạng vé</label>
                    <input
                      type="text"
                      value={tier.description}
                      onChange={(e) => updateTier(tier.id, "description", e.target.value)}
                      placeholder="Bao gồm gặp gỡ nghệ sĩ..."
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:border-orange-400 focus:ring-2 focus:ring-orange-100 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            ))}

            <button
              onClick={addTier}
              className="w-full py-4 border-2 border-dashed border-gray-200 text-gray-500 rounded-2xl hover:border-orange-300 hover:text-orange-600 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Thêm hạng vé
            </button>
          </div>
        )}

        {activeSection === "resale" && (
          <div className="space-y-5">
            {/* Resale toggle */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-gray-900">Cho phép resale</h3>
                  <p className="text-sm text-gray-500 mt-0.5">Người mua có thể bán lại vé trên nền tảng</p>
                </div>
                <button
                  onClick={() => setForm((f) => ({ ...f, resaleEnabled: !f.resaleEnabled }))}
                  className={`relative w-12 h-6 rounded-full transition-colors ${form.resaleEnabled ? "bg-orange-500" : "bg-gray-200"}`}
                >
                  <div className={`absolute w-5 h-5 bg-white rounded-full top-0.5 transition-transform shadow-sm ${form.resaleEnabled ? "translate-x-6" : "translate-x-0.5"}`} />
                </button>
              </div>

              {form.resaleEnabled && (
                <div className="space-y-4 pt-4 border-t border-gray-100">
                  {/* Price cap */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Trần giá bán lại (% so với giá gốc)
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={100}
                        max={150}
                        step={5}
                        value={form.resaleMaxPct}
                        onChange={(e) => setForm((f) => ({ ...f, resaleMaxPct: Number(e.target.value) }))}
                        className="flex-1"
                      />
                      <div className="w-20 text-center">
                        <span className={`text-lg font-bold ${form.resaleMaxPct > 120 ? "text-red-600" : "text-orange-600"}`}>
                          {form.resaleMaxPct}%
                        </span>
                      </div>
                    </div>
                    {form.resaleMaxPct > 120 && (
                      <div className="flex items-center gap-2 mt-2 text-xs text-red-600">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Vượt quá giới hạn hệ thống (120%). Nền tảng sẽ tự động áp dụng 120%.
                      </div>
                    )}
                    {form.resaleMaxPct <= 120 && (
                      <div className="flex items-center gap-2 mt-2 text-xs text-green-600">
                        <Check className="w-3.5 h-3.5" />
                        Tuân thủ quy định pháp luật
                      </div>
                    )}
                  </div>

                  {/* Cutoff */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Khóa giao dịch resale trước sự kiện (phút)
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={15}
                        max={120}
                        step={15}
                        value={form.resaleCutoffMinutes}
                        onChange={(e) => setForm((f) => ({ ...f, resaleCutoffMinutes: Number(e.target.value) }))}
                        className="flex-1"
                      />
                      <div className="w-20 text-center">
                        <span className="text-lg font-bold text-orange-600">T-{form.resaleCutoffMinutes}</span>
                      </div>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      Hệ thống yêu cầu tối thiểu T-30 phút (non-negotiable)
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Payout Split Info */}
            <div className="bg-violet-50 border border-violet-200 rounded-2xl p-5">
              <h3 className="font-semibold text-violet-900 mb-3 flex items-center gap-2">
                <Info className="w-4 h-4" />
                Phân chia hoa hồng resale (cố định)
              </h3>
              <div className="space-y-2 text-sm text-violet-800">
                {[
                  { label: "Người bán nhận", pct: "90%" },
                  { label: "Nền tảng giữ", pct: "5%" },
                  { label: "Ban tổ chức nhận", pct: "5%" },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between py-1.5 border-b border-violet-100 last:border-0">
                    <span>{row.label}</span>
                    <span className="font-bold">{row.pct}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-violet-600 mt-3">
                Đây là chính sách cố định của nền tảng và không thể thay đổi.
              </p>
            </div>

            {/* Save CTA */}
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-4 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white rounded-2xl font-medium transition-colors flex items-center justify-center gap-2 min-h-[56px]"
            >
              {saving ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save className="w-5 h-5" />
              )}
              {saving ? "Đang lưu..." : isNew ? "Tạo sự kiện" : "Lưu thay đổi"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
