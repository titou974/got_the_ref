/**
 * Enseignes affichées dans la file de logos sous les titres (`BrandProof`).
 *
 * ⚠️ Ce sont des logos **génériques**, dessinés pour la maquette : aucune marque
 * réelle n'y figure. Afficher le logo d'une entreprise en preuve sociale
 * suppose son accord — sans quoi on cumule usage de marque non autorisé et
 * allégation trompeuse (art. L121-2 du Code de la consommation), le même
 * régime que `PROOF_IS_ILLUSTRATIVE` et `ADOPTERS_COUNT`.
 *
 * Remplacez chaque entrée par un client réel : `name` sert d'alternative
 * textuelle et d'infobulle, `glyph` choisit le dessin, `tint` la pastille.
 */
export type BrandGlyph = "croissant" | "outil" | "tasse" | "feuille" | "roue" | "losange";

export type ShowcaseBrand = {
  name: string;
  glyph: BrandGlyph;
  /** Fond de la pastille — teintes sourdes, pour ne pas trouer la palette. */
  tint: string;
};

export const SHOWCASE_BRANDS: ShowcaseBrand[] = [
  { name: "Maison Léa", glyph: "croissant", tint: "#efe3cd" },
  { name: "Fleur & Sel", glyph: "feuille", tint: "#dcebdd" },
  { name: "Café Bertin", glyph: "tasse", tint: "#ecdcd2" },
  { name: "Atelier Rive", glyph: "outil", tint: "#e0e5ec" },
  { name: "Vélo Nord", glyph: "roue", tint: "#d9e3f0" },
  { name: "Studio Clef", glyph: "losange", tint: "#e6dff1" },
];
