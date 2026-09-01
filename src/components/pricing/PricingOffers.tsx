import { BoostCard } from "./BoostCard";
import { PlanCard } from "./PlanCard";

/**
 * Les deux offres, l'une sous l'autre. Une seule mise en page pour la page
 * tarifs et le bas de la home, pour que le couple se lise partout pareil.
 *
 * L'ordre suit ce qu'on a à proposer, et il n'y a qu'une surface sombre —
 * deux cartes noires ne mettent rien en avant :
 *
 *   — `trial` : l'essai de trois jours est encore à prendre. L'abonnement passe
 *     en tête, en noir, à 0 € aujourd'hui : c'est la marche la plus facile à
 *     monter, on ne paie rien pour la franchir. Le Coup de Boost suit, en clair.
 *   — sinon : le Coup de Boost reprend la tête et le noir — l'essai est passé,
 *     en cours, ou n'a jamais été proposé, et la passe unique redevient
 *     l'entrée la moins engageante. L'abonnement attend juste dessous celui
 *     qui, ayant lu la note de périmètre, veut que ça continue.
 *
 * La colonne reste étroite (`max-w-2xl`) : une carte tarifaire pleine largeur
 * étire ses lignes de texte sur trente mots et n'est plus lisible.
 */
export function PricingOffers({
  subscriptionCta,
  subscriptionCtaNote,
  analysisId,
  compact = false,
  showAgents = true,
  trial = false,
  className = "",
}: {
  /** Bouton de l'abonnement (checkout, essai ou lien), rendu par l'appelant. */
  subscriptionCta: React.ReactNode;
  subscriptionCtaNote?: string;
  /** Rapport à rattacher au Coup de Boost, s'il vient d'un rapport précis. */
  analysisId?: string;
  compact?: boolean;
  showAgents?: boolean;
  /** L'essai de trois jours est proposé : l'abonnement passe en tête, en noir. */
  trial?: boolean;
  className?: string;
}) {
  const plan = (
    <PlanCard
      key="plan"
      compact={compact}
      showAgents={showAgents}
      ctaNote={subscriptionCtaNote}
      cta={subscriptionCta}
      trial={trial}
    />
  );

  const boost = (
    <BoostCard
      key="boost"
      analysisId={analysisId}
      compact={compact}
      showAgents={showAgents}
      tone={trial ? "light" : "dark"}
    />
  );

  return (
    <div className={`mx-auto flex w-full max-w-2xl flex-col gap-10 ${className}`}>
      {trial ? [plan, boost] : [boost, plan]}
    </div>
  );
}
