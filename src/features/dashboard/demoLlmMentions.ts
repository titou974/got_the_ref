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
export function buildDemoLlmMentions(domain: string | null): LlmMentionsReport {
  return {
    domain: domain ?? "votre-domaine.fr",
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
