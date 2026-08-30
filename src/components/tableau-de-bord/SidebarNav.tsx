"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  SidebarLink,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/tremor/Sidebar";
import { canOpen, offerFor, type AccessTier } from "@/constants/access";
import { cx } from "@/lib/utils";
import { isActiveItem, navItems } from "./navItems";

/**
 * La liste des sections, servie telle quelle à la colonne de gauche et au
 * tiroir du téléphone.
 *
 * Une section que l'offre n'ouvre pas reste cliquable, en gris, avec le nom de
 * l'offre qui l'ouvrirait posé à droite. La retirer de la colonne cacherait ce
 * qu'on vend ; la désactiver laisserait le client sans le moyen d'aller voir.
 * Il tombe donc sur l'écran voilé, qui montre la forme du contenu et mène aux
 * tarifs.
 */
export function SidebarNav({
  showMaps,
  tier,
  onNavigate,
}: {
  showMaps: boolean;
  tier: AccessTier;
  /**
   * Appelé au clic sur une entrée. Le tiroir s'en sert pour se refermer :
   * changer de route le ferme déjà de fait, mais taper la section où l'on est
   * ne change rien à l'URL — le tiroir resterait ouvert sur place.
   */
  onNavigate?: () => void;
}) {
  const t = useTranslations("dashboard.nav");
  const tg = useTranslations("dashboard.gate");
  const pathname = usePathname();

  return (
    <SidebarMenu>
      {navItems(showMaps).map((item) => {
        const active = isActiveItem(item, pathname);
        const locked = !canOpen(tier, item.key);

        return (
          <SidebarMenuItem key={item.key}>
            <SidebarLink
              href={item.href}
              icon={item.icon}
              isActive={active}
              onClick={onNavigate}
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
