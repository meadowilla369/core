import type { ReactNode } from "react";

interface DataPanelProps {
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function DataPanel({
  title,
  description,
  action,
  className = "",
  children
}: DataPanelProps) {
  return (
    <section
      className={`rounded-lg border border-[--op-border] bg-white p-4 shadow-sm ${className}`}
    >
      {title || description || action ? (
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            {title && <h2 className="text-base font-semibold text-slate-950">{title}</h2>}
            {description ? <p className="mt-1 text-sm text-[--op-muted]">{description}</p> : null}
          </div>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}
