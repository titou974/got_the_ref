"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useTranslations } from "next-intl";
import { regenerateOnPageAction } from "@/features/dashboard/actions";
import { ON_PAGE_REWRITE_QUOTA, type OnPageElementKey } from "@/constants/plans";
import { Badge } from "@/components/tremor/Badge";
import { Card, CardTitle } from "./Card";

/**
 * Une carte de comparaison : l'existant, la flèche, la proposition.
 *
 * Client, parce que le bouton et le panneau de droite partagent le même état :
 * pendant la réécriture, c'est ce panneau-là qui doit se mettre à charger. La
 * page reste serveur et livre les trois contenus déjà rendus — l'existant, la
 * proposition, et le squelette qui la remplace le temps de l'attente.
 *
 * L'attente couvre deux temps : l'appel au modèle, puis le rafraîchissement de
 * la page qui rapporte le nouveau texte. Les enchaîner sous un seul indicateur
 * évite que l'ancienne version reparaisse une seconde entre les deux.
 */
export function CompareCard({
  element,
  remaining,
  title,
  before,
  after,
  skeleton,
  placed,
}: {
  element: OnPageElementKey;
  /** Réécritures encore disponibles aujourd'hui sur cet élément. */
  remaining: number;
  title: string;
  before: React.ReactNode;
  after: React.ReactNode | null;
  /** La proposition en cours d'écriture : même gabarit, texte en attente. */
  skeleton: React.ReactNode;
  placed: string[];
}) {
  const t = useTranslations("dashboard.content");
  const router = useRouter();
  const [isRefreshing, startRefresh] = useTransition();

  const { execute, isPending, result } = useAction(regenerateOnPageAction, {
    onSuccess: () => startRefresh(() => router.refresh()),
  });

  const working = isPending || isRefreshing;
  const left = Math.max(0, remaining);
  const exhausted = left <= 0;

  return (
    <Card>
      <CardTitle
        title={title}
        action={
          <div className="flex flex-col items-end gap-1">
            <button
              type="button"
              onClick={() => execute({ element })}
              disabled={working || exhausted}
              className="cursor-pointer rounded-pill border border-border bg-surface px-3 py-1.5 text-sm font-medium transition-colors duration-200 hover:bg-mist disabled:cursor-not-allowed disabled:opacity-50"
            >
              {working ? t("regenerating") : t("regenerate")}
            </button>
            <span className="text-[11px] tabular-nums text-ash">
              {exhausted
                ? t("regenerateExhausted")
                : t("regenerateLeft", { left, limit: ON_PAGE_REWRITE_QUOTA.daily })}
            </span>
            {result.serverError ? (
              <span className="max-w-[220px] text-right text-[11px] text-danger">
                {result.serverError}
              </span>
            ) : null}
          </div>
        }
      />

      {/* Trois colonnes sur large écran : avant, pivot, après. Empilé en
          dessous, la flèche bascule d'un quart de tour pour rester lisible. */}
      <div className="grid items-center gap-3 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:gap-4">
        <Panel tone="before" label={t("before")}>
          {before}
        </Panel>

        <Pivot label={t("becomes")} />

        {working ? (
          <Panel tone="after" label={t("after")} busy>
            {skeleton}
          </Panel>
        ) : after ? (
          <Panel tone="after" label={t("after")}>
            {after}
          </Panel>
        ) : (
          <p className="rounded-2xl border border-dashed border-pebble px-4 py-10 text-center text-sm text-muted">
            {t("proposedEmpty")}
          </p>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border pt-4">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ash">
          {t("keywordsLabel")}
        </span>
        {working ? (
          <span className="h-6 w-40 rounded-xl shimmer" />
        ) : placed.length ? (
          placed.map((keyword) => (
            <Badge key={keyword} variant="neutral">
              {keyword}
            </Badge>
          ))
        ) : (
          <span className="text-sm text-muted">{t("keywordsEmpty")}</span>
        )}
      </div>
    </Card>
  );
}

/**
 * Le panneau qui porte une version.
 *
 * Le libellé est un badge plein : sur trois cartes qui se ressemblent, c'est
 * lui qui dit d'un coup d'œil de quel côté on lit. Ambre pour l'existant, vert
 * pour la proposition.
 */
function Panel({
  label,
  tone,
  busy = false,
  children,
}: {
  label: string;
  tone: "before" | "after";
  /** Le texte est en cours de réécriture : le panneau l'annonce aux lecteurs d'écran. */
  busy?: boolean;
  children: React.ReactNode;
}) {
  const after = tone === "after";

  return (
    <div
      aria-busy={busy || undefined}
      aria-live={after ? "polite" : undefined}
      className={`rounded-2xl border p-4 ${
        after
          ? "border-obsidian/15 bg-surface shadow-[0_1px_2px_rgba(9,9,11,0.04)]"
          : "border-border bg-mist/60"
      }`}
    >
      <span
        className={`inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] ring-1 ring-inset ${
          after
            ? "bg-success/10 text-success ring-success/25"
            : "bg-warning/10 text-warning ring-warning/25"
        }`}
      >
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
        {label}
      </span>
      <div className="mt-3">{children}</div>
    </div>
  );
}

/**
 * Le pivot entre les deux versions.
 *
 * Le fil est pointillé du côté de l'existant et plein du côté de la
 * proposition : la même page, mais l'une est encore à écrire et l'autre non.
 */
function Pivot({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-1 lg:h-full lg:flex-col lg:py-6">
      <span
        aria-hidden
        className="h-px flex-1 border-t border-dashed border-pebble lg:h-auto lg:w-px lg:border-l lg:border-t-0"
      />
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border bg-surface">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4 rotate-90 text-steel lg:rotate-0"
          role="img"
          aria-label={label}
        >
          <path d="M4 12h15" />
          <path d="m13 6 6 6-6 6" />
        </svg>
      </span>
      <span
        aria-hidden
        className="h-px flex-1 border-t border-pebble lg:h-auto lg:w-px lg:border-l lg:border-t-0"
      />
    </div>
  );
}
