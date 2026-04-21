import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";

interface TrustInfoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const trustRows = [
  {
    label: "Verified",
    description: "Event hoặc listing có đủ metadata để hiển thị như một nguồn bán đáng tin cậy."
  },
  {
    label: "Resale safe",
    description: "Luồng bán lại tuân theo guardrails của nền tảng, giúp việc chuyển vé rõ ràng hơn."
  },
  {
    label: "Official seller",
    description:
      "Nguồn vé đến từ organizer hoặc kênh bán được ưu tiên hiển thị trên Ticket Platform."
  },
  {
    label: "Sync",
    description:
      "Trạng thái đồng bộ giúp người dùng thấy mức độ cập nhật của dữ liệu giao dịch hoặc vé."
  }
];

const TrustInfoModal = ({ open, onOpenChange }: TrustInfoModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-white/10 bg-[#090a0d] p-0 text-foreground">
        <DialogHeader className="border-b border-white/10 px-5 py-4">
          <DialogTitle className="text-left text-xl tracking-tight text-white">
            Trust signals
          </DialogTitle>
          <DialogDescription className="text-left text-sm text-white/60">
            Các badge này giúp người dùng hiểu nhanh vì sao một event hoặc listing đáng để cân nhắc.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 px-5 py-5">
          {trustRows.map((row) => (
            <div key={row.label} className="border border-white/10 bg-white/[0.03] p-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/48">
                {row.label}
              </p>
              <p className="mt-2 text-sm leading-6 text-white/76">{row.description}</p>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TrustInfoModal;
