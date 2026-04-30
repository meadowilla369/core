import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="rounded-lg border border-[--op-border] bg-white p-8 text-center">
      <h2 className="text-lg font-semibold">Page not found</h2>
      <p className="mt-2 text-sm text-[--op-muted]">This organizer portal route does not exist.</p>
      <Link
        to="/"
        className="mt-5 inline-flex min-h-10 items-center rounded-md bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
      >
        Back to overview
      </Link>
    </div>
  );
}
