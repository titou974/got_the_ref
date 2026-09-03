import { RiCheckLine, RiCloseLine } from "@remixicon/react";
import type { GooglePlace } from "@/lib/apify/place-types";
import { Card, CardTitle } from "../Card";
import { formatCount } from "./place-format";

/**
 * Ce que le tableau de bord lit dans la fiche, à côté de la fiche elle-même.
 *
 * Le panneau de gauche montre la fiche telle que Google la donne à voir ; ces
 * cartes-là disent ce qu'il faudrait y changer. Elles gardent donc la palette du
 * tableau de bord — pas une goutte du bleu Google, qui reste au panneau — et ne
 * répètent jamais un chiffre déjà lisible à côté.
 */

type Check = { label: string; ok: boolean; detail: string };

/**
 * Les champs qu'une fiche Google Business Profile peut porter, et ceux que
 * celle-ci porte vraiment. Rien d'estimé : chaque ligne se vérifie dans le
 * relevé, et se corrige dans le back-office Google en quelques minutes.
 */
export function placeChecks(place: GooglePlace): Check[] {
  const openDays = place.openingHours.filter((row) => !row.closed).length;
  const answered = place.reviews.filter((review) => review.ownerResponse !== null).length;
  const photos = place.imagesCount ?? place.images.length;

  return [
    {
      label: "Fiche revendiquée",
      ok: place.claimed,
      detail: place.claimed ? "Vous en êtes propriétaire" : "Google la propose encore à qui la veut",
    },
    {
      label: "Photos",
      ok: photos >= 10,
      detail: photos > 0 ? `${formatCount(photos)} en ligne` : "Aucune photo",
    },
    {
      label: "Présentation du commerce",
      ok: place.ownerDescription !== null,
      detail: place.ownerDescription
        ? `${place.ownerDescription.length} caractères`
        : "Texte non rédigé",
    },
    {
      label: "Horaires",
      ok: place.openingHours.length === 7,
      detail:
        place.openingHours.length === 7
          ? `${openDays} jours d'ouverture`
          : "Semaine incomplète",
    },
    {
      label: "Site web",
      ok: place.website !== null,
      detail: place.website ? "Renseigné" : "Aucun lien",
    },
    {
      label: "Téléphone",
      ok: place.phone !== null,
      detail: place.phone ?? "Aucun numéro",
    },
    {
      label: "Menu ou réservation",
      ok: place.menuUrl !== null || place.reserveUrl !== null || place.orderUrl !== null,
      detail:
        place.menuUrl || place.reserveUrl || place.orderUrl ? "Lien en place" : "Aucun lien",
    },
    {
      label: "Attributs",
      ok: place.attributes.length >= 5,
      detail: `${place.attributes.length} groupes renseignés`,
    },
    {
      label: "Réponses aux avis",
      ok: place.reviews.length > 0 && answered >= Math.ceil(place.reviews.length / 2),
      detail:
        place.reviews.length > 0
          ? `${answered} sur les ${place.reviews.length} derniers avis`
          : "Aucun avis relevé",
    },
    {
      label: "Posts sur la fiche",
      ok: place.updates.length > 0,
      detail: place.updates.length > 0 ? "Au moins un post publié" : "Aucun post publié",
    },
  ];
}

/** La carte de complétude : ce qui est en place, ce qui manque, et le compte. */
export function PlaceCompleteness({ place }: { place: GooglePlace }) {
  const checks = placeChecks(place);
  const done = checks.filter((check) => check.ok).length;

  return (
    <Card>
      <CardTitle
        title="Complétude de la fiche"
        hint="Les champs que Google propose, et ceux que votre fiche remplit."
        action={
          <span className="rounded-xl bg-mist px-3 py-1 text-sm font-semibold tabular-nums">
            {done}/{checks.length}
          </span>
        }
      />

      <ul className="divide-y divide-border">
        {checks.map((check) => (
          <li key={check.label} className="flex items-center justify-between gap-3 py-2.5">
            <span className="flex min-w-0 items-center gap-2.5">
              {check.ok ? (
                <RiCheckLine size={16} className="shrink-0 text-success" />
              ) : (
                <RiCloseLine size={16} className="shrink-0 text-danger" />
              )}
              <span className="truncate text-sm">{check.label}</span>
            </span>
            <span className="shrink-0 text-xs text-muted">{check.detail}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/**
 * L'affluence de la semaine, en bande de chaleur.
 *
 * Google la donne heure par heure et jour par jour ; on la rend d'un bloc
 * plutôt qu'un jour à la fois, parce que ce qui se lit ici est un rythme —
 * le creux du lundi, le pic du samedi soir — et non une valeur ponctuelle.
 */
export function PlacePopularTimes({ place }: { place: GooglePlace }) {
  if (place.popularTimes.length === 0) return null;

  // On coupe la nuit : les heures où tout est à zéro n'apprennent rien.
  const hours = Array.from({ length: 17 }, (_, index) => index + 7);

  return (
    <Card>
      <CardTitle
        title="Affluence relevée par Google"
        hint="Le rythme de la semaine, tel que Google le mesure sur les téléphones."
        action={
          place.popularNow ? (
            <span className="rounded-xl bg-mist px-3 py-1 text-xs font-medium">
              {place.popularNow.text}
            </span>
          ) : undefined
        }
      />

      <div className="overflow-x-auto">
        <table className="w-full min-w-[380px] border-separate border-spacing-y-1">
          <thead>
            <tr>
              <th className="w-16" />
              {hours.map((hour) => (
                <th
                  key={hour}
                  className="pb-1 text-[10px] font-normal tabular-nums text-muted"
                  scope="col"
                >
                  {hour % 3 === 0 ? hour : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {place.popularTimes.map((day) => {
              const byHour = new Map(day.hours.map((slot) => [slot.hour, slot.percent]));
              return (
                <tr key={day.day}>
                  <th
                    scope="row"
                    className="pr-2 text-left text-xs font-normal capitalize text-muted"
                  >
                    {day.day.slice(0, 3)}
                  </th>
                  {hours.map((hour) => {
                    const percent = byHour.get(hour) ?? 0;
                    return (
                      <td key={hour} className="px-px">
                        <span
                          title={`${day.day} ${hour}h — ${percent} %`}
                          className="block h-4 rounded-[3px] bg-obsidian"
                          style={{ opacity: percent === 0 ? 0.06 : 0.15 + (percent / 100) * 0.85 }}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/**
 * Les mots que les clients répètent dans les avis.
 *
 * Google les compte lui-même : ce sont, mot pour mot, les termes sur lesquels
 * la fiche est déjà associée à quelque chose. Ils font de bons mots-clés de
 * posts et de bonnes réponses d'avis.
 */
export function PlaceReviewWords({ place }: { place: GooglePlace }) {
  if (place.reviewsTags.length === 0) return null;

  const max = Math.max(...place.reviewsTags.map((tag) => tag.count));

  return (
    <Card>
      <CardTitle
        title="Ce que vos clients écrivent"
        hint="Les mots que Google compte dans vos avis, du plus fréquent au moins."
      />
      <ul className="flex flex-wrap gap-2">
        {place.reviewsTags.map((tag) => (
          <li
            key={tag.title}
            className="flex items-center gap-2 rounded-pill border border-border px-3 py-1.5 text-sm"
            style={{ backgroundColor: `rgba(9, 9, 11, ${0.03 + (tag.count / max) * 0.06})` }}
          >
            <span>{tag.title}</span>
            <span className="tabular-nums text-xs text-muted">{tag.count}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
