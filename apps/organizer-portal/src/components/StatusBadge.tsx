import { getStatusTone, type OperationalStatus } from "@/domain/status";

interface StatusBadgeProps {
  status: OperationalStatus;
  label: string;
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const tone = getStatusTone(status);

  return (
    <span
      className={`inline-flex min-h-7 items-center rounded-full px-2.5 text-xs font-semibold ${tone.badgeClass}`}
    >
      {label}
    </span>
  );
}
