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
 * L'allure raconte ce que vend le produit : les aperçus IA de Google gagnent le
 * plus vite parce qu'ils répondent à toutes les questions locales, ChatGPT suit
 * sur des questions moins nombreuses mais bien plus recherchées. Un mois y
 * recule, parce que la vraie mesure recule parfois et qu'un exemple qui ne
 * monte jamais que tout droit prépare mal à la première barre négative.
 */

/**
 * Les douze derniers mois, dans la forme des points relevés.
 *
 * L'axe d'exemple doit ressembler à celui du vrai relevé — même fenêtre
 * glissante — sinon la carte paraît figée dans un autre calendrier.
 */
function lastTwelveMonths(): string[] {
  const now = new Date();
  const months: string[] = [];
  for (let back = 11; back >= 0; back -= 1) {
    months.push(
      new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1))
        .toISOString()
        .slice(0, 10),
    );
  }
  return months;
}

/** Une série d'exemple pour une plateforme, à partir de ses écarts mensuels. */
function demoSeries(
  platform: string,
  label: string,
  logo: string,
  locationCode: number,
  deltas: number[],
): LlmPlatformSeries {
  const points = lastTwelveMonths().map((month, index) => {
    const delta = deltas[index];
    return { month, delta, deltaSearchVolume: delta * 180 };
  });

  return {
    platform,
    label,
    logo,
    locationCode,
    points,
    netDelta: points.reduce((total, point) => total + point.delta, 0),
    netSearchVolume: points.reduce((total, point) => total + point.deltaSearchVolume, 0),
  };
}

export function buildDemoLlmMentions(domain: string | null): LlmMentionsReport {
  const platforms = [
    demoSeries(
      "google",
      "Aperçus IA de Google",
      "/gemini.webp",
      2250,
      [3, 5, 4, 8, 7, 11, 9, -2, 14, 12, 17, 19],
    ),
    demoSeries(
      "chat_gpt",
      "ChatGPT",
      "/chatgpt.png",
      2840,
      [1, 2, 4, 3, 6, 5, 8, 7, 6, 10, 9, 13],
    ),
  ];

  return {
    domain: domain ?? "votre-domaine.fr",
    platforms,
    netDelta: platforms.reduce((total, entry) => total + entry.netDelta, 0),
    fetchedAt: new Date().toISOString(),
  };
}
