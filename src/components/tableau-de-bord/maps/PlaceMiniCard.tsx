"use client";

import Image from "next/image";
import { useMemo, useSyncExternalStore } from "react";
import { RiStarFill } from "@remixicon/react";
import type { GooglePlace } from "@/lib/apify/place-types";
import { formatCount, formatRating, openState, photoAt } from "./place-format";

/**
 * La fiche en carte compacte, épinglée à droite de la page.
 *
 * Le panneau complet reste plus bas : ici on ne garde que ce qui sert de point
 * de repère — la bande de photos, le nom, la note, l'état d'ouverture. C'est
 * assez pour que le commerçant sache qu'on parle bien de sa fiche, et assez
 * peu pour que les gestes de la semaine restent le sujet de l'écran.
 *
 * Les couleurs de Google sont déclarées sur cette carte et nulle part ailleurs,
 * comme sur le panneau : le vert d'ouverture et l'or des étoiles appartiennent
 * à la fiche, pas au tableau de bord.
 */
const CARD_COLORS = {
  "--gm-blue": "#1a73e8",
  "--gm-star": "#e7711b",
  "--gm-open": "#188038",
  "--gm-closed": "#d93025",
  "--gm-text": "#202124",
  "--gm-muted": "#70757a",
  "--gm-line": "#e8eaed",
} as React.CSSProperties;

const subscribeNever = () => () => {};
const onClient = () => true;
const onServer = () => false;

export function PlaceMiniCard({
  place,
  fetchedLabel,
}: {
  place: GooglePlace;
  /** « 3 septembre », formaté côté serveur pour un rendu stable. */
  fetchedLabel: string;
}) {
  // L'heure d'ouverture dépend de l'horloge du visiteur : on ne la calcule
  // qu'une fois monté, sinon serveur et client ne diraient pas la même chose.
  const mounted = useSyncExternalStore(subscribeNever, onClient, onServer);
  const state = useMemo(() => (mounted ? openState(place, new Date()) : null), [place, mounted]);

  const [wide, tall] = place.images;

  return (
    <div
      style={CARD_COLORS}
      className="overflow-hidden rounded-3xl border border-border bg-surface text-[var(--gm-text)]"
    >
      <div className="grid h-[76px] grid-cols-[2fr_1fr] gap-0.5 bg-fog">
        <Photo src={wide ?? null} width={400} height={160} />
        <Photo src={tall ?? wide ?? null} width={200} height={160} />
      </div>

      <div className="px-4 pb-4 pt-3">
        <p className="truncate text-[15px] font-semibold">{place.title}</p>

        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-[var(--gm-muted)]">
          {place.rating !== null ? (
            <>
              <span className="font-semibold tabular-nums text-[var(--gm-text)]">
                {formatRating(place.rating)}
              </span>
              <RiStarFill size={12} className="text-[var(--gm-star)]" />
              <span className="tabular-nums">{formatCount(place.reviewsCount)} avis</span>
            </>
          ) : (
            <span>Aucune note</span>
          )}
        </p>

        {place.address ? (
          <p className="mt-1 truncate text-xs text-[var(--gm-muted)]">{place.address}</p>
        ) : null}

        {state ? (
          <p
            className="mt-1 text-xs font-medium"
            style={{
              color: state.status === "open" ? "var(--gm-open)" : "var(--gm-closed)",
            }}
          >
            {state.label}
            {state.detail ? (
              <span className="font-normal text-[var(--gm-muted)]"> · {state.detail}</span>
            ) : null}
          </p>
        ) : (
          <p className="mt-1 h-4" />
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-[var(--gm-line)] px-4 py-2.5 text-xs text-[var(--gm-muted)]">
        <span>Relevée le {fetchedLabel}</span>
        {place.mapsUrl ? (
          <a
            href={place.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 font-medium text-[var(--gm-blue)] hover:underline"
          >
            Ouvrir sur Maps
          </a>
        ) : null}
      </div>
    </div>
  );
}

function Photo({ src, width, height }: { src: string | null; width: number; height: number }) {
  if (!src) return <span className="block h-full w-full bg-fog" />;

  return (
    <span className="relative block h-full w-full overflow-hidden">
      <Image
        src={photoAt(src, width, height)}
        alt=""
        fill
        sizes="300px"
        className="object-cover"
        unoptimized
        referrerPolicy="no-referrer"
      />
    </span>
  );
}
