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
          <DialogTitle>OTP dang bi rate limit</DialogTitle>
          <DialogDescription className="text-white/60">
            Backend tam thoi chan request moi de giam abuse. Hay doi roi thu lai.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-3 border border-white/10 bg-white/[0.03] p-3 text-sm text-white/72">
          <Clock3 className="mt-0.5 h-4 w-4 text-sky-300" />
          {retryAfterSeconds
            ? `Thu lai sau ${retryAfterSeconds} giay.`
            : "Thu lai sau mot khoang nghi ngan hoac doi request window reset."}
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

export default RateLimitModal;
