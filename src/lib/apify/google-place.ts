import "server-only";

import { runActorSync } from "./client";
import { normalizeMapsUrl } from "@/lib/geo/maps";
import type {
  GooglePlace,
  PlaceAttributeGroup,
  PlaceHours,
  PlacePopularDay,
  PlaceReview,
  PlaceSimilar,
  PlaceUpdate,
} from "./place-types";

/**
 * La fiche Google Maps d'un commerce, relevée chez Google via Apify.
 *
 * Google monte sa fiche en JavaScript : le HTML brut ne porte ni les avis, ni
 * les horaires, ni les attributs. L'acteur `compass/crawler-google-places` ouvre
 * la page comme un navigateur et rend la fiche entière ; on la range ensuite
 * dans notre vocabulaire (voir `place-types.ts`) pour que l'affichage ne dépende
 * jamais des noms de champs du scraper.
 */

const ACTOR_ID = "compass~crawler-google-places";

/** Ce qu'on demande à Apify : une fiche, en français, avec ses avis et ses photos. */
const MAX_REVIEWS = 8;
const MAX_IMAGES = 12;

/** L'ordre des jours à l'affichage : lundi d'abord, comme sur une porte de commerce. */
const DAY_ORDER = [
  "lundi",
  "mardi",
  "mercredi",
  "jeudi",
  "vendredi",
  "samedi",
  "dimanche",
];

/** Les clés du graphique d'affluence chez Google, dans l'ordre lundi → dimanche. */
const POPULAR_DAYS: { key: string; day: string }[] = [
  { key: "Mo", day: "lundi" },
  { key: "Tu", day: "mardi" },
  { key: "We", day: "mercredi" },
  { key: "Th", day: "jeudi" },
  { key: "Fr", day: "vendredi" },
  { key: "Sa", day: "samedi" },
  { key: "Su", day: "dimanche" },
];

/** La forme brute rendue par l'acteur, réduite aux champs qu'on lit. */
type RawPlace = {
  title?: string | null;
  subTitle?: string | null;
  description?: string | null;
  ownerDescription?: string | null;
  categoryName?: string | null;
  categories?: string[] | null;
  price?: string | null;
  address?: string | null;
  street?: string | null;
  city?: string | null;
  postalCode?: string | null;
  countryCode?: string | null;
  plusCode?: string | null;
  location?: { lat?: number; lng?: number } | null;
  website?: string | null;
  phone?: string | null;
  menu?: string | null;
  reserveTableUrl?: string | null;
  googleFoodUrl?: string | null;
  url?: string | null;
  placeId?: string | null;
  cid?: string | null;
  totalScore?: number | null;
  reviewsCount?: number | null;
  reviewsDistribution?: Record<string, number> | null;
  reviewsTags?: { title?: string; count?: number }[] | null;
  imageUrl?: string | null;
  imageUrls?: string[] | null;
  imagesCount?: number | null;
  openingHours?: { day?: string; hours?: string }[] | null;
  popularTimesHistogram?: Record<string, { hour?: number; occupancyPercent?: number }[]> | null;
  popularTimesLiveText?: string | null;
  popularTimesLivePercent?: number | null;
  additionalInfo?: Record<string, Record<string, boolean>[]> | null;
  reviews?: RawReview[] | null;
  peopleAlsoSearch?: { title?: string; category?: string; totalScore?: number; reviewsCount?: number }[] | null;
  ownerUpdates?: { text?: string; postDate?: string; images?: string[] }[] | null;
  permanentlyClosed?: boolean | null;
  temporarilyClosed?: boolean | null;
  claimThisBusiness?: boolean | null;
  scrapedAt?: string | null;
};

type RawReview = {
  reviewId?: string;
  name?: string;
  reviewerPhotoUrl?: string | null;
  isLocalGuide?: boolean;
  reviewerNumberOfReviews?: number | null;
  stars?: number | null;
  rating?: number | null;
  text?: string | null;
  textTranslated?: string | null;
  publishedAtDate?: string | null;
  publishAt?: string | null;
  likesCount?: number | null;
  reviewImageUrls?: string[] | null;
  responseFromOwnerText?: string | null;
  responseFromOwnerDate?: string | null;
  reviewContext?: Record<string, string | null> | null;
};

function text(value: unknown): string | null {
  const s = typeof value === "string" ? value.trim() : "";
  return s.length > 0 ? s : null;
}

function count(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Apify écrit les créneaux à l'anglaise : « 10:30 to 15:00, 18:00 to 23:30 ».
 * On rend le tiret demi-cadratin français et on repère les jours fermés.
 */
function normalizeHours(raw: RawPlace["openingHours"]): PlaceHours[] {
  const rows = (raw ?? [])
    .map((entry) => {
      const day = text(entry?.day);
      const hours = text(entry?.hours);
      if (!day) return null;
      const closed = hours === null || /^ferm/i.test(hours) || /^closed$/i.test(hours);
      return {
        day: day.toLowerCase(),
        hours: closed ? "Fermé" : hours!.replace(/\s+to\s+/gi, "–"),
        closed,
      } satisfies PlaceHours;
    })
    .filter((row): row is PlaceHours => row !== null);

  // Google commence la liste au jour du relevé ; on la remet lundi d'abord.
  const rank = (day: string) => {
    const index = DAY_ORDER.indexOf(day);
    return index === -1 ? DAY_ORDER.length : index;
  };
  return rows.sort((a, b) => rank(a.day) - rank(b.day));
}

/**
 * Les attributs arrivent en groupes de paires : `{ "Accessibilité": [{ "…": true }] }`.
 * On les aplatit en listes lisibles, en gardant l'ordre de Google — c'est celui
 * que le commerçant retrouvera dans son back-office.
 */
function normalizeAttributes(raw: RawPlace["additionalInfo"]): PlaceAttributeGroup[] {
  if (!raw || typeof raw !== "object") return [];

  return Object.entries(raw)
    .map(([label, entries]) => {
      const items = (Array.isArray(entries) ? entries : [])
        .flatMap((entry) => Object.entries(entry ?? {}))
        .map(([itemLabel, available]) => ({
          label: itemLabel,
          available: available === true,
        }));

      // Google répète parfois deux fois le même attribut dans un groupe.
      const seen = new Set<string>();
      const unique = items.filter((item) => {
        if (seen.has(item.label)) return false;
        seen.add(item.label);
        return true;
      });

      return { label, items: unique };
    })
    .filter((group) => group.items.length > 0);
}

/**
 * La même photo revient souvent deux fois dans le relevé, à deux tailles :
 * `imageUrl` sans suffixe et `imageUrls[0]` en `=w1920-h1080-k-no`. On compare
 * donc les adresses sans leur suffixe de dimensions.
 */
function dedupePhotos(urls: (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const url of urls) {
    if (typeof url !== "string" || url.length === 0) continue;
    const base = url.replace(/=[a-z0-9-]*$/i, "");
    if (seen.has(base)) continue;
    seen.add(base);
    out.push(url);
  }
  return out;
}

function normalizePopularTimes(raw: RawPlace["popularTimesHistogram"]): PlacePopularDay[] {
  if (!raw || typeof raw !== "object") return [];

  // Les sept jours, même ceux sans mesure : un lundi de fermeture est une
  // information, et une semaine à cinq lignes se lirait comme un bug.
  const days = POPULAR_DAYS.map(({ key, day }) => ({
    day,
    hours: (raw[key] ?? [])
      .map((slot) => ({
        hour: count(slot?.hour) ?? 0,
        percent: count(slot?.occupancyPercent) ?? 0,
      }))
      .sort((a, b) => a.hour - b.hour),
  }));

  return days.some((entry) => entry.hours.length > 0) ? days : [];
}

function normalizeReviews(raw: RawPlace["reviews"]): PlaceReview[] {
  return (raw ?? [])
    .slice(0, MAX_REVIEWS)
    .map((review, index) => ({
      id: text(review?.reviewId) ?? `review-${index}`,
      name: text(review?.name) ?? "Client Google",
      photo: text(review?.reviewerPhotoUrl),
      localGuide: review?.isLocalGuide === true,
      reviewerCount: count(review?.reviewerNumberOfReviews),
      stars: count(review?.stars) ?? count(review?.rating) ?? 0,
      text: text(review?.text) ?? text(review?.textTranslated),
      publishedAt: text(review?.publishedAtDate),
      relative: text(review?.publishAt),
      likes: count(review?.likesCount) ?? 0,
      images: (review?.reviewImageUrls ?? []).filter((url): url is string => typeof url === "string"),
      ownerResponse: text(review?.responseFromOwnerText),
      ownerResponseAt: text(review?.responseFromOwnerDate),
      context: Object.entries(review?.reviewContext ?? {})
        .map(([label, value]) => ({ label, value: text(value) ?? "" }))
        .filter((entry) => entry.value.length > 0),
    }))
    .filter((review) => review.stars > 0);
}

function normalizeSimilar(raw: RawPlace["peopleAlsoSearch"]): PlaceSimilar[] {
  return (raw ?? [])
    .map((entry) => ({
      title: text(entry?.title) ?? "",
      category: text(entry?.category),
      rating: count(entry?.totalScore),
      reviewsCount: count(entry?.reviewsCount),
    }))
    .filter((entry) => entry.title.length > 0);
}

function normalizeUpdates(raw: RawPlace["ownerUpdates"]): PlaceUpdate[] {
  return (raw ?? [])
    .map((entry) => ({
      text: text(entry?.text) ?? "",
      date: text(entry?.postDate),
      images: (entry?.images ?? []).filter((url): url is string => typeof url === "string"),
    }))
    .filter((entry) => entry.text.length > 0);
}

/** Range la réponse brute de l'acteur dans le vocabulaire de l'application. */
export function normalizePlace(raw: RawPlace): GooglePlace | null {
  const title = text(raw.title);
  if (!title) return null;

  const distribution = raw.reviewsDistribution ?? null;
  const images = dedupePhotos([raw.imageUrl, ...(raw.imageUrls ?? [])]).slice(0, MAX_IMAGES);

  return {
    title,
    subtitle: text(raw.subTitle),
    description: text(raw.description),
    ownerDescription: text(raw.ownerDescription),

    category: text(raw.categoryName),
    categories: (raw.categories ?? []).filter((c): c is string => typeof c === "string"),
    price: text(raw.price),

    address: text(raw.address),
    street: text(raw.street),
    city: text(raw.city),
    postalCode: text(raw.postalCode),
    countryCode: text(raw.countryCode),
    plusCode: text(raw.plusCode),
    location:
      count(raw.location?.lat) !== null && count(raw.location?.lng) !== null
        ? { lat: raw.location!.lat!, lng: raw.location!.lng! }
        : null,

    website: text(raw.website),
    phone: text(raw.phone),
    menuUrl: text(raw.menu),
    reserveUrl: text(raw.reserveTableUrl),
    orderUrl: text(raw.googleFoodUrl),

    mapsUrl: text(raw.url),
    placeId: text(raw.placeId),
    cid: text(raw.cid),

    rating: count(raw.totalScore),
    reviewsCount: count(raw.reviewsCount),
    reviewsDistribution: distribution
      ? {
          one: count(distribution.oneStar) ?? 0,
          two: count(distribution.twoStar) ?? 0,
          three: count(distribution.threeStar) ?? 0,
          four: count(distribution.fourStar) ?? 0,
          five: count(distribution.fiveStar) ?? 0,
        }
      : null,
    reviewsTags: (raw.reviewsTags ?? [])
      .map((tag) => ({ title: text(tag?.title) ?? "", count: count(tag?.count) ?? 0 }))
      .filter((tag) => tag.title.length > 0),

    images,
    imagesCount: count(raw.imagesCount),

    openingHours: normalizeHours(raw.openingHours),
    popularTimes: normalizePopularTimes(raw.popularTimesHistogram),
    popularNow:
      text(raw.popularTimesLiveText) !== null
        ? { text: raw.popularTimesLiveText!.trim(), percent: count(raw.popularTimesLivePercent) ?? 0 }
        : null,

    attributes: normalizeAttributes(raw.additionalInfo),
    reviews: normalizeReviews(raw.reviews),
    similar: normalizeSimilar(raw.peopleAlsoSearch),
    updates: normalizeUpdates(raw.ownerUpdates),

    permanentlyClosed: raw.permanentlyClosed === true,
    temporarilyClosed: raw.temporarilyClosed === true,
    claimed: raw.claimThisBusiness !== true,

    scrapedAt: text(raw.scrapedAt) ?? new Date().toISOString(),
  };
}

/**
 * Relève la fiche Google Maps derrière un lien.
 *
 * Le lien vient du client, saisi à l'accueil : lien long de fiche, lien court
 * de partage, peu importe — l'acteur suit les redirections. On lui demande une
 * seule fiche, en français, pour ne pas payer un balayage de quartier.
 *
 * Rend `null` si le lien est invalide ou si l'acteur ne trouve rien ; lève une
 * `ApifyError` si l'appel lui-même échoue, pour que l'écran puisse distinguer
 * « fiche introuvable » de « scraper en panne ».
 */
export async function fetchGooglePlace(mapsUrl: string): Promise<GooglePlace | null> {
  let target: string | null;
  try {
    target = normalizeMapsUrl(mapsUrl);
  } catch {
    return null;
  }
  if (!target) return null;

  const items = await runActorSync<RawPlace>(ACTOR_ID, {
    startUrls: [{ url: target }],
    language: "fr",
    maxCrawledPlacesPerSearch: 1,
    maxReviews: MAX_REVIEWS,
    maxImages: MAX_IMAGES,
    maxQuestions: 0,
    scrapeReviewerName: true,
    scrapeReviewsPersonalData: true,
    reviewsSort: "newest",
    skipClosedPlaces: false,
  });

  const first = items.find((item) => text(item?.title) !== null);
  return first ? normalizePlace(first) : null;
}
