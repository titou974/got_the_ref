/**
 * Enseignes affichées dans la file de logos sous les titres (`BrandProof`).
 *
 * Logos fournis par l'utilisateur — pas des maquettes. Afficher le logo d'une
 * entreprise en preuve sociale suppose son accord ; vérifiez-le avant mise en
 * ligne si l'un de ces clients n'a pas encore validé sa présence ici.
 *
 * `name` sert d'alternative textuelle et d'infobulle, `src` pointe le fichier
 * de `public/marques/`.
 */
export type ShowcaseBrand = {
  name: string;
  /** Logo carré, servi depuis `/public/marques` — 128 px de côté. */
  src: string;
};

export const SHOWCASE_BRANDS: ShowcaseBrand[] = [
  { name: "La Cotriade", src: "/marques/cotriade.png" },
  { name: "Café Joyeux", src: "/marques/cafe-joyeux.png" },
  { name: "La Belle Vue", src: "/marques/la-belle-vue.png" },
  { name: "Au Jardin", src: "/marques/au-jardin.png" },
  { name: "Paul Meunier", src: "/marques/paul-meunier.png" },
  { name: "Le Palatis", src: "/marques/palatis.png" },
];
