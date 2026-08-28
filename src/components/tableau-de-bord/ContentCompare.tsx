import { getTranslations } from "next-intl/server";
import type { TrendingKeywordsInsight } from "@/lib/geo/types";
import type { OnPageRewriteQuota } from "@/features/dashboard/queries";
import { CompareCard } from "./CompareCard";
import { SiteFavicon } from "./SiteFavicon";

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
        skeleton={<SerpSkeleton domain={current.domain} url={current.url} />}
      />

      <CompareCard
        element="h1"
        remaining={quota.h1}
        title={t("h1Title")}
        placed={placedIn(keywords, suggested?.h1 ?? null)}
        before={<Markup tag="h1" text={current.h1} missing={t("missing.h1")} />}
        after={suggested ? <Markup tag="h1" text={suggested.h1} missing={t("missing.h1")} /> : null}
        skeleton={<MarkupSkeleton tag="h1" lines={1} />}
      />

      <CompareCard
        element="intro"
        remaining={quota.intro}
        title={t("introTitle")}
        placed={placedIn(keywords, suggested?.firstParagraph ?? null)}
        before={<Markup tag="p" text={current.intro} missing={t("missing.intro")} />}
        after={
          suggested ? (
            <Markup tag="p" text={suggested.firstParagraph} missing={t("missing.intro")} />
          ) : null
        }
        skeleton={<MarkupSkeleton tag="p" lines={3} />}
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
      <SerpIdentity domain={domain} url={url} />

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
 * Le site dans le résultat : favicon, domaine, URL.
 *
 * Cette ligne ne change jamais d'une réécriture à l'autre — c'est le même site.
 * Elle reste donc affichée pendant la rédaction, et seul le texte en dessous
 * passe en attente : voir le favicon disparaître laisserait croire que la carte
 * entière se recharge.
 */
function SerpIdentity({ domain, url }: { domain: string; url: string }) {
  return (
    <div className="flex items-center gap-2">
      <SiteFavicon domain={domain} className="h-6 w-6 rounded-full" />
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-medium leading-tight">{domain}</span>
        <span className="block truncate text-[11px] leading-tight text-ash">{url}</span>
      </span>
    </div>
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
      <Tag name={tag} />
      <span className="mx-1.5">{text ?? missing}</span>
      <Tag name={tag} closing />
    </p>
  );
}

/** Une balise ouvrante ou fermante, en chasse fixe. */
function Tag({ name, closing = false }: { name: "h1" | "p"; closing?: boolean }) {
  return (
    <span className="font-mono text-[12px] text-ash">{`<${closing ? "/" : ""}${name}>`}</span>
  );
}

/* ------------------------------- Chargement -------------------------------- */

/**
 * Le résultat de recherche pendant sa réécriture.
 *
 * Le site reste identifié — favicon, domaine, URL — et seules les deux lignes
 * qui changent passent en attente, aux longueurs qu'un vrai title et une vraie
 * meta description occupent. Le gabarit ne bouge donc pas quand le texte arrive.
 */
function SerpSkeleton({ domain, url }: { domain: string; url: string }) {
  return (
    <>
      <SerpIdentity domain={domain} url={url} />

      <div className="mt-3 space-y-2">
        <Bar className="h-[18px] w-[78%]" />
        <div className="space-y-1.5 pt-1.5">
          <Bar className="h-3 w-full" />
          <Bar className="h-3 w-[92%]" />
          <Bar className="h-3 w-[64%]" />
        </div>
      </div>
    </>
  );
}

/** Le H1 ou le paragraphe pendant sa réécriture : les balises tiennent, le texte attend. */
function MarkupSkeleton({ tag, lines }: { tag: "h1" | "p"; lines: number }) {
  // La dernière ligne s'arrête court, comme une phrase qui finit : trois barres
  // de largeur égale se liraient comme un bloc, pas comme du texte.
  const widths = ["w-full", "w-[96%]", "w-[71%]"];

  return (
    <div className="text-[15px] leading-relaxed">
      <Tag name={tag} />
      <div className="my-1.5 space-y-2">
        {Array.from({ length: lines }, (_, index) => (
          <Bar key={index} className={`h-[15px] ${widths[index % widths.length]}`} />
        ))}
      </div>
      <Tag name={tag} closing />
    </div>
  );
}

/** Une ligne de texte en attente : le shimmer du thème, arrondi comme une ligne. */
function Bar({ className }: { className: string }) {
  return <span className={`block rounded-md shimmer ${className}`} />;
}

/* ------------------------------- Mots-clés --------------------------------- */

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
