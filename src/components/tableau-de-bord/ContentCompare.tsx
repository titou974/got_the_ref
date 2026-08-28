import { getTranslations } from "next-intl/server";
import type { TrendingKeywordsInsight } from "@/lib/geo/types";
import { Badge } from "@/components/tremor/Badge";
import { Card, CardTitle } from "./Card";
import { RegenerateButton } from "./RegenerateButton";
import { SiteFavicon } from "./SiteFavicon";
import { ON_PAGE_REWRITE_QUOTA, type OnPageElementKey } from "@/constants/plans";
import type { OnPageRewriteQuota } from "@/features/dashboard/queries";

/**
 * Trois éléments de la page d'accueil, chacun dans son avant/après.
 *
 * Le couple title + meta description garde la forme d'un résultat Google : le
 * client l'a déjà vu passer ainsi. Le H1 et le paragraphe d'introduction, eux,
 * sont montrés dans leur balise — `<h1>…</h1>`, `<p>…</p>` — parce que c'est
 * là qu'ils vivent et que la balise dit à elle seule leur poids.
 *
 * Autour de chaque comparaison, une seule information : les mots-clés de la
 * niche réellement placés dans la réécriture. Pas de note, pas de diagnostic —
 * l'audit critère par critère est le travail du rapport d'analyse.
 */

type Current = {
  title: string | null;
  metaDescription: string | null;
  h1: string | null;
  intro: string | null;
  url: string;
  domain: string;
};

export async function ContentCompare({
  current,
  insight,
  quota,
}: {
  current: Current;
  /** Mots-clés de la niche + réécriture livrée par l'analyse. */
  insight: TrendingKeywordsInsight | null;
  /** Ce qu'il reste de réécritures aujourd'hui, élément par élément. */
  quota: OnPageRewriteQuota;
}) {
  const t = await getTranslations("dashboard.content");
  const suggested = insight?.suggested ?? null;
  const keywords = insight?.keywords.map((keyword) => keyword.keyword) ?? [];

  return (
    <div className="space-y-4">
      <CompareCard
        element="serp"
        remaining={quota.serp}
        title={t("serpTitle")}
        arrowLabel={t("becomes")}
        beforeLabel={t("before")}
        afterLabel={t("after")}
        emptyLabel={t("proposedEmpty")}
        keywordsLabel={t("keywordsLabel")}
        keywordsEmpty={t("keywordsEmpty")}
        placed={placedIn(
          keywords,
          suggested && `${suggested.title} ${suggested.metaDescription}`,
        )}
        before={
          <SerpRow
            domain={current.domain}
            url={current.url}
            title={current.title}
            description={current.metaDescription}
            missingTitle={t("missing.title")}
            missingDescription={t("missing.description")}
          />
        }
        after={
          suggested ? (
            <SerpRow
              domain={current.domain}
              url={current.url}
              title={suggested.title}
              description={suggested.metaDescription}
              missingTitle={t("missing.title")}
              missingDescription={t("missing.description")}
            />
          ) : null
        }
      />

      <CompareCard
        element="h1"
        remaining={quota.h1}
        title={t("h1Title")}
        arrowLabel={t("becomes")}
        beforeLabel={t("before")}
        afterLabel={t("after")}
        emptyLabel={t("proposedEmpty")}
        keywordsLabel={t("keywordsLabel")}
        keywordsEmpty={t("keywordsEmpty")}
        placed={placedIn(keywords, suggested?.h1 ?? null)}
        before={<Markup tag="h1" text={current.h1} missing={t("missing.h1")} />}
        after={suggested ? <Markup tag="h1" text={suggested.h1} missing={t("missing.h1")} /> : null}
      />

      <CompareCard
        element="intro"
        remaining={quota.intro}
        title={t("introTitle")}
        arrowLabel={t("becomes")}
        beforeLabel={t("before")}
        afterLabel={t("after")}
        emptyLabel={t("proposedEmpty")}
        keywordsLabel={t("keywordsLabel")}
        keywordsEmpty={t("keywordsEmpty")}
        placed={placedIn(keywords, suggested?.firstParagraph ?? null)}
        before={<Markup tag="p" text={current.intro} missing={t("missing.intro")} />}
        after={
          suggested ? (
            <Markup tag="p" text={suggested.firstParagraph} missing={t("missing.intro")} />
          ) : null
        }
      />
    </div>
  );
}

/**
 * Une carte de comparaison : l'existant, la flèche, la réécriture.
 *
 * Les trois éléments partagent la même boîte pour que l'œil compare toujours
 * au même endroit ; seul le contenu des deux panneaux change.
 */
function CompareCard({
  element,
  remaining,
  title,
  before,
  after,
  placed,
  arrowLabel,
  beforeLabel,
  afterLabel,
  emptyLabel,
  keywordsLabel,
  keywordsEmpty,
}: {
  element: OnPageElementKey;
  remaining: number;
  title: string;
  before: React.ReactNode;
  after: React.ReactNode | null;
  placed: string[];
  arrowLabel: string;
  beforeLabel: string;
  afterLabel: string;
  emptyLabel: string;
  keywordsLabel: string;
  keywordsEmpty: string;
}) {
  return (
    <Card>
      <CardTitle
        title={title}
        action={
          <RegenerateButton
            element={element}
            remaining={remaining}
            limit={ON_PAGE_REWRITE_QUOTA.daily}
          />
        }
      />

      {/* Trois colonnes sur large écran : avant, pivot, après. Empilé en
          dessous, la flèche bascule d'un quart de tour pour rester lisible. */}
      <div className="grid items-center gap-3 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:gap-4">
        <Panel eyebrow={beforeLabel} tone="before">
          {before}
        </Panel>

        <Pivot label={arrowLabel} />

        {after ? (
          <Panel eyebrow={afterLabel} tone="after">
            {after}
          </Panel>
        ) : (
          <p className="rounded-2xl border border-dashed border-pebble px-4 py-10 text-center text-sm text-muted">
            {emptyLabel}
          </p>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border pt-4">
        <Eyebrow>{keywordsLabel}</Eyebrow>
        {placed.length ? (
          placed.map((keyword) => (
            <Badge key={keyword} variant="neutral">
              {keyword}
            </Badge>
          ))
        ) : (
          <span className="text-sm text-muted">{keywordsEmpty}</span>
        )}
      </div>
    </Card>
  );
}

/** Libellé de section : capitales espacées, la même dans toute la page. */
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ash">
      {children}
    </span>
  );
}

/** Le panneau qui porte une version : sourd pour l'existant, net pour la proposition. */
function Panel({
  eyebrow,
  tone,
  children,
}: {
  eyebrow: string;
  tone: "before" | "after";
  children: React.ReactNode;
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
      {/* Le libellé de version porte une couleur pleine : sur trois cartes qui
          se ressemblent, c'est lui qui dit d'un coup d'œil de quel côté on lit.
          Ambre pour l'existant, vert pour la proposition — les deux états que
          le tableau de bord emploie déjà partout ailleurs. */}
      <span
        className={`inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] ring-1 ring-inset ${
          after
            ? "bg-success/10 text-success ring-success/25"
            : "bg-warning/10 text-warning ring-warning/25"
        }`}
      >
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
        {eyebrow}
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
    <>
      <div className="flex items-center gap-2">
        <SiteFavicon domain={domain} className="h-6 w-6 rounded-full" />
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
    </>
  );
}

/**
 * Le texte dans sa balise, écrite en toutes lettres.
 *
 * `<h1>` et `<p>` sont laissés visibles : ils rappellent que la phrase n'est
 * pas un slogan flottant mais un élément de la page, et le client retrouve la
 * balise telle quelle dans son éditeur au moment de coller la réécriture.
 */
function Markup({
  tag,
  text,
  missing,
}: {
  tag: "h1" | "p";
  text: string | null;
  missing: string;
}) {
  return (
    <p className={`text-[15px] leading-relaxed ${text ? "text-ink" : "text-danger"}`}>
      <span className="font-mono text-[12px] text-ash">{`<${tag}>`}</span>
      <span className="mx-1.5">{text ?? missing}</span>
      <span className="font-mono text-[12px] text-ash">{`</${tag}>`}</span>
    </p>
  );
}

/**
 * Les mots-clés de la niche qu'on retrouve dans un texte.
 *
 * La comparaison ne peut pas être une recherche de sous-chaîne : un rédacteur
 * accorde. « parfum sans alcool » s'écrit « parfums sans alcool » dans un H1,
 * « soins naturels » devient « soins d'origine naturelle » dans un paragraphe —
 * le mot-clé est bien placé, et l'égalité stricte le déclarait absent.
 *
 * On compare donc mot à mot, sur des radicaux : le mot-clé est retenu quand
 * tous ses mots porteurs se retrouvent dans le texte, quel que soit leur ordre.
 */
function placedIn(keywords: string[], text: string | null) {
  if (!text) return [];
  const haystack = stems(text);
  return keywords.filter((keyword) => {
    const wanted = stems(keyword);
    return wanted.length > 0 && wanted.every((root) => haystack.some((word) => carries(word, root)));
  });
}

/** Un mot du texte porte le radical cherché — tel quel, ou en dérivé (parfum / parfumerie). */
function carries(word: string, root: string) {
  return word === root || (root.length >= 4 && word.startsWith(root));
}

/**
 * Un radical français juste assez large pour reconnaître deux formes du même mot.
 *
 * Pas un lemmatiseur : le pluriel, le féminin et la consonne doublée finale
 * couvrent l'écart entre un mot-clé et sa reprise dans une phrase, ce qui est
 * exactement ce qu'on mesure ici.
 */
function stem(word: string) {
  let root = word;
  if (root.length > 4) root = root.replace(/aux$/, "al");
  if (root.length > 3) root = root.replace(/[sx]$/, "");
  if (root.length > 3) root = root.replace(/e$/, "");
  return root.replace(/(.)\1$/, "$1");
}

/** Articles, prépositions et liaisons : présents partout, ils ne prouvent rien. */
const STOPWORDS = new Set([
  "de",
  "du",
  "des",
  "la",
  "le",
  "les",
  "un",
  "une",
  "au",
  "aux",
  "et",
  "en",
  "pour",
  "par",
  "sur",
  "dans",
  "chez",
  "avec",
  "ou",
]);

/** Les mots d'un texte, réduits à leur radical, articles et liaisons écartés. */
function stems(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 1 && !STOPWORDS.has(word))
    .map(stem);
}
