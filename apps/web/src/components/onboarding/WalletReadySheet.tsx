import { ArrowRight, WalletCards } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle
} from "@/components/ui/drawer";

interface WalletReadySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  walletAddress?: string | null;
  onContinue?: () => void;
}

const WalletReadySheet = ({
  open,
  onOpenChange,
  walletAddress,
  onContinue
}: WalletReadySheetProps) => {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="border-white/10 bg-[#08121b] text-white">
        <DrawerHeader className="text-left">
          <DrawerTitle>Wallet đã sẵn sàng</DrawerTitle>
          <DrawerDescription className="text-white/60">
            Flow 0 đã hoàn tất. Session, wallet và gas khởi tạo đã có mặt.
          </DrawerDescription>
        </DrawerHeader>
        <div className="px-4 pb-2 text-sm text-white/72">
          <div className="flex gap-3 border border-emerald-400/16 bg-emerald-400/8 p-3">
            <WalletCards className="mt-0.5 h-4 w-4 text-emerald-300" />
            {walletAddress ? (
              <span className="break-all">{walletAddress}</span>
            ) : (
              <span>Wallet bootstrap đã thành công.</span>
            )}
          </div>
        </div>
        <DrawerFooter>
          <Button
            type="button"
            onClick={onContinue}
            className="rounded-full bg-white text-black hover:bg-white/85"
          >
            Vào app
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-full border-white/12 bg-white/[0.04] text-white hover:bg-white/[0.08]"
          >
            Ở lại đây
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};

export default WalletReadySheet;
