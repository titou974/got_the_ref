import Link from "next/link";
import Image from "next/image";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarProvider,
} from "@/components/tremor/Sidebar";
import { ROUTES } from "@/constants/routes";
import type { AccessTier } from "@/constants/access";
import { initials } from "@/lib/initials";
import { MobileNav } from "./MobileNav";
import { SidebarNav } from "./SidebarNav";
import { SiteSelect } from "./SiteSelect";

/**
 * Le cadre commun aux six sections : colonne de navigation à gauche, contenu à
 * droite sur toile claire.
 *
 * La colonne est le composant Tremor, toujours déroulée : fixée au viewport sur
 * grand écran, elle ne défile pas avec le contenu et ne se replie pas. Le nom du
 * site est répété en haut : c'est ce que le client vérifie en arrivant, avant
 * même de lire un chiffre.
 *
 * En dessous de `lg`, la colonne disparaît au profit de `MobileNav` : un
 * bandeau collé en haut de l'écran, qui dit la section ouverte et le site suivi,
 * et déroule le même menu dans un tiroir latéral. Les deux navigations lisent la
 * même liste (`SidebarNav`) — une section ajoutée apparaît des deux côtés.
 */
export function DashboardShell({
  domain,
  showMaps,
  tier,
  userName,
  children,
}: {
  domain: string | null;
  showMaps: boolean;
  /** Le niveau du compte : il décide des onglets grisés dans la colonne. */
  tier: AccessTier;
  userName: string | null;
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <Link
            href="/"
            className="inline-flex cursor-pointer items-center gap-2 px-2 pt-1 font-display text-lg font-bold tracking-tight"
          >
            <Image
              src="/logo.svg"
              alt=""
              width={28}
              height={28}
              className="h-7 w-7 shrink-0 rounded-[9px]"
              priority
            />
            <span>got_the_ref</span>
          </Link>

          {/* Le site suivi, dans un sélecteur : il dit lequel est ouvert et
              montre où s'ajoutera le suivant. */}
          <div className="mt-4">
            <SiteSelect domain={domain} />
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarNav showMaps={showMaps} tier={tier} />
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="border-t border-border">
          {/* Le pied de colonne se réduit à qui est connecté : l'avatar et le
              nom, rien d'autre. Le portail de facturation et la déconnexion
              encombraient une colonne dont le rôle est de naviguer ; le premier
              vit dans les réglages, où la ligne « abonnement » le porte déjà.
              Le nom reste le lien vers cet écran : c'est là que le client
              cherche ce qui le concerne lui plutôt que son site.

              L'avatar porte les initiales — sans photo à téléverser, une
              pastille de couleur unie serait un rond sans information. */}
          <Link
            href={ROUTES.dashboardSettings}
            className="flex cursor-pointer items-center gap-2.5 rounded-2xl px-3 py-2 transition-colors duration-200 hover:bg-mist"
          >
            <span
              aria-hidden
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-obsidian text-xs font-bold uppercase text-white"
            >
              {initials(userName)}
            </span>
            <span className="min-w-0 truncate text-sm font-medium">{userName ?? ""}</span>
          </Link>
        </SidebarFooter>
      </Sidebar>

      {/* Le bandeau du téléphone vit dans la colonne de contenu : il y est
          `sticky`, donc il suit le défilement de la page au lieu de partir avec
          le premier écran. */}
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileNav domain={domain} showMaps={showMaps} tier={tier} userName={userName} />

        <main className="mx-auto w-full min-w-0 max-w-[1200px] flex-1 space-y-6 px-4 py-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}
