import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";

interface OtpExpiredModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResend?: () => void;
}

const OtpExpiredModal = ({ open, onOpenChange, onResend }: OtpExpiredModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/10 bg-[#08121b] text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle>OTP đã hết hạn</DialogTitle>
          <DialogDescription className="text-white/60">
            Mã xác minh này không còn hợp lệ. Hãy yêu cầu backend cấp request mới.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-3 border border-amber-300/18 bg-amber-300/10 p-3 text-sm text-white/72">
          <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-300" />
          Đây là tình huống bình thường khi request OTP hết thời gian sống.
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-full border-white/12 bg-white/[0.04] text-white hover:bg-white/[0.08]"
          >
            Đóng
          </Button>
          <Button
            type="button"
            onClick={onResend}
            className="rounded-full bg-white text-black hover:bg-white/85"
          >
            Gửi lại OTP
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OtpExpiredModal;
