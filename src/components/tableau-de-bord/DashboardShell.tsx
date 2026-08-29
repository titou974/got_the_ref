import Link from "next/link";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { SignOutButton } from "@/components/SignOutButton";
import { BillingPortalButton } from "@/components/BillingPortalButton";
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
import { SidebarNav } from "./SidebarNav";
import { SiteSelect } from "./SiteSelect";

/**
 * Les initiales de l'avatar : deux lettres au plus.
 *
 * Le nom peut être une adresse e-mail — c'est ce que la coque reçoit quand le
 * compte n'a pas encore de nom. On ne garde alors que ce qui précède l'arobase,
 * sinon tout le monde s'appellerait « G » comme gmail.
 */
function initials(name: string | null): string {
  const source = (name ?? "").split("@")[0].trim();
  if (!source) return "·";

  const words = source.split(/[\s._-]+/).filter(Boolean);
  if (words.length === 0) return "·";
  if (words.length === 1) return words[0].slice(0, 2);
  return words[0][0] + words[1][0];
}

/**
 * Le cadre commun aux six sections : colonne de navigation à gauche, contenu à
 * droite sur toile claire.
 *
 * La colonne est le composant Tremor, toujours déroulée : fixée au viewport sur
 * grand écran, elle ne défile pas avec le contenu et ne se replie pas. En
 * dessous de `lg` elle repasse dans le flux, en barre horizontale. Le nom du
 * site est répété en haut : c'est ce que le client vérifie en arrivant, avant
 * même de lire un chiffre.
 */
export async function DashboardShell({
  domain,
  showMaps,
  userName,
  children,
}: {
  domain: string | null;
  showMaps: boolean;
  userName: string | null;
  children: React.ReactNode;
}) {
  const t = await getTranslations("dashboard");

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="hidden lg:flex">
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
              <SidebarNav showMaps={showMaps} />
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="hidden border-t border-border lg:flex">
          {/* Le nom mène aux réglages : c'est là que le client cherche ce qui
              le concerne lui plutôt que son site. L'avatar porte ses
              initiales — sans photo à téléverser, une pastille de couleur unie
              serait un rond sans information. */}
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
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{userName ?? ""}</span>
              <span className="block text-xs text-muted">{t("settingsLink")}</span>
            </span>
          </Link>

          {/* La page « mon compte » a disparu au profit de cet écran : le seul
              geste qu'elle portait encore, ouvrir le portail de facturation, se
              fait maintenant d'ici. */}
          <div className="flex items-center gap-3 px-3">
            <BillingPortalButton
              label={t("accountLink")}
              className="cursor-pointer text-sm text-muted transition-colors duration-200 hover:text-text disabled:opacity-60"
            />
            <SignOutButton />
          </div>
        </SidebarFooter>
      </Sidebar>

      <main className="mx-auto w-full min-w-0 max-w-[1200px] flex-1 space-y-6 px-4 py-6 lg:px-8 lg:py-8">
        {children}
      </main>
    </SidebarProvider>
  );
}
