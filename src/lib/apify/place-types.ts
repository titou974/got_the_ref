/**
 * La fiche Google Maps, telle qu'on la garde et telle qu'on la réaffiche.
 *
 * Ce fichier ne contient que des types : il est importé par les composants
 * client comme par le serveur, et ne doit donc jamais tirer de code serveur
 * derrière lui.
 *
 * Le vocabulaire suit Google, pas Apify : `rating` et non `totalScore`,
 * `images` et non `imageUrls`. Le scraper est un fournisseur, pas un contrat —
 * s'il change de nom de champ, seul le normaliseur bouge.
 */

/** Une journée d'ouverture. `closed` évite de comparer des chaînes à l'affichage. */
export type PlaceHours = {
  /** Le nom du jour dans la langue de la fiche : « lundi », « mardi »… */
  day: string;
  /** Les créneaux, tirets demi-cadratin : « 10:30–15:00, 18:00–23:30 ». */
  hours: string;
  closed: boolean;
};

/** Un groupe d'attributs de la fiche : « Accessibilité », « Paiements »… */
export type PlaceAttributeGroup = {
  label: string;
  items: { label: string; available: boolean }[];
};

export type PlaceReview = {
  id: string;
  name: string;
  photo: string | null;
  localGuide: boolean;
  /** Nombre d'avis déposés par cette personne, quand Google l'affiche. */
  reviewerCount: number | null;
  stars: number;
  text: string | null;
  /** Date ISO, pour trier et formater nous-mêmes. */
  publishedAt: string | null;
  /** La formule relative de Google : « il y a 2 mois ». */
  relative: string | null;
  likes: number;
  images: string[];
  ownerResponse: string | null;
  ownerResponseAt: string | null;
  /** Le contexte que Google accroche à l'avis : type de repas, prix par personne… */
  context: { label: string; value: string }[];
};

export type PlaceReviewsDistribution = {
  one: number;
  two: number;
  three: number;
  four: number;
  five: number;
};

/** Un établissement que Google propose à côté du vôtre. */
export type PlaceSimilar = {
  title: string;
  category: string | null;
  rating: number | null;
  reviewsCount: number | null;
};

/** L'affluence d'une journée, heure par heure (0-100 %). */
export type PlacePopularDay = {
  day: string;
  hours: { hour: number; percent: number }[];
};

/** Un post publié par le commerce sur sa fiche. */
export type PlaceUpdate = {
  text: string;
  date: string | null;
  images: string[];
};

export type GooglePlace = {
  title: string;
  subtitle: string | null;
  /** Le résumé rédigé par Google à partir des avis. */
  description: string | null;
  /** La présentation écrite par le commerce lui-même. */
  ownerDescription: string | null;

  category: string | null;
  categories: string[];
  /** La fourchette affichée par Google : « 40–90 € ». */
  price: string | null;

  address: string | null;
  street: string | null;
  city: string | null;
  postalCode: string | null;
  countryCode: string | null;
  plusCode: string | null;
  location: { lat: number; lng: number } | null;

  website: string | null;
  phone: string | null;
  menuUrl: string | null;
  reserveUrl: string | null;
  orderUrl: string | null;

  /** L'adresse de la fiche sur Google Maps, celle qu'on rouvre d'un clic. */
  mapsUrl: string | null;
  placeId: string | null;
  cid: string | null;

  rating: number | null;
  reviewsCount: number | null;
  reviewsDistribution: PlaceReviewsDistribution | null;
  /** Les mots qui reviennent dans les avis, avec leur fréquence. */
  reviewsTags: { title: string; count: number }[];

  images: string[];
  imagesCount: number | null;

  openingHours: PlaceHours[];
  popularTimes: PlacePopularDay[];
  popularNow: { text: string; percent: number } | null;

  attributes: PlaceAttributeGroup[];
  reviews: PlaceReview[];
  similar: PlaceSimilar[];
  updates: PlaceUpdate[];

  permanentlyClosed: boolean;
  temporarilyClosed: boolean;
  /** Faux quand Google propose encore « Vous êtes le propriétaire ? ». */
  claimed: boolean;

  /** Horodatage ISO du relevé : la fiche affichée est une photo, pas un direct. */
  scrapedAt: string;
};

/**
 * Ce qu'il faut changer sur la fiche : les trois textes et les attributs.
 *
 * Une seule pièce, relue d'un bloc. Les trois textes partagent le même mot-clé
 * porteur — celui du titre du site, sur la page Contenu — parce qu'une fiche et
 * un site qui visent deux expressions différentes se font concurrence dans les
 * mêmes résultats.
 */
export type MapsAdvice = {
  /** Le mot-clé sur lequel la fiche et le site s'alignent. */
  keyword: string | null;
  /** Le nom d'établissement proposé, mot-clé compris. */
  title: string;
  /** La description courte, celle que Google montre en tête de fiche. */
  description: string;
  /** La présentation longue de l'onglet « À propos ». */
  about: string;
  /** Ce que chaque réécriture change, dans l'ordre titre, description, à propos. */
  reasons: string[];
  /** Les attributs à cocher, groupe par groupe. */
  attributes: MapsAttributeAdvice[];
  generatedAt: string;
};

/** Un groupe d'attributs : ce qui est coché, ce qui manque, ce qu'on conseille. */
export type MapsAttributeAdvice = {
  group: string;
  /** Déjà coché sur la fiche. */
  present: string[];
  /**
   * Absent de la fiche et recommandé pour ce commerce. Le modèle ne coche que
   * ce que les avis, la présentation ou le site rendent plausible : proposer
   * « Livraison » à un restaurant qui n'en fait pas ferait mentir la fiche.
   */
  suggested: { label: string; why: string }[];
  /** Absent, et sans rapport avec ce commerce : listé pour ne pas y revenir. */
  skipped: string[];
};

/** Les horaires lus sur la page d'accueil du site, et leur écart avec la fiche. */
export type SiteHoursCheck = {
  /** Vrai quand la page d'accueil affiche des horaires. */
  found: boolean;
  /** Où ils ont été lus : « pied de page », « bloc contact »… */
  location: string | null;
  /** Les horaires du site, un par jour, dans les mots du site. */
  days: { day: string; hours: string }[];
  /** Les jours où le site et la fiche ne disent pas la même chose. */
  conflicts: { day: string; site: string; listing: string }[];
  /** Ce que Google en fait, en une phrase. */
  summary: string;
  checkedAt: string;
};
