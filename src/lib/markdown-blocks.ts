/**
 * Le corps d'un article, vu comme une suite de blocs.
 *
 * L'article reste stocké en Markdown : c'est ce que les connecteurs déposent
 * sur le site du client, et c'est la structure (titres, listes) que les moteurs
 * de réponse lisent. Mais on ne demande pas au client d'écrire des dièses. On
 * découpe donc le texte en blocs typés, chacun édité pour ce qu'il est — un
 * titre, un paragraphe, une liste — puis on recompose le Markdown à
 * l'enregistrement.
 *
 * Le découpage doit être réversible : relire un article sans y toucher et le
 * réenregistrer ne doit pas modifier une ligne du fichier publié.
 */

export type BlockKind = "h2" | "h3" | "p" | "ul" | "ol" | "quote" | "code";

export type Block = {
  id: string;
  kind: BlockKind;
  /**
   * Le texte visible, marqueurs Markdown de bloc retirés. Pour une liste, une
   * entrée par ligne ; pour un bloc de code, le code tel quel.
   */
  text: string;
  /** Langage d'un bloc de code, repris de la ligne d'ouverture (` ```ts `). */
  lang?: string;
};

let counter = 0;
/** Identifiant de bloc, stable le temps d'une session d'édition. */
export function blockId(): string {
  counter += 1;
  return `b${counter}`;
}

const HEADING = /^(#{1,6})\s+(.*)$/;
const BULLET = /^[-*+]\s+(.*)$/;
const NUMBERED = /^\d{1,3}[.)]\s+(.*)$/;
const QUOTE = /^>\s?(.*)$/;
const FENCE = /^```(\w*)\s*$/;

export function parseBlocks(markdown: string): Block[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i += 1;
      continue;
    }

    const fence = line.match(FENCE);
    if (fence) {
      const lang = fence[1] || undefined;
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !FENCE.test(lines[i])) {
        body.push(lines[i]);
        i += 1;
      }
      i += 1; // referme la clôture
      blocks.push({ id: blockId(), kind: "code", text: body.join("\n"), lang });
      continue;
    }

    const heading = line.match(HEADING);
    if (heading) {
      // Le titre de l'article est le seul H1 : tout ce qui vient du corps
      // commence donc au niveau 2, et les niveaux profonds y sont ramenés.
      const level = heading[1].length;
      blocks.push({
        id: blockId(),
        kind: level >= 3 ? "h3" : "h2",
        text: heading[2].trim(),
      });
      i += 1;
      continue;
    }

    if (QUOTE.test(line)) {
      const body: string[] = [];
      while (i < lines.length && QUOTE.test(lines[i])) {
        body.push(lines[i].match(QUOTE)![1]);
        i += 1;
      }
      blocks.push({ id: blockId(), kind: "quote", text: body.join("\n").trim() });
      continue;
    }

    if (BULLET.test(line)) {
      const items: string[] = [];
      while (i < lines.length && BULLET.test(lines[i])) {
        items.push(lines[i].match(BULLET)![1]);
        i += 1;
      }
      blocks.push({ id: blockId(), kind: "ul", text: items.join("\n") });
      continue;
    }

    if (NUMBERED.test(line)) {
      const items: string[] = [];
      while (i < lines.length && NUMBERED.test(lines[i])) {
        items.push(lines[i].match(NUMBERED)![1]);
        i += 1;
      }
      blocks.push({ id: blockId(), kind: "ol", text: items.join("\n") });
      continue;
    }

    // Paragraphe : tout jusqu'à la ligne vide ou au prochain bloc reconnu.
    const paragraph: string[] = [];
    while (i < lines.length && lines[i].trim()) {
      const next = lines[i];
      if (
        HEADING.test(next) ||
        BULLET.test(next) ||
        NUMBERED.test(next) ||
        QUOTE.test(next) ||
        FENCE.test(next)
      ) {
        break;
      }
      paragraph.push(next.trim());
      i += 1;
    }
    if (paragraph.length) {
      blocks.push({ id: blockId(), kind: "p", text: paragraph.join(" ") });
    }
  }

  return blocks;
}

export function serializeBlocks(blocks: Block[]): string {
  const chunks = blocks
    .map((block) => {
      const text = block.text.trim();
      if (!text && block.kind !== "code") return "";
      switch (block.kind) {
        case "h2":
          return `## ${text}`;
        case "h3":
          return `### ${text}`;
        case "quote":
          return text
            .split("\n")
            .map((line) => `> ${line}`)
            .join("\n");
        case "ul":
          return text
            .split("\n")
            .filter((line) => line.trim())
            .map((line) => `- ${line.trim()}`)
            .join("\n");
        case "ol":
          return text
            .split("\n")
            .filter((line) => line.trim())
            .map((line, index) => `${index + 1}. ${line.trim()}`)
            .join("\n");
        case "code":
          return `\`\`\`${block.lang ?? ""}\n${block.text}\n\`\`\``;
        default:
          return text;
      }
    })
    .filter(Boolean);

  return chunks.join("\n\n");
}

/** Les titres du corps, dans l'ordre : de quoi retrouver le plan écrit. */
export function headingsOf(blocks: Block[]): { heading: string; level: 2 | 3 }[] {
  return blocks
    .filter((block) => block.kind === "h2" || block.kind === "h3")
    .map((block) => ({ heading: block.text.trim(), level: block.kind === "h3" ? 3 : 2 }));
}

/** Nombre de mots du corps, listes et citations comprises, code exclu. */
export function wordCount(blocks: Block[]): number {
  return blocks
    .filter((block) => block.kind !== "code")
    .map((block) => block.text.trim())
    .filter(Boolean)
    .reduce((total, text) => total + text.split(/\s+/).length, 0);
}
