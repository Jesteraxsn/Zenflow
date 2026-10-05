import Link from "next/link";

export function Loading({ label = "Loading…", className = "" }) {
  return (
    <div className={`flex items-center justify-center gap-3 py-16 text-sm text-muted ${className}`}>
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-forest" />
      {label}
    </div>
  );
}

export function ErrorBox({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="mb-4 flex items-center justify-between gap-4 rounded-lg border border-rose/30 bg-rose/5 px-4 py-3 text-xs text-rose">
      <span>{error.message ?? String(error)}</span>
      {onRetry && (
        <button onClick={onRetry} className="font-semibold underline">
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyCard({ title, body, href, cta }) {
  return (
    <div className="card mx-auto max-w-md p-8 text-center">
      <h1 className="font-serif text-3xl">{title}</h1>
      {body && <p className="mt-2 text-sm text-muted">{body}</p>}
      {href && (
        <Link href={href} className="btn-primary mt-6">
          {cta}
        </Link>
      )}
    </div>
  );
}

// Small floating confirmation used after staff actions.
export function Toast({ message }) {
  if (!message) return null;
  return (
    <div className="fixed right-4 bottom-4 z-50 rounded-lg bg-espresso px-4 py-3 text-xs text-white shadow-lg">
      {message}
    </div>
  );
}
