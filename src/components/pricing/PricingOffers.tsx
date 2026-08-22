import type { ReactNode } from "react";
import { BoostCard } from "./BoostCard";
import { PlanCard } from "./PlanCard";

/**
 * Les deux offres, côte à côte : l'abonnement qui ne s'arrête jamais, et la
 * passe unique. Une seule mise en page pour la page tarifs et le bas de la home,
 * pour que le couple se lise partout pareil.
 *
 * L'abonnement prend la colonne la plus large et garde la seule surface sombre
 * du site : c'est lui qu'on recommande. En dessous de `lg`, les deux cartes
 * s'empilent — abonnement d'abord, Coup de Boost ensuite.
 *
 * Les cartes s'alignent par le haut (`items-start`) : le Coup de Boost est plus
 * court, l'étirer pour égaliser les hauteurs ne remplirait que du vide.
 */
export function PricingOffers({
  subscriptionCta,
  analysisId,
  compact = false,
  showAgents = true,
  subscriptionCtaNote,
  className = "",
}: {
  /** Bouton d'action de l'abonnement, rendu par la page (checkout ou lien). */
  subscriptionCta: ReactNode;
  /** Rapport à l'origine de la visite : rattaché à l'achat, quelle que soit l'offre. */
  analysisId?: string;
  compact?: boolean;
  showAgents?: boolean;
  subscriptionCtaNote?: string;
  className?: string;
}) {
  return (
    <div
      className={`grid items-start gap-6 lg:grid-cols-[1.06fr_0.94fr] lg:gap-7 ${className}`}
    >
      <PlanCard
        compact={compact}
        showAgents={showAgents}
        ctaNote={subscriptionCtaNote}
        cta={subscriptionCta}
      />
      <BoostCard analysisId={analysisId} compact={compact} />
    </div>
  );
}
