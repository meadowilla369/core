import { Clock3 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";

interface RateLimitModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  retryAfterSeconds?: number;
}

const RateLimitModal = ({ open, onOpenChange, retryAfterSeconds }: RateLimitModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/10 bg-[#08121b] text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle>OTP đang bị rate limit</DialogTitle>
          <DialogDescription className="text-white/60">
            Backend tạm thời chặn request mới để giảm abuse. Hãy đợi rồi thử lại.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-3 border border-white/10 bg-white/[0.03] p-3 text-sm text-white/72">
          <Clock3 className="mt-0.5 h-4 w-4 text-sky-300" />
          {retryAfterSeconds
            ? `Thử lại sau ${retryAfterSeconds} giây.`
            : "Thử lại sau một khoảng nghỉ ngắn hoặc đợi request window reset."}
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

export default RateLimitModal;
