import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { ROUTES } from "@/constants/routes";
import { isOnboardingComplete } from "@/features/onboarding/queries";
import { getDashboardContext } from "@/features/dashboard/queries";
import { DashboardShell } from "@/components/tableau-de-bord/DashboardShell";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dashboard");
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

/**
 * La coque du tableau de bord, commune aux six sections.
 *
 * Le tunnel d'accueil est un préalable : sans lui, ni domaine, ni niche, ni
 * ton, et chaque page afficherait un vide qu'aucun bouton ne remplirait.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (!(await isOnboardingComplete(user.id))) redirect(ROUTES.onboarding);

  const context = await getDashboardContext(user.id);

  return (
    <DashboardShell
      domain={context.domain}
      showMaps={context.isPhysical}
      userName={user.name ?? user.email}
    >
      {children}
    </DashboardShell>
  );
}
