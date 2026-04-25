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
          <DialogTitle>OTP trong local dev den tu dau?</DialogTitle>
          <DialogDescription className="text-white/60">
            OTP duoc backend tra ve trong response dev de test full auth flow ma khong can SMS.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm text-white/72">
          <div className="flex gap-3 border border-white/10 bg-white/[0.03] p-3">
            <TestTube2 className="mt-0.5 h-4 w-4 text-amber-300" />
            Day la che do dev, khong phai luong production.
          </div>
          <div className="flex gap-3 border border-white/10 bg-white/[0.03] p-3">
            <MessageSquareText className="mt-0.5 h-4 w-4 text-sky-300" />
            Neu backend co tra ve `otpCode`, hay dung ma do de verify.
          </div>
          <div className="flex gap-3 border border-white/10 bg-white/[0.03] p-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 text-emerald-300" />
            Muc tieu la test contract auth thuc te, khong fake bo qua verification.
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-full bg-white text-black hover:bg-white/85"
          >
            Dong
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OtpHelpModal;
