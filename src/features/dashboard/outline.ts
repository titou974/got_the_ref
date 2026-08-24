/**
 * Le plan d'un article, et la consigne attachée à chaque section.
 *
 * Le plan était jusqu'ici une simple liste de titres. Il porte désormais, pour
 * chaque section, le niveau de titre et ce que le client veut y lire : c'est la
 * consigne que l'agent relit avant de rédiger ce passage, et la seule façon de
 * reprendre un paragraphe sans faire réécrire l'article entier.
 *
 * L'ancien format (un tableau de chaînes) reste lu tel quel : les articles
 * planifiés avant ce changement s'ouvrent sans migration, avec une consigne vide.
 */

export type OutlineSection = {
  /** Le titre de la section, tel qu'il apparaîtra dans l'article. */
  heading: string;
  /** 2 = titre de section, 3 = sous-partie. Rien au-delà : au quatrième niveau,
   *  un lecteur ne suit plus, et une IA ne cite plus le passage comme réponse. */
  level: 2 | 3;
  /** Ce que le client attend de cette section. Vide = laissé à l'agent. */
  instruction: string;
};

function cleanLevel(value: unknown): 2 | 3 {
  return value === 3 || value === "3" ? 3 : 2;
}

function cleanText(value: unknown, max: number): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

/** Relit le plan stocké. Une valeur illisible vaut un plan vide. */
export function parseOutline(raw: string | null | undefined): OutlineSection[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  return parsed
    .map((item): OutlineSection | null => {
      // Ancien format : le titre seul.
      if (typeof item === "string") {
        const heading = cleanText(item, 160);
        return heading ? { heading, level: 2, instruction: "" } : null;
      }
      if (!item || typeof item !== "object") return null;
      const o = item as Record<string, unknown>;
      const heading = cleanText(o.heading ?? o.title, 160);
      if (!heading) return null;
      return {
        heading,
        level: cleanLevel(o.level),
        instruction: typeof o.instruction === "string" ? o.instruction.trim().slice(0, 600) : "",
      };
    })
    .filter((section): section is OutlineSection => section !== null)
    .slice(0, 20);
}

export function serializeOutline(sections: OutlineSection[]): string {
  return JSON.stringify(
    sections
      .filter((section) => section.heading.trim())
      .map((section) => ({
        heading: section.heading.trim(),
        level: section.level,
        instruction: section.instruction.trim(),
      })),
  );
}

/** Le plan mis à plat pour un prompt : titre, niveau, consigne quand il y en a une. */
export function outlineForPrompt(sections: OutlineSection[]): string {
  return sections
    .map((section) => {
      const prefix = section.level === 3 ? "  - " : "- ";
      return section.instruction
        ? `${prefix}${section.heading} (consigne : ${section.instruction})`
        : `${prefix}${section.heading}`;
    })
    .join("\n");
}
