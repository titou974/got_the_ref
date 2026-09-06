import { getTranslations } from "next-intl/server";
import { BoostCheckoutButton } from "@/components/BoostCheckoutButton";
import { AgentRoster } from "./AgentRoster";
import { BOOST } from "@/constants/plans";

/** Montant formaté à la française, sans décimales (49 €). */
const euros = (amount: number) => `${amount.toLocaleString("fr-FR")} €`;

function Check({ dark }: { dark: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={`mt-0.5 shrink-0 ${dark ? "text-white" : "text-obsidian"}`}
    >
      <path
        d="M5 13l4 4L19 7"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Le « Coup de Boost », et désormais la seule surface sombre du site : c'est
 * l'offre qu'on met en avant.
 *
 * Le renversement est délibéré. L'abonnement demandait au visiteur de s'engager
 * avant d'avoir rien vu ; la passe unique lui demande un prix d'entrée, une
 * fois, pour un travail dont il constate le résultat. C'est la marche la plus
 * facile à monter, donc celle qu'on éclaire — l'abonnement se lit juste en
 * dessous, pour qui veut que ça continue.
 *
 * La carte le dit deux fois plutôt qu'une : le rythme annoncé au-dessus (« payé
 * une seule fois ») et le montant suivi de « une fois ». Et la frontière avec
 * l'abonnement est écrite en toutes lettres en bas : ce qui manque ici — la
 * remesure et les publications dans la durée — est exactement ce qu'on vend
 * juste en dessous.
 */
export async function BoostCard({
  analysisId,
  compact = false,
  showAgents = true,
  tone = "dark",
  className = "",
}: {
  /** Rapport à l'origine de l'achat, s'il y en a un : il est débloqué au retour. */
  analysisId?: string;
  /** Version resserrée, pour le bas de la home. */
  compact?: boolean;
  showAgents?: boolean;
  /**
   * La surface sombre appartient à l'offre qu'on met en avant, et il n'y en a
   * qu'une : `light` la rend à l'abonnement quand celui-ci ouvre un essai et
   * passe en tête (cf. `PricingOffers`).
   */
  tone?: "dark" | "light";
  className?: string;
}) {
  const t = await getTranslations("pricing");
  const dark = tone === "dark";

  // En bas de home, la carte perd son roster d'agents : la liste complète
  // pousserait l'abonnement, juste dessous, hors du premier écran. On y garde
  // les trois lignes qui font l'offre — la page tarifs, elle, les donne toutes.
  const features = compact
    ? [
        t("boost.features.analysis"),
        t("boost.features.fix"),
        t("boost.features.articles", { count: BOOST.articles }),
      ]
    : [
        t("boost.features.analysis"),
        t("boost.features.measure"),
        t("boost.features.fix"),
        t("boost.features.articles", { count: BOOST.articles }),
        t("boost.features.traffic"),
        t("boost.features.report"),
      ];

  return (
    <div className={`flex h-full flex-col ${className}`}>
      {/* Le pendant des onglets de facturation de l'abonnement : même pilule,
          même hauteur, mais rien à choisir — l'offre n'a qu'un rythme. */}
      <div className="flex justify-center">
        <div className="inline-flex items-center rounded-full border border-fog bg-snow p-1 shadow-[var(--shadow-md)]">
          <span className="rounded-full px-5 py-2 text-sm font-medium text-muted">
            {t("boost.rhythm")}
          </span>
        </div>
      </div>

      <div className="relative mt-5 flex flex-1">
        {/* L'étiquette « le plus choisi », posée sur le bord de la carte.
            Centrée sur mobile, où la carte est trop étroite pour la loger dans
            un coin. */}
        <div className="absolute -top-3 left-1/2 z-10 w-max -translate-x-1/2 sm:left-auto sm:right-8 sm:translate-x-0">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-fog bg-snow px-3.5 py-1.5 text-[11px] font-semibold text-text shadow-[var(--shadow-md)] sm:text-xs">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12l1-8.5Z"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinejoin="round"
              />
            </svg>
            {t("boost.badge")}
          </span>
        </div>

        <section
          className={`flex w-full flex-col rounded-[36px] shadow-[var(--shadow-md)] ${
            dark ? "bg-obsidian text-white" : "border border-pebble bg-snow"
          } ${compact ? "p-6 pt-7 sm:p-7 sm:pt-8" : "p-6 pt-8 sm:p-9 sm:pt-10"}`}
        >
          <p
            className={`text-xs font-semibold uppercase tracking-wider ${
              dark ? "text-white/50" : "text-steel"
            }`}
          >
            {t("boost.eyebrow")}
          </p>
          <h2 className="mt-2 text-2xl font-bold">{t("boost.name")}</h2>
          <p
            className={`mt-2 max-w-md text-sm leading-relaxed ${
              dark ? "text-white/60" : "text-muted"
            }`}
          >
            {t("boost.tagline")}
          </p>

          <div
            className={`flex flex-wrap items-baseline gap-x-3 gap-y-1 ${compact ? "mt-4" : "mt-6"}`}
          >
            <span
              className={`font-display font-bold tabular-nums tracking-tight ${
                compact ? "text-4xl sm:text-5xl" : "text-5xl sm:text-6xl"
              }`}
            >
              {euros(BOOST.price)}
            </span>
            <span className={`text-base ${dark ? "text-white/50" : "text-muted"}`}>
              {t("boost.onceLabel")}
            </span>
          </div>

          {/* Même réserve de hauteur que la note de l'abonnement, en dessous :
              les deux cartes gardent ainsi la même respiration sous le prix. */}
          <p
            className={`min-h-[3.75rem] max-w-sm text-xs leading-relaxed ${
              dark ? "text-white/30" : "text-steel"
            } ${compact ? "mt-3" : "mt-4"}`}
          >
            {t("boost.terms")}
          </p>

          <div className={compact ? "mt-5" : "mt-7"}>
            <BoostCheckoutButton
              label={t("boost.cta")}
              analysisId={analysisId}
              tone={dark ? "light" : "dark"}
            />
            <p className={`mt-2.5 text-center text-xs ${dark ? "text-white/50" : "text-muted"}`}>
              {t("boost.ctaNote")}
            </p>
          </div>

          <ul className={`space-y-2.5 ${compact ? "mt-6" : "mt-7"}`}>
            {features.map((f) => (
              <li
                key={f}
                className={`flex items-start gap-2.5 text-sm ${dark ? "text-white/85" : "text-ink"}`}
              >
                <Check dark={dark} />
                <span>{f}</span>
              </li>
            ))}
          </ul>

          {/* Le pied de carte, poussé en bas : l'espace en trop se pose là,
              jamais entre deux lignes de la liste.

              La note de périmètre y reste dans tous les cas — c'est elle qui
              dit ce que cette offre ne fait pas, et l'abonnement juste en
              dessous n'a d'autre raison d'être que cette phrase. */}
          <div className="mt-7 flex flex-1 flex-col justify-end gap-3">
            {showAgents && dark && <AgentRoster />}
            <p
              className={`rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                dark ? "bg-white/5 text-white/45" : "bg-mist text-steel"
              }`}
            >
              {t("boost.limit")}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
