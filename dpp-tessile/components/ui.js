export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({ children, className = "", as: Tag = "section", ...rest }) {
  return (
    <Tag className={`rounded-2xl border border-line bg-white p-5 shadow-sm ${className}`} {...rest}>
      {children}
    </Tag>
  );
}

export function EmptyState({ title, text, action }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line bg-white px-6 py-12 text-center">
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      {text && <p className="max-w-md text-sm text-muted">{text}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

const TONES = {
  neutral: "bg-gray-100 text-gray-700",
  warning: "bg-amber-100 text-amber-900",
  error: "bg-red-100 text-red-900",
  info: "bg-mint text-forest",
  success: "bg-emerald-100 text-emerald-900"
};

export function StatusBadge({ tone = "neutral", children }) {
  return <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${TONES[tone]}`}>{children}</span>;
}

export const btnPrimary =
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-brand px-5 text-sm font-semibold text-white hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-brand/40";
export const btnSecondary =
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-forest hover:bg-surface focus:outline-none focus:ring-2 focus:ring-brand/30";

// Honest placeholder for an action that is not built yet: visibly disabled, with the reason.
export function SoonButton({ children, reason }) {
  return (
    <button type="button" disabled aria-disabled="true" title={reason}
      className="inline-flex min-h-[44px] cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-line bg-gray-50 px-4 text-sm font-semibold text-gray-500">
      {children}
    </button>
  );
}
