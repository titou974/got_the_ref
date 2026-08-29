import type { LlmMentionsReport } from "./llmMentions";

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
 * Douze mois de mentions, en pente montante.
 *
 * Écrits en dur eux aussi, et posés sur les douze derniers mois réels : l'axe
 * doit ressembler à l'année qui vient de passer, sinon la carte d'exemple
 * paraît figée dans un autre calendrier.
 */
function demoHistory(brand: number[]): LlmMentionsReport["history"] {
  const now = new Date();
  return brand.map((mentions, index) => {
    const date = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (brand.length - 1 - index), 1),
    );
    return {
      month: date.toISOString().slice(0, 10),
      mentions,
      searchVolume: mentions * 180,
      delta: index === 0 ? null : mentions - brand[index - 1],
    };
  });
}

export function buildDemoLlmMentions(domain: string | null): LlmMentionsReport {
  return {
    domain: domain ?? "votre-domaine.fr",
    brand: "Votre marque",
    history: demoHistory([12, 15, 14, 19, 23, 21, 28, 34, 31, 42, 48, 57]),
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
