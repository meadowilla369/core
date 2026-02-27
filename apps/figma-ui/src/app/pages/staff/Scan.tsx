import { useState, useRef } from "react";
import { useNavigate, Link } from "react-router";
import {
  ArrowLeft,
  Scan,
  Keyboard,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Zap,
  History,
  ChevronRight,
  Wifi,
  Battery,
  Clock,
} from "lucide-react";
import { encodeQrPayload, loadMyTickets, loadTicketQr } from "../../lib/live-data";

interface ScanHistoryItem {
  id: string;
  ticketCode: string;
  time: string;
  status: "valid" | "used" | "invalid";
  eventTitle: string;
  tierName: string;
}

const MOCK_HISTORY: ScanHistoryItem[] = [
  {
    id: "1",
    ticketCode: "TKT001-MT2026-HA-20260415",
    time: "18:45:32",
    status: "valid",
    eventTitle: "Mỹ Tâm Live in Concert",
    tierName: "Hạng A",
  },
  {
    id: "2",
    ticketCode: "TKT009-MT2026-VIP-20260415",
    time: "18:44:18",
    status: "used",
    eventTitle: "Mỹ Tâm Live in Concert",
    tierName: "VIP Diamond",
  },
  {
    id: "3",
    ticketCode: "FAKE-TKT-999-INVALID",
    time: "18:43:05",
    status: "invalid",
    eventTitle: "—",
    tierName: "—",
  },
  {
    id: "4",
    ticketCode: "TKT007-MT2026-B-20260415",
    time: "18:42:44",
    status: "valid",
    eventTitle: "Mỹ Tâm Live in Concert",
    tierName: "Hạng B",
  },
];

export function StaffScan() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"camera" | "manual">("camera");
  const [manualCode, setManualCode] = useState("");
  const [scanning, setScanning] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingLiveQr, setLoadingLiveQr] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const now = new Date();
  const timeStr = now.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const handleScan = async (code?: string) => {
    const ticketCode = code || manualCode;
    if (!ticketCode.trim()) return;

    setScanning(true);
    await new Promise((r) => setTimeout(r, 800));
    setScanning(false);

    // Route to result with the code
    navigate("/staff/scan-result", {
      state: { ticketCode: ticketCode.trim() },
    });
  };

  const handleLiveScan = async () => {
    setLoadingLiveQr(true);
    try {
      const tickets = await loadMyTickets();
      const firstActive = tickets.find((item) => item.status === "active" || item.status === "resale");
      if (!firstActive) {
        navigate("/staff/scan-result", {
          state: { ticketCode: "NO_ACTIVE_TICKET" }
        });
        return;
      }

      const qr = await loadTicketQr(firstActive.id);
      navigate("/staff/scan-result", {
        state: { ticketCode: encodeQrPayload(qr) }
      });
    } catch {
      navigate("/staff/scan-result", {
        state: { ticketCode: "LIVE_SCAN_FAILED" }
      });
    } finally {
      setLoadingLiveQr(false);
    }
  };

  const statusConfig = {
    valid: { color: "text-green-600", bg: "bg-green-50", icon: CheckCircle, label: "Hợp lệ" },
    used: { color: "text-orange-600", bg: "bg-orange-50", icon: AlertTriangle, label: "Đã dùng" },
    invalid: { color: "text-red-600", bg: "bg-red-50", icon: XCircle, label: "Không hợp lệ" },
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Staff Header */}
      <div className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link to="/">
                <button className="p-2 hover:bg-gray-800 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center">
                  <ArrowLeft className="w-5 h-5 text-gray-400" />
                </button>
              </Link>
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-sm font-medium text-white">Nhân viên kiểm vé</span>
                </div>
                <div className="text-xs text-gray-400">Mỹ Tâm Live in Concert 2026</div>
              </div>
            </div>
            <div className="flex items-center gap-3 text-gray-400">
              <div className="flex items-center gap-1 text-xs">
                <Wifi className="w-3.5 h-3.5 text-green-400" />
                <span className="text-green-400">Online</span>
              </div>
              <div className="flex items-center gap-1 text-xs">
                <Battery className="w-3.5 h-3.5" />
                <span>87%</span>
              </div>
              <div className="flex items-center gap-1 text-xs">
                <Clock className="w-3.5 h-3.5" />
                <span>{timeStr}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Stats Bar */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Đã quét", value: "247", color: "text-blue-400" },
            { label: "Hợp lệ", value: "241", color: "text-green-400" },
            { label: "Từ chối", value: "6", color: "text-red-400" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-gray-900 rounded-xl p-3.5 border border-gray-800 text-center"
            >
              <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Mode Toggle */}
        <div className="flex bg-gray-900 border border-gray-800 rounded-xl p-1">
          <button
            onClick={() => setMode("camera")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
              mode === "camera"
                ? "bg-violet-600 text-white shadow-lg"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            <Scan className="w-4 h-4" />
            Quét QR
          </button>
          <button
            onClick={() => {
              setMode("manual");
              setTimeout(() => inputRef.current?.focus(), 100);
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
              mode === "manual"
                ? "bg-violet-600 text-white shadow-lg"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            <Keyboard className="w-4 h-4" />
            Nhập thủ công
          </button>
        </div>

        {/* Camera Viewfinder */}
        {mode === "camera" && (
          <div className="relative">
            <div
              className="relative w-full bg-gray-900 rounded-2xl overflow-hidden border border-gray-700"
              style={{ aspectRatio: "1" }}
            >
              {/* Simulated camera feed */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-gray-600 text-sm mb-4">
                  {scanning ? "Đang xử lý..." : "Hướng camera vào mã QR"}
                </div>

                {/* QR Scan Zone */}
                <div className="relative w-56 h-56">
                  <div className="absolute inset-0 border-2 border-white/20 rounded-lg" />
                  {/* Corner markers */}
                  {[
                    "top-0 left-0 border-t-2 border-l-2 rounded-tl",
                    "top-0 right-0 border-t-2 border-r-2 rounded-tr",
                    "bottom-0 left-0 border-b-2 border-l-2 rounded-bl",
                    "bottom-0 right-0 border-b-2 border-r-2 rounded-br",
                  ].map((cls, i) => (
                    <div
                      key={i}
                      className={`absolute w-7 h-7 border-violet-400 ${cls}`}
                    />
                  ))}

                  {/* Scan line animation */}
                  {!scanning && (
                    <div
                      className="absolute left-0 right-0 h-0.5 bg-violet-400 shadow-[0_0_10px_rgba(139,92,246,0.8)]"
                      style={{
                        animation: "scanline 2s ease-in-out infinite",
                        top: "50%",
                      }}
                    />
                  )}

                  {scanning && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-12 h-12 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom hint */}
              <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center">
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-black/50 rounded-full text-xs text-gray-300">
                  <Zap className="w-3.5 h-3.5 text-yellow-400" />
                  QR tự động làm mới mỗi 3 giây
                </div>
              </div>
            </div>

            {/* Simulate scan buttons */}
            <div className="mt-3 grid grid-cols-3 gap-2">
              <button
                onClick={handleLiveScan}
                className="py-2.5 bg-green-600/20 border border-green-600/30 text-green-400 text-xs rounded-lg hover:bg-green-600/30 transition-colors"
              >
                {loadingLiveQr ? "Đang lấy QR live..." : "✓ Vé hợp lệ (live)"}
              </button>
              <button
                onClick={() => handleScan("TKT-USED-ALREADY")}
                className="py-2.5 bg-orange-600/20 border border-orange-600/30 text-orange-400 text-xs rounded-lg hover:bg-orange-600/30 transition-colors"
              >
                ⚠ Vé đã dùng
              </button>
              <button
                onClick={() => handleScan("FAKE-QR-INVALID-001")}
                className="py-2.5 bg-red-600/20 border border-red-600/30 text-red-400 text-xs rounded-lg hover:bg-red-600/30 transition-colors"
              >
                ✗ Vé giả
              </button>
            </div>
            <div className="text-center text-xs text-gray-600 mt-1">
              Demo: Nhấn để mô phỏng kết quả quét
            </div>
          </div>
        )}

        {/* Manual Entry */}
        {mode === "manual" && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-medium text-gray-300">Nhập mã vé thủ công</h3>
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && handleScan()}
                placeholder="VD: TKT001-MT2026-HA-20260415"
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-600 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 focus:outline-none font-mono text-sm min-h-[44px]"
              />
            </div>
            <button
              onClick={() => handleScan()}
              disabled={!manualCode.trim() || scanning}
              className="w-full py-3 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-colors min-h-[44px] flex items-center justify-center gap-2"
            >
              {scanning ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Đang xác thực...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Xác thực vé
                </>
              )}
            </button>
          </div>
        )}

        {/* Scan History */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-800/50 transition-colors"
          >
            <div className="flex items-center gap-2 text-sm font-medium text-gray-300">
              <History className="w-4 h-4" />
              Lịch sử quét gần đây
              <span className="px-2 py-0.5 bg-gray-800 text-gray-400 text-xs rounded-full">
                {MOCK_HISTORY.length}
              </span>
            </div>
            <ChevronRight
              className={`w-4 h-4 text-gray-500 transition-transform ${
                showHistory ? "rotate-90" : ""
              }`}
            />
          </button>

          {showHistory && (
            <div className="border-t border-gray-800 divide-y divide-gray-800">
              {MOCK_HISTORY.map((item) => {
                const cfg = statusConfig[item.status];
                const Icon = cfg.icon;
                return (
                  <div key={item.id} className="flex items-center gap-3 px-5 py-3.5">
                    <div className={`w-8 h-8 rounded-full ${cfg.bg} flex items-center justify-center flex-shrink-0`}>
                      <Icon className={`w-4 h-4 ${cfg.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-gray-300 truncate font-mono">
                        {item.ticketCode}
                      </div>
                      <div className="text-xs text-gray-600">
                        {item.eventTitle !== "—" ? `${item.eventTitle} · ${item.tierName}` : "—"}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</div>
                      <div className="text-xs text-gray-600">{item.time}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes scanline {
          0%, 100% { top: 10%; }
          50% { top: 90%; }
        }
      `}</style>
    </div>
  );
}
