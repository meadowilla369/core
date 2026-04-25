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
          <DialogTitle>Vi sao can so dien thoai?</DialogTitle>
          <DialogDescription className="text-white/60">
            So dien thoai la anchor dau tien cho login, recovery va chong abuse trong Flow 0.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm text-white/72">
          <div className="flex gap-3 border border-white/10 bg-white/[0.03] p-3">
            <Smartphone className="mt-0.5 h-4 w-4 text-emerald-300" />
            Dang nhap nhanh bang OTP ma khong can password throwaway.
          </div>
          <div className="flex gap-3 border border-white/10 bg-white/[0.03] p-3">
            <Fingerprint className="mt-0.5 h-4 w-4 text-amber-300" />
            Giu lai recovery anchor truoc khi co wallet recovery day du.
          </div>
          <div className="flex gap-3 border border-white/10 bg-white/[0.03] p-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 text-sky-300" />
            Giam duplicate registration va han che abuse trong local demo.
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-full bg-white text-black hover:bg-white/85"
          >
            Da hieu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default WhyPhoneModal;
