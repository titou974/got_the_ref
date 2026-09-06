"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ROUTES } from "@/constants/routes";
import type { UpsellOffer } from "@/constants/access";

/**
 * Ce qu'une offre n'ouvre pas encore, et l'appel qui l'ouvre.
 *
 * Deux façons de poser la porte, et le choix se joue sur une seule question :
 * y a-t-il, dessous, quelque chose de vrai à montrer ?
 *
 * — `reveal` : oui. La carte est rendue en entier, lisible, à sa taille. Ses
 *   titres, ses intitulés, ses onglets, ses catégories restent nets ; seule la
 *   réponse est retenue — la courbe, le classement, le texte du correctif. Le
 *   client voit exactement ce qu'il achète et ne peut pas le lire. L'appel
 *   descend alors en pied de carte, une barre à part entière plutôt qu'un
 *   panneau posé au milieu de l'écran.
 *
 * — sans `reveal` : non. Ce qui passe dessous est une maquette (cf.
 *   `SectionGate`), et une maquette nette se lirait comme une donnée. Elle est
 *   donc floutée d'un bloc, sous le dégradé et l'appel centré.
 *
 * Dans les deux cas, ce qui est illisible à l'œil l'est aussi au clavier et au
 * lecteur d'écran (`inert`, `aria-hidden`) : sinon le voile ne verrouille rien.
 */
export function TierGate({
  offer,
  item,
  children,
  compact = false,
  className = "",
  logo,
  logoAlt = "",
  reveal = false,
  values,
}: {
  /** L'offre à prendre pour ouvrir : elle donne le badge du voile. */
  offer: UpsellOffer;
  /** La clé de traduction du bloc verrouillé (`dashboard.gate.items.*`). */
  item: string;
  /** Le contenu, rendu en clair sous `reveal`, flouté sinon. */
  children: React.ReactNode;
  /** Version resserrée, pour un bloc posé dans une grille. */
  compact?: boolean;
  className?: string;
  /** Logo du moteur concerné (chemin dans /public), posé net sur l'appel. */
  logo?: string;
  logoAlt?: string;
  /**
   * La carte porte de la vraie matière : on la laisse lisible et l'appel passe
   * en pied. Sans ça, le voile couvre tout le bloc.
   */
  reveal?: boolean;
  /** Valeurs injectées dans le titre et la phrase (un compte de correctifs…). */
  values?: Record<string, string | number>;
}) {
  if (reveal) {
    return (
      <section className={`space-y-3 ${className}`}>
        {children}
        <GateBar offer={offer} item={item} logo={logo} logoAlt={logoAlt} values={values} />
      </section>
    );
  }

  return (
    // Les trois couches partagent une même case de grille au lieu d'être posées
    // en absolu sur la première : le bloc prend alors la hauteur de la plus
    // haute des trois. Sur téléphone, l'appel d'une carte resserrée dépasse la
    // carte floutée qu'il recouvre, et s'y retrouvait coupé en haut comme en bas.
    //
    // L'ordre de peinture, lui, doit être écrit : `blur` fait de la couche du
    // contenu un contexte d'empilement, peint APRÈS ses frères restés en flux.
    // Sans `z-index` explicite, la carte floutée repassait donc par-dessus le
    // dégradé et par-dessus l'appel — voile invisible, texte disparu.
    <section className={`relative isolate grid overflow-hidden rounded-[28px] ${className}`}>
      <div
        aria-hidden
        inert
        className="pointer-events-none relative z-0 select-none blur-[7px] saturate-[0.7] [grid-area:1/1]"
      >
        {children}
      </div>

      {/* Le dégradé éteint le bas du bloc : le regard tombe sur l'appel, pas sur
          une donnée qu'on essaierait de deviner à travers le flou. */}
      <div
        aria-hidden
        className="pointer-events-none relative z-10 bg-gradient-to-b from-bg/40 via-bg/70 to-bg [grid-area:1/1]"
      />

      <div
        className={`relative z-20 flex flex-col items-center justify-center gap-3 px-5 text-center [grid-area:1/1] ${
          compact ? "py-6" : "py-10"
        }`}
      >
        <OfferBadge offer={offer} />
        {logo && <GateLogo logo={logo} logoAlt={logoAlt} />}
        <GateCopy item={item} values={values} align="center" size={compact ? "sm" : "md"} />
        <GateLink offer={offer} item={item} values={values} className="mt-1" />
      </div>
    </section>
  );
}

/**
 * L'appel posé en pied d'une carte restée lisible.
 *
 * Il ne recouvre rien : la carte au-dessus se lit jusqu'au bout, et la barre
 * dit ce qui manque et ce qu'il faut prendre pour l'obtenir. Le bouton nomme
 * la section plutôt que l'offre — « Voir ma visibilité », pas « Débloquer » :
 * un client clique sur ce qu'il veut voir, pas sur le nom d'un forfait. Le
 * badge, lui, garde le nom de l'offre, puisqu'il faut bien dire ce qui s'achète.
 */
function GateBar({
  offer,
  item,
  logo,
  logoAlt = "",
  values,
}: {
  offer: UpsellOffer;
  item: string;
  logo?: string;
  logoAlt?: string;
  values?: Record<string, string | number>;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-[28px] border border-fog bg-snow p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:p-6">
      <div className="flex min-w-0 items-start gap-3.5">
        {logo ? <GateLogo logo={logo} logoAlt={logoAlt} size="sm" /> : <LockSquare />}
        <div className="min-w-0">
          <OfferBadge offer={offer} />
          <GateCopy item={item} values={values} align="left" size="sm" className="mt-2" />
        </div>
      </div>

      <GateLink offer={offer} item={item} values={values} className="shrink-0 self-stretch sm:self-center" />
    </div>
  );
}

/**
 * L'appel posé **par-dessus** la zone floutée d'une carte restée lisible.
 *
 * C'est la troisième forme, et la plus juste quand une carte n'a qu'une part
 * retenue — la courbe du trafic, les bandes d'un classement. Une barre en pied
 * de carte oblige à faire le lien soi-même entre le flou du milieu et l'offre du
 * bas ; le panneau, lui, est posé exactement sur ce qui manque. On lit le titre
 * de la carte, on descend, on tombe sur le voile et sur ce qu'il faut prendre
 * pour le lever, au même endroit.
 *
 * Il se pose dans un parent `relative isolate` : c'est la carte qui décide de
 * quelle zone il couvre, elle seule sait où son flou commence.
 *
 * Deux façons de le poser, et le choix tient à une question : la zone floutée
 * est-elle plus haute que l'appel ?
 *
 *   — En absolu (par défaut) : oui. Une courbe, un classement, une grille de
 *     vignettes occupent déjà la place ; le panneau se pose dessus sans rien
 *     déplacer.
 *
 *   — `flow` : non. La zone est courte — quatre barres grises, un tiroir de
 *     correction — et un panneau posé en absolu n'y compte pour rien : le bloc
 *     garde la hauteur du flou, et l'appel en déborde, rogné en haut comme en
 *     bas par l'`overflow-hidden` de la carte. En flux, il partage la case de
 *     grille avec le flou (`[grid-area:1/1]`) et c'est le plus haut des deux qui
 *     donne sa hauteur au bloc : l'appel est bien par-dessus, jamais dedans.
 */
export function GatePanel({
  offer,
  item,
  logo,
  logoAlt = "",
  values,
  flow = false,
}: {
  offer: UpsellOffer;
  item: string;
  logo?: string;
  logoAlt?: string;
  values?: Record<string, string | number>;
  /** L'appel donne sa hauteur au bloc au lieu d'être posé en absolu dessus. */
  flow?: boolean;
}) {
  return (
    <div
      className={`z-10 flex items-center justify-center p-4 ${
        flow ? "relative h-full w-full" : "absolute inset-0"
      }`}
    >
      <div className="w-full max-w-sm rounded-3xl border border-fog bg-snow/95 p-5 text-center shadow-[var(--shadow-md)] backdrop-blur-sm">
        <div className="flex flex-col items-center gap-2.5">
          <OfferBadge offer={offer} />
          {logo && <GateLogo logo={logo} logoAlt={logoAlt} size="sm" />}
          <GateCopy item={item} values={values} align="center" size="sm" />
        </div>

        <GateLink offer={offer} item={item} values={values} className="mt-4 w-full" />
      </div>
    </div>
  );
}

/** Le nom de l'offre qui ouvre la porte, sous cadenas. */
function OfferBadge({ offer }: { offer: UpsellOffer }) {
  const t = useTranslations("dashboard.gate");

  return (
    <span className="inline-flex items-center gap-1.5 rounded-pill border border-fog bg-snow px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-obsidian shadow-[var(--shadow-md)]">
      <LockGlyph />
      {t(`offers.${offer}`)}
    </span>
  );
}

/** Ce qui manque, en un titre et une phrase. */
function GateCopy({
  item,
  values,
  align,
  size,
  className = "",
}: {
  item: string;
  values?: Record<string, string | number>;
  align: "left" | "center";
  size: "sm" | "md";
  className?: string;
}) {
  const t = useTranslations("dashboard.gate");

  return (
    <div className={`${align === "center" ? "text-center" : ""} ${className}`}>
      <h3 className={`font-bold ${size === "sm" ? "text-base" : "text-lg"}`}>
        {t(`items.${item}.title`, values)}
      </h3>
      <p
        className={`mt-1 text-pretty text-sm text-muted ${
          align === "center" ? "mx-auto max-w-md" : "max-w-xl"
        }`}
      >
        {t(`items.${item}.body`, values)}
      </p>
    </div>
  );
}

/**
 * Le bouton, nommé par la section : chaque voile promet ce qu'il cache.
 *
 * Une seule destination, quelle que soit l'offre — la page tarifs, c'est là que
 * les deux cartes se comparent.
 */
function GateLink({
  offer,
  item,
  values,
  className = "",
}: {
  offer: UpsellOffer;
  item: string;
  /** Mêmes valeurs que le titre : un bouton qui nomme un moteur les demande aussi. */
  values?: Record<string, string | number>;
  className?: string;
}) {
  const t = useTranslations("dashboard.gate");
  const label = t(`items.${item}.cta`, values);

  return (
    <Link
      href={ROUTES.pricing}
      aria-label={`${label}, avec ${t(`offers.${offer}`)}`}
      className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-full bg-cta px-5 py-2.5 text-sm font-medium text-white shadow-[var(--shadow-pill)] transition-colors duration-200 hover:bg-cta-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40 ${className}`}
    >
      {label}
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
  );
}

/** Le logo du moteur concerné, net : sous voile, celui de la carte est illisible. */
function GateLogo({
  logo,
  logoAlt,
  size = "md",
}: {
  logo: string;
  logoAlt: string;
  size?: "sm" | "md";
}) {
  const box = size === "sm" ? "h-11 w-11 p-2" : "h-12 w-12 p-2.5";

  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-2xl border border-fog bg-surface shadow-[var(--shadow-md)] ${box}`}
    >
      <Image
        src={logo}
        alt={logoAlt}
        width={32}
        height={32}
        className="h-full w-full object-contain"
      />
    </span>
  );
}

/** Le cadenas de la barre, quand aucun logo ne le remplace. */
function LockSquare() {
  return (
    <span
      aria-hidden
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-fog bg-surface text-obsidian shadow-[var(--shadow-md)]"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="2" />
        <path
          d="M8 11V8a4 4 0 0 1 8 0v3"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

function LockGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="2" />
      <path
        d="M8 11V8a4 4 0 0 1 8 0v3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
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
