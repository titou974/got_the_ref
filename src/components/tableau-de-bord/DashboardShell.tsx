import Link from "next/link";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { SignOutButton } from "@/components/SignOutButton";
import { BillingPortalButton } from "@/components/BillingPortalButton";
import { ROUTES } from "@/constants/routes";
import type { AccessTier } from "@/constants/access";
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
 * La colonne reste collée au défilement sur grand écran et passe en barre
 * horizontale en dessous. Le nom du site est répété en haut de la colonne :
 * c'est ce que le client vérifie en arrivant, avant même de lire un chiffre.
 */
export async function DashboardShell({
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
  const t = await getTranslations("dashboard");

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-4 py-6 lg:flex-row lg:gap-8 lg:px-6 lg:py-8">
      <aside className="lg:w-64 lg:shrink-0">
        <div className="lg:sticky lg:top-6 lg:flex lg:h-[calc(100vh-3rem)] lg:flex-col">
          <Link
            href="/"
            className="hidden cursor-pointer items-center gap-2 px-2 font-display text-lg font-bold tracking-tight lg:inline-flex"
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
          <div className="mb-4 hidden lg:mt-6 lg:block">
            <SiteSelect domain={domain} />
          </div>

          <SidebarNav showMaps={showMaps} tier={tier} />

          <div className="mt-auto hidden border-t border-border pt-4 lg:block">
            {/* Le nom mène aux réglages : c'est là que le client cherche ce qui
                le concerne lui plutôt que son site. L'avatar porte ses
                initiales — sans photo à téléverser, une pastille de couleur
                unie serait un rond sans information. */}
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

            {/* La page « mon compte » a disparu au profit de cet écran : le
                seul geste qu'elle portait encore, ouvrir le portail de
                facturation, se fait maintenant d'ici. */}
            <div className="mt-1 flex items-center gap-3 px-3">
              <BillingPortalButton
                label={t("accountLink")}
                className="cursor-pointer text-sm text-muted transition-colors duration-200 hover:text-text disabled:opacity-60"
              />
              <SignOutButton />
            </div>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 space-y-6">{children}</main>
    </div>
  );
}
