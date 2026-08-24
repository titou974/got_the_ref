import Link from "next/link";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { ROUTES } from "@/constants/routes";
import { SignOutButton } from "@/components/SignOutButton";
import { SidebarNav } from "./SidebarNav";

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

          <div className="mb-4 hidden rounded-2xl border border-border bg-surface px-3.5 py-3 lg:mt-6 lg:block">
            <p className="text-[11px] uppercase tracking-wider text-steel">{t("projectLabel")}</p>
            <p className="truncate text-sm font-semibold">{domain ?? t("noProject")}</p>
          </div>

          <SidebarNav showMaps={showMaps} />

          <div className="mt-auto hidden border-t border-border pt-4 lg:block">
            <p className="truncate px-3 text-sm font-medium">{userName ?? ""}</p>
            <div className="mt-1 flex items-center gap-3 px-3">
              <Link
                href={ROUTES.account}
                className="cursor-pointer text-sm text-muted transition-colors duration-200 hover:text-text"
              >
                {t("accountLink")}
              </Link>
              <SignOutButton />
            </div>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 space-y-6">{children}</main>
    </div>
  );
}
