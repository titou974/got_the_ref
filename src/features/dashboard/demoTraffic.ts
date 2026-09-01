/**
 * Le trafic d'exemple des assistants, pour la carte du tableau de bord tant
 * qu'Analytics n'est pas rattaché.
 *
 * Sans rattachement, `fetchAiTraffic` ne renvoie rien et la carte restait vide.
 * Une carte vide ne dit pourtant qu'une chose : « il manque un branchement ».
 * Elle ne montre pas ce que le client verra une fois branché. Ces chiffres sont
 * donc fictifs et annoncés comme tels — la carte porte un bandeau « données
 * d'exemple ».
 *
 * Les valeurs ne sont plus écrites en dur : elles sont tirées d'une graine
 * déduite du domaine analysé. Deux raisons. La première est qu'une table unique
 * donnait la même courbe à tout le monde, et qu'une démonstration où chaque site
 * affiche exactement les mêmes visites se lit comme une capture d'écran collée.
 * La seconde est que le tirage doit rester **reproductible** : un `Math.random()`
 * changerait de forme à chaque rendu, ferait diverger le serveur du navigateur,
 * et une mesure qui bouge au rechargement n'est plus une mesure. La même URL
 * donne donc toujours la même courbe, et deux URL en donnent deux différentes.
 *
 * La courbe est toujours croissante, par construction (cf. `growingSeries`) :
 * c'est ce que le produit promet, et une démonstration qui montrerait un mois
 * en baisse vendrait le contraire de ce qu'elle démontre.
 *
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
  /**
   * Le rapport de la période précédente, moteur par moteur, transporté avec le
   * rapport plutôt que gardé en constante de module.
   *
   * `windowDemoAiTraffic` recompte les totaux quand le client change de période,
   * et il lui faut les mêmes rapports que ceux du tirage initial — sans quoi la
   * variation affichée sauterait au seul changement de fenêtre.
   */
  previousRatio: Record<DemoEngine, number>;
  /** Part des assistants dans le total des visites du site, pour ce tirage. */
  aiShareOfSite: number;
};

/** Le nombre de jours tirés. Trente : le mois que montre la barre de période. */
const DAYS = 30;

/* ------------------------------- Le tirage -------------------------------- */

/**
 * Une graine 32 bits déduite d'une chaîne (xmur3).
 *
 * Le domaine entre, un entier sort. Deux domaines voisins — `pizza-luigi.fr` et
 * `pizza-luigo.fr` — donnent deux graines sans rapport : c'est le but, sinon
 * deux clients du même secteur verraient deux courbes jumelles.
 */
function seedFrom(input: string): number {
  let h = 1779033703 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    h = Math.imul(h ^ input.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

/**
 * Un générateur pseudo-aléatoire reproductible (mulberry32).
 *
 * Même graine, même suite de nombres. C'est toute la propriété qui compte ici :
 * le rendu du serveur et celui du navigateur tombent sur les mêmes visites.
 */
function randomFrom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Un réel tiré dans `[min, max)`. */
const between = (random: () => number, min: number, max: number) =>
  min + random() * (max - min);

/**
 * `count` valeurs qui montent de `start` à `end`, sans jamais redescendre.
 *
 * Le secret tient dans la borne du bruit : il est tiré dans ±`step / 2.4`, donc
 * strictement inférieur à la moitié du pas. Entre deux jours, l'écart vaut
 * `step + (bruit suivant − bruit courant)`, et cette somme reste positive tant
 * que le bruit ne peut pas franchir `step / 2`. La suite est donc strictement
 * croissante avant arrondi, et l'arrondi ne peut pas l'inverser — arrondir est
 * monotone. La courbe respire, mais elle ne recule pas d'un point.
 *
 * Le pas est planché à une visite par jour. Sans ce plancher, un petit moteur
 * qui passerait de 8 à 15 sur un mois avancerait d'un quart de visite par jour :
 * après arrondi, la courbe monterait par paliers de trois ou quatre jours, et
 * une ligne en escalier se lit comme une panne de mesure plutôt que comme une
 * progression.
 */
function growingSeries(
  random: () => number,
  count: number,
  start: number,
  end: number,
): number[] {
  const target = Math.max(end, start + count);
  const step = (target - start) / Math.max(1, count - 1);
  const amplitude = step / 2.4;

  return Array.from({ length: count }, (_, index) =>
    Math.max(1, Math.round(start + step * index + between(random, -amplitude, amplitude))),
  );
}

/** Un axe daté lisible : « 4 août », sans l'année qui n'apporte rien sur 30 jours. */
const formatDay = (date: Date) =>
  date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

/**
 * Construit le rapport d'exemple pour un domaine donné, la dernière journée
 * tombant sur `endingOn`.
 *
 * À appeler depuis un composant serveur : la date est lue une fois puis passée
 * en props, sinon le rendu du serveur et celui du navigateur pourraient tomber
 * de part et d'autre de minuit.
 *
 * `seed` est le domaine analysé. Il est facultatif — un tableau de bord sans
 * domaine déclaré retombe alors sur une graine fixe, et donc sur une courbe
 * stable, plutôt que sur un tirage qui changerait à chaque rendu.
 */
export function buildDemoAiTraffic(
  seed: string | null = null,
  endingOn: Date = new Date(),
): DemoAiTraffic {
  const random = randomFrom(seedFrom(seed?.trim().toLowerCase() || "got-the-ref"));

  // ChatGPT devant, Gemini à peu près à la moitié, Perplexity plus étroit :
  // l'ordre de grandeur observé chez les clients. Ce sont les proportions qui
  // sont tenues, pas les valeurs — celles-ci sont tirées site par site.
  const start = {
    ChatGPT: Math.round(between(random, 24, 62)),
    Gemini: 0,
    Perplexity: 0,
  } as Record<DemoEngine, number>;
  start.Gemini = Math.round(start.ChatGPT * between(random, 0.38, 0.56));
  start.Perplexity = Math.round(start.ChatGPT * between(random, 0.16, 0.3));

  // Le mois gagne entre 55 % et 175 % : une progression franche, jamais nulle.
  const growth = {
    ChatGPT: between(random, 1.9, 2.75),
    Gemini: between(random, 1.7, 2.4),
    Perplexity: between(random, 1.55, 2.2),
  } as Record<DemoEngine, number>;

  const daily = Object.fromEntries(
    DEMO_ENGINES.map((engine) => [
      engine,
      growingSeries(
        random,
        DAYS,
        Math.max(3, start[engine]),
        Math.max(6, Math.round(start[engine] * growth[engine])),
      ),
    ]),
  ) as Record<DemoEngine, number[]>;

  const series: DemoTrafficPoint[] = Array.from({ length: DAYS }, (_, index) => {
    const date = new Date(endingOn);
    date.setDate(date.getDate() - (DAYS - 1 - index));

    return {
      date: formatDay(date),
      ChatGPT: daily.ChatGPT[index],
      Gemini: daily.Gemini[index],
      Perplexity: daily.Perplexity[index],
    };
  });

  // La période précédente, écrite comme un rapport plutôt qu'en valeurs
  // absolues : la variation affichée reste juste quelle que soit la fenêtre
  // recomptée. Toujours sous 1, donc toujours une hausse.
  const previousRatio = {
    ChatGPT: between(random, 0.52, 0.68),
    Gemini: between(random, 0.6, 0.78),
    Perplexity: between(random, 0.7, 0.88),
  } as Record<DemoEngine, number>;

  // Les assistants pèsent quelques pour cent du trafic total du site : c'est
  // l'ordre de grandeur de 2026, et c'est aussi ce qui rend la part crédible.
  const aiShareOfSite = between(random, 0.045, 0.092);

  return summarize(series, previousRatio, aiShareOfSite);
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
  return summarize(demo.series.slice(-days), demo.previousRatio, demo.aiShareOfSite);
}

/** Les totaux, les parts et la période précédente, déduits d'une série. */
function summarize(
  series: DemoTrafficPoint[],
  previousRatio: Record<DemoEngine, number>,
  aiShareOfSite: number,
): DemoAiTraffic {
  const totalSessions = DEMO_ENGINES.reduce(
    (running, engine) => running + sum(series.map((point) => point[engine])),
    0,
  );

  const engines: DemoEngineSummary[] = DEMO_ENGINES.map((name) => {
    const sessions = sum(series.map((point) => point[name]));
    return {
      name,
      sessions,
      previousSessions: Math.round(sessions * previousRatio[name]),
      share: (sessions / totalSessions) * 100,
    };
  });

  return {
    days: series.length,
    series,
    engines,
    totalSessions,
    previousTotalSessions: sum(engines.map((engine) => engine.previousSessions)),
    siteSessions: Math.round(totalSessions / aiShareOfSite),
    previousRatio,
    aiShareOfSite,
  };
}
