import { RefreshCcw, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle
} from "@/components/ui/drawer";

interface PrefundRetrySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  statusMessage?: string | null;
  onRetry?: () => void;
}

const PrefundRetrySheet = ({
  open,
  onOpenChange,
  statusMessage,
  onRetry
}: PrefundRetrySheetProps) => {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="border-white/10 bg-[#08121b] text-white">
        <DrawerHeader className="text-left">
          <DrawerTitle>Retry prefund</DrawerTitle>
          <DrawerDescription className="text-white/60">
            Dung surface nay khi localchain cham, rpc loi hoac backend can goi lai prefund job.
          </DrawerDescription>
        </DrawerHeader>
        <div className="px-4 pb-2 text-sm text-white/72">
          <div className="border border-white/10 bg-white/[0.03] p-3">
            {statusMessage ?? "Chua nhan duoc prefund confirmation. Ban co the goi lai retry."}
          </div>
          <div className="mt-3 flex gap-3 border border-emerald-400/16 bg-emerald-400/8 p-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 text-emerald-300" />
            Retry van giu logic one-time prefund o backend, frontend khong gui giao dich truc tiep.
          </div>
        </div>
        <DrawerFooter>
          <Button
            type="button"
            onClick={onRetry}
            className="rounded-full bg-white text-black hover:bg-white/85"
          >
            <RefreshCcw className="h-4 w-4" />
            Retry prefund
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-full border-white/12 bg-white/[0.04] text-white hover:bg-white/[0.08]"
          >
            Dong
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};

export default PrefundRetrySheet;
