"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ROUTES } from "@/constants/routes";
import type { UpsellOffer } from "@/constants/access";

/**
 * Le voile posé sur ce qu'une offre n'ouvre pas, et l'appel qui le lève.
 *
 * Le contenu réel reste dessous, flouté : le client voit la forme de ce qui
 * l'attend — un tableau de contrôles, un calendrier, une courbe — sans pouvoir
 * en lire la donnée. Un écran vide, ou un simple message « réservé aux
 * abonnés », ne dirait rien de ce qu'il achète.
 *
 * Le bloc du dessus nomme l'offre qui ouvre la porte (« Coup de Boost » ou
 * « Tout-en-un ») et mène aux tarifs — une seule destination, quelle que soit
 * l'offre : c'est là que les deux cartes se comparent.
 *
 * Le contenu flouté est retiré du focus clavier et de l'arbre d'accessibilité
 * (`inert`, `aria-hidden`) : ce qui est illisible à l'œil doit l'être aussi au
 * lecteur d'écran, sinon le voile ne verrouille rien.
 *
 * Un voile posé sur un moteur précis porte son logo, net, au-dessus du titre :
 * sous le flou, la carte ChatGPT n'est plus reconnaissable, et le client doit
 * voir de quel moteur on lui parle avant de lire l'offre qui l'ouvre.
 */
export function TierGate({
  offer,
  item,
  children,
  compact = false,
  className = "",
  logo,
  logoAlt = "",
}: {
  /** L'offre à prendre pour ouvrir : elle donne le badge et la phrase. */
  offer: UpsellOffer;
  /** La clé de traduction du bloc verrouillé (`dashboard.gate.items.*`). */
  item: string;
  /** Le vrai contenu, rendu flouté sous le voile. */
  children: React.ReactNode;
  /** Version resserrée, pour un bloc posé dans une grille. */
  compact?: boolean;
  className?: string;
  /** Logo du moteur concerné (chemin dans /public), posé net sur le voile. */
  logo?: string;
  logoAlt?: string;
}) {
  const t = useTranslations("dashboard.gate");

  return (
    // Les trois couches partagent une même case de grille au lieu d'être posées
    // en absolu sur la première : le bloc prend alors la hauteur de la plus
    // haute des trois. Sur téléphone, l'appel d'une carte resserrée — badge,
    // logo, titre, phrase et bouton — dépasse la carte floutée qu'il recouvre,
    // et s'y retrouvait coupé en haut comme en bas.
    <section className={`relative isolate grid overflow-hidden rounded-[28px] ${className}`}>
      <div
        aria-hidden
        inert
        className="pointer-events-none select-none blur-[7px] saturate-[0.7] [grid-area:1/1]"
      >
        {children}
      </div>

      {/* Le dégradé éteint le bas du bloc : le regard tombe sur l'appel, pas sur
          une donnée qu'on essaierait de deviner à travers le flou. */}
      <div
        aria-hidden
        className="pointer-events-none bg-gradient-to-b from-bg/40 via-bg/70 to-bg [grid-area:1/1]"
      />

      <div
        className={`flex flex-col items-center justify-center gap-3 px-5 text-center [grid-area:1/1] ${
          compact ? "py-6" : "py-10"
        }`}
      >
        <span className="inline-flex items-center gap-1.5 rounded-pill border border-fog bg-snow px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-obsidian shadow-[var(--shadow-md)]">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
            <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="2" />
            <path
              d="M8 11V8a4 4 0 0 1 8 0v3"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          {t(`offers.${offer}`)}
        </span>

        {logo && (
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-fog bg-snow p-2.5 shadow-[var(--shadow-md)]">
            <Image
              src={logo}
              alt={logoAlt}
              width={32}
              height={32}
              className="h-full w-full object-contain"
            />
          </span>
        )}

        <h3 className={`font-bold ${compact ? "text-base" : "text-lg"}`}>
          {t(`items.${item}.title`)}
        </h3>
        <p className="max-w-md text-pretty text-sm text-muted">{t(`items.${item}.body`)}</p>

        <Link
          href={ROUTES.pricing}
          className="mt-1 inline-flex cursor-pointer items-center gap-2 rounded-full bg-cta px-5 py-2.5 text-sm font-medium text-white shadow-[var(--shadow-pill)] transition-colors duration-200 hover:bg-cta-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40"
        >
          {t(`cta.${offer}`)}
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M5 12h14M13 6l6 6-6 6"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
      </div>
    </section>
  );
}

/**
 * La version pleine page : même voile, même appel, mais le bloc porte sa propre
 * hauteur minimale. C'est ce que rend un onglet entièrement fermé — structure,
 * articles, présence web, Google Maps — pour qu'il reste consultable et vendeur
 * plutôt que de renvoyer une erreur.
 */
export function TierGatePage({
  offer,
  item,
  children,
  logo,
  logoAlt = "",
}: {
  offer: UpsellOffer;
  item: string;
  children: React.ReactNode;
  logo?: string;
  logoAlt?: string;
}) {
  return (
    <TierGate offer={offer} item={item} className="min-h-[60vh]" logo={logo} logoAlt={logoAlt}>
      {children}
    </TierGate>
  );
}
