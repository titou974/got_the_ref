"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import {
  RiArrowDownSLine,
  RiCheckLine,
  RiCloseLine,
  RiDirectionFill,
  RiExternalLinkLine,
  RiFileList2Line,
  RiGlobalLine,
  RiGridFill,
  RiHeartsFill,
  RiImageLine,
  RiMapPin2Fill,
  RiMoneyEuroBoxLine,
  RiPhoneFill,
  RiRestaurantLine,
  RiSearchLine,
  RiShareLine,
  RiStore2Line,
  RiTimeLine,
  RiWheelchairFill,
} from "@remixicon/react";
import type { GooglePlace } from "@/lib/apify/place-types";
import { PlaceStars } from "./PlaceStars";
import { PlaceAboutTab, PlacePhotosTab, PlaceReviewsTab, PlaceSimilar } from "./place-tabs";
import {
  directionsUrl,
  displayHost,
  formatCount,
  formatRating,
  openState,
  photoAt,
} from "./place-format";

/**
 * La fiche Google Maps du commerce, remontée telle que Google la montre.
 *
 * Le pari de cet écran : le commerçant reconnaît sa fiche avant de lire quoi que
 * ce soit. On reprend donc la grammaire de Google — le bandeau photo, la ligne
 * de note, les ronds d'action, la liste à icônes — jusqu'à ses couleurs
 * exactes, déclarées en variables sur le panneau et nulle part ailleurs : le
 * bleu #1a73e8, l'or des étoiles, le vert d'ouverture. Le reste du tableau de
 * bord garde sa palette, sans une goutte de bleu.
 *
 * Tout ce qui est cliquable mène chez Google ou chez le commerce : le panneau
 * ne simule aucune action qu'il ne sait pas faire.
 */

const PANEL_COLORS = {
  "--gm-blue": "#1a73e8",
  "--gm-wash": "#e8f0fe",
  "--gm-star": "#e7711b",
  "--gm-open": "#188038",
  "--gm-closed": "#d93025",
  "--gm-text": "#202124",
  "--gm-muted": "#70757a",
  "--gm-line": "#e8eaed",
} as React.CSSProperties;

type Tab = "overview" | "reviews" | "photos" | "about";

export function GooglePlacePanel({
  place,
  fetchedLabel,
}: {
  place: GooglePlace;
  /** « 3 septembre 2026 à 14:05 », formaté côté serveur pour un rendu stable. */
  fetchedLabel: string;
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const [copied, setCopied] = useState(false);
  const listingUrl = place.mapsUrl ?? directionsUrl(place);

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Présentation" },
    ...(place.reviews.length > 0 || place.reviewsDistribution
      ? [{ id: "reviews" as const, label: "Avis" }]
      : []),
    ...(place.images.length > 0 ? [{ id: "photos" as const, label: "Photos" }] : []),
    ...(place.attributes.length > 0 ? [{ id: "about" as const, label: "À propos" }] : []),
  ];

  async function share() {
    try {
      await navigator.clipboard.writeText(listingUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* presse-papiers indisponible : le lien reste ouvrable ci-dessous */
    }
  }

  return (
    <div
      style={PANEL_COLORS}
      className="overflow-hidden rounded-[28px] border border-border bg-snow text-[var(--gm-text)]"
    >
      <SearchChrome title={place.title} href={listingUrl} />
      <PhotoStrip place={place} />

      <div className="px-4 pt-3">
        <h2 className="text-[22px] font-medium leading-tight">{place.title}</h2>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          {place.rating !== null ? (
            <>
              <span className="tabular-nums">{formatRating(place.rating)}</span>
              <PlaceStars rating={place.rating} />
              <span className="text-[var(--gm-muted)]">({formatCount(place.reviewsCount)})</span>
            </>
          ) : (
            <span className="text-[var(--gm-muted)]">Aucune note</span>
          )}
          {place.price ? (
            <span className="text-[var(--gm-muted)]">· {place.price}</span>
          ) : null}
        </div>

        <div className="mt-1 flex items-center gap-2 text-sm text-[var(--gm-muted)]">
          <span>{place.category ?? "Établissement"}</span>
          {hasAttribute(place, "Entrée accessible en fauteuil roulant") ? (
            <RiWheelchairFill size={15} className="text-[var(--gm-blue)]" />
          ) : null}
        </div>
      </div>

      <nav className="mt-3 flex gap-1 border-b border-[var(--gm-line)] px-2">
        {tabs.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => setTab(entry.id)}
            aria-current={tab === entry.id ? "page" : undefined}
            className={`cursor-pointer border-b-[3px] px-3 pb-2.5 pt-1 text-sm transition-colors duration-150 ${
              tab === entry.id
                ? "border-[var(--gm-blue)] font-medium text-[var(--gm-blue)]"
                : "border-transparent text-[var(--gm-muted)] hover:text-[var(--gm-text)]"
            }`}
          >
            {entry.label}
          </button>
        ))}
      </nav>

      {tab === "overview" ? (
        <OverviewTab place={place} listingUrl={listingUrl} copied={copied} onShare={share} />
      ) : null}
      {tab === "reviews" ? <PlaceReviewsTab place={place} /> : null}
      {tab === "photos" ? <PlacePhotosTab place={place} /> : null}
      {tab === "about" ? <PlaceAboutTab place={place} /> : null}

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--gm-line)] px-4 py-3 text-xs text-[var(--gm-muted)]">
        <span>Relevé le {fetchedLabel}</span>
        <a
          href={listingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-medium text-[var(--gm-blue)] hover:underline"
        >
          Ouvrir sur Google Maps
          <RiExternalLinkLine size={13} />
        </a>
      </footer>
    </div>
  );
}

/**
 * Le bandeau de recherche de Google, au-dessus de la fiche.
 *
 * Il n'y a pas de champ : un faux champ de recherche serait un mensonge
 * d'interface. C'est un lien, et il fait la seule chose qu'on attend de lui —
 * ouvrir la vraie fiche chez Google.
 */
function SearchChrome({ title, href }: { title: string; href: string }) {
  return (
    <div className="px-3 pb-3 pt-3">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 rounded-pill border border-[var(--gm-line)] bg-snow px-4 py-2.5 shadow-md transition-colors duration-200 hover:bg-[var(--gm-wash)]"
      >
        <span className="min-w-0 flex-1 truncate text-sm text-[var(--gm-text)]">{title}</span>
        <RiSearchLine size={18} className="shrink-0 text-[var(--gm-blue)]" />
      </a>
    </div>
  );
}

/** Le bandeau photo : une grande à gauche, deux empilées à droite, comme Google. */
function PhotoStrip({ place }: { place: GooglePlace }) {
  const [main, ...rest] = place.images;

  if (!main) {
    return (
      <div className="mx-3 flex h-[150px] flex-col items-center justify-center gap-2 rounded-2xl bg-mist text-[var(--gm-muted)]">
        <RiImageLine size={22} />
        <p className="text-sm">Aucune photo sur la fiche</p>
      </div>
    );
  }

  const side = rest.slice(0, 2);

  return (
    <div className="relative mx-3 h-[190px] overflow-hidden rounded-2xl">
      <div className={`grid h-full gap-0.5 ${side.length > 0 ? "grid-cols-3" : "grid-cols-1"}`}>
        <div className={`relative ${side.length > 0 ? "col-span-2" : ""}`}>
          <Image
            src={photoAt(main, 800, 600)}
            alt={`Photo de ${place.title}`}
            fill
            sizes="(min-width: 1024px) 300px, 90vw"
            className="object-cover"
            priority
            unoptimized
            referrerPolicy="no-referrer"
          />
        </div>

        {side.length > 0 ? (
          <div className="grid grid-rows-2 gap-0.5">
            {side.map((url) => (
              <div key={url} className="relative">
                <Image
                  src={photoAt(url, 400, 300)}
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 150px, 30vw"
                  className="object-cover"
                  unoptimized
                  referrerPolicy="no-referrer"
                />
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {place.imagesCount !== null ? (
        <span className="pointer-events-none absolute bottom-2 left-2 rounded-pill bg-black/65 px-2.5 py-1 text-xs font-medium text-white">
          {formatCount(place.imagesCount)} photos
        </span>
      ) : null}
    </div>
  );
}

/** L'onglet « Présentation » : ce que Google met en tête de fiche. */
function OverviewTab({
  place,
  listingUrl,
  copied,
  onShare,
}: {
  place: GooglePlace;
  listingUrl: string;
  copied: boolean;
  onShare: () => void;
}) {
  const services = place.attributes.find((group) => group.label === "Services disponibles");

  return (
    <>
      <ActionRow place={place} listingUrl={listingUrl} copied={copied} onShare={onShare} />

      {place.description ? (
        <div className="border-t border-[var(--gm-line)] px-4 py-4">
          <p className="text-sm leading-relaxed">{place.description}</p>
          {services ? (
            <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1">
              {services.items.slice(0, 3).map((item) => (
                <li key={item.label} className="flex items-center gap-1.5 text-sm">
                  {item.available ? (
                    <RiCheckLine size={15} className="text-[var(--gm-open)]" />
                  ) : (
                    <RiCloseLine size={15} className="text-[var(--gm-closed)]" />
                  )}
                  <span className={item.available ? "" : "text-[var(--gm-muted)]"}>
                    {item.label}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <InfoRows place={place} />

      {place.updates.length > 0 ? (
        <section className="border-t border-[var(--gm-line)] px-4 py-4">
          <h3 className="text-sm font-medium">Dernière mise à jour du commerce</h3>
          <p className="mt-1.5 line-clamp-4 text-sm leading-relaxed text-[var(--gm-text)]">
            {place.updates[0].text}
          </p>
          {place.updates[0].date ? (
            <p className="mt-1 text-xs text-[var(--gm-muted)]">{place.updates[0].date}</p>
          ) : null}
        </section>
      ) : null}

      {place.similar.length > 0 ? (
        <section className="border-t border-[var(--gm-line)] px-4 py-4">
          <h3 className="text-sm font-medium">Les internautes recherchent aussi</h3>
          <PlaceSimilar place={place} />
        </section>
      ) : null}
    </>
  );
}

/** Les ronds bleus sous le titre. Chacun n'apparaît que s'il mène quelque part. */
function ActionRow({
  place,
  listingUrl,
  copied,
  onShare,
}: {
  place: GooglePlace;
  listingUrl: string;
  copied: boolean;
  onShare: () => void;
}) {
  const actions: {
    key: string;
    label: string;
    icon: React.ReactNode;
    href?: string;
    onClick?: () => void;
  }[] = [
    {
      key: "directions",
      label: "Itinéraire",
      icon: <RiDirectionFill size={19} />,
      href: directionsUrl(place),
    },
    ...(place.website
      ? [{ key: "site", label: "Site", icon: <RiGlobalLine size={19} />, href: place.website }]
      : []),
    ...(place.phone
      ? [
          {
            key: "call",
            label: "Appeler",
            icon: <RiPhoneFill size={19} />,
            href: `tel:${place.phone.replace(/\s/g, "")}`,
          },
        ]
      : []),
    ...(place.reserveUrl
      ? [
          {
            key: "book",
            label: "Réserver",
            icon: <RiFileList2Line size={19} />,
            href: place.reserveUrl,
          },
        ]
      : place.menuUrl
        ? [
            {
              key: "menu",
              label: "Menu",
              icon: <RiRestaurantLine size={19} />,
              href: place.menuUrl,
            },
          ]
        : []),
    {
      key: "share",
      label: copied ? "Copié" : "Partager",
      icon: <RiShareLine size={19} />,
      onClick: onShare,
    },
  ];

  return (
    <ul className="flex items-start justify-around gap-1 px-2 py-4">
      {actions.map((action) => {
        const content = (
          <>
            <span className="grid h-11 w-11 place-items-center rounded-full bg-[var(--gm-wash)] text-[var(--gm-blue)] transition-colors duration-200 group-hover:bg-[#d2e3fc]">
              {action.icon}
            </span>
            <span className="mt-1.5 block text-center text-[11px] leading-tight text-[var(--gm-blue)]">
              {action.label}
            </span>
          </>
        );

        return (
          <li key={action.key} className="min-w-0">
            {action.href ? (
              <a
                href={action.href}
                target={action.href.startsWith("tel:") ? undefined : "_blank"}
                rel="noopener noreferrer"
                className="group flex w-16 flex-col items-center"
              >
                {content}
              </a>
            ) : (
              <button
                type="button"
                onClick={action.onClick}
                className="group flex w-16 cursor-pointer flex-col items-center"
              >
                {content}
              </button>
            )}
          </li>
        );
      })}
      <li className="sr-only">
        <a href={listingUrl}>Ouvrir la fiche sur Google Maps</a>
      </li>
    </ul>
  );
}

/** La liste à icônes : adresse, horaires, prix, menu, site, téléphone, plus code. */
function InfoRows({ place }: { place: GooglePlace }) {
  const [expanded, setExpanded] = useState(false);
  // L'état d'ouverture dépend de l'heure du navigateur : on ne le calcule
  // qu'après le montage, sinon le rendu serveur et le rendu client divergent.
  const mounted = useSyncExternalStore(subscribeNever, onClient, onServer);
  const now = useMemo(() => (mounted ? new Date() : null), [mounted]);

  const state = useMemo(() => (now ? openState(place, now) : null), [place, now]);
  const lgbtq = hasAttribute(place, "LGBTQ+ friendly");

  return (
    <ul className="divide-y divide-[var(--gm-line)] border-t border-[var(--gm-line)]">
      {place.address ? (
        <InfoRow icon={<RiMapPin2Fill size={19} />} href={directionsUrl(place)}>
          {place.address}
        </InfoRow>
      ) : null}

      {place.openingHours.length > 0 ? (
        <li>
          <button
            type="button"
            onClick={() => setExpanded((open) => !open)}
            aria-expanded={expanded}
            className="flex w-full cursor-pointer items-center gap-4 px-4 py-3 text-left"
          >
            <RiTimeLine size={19} className="shrink-0 text-[var(--gm-blue)]" />
            <span className="min-w-0 flex-1 text-sm">
              {state ? (
                <>
                  <span
                    className={
                      state.status === "open"
                        ? "font-medium text-[var(--gm-open)]"
                        : "font-medium text-[var(--gm-closed)]"
                    }
                  >
                    {state.label}
                  </span>
                  {state.detail ? (
                    <span className="text-[var(--gm-muted)]"> · {state.detail}</span>
                  ) : null}
                </>
              ) : (
                <span className="text-[var(--gm-muted)]">Horaires d'ouverture</span>
              )}
            </span>
            <RiArrowDownSLine
              size={18}
              className={`shrink-0 text-[var(--gm-muted)] transition-transform duration-200 ${
                expanded ? "rotate-180" : ""
              }`}
            />
          </button>

          {expanded ? (
            <table className="w-full pb-3 text-sm">
              <tbody>
                {place.openingHours.map((row) => {
                  const today = now !== null && state !== null && isToday(row.day, now);
                  return (
                    <tr key={row.day} className={today ? "font-medium" : ""}>
                      <td className="py-1 pl-[52px] pr-4 capitalize text-[var(--gm-text)]">
                        {row.day}
                      </td>
                      <td
                        className={`py-1 pr-4 text-right tabular-nums ${
                          row.closed ? "text-[var(--gm-muted)]" : "text-[var(--gm-text)]"
                        }`}
                      >
                        {row.hours}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : null}
        </li>
      ) : null}

      {place.price ? (
        <InfoRow icon={<RiMoneyEuroBoxLine size={19} />}>{place.price} par personne</InfoRow>
      ) : null}

      {place.menuUrl ? (
        <InfoRow icon={<RiRestaurantLine size={19} />} href={place.menuUrl}>
          <span className="block">Menu</span>
          <span className="block text-xs text-[var(--gm-muted)]">
            {displayHost(place.menuUrl)}
          </span>
        </InfoRow>
      ) : null}

      {place.website ? (
        <InfoRow icon={<RiGlobalLine size={19} />} href={place.website}>
          {displayHost(place.website)}
        </InfoRow>
      ) : null}

      {place.phone ? (
        <InfoRow icon={<RiPhoneFill size={19} />} href={`tel:${place.phone.replace(/\s/g, "")}`}>
          {place.phone}
        </InfoRow>
      ) : null}

      {place.plusCode ? (
        <InfoRow icon={<RiGridFill size={19} />}>{place.plusCode}</InfoRow>
      ) : null}

      {lgbtq ? (
        <InfoRow icon={<RiHeartsFill size={19} />}>LGBTQ+ friendly</InfoRow>
      ) : null}

      {!place.claimed ? (
        <InfoRow icon={<RiStore2Line size={19} />}>
          <span className="font-medium text-[var(--gm-closed)]">Fiche non revendiquée</span>
          <span className="block text-xs text-[var(--gm-muted)]">
            Google propose encore « Vous êtes le propriétaire ? »
          </span>
        </InfoRow>
      ) : null}
    </ul>
  );
}

function InfoRow({
  icon,
  href,
  children,
}: {
  icon: React.ReactNode;
  href?: string;
  children: React.ReactNode;
}) {
  const body = (
    <>
      <span className="shrink-0 text-[var(--gm-blue)]">{icon}</span>
      <span className="min-w-0 flex-1 text-sm">{children}</span>
    </>
  );

  return (
    <li>
      {href ? (
        <a
          href={href}
          target={href.startsWith("tel:") ? undefined : "_blank"}
          rel="noopener noreferrer"
          className="flex items-start gap-4 px-4 py-3 transition-colors duration-200 hover:bg-[var(--gm-wash)]"
        >
          {body}
        </a>
      ) : (
        <div className="flex items-start gap-4 px-4 py-3">{body}</div>
      )}
    </li>
  );
}

/**
 * « Sommes-nous côté navigateur ? », posé sans effet.
 *
 * `useSyncExternalStore` répond `false` au rendu serveur et `true` au premier
 * rendu client : c'est exactement la bascule qu'il faut pour un affichage qui
 * dépend de l'heure locale, sans divergence d'hydratation ni `setState` dans un
 * effet. Le store ne change jamais, l'abonnement ne fait donc rien.
 */
function subscribeNever(): () => void {
  return () => {};
}
const onClient = () => true;
const onServer = () => false;

/** Vrai si la fiche porte cet attribut et qu'il est disponible. */
function hasAttribute(place: GooglePlace, label: string): boolean {
  return place.attributes.some((group) =>
    group.items.some((item) => item.label === label && item.available),
  );
}

const DAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

function isToday(day: string, now: Date): boolean {
  return day === DAYS[now.getDay()];
}
