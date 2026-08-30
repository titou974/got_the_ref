/**
 * Ce que chaque compte a le droit de voir, et où s'arrête son accès.
 *
 * Quatre niveaux, du plus ouvert au plus fermé — et un seul vocabulaire pour
 * tout le produit : la barre latérale, les pages du tableau de bord, les
 * actions serveur et les cartes tarifaires posent la même question à la même
 * table. Sans ça, chaque écran réinventerait sa règle et un onglet finirait par
 * s'ouvrir à qui ne l'a pas payé.
 *
 *   — `free`  : le compte ouvert sans rien payer. Il voit son site mesuré, un
 *               classement (Gemini) et une correction de contenu. Le reste est
 *               flouté, pour montrer ce qui existe sans le donner.
 *   — `boost` : le « Coup de Boost », payé une fois. Ouvre les corrections de
 *               structure, tous les classements et une semaine de rédaction.
 *   — `allin` : l'abonnement « Tout-en-un ». Tout, en continu.
 *   — `demo`  : un compte de démonstration. Il voit tout comme un abonné, mais
 *               ne paie rien et n'a aucun abonnement Stripe derrière.
 *
 * Le fichier ne contient que des données : il est importé aussi bien par un
 * composant client (la barre latérale) que par le serveur.
 */

export const ACCESS_TIERS = ["free", "boost", "allin", "demo"] as const;
export type AccessTier = (typeof ACCESS_TIERS)[number];

/**
 * L'ordre des niveaux. `demo` passe devant l'abonnement : c'est un accès de
 * démonstration, il ne doit jamais buter sur une porte que l'abonné franchit.
 */
const RANK: Record<AccessTier, number> = { free: 0, boost: 1, allin: 2, demo: 3 };

/** Le niveau atteint couvre-t-il celui qu'une section exige ? */
export function tierAtLeast(tier: AccessTier, required: AccessTier): boolean {
  return RANK[tier] >= RANK[required];
}

/** Les sections du tableau de bord, dans l'ordre de la barre latérale. */
export const DASHBOARD_SECTIONS = [
  "home",
  "content",
  "architecture",
  "articles",
  "presence",
  "maps",
] as const;

export type DashboardSection = (typeof DASHBOARD_SECTIONS)[number];

/**
 * Le niveau minimal de chaque section.
 *
 * L'accueil et le contenu restent ouverts : c'est ce qu'un compte gratuit vient
 * chercher, et ce qui lui donne envie de la suite. La structure et les articles
 * s'achètent avec le Coup de Boost. Les backlinks (présence web) et la fiche
 * Google Maps demandent un travail qui court dans la durée : ils n'ont de sens
 * que sous abonnement.
 */
export const SECTION_TIER: Record<DashboardSection, AccessTier> = {
  home: "free",
  content: "free",
  architecture: "boost",
  articles: "boost",
  presence: "allin",
  maps: "allin",
};

/** La section est-elle ouverte à ce niveau ? */
export function canOpen(tier: AccessTier, section: DashboardSection): boolean {
  return tierAtLeast(tier, SECTION_TIER[section]);
}

/**
 * Les blocs de l'accueil du tableau de bord, et le niveau qu'ils demandent.
 *
 * L'accueil est la seule page ouverte à tous, donc la seule où le verrou se
 * pose bloc par bloc plutôt que sur l'onglet entier. Ce qu'un compte gratuit y
 * garde en clair est ce qui montre le produit sans le donner : son site tel
 * qu'on le voit, sa note, et surtout la niche détectée — c'est la première
 * chose qu'il vient vérifier, et celle qui prouve que la lecture a eu lieu.
 *
 * Tout le reste — corrections de structure, suivi des mentions, trafic envoyé
 * par les IA, calendrier de rédaction — passe sous un voile surmonté d'un appel
 * vers les tarifs.
 */
export const HOME_BLOCKS = [
  "profile",
  "rankings",
  "diagnostic",
  "recommendations",
  "mentions",
  "traffic",
  "agenda",
] as const;

export type HomeBlock = (typeof HOME_BLOCKS)[number];

export const HOME_BLOCK_TIER: Record<HomeBlock, AccessTier> = {
  /** Le site, la note, la niche détectée : l'aperçu gratuit. */
  profile: "free",
  /**
   * Les classements restent à l'écran en gratuit, mais seul Gemini y est
   * réellement mesuré (cf. `FREE_ENGINES`) : la carte ChatGPT reste sous voile,
   * faute d'avoir été exécutée.
   */
  rankings: "free",
  /**
   * Le constat « aperçu IA ». Il reste en clair pour tous : c'est le texte qui
   * dit au visiteur ce qu'on a vu chez lui, et un voile posé dessus ne
   * vendrait rien — il cacherait justement l'argument. En gratuit, il ne
   * raconte que ce qui est ouvert (contenu, classement Gemini) et se contente
   * d'annoncer qu'il reste à redresser ailleurs (cf. `PaidReportCard`).
   */
  diagnostic: "free",
  /**
   * Le plan d'action. Les correctifs de contenu s'affichent en clair — c'est
   * l'onglet ouvert au gratuit —, le reste passe sous voile (cf.
   * `FREE_RECOMMENDATION_CATEGORIES`).
   */
  recommendations: "boost",
  /** Les mentions dans les IA, mois après mois : une mesure qui court. */
  mentions: "allin",
  /** Les visites envoyées par les IA, relevées dans Analytics. */
  traffic: "allin",
  /** Le calendrier de rédaction. */
  agenda: "boost",
};

/** Le bloc d'accueil est-il en clair à ce niveau ? */
export function canSee(tier: AccessTier, block: HomeBlock): boolean {
  return tierAtLeast(tier, HOME_BLOCK_TIER[block]);
}

/**
 * L'offre à vendre pour ouvrir ce qui est fermé — c'est le badge posé sur
 * l'onglet grisé et le titre de l'appel : « Coup de Boost » ou « Tout-en-un ».
 */
export type UpsellOffer = "boost" | "allin";

/** L'offre qui ouvre un niveau donné. */
export function offerForTier(required: AccessTier): UpsellOffer {
  return required === "allin" ? "allin" : "boost";
}

export function offerFor(section: DashboardSection): UpsellOffer {
  return offerForTier(SECTION_TIER[section]);
}

export function offerForBlock(block: HomeBlock): UpsellOffer {
  return offerForTier(HOME_BLOCK_TIER[block]);
}

/**
 * Les moteurs réellement interrogés à ce niveau.
 *
 * Un compte gratuit n'a que Gemini : son relevé passe par le grounding Google
 * Search, qui ne coûte rien de plus que l'appel. ChatGPT, lui, consomme un
 * appel à l'outil de recherche d'OpenAI par relevé — il n'est donc pas exécuté
 * pour un compte gratuit, et sa carte reste floutée plutôt que vide. Montrer un
 * classement fabriqué serait pire que ne rien montrer.
 */
export const FREE_ENGINES = ["Gemini"] as const;

/** Vrai si ce niveau fait réellement mesurer ce moteur. */
export function runsEngine(tier: AccessTier, engine: string): boolean {
  if (tierAtLeast(tier, "boost")) return true;
  return (FREE_ENGINES as readonly string[]).includes(engine);
}

/**
 * Les réécritures de contenu accordées à un compte gratuit — une seule, une
 * fois pour toutes.
 *
 * C'est l'échantillon : le client voit un agent réécrire son titre, sa
 * description ou son introduction, et compare avant / après sur son propre
 * site. Au-delà, c'est le métier qu'on vend, pas la démonstration.
 */
export const FREE_CONTENT_REWRITES = 1;

/**
 * Les familles de correctifs laissées en clair sur un compte gratuit.
 *
 * Le plan d'action n'est pas voilé en bloc : les correctifs de contenu sont
 * lisibles, parce que c'est l'onglet ouvert et qu'un client doit pouvoir agir
 * dès le premier écran. Tout ce qui touche à l'ossature, aux données
 * structurées ou aux plateformes reste sous voile — c'est le Coup de Boost.
 *
 * Les clés suivent `CategoryKey` (cf. `src/lib/geo/types.ts`), gardées ici en
 * chaînes pour que ce module reste une donnée pure, importable des deux côtés.
 */
export const FREE_RECOMMENDATION_CATEGORIES = ["contentEEAT"] as const;

/**
 * Combien de ces correctifs s'affichent en clair. « Quelques » : de quoi
 * démontrer la valeur du plan, pas de quoi le remplacer.
 */
export const FREE_RECOMMENDATION_LIMIT = 3;

/** Ce correctif est-il lisible à ce niveau ? */
export function seesRecommendation(tier: AccessTier, category: string): boolean {
  if (tierAtLeast(tier, "boost")) return true;
  return (FREE_RECOMMENDATION_CATEGORIES as readonly string[]).includes(category);
}

/**
 * La fenêtre de rédaction ouverte par le Coup de Boost, en jours.
 *
 * L'offre est une passe, pas un abonnement : les agents écrivent pendant une
 * semaine à compter du paiement, puis s'arrêtent. La date de départ est
 * `User.boostGrantedAt`, et rien ne se renouvelle ensuite — c'est exactement la
 * frontière annoncée sur la carte tarifaire.
 */
export const BOOST_ARTICLE_WINDOW_DAYS = 7;

/**
 * Le niveau d'un compte, déduit de son offre et de son abonnement.
 *
 * L'ordre des tests n'est pas indifférent. Le compte de démonstration passe
 * devant tout : c'est une décision prise à la main, elle ne doit pas être
 * défaite par un abonnement résilié. L'abonnement actif vient ensuite, puis le
 * Coup de Boost — un client qui a pris les deux est bien un abonné, pas un
 * acheteur de passe. Tout le reste est gratuit.
 *
 * Fonction pure : le serveur la nourrit de ce qu'il a relu en base, et les
 * tests n'ont besoin d'aucune base.
 */
export function resolveTier(account: {
  plan: string | null | undefined;
  /** Vrai si l'abonnement Stripe est `active` ou `trialing`. */
  subscribed: boolean;
  boostGrantedAt?: Date | null;
}): AccessTier {
  if (account.plan === "demo") return "demo";
  if (account.subscribed || account.plan === "pro" || account.plan === "agency") return "allin";
  if (account.plan === "boost" || account.boostGrantedAt) return "boost";
  return "free";
}

/**
 * La fenêtre de rédaction ouverte par le Coup de Boost court-elle encore ?
 *
 * Elle ne concerne que le niveau `boost` : un abonné écrit toutes les semaines,
 * et un compte de démonstration n'a rien à voir avec un paiement. Sans date de
 * paiement, la fenêtre est close — on ne devine pas une date d'achat.
 */
export function boostArticlesOpenUntil(
  tier: AccessTier,
  boostGrantedAt: Date | null | undefined,
): Date | null {
  if (tier !== "boost" || !boostGrantedAt) return null;
  return new Date(boostGrantedAt.getTime() + BOOST_ARTICLE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
}
