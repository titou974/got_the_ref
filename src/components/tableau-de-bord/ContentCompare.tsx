"use client";

import { useState } from "react";
import { useAction } from "next-safe-action/hooks";
import { useTranslations } from "next-intl";
import { rewriteOnPageAction } from "@/features/dashboard/actions";
import type { OnPageRewrite } from "@/features/dashboard/service";
import { Card, CardTitle } from "./Card";
import { SearchLoader } from "@/components/SearchLoader";

/**
 * L'existant et la proposition, côte à côte.
 *
 * À gauche, ce que le site affiche aujourd'hui, présenté comme un résultat
 * Google : c'est sous cette forme que le client l'a déjà vu passer, et le
 * décalage avec ce qu'il croyait écrire saute aux yeux tout seul. La balise
 * title et la meta description s'arrêtent là : le H1 et le premier paragraphe
 * sont audités juste en dessous, sous forme de cartes, parce qu'eux se jugent
 * sur leur contenu et non sur leur allure dans un résultat de recherche.
 *
 * À droite, la réécriture. Elle arrive déjà remplie quand l'analyse en a
 * produit une ; le bouton en redemande une autre, à jour des mots-clés du mois.
 */

type Current = {
  title: string | null;
  metaDescription: string | null;
  url: string;
  domain: string;
};

export function ContentCompare({
  current,
  suggested,
}: {
  current: Current;
  /** Réécriture livrée par l'analyse, avant toute demande du client. */
  suggested: { title: string; metaDescription: string; h1: string } | null;
}) {
  const t = useTranslations("dashboard.content");
  const [rewrite, setRewrite] = useState<OnPageRewrite | null>(null);
  const { execute, isPending, result } = useAction(rewriteOnPageAction, {
    onSuccess: ({ data }) => setRewrite(data ?? null),
  });

  const proposal = rewrite ?? (suggested ? { ...suggested, intro: null, reasons: [] } : null);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardTitle title={t("currentTitle")} hint={t("currentHint")} />

        <SerpRow
          domain={current.domain}
          url={current.url}
          title={current.title}
          description={current.metaDescription}
          missingTitle={t("missing.title")}
          missingDescription={t("missing.description")}
        />
      </Card>

      <Card>
        <CardTitle
          title={t("proposedTitle")}
          hint={t("proposedHint")}
          action={
            <button
              type="button"
              onClick={() => execute({})}
              disabled={isPending}
              className="cursor-pointer rounded-pill bg-obsidian px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-ink disabled:opacity-60"
            >
              {isPending ? t("working") : proposal ? t("again") : t("generate")}
            </button>
          }
        />

        {result.serverError ? (
          <p className="mb-3 text-sm text-danger">{result.serverError}</p>
        ) : null}

        {isPending ? (
          <SearchLoader kind="writing" compact title={t("working")} />
        ) : proposal ? (
          <>
            <SerpRow
              domain={current.domain}
              url={current.url}
              title={proposal.title}
              description={proposal.metaDescription}
              missingTitle=""
              missingDescription=""
            />

            <dl className="mt-5 space-y-4 border-t border-border pt-5">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-steel">
                  {t("h1")}
                </dt>
                <dd className="mt-1 text-sm">{proposal.h1}</dd>
              </div>
              {proposal.intro ? (
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-steel">
                    {t("intro")}
                  </dt>
                  <dd className="mt-1 text-sm text-muted">{proposal.intro}</dd>
                </div>
              ) : null}
            </dl>

            {proposal.reasons.length ? (
              <ul className="mt-5 space-y-1.5 border-t border-border pt-5">
                {proposal.reasons.map((reason) => (
                  <li key={reason} className="flex gap-2 text-sm text-muted">
                    <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-pebble" />
                    {reason}
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : (
          <p className="rounded-2xl bg-mist px-4 py-8 text-center text-sm text-muted">
            {t("proposedEmpty")}
          </p>
        )}
      </Card>
    </div>
  );
}

/** Un résultat de recherche, dans la forme où Google l'affiche. */
function SerpRow({
  domain,
  url,
  title,
  description,
  missingTitle,
  missingDescription,
}: {
  domain: string;
  url: string;
  title: string | null;
  description: string | null;
  missingTitle: string;
  missingDescription: string;
}) {
  return (
    <div className="rounded-2xl border border-border p-4">
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="flex h-6 w-6 items-center justify-center rounded-full bg-mist text-[11px] font-semibold text-steel"
        >
          {domain.slice(0, 1).toUpperCase()}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-medium leading-tight">{domain}</span>
          <span className="block truncate text-[11px] leading-tight text-ash">{url}</span>
        </span>
      </div>

      <p
        className={`mt-2 text-[19px] leading-snug ${
          title ? "text-[#1a0dab]" : "text-danger"
        } line-clamp-2`}
      >
        {title ?? missingTitle}
      </p>
      <p className={`mt-1 text-[13px] leading-relaxed ${description ? "text-steel" : "text-danger"}`}>
        {description ?? missingDescription}
      </p>
    </div>
  );
}
