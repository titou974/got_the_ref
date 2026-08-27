"use client";

import { useTranslations } from "next-intl";

/**
 * Le mode d'emploi de la clé, posé juste au-dessus du champ qui la réclame.
 *
 * Un client ouvre cet écran avec une seule question en tête : « où est-ce que
 * je vais chercher ça ? ». Une ligne d'aide sous le champ ne suffit pas — il
 * faut sortir du produit, traverser un back-office qu'il connaît mal, et
 * revenir avec une chaîne de caractères qu'il n'a jamais vue. Le guide se met
 * donc sur son chemin, avant le champ vide, pas après.
 *
 * Deux partis pris.
 *
 * Le chemin d'administration est rendu tel qu'il s'affiche chez lui, en fil
 * d'Ariane (« Utilisateurs › Profil › … ») : c'est le vocabulaire de son écran,
 * pas une paraphrase, et il le reconnaît sans le lire.
 *
 * La forme de la clé est montrée en clair. C'est ce qui évite les deux
 * confusions qui reviennent tout le temps : coller le mot de passe de connexion
 * au lieu du mot de passe d'application, et retirer les espaces d'une clé qui
 * les contient. Voir la chaîne avant de la chercher vaut mieux que la décrire.
 *
 * Ouvert par défaut, refermable : un client qui rattache un deuxième site n'a
 * pas à refaire défiler le mode d'emploi.
 */

/** Les plateformes dont on sait décrire le parcours pas à pas. */
const GUIDED = ["wordpress", "woocommerce", "shopify"] as const;

type Guided = (typeof GUIDED)[number];

const guideKey = (platform: string): Guided | null =>
  platform === "woocommerce"
    ? "wordpress"
    : GUIDED.includes(platform as Guided)
      ? (platform as Guided)
      : null;

export function CredentialGuide({ platform }: { platform: string }) {
  const t = useTranslations("dashboard.connect.guide");
  const key = guideKey(platform);
  if (!key) return null;

  const steps = [1, 2, 3, 4].map((index) => t(`${key}.step${index}`));

  return (
    <details
      open
      className="group rounded-2xl border border-border bg-mist/60 [&_summary::-webkit-details-marker]:hidden"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-obsidian">
        <span className="text-sm font-medium text-ink">{t(`${key}.label`)}</span>
        <svg
          aria-hidden
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          className="shrink-0 text-steel transition-transform duration-200 group-open:rotate-180"
        >
          <path
            d="m6 9 6 6 6-6"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </summary>

      <div className="space-y-4 px-4 pb-4">
        {/* Le fil d'Ariane du back-office, dans ses mots à lui. */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ash">
            {t("pathLabel")}
          </p>
          <p className="mt-1.5 text-sm font-medium text-graphite">{t(`${key}.path`)}</p>
        </div>

        <ol className="space-y-2.5">
          {steps.map((step, index) => (
            <li key={step} className="flex gap-3">
              <span
                aria-hidden
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface text-[11px] font-semibold tabular-nums text-steel ring-1 ring-border"
              >
                {index + 1}
              </span>
              <span className="text-sm leading-6 text-graphite">{step}</span>
            </li>
          ))}
        </ol>

        {/* La clé telle qu'elle apparaîtra, pour la reconnaître à l'écran. */}
        <div className="rounded-xl border border-border bg-surface p-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ash">
            {t(`${key}.shapeLabel`)}
          </p>
          <p className="mt-2 overflow-x-auto whitespace-nowrap font-mono text-sm text-ink">
            {t(`${key}.shape`)}
          </p>
          <p className="mt-2 text-xs leading-5 text-muted">{t(`${key}.shapeNote`)}</p>
        </div>

        <p className="text-xs leading-5 text-muted">{t(`${key}.safety`)}</p>
        <p className="text-xs leading-5 text-muted">{t(`${key}.missing`)}</p>
      </div>
    </details>
  );
}
