/**
 * Le rythme auquel les articles partent, et les heures qu'on laisse choisir.
 *
 * Ce fichier existe pour une seule raison : ne pas mentir sur l'heure. La file
 * de publication (`features/dashboard/publish-queue`) ne tourne pas en continu
 * — elle est réveillée par la tâche planifiée décrite dans `vercel.json`. Un
 * article daté de 14 h ne part donc pas à 14 h : il part au premier passage
 * qui suit. Tant que l'interface calculait « 14 h » et que la tâche passait une
 * fois par jour à 8 h, elle annonçait une heure fausse de vingt-deux heures.
 *
 * `PUBLISH_PASS_MINUTES` décrit ce que fait réellement `vercel.json` : les deux
 * se lisent ensemble, et l'un change avec l'autre. L'interface s'en sert pour
 * dire le moment du départ, pas celui de la consigne.
 */

/**
 * L'intervalle entre deux passages de la file, en minutes.
 *
 * Un jour : l'hébergement est en formule Hobby chez Vercel, qui n'accepte
 * qu'une tâche planifiée quotidienne. C'est la contrainte, et tout ce fichier
 * en découle — à commencer par le fait que l'heure de publication ne se
 * choisit pas (voir `PUBLISH_HOUR_IS_CHOSEN`).
 *
 * À tenir d'accord avec le champ `crons` de `vercel.json`. Le jour où
 * l'hébergement accepte un passage par heure, ces deux valeurs passent à 60 et
 * 0 : le sélecteur d'heure réapparaît de lui-même et les écrans annoncent le
 * bon moment, sans autre correction.
 */
export const PUBLISH_PASS_MINUTES = 1440;

/**
 * À quelle minute après minuit UTC tombe le passage.
 *
 * Huit heures — l'expression `0 8 * * *` de `vercel.json`. Sans ce décalage, on
 * calculerait les passages sur les multiples de minuit et l'on annoncerait
 * minuit à des articles qui partent le matin : à un passage par jour, l'oubli
 * se paie de huit heures d'erreur sur chaque date affichée.
 */
export const PUBLISH_PASS_OFFSET_MINUTES = 8 * 60;

/**
 * L'heure de publication se choisit-elle ?
 *
 * Seulement s'il y a plus d'un passage par jour. Sinon la question n'a pas de
 * réponse honnête : l'article partira au passage suivant quelle que soit
 * l'heure demandée, et un sélecteur d'heure ne serait qu'un décor qui promet
 * une maîtrise que le système n'a pas. On ne fait donc choisir que le jour, et
 * l'écran annonce l'heure au lieu de la demander.
 */
export const PUBLISH_HOUR_IS_CHOSEN = PUBLISH_PASS_MINUTES < 1440;

/**
 * Les heures proposées au client quand il planifie un article.
 *
 * De 6 h à 20 h : personne ne choisit de publier à 3 h du matin, et une liste
 * de vingt-quatre entrées se parcourt moins vite qu'elle ne se lit. Les heures
 * pleines seulement — la file ne passe pas plus finement que l'heure, et
 * proposer 14 h 30 promettrait une précision qui n'existe pas.
 *
 * Inemployées tant que `PUBLISH_HOUR_IS_CHOSEN` est faux, et gardées pour ce
 * jour-là.
 */
export const PUBLISH_HOURS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20] as const;

/**
 * L'heure que l'on vise, faute d'en choisir une.
 *
 * Ce n'est pas l'heure du départ mais celle qu'on souhaite : le départ est le
 * passage qui suit (`preferredPassOnDay`). Neuf heures — le moment où un
 * planning éditorial se lit comme un agenda.
 */
export const PUBLISH_DEFAULT_HOUR = 9;

/**
 * Le fuseau dans lequel les dates de publication se lisent et s'écrivent.
 *
 * Le serveur tourne en UTC et le client est en France : sans fuseau explicite,
 * la même date s'afficherait à 9 h au rendu serveur et à 11 h après hydratation,
 * et le client verrait l'heure bouger sous ses yeux. Toutes les mises en forme
 * de ce produit passent donc par ce fuseau, des deux côtés.
 */
export const PUBLISH_TIME_ZONE = "Europe/Paris";

/**
 * Le moment où un article daté de `scheduledFor` partira réellement.
 *
 * C'est-à-dire le premier passage de la file au niveau ou au-delà de cette
 * date. Une date déjà passée ressort au prochain passage à venir, ce qui est
 * exactement ce que la file fera : elle rattrape son retard.
 */
export function nextPublishPass(scheduledFor: Date, now: Date = new Date()): Date {
  return alignToPass(scheduledFor > now ? scheduledFor : now);
}

/**
 * Le passage de la file au niveau ou au-delà d'un instant, sans regarder l'heure
 * qu'il est.
 *
 * C'est la variante que les composants du navigateur doivent employer.
 * `nextPublishPass` dépend de « maintenant », et « maintenant » n'est pas le
 * même au rendu du serveur et à l'hydratation : une vignette de calendrier
 * afficherait une heure puis une autre. Ici, la même date donne toujours la
 * même réponse — au prix de ne pas dire le rattrapage d'un retard, ce que le
 * calendrier n'a de toute façon pas à annoncer.
 */
export function alignToPass(at: Date): Date {
  const step = PUBLISH_PASS_MINUTES * 60_000;
  const offset = PUBLISH_PASS_OFFSET_MINUTES * 60_000;
  // Les passages tombent tous les `step`, décalés de `offset` après minuit UTC :
  // c'est la lecture d'une expression cron à heure et minute fixes.
  return new Date(Math.ceil((at.getTime() - offset) / step) * step + offset);
}

/**
 * Le départ que vaut un jour choisi au calendrier.
 *
 * On vise l'heure de publication souhaitée sur ce jour-là, puis on prend le
 * passage qui suit. À un passage quotidien, cela tombe sur ce passage-là même —
 * le client choisit un jour, l'article part ce jour-là. À un passage horaire,
 * cela tombe sur l'heure souhaitée elle-même. La même fonction sert donc les
 * deux cadences, et c'est elle qui date aussi les articles du planning
 * automatique : un sujet posé par les agents et un sujet daté à la main partent
 * au même moment de la journée.
 */
export function preferredPassOnDay(day: string): string {
  return alignToPass(new Date(toPublishInstant(day, PUBLISH_DEFAULT_HOUR))).toISOString();
}

/**
 * La date d'un départ, écrite comme on la dit : « mardi 8 septembre ».
 *
 * Le fuseau est explicite des deux côtés du rendu. Sans lui, le serveur —
 * en UTC — et le navigateur — en heure de Paris — composeraient deux phrases
 * différentes pour le même instant, et React remplacerait l'une par l'autre
 * sous les yeux du client.
 */
export function formatPublishDate(at: Date): string {
  return at.toLocaleDateString("fr-FR", {
    timeZone: PUBLISH_TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** L'heure d'un départ : « 09:00 », en chiffres qui s'alignent. */
export function formatPublishTime(at: Date): string {
  return at.toLocaleTimeString("fr-FR", {
    timeZone: PUBLISH_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Combien de jours séparent aujourd'hui d'un départ.
 *
 * En jours de calendrier, pas en tranches de vingt-quatre heures : un article
 * qui part demain à 8 h est « demain », même s'il n'est qu'à quatorze heures
 * d'ici. C'est ainsi qu'on lit un agenda.
 *
 * Négatif quand la date est passée — la file a du retard, ou l'article vient
 * d'être daté dans le passé.
 */
export function publishDayGap(at: Date, now: Date = new Date()): number {
  const day = (value: Date) => {
    const { day: iso } = splitPublishInstant(value.toISOString());
    const [year, month, date] = iso.split("-").map(Number);
    return Date.UTC(year, month - 1, date);
  };
  return Math.round((day(at) - day(now)) / 86_400_000);
}

/**
 * Le décalage du fuseau de publication par rapport à UTC, à un instant donné.
 *
 * Passé par `Intl` plutôt que codé en dur : la France change d'heure deux fois
 * l'an, et « +1 » planifierait tout l'été une heure trop tôt. Le procédé est
 * celui de la bibliothèque standard — on demande au fuseau ce que l'instant y
 * affiche, on relit ce cadran comme s'il était UTC, et l'écart est le décalage.
 */
function zoneOffsetMinutes(at: Date): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: PUBLISH_TIME_ZONE,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(at)
      .map((part) => [part.type, part.value]),
  );

  // `hour12: false` rend minuit « 24 » sur certains moteurs : le ramener à 0
  // évite un décalage d'un jour sur les publications de nuit.
  const hour = Number(parts.hour) % 24;
  const shown = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    hour,
    Number(parts.minute),
  );

  return (shown - Math.floor(at.getTime() / 60_000) * 60_000) / 60_000;
}

/**
 * L'instant que désignent un jour (« 2026-09-08 ») et une heure pleine, lus
 * dans le fuseau de publication.
 *
 * Deux passes, et ce n'est pas de la prudence gratuite : le décalage se lit à
 * un instant, et l'instant dépend du décalage. Le dernier dimanche de mars, la
 * première estimation tombe du mauvais côté du changement d'heure ; la seconde
 * la corrige.
 */
export function toPublishInstant(day: string, hour: number): string {
  const [year, month, date] = day.split("-").map(Number);
  const naive = Date.UTC(year, month - 1, date, hour);

  let instant = naive - zoneOffsetMinutes(new Date(naive)) * 60_000;
  instant = naive - zoneOffsetMinutes(new Date(instant)) * 60_000;

  return new Date(instant).toISOString();
}

/**
 * Le jour et l'heure d'un instant, tels que le formulaire doit les afficher.
 *
 * L'heure est arrondie à l'heure pleine la plus proche vers le bas : le champ
 * ne propose que des heures pleines, et une valeur absente de la liste
 * afficherait un sélecteur vide sur une date pourtant posée.
 */
export function splitPublishInstant(iso: string): { day: string; hour: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: PUBLISH_TIME_ZONE,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
    })
      .formatToParts(new Date(iso))
      .map((part) => [part.type, part.value]),
  );

  return {
    day: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour) % 24,
  };
}

/**
 * Le décalage entre la consigne du client et le départ effectif, en minutes.
 *
 * Zéro quand les deux coïncident, ce qui est le cas courant à un passage par
 * heure sur une date posée à l'heure pleine. L'interface ne mentionne l'écart
 * que lorsqu'il existe — annoncer « départ à 9 h (prévu 9 h) » n'apprendrait
 * rien à personne.
 */
export function publishLagMinutes(scheduledFor: Date, now: Date = new Date()): number {
  return Math.round(
    (nextPublishPass(scheduledFor, now).getTime() - Math.max(scheduledFor.getTime(), now.getTime())) /
      60_000,
  );
}
