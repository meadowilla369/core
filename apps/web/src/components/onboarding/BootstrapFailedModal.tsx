import { AlertTriangle, RefreshCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";

interface BootstrapFailedModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  errorMessage?: string | null;
  onRetry?: () => void;
}

const BootstrapFailedModal = ({
  open,
  onOpenChange,
  errorMessage,
  onRetry
}: BootstrapFailedModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/10 bg-[#08121b] text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Wallet bootstrap gặp lỗi</DialogTitle>
          <DialogDescription className="text-white/60">
            Phone verification đã xong, nhưng quá trình tạo hoặc đăng ký wallet chưa hoàn tất.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm text-white/72">
          <div className="flex gap-3 border border-rose-400/20 bg-rose-400/10 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-rose-300" />
            {errorMessage ?? "Không thể hoàn tất wallet bootstrap. Cần thử lại."}
          </div>
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
            onClick={onRetry}
            className="rounded-full bg-white text-black hover:bg-white/85"
          >
            <RefreshCcw className="h-4 w-4" />
            Thử lại
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BootstrapFailedModal;
