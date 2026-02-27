import { useState } from "react";
import { useNavigate, useLocation } from "react-router";
import {
  ArrowLeft,
  CheckCircle,
  User,
  Camera,
  FileText,
  Eye,
  Upload,
  AlertCircle,
  Shield,
  Clock,
  ChevronRight,
  X,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { toast } from "sonner";
import { runKycSubmission } from "../../lib/live-data";

type KYCStep = "personal" | "documents" | "selfie" | "review" | "success" | "rejected";

interface PersonalInfo {
  fullName: string;
  dateOfBirth: string;
  nationalId: string;
  address: string;
  city: string;
  phone: string;
}

const STEPS = [
  { id: "personal", label: "Thông tin cá nhân", icon: User },
  { id: "documents", label: "Tài liệu", icon: FileText },
  { id: "selfie", label: "Ảnh xác thực", icon: Camera },
  { id: "review", label: "Xem lại", icon: Eye },
];

const CITIES = [
  "Hà Nội", "TP. Hồ Chí Minh", "Đà Nẵng", "Hải Phòng",
  "Cần Thơ", "Nha Trang", "Huế", "Vũng Tàu",
];

export function KYCStepper() {
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = (location.state as { returnTo?: string })?.returnTo || "/tickets";

  const [currentStep, setCurrentStep] = useState<KYCStep>("personal");
  const [submitting, setSubmitting] = useState(false);

  const [personal, setPersonal] = useState<PersonalInfo>({
    fullName: "",
    dateOfBirth: "",
    nationalId: "",
    address: "",
    city: "",
    phone: "",
  });

  const [docFrontSimulated, setDocFrontSimulated] = useState(false);
  const [docBackSimulated, setDocBackSimulated] = useState(false);
  const [selfieSimulated, setSelfieSimulated] = useState(false);

  const stepIndex = STEPS.findIndex((s) => s.id === currentStep);

  const isPersonalValid =
    personal.fullName &&
    personal.dateOfBirth &&
    personal.nationalId.length >= 9 &&
    personal.address &&
    personal.city;

  const isDocumentsValid = docFrontSimulated && docBackSimulated;
  const isSelfieValid = selfieSimulated;

  const handleNext = () => {
    const steps: KYCStep[] = ["personal", "documents", "selfie", "review"];
    const current = steps.indexOf(currentStep as typeof steps[number]);
    if (current < steps.length - 1) {
      setCurrentStep(steps[current + 1]);
    }
  };

  const handleBack = () => {
    const steps: KYCStep[] = ["personal", "documents", "selfie", "review"];
    const current = steps.indexOf(currentStep as typeof steps[number]);
    if (current > 0) {
      setCurrentStep(steps[current - 1]);
    } else {
      navigate(-1);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const result = await runKycSubmission({
        cccdNumber: personal.nationalId,
        frontImageRef: `front-${Date.now()}.jpg`,
        backImageRef: `back-${Date.now()}.jpg`,
        selfieImageRef: `selfie-${Date.now()}.jpg`
      });

      if (result.status === "rejected") {
        setCurrentStep("rejected");
        toast.error("KYC chưa đạt yêu cầu, vui lòng thử lại.");
      } else {
        setCurrentStep("success");
        toast.success("Hồ sơ KYC đã được gửi thành công!");
      }
    } catch (error) {
      toast.error("Không thể gửi hồ sơ KYC", {
        description: error instanceof Error ? error.message : "Vui lòng thử lại."
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (currentStep === "rejected") {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm p-8 text-center">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <X className="w-10 h-10 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">KYC chưa đạt</h2>
          <p className="text-gray-600 mb-6">
            Hệ thống chưa thể xác thực danh tính. Vui lòng kiểm tra ảnh CCCD/selfie và thử lại.
          </p>
          <div className="space-y-3">
            <Button fullWidth onClick={() => setCurrentStep("personal")}>
              Thử lại
            </Button>
            <Button fullWidth variant="ghost" onClick={() => navigate(-1)}>
              Quay lại
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (currentStep === "success") {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm p-8 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Gửi hồ sơ thành công!
          </h2>
          <p className="text-gray-600 mb-6">
            Hồ sơ KYC của bạn đã được gửi. Chúng tôi sẽ xem xét trong vòng{" "}
            <strong>1-3 ngày làm việc</strong>.
          </p>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-left">
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-medium text-blue-900 mb-1">
                  Thời gian xử lý
                </div>
                <div className="text-sm text-blue-700">
                  Hầu hết hồ sơ được xét duyệt trong vòng <strong>24 giờ</strong>.
                  Bạn sẽ nhận email thông báo kết quả.
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3 text-sm text-gray-600 mb-8">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span>Thông tin cá nhân đã xác minh</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span>Tài liệu đã nộp: CCCD mặt trước & sau</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span>Ảnh selfie xác thực đã nộp</span>
            </div>
          </div>

          <div className="space-y-3">
            <Button
              fullWidth
              onClick={() => navigate(returnTo)}
              className="bg-violet-600 hover:bg-violet-700 text-white"
            >
              Quay lại giao dịch
            </Button>
            <Button
              fullWidth
              variant="ghost"
              onClick={() => navigate("/tickets")}
            >
              Xem vé của tôi
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (submitting) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <div className="w-20 h-20 bg-violet-100 rounded-full flex items-center justify-center mb-5 animate-pulse">
          <Shield className="w-10 h-10 text-violet-600" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Đang xử lý hồ sơ...
        </h2>
        <p className="text-gray-500 text-sm text-center max-w-xs">
          Đang mã hóa và gửi thông tin bảo mật. Vui lòng không tắt trang.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={handleBack}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <div>
              <h1 className="text-base font-semibold text-gray-900">
                Xác thực danh tính (KYC)
              </h1>
              <p className="text-xs text-gray-500">
                Bắt buộc cho giao dịch từ 5.000.000 VND
              </p>
            </div>
          </div>
        </div>

        {/* Step Indicator */}
        <div className="max-w-2xl mx-auto px-4 pb-4">
          <div className="flex items-center gap-0">
            {STEPS.map((step, idx) => {
              const Icon = step.icon;
              const isCompleted = idx < stepIndex;
              const isCurrent = idx === stepIndex;
              return (
                <div key={step.id} className="flex items-center flex-1">
                  <div
                    className={`flex flex-col items-center flex-shrink-0 ${
                      idx < STEPS.length - 1 ? "flex-1" : ""
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                        isCompleted
                          ? "bg-violet-600 text-white"
                          : isCurrent
                          ? "bg-violet-600 text-white ring-4 ring-violet-100"
                          : "bg-gray-100 text-gray-400"
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle className="w-5 h-5" />
                      ) : (
                        <Icon className="w-4 h-4" />
                      )}
                    </div>
                    <span
                      className={`text-xs mt-1 text-center leading-tight hidden sm:block ${
                        isCurrent ? "text-violet-600 font-medium" : "text-gray-400"
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                  {idx < STEPS.length - 1 && (
                    <div
                      className={`h-0.5 flex-1 mx-1 transition-all ${
                        idx < stepIndex ? "bg-violet-600" : "bg-gray-200"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Step 1: Personal Info */}
        {currentStep === "personal" && (
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <strong>Thông tin bảo mật:</strong> Tất cả dữ liệu được mã hóa
                  và chỉ dùng để xác minh danh tính theo quy định pháp luật Việt Nam.
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-6 space-y-5">
              <h2 className="text-lg font-semibold text-gray-900">
                Thông tin cá nhân
              </h2>

              <Input
                label="Họ và tên (theo CCCD)"
                required
                placeholder="Nguyễn Văn An"
                value={personal.fullName}
                onChange={(e) =>
                  setPersonal({ ...personal, fullName: e.target.value })
                }
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Ngày sinh"
                  type="date"
                  required
                  value={personal.dateOfBirth}
                  onChange={(e) =>
                    setPersonal({ ...personal, dateOfBirth: e.target.value })
                  }
                />
                <Input
                  label="Số CCCD / CMND"
                  required
                  placeholder="012345678901"
                  value={personal.nationalId}
                  onChange={(e) =>
                    setPersonal({ ...personal, nationalId: e.target.value })
                  }
                  helperText="9 hoặc 12 số"
                />
              </div>

              <Input
                label="Địa chỉ thường trú"
                required
                placeholder="Số nhà, đường, phường/xã, quận/huyện"
                value={personal.address}
                onChange={(e) =>
                  setPersonal({ ...personal, address: e.target.value })
                }
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Tỉnh / Thành phố <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={personal.city}
                    onChange={(e) =>
                      setPersonal({ ...personal, city: e.target.value })
                    }
                    className="w-full px-3 py-2.5 min-h-[44px] rounded-lg border border-gray-200 bg-gray-50 focus:bg-white focus:border-violet-400 focus:ring-2 focus:ring-violet-100 focus:outline-none text-sm transition-all"
                  >
                    <option value="">Chọn thành phố</option>
                    {CITIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <Input
                  label="Số điện thoại"
                  type="tel"
                  placeholder="0912345678"
                  value={personal.phone}
                  onChange={(e) =>
                    setPersonal({ ...personal, phone: e.target.value })
                  }
                />
              </div>
            </div>

            <Button
              fullWidth
              size="lg"
              disabled={!isPersonalValid}
              onClick={handleNext}
              className="bg-violet-600 hover:bg-violet-700 text-white"
            >
              Tiếp theo: Tải lên tài liệu
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        )}

        {/* Step 2: Document Upload */}
        {currentStep === "documents" && (
          <div className="space-y-6">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800">
                  Chụp ảnh rõ nét CCCD/CMND của bạn. Đảm bảo thông tin không bị che khuất, ảnh không bị mờ hoặc lóa sáng.
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-6 space-y-5">
              <h2 className="text-lg font-semibold text-gray-900">
                Tải lên CCCD / CMND
              </h2>

              {/* Front */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mặt trước CCCD <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setDocFrontSimulated(true)}
                  className={`w-full rounded-xl border-2 border-dashed p-6 transition-all text-center ${
                    docFrontSimulated
                      ? "border-green-400 bg-green-50"
                      : "border-gray-300 hover:border-violet-400 hover:bg-violet-50"
                  }`}
                >
                  {docFrontSimulated ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      </div>
                      <div className="text-sm font-medium text-green-700">
                        CCCD_front.jpg
                      </div>
                      <div className="text-xs text-gray-500">Nhấn để đổi ảnh</div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                        <Upload className="w-5 h-5 text-gray-400" />
                      </div>
                      <div className="text-sm font-medium text-gray-700">
                        Chụp hoặc tải ảnh lên
                      </div>
                      <div className="text-xs text-gray-500">
                        JPG, PNG · Tối đa 10MB
                      </div>
                    </div>
                  )}
                </button>
              </div>

              {/* Back */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mặt sau CCCD <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setDocBackSimulated(true)}
                  className={`w-full rounded-xl border-2 border-dashed p-6 transition-all text-center ${
                    docBackSimulated
                      ? "border-green-400 bg-green-50"
                      : "border-gray-300 hover:border-violet-400 hover:bg-violet-50"
                  }`}
                >
                  {docBackSimulated ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      </div>
                      <div className="text-sm font-medium text-green-700">
                        CCCD_back.jpg
                      </div>
                      <div className="text-xs text-gray-500">Nhấn để đổi ảnh</div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                        <Upload className="w-5 h-5 text-gray-400" />
                      </div>
                      <div className="text-sm font-medium text-gray-700">
                        Chụp hoặc tải ảnh lên
                      </div>
                      <div className="text-xs text-gray-500">
                        JPG, PNG · Tối đa 10MB
                      </div>
                    </div>
                  )}
                </button>
              </div>

              {/* Tips */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <div className="text-sm font-medium text-gray-700">
                  Yêu cầu ảnh hợp lệ:
                </div>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                    Toàn bộ thẻ xuất hiện trong khung ảnh
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                    Chữ đọc được rõ ràng
                  </li>
                  <li className="flex items-center gap-2">
                    <X className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                    Không chụp ảnh photo hoặc màn hình
                  </li>
                  <li className="flex items-center gap-2">
                    <X className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                    Không che khuất thông tin
                  </li>
                </ul>
              </div>
            </div>

            <Button
              fullWidth
              size="lg"
              disabled={!isDocumentsValid}
              onClick={handleNext}
              className="bg-violet-600 hover:bg-violet-700 text-white"
            >
              Tiếp theo: Chụp ảnh selfie
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        )}

        {/* Step 3: Selfie */}
        {currentStep === "selfie" && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm p-6 space-y-5">
              <h2 className="text-lg font-semibold text-gray-900">
                Chụp ảnh xác thực
              </h2>
              <p className="text-sm text-gray-600">
                Giữ CCCD/CMND của bạn bên cạnh mặt. Đảm bảo khuôn mặt và thông tin thẻ đều hiển thị rõ ràng.
              </p>

              {/* Camera Viewfinder Simulation */}
              <div
                className={`relative rounded-2xl overflow-hidden border-2 ${
                  selfieSimulated ? "border-green-400" : "border-gray-200"
                }`}
                style={{ aspectRatio: "4/3" }}
              >
                <div className="absolute inset-0 bg-gray-900 flex flex-col items-center justify-center">
                  {selfieSimulated ? (
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center">
                        <CheckCircle className="w-9 h-9 text-white" />
                      </div>
                      <div className="text-white font-medium">Ảnh đã được chụp</div>
                      <div className="text-gray-400 text-sm">selfie_kyc.jpg</div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-4 w-full px-8">
                      {/* Face oval guide */}
                      <div
                        className="border-2 border-dashed border-white/40 rounded-full"
                        style={{ width: "140px", height: "180px" }}
                      />
                      <div className="text-white text-sm text-center">
                        Đặt khuôn mặt vào khung
                      </div>
                    </div>
                  )}
                </div>

                {/* Corner guides */}
                {!selfieSimulated && (
                  <>
                    <div className="absolute top-3 left-3 w-8 h-8 border-t-3 border-l-3 border-white rounded-tl-lg" style={{ borderWidth: "3px 0 0 3px" }} />
                    <div className="absolute top-3 right-3 w-8 h-8 border-t-3 border-r-3 border-white rounded-tr-lg" style={{ borderWidth: "3px 3px 0 0" }} />
                    <div className="absolute bottom-3 left-3 w-8 h-8 border-b-3 border-l-3 border-white rounded-bl-lg" style={{ borderWidth: "0 0 3px 3px" }} />
                    <div className="absolute bottom-3 right-3 w-8 h-8 border-b-3 border-r-3 border-white rounded-br-lg" style={{ borderWidth: "0 3px 3px 0" }} />
                  </>
                )}
              </div>

              {!selfieSimulated ? (
                <button
                  onClick={() => setSelfieSimulated(true)}
                  className="w-full flex items-center justify-center gap-2 py-4 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-medium transition-colors min-h-[52px]"
                >
                  <Camera className="w-5 h-5" />
                  Chụp ảnh
                </button>
              ) : (
                <div className="flex gap-3">
                  <button
                    onClick={() => setSelfieSimulated(false)}
                    className="flex-1 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                  >
                    Chụp lại
                  </button>
                  <button
                    onClick={handleNext}
                    className="flex-1 py-3 bg-violet-600 text-white rounded-xl font-medium hover:bg-violet-700 transition-colors flex items-center justify-center gap-2"
                  >
                    Dùng ảnh này
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <ul className="text-sm text-amber-800 space-y-1.5">
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                  Giữ CCCD/CMND bên cạnh mặt, không che khuất
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                  Chụp ở nơi đủ sáng, không ngược sáng
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                  Không đội mũ, không đeo kính đen
                </li>
              </ul>
            </div>
          </div>
        )}

        {/* Step 4: Review */}
        {currentStep === "review" && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm p-6 space-y-5">
              <h2 className="text-lg font-semibold text-gray-900">
                Xem lại thông tin
              </h2>

              <div className="space-y-4">
                <div>
                  <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">
                    Thông tin cá nhân
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4 space-y-2.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Họ và tên</span>
                      <span className="font-medium text-gray-900">{personal.fullName || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Ngày sinh</span>
                      <span className="font-medium text-gray-900">{personal.dateOfBirth || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Số CCCD</span>
                      <span className="font-medium text-gray-900">{personal.nationalId || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Địa chỉ</span>
                      <span className="font-medium text-gray-900 text-right max-w-[60%]">
                        {personal.address ? `${personal.address}, ${personal.city}` : "—"}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">
                    Tài liệu đã nộp
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                      <span className="text-sm text-green-800">CCCD mặt trước</span>
                    </div>
                    <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                      <span className="text-sm text-green-800">CCCD mặt sau</span>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">
                    Ảnh xác thực
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <span className="text-sm text-green-800">Ảnh selfie với CCCD</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Consent */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-violet-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-gray-700">
                  Bằng cách nhấn "Gửi hồ sơ", bạn đồng ý cho VéNhanh thu thập và xử lý thông tin cá nhân của bạn theo{" "}
                  <span className="text-violet-600 underline cursor-pointer">
                    Chính sách quyền riêng tư
                  </span>{" "}
                  và{" "}
                  <span className="text-violet-600 underline cursor-pointer">
                    Điều khoản dịch vụ
                  </span>
                  . Thông tin chỉ dùng để xác minh danh tính.
                </div>
              </div>
            </div>

            <Button
              fullWidth
              size="lg"
              onClick={handleSubmit}
              className="bg-violet-600 hover:bg-violet-700 text-white"
            >
              <Shield className="w-5 h-5" />
              Gửi hồ sơ xác thực
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
