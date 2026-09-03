import { BoostCard } from "./BoostCard";
import { PlanCard } from "./PlanCard";

/**
 * Les deux offres, côte à côte sur un écran d'ordinateur, l'une sous l'autre
 * sur un téléphone. Une seule mise en page partout, pour que le couple se lise
 * pareil d'une page à l'autre.
 *
 * Elles étaient empilées partout. Une offre lue après avoir fait défiler
 * l'autre n'est pas comparée, elle est jugée seule : le visiteur descendait,
 * perdait le premier prix de vue, et remontait pour vérifier. Deux colonnes
 * remettent les deux montants dans le même coup d'œil — c'est le geste que la
 * page demande.
 *
 * L'ordre du document ne change pas : l'offre mise en avant reste la première,
 * donc à gauche sur ordinateur et en haut sur téléphone.
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
 * La largeur reste bornée (`max-w-5xl`) : au-delà, chaque colonne étire ses
 * lignes de texte sur trente mots et n'est plus lisible. Sur un écran étroit,
 * la grille retombe sur une seule colonne, et l'espacement vertical reprend
 * celui qu'avait la pile.
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
    <div
      className={`mx-auto grid w-full max-w-2xl grid-cols-1 items-stretch gap-10 lg:max-w-5xl lg:grid-cols-2 lg:gap-8 ${className}`}
    >
      {trial ? [plan, boost] : [boost, plan]}
    </div>
  );
}
