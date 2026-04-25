import { ArrowUpCircle, Gauge, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";

interface WhyInitialGasModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const WhyInitialGasModal = ({ open, onOpenChange }: WhyInitialGasModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/10 bg-[#08121b] text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Vi sao can gas khoi tao?</DialogTitle>
          <DialogDescription className="text-white/60">
            Prefund mot lan giup wallet moi co the chay giao dich ticket dau tien tren localchain.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm text-white/72">
          <div className="flex gap-3 border border-white/10 bg-white/[0.03] p-3">
            <Gauge className="mt-0.5 h-4 w-4 text-amber-300" />
            Blockchain can native gas cho transaction dau tien.
          </div>
          <div className="flex gap-3 border border-white/10 bg-white/[0.03] p-3">
            <ArrowUpCircle className="mt-0.5 h-4 w-4 text-sky-300" />
            Backend xu ly prefund thay vi frontend tu gui transaction.
          </div>
          <div className="flex gap-3 border border-white/10 bg-white/[0.03] p-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 text-emerald-300" />
            Chi cap bootstrap mot lan de tranh abuse va giu flow co kiem soat.
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

export default WhyInitialGasModal;
