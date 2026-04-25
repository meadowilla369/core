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
          <DialogTitle>Wallet nay dung de lam gi?</DialogTitle>
          <DialogDescription className="text-white/60">
            He thong tao wallet tu dong de luu ticket ownership va phuc vu cac thao tac on-chain.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm text-white/72">
          <div className="flex gap-3 border border-white/10 bg-white/[0.03] p-3">
            <KeyRound className="mt-0.5 h-4 w-4 text-amber-300" />
            Ban khong can cai vi ngoai de bat dau Flow 0.
          </div>
          <div className="flex gap-3 border border-white/10 bg-white/[0.03] p-3">
            <Ticket className="mt-0.5 h-4 w-4 text-sky-300" />
            Wallet duoc dung cho ticket, resale va cac giao dich tiep theo.
          </div>
          <div className="flex gap-3 border border-white/10 bg-white/[0.03] p-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 text-emerald-300" />
            Onboarding hien complexity thay vi bat nguoi dung tu hoc crypto setup.
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-full bg-white text-black hover:bg-white/85"
          >
            Tiep tuc
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default WhatIsThisWalletModal;
