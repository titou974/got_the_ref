/**
 * Les surfaces du tableau de bord.
 *
 * Une carte blanche sur toile mist, hairline et rayon compact : la même boîte
 * pour un chiffre, un tableau ou un formulaire. Tout ce qui varie passe par
 * `className`, pour éviter une variante par écran.
 */

export function Card({
  className = "",
  id,
  children,
}: {
  className?: string;
  /** Ancre de la carte, quand un lien de la page doit y amener. */
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className={`rounded-[28px] border border-border bg-surface p-5 sm:p-6 ${className}`}
    >
      {children}
    </section>
  );
}

export function CardTitle({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-base font-semibold">{title}</h2>
        {hint ? <p className="mt-0.5 text-sm text-muted">{hint}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/** Le titre d'écran, avec le domaine en sous-titre et les actions à droite. */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title?: string;
  subtitle?: string | null;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {title && (
          <h1 className="text-2xl font-bold tracking-tight sm:text-[32px]">
            {title}
          </h1>
        )}
        {subtitle ? (
          <p className="mt-1 truncate text-sm text-muted">{subtitle}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>
      ) : null}
    </header>
  );
}

/** Variation chiffrée, verte à la hausse et rouge à la baisse. */
export function Delta({
  value,
  suffix = "%",
}: {
  value: number | null;
  suffix?: string;
}) {
  if (value === null || !Number.isFinite(value)) return null;

  const up = value >= 0;
  const rounded =
    Math.abs(value) >= 10
      ? Math.round(Math.abs(value))
      : Math.round(Math.abs(value) * 10) / 10;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-xl px-2 py-0.5 text-[11px] font-semibold tabular-nums ${
        up ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
      }`}
    >
      <span aria-hidden>{up ? "▲" : "▼"}</span>
      {rounded}
      {suffix}
    </span>
  );
}

/** Pastille d'état : reprend les trois statuts du diagnostic. */
export function StatusDot({
  status,
}: {
  status: "ok" | "warn" | "ko" | "unknown";
}) {
  const color =
    status === "ok"
      ? "bg-success"
      : status === "warn"
        ? "bg-warning"
        : status === "ko"
          ? "bg-danger"
          : "bg-pebble";

  return (
    <span
      aria-hidden
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${color}`}
    />
  );
}
