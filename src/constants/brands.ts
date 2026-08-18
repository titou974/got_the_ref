/**
 * Enseignes affichées dans la file de logos sous les titres (`BrandProof`).
 *
 * ⚠️ Hors La Cotriade — déjà citée nommément dans la section « cas réel » —, ce
 * sont des logos **de maquette** : aucune marque réelle n'y figure. Afficher le
 * logo d'une entreprise en preuve sociale suppose son accord — sans quoi on
 * cumule usage de marque non autorisé et allégation trompeuse (art. L121-2 du
 * Code de la consommation), le même régime que `PROOF_IS_ILLUSTRATIVE` et
 * `ADOPTERS_COUNT`.
 *
 * Remplacez chaque entrée par un client réel : `name` sert d'alternative
 * textuelle et d'infobulle, `src` pointe le fichier de `public/marques/`.
 */
export type ShowcaseBrand = {
  name: string;
  /** Logo carré, servi depuis `/public/marques` — 128 px de côté. */
  src: string;
};

export const SHOWCASE_BRANDS: ShowcaseBrand[] = [
  { name: "La Cotriade", src: "/marques/cotriade.png" },
  { name: "Visia", src: "/marques/visia.webp" },
  { name: "Uvia Studio", src: "/marques/uvia.webp" },
  { name: "Altura Conseil", src: "/marques/altura.webp" },
  { name: "Cabinet Dentalis", src: "/marques/dentalis.webp" },
  { name: "Le Palatis", src: "/marques/palatis.webp" },
];
