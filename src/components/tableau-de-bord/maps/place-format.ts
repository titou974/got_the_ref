import type { GooglePlace, PlaceHours } from "@/lib/apify/place-types";

/**
 * Les petites mises en forme de la fiche : chiffres à la française, étoiles,
 * et la ligne d'ouverture que Google écrit en tête de sa fiche.
 *
 * Fonctions pures, sans dépendance au serveur ni au navigateur : la fiche les
 * appelle côté client pour l'heure courante, les cartes d'analyse côté serveur
 * pour les chiffres.
 */

export const FRENCH_DAYS = [
  "lundi",
  "mardi",
  "mercredi",
  "jeudi",
  "vendredi",
  "samedi",
  "dimanche",
] as const;

/**
 * « 2 808 », avec l'espace insécable des nombres français.
 *
 * `Intl` sépare les milliers par une espace fine insécable (U+202F) que
 * beaucoup de polices rendent quasi invisible : « 2808 ». On la remplace par
 * l'espace insécable ordinaire, qui se voit.
 */
export function formatCount(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("fr-FR").format(value).replace(/ /g, " ");
}

/** « 4,7 » — une décimale, virgule française. */
export function formatRating(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return value.toFixed(1).replace(".", ",");
}

/** La forme de chaque étoile pour une note donnée : pleine, moitié, vide. */
export function starShapes(rating: number | null): ("full" | "half" | "empty")[] {
  const value = rating ?? 0;
  return [0, 1, 2, 3, 4].map((index) => {
    const remaining = value - index;
    if (remaining >= 0.75) return "full";
    if (remaining >= 0.25) return "half";
    return "empty";
  });
}

/** Le nom français du jour d'une date, tel qu'il figure dans les horaires. */
export function dayName(date: Date): string {
  return FRENCH_DAYS[(date.getDay() + 6) % 7];
}

type Slot = { start: number; end: number };

/** « 10:30–15:00, 18:00–23:30 » → deux créneaux exprimés en minutes. */
function parseSlots(hours: string): Slot[] {
  if (/24\s*h|24\/7|ouvert 24/i.test(hours)) return [{ start: 0, end: 1440 }];

  return hours
    .split(",")
    .map((part) => part.trim().match(/(\d{1,2})[:h](\d{2})\s*[–\-—]\s*(\d{1,2})[:h](\d{2})/))
    .filter((match): match is RegExpMatchArray => match !== null)
    .map((match) => {
      const start = Number(match[1]) * 60 + Number(match[2]);
      let end = Number(match[3]) * 60 + Number(match[4]);
      // Un service qui finit après minuit : « 18:00–01:30 ».
      if (end <= start) end += 1440;
      return { start, end };
    });
}

/** « 630 » → « 10:30 », l'écriture des horaires chez Google. */
function formatMinutes(minutes: number): string {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export type OpenState = {
  status: "open" | "closed" | "permanently-closed" | "temporarily-closed" | "unknown";
  /** Le mot d'état : « Ouvert », « Fermé », « Fermé définitivement ». */
  label: string;
  /** Ce que Google ajoute après le point médian : « Ferme à 15:00 ». */
  detail: string | null;
};

/**
 * L'état d'ouverture à un instant donné, dans la formulation de Google.
 *
 * L'heure de référence est celle du navigateur : le commerçant qui consulte sa
 * fiche est à son commerce, ou dans son fuseau. Google ne dit pas autre chose,
 * et le relevé Apify ne porte pas le fuseau de l'établissement.
 */
export function openState(place: GooglePlace, now: Date): OpenState {
  if (place.permanentlyClosed) {
    return { status: "permanently-closed", label: "Définitivement fermé", detail: null };
  }
  if (place.temporarilyClosed) {
    return { status: "temporarily-closed", label: "Temporairement fermé", detail: null };
  }
  if (place.openingHours.length === 0) {
    return { status: "unknown", label: "Horaires non renseignés", detail: null };
  }

  const byDay = new Map<string, PlaceHours>(place.openingHours.map((row) => [row.day, row]));
  const today = byDay.get(dayName(now));
  const minutes = now.getHours() * 60 + now.getMinutes();

  // La veille peut déborder sur aujourd'hui : un service jusqu'à 01:30.
  const yesterday = byDay.get(dayName(new Date(now.getTime() - 86_400_000)));
  const spillover = (yesterday && !yesterday.closed ? parseSlots(yesterday.hours) : [])
    .filter((slot) => slot.end > 1440)
    .map((slot) => ({ start: slot.start - 1440, end: slot.end - 1440 }));

  const slots = [...spillover, ...(today && !today.closed ? parseSlots(today.hours) : [])];
  const current = slots.find((slot) => minutes >= slot.start && minutes < slot.end);

  if (current) {
    const next = slots.find((slot) => slot.start >= current.end);
    return {
      status: "open",
      label: "Ouvert",
      detail: next
        ? `Ferme à ${formatMinutes(current.end)} · Rouvre à ${formatMinutes(next.start)}`
        : `Ferme à ${formatMinutes(current.end)}`,
    };
  }

  const later = slots.find((slot) => slot.start > minutes);
  if (later) {
    return { status: "closed", label: "Fermé", detail: `Ouvre à ${formatMinutes(later.start)}` };
  }

  // Rien aujourd'hui : on cherche le prochain jour ouvert dans la semaine.
  for (let step = 1; step <= 7; step += 1) {
    const date = new Date(now.getTime() + step * 86_400_000);
    const row = byDay.get(dayName(date));
    if (!row || row.closed) continue;
    const [first] = parseSlots(row.hours);
    if (!first) continue;
    const when = step === 1 ? "demain" : row.day;
    return {
      status: "closed",
      label: "Fermé",
      detail: `Ouvre ${when} à ${formatMinutes(first.start)}`,
    };
  }

  return { status: "closed", label: "Fermé", detail: null };
}

/**
 * La même photo Google, demandée à la taille où on l'affiche.
 *
 * Le CDN de Google porte ses dimensions dans l'adresse — `…=w1920-h1080-k-no`.
 * Le relevé les donne en pleine résolution ; les servir telles quelles à un
 * panneau de 400 pixels, c'est charger deux mégaoctets pour une vignette, et
 * Google finit par refuser les rafales. On réécrit donc le suffixe.
 */
export function photoAt(url: string, width: number, height: number): string {
  const size = `=w${width}-h${height}-k-no`;
  return /=[a-z0-9-]*$/i.test(url) ? url.replace(/=[a-z0-9-]*$/i, size) : `${url}${size}`;
}

/**
 * L'avatar d'un auteur d'avis, à la taille voulue.
 *
 * Les photos de profil Google portent un suffixe d'une autre famille que les
 * photos de lieux — `=s1920-c-rp-mo-br100`, où `s` est le côté du carré et `c`
 * le recadrage. On garde cette grammaire plutôt que d'y coller celle des lieux.
 */
export function avatarAt(url: string, size: number): string {
  return /=[a-z0-9-]*$/i.test(url) ? url.replace(/=[a-z0-9-]*$/i, `=s${size}-c`) : `${url}=s${size}-c`;
}

/** Le nom d'hôte d'un site, sans « www. » — ce que Google affiche sur la fiche. */
export function displayHost(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");
  }
}

/** Le lien d'itinéraire Google Maps vers l'établissement. */
export function directionsUrl(place: GooglePlace): string {
  const query = place.address ?? place.title;
  const base = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`;
  return place.placeId ? `${base}&destination_place_id=${place.placeId}` : base;
}
