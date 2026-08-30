import type { ReactNode } from "react";
import { BoostCard } from "./BoostCard";
import { PlanCard } from "./PlanCard";

/**
 * Les deux offres, l'une sous l'autre : la passe unique d'abord, l'abonnement
 * ensuite. Une seule mise en page pour la page tarifs et le bas de la home,
 * pour que le couple se lise partout pareil.
 *
 * Elles étaient côte à côte, et l'abonnement tenait la colonne la plus large et
 * la seule surface sombre. Deux offres en vis-à-vis se comparent ; empilées,
 * elles se lisent dans l'ordre — c'est ce qu'on veut. Le Coup de Boost est la
 * marche d'entrée : on la propose en premier, en noir, et l'abonnement attend
 * juste dessous celui qui, ayant lu la note de périmètre, veut que ça continue.
 *
 * La colonne reste étroite (`max-w-2xl`) : une carte tarifaire pleine largeur
 * étire ses lignes de texte sur trente mots et n'est plus lisible.
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
    <div className={`mx-auto flex w-full max-w-2xl flex-col gap-10 ${className}`}>
      <BoostCard analysisId={analysisId} compact={compact} showAgents={showAgents} />
      <PlanCard
        compact={compact}
        showAgents={showAgents}
        ctaNote={subscriptionCtaNote}
        cta={subscriptionCta}
      />
    </div>
  );
}
