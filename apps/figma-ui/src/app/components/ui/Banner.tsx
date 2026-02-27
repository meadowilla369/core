import { ReactNode } from "react";
import { cn } from "../../lib/utils";
import { AlertCircle, CheckCircle, Info, XCircle } from "lucide-react";

interface BannerProps {
  type: "info" | "success" | "warning" | "error";
  title?: string;
  children: ReactNode;
  className?: string;
}

export function Banner({ type, title, children, className }: BannerProps) {
  const icons = {
    info: Info,
    success: CheckCircle,
    warning: AlertCircle,
    error: XCircle,
  };

  const Icon = icons[type];

  return (
    <div
      className={cn(
        "flex gap-3 p-4 rounded-lg border-2",
        {
          "bg-blue-50 border-blue-200 text-blue-900": type === "info",
          "bg-green-50 border-green-200 text-green-900": type === "success",
          "bg-yellow-50 border-yellow-200 text-yellow-900": type === "warning",
          "bg-red-50 border-red-200 text-red-900": type === "error",
        },
        className
      )}
      role="alert"
    >
      <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        {title && <div className="font-semibold mb-1">{title}</div>}
        <div className="text-sm">{children}</div>
      </div>
    </div>
  );
}
