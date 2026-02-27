import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  RotateCcw,
  ArrowLeft,
  Wifi,
  Loader2
} from "lucide-react";
import { decodeQrPayload, verifyCheckin } from "../../lib/live-data";

type ResultType = "valid" | "used" | "invalid" | "cutoff" | "loading";

function getStaticResult(code: string): ResultType {
  if (code.includes("USED")) return "used";
  if (code.includes("FAKE") || code.includes("INVALID")) return "invalid";
  if (code.includes("CUTOFF")) return "cutoff";
  return "invalid";
}

export function ScanResult() {
  const navigate = useNavigate();
  const location = useLocation();
  const ticketCode = (location.state as { ticketCode?: string })?.ticketCode || "";

  const [resultType, setResultType] = useState<ResultType>("loading");
  const [resultMessage, setResultMessage] = useState<string>("Đang xác minh QR với backend...");

  useEffect(() => {
    let active = true;

    const payload = decodeQrPayload(ticketCode);
    if (!payload) {
      setResultType(getStaticResult(ticketCode));
      setResultMessage("Không đọc được payload QR live.");
      return;
    }

    verifyCheckin(payload)
      .then((result) => {
        if (!active) {
          return;
        }

        if (result.valid) {
          setResultType("valid");
          setResultMessage("Vé hợp lệ, cho phép vào cổng.");
          return;
        }

        if (result.reason === "ALREADY_USED") {
          setResultType("used");
          setResultMessage(result.message ?? "Vé đã được sử dụng.");
          return;
        }

        if (result.reason === "QR_EXPIRED") {
          setResultType("cutoff");
          setResultMessage(result.message ?? "QR hết hạn hoặc clock skew.");
          return;
        }

        setResultType("invalid");
        setResultMessage(result.message ?? "Vé không hợp lệ.");
      })
      .catch((error) => {
        if (!active) {
          return;
        }

        setResultType("invalid");
        setResultMessage(error instanceof Error ? error.message : "Không thể xác minh check-in.");
      });

    return () => {
      active = false;
    };
  }, [ticketCode]);

  const now = new Date().toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });

  const configs = {
    valid: {
      bg: "bg-green-900/20",
      border: "border-green-600/40",
      iconBg: "bg-green-600",
      Icon: CheckCircle,
      title: "Vé hợp lệ ✓",
      subtitle: "Cho phép vào cửa",
      textColor: "text-green-400"
    },
    used: {
      bg: "bg-orange-900/20",
      border: "border-orange-600/40",
      iconBg: "bg-orange-600",
      Icon: AlertTriangle,
      title: "Vé đã được sử dụng",
      subtitle: "Từ chối — Không cho vào",
      textColor: "text-orange-400"
    },
    invalid: {
      bg: "bg-red-900/20",
      border: "border-red-600/40",
      iconBg: "bg-red-700",
      Icon: XCircle,
      title: "Vé không hợp lệ",
      subtitle: "Từ chối — Vé giả hoặc không tồn tại",
      textColor: "text-red-400"
    },
    cutoff: {
      bg: "bg-gray-800/40",
      border: "border-gray-600/40",
      iconBg: "bg-gray-600",
      Icon: Clock,
      title: "QR hết hạn",
      subtitle: "QR dynamic không còn hiệu lực",
      textColor: "text-gray-400"
    },
    loading: {
      bg: "bg-blue-900/20",
      border: "border-blue-600/40",
      iconBg: "bg-blue-600",
      Icon: Loader2,
      title: "Đang xác minh",
      subtitle: "Đợi phản hồi từ check-in service",
      textColor: "text-blue-300"
    }
  } as const;

  const cfg = configs[resultType];
  const Icon = cfg.Icon;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => navigate("/staff/scan")}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5 text-gray-400" />
          </button>
          <div className="text-sm text-gray-400">Kết quả quét</div>
          <div className="flex items-center gap-1.5 text-xs text-green-400">
            <Wifi className="w-3.5 h-3.5" />
            Online
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        <div className={`rounded-2xl border ${cfg.bg} ${cfg.border} p-6`}>
          <div className="flex items-center gap-4 mb-4">
            <div className={`w-16 h-16 rounded-2xl ${cfg.iconBg} flex items-center justify-center flex-shrink-0`}>
              <Icon className={`w-8 h-8 text-white ${resultType === "loading" ? "animate-spin" : ""}`} />
            </div>
            <div>
              <h2 className={`text-xl font-bold ${cfg.textColor}`}>{cfg.title}</h2>
              <p className="text-gray-400 text-sm">{cfg.subtitle}</p>
            </div>
          </div>

          <div className="text-sm text-gray-300 mb-2">{resultMessage}</div>

          <div className="flex items-center justify-between text-xs text-gray-500 pt-3 border-t border-gray-700/50">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>Quét lúc {now}</span>
            </div>
            <div className="flex items-center gap-1.5 font-mono text-gray-600 truncate max-w-[220px]">{ticketCode}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => navigate("/staff/scan")}
            className="flex items-center justify-center gap-2 py-3.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-medium transition-colors min-h-[52px]"
          >
            <RotateCcw className="w-4 h-4" />
            Quét tiếp
          </button>
          <button
            onClick={() => navigate("/")}
            className="flex items-center justify-center gap-2 py-3.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl font-medium transition-colors min-h-[52px]"
          >
            <ArrowLeft className="w-4 h-4" />
            Trang chủ
          </button>
        </div>
      </div>
    </div>
  );
}
