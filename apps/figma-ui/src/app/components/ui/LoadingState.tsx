import { Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";

interface LoadingStateProps {
  message?: string;
  fullScreen?: boolean;
  className?: string;
}

export function LoadingState({ message = "Đang tải...", fullScreen = false, className }: LoadingStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3",
        fullScreen && "min-h-screen",
        !fullScreen && "py-12",
        className
      )}
    >
      <Loader2 className="w-8 h-8 text-violet-600 animate-spin" />
      <p className="text-sm text-gray-600">{message}</p>
    </div>
  );
}