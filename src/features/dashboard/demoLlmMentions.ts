import type { LlmMentionsReport, LlmPlatformSeries } from "./llmMentions";

/**
 * Le relevé de mentions d'exemple, tant que le compte DataForSEO n'est pas
 * branché ou que l'archive ne connaît pas encore le domaine.
 *
 * Même parti pris que la courbe de trafic : une carte vide ne dit qu'« il
 * manque un branchement », elle ne montre pas ce que le client verra ensuite.
 * Les chiffres sont donc fictifs, écrits en dur — un graphique qui change de
 * forme à chaque rechargement se lirait comme une vraie mesure erratique — et
 * la carte porte le bandeau « données d'exemple » au-dessus.
 *
 * L'allure raconte ce que vend le produit : l'aperçu IA de Google cite le plus
 * souvent parce qu'il répond à toutes les questions locales, ChatGPT suit sur
 * des questions moins nombreuses mais bien plus recherchées.
 */

/**
 * Les mois écoulés depuis le 1er janvier, dans la forme des points relevés.
 *
 * L'axe d'exemple doit ressembler à celui du vrai relevé — de janvier au mois
 * en cours — sinon la carte paraît figée dans un autre calendrier.
 */
function monthsOfYear(): string[] {
  const now = new Date();
  const months: string[] = [];
  for (let month = 0; month <= now.getUTCMonth(); month += 1) {
    months.push(
      new Date(Date.UTC(now.getUTCFullYear(), month, 1)).toISOString().slice(0, 10),
    );
  }
  return months;
}

/**
 * Une série d'exemple pour une plateforme.
 *
 * Les valeurs sont des écarts, comme dans le vrai relevé : elles montent, elles
 * redescendent une fois, et la série est rognée ou complétée pour tomber juste
 * sur le nombre de mois écoulés.
 */
function demoSeries(
  platform: string,
  label: string,
  locationCode: number,
  deltas: number[],
): LlmPlatformSeries {
  const months = monthsOfYear();
  return {
    platform,
    label,
    locationCode,
    points: months.map((month, index) => {
      const delta = deltas[index % deltas.length];
      return { month, delta, deltaSearchVolume: delta * 180 };
    }),
  };
}

export function buildDemoLlmMentions(domain: string | null): LlmMentionsReport {
  return {
    domain: domain ?? "votre-domaine.fr",
    history: [
      demoSeries("google", "Aperçus IA de Google", 2250, [4, 7, 6, 11, 9, 14, 12, 18]),
      demoSeries("chat_gpt", "ChatGPT", 2840, [2, 3, -1, 5, 4, 6, 8, 7]),
    ],
    totalMentions: 142,
    truncated: false,
    fetchedAt: new Date().toISOString(),
    models: [
      {
        id: "google_ai_overview",
        platform: "google",
        label: "Aperçus IA de Google",
        logo: "/gemini.webp",
        mentions: 78,
        searchVolume: 24_600,
        topQuestion: "meilleur restaurant de fruits de mer à la rochelle",
      },
      {
        id: "gpt-5",
        platform: "chat_gpt",
        label: "ChatGPT gpt-5",
        logo: "/chatgpt.png",
        mentions: 41,
        searchVolume: 31_200,
        topQuestion: "où manger des huîtres à la rochelle",
      },
      {
        id: "gpt-4o",
        platform: "chat_gpt",
        label: "ChatGPT gpt-4o",
        logo: "/chatgpt.png",
        mentions: 23,
        searchVolume: 12_400,
        topQuestion: "restaurant vue sur le port la rochelle",
      },
    ],
  };
}
