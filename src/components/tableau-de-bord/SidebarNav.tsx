"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  SidebarLink,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/tremor/Sidebar";
import { ROUTES } from "@/constants/routes";
import {
  canOpen,
  offerFor,
  type AccessTier,
  type DashboardSection,
} from "@/constants/access";
import { cx } from "@/lib/utils";

/**
 * La navigation de gauche.
 *
 * L'onglet actif se déduit du chemin plutôt que d'une prop passée par chaque
 * page : une section de plus n'oblige alors à toucher qu'à ce tableau. Le
 * chemin racine est comparé exactement, sinon « Accueil » resterait allumé
 * partout.
 *
 * Une section que l'offre n'ouvre pas reste cliquable, en gris, avec le nom de
 * l'offre qui l'ouvrirait posé à droite. La retirer de la colonne cacherait ce
 * qu'on vend ; la désactiver laisserait le client sans le moyen d'aller voir.
 * Il tombe donc sur l'écran voilé, qui montre la forme du contenu et mène aux
 * tarifs.
 */

type Item = { href: string; key: DashboardSection; icon: React.ElementType };

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/**
 * Fabrique le composant d'icône attendu par `SidebarLink`.
 *
 * La colonne pose elle-même la taille et le `aria-hidden` sur ce qu'on lui
 * passe : l'icône doit donc être un composant qui accepte `className`, pas un
 * fragment de SVG déjà rendu.
 */
const icon = (paths: React.ReactNode) =>
  function SidebarIcon({ className }: { className?: string }) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden className={cx("size-[18px] shrink-0", className)}>
        <g {...stroke}>{paths}</g>
      </svg>
    );
  };

const ITEMS: Item[] = [
  {
    href: ROUTES.dashboard,
    key: "home",
    icon: icon(
      <>
        <rect x="3" y="3" width="7" height="7" rx="2" />
        <rect x="14" y="3" width="7" height="7" rx="2" />
        <rect x="3" y="14" width="7" height="7" rx="2" />
        <rect x="14" y="14" width="7" height="7" rx="2" />
      </>,
    ),
  },
  {
    href: ROUTES.dashboardContent,
    key: "content",
    icon: icon(
      <>
        <path d="M4 20h4L19 9a2.5 2.5 0 0 0-3.5-3.5L4 16.5V20Z" />
        <path d="M14 7l3 3" />
      </>,
    ),
  },
  {
    href: ROUTES.dashboardArchitecture,
    key: "architecture",
    icon: icon(
      <>
        <path d="M12 3 3 8l9 5 9-5-9-5Z" />
        <path d="M3 13l9 5 9-5" />
      </>,
    ),
  },
  {
    href: ROUTES.dashboardArticles,
    key: "articles",
    icon: icon(
      <>
        <rect x="3" y="5" width="18" height="16" rx="3" />
        <path d="M3 10h18M8 3v4M16 3v4" />
      </>,
    ),
  },
  {
    href: ROUTES.dashboardPresence,
    key: "presence",
    icon: icon(
      <>
        <circle cx="12" cy="12" r="3" />
        <circle cx="5" cy="6" r="2" />
        <circle cx="19" cy="6" r="2" />
        <circle cx="19" cy="18" r="2" />
        <path d="M7 7.5 10 10M17 7.5 14 10M17 16.5 14 13.5" />
      </>,
    ),
  },
];

const MAPS_ITEM: Item = {
  href: ROUTES.dashboardMaps,
  key: "maps",
  icon: icon(
    <>
      <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </>,
  ),
};

export function SidebarNav({ showMaps, tier }: { showMaps: boolean; tier: AccessTier }) {
  const t = useTranslations("dashboard.nav");
  const tg = useTranslations("dashboard.gate");
  const pathname = usePathname();
  const items = showMaps ? [...ITEMS, MAPS_ITEM] : ITEMS;

  return (
    <SidebarMenu>
      {items.map((item) => {
        const active =
          item.href === ROUTES.dashboard
            ? pathname === ROUTES.dashboard
            : pathname.startsWith(item.href);

        const locked = !canOpen(tier, item.key);

        return (
          <SidebarMenuItem key={item.key}>
            <SidebarLink
              href={item.href}
              icon={item.icon}
              isActive={active}
              className={cx(locked && !active && "text-pebble hover:bg-mist/50 hover:text-steel")}
              badge={
                locked ? (
                  // L'offre qui ouvre l'onglet, en toutes lettres : « Coup de
                  // Boost » ou « Tout-en-un ». Un cadenas seul dirait que c'est
                  // fermé sans dire avec quoi ça s'ouvre.
                  <span className="shrink-0 rounded-pill bg-mist px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-steel">
                    {tg(`offers.${offerFor(item.key)}`)}
                  </span>
                ) : undefined
              }
            >
              {t(item.key)}
            </SidebarLink>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}
