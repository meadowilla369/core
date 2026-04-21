import { ReactNode } from "react";
import { Link } from "react-router-dom";

interface EditorialSectionBlockProps {
  label: string;
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  children: ReactNode;
}

const EditorialSectionBlock = ({
  label,
  title,
  description,
  actionLabel,
  actionHref,
  children
}: EditorialSectionBlockProps) => {
  return (
    <section className="px-4 py-6">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-foreground/45">
            {label}
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight">{title}</h2>
          {description && (
            <p className="mt-1 max-w-[28rem] text-sm text-foreground/58">{description}</p>
          )}
        </div>
        {actionLabel && actionHref && (
          <Link
            to={actionHref}
            className="font-mono text-[10px] uppercase tracking-[0.22em] text-foreground/45 transition-colors hover:text-foreground"
          >
            {actionLabel}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
};

export default EditorialSectionBlock;
