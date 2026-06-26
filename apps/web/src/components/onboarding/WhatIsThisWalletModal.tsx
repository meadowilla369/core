import { KeyRound, ShieldCheck, Ticket } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";

interface WhatIsThisWalletModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const WhatIsThisWalletModal = ({ open, onOpenChange }: WhatIsThisWalletModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/10 bg-[#08121b] text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Wallet này dùng để làm gì?</DialogTitle>
          <DialogDescription className="text-white/60">
            Hệ thống tạo wallet tự động để lưu ticket ownership và phục vụ các thao tác on-chain.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm text-white/72">
          <div className="flex gap-3 border border-white/10 bg-white/[0.03] p-3">
            <KeyRound className="mt-0.5 h-4 w-4 text-amber-300" />
            Bạn không cần cài ví ngoài để bắt đầu Flow 0.
          </div>
          <div className="flex gap-3 border border-white/10 bg-white/[0.03] p-3">
            <Ticket className="mt-0.5 h-4 w-4 text-sky-300" />
            Wallet được dùng cho ticket, resale và các giao dịch tiếp theo.
          </div>
          <div className="flex gap-3 border border-white/10 bg-white/[0.03] p-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 text-emerald-300" />
            Onboarding hiện complexity thay vì bắt người dùng tự học crypto setup.
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-full bg-white text-black hover:bg-white/85"
          >
            Tiếp tục
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default WhatIsThisWalletModal;
