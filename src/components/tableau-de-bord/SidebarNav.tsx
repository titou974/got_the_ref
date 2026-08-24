"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { ROUTES } from "@/constants/routes";

/**
 * La navigation de gauche.
 *
 * L'onglet actif se déduit du chemin plutôt que d'une prop passée par chaque
 * page : une section de plus n'oblige alors à toucher qu'à ce tableau. Le
 * chemin racine est comparé exactement, sinon « Accueil » resterait allumé
 * partout.
 */

type Item = { href: string; key: string; icon: React.ReactNode };

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const Icon = ({ children }: { children: React.ReactNode }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden className="shrink-0">
    <g {...stroke}>{children}</g>
  </svg>
);

const ITEMS: Item[] = [
  {
    href: ROUTES.dashboard,
    key: "home",
    icon: (
      <Icon>
        <rect x="3" y="3" width="7" height="7" rx="2" />
        <rect x="14" y="3" width="7" height="7" rx="2" />
        <rect x="3" y="14" width="7" height="7" rx="2" />
        <rect x="14" y="14" width="7" height="7" rx="2" />
      </Icon>
    ),
  },
  {
    href: ROUTES.dashboardContent,
    key: "content",
    icon: (
      <Icon>
        <path d="M4 20h4L19 9a2.5 2.5 0 0 0-3.5-3.5L4 16.5V20Z" />
        <path d="M14 7l3 3" />
      </Icon>
    ),
  },
  {
    href: ROUTES.dashboardArchitecture,
    key: "architecture",
    icon: (
      <Icon>
        <path d="M12 3 3 8l9 5 9-5-9-5Z" />
        <path d="M3 13l9 5 9-5" />
      </Icon>
    ),
  },
  {
    href: ROUTES.dashboardArticles,
    key: "articles",
    icon: (
      <Icon>
        <rect x="3" y="5" width="18" height="16" rx="3" />
        <path d="M3 10h18M8 3v4M16 3v4" />
      </Icon>
    ),
  },
  {
    href: ROUTES.dashboardPresence,
    key: "presence",
    icon: (
      <Icon>
        <circle cx="12" cy="12" r="3" />
        <circle cx="5" cy="6" r="2" />
        <circle cx="19" cy="6" r="2" />
        <circle cx="19" cy="18" r="2" />
        <path d="M7 7.5 10 10M17 7.5 14 10M17 16.5 14 13.5" />
      </Icon>
    ),
  },
];

const MAPS_ITEM: Item = {
  href: ROUTES.dashboardMaps,
  key: "maps",
  icon: (
    <Icon>
      <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </Icon>
  ),
};

export function SidebarNav({ showMaps }: { showMaps: boolean }) {
  const t = useTranslations("dashboard.nav");
  const pathname = usePathname();
  const items = showMaps ? [...ITEMS, MAPS_ITEM] : ITEMS;

  return (
    // Sous la largeur d'un ordinateur portable, la colonne devient une barre
    // qui défile : six onglets empilés mangeraient le premier écran du mobile.
    <nav className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
      {items.map((item) => {
        const active =
          item.href === ROUTES.dashboard
            ? pathname === ROUTES.dashboard
            : pathname.startsWith(item.href);

        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-colors duration-200 ${
              active
                ? "bg-mist font-semibold text-obsidian"
                : "text-steel hover:bg-mist/70 hover:text-ink"
            }`}
          >
            {item.icon}
            <span className="truncate">{t(item.key)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
