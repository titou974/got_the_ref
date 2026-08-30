/**
 * Classement de substitution affiché sur l'aperçu gratuit.
 *
 * Le classement réel contient la ligne du commerce analysé, avec son rang : le
 * flouter ne suffit pas, la position resterait lisible dans le DOM et devinable
 * à l'œil (une ligne surlignée à la 7ᵉ place se voit à travers le flou). On
 * substitue donc des bandes entièrement fictives, sans ligne « vous » et sans
 * rang cible : le lecteur voit qu'un classement existe, jamais où il s'y trouve.
 *
 * Les noms sont tirés d'une graine stable (niche + moteur + portée) pour que le
 * rendu serveur et le rendu client coïncident, et qu'un même rapport montre
 * toujours les mêmes bandes d'un chargement à l'autre.
 */

const PREFIXES = [
  "Maison",
  "Atelier",
  "Le Comptoir",
  "Groupe",
  "Villa",
  "L'Escale",
  "La Cour",
  "Studio",
];

const CORES = [
  "Vermont",
  "Duval",
  "Saint-Roch",
  "Lafitte",
  "Argenta",
  "Belmont",
  "Ferrand",
  "Novara",
  "Marceau",
  "Cassini",
  "Loriol",
  "Vasseur",
];

/** Hachage FNV-1a : même clé, même tirage, à chaque rendu. */
function hash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Générateur pseudo-aléatoire déterministe (mulberry32). */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type DecoyEntry = { rank: number; name: string };

/**
 * `count` bandes fictives, numérotées à partir de 1, sans doublon de nom.
 */
export function decoyRanking(seedKey: string, count = 7): DecoyEntry[] {
  const rand = seeded(hash(seedKey));
  const used = new Set<string>();
  const out: DecoyEntry[] = [];

  // Bornée : au pire on épuise les tentatives et on rend moins de bandes qu'espéré,
  // plutôt que de boucler indéfiniment sur un tirage saturé.
  for (let attempt = 0; attempt < count * 8 && out.length < count; attempt += 1) {
    const name = `${PREFIXES[Math.floor(rand() * PREFIXES.length)]} ${
      CORES[Math.floor(rand() * CORES.length)]
    }`;
    if (used.has(name)) continue;
    used.add(name);
    out.push({ rank: out.length + 1, name });
  }
  return out;
}
