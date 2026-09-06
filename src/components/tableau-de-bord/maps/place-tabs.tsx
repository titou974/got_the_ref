"use client";

import Image from "next/image";
import { RiCheckLine, RiCloseLine, RiStarFill } from "@remixicon/react";
import type { GooglePlace, PlaceReview } from "@/lib/apify/place-types";
import { PlaceStars } from "./PlaceStars";
import { avatarAt, formatCount, formatRating, photoAt } from "./place-format";

/**
 * Les onglets de la fiche autres que la présentation : les avis, les photos et
 * les attributs. Ils sont sortis du panneau principal parce qu'ils ne partagent
 * rien avec lui — chacun est une liste, et le panneau est un en-tête.
 */

/** L'onglet « Avis » : la note, sa répartition, les mots qui reviennent, les avis. */
export function PlaceReviewsTab({ place }: { place: GooglePlace }) {
  const distribution = place.reviewsDistribution;
  const bars = distribution
    ? [
        { stars: 5, value: distribution.five },
        { stars: 4, value: distribution.four },
        { stars: 3, value: distribution.three },
        { stars: 2, value: distribution.two },
        { stars: 1, value: distribution.one },
      ]
    : [];
  const total = bars.reduce((sum, bar) => sum + bar.value, 0);

  return (
    <div className="px-4 pb-5">
      {distribution ? (
        <div className="flex items-center gap-5 border-b border-[var(--gm-line)] py-4">
          <div className="shrink-0 text-center">
            <p className="text-[44px] font-light leading-none text-[var(--gm-text)]">
              {formatRating(place.rating)}
            </p>
            <PlaceStars rating={place.rating} className="mt-1.5 justify-center" />
            <p className="mt-1 text-xs text-[var(--gm-muted)]">
              {formatCount(place.reviewsCount)} avis
            </p>
          </div>

          <ul className="min-w-0 flex-1 space-y-1">
            {bars.map((bar) => (
              <li key={bar.stars} className="flex items-center gap-2">
                <span className="w-2 text-right text-xs tabular-nums text-[var(--gm-muted)]">
                  {bar.stars}
                </span>
                <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--gm-line)]">
                  <span
                    className="block h-full rounded-full bg-[var(--gm-star)]"
                    style={{ width: `${total ? (bar.value / total) * 100 : 0}%` }}
                  />
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {place.reviewsTags.length > 0 ? (
        <ul className="flex flex-wrap gap-2 border-b border-[var(--gm-line)] py-4">
          {place.reviewsTags.slice(0, 8).map((tag) => (
            <li
              key={tag.title}
              className="rounded-pill border border-[var(--gm-line)] px-3 py-1 text-xs text-[var(--gm-text)]"
            >
              {tag.title}{" "}
              <span className="tabular-nums text-[var(--gm-muted)]">{tag.count}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {place.reviews.length === 0 ? (
        <p className="py-6 text-center text-sm text-[var(--gm-muted)]">
          Aucun avis relevé sur la fiche.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--gm-line)]">
          {place.reviews.map((review) => (
            <ReviewRow key={review.id} review={review} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ReviewRow({ review }: { review: PlaceReview }) {
  return (
    <li className="py-4">
      <div className="flex items-center gap-3">
        {review.photo ? (
          <Image
            src={avatarAt(review.photo, 80)}
            alt=""
            width={40}
            height={40}
            className="h-10 w-10 shrink-0 rounded-full object-cover"
            unoptimized
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--gm-line)] text-sm font-medium text-[var(--gm-muted)]">
            {review.name.charAt(0).toUpperCase()}
          </span>
        )}

        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-[var(--gm-text)]">{review.name}</p>
          <p className="truncate text-xs text-[var(--gm-muted)]">
            {review.localGuide ? "Local Guide · " : ""}
            {review.reviewerCount !== null ? `${formatCount(review.reviewerCount)} avis` : "Avis Google"}
          </p>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <PlaceStars rating={review.stars} size={14} />
        <span className="text-xs text-[var(--gm-muted)]">{review.relative ?? ""}</span>
      </div>

      {review.text ? (
        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-[var(--gm-text)]">
          {review.text}
        </p>
      ) : null}

      {review.context.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
          {review.context.map((entry) => (
            <li key={entry.label} className="text-xs text-[var(--gm-muted)]">
              <span className="font-medium text-[var(--gm-text)]">{entry.label}</span> : {entry.value}
            </li>
          ))}
        </ul>
      ) : null}

      {review.images.length > 0 ? (
        <ul className="mt-3 flex gap-2 overflow-x-auto">
          {review.images.slice(0, 4).map((url) => (
            <li key={url} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg">
              <Image
                src={photoAt(url, 200, 200)}
                alt=""
                fill
                sizes="80px"
                className="object-cover"
                unoptimized
                referrerPolicy="no-referrer"
              />
            </li>
          ))}
        </ul>
      ) : null}

      {review.ownerResponse ? (
        <div className="mt-3 rounded-lg bg-[var(--gm-wash)] p-3">
          <p className="text-xs font-medium text-[var(--gm-text)]">Réponse du propriétaire</p>
          <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-[var(--gm-text)]">
            {review.ownerResponse}
          </p>
        </div>
      ) : null}
    </li>
  );
}

/** L'onglet « Photos » : la pellicule de la fiche, telle que Google la montre. */
export function PlacePhotosTab({ place }: { place: GooglePlace }) {
  if (place.images.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-sm text-[var(--gm-muted)]">
        Aucune photo sur la fiche.
      </p>
    );
  }

  return (
    <div className="px-4 pb-5 pt-4">
      <ul className="grid grid-cols-3 gap-1.5">
        {place.images.map((url) => (
          <li key={url} className="relative aspect-square overflow-hidden rounded-lg">
            <Image
              src={photoAt(url, 400, 400)}
              alt=""
              fill
              sizes="(min-width: 1024px) 130px, 30vw"
              className="object-cover"
              unoptimized
              referrerPolicy="no-referrer"
            />
          </li>
        ))}
      </ul>
      {place.imagesCount !== null ? (
        <p className="mt-3 text-xs text-[var(--gm-muted)]">
          {formatCount(place.imagesCount)} photos sur la fiche · {place.images.length} relevées
        </p>
      ) : null}
    </div>
  );
}

/** L'onglet « À propos » : les attributs, groupe par groupe, cochés ou barrés. */
export function PlaceAboutTab({ place }: { place: GooglePlace }) {
  if (place.attributes.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-sm text-[var(--gm-muted)]">
        Aucun attribut renseigné sur la fiche.
      </p>
    );
  }

  return (
    <div className="px-4 pb-5 pt-2">
      {place.ownerDescription ? (
        <p className="border-b border-[var(--gm-line)] py-4 text-sm leading-relaxed text-[var(--gm-text)]">
          {place.ownerDescription}
        </p>
      ) : null}

      <dl className="divide-y divide-[var(--gm-line)]">
        {place.attributes.map((group) => (
          <div key={group.label} className="py-4">
            <dt className="text-sm font-medium text-[var(--gm-text)]">{group.label}</dt>
            <dd>
              <ul className="mt-2 space-y-1.5">
                {group.items.map((item) => (
                  <li key={item.label} className="flex items-center gap-2 text-sm">
                    {item.available ? (
                      <RiCheckLine size={16} className="shrink-0 text-[var(--gm-open)]" />
                    ) : (
                      <RiCloseLine size={16} className="shrink-0 text-[var(--gm-closed)]" />
                    )}
                    <span
                      className={
                        item.available
                          ? "text-[var(--gm-text)]"
                          : "text-[var(--gm-muted)] line-through"
                      }
                    >
                      {item.label}
                    </span>
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Les établissements que Google propose juste après le vôtre. */
export function PlaceSimilar({ place }: { place: GooglePlace }) {
  if (place.similar.length === 0) return null;

  return (
    <ul className="divide-y divide-[var(--gm-line)]">
      {place.similar.slice(0, 4).map((entry) => (
        <li key={entry.title} className="flex items-center justify-between gap-3 py-2.5">
          <span className="min-w-0 truncate text-sm text-[var(--gm-text)]">{entry.title}</span>
          {entry.rating !== null ? (
            <span className="flex shrink-0 items-center gap-1 text-xs tabular-nums text-[var(--gm-muted)]">
              {formatRating(entry.rating)}
              <RiStarFill size={12} className="text-[var(--gm-star)]" />
              <span>({formatCount(entry.reviewsCount)})</span>
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
