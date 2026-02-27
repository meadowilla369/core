import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router";
import {
  ArrowLeft,
  AlertCircle,
  Clock,
  CheckCircle,
  User,
  Tag,
  MessageSquare,
  Shield,
  Zap,
  Edit3,
  Check,
  X,
  ChevronDown,
  FileText,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";
import { mockDisputes } from "../../lib/mockData";
import { formatDate, getPriorityColor } from "../../lib/utils";
import { toast } from "sonner";

const STATUS_CONFIG = {
  open: { label: "Mở", Icon: AlertCircle, color: "text-blue-600", bg: "bg-blue-50", badge: "bg-blue-100 text-blue-700" },
  investigating: { label: "Đang xử lý", Icon: Clock, color: "text-amber-600", bg: "bg-amber-50", badge: "bg-amber-100 text-amber-700" },
  resolved: { label: "Đã giải quyết", Icon: CheckCircle, color: "text-green-600", bg: "bg-green-50", badge: "bg-green-100 text-green-700" },
  closed: { label: "Đã đóng", Icon: CheckCircle, color: "text-gray-400", bg: "bg-gray-50", badge: "bg-gray-100 text-gray-500" },
};

const TYPE_LABELS: Record<string, string> = {
  fraud: "Gian lận",
  refund: "Yêu cầu hoàn tiền",
  technical: "Lỗi kỹ thuật",
  other: "Khác",
};

const PRIORITY_LABELS: Record<string, string> = {
  urgent: "Khẩn cấp",
  high: "Cao",
  medium: "Trung bình",
  low: "Thấp",
};

const MOCK_TIMELINE = [
  { id: 1, time: "2026-02-27T09:15:00", actor: "Admin Minh", action: "Nhận xử lý tranh chấp", type: "assign" },
  { id: 2, time: "2026-02-26T16:30:00", actor: "Hệ thống", action: "Tranh chấp được tạo tự động", type: "system" },
  { id: 3, time: "2026-02-26T14:30:00", actor: "Lê Thị Mai", action: "Nộp báo cáo tranh chấp", type: "create" },
];

export function DisputeDetail() {
  const { disputeId } = useParams();
  const navigate = useNavigate();

  const dispute = mockDisputes.find((d) => d.id === disputeId);

  const [status, setStatus] = useState(dispute?.status || "open");
  const [resolution, setResolution] = useState(dispute?.resolution || "");
  const [showResolutionForm, setShowResolutionForm] = useState(false);
  const [showConfirmClose, setShowConfirmClose] = useState(false);
  const [internalNote, setInternalNote] = useState("");

  if (!dispute) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-gray-700 mb-2">Không tìm thấy tranh chấp</h2>
          <Link to="/platform/disputes">
            <button className="px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors text-sm">
              Quay lại danh sách
            </button>
          </Link>
        </div>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.open;
  const StatusIcon = statusCfg.Icon;
  const priorityCfg = getPriorityColor(dispute.priority);

  const handleUpdateStatus = (newStatus: string) => {
    setStatus(newStatus as typeof status);
    toast.success(`Trạng thái cập nhật: ${STATUS_CONFIG[newStatus as keyof typeof STATUS_CONFIG]?.label}`);
  };

  const handleResolve = () => {
    if (!resolution.trim()) {
      toast.error("Vui lòng nhập nội dung giải quyết");
      return;
    }
    setStatus("resolved");
    setShowResolutionForm(false);
    toast.success("Tranh chấp đã được đánh dấu giải quyết!");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-3">
            <Link to="/platform/disputes">
              <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center">
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
            </Link>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base font-bold text-gray-900">
                  Tranh chấp #{dispute.id}
                </h1>
                <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${statusCfg.badge}`}>
                  <StatusIcon className="w-3 h-3" />
                  {statusCfg.label}
                </span>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${priorityCfg.bg} ${priorityCfg.text} ${priorityCfg.border}`}>
                  {PRIORITY_LABELS[dispute.priority]}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {TYPE_LABELS[dispute.type]} · Tạo: {formatDate(dispute.createdAt)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-5">
            {/* Urgent Banner */}
            {dispute.priority === "urgent" && status !== "resolved" && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
                <Zap className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium text-red-900 text-sm">Tranh chấp khẩn cấp</div>
                  <div className="text-xs text-red-600 mt-0.5">
                    SLA: Phải phản hồi trong vòng 2 giờ. Quá hạn sẽ leo thang lên cấp trên.
                  </div>
                </div>
              </div>
            )}

            {/* Description */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-gray-500" />
                Mô tả tranh chấp
              </h2>
              <p className="text-gray-700 text-sm leading-relaxed">{dispute.description}</p>

              {dispute.amount && (
                <div className="mt-4 flex items-center gap-2 p-3 bg-gray-50 rounded-xl">
                  <Tag className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-gray-600">Số tiền liên quan:</span>
                  <span className="font-semibold text-gray-900">
                    {dispute.amount.toLocaleString("vi-VN")} VND
                  </span>
                </div>
              )}
            </div>

            {/* Evidence */}
            {dispute.evidence && dispute.evidence.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-gray-500" />
                  Bằng chứng đính kèm ({dispute.evidence.length})
                </h2>
                <div className="space-y-2">
                  {dispute.evidence.map((e, i) => (
                    <button
                      key={i}
                      className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors text-left"
                    >
                      <FileText className="w-4 h-4 text-gray-500 flex-shrink-0" />
                      <span className="text-sm text-gray-700 flex-1">{e}</span>
                      <ExternalLink className="w-4 h-4 text-gray-400" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Resolution (if resolved) */}
            {status === "resolved" && resolution && (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-5">
                <h2 className="font-semibold text-green-900 mb-3 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  Kết quả giải quyết
                </h2>
                <p className="text-green-800 text-sm leading-relaxed">{resolution}</p>
              </div>
            )}

            {/* Resolution Form */}
            {showResolutionForm && status !== "resolved" && (
              <div className="bg-white rounded-2xl border border-violet-200 shadow-sm p-5">
                <h2 className="font-semibold text-gray-900 mb-3">Nhập kết quả giải quyết</h2>
                <textarea
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  placeholder="Mô tả chi tiết cách đã giải quyết tranh chấp này..."
                  rows={5}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:border-violet-400 focus:ring-2 focus:ring-violet-100 focus:outline-none resize-none"
                />
                <div className="flex gap-3 mt-3">
                  <button
                    onClick={handleResolve}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-medium transition-colors min-h-[44px]"
                  >
                    <Check className="w-4 h-4" />
                    Xác nhận giải quyết
                  </button>
                  <button
                    onClick={() => setShowResolutionForm(false)}
                    className="px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors min-h-[44px]"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Internal Note */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-gray-500" />
                Ghi chú nội bộ
              </h2>
              <textarea
                value={internalNote}
                onChange={(e) => setInternalNote(e.target.value)}
                placeholder="Ghi chú cho nhóm hỗ trợ (không hiển thị cho người dùng)..."
                rows={3}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:border-violet-400 focus:ring-2 focus:ring-violet-100 focus:outline-none resize-none bg-gray-50"
              />
              <button
                onClick={() => {
                  if (internalNote.trim()) {
                    toast.success("Ghi chú đã được lưu");
                    setInternalNote("");
                  }
                }}
                className="mt-2 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm hover:bg-gray-800 transition-colors min-h-[36px]"
              >
                Lưu ghi chú
              </button>
            </div>

            {/* Timeline */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-500" />
                Lịch sử hoạt động
              </h2>
              <div className="relative pl-5 space-y-5">
                <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-gray-100" />
                {MOCK_TIMELINE.map((item) => (
                  <div key={item.id} className="relative">
                    <div className={`absolute -left-3.5 w-3 h-3 rounded-full border-2 border-white ${
                      item.type === "create" ? "bg-blue-500" :
                      item.type === "assign" ? "bg-violet-500" :
                      "bg-gray-300"
                    }`} />
                    <div className="text-sm text-gray-700">{item.action}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      <span className="font-medium text-gray-500">{item.actor}</span>
                      {" · "}
                      {formatDate(item.time)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-5">
            {/* Action Panel */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Hành động</h3>
              <div className="space-y-2">
                {status === "open" && (
                  <button
                    onClick={() => handleUpdateStatus("investigating")}
                    className="w-full flex items-center justify-between px-4 py-3 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 rounded-xl text-sm font-medium transition-colors min-h-[44px]"
                  >
                    <span className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Bắt đầu xử lý
                    </span>
                    <ChevronDown className="w-4 h-4" />
                  </button>
                )}

                {status !== "resolved" && status !== "closed" && (
                  <button
                    onClick={() => setShowResolutionForm(true)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-green-50 hover:bg-green-100 border border-green-200 text-green-800 rounded-xl text-sm font-medium transition-colors min-h-[44px]"
                  >
                    <span className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      Đánh dấu đã giải quyết
                    </span>
                    <ChevronDown className="w-4 h-4" />
                  </button>
                )}

                <button
                  onClick={() => {
                    toast.info("Chức năng leo thang chưa khả dụng trong demo");
                  }}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium transition-colors min-h-[44px]"
                >
                  <span className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Leo thang lên cấp trên
                  </span>
                </button>

                {/* Destructive close */}
                {status !== "closed" && (
                  <>
                    {showConfirmClose ? (
                      <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                        <div className="text-sm text-red-800 mb-3">
                          Xác nhận đóng tranh chấp này?
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setStatus("closed");
                              setShowConfirmClose(false);
                              toast.success("Tranh chấp đã đóng");
                            }}
                            className="flex-1 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors"
                          >
                            Xác nhận đóng
                          </button>
                          <button
                            onClick={() => setShowConfirmClose(false)}
                            className="px-3 py-2 border border-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors"
                          >
                            Hủy
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowConfirmClose(true)}
                        className="w-full flex items-center justify-between px-4 py-3 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 rounded-xl text-sm font-medium transition-colors min-h-[44px]"
                      >
                        <span className="flex items-center gap-2">
                          <X className="w-4 h-4" />
                          Đóng tranh chấp
                        </span>
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Reporter Info */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <User className="w-4 h-4 text-gray-500" />
                Người báo cáo
              </h3>
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Tên</span>
                  <span className="font-medium text-gray-900">{dispute.reporterName || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Email</span>
                  <span className="text-blue-600 text-xs">{dispute.reporterEmail || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Loại TK</span>
                  <span className="capitalize text-gray-700">
                    {dispute.reporterType === "buyer" ? "Người mua" :
                     dispute.reporterType === "seller" ? "Người bán" : "Ban tổ chức"}
                  </span>
                </div>
                {dispute.amount && (
                  <div className="flex justify-between pt-2 border-t border-gray-100">
                    <span className="text-gray-500">Số tiền</span>
                    <span className="font-semibold text-gray-900">
                      {dispute.amount.toLocaleString("vi-VN")} VND
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Ticket Info */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Tag className="w-4 h-4 text-gray-500" />
                Vé liên quan
              </h3>
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Mã vé</span>
                  <span className="font-mono text-xs text-gray-700">{dispute.ticketId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Sự kiện</span>
                  <span className="text-gray-700 text-right max-w-[60%] text-xs leading-snug">
                    {dispute.eventTitle || "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Loại</span>
                  <span className="text-gray-700">{TYPE_LABELS[dispute.type]}</span>
                </div>
              </div>
            </div>

            {/* Assigned To */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4 text-gray-500" />
                Phụ trách
              </h3>
              {dispute.assignedToName ? (
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-violet-100 rounded-full flex items-center justify-center text-violet-700 font-bold text-sm">
                    {dispute.assignedToName.charAt(0)}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 text-sm">
                      {dispute.assignedToName}
                    </div>
                    <div className="text-xs text-gray-500">Admin · Hỗ trợ</div>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => toast.info("Chức năng phân công chưa khả dụng trong demo")}
                  className="w-full py-2.5 border-2 border-dashed border-gray-200 text-gray-500 rounded-xl text-sm hover:border-violet-300 hover:text-violet-600 transition-colors"
                >
                  + Phân công nhân viên
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
