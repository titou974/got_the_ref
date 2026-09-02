/**
 * Le trafic d'exemple des assistants, pour la carte du tableau de bord tant
 * qu'Analytics n'est pas rattaché.
 *
 * Sans rattachement, `fetchAiTraffic` ne renvoie rien et la carte restait vide.
 * Une carte vide ne dit pourtant qu'une chose : « il manque un branchement ».
 * Elle ne montre pas ce que le client verra une fois branché.
 *
 * Les valeurs sont tirées au sort, mais une seule fois pour toutes : le tirage
 * part d'une graine écrite en dur, donc la même série sort à chaque rendu, sur
 * le serveur comme dans le navigateur. Un graphique qui change de forme à
 * chaque rechargement se lirait comme une vraie mesure erratique, et un tirage
 * refait côté navigateur ferait diverger l'hydratation du rendu serveur.
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

/** Le nombre de jours couverts par l'exemple. */
const DEMO_DAYS = 30;

/** Le plancher et le plafond des visites quotidiennes tirées au sort. */
const MIN_DAILY = 100;
const MAX_DAILY = 1000;

/**
 * Une graine par assistant : deux séries tirées de la même graine seraient
 * identiques, et les trois courbes se superposeraient exactement.
 */
const SEEDS: Record<DemoEngine, number> = {
  ChatGPT: 0x5f3a91,
  Gemini: 0x2c8b47,
  Perplexity: 0x7d1e63,
};

/**
 * Un tirage pseudo-aléatoire reproductible (mulberry32).
 *
 * `Math.random()` ne convient pas ici : il donnerait une série au serveur et
 * une autre au navigateur, et la courbe changerait à chaque rechargement.
 */
function seeded(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** Les visites quotidiennes d'un assistant, entre le plancher et le plafond. */
function dailyFor(engine: DemoEngine): number[] {
  const next = seeded(SEEDS[engine]);

  return Array.from({ length: DEMO_DAYS }, () =>
    Math.round(MIN_DAILY + next() * (MAX_DAILY - MIN_DAILY)),
  );
}

/**
 * Trente jours de visites, une ligne par assistant.
 *
 * Tiré une seule fois, au chargement du module : le même tableau sert ensuite
 * tous les rendus.
 */
const DAILY: Record<DemoEngine, number[]> = {
  ChatGPT: dailyFor("ChatGPT"),
  Gemini: dailyFor("Gemini"),
  Perplexity: dailyFor("Perplexity"),
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
