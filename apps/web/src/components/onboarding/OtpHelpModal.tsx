import { MessageSquareText, ShieldCheck, TestTube2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";

interface OtpHelpModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const OtpHelpModal = ({ open, onOpenChange }: OtpHelpModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/10 bg-[#08121b] text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle>OTP trong local dev đến từ đâu?</DialogTitle>
          <DialogDescription className="text-white/60">
            OTP được backend trả về trong response dev để test full auth flow mà không cần SMS.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm text-white/72">
          <div className="flex gap-3 border border-white/10 bg-white/[0.03] p-3">
            <TestTube2 className="mt-0.5 h-4 w-4 text-amber-300" />
            Đây là chế độ dev, không phải luồng production.
          </div>
          <div className="flex gap-3 border border-white/10 bg-white/[0.03] p-3">
            <MessageSquareText className="mt-0.5 h-4 w-4 text-sky-300" />
            Nếu backend có trả về `otpCode`, hãy dùng mã đó để verify.
          </div>
          <div className="flex gap-3 border border-white/10 bg-white/[0.03] p-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 text-emerald-300" />
            Mục tiêu là test contract auth thực tế, không fake bỏ qua verification.
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-full bg-white text-black hover:bg-white/85"
          >
            Đóng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OtpHelpModal;
