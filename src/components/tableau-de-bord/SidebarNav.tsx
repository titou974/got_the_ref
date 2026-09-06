"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  SidebarLink,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/tremor/Sidebar";
import { canOpen, offerFor, type AccessTier } from "@/constants/access";
import { isActiveItem, navItems } from "./navItems";

/**
 * La liste des sections, servie telle quelle à la colonne de gauche et au
 * tiroir du téléphone.
 *
 * Une section que l'offre n'ouvre pas se lit comme les autres : même encre,
 * même survol, seul le nom de l'offre qui l'ouvrirait est posé à droite. Elle
 * était grisée, et le gris disait « n'y allez pas » au moment précis où l'on
 * veut qu'on y aille : ces onglets montrent maintenant la fiche relevée, le
 * squelette du site, la place de chaque correction sous voile. C'est la
 * meilleure vitrine du produit, et une entrée éteinte n'y mène personne. Le
 * badge suffit à dire ce qui s'achète, l'écran voilé fait le reste.
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
