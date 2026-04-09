import { Link } from "react-router-dom";

interface CategoryPillProps {
  name: string;
  active?: boolean;
  href?: string;
  onClick?: () => void;
}

const CategoryPill = ({ name, active = false, href, onClick }: CategoryPillProps) => {
  const className = `
    inline-flex items-center px-4 py-2 border font-mono text-xs uppercase tracking-wider transition-all whitespace-nowrap
    ${
      active
        ? "bg-foreground text-background border-foreground"
        : "bg-transparent text-foreground/70 border-foreground/30 hover:border-foreground hover:text-foreground"
    }
  `;

  if (href) {
    return (
      <Link to={href} className={className}>
        {name}
      </Link>
    );
  }

  return (
    <button onClick={onClick} className={className}>
      {name}
    </button>
  );
};

export default CategoryPill;
