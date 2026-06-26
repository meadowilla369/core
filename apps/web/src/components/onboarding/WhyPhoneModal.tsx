import { Fingerprint, ShieldCheck, Smartphone } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";

interface WhyPhoneModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const WhyPhoneModal = ({ open, onOpenChange }: WhyPhoneModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/10 bg-[#08121b] text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Vì sao cần số điện thoại?</DialogTitle>
          <DialogDescription className="text-white/60">
            Số điện thoại là anchor đầu tiên cho login, recovery và chống abuse trong Flow 0.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm text-white/72">
          <div className="flex gap-3 border border-white/10 bg-white/[0.03] p-3">
            <Smartphone className="mt-0.5 h-4 w-4 text-emerald-300" />
            Đăng nhập nhanh bằng OTP mà không cần password throwaway.
          </div>
          <div className="flex gap-3 border border-white/10 bg-white/[0.03] p-3">
            <Fingerprint className="mt-0.5 h-4 w-4 text-amber-300" />
            Giữ lại recovery anchor trước khi có wallet recovery đầy đủ.
          </div>
          <div className="flex gap-3 border border-white/10 bg-white/[0.03] p-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 text-sky-300" />
            Giảm duplicate registration và hạn chế abuse trong local demo.
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-full bg-white text-black hover:bg-white/85"
          >
            Đã hiểu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default WhyPhoneModal;
