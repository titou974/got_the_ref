/**
 * Les questions tapées sous les yeux du client pendant que son audit tourne.
 *
 * L'écran d'attente ne montre pas un chargement : il montre le geste que le
 * produit mesure. Quelqu'un ouvre ChatGPT et tape « boulangerie artisanale à
 * Nantes ». C'est cette phrase-là qui décide si le commerce existe ou non dans
 * la réponse, et c'est elle qu'on écrit à la frappe pendant la minute d'attente.
 *
 * Deux jeux de phrases, et la bascule de l'un à l'autre est tout l'intérêt du
 * module. Tant que la niche n'est pas connue — les premières secondes, ou un
 * compte dont le crawl n'a rien conclu —, on tape des questions génériques :
 * elles disent la nature du produit sans prétendre connaître le client. Dès que
 * la niche est là, chaque question est la sienne, avec sa ville dedans. Le
 * client reconnaît son propre marché en train d'être interrogé, ce qu'aucune
 * barre de progression ne saura jamais lui dire.
 *
 * Module pur, sans appel réseau. Les niches sortent du crawl (fiche d'accueil)
 * ou de l'analyse ; les questions, elles, se composent ici. Un appel de modèle
 * pour écrire quinze phrases pendant un écran d'attente coûterait une latence
 * de plus au moment précis où le client attend déjà.
 *
 * Contrainte d'écriture, et elle n'est pas cosmétique : aucune phrase ne fait
 * accorder un mot avec la niche. « Meilleur boulangerie » se lit en une demie
 * seconde et discrédite tout l'écran, et rien dans nos données ne dit le genre
 * de « boulangerie ». Les tournures retenues laissent donc la niche
 * grammaticalement inerte — en complément, en tête de requête-mots-clés, ou
 * derrière un nom qui est le nôtre (« adresse », « site ») et dont on maîtrise
 * l'accord.
 */

/** Ce que le commerce est, pour autant qu'on le sache à cet instant. */
export type BusinessHint = {
  /** La niche détectée au crawl (« Restaurant de fruits de mer »). */
  niche: string | null;
  /** La ville couverte, pour un commerce qui reçoit du public. */
  city: string | null;
  /** Faux pour une activité qui n'a pas d'adresse : la ville ne veut rien dire. */
  isPhysical: boolean;
};

/**
 * Les questions lues avant que la niche ne soit connue.
 *
 * Elles ne nomment aucun métier : ce sont les questions que n'importe quel
 * client final pose à une IA quand il cherche un commerce. Écrites au « je »
 * ou à la deuxième personne, comme on parle à un assistant — pas comme on
 * remplit un champ de recherche.
 */
export const BASE_PROMPTS: readonly string[] = [
  "meilleure adresse près de chez moi",
  "qui recommandes-tu dans ma ville",
  "quelle adresse choisir ce soir",
  "je cherche un professionnel de confiance",
  "top 10 des commerces les mieux notés du quartier",
  "à qui s'adresser près de chez moi",
  "quelle enseigne a la meilleure réputation ici",
  "donne-moi les 3 adresses les plus recommandées",
  "où aller ce week-end près de chez moi",
  "avis clients les plus fiables du secteur",
  "compare les enseignes du coin",
  "quelle adresse est citée partout en ce moment",
] as const;

/**
 * Les questions du client, une fois sa niche lue.
 *
 * `{niche}` reste au singulier, `{niches}` est mis au pluriel, `{lieu}` porte
 * déjà sa préposition (« à Nantes », « au Havre », « en ligne ») ou vaut la
 * chaîne vide pour un commerce sans adresse. Les espaces en trop sont nettoyés
 * à la composition : une phrase reste correcte quand `{lieu}` disparaît.
 */
const NICHE_TEMPLATES: readonly string[] = [
  "{niche} {lieu}",
  "{niche} {lieu} avis",
  "{niche} {lieu} tarifs",
  "top 10 {niches} {lieu}",
  "classement des {niches} {lieu}",
  "comparatif des {niches} {lieu}",
  "avis sur les {niches} {lieu}",
  "qui recommandes-tu comme {niche} {lieu}",
  "{niche} {lieu} : que choisir",
] as const;

/**
 * Ce qu'on ne demande qu'à un commerce où l'on se rend. L'horaire et la
 * proximité n'ont pas de sens pour une boutique en ligne, et « adresse » y
 * désignerait autre chose que ce qu'on cherche.
 */
const PHYSICAL_TEMPLATES: readonly string[] = [
  "{niche} {lieu} horaires",
  "{niche} {lieu} près de moi",
  "quelle adresse pour {niche} {lieu}",
  "je cherche une adresse de {niche} {lieu}",
  "donne-moi les 3 meilleures adresses de {niche} {lieu}",
] as const;

/**
 * Le miroir en ligne : on y cherche un site et une enseigne, pas une adresse.
 * « en ligne » est déjà dit par `{lieu}`, d'où les tournures qui s'en passent.
 */
const ONLINE_TEMPLATES: readonly string[] = [
  "quel site pour {niche}",
  "je cherche un site de {niche}",
  "donne-moi les 3 meilleurs sites de {niche}",
  "{niche} : les enseignes les plus citées",
] as const;

/**
 * Le pluriel français, réduit à ce dont on a besoin.
 *
 * Une niche est un nom, parfois suivi d'un adjectif (« Garage automobile ») ou
 * d'un complément (« Restaurant de fruits de mer »). Dans le premier cas les
 * deux mots s'accordent, dans le second le complément ne bouge pas. La
 * distinction se fait sur la préposition, ce qui suffit pour les intitulés que
 * le crawl produit — et un intitulé plus tordu ressort au singulier, jamais
 * dans une forme fautive : la règle ne s'applique qu'à ce qu'elle reconnaît.
 */
function pluralWord(word: string): string {
  if (/[sxz]$/i.test(word)) return word;
  if (/(eau|eu)$/i.test(word)) return `${word}x`;
  if (/al$/i.test(word)) return `${word.slice(0, -2)}aux`;
  return `${word}s`;
}

/** Les mots qui ouvrent un complément : tout ce qui suit reste au singulier. */
const COMPLEMENT_HEADS = /^(de|des|du|d'|à|au|aux|en|pour|avec|sur|et|&)$/i;

function pluralize(niche: string): string {
  const words = niche.split(/\s+/).filter(Boolean);
  if (words.length === 0) return niche;

  const stop = words.findIndex((word, index) => index > 0 && COMPLEMENT_HEADS.test(word));
  // Un complément : seule la tête s'accorde. Sinon, nom + adjectifs s'accordent
  // ensemble — c'est le cas « Garage automobile », « Boulangerie artisanale ».
  const inflectUpTo = stop === -1 ? words.length : 1;

  return words
    .map((word, index) => (index < inflectUpTo ? pluralWord(word) : word))
    .join(" ");
}

/**
 * La niche telle qu'on la tape : en minuscules.
 *
 * Elle nous arrive capitalisée parce qu'elle sert d'étiquette ailleurs dans le
 * tableau de bord (« Restaurant de fruits de mer »). Dans une barre de
 * recherche, cette majuscule sonne faux — personne ne l'écrit. Seule la
 * première lettre descend : un sigle au milieu de l'intitulé garde le sien.
 */
function asTyped(niche: string): string {
  return niche.charAt(0).toLocaleLowerCase("fr-FR") + niche.slice(1);
}

/**
 * La ville avec sa préposition, contractions comprises.
 *
 * « à Le Havre » est la faute qui trahit une chaîne assemblée à la va-vite, et
 * elle tombe sur des villes que nos clients habitent. Seul l'article masculin
 * se contracte — « à La Rochelle » et « à L'Isle-Adam » s'écrivent tels quels,
 * article compris, parce que l'article y fait partie du nom.
 */
function placePhrase(city: string): string {
  const trimmed = city.trim();
  if (/^les\s+/i.test(trimmed)) return `aux ${trimmed.slice(4).trim()}`;
  if (/^le\s+/i.test(trimmed)) return `au ${trimmed.slice(3).trim()}`;
  return `à ${trimmed}`;
}

/**
 * Un mélange stable, tiré du nom du commerce.
 *
 * Deux clients ne lisent pas la même suite de questions, et un même client
 * relit la sienne s'il recharge la page : l'écran a l'air vivant sans jamais
 * clignoter d'un rendu à l'autre. Le générateur est un xorshift minimal — il
 * n'y a rien à sécuriser ici, seulement à rendre reproductible.
 */
function shuffle<T>(items: T[], seed: string): T[] {
  let state = 2166136261;
  for (const char of seed) {
    state ^= char.charCodeAt(0);
    state = Math.imul(state, 16777619);
  }
  const next = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return Math.abs(state) / 2147483647;
  };

  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1)) % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Recompose une phrase et absorbe le trou laissé par un `{lieu}` vide. */
function compose(
  template: string,
  values: { niche: string; niches: string; lieu: string },
): string {
  return template
    .replace("{niches}", values.niches)
    .replace("{niche}", values.niche)
    .replace("{lieu}", values.lieu)
    .replace(/\s+/g, " ")
    .replace(/\s+:/g, " :")
    .trim();
}

/**
 * Les questions à taper pendant l'attente.
 *
 * Sans niche, ce sont les questions génériques. Avec, ce sont celles du client.
 * La fonction rend toujours une liste non vide : un écran d'attente qui n'a
 * rien à écrire est un écran cassé, et le repli générique est déjà juste.
 *
 * À qui la question est posée ne se décide pas ici : l'écran fait tourner les
 * moteurs sur la liste qu'il reçoit. Ce module écrit des questions, il ne
 * distribue pas le travail.
 */
export function buildLoadingPrompts(business: BusinessHint): string[] {
  const niche = business.niche?.trim();
  if (!niche) return shuffle([...BASE_PROMPTS], "generique");

  const city = business.isPhysical ? business.city?.trim() : null;
  const values = {
    niche: asTyped(niche),
    niches: asTyped(pluralize(niche)),
    lieu: city ? placePhrase(city) : business.isPhysical ? "" : "en ligne",
  };

  const templates = business.isPhysical
    ? [...NICHE_TEMPLATES, ...PHYSICAL_TEMPLATES]
    : [...NICHE_TEMPLATES, ...ONLINE_TEMPLATES];

  const texts = templates.map((template) => compose(template, values));
  return shuffle(texts, `${niche}|${city ?? ""}`);
}
