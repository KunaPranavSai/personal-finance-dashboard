"use client";

/** Shared loading / error / empty states for migrated mobile screens — same three
 * outcomes every data-fetching page in the existing app already handles,
 * just styled to the mobile shell. */

export function LoadingCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="ppm-card" aria-busy="true" aria-label="Loading">
      <div className="ppm-skeleton" style={{ height: 12, width: "40%", marginBottom: 14 }} />
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="ppm-skeleton" style={{ height: 16, width: `${90 - i * 12}%`, marginBottom: 10 }} />
      ))}
    </div>
  );
}

export function ErrorCard({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="ppm-card ppm-error">
      <div className="t">Couldn&apos;t load this</div>
      <div className="s">{message ?? "Something went wrong talking to the server. Check your connection and try again."}</div>
      {onRetry && <button type="button" onClick={onRetry}>Retry</button>}
    </div>
  );
}

export function EmptyCard({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="ppm-card ppm-empty">
      <div className="ic" aria-hidden="true">{icon}</div>
      <div className="t">{title}</div>
      <div className="s">{subtitle}</div>
    </div>
  );
}
