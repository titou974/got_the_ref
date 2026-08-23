/**
 * Balisage minimal pour les textes d'i18n rendus en « aperçu IA » :
 *
 *   **gras**        → segment mis en avant (comme les amorces de puces Google)
 *   ==surligné==    → segment surligné, à la manière d'un passage sélectionné
 *
 * Deux marqueurs suffisent, et rien de plus n'est interprété : les chaînes
 * restent lisibles dans le fichier de traduction, et le rendu n'exécute jamais
 * de HTML venu d'une chaîne.
 */

export type TextMark = "bold" | "highlight";

export type Segment = { text: string; mark?: TextMark };

const TOKEN = /(\*\*[^*]+\*\*|==[^=]+==)/g;

export function parseSegments(raw: string): Segment[] {
  const out: Segment[] = [];
  for (const part of raw.split(TOKEN)) {
    if (!part) continue;
    if (part.startsWith("**") && part.endsWith("**")) {
      out.push({ text: part.slice(2, -2), mark: "bold" });
    } else if (part.startsWith("==") && part.endsWith("==")) {
      out.push({ text: part.slice(2, -2), mark: "highlight" });
    } else {
      out.push({ text: part });
    }
  }
  return out;
}

/** Texte nu d'une suite de segments (longueur de frappe, version lecteur d'écran). */
export function segmentsText(segments: Segment[]): string {
  return segments.map((s) => s.text).join("");
}
