/**
 * Le trafic d'exemple des assistants, pour la carte du tableau de bord tant
 * qu'Analytics n'est pas rattaché.
 *
 * Sans rattachement, `fetchAiTraffic` ne renvoie rien et la carte restait vide.
 * Une carte vide ne dit pourtant qu'une chose : « il manque un branchement ».
 * Elle ne montre pas ce que le client verra une fois branché. Ces chiffres sont
 * donc fictifs et annoncés comme tels — la carte porte un bandeau « données
 * d'exemple » et garde la phrase qui explique le rattachement manquant.
 *
 * Les valeurs sont écrites en dur plutôt que tirées au sort : un graphique qui
 * change de forme à chaque rechargement se lit comme une vraie mesure erratique.
 * Seules les dates suivent l'horloge, pour que l'axe ressemble au mois en cours.
 */

/** Les trois assistants montrés. Les libellés servent aussi de clés de série. */
export const DEMO_ENGINES = ["ChatGPT", "Gemini", "Perplexity"] as const;

export type DemoEngine = (typeof DEMO_ENGINES)[number];

export type DemoTrafficPoint = { date: string } & Record<DemoEngine, number>;

export type DemoEngineSummary = {
  name: DemoEngine;
  sessions: number;
  previousSessions: number;
  /** Part de ce moteur dans le total des visites venues d'un assistant, en %. */
  share: number;
};

export type DemoAiTraffic = {
  days: number;
  series: DemoTrafficPoint[];
  engines: DemoEngineSummary[];
  totalSessions: number;
  previousTotalSessions: number;
  /** Visites du site tous canaux confondus : donne la part des assistants. */
  siteSessions: number;
};

/**
 * Trente jours de visites, une ligne par assistant.
 *
 * L'allure raconte ce que vend le produit : ChatGPT devant et en hausse nette,
 * Gemini qui suit à la moitié, Perplexity plus petit mais régulier.
 */
const DAILY: Record<DemoEngine, number[]> = {
  ChatGPT: [
    41, 38, 47, 52, 49, 58, 61, 55, 64, 70, 66, 74, 79, 72, 83, 88, 81, 94, 99, 92, 105, 110, 103,
    117, 122, 114, 128, 134, 127, 141,
  ],
  Gemini: [
    18, 21, 19, 24, 26, 23, 29, 31, 28, 34, 36, 33, 39, 42, 38, 45, 47, 44, 50, 53, 49, 56, 59, 55,
    62, 65, 61, 68, 71, 67,
  ],
  Perplexity: [
    9, 11, 8, 13, 12, 15, 14, 17, 16, 19, 18, 21, 20, 23, 22, 25, 24, 27, 26, 29, 28, 31, 30, 33,
    32, 35, 34, 37, 36, 39,
  ],
};

/**
 * La période précédente, en proportion du total de chaque assistant.
 *
 * Écrite comme un rapport plutôt qu'en valeurs absolues : la variation affichée
 * reste juste même si la table du dessus est retouchée.
 */
const PREVIOUS_RATIO: Record<DemoEngine, number> = {
  ChatGPT: 0.62,
  Gemini: 0.74,
  Perplexity: 0.86,
};

/** Part des assistants dans le total des visites du site, dans cet exemple. */
const AI_SHARE_OF_SITE = 0.068;

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

/** Un axe daté lisible : « 4 août », sans l'année qui n'apporte rien sur 30 jours. */
const formatDay = (date: Date) =>
  date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

/**
 * Construit le rapport d'exemple, la dernière journée tombant sur `endingOn`.
 *
 * À appeler depuis un composant serveur : la date est lue une fois puis passée
 * en props, sinon le rendu du serveur et celui du navigateur pourraient tomber
 * de part et d'autre de minuit.
 */
export function buildDemoAiTraffic(endingOn: Date = new Date()): DemoAiTraffic {
  const total = DAILY.ChatGPT.length;

  const series: DemoTrafficPoint[] = DAILY.ChatGPT.map((_, index) => {
    const date = new Date(endingOn);
    date.setDate(date.getDate() - (total - 1 - index));

    return {
      date: formatDay(date),
      ChatGPT: DAILY.ChatGPT[index],
      Gemini: DAILY.Gemini[index],
      Perplexity: DAILY.Perplexity[index],
    };
  });

  return summarize(series);
}

/**
 * Ramène le rapport aux `days` derniers jours.
 *
 * Appelé depuis le navigateur quand le client change de période dans la barre de
 * filtres : les trente jours sont déjà là, il n'y a rien à redemander au
 * serveur, seulement à recompter.
 */
export function windowDemoAiTraffic(demo: DemoAiTraffic, days: number): DemoAiTraffic {
  if (days >= demo.series.length) return demo;
  return summarize(demo.series.slice(-days));
}

/** Les totaux, les parts et la période précédente, déduits d'une série. */
function summarize(series: DemoTrafficPoint[]): DemoAiTraffic {
  const totalSessions = DEMO_ENGINES.reduce(
    (running, engine) => running + sum(series.map((point) => point[engine])),
    0,
  );

  const engines: DemoEngineSummary[] = DEMO_ENGINES.map((name) => {
    const sessions = sum(series.map((point) => point[name]));
    return {
      name,
      sessions,
      previousSessions: Math.round(sessions * PREVIOUS_RATIO[name]),
      share: (sessions / totalSessions) * 100,
    };
  });

  return {
    days: series.length,
    series,
    engines,
    totalSessions,
    previousTotalSessions: sum(engines.map((engine) => engine.previousSessions)),
    siteSessions: Math.round(totalSessions / AI_SHARE_OF_SITE),
  };
}
