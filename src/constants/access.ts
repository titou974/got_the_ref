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
 * Le calendrier de rédaction reste lui aussi en clair : un compte gratuit
 * reçoit les premiers sujets de la semaine, datés, et voit donc l'atelier
 * tourner avant d'avoir payé. Ce qu'il ne peut pas faire, c'est publier —
 * le bouton mène alors aux tarifs.
 *
 * Tout le reste — corrections de structure, trafic envoyé par les IA — passe
 * sous un voile surmonté d'un appel vers les tarifs.
 */
export const HOME_BLOCKS = [
  "profile",
  "rankings",
  "diagnostic",
  "recommendations",
  "traffic",
  "agenda",
] as const;

export type HomeBlock = (typeof HOME_BLOCKS)[number];

export const HOME_BLOCK_TIER: Record<HomeBlock, AccessTier> = {
  /** Le site, la note, la niche détectée : l'aperçu gratuit. */
  profile: "free",
  /**
   * Les classements restent à l'écran en gratuit, mais seul Gemini y est
   * réellement mesuré (cf. `FREE_ENGINES`) : les cartes ChatGPT, Perplexity et
   * Claude restent sous voile, faute d'avoir été exécutées.
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
  /**
   * Les visites envoyées par les IA, relevées dans Analytics. Ouvertes dès le
   * Coup de Boost : c'est la preuve que la passe a servi à quelque chose, et la
   * cacher à qui vient de la payer revenait à lui vendre des correctifs sans
   * jamais lui en montrer l'effet.
   */
  traffic: "boost",
  /**
   * Le calendrier de rédaction, ouvert à tous les niveaux.
   *
   * C'est la seule pièce du produit qui se montre bien mieux qu'elle ne se
   * raconte : des sujets datés, écrits pour la niche du client, posés sur les
   * jours qui viennent. Un compte gratuit en reçoit quinze
   * (`FREE_ARTICLE_TOPICS`), répartis sur tout le mois ; la rédaction et la
   * publication, elles, restent derrière l'onglet Articles, qui s'achète.
   */
  agenda: "free",
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

/**
 * L'offre mise en avant sur un onglet fermé, badge de la barre latérale compris.
 *
 * Elle suit le niveau exigé par la section, à une exception écrite ici : les
 * articles. `SECTION_TIER.articles` reste au Coup de Boost — la passe donne
 * bien dix articles sur une semaine (cf. `plans.ts`, `BOOST_ARTICLE_WINDOW_DAYS`)
 * et un client qui l'a payée garde son onglet ouvert. Mais à qui n'a encore
 * rien pris, c'est l'abonnement qu'on montre : la rédaction n'a de valeur que
 * répétée, et vendre une semaine à quelqu'un qui découvre le calendrier du mois
 * lui promet moins que ce qu'il a sous les yeux.
 *
 * L'écart ne touche donc que la vitrine — le badge et le texte du voile. La
 * porte, elle, reste ouverte par `canOpen`, sur `SECTION_TIER`.
 */
const SECTION_UPSELL: Partial<Record<DashboardSection, UpsellOffer>> = {
  articles: "allin",
};

export function offerFor(section: DashboardSection): UpsellOffer {
  return SECTION_UPSELL[section] ?? offerForTier(SECTION_TIER[section]);
}

export function offerForBlock(block: HomeBlock): UpsellOffer {
  return offerForTier(HOME_BLOCK_TIER[block]);
}

/**
 * Les moteurs réellement interrogés à ce niveau.
 *
 * Un compte gratuit n'a que Gemini : son relevé passe par le grounding Google
 * Search, qui ne coûte rien de plus que l'appel. Les trois autres se paient à
 * chaque relevé — la recherche web d'OpenAI, l'appel Perplexity, l'outil
 * `web_search` de Claude — et ils partent deux fois par passage, une fois sur
 * la niche et une fois sur la catégorie. Ils ne sont donc pas exécutés pour un
 * compte gratuit, et leurs cartes restent floutées plutôt que vides : montrer
 * un classement fabriqué serait pire que ne rien montrer.
 *
 * Le Coup de Boost les ouvre tous les quatre (cf. `runsEngine`).
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

/**
 * Combien de correctifs fermés se montrent, floutés, sous la barre d'appel.
 *
 * Deux. La liste entière — quinze cartes grises à faire défiler — repoussait
 * l'offre hors de l'écran et n'apprenait rien de plus : une carte floutée dit la
 * même chose que la quinzième. Deux suffisent à montrer la forme, et le compte
 * réel de ce qui reste est écrit sur la barre juste en dessous.
 */
export const VEILED_RECOMMENDATION_PREVIEW = 2;

/**
 * La fourchette dans laquelle s'annonce le nombre de corrections restantes.
 *
 * En dessous de dix, la passe ne vaut pas son prix ; au-dessus de vingt, le
 * client lit une condamnation plutôt qu'un plan de travail. Le compte affiché
 * reste celui du site (contrôles ratés et correctifs fermés), simplement ramené
 * entre ces deux bornes.
 */
export const PENDING_FIXES_RANGE: readonly [number, number] = [10, 20];

/** Ce correctif est-il lisible à ce niveau ? */
export function seesRecommendation(tier: AccessTier, category: string): boolean {
  if (tierAtLeast(tier, "boost")) return true;
  return (FREE_RECOMMENDATION_CATEGORIES as readonly string[]).includes(category);
}

/**
 * Le relevé de la fiche Google Maps, ouvert au compte gratuit — une fois.
 *
 * La fiche est le seul objet du produit que le client reconnaît immédiatement :
 * sa photo, sa note, ses avis, tels que Google les montre. La lui cacher
 * derrière un voile revenait à vendre un travail sur une fiche qu'on ne lui
 * avait jamais prouvé savoir lire. Le relevé part donc dès qu'il colle son
 * lien, et l'écran se remplit de sa propre fiche.
 *
 * Une fois, et pas deux : chaque relevé est un run Apify facturé. Le compte
 * gratuit obtient son premier passage, jamais l'actualisation — c'est elle qui
 * se paie, puisque c'est elle qui se répète semaine après semaine.
 *
 * Ce qui reste fermé, c'est tout ce qui s'écrit : les textes de la fiche, les
 * réponses aux avis, les posts. Aucun appel au modèle ne part pour un compte
 * gratuit sur cette page — les corrections y sont annoncées et voilées, pas
 * rédigées (cf. `MapsVeil`).
 */
export const FREE_MAPS_FETCHES = 1;

/**
 * Le relevé de la fiche peut-il partir ?
 *
 * `alreadyFetched` est la seule mémoire nécessaire : une ligne `MapsPlace`
 * existe, donc le passage gratuit a eu lieu.
 */
export function canFetchPlace(tier: AccessTier, alreadyFetched: boolean): boolean {
  if (tierAtLeast(tier, SECTION_TIER.maps)) return true;
  return !alreadyFetched;
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
 * Combien de sujets d'articles sont planifiés à la mise en route, par niveau.
 *
 * Un compte gratuit en reçoit quinze, étalés sur le mois entier plutôt que
 * groupés sur la semaine qui vient. Un calendrier qui s'arrête au vendredi
 * suivant se lit comme un essai qui expire ; quinze sujets tenus de bout en
 * bout montrent le rythme qu'on lui vend, et les sept jours ouvrés laissés
 * vides sont précisément ceux que le Coup de Boost vient combler — la grille
 * est visiblement incomplète, c'est ce qu'on veut qu'il voie.
 *
 * Le coût ne bouge pas : c'est une seule demande au modèle, la même qu'il en
 * rende quatre, quinze ou vingt-deux, et aucun de ces sujets n'est rédigé — la
 * rédaction est le travail vendu, et le bouton de publication mène aux tarifs.
 *
 * Dès le Coup de Boost, le mois entier est posé — vingt-deux sujets, un par jour
 * ouvré — et la première semaine est rédigée dans la foulée. C'est ce complément
 * qui part au moment de l'achat, sans que le client ait à redemander quoi que ce
 * soit.
 */
export const FREE_ARTICLE_TOPICS = 15;

/**
 * Le mois éditorial complet, posé dès le Coup de Boost.
 *
 * Vingt-deux, c'est le nombre de jours ouvrés d'un mois : la grille se remplit
 * du lundi au vendredi, sans trou au milieu de la semaine. Un calendrier à
 * trois publications hebdomadaires laissait le mardi et le jeudi vides, et une
 * grille à moitié blanche se lit comme un planning qu'on n'a pas fini d'écrire.
 */
export const PAID_ARTICLE_TOPICS = 22;

/** Combien de sujets ce niveau fait planifier à la mise en route. */
export function articleTopicsFor(tier: AccessTier): number {
  return tierAtLeast(tier, "boost") ? PAID_ARTICLE_TOPICS : FREE_ARTICLE_TOPICS;
}

/**
 * Les sujets planifiés sont-ils rédigés dans la foulée ?
 *
 * Non en gratuit : la rédaction est le travail vendu, et écrire trois articles
 * que le client ne pourra ni lire en entier ni publier reviendrait à payer trois
 * appels au grand modèle pour un onglet resté sous voile.
 */
export function draftsSeedArticles(tier: AccessTier): boolean {
  return tierAtLeast(tier, "boost");
}

/**
 * Une semaine de publication : cinq jours ouvrés, cinq articles.
 *
 * C'est ce que le Coup de Boost fait rédiger, et rien de plus. L'offre est une
 * passe : elle pose le mois entier au calendrier — le client voit ce que son
 * site publierait sur la durée — mais n'écrit que la première semaine. Les
 * sujets suivants restent des titres, avec l'abonnement en face.
 */
export const BOOST_DRAFTED_ARTICLES = 5;

/**
 * Combien d'articles du planning cette offre fait rédiger, en partant du
 * premier. `null` : aucune borne, tout ce qui entre dans la fenêtre s'écrit.
 *
 * Le Coup de Boost s'arrête à sa semaine. L'abonnement n'a pas de borne de ce
 * genre — ce qui limite sa file est une date, la fin de la semaine suivante (cf.
 * `draftHorizon`), et elle avance avec le client.
 */
export function draftableArticles(tier: AccessTier): number | null {
  if (!tierAtLeast(tier, "boost")) return 0;
  return tier === "boost" ? BOOST_DRAFTED_ARTICLES : null;
}

/**
 * L'analyse enregistrée a-t-elle été faite à un niveau plus étroit que celui du
 * compte aujourd'hui ?
 *
 * C'est la question posée après un achat. L'analyse d'un compte gratuit est
 * volontairement partielle : un seul moteur interrogé, aucun relevé hors-site.
 * Le jour où ce compte prend le Coup de Boost ou l'abonnement, ces appels-là
 * doivent partir — sinon le client paie pour des cartes qui restent vides. On
 * compare donc le niveau inscrit dans l'analyse à celui du compte, et l'accueil
 * relance la préparation derrière son écran d'attente habituel.
 *
 * Une analyse sans niveau inscrit est une analyse d'avant cette règle : on la
 * lit comme gratuite, ce qui la fait rejouer une fois pour un compte payant et
 * la laisse tranquille pour un compte gratuit.
 */
export function analysisNeedsUpgrade(
  storedTier: AccessTier | null | undefined,
  tier: AccessTier,
): boolean {
  return RANK[tier] > RANK[storedTier ?? "free"];
}

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
