/**
 * Le catalogue des attributs que Google propose sur une fiche d'établissement.
 *
 * Google range ces cases par groupe — « Paiements », « Accessibilité »,
 * « Ambiance » — et n'en montre au public que celles qui sont cochées. Une case
 * vide n'est donc pas visible sur la fiche : elle est simplement absente, et le
 * commerçant ne sait pas qu'il l'a laissée derrière lui. C'est ce que ce
 * catalogue sert à retrouver.
 *
 * Les libellés sont ceux de l'interface française de Google Business Profile,
 * au mot près : le client doit pouvoir chercher la case dans son back-office
 * avec le texte qu'il lit ici. Les traduire ou les abréger lui ferait perdre
 * dix minutes par ligne.
 *
 * Le catalogue est indexé par famille de commerce, parce que « Grand choix de
 * vins » n'a rien à faire chez un plombier. La famille est devinée de la
 * catégorie Google de la fiche (`categoryName`), qui est en français elle aussi.
 */

/** Les familles de commerce que le catalogue distingue. */
export type BusinessFamily = "restaurant" | "shop" | "service";

export type AttributeCatalog = {
  /** Le nom du groupe, tel que Google l'écrit sur la fiche. */
  group: string;
  items: string[];
}[];

/**
 * Restauration : le catalogue le plus fourni, et celui où les cases manquantes
 * coûtent le plus cher — « Réservations acceptées » ou « Repas sur place »
 * absents, et la fiche disparaît des filtres de recherche correspondants.
 */
const RESTAURANT: AttributeCatalog = [
  {
    group: "Services disponibles",
    items: ["Repas sur place", "Livraison", "Vente à emporter", "Terrasse", "Drive"],
  },
  {
    group: "Points forts",
    items: [
      "Excellent café",
      "Excellents cocktails",
      "Excellents desserts",
      "Grand choix de vins",
      "Excellent thé",
    ],
  },
  {
    group: "Populaire pour",
    items: ["Petit-déjeuner", "Déjeuner", "Dîner", "Dîner en solo", "Brunch du week-end"],
  },
  {
    group: "Accessibilité",
    items: [
      "Entrée accessible en fauteuil roulant",
      "Parking accessible en fauteuil roulant",
      "Places assises accessibles en fauteuil roulant",
      "Toilettes accessibles en fauteuil roulant",
    ],
  },
  {
    group: "Offre",
    items: [
      "Alcools",
      "Bière",
      "Cafés",
      "Cocktails et apéritifs",
      "Convient aux végétariens",
      "Produits sains",
      "Salle à manger privée",
      "Spiritueux",
      "Vin",
      "Petites portions",
    ],
  },
  {
    group: "Services de restauration",
    items: [
      "Petit-déjeuner",
      "Déjeuner",
      "Dîner",
      "Traiteur",
      "Desserts",
      "Places assises",
      "Service à table",
      "Comptoir à emporter",
    ],
  },
  { group: "Services", items: ["Toilettes", "Wi-Fi", "Wi-Fi gratuit"] },
  {
    group: "Ambiance",
    items: [
      "Ambiance décontractée",
      "Branché",
      "Cadre agréable",
      "Calme",
      "Haut de gamme",
      "Historique",
      "Romantique",
    ],
  },
  {
    group: "Clientèle",
    items: ["Adapté aux familles", "Groupes", "LGBTQ+ friendly", "Espace sûr pour les transgenres", "Touristes"],
  },
  {
    group: "Planning",
    items: [
      "Réservation recommandée pour le déjeuner",
      "Réservation recommandée pour le dîner",
      "Réservation obligatoire",
      "Réservations acceptées",
    ],
  },
  {
    group: "Paiements",
    items: [
      "Cartes de crédit",
      "Cartes de débit",
      "Chèques",
      "Paiements mobiles NFC",
      "Titres-restaurant",
    ],
  },
  {
    group: "Enfants",
    items: ["Chaises hautes", "Convient aux enfants", "Menu enfant", "Table à langer"],
  },
  {
    group: "Parking",
    items: [
      "Parking gratuit",
      "Parking payant",
      "Parking payant dans la rue",
      "Service de voiturier",
      "Parking dans la rue gratuit",
    ],
  },
  { group: "Animaux de compagnie", items: ["Chiens acceptés", "Chiens autorisés à l'extérieur"] },
];

/** Commerce de détail : la case « Retrait en magasin » vaut une vitrine. */
const SHOP: AttributeCatalog = [
  {
    group: "Services disponibles",
    items: ["Achats en magasin", "Retrait en magasin", "Retrait à l'extérieur", "Livraison", "Livraison le jour même"],
  },
  {
    group: "Accessibilité",
    items: [
      "Entrée accessible en fauteuil roulant",
      "Parking accessible en fauteuil roulant",
      "Toilettes accessibles en fauteuil roulant",
    ],
  },
  { group: "Services", items: ["Toilettes", "Wi-Fi", "Assemblage sur place", "Réparations", "Service après-vente"] },
  { group: "Offre", items: ["Cartes cadeaux", "Produits d'occasion", "Produits locaux", "Marques exclusives"] },
  { group: "Planning", items: ["Rendez-vous recommandé", "Rendez-vous obligatoire"] },
  {
    group: "Paiements",
    items: ["Cartes de crédit", "Cartes de débit", "Chèques", "Paiements mobiles NFC", "Paiement en plusieurs fois"],
  },
  {
    group: "Parking",
    items: ["Parking gratuit", "Parking payant", "Parking payant dans la rue", "Parking dans la rue gratuit"],
  },
  { group: "Clientèle", items: ["Adapté aux familles", "LGBTQ+ friendly"] },
  { group: "Animaux de compagnie", items: ["Chiens acceptés"] },
];

/** Prestataire de service : artisan, agence, cabinet — le déplacement compte. */
const SERVICE: AttributeCatalog = [
  {
    group: "Services disponibles",
    items: [
      "Services sur place",
      "Se déplace à domicile",
      "Rendez-vous en ligne",
      "Devis en ligne",
      "Service d'urgence",
    ],
  },
  {
    group: "Accessibilité",
    items: [
      "Entrée accessible en fauteuil roulant",
      "Parking accessible en fauteuil roulant",
      "Toilettes accessibles en fauteuil roulant",
    ],
  },
  { group: "Planning", items: ["Rendez-vous recommandé", "Rendez-vous obligatoire", "Accepte les nouveaux clients"] },
  { group: "Services", items: ["Toilettes", "Wi-Fi", "Salle d'attente", "Garantie sur les travaux"] },
  { group: "Paiements", items: ["Cartes de crédit", "Cartes de débit", "Chèques", "Paiements mobiles NFC", "Virement"] },
  { group: "Parking", items: ["Parking gratuit", "Parking payant", "Parking dans la rue gratuit"] },
  { group: "Clientèle", items: ["Adapté aux familles", "LGBTQ+ friendly"] },
];

const CATALOGS: Record<BusinessFamily, AttributeCatalog> = {
  restaurant: RESTAURANT,
  shop: SHOP,
  service: SERVICE,
};

/**
 * Les mots de la catégorie Google qui rangent une fiche dans une famille.
 *
 * On lit la catégorie française telle que Google l'écrit — « Restaurant de
 * fruits de mer », « Magasin de meubles », « Plombier ». Un mot suffit :
 * l'ordre ci-dessous départage les cas où deux familles pourraient répondre.
 */
const FAMILY_HINTS: { family: BusinessFamily; words: string[] }[] = [
  {
    family: "restaurant",
    words: [
      "restaurant",
      "brasserie",
      "bistro",
      "café",
      "bar",
      "pizzeria",
      "crêperie",
      "traiteur",
      "boulangerie",
      "pâtisserie",
      "salon de thé",
      "glacier",
      "hôtel",
      "brunch",
    ],
  },
  {
    family: "shop",
    words: [
      "magasin",
      "boutique",
      "librairie",
      "épicerie",
      "supermarché",
      "fleuriste",
      "opticien",
      "pharmacie",
      "concessionnaire",
      "quincaillerie",
      "bijouterie",
      "vendeur",
    ],
  },
];

/** Range une fiche dans une famille à partir de sa catégorie Google. */
export function familyFor(category: string | null): BusinessFamily {
  const haystack = (category ?? "").toLowerCase();
  for (const hint of FAMILY_HINTS) {
    if (hint.words.some((word) => haystack.includes(word))) return hint.family;
  }
  // Coiffeur, plombier, avocat, garage, salle de sport : tout le reste rend un
  // service, et c'est le catalogue le plus sobre des trois.
  return "service";
}

/** Le catalogue d'attributs de cette famille de commerce. */
export function catalogFor(family: BusinessFamily): AttributeCatalog {
  return CATALOGS[family];
}
