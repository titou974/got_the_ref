import { getTranslations } from "next-intl/server";
import type { TrendingKeywordsInsight } from "@/lib/geo/types";
import { Badge } from "@/components/tremor/Badge";
import { Card, CardTitle } from "./Card";

/**
 * L'avant et l'après d'une même page, dans la forme où Google les affiche.
 *
 * Un seul objet à lire : la balise title et la meta description d'aujourd'hui,
 * puis les mêmes réécrites, séparées par une flèche. Le décalage se voit sans
 * commentaire, ce qui vaut mieux qu'un audit critère par critère : le client a
 * déjà vu son site passer sous cette forme dans un résultat de recherche.
 *
 * Sous le diptyque, deux repères et rien d'autre : les mots-clés de la niche
 * effectivement placés dans la proposition, et le niveau estimé de chaque
 * version. Le reste — dynamique du mot-clé, emplacements attendus, notes —
 * appartient au rapport d'analyse.
 */

type Current = {
  title: string | null;
  metaDescription: string | null;
  url: string;
  domain: string;
};

export async function ContentCompare({
  current,
  insight,
}: {
  current: Current;
  /** Mots-clés de la niche + réécriture livrée par l'analyse. */
  insight: TrendingKeywordsInsight | null;
}) {
  const t = await getTranslations("dashboard.content");
  const suggested = insight?.suggested ?? null;
  const keywords = insight?.keywords.map((keyword) => keyword.keyword) ?? [];

  const usedKeywords = suggested
    ? keywords.filter((keyword) =>
        containsKeyword(`${suggested.title} ${suggested.metaDescription}`, keyword),
      )
    : [];

  const currentLevel = estimateLevel(current.title, current.metaDescription, keywords);
  const proposedLevel = suggested
    ? estimateLevel(suggested.title, suggested.metaDescription, keywords)
    : null;

  return (
    <Card>
      <CardTitle title={t("cardTitle")} hint={t("cardHint")} />

      {/* Trois colonnes sur large écran : avant, pivot, après. Empilé en
          dessous, la flèche bascule d'un quart de tour pour rester lisible. */}
      <div className="grid items-center gap-3 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:gap-4">
        <SerpPanel
          eyebrow={t("before")}
          tone="before"
          domain={current.domain}
          url={current.url}
          title={current.title}
          description={current.metaDescription}
          missingTitle={t("missing.title")}
          missingDescription={t("missing.description")}
        />

        <Pivot label={t("becomes")} />

        {suggested ? (
          <SerpPanel
            eyebrow={t("after")}
            tone="after"
            domain={current.domain}
            url={current.url}
            title={suggested.title}
            description={suggested.metaDescription}
            missingTitle={t("missing.title")}
            missingDescription={t("missing.description")}
          />
        ) : (
          <p className="rounded-2xl border border-dashed border-pebble px-4 py-10 text-center text-sm text-muted">
            {t("proposedEmpty")}
          </p>
        )}
      </div>

      <div className="mt-6 border-t border-border pt-5">
        <Eyebrow>{t("keywordsLabel")}</Eyebrow>
        {usedKeywords.length ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {usedKeywords.map((keyword) => (
              <Badge key={keyword} variant="neutral">
                {keyword}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">{t("keywordsEmpty")}</p>
        )}
      </div>

      <div className="mt-5 border-t border-border pt-5">
        <Eyebrow>{t("levelLabel")}</Eyebrow>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <LevelMeter
            caption={t("before")}
            level={currentLevel}
            label={t(`level.${currentLevel}`)}
          />
          {proposedLevel ? (
            <LevelMeter
              caption={t("after")}
              level={proposedLevel}
              label={t(`level.${proposedLevel}`)}
            />
          ) : null}
        </div>
        <p className="mt-3 text-xs text-muted">{t("levelHint")}</p>
      </div>
    </Card>
  );
}

/** Libellé de section : capitales espacées, la même dans toute la carte. */
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ash">
      {children}
    </span>
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

/** Un résultat de recherche, dans la forme où Google l'affiche. */
function SerpPanel({
  eyebrow,
  tone,
  domain,
  url,
  title,
  description,
  missingTitle,
  missingDescription,
}: {
  eyebrow: string;
  tone: "before" | "after";
  domain: string;
  url: string;
  title: string | null;
  description: string | null;
  missingTitle: string;
  missingDescription: string;
}) {
  const after = tone === "after";

  return (
    <div
      className={`rounded-2xl border p-4 ${
        after
          ? "border-obsidian/15 bg-surface shadow-[0_1px_2px_rgba(9,9,11,0.04)]"
          : "border-border bg-mist/60"
      }`}
    >
      <Eyebrow>{eyebrow}</Eyebrow>

      <div className="mt-3 flex items-center gap-2">
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
        className={`mt-2 line-clamp-2 text-[19px] leading-snug ${
          title ? "text-[#1a0dab]" : "text-danger"
        }`}
      >
        {title ?? missingTitle}
      </p>
      <p
        className={`mt-1 text-[13px] leading-relaxed ${description ? "text-steel" : "text-danger"}`}
      >
        {description ?? missingDescription}
      </p>
    </div>
  );
}

/** Le niveau estimé, en trois crans : à revoir, correct, optimal. */
function LevelMeter({
  caption,
  level,
  label,
}: {
  caption: string;
  level: Level;
  label: string;
}) {
  const fill = level === 3 ? "bg-success" : level === 2 ? "bg-warning" : "bg-danger";

  return (
    <div className="rounded-2xl border border-border px-4 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ash">
          {caption}
        </span>
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="mt-2 flex gap-1" aria-hidden>
        {[1, 2, 3].map((step) => (
          <span
            key={step}
            className={`h-1.5 flex-1 rounded-full ${step <= level ? fill : "bg-fog"}`}
          />
        ))}
      </div>
    </div>
  );
}

type Level = 1 | 2 | 3;

/** Longueurs affichables sans troncature dans un résultat de recherche. */
const TITLE_RANGE = [30, 65] as const;
const DESCRIPTION_RANGE = [70, 160] as const;

/**
 * Le niveau d'un couple title + meta description.
 *
 * Trois critères pèsent pareil : la balise title tient-elle dans la largeur
 * affichée, la meta description aussi, et les deux portent-elles les mots-clés
 * de la niche. C'est une estimation, pas une note : elle sert à comparer
 * l'avant et l'après, pas à mesurer la page dans l'absolu.
 */
function estimateLevel(
  title: string | null,
  description: string | null,
  keywords: string[],
): Level {
  const haystack = `${title ?? ""} ${description ?? ""}`;
  const matched = keywords.filter((keyword) => containsKeyword(haystack, keyword)).length;

  const score =
    lengthPoints(title, TITLE_RANGE) +
    lengthPoints(description, DESCRIPTION_RANGE) +
    Math.min(matched, 2);

  if (score >= 5) return 3;
  if (score >= 3) return 2;
  return 1;
}

function lengthPoints(value: string | null, [min, max]: readonly [number, number]) {
  if (!value) return 0;
  return value.length >= min && value.length <= max ? 2 : 1;
}

/** Comparaison insensible à la casse et aux accents, comme le ferait un moteur. */
function containsKeyword(haystack: string, keyword: string) {
  return normalize(haystack).includes(normalize(keyword));
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
