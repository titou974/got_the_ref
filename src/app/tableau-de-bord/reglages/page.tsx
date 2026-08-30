import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { PlanKey } from "@/constants/plans";
import { PageHeader } from "@/components/tableau-de-bord/Card";
import { SettingsForm } from "@/components/tableau-de-bord/SettingsForm";

/**
 * Le libellé d'offre affiché dans les réglages.
 *
 * Il y a plus d'offres en base que de phrases à montrer : `demo` se lit comme un
 * accès complet — c'en est un — et l'ancien plan agence garde le sien, puisque
 * des comptes le portent encore.
 */
const PLAN_KEY: Record<PlanKey, "free" | "boost" | "pro" | "agency"> = {
  free: "free",
  boost: "boost",
  pro: "pro",
  agency: "agency",
  demo: "pro",
};

const BUSINESS_KINDS = ["physical", "online", "both"] as const;

type BusinessKind = "" | (typeof BUSINESS_KINDS)[number];

/**
 * Le type de commerce tel que le formulaire l'attend.
 *
 * La colonne est une chaîne libre en base : un compte ouvert avant ce champ, ou
 * une valeur écrite par une version antérieure du tunnel, revient ici en « non
 * renseigné » plutôt qu'en option inconnue que le select laisserait tomber.
 */
function businessKind(value: string | null | undefined): BusinessKind {
  return BUSINESS_KINDS.find((kind) => kind === value) ?? "";
}

/**
 * Les réglages du compte.
 *
 * On y arrive par le nom, en bas de la colonne de gauche : c'est là que le
 * client cherche ce qui le concerne lui plutôt que son site. La page lit les
 * trois tables du formulaire d'un coup — compte, fiche d'accueil, ton — et les
 * passe telles quelles ; le formulaire les renvoie ensemble.
 */
export default async function SettingsPage() {
  const user = await requireUser();
  const t = await getTranslations("dashboard.settings");

  const [profile, voice] = await Promise.all([
    prisma.onboardingProfile.findUnique({ where: { userId: user.id } }),
    prisma.brandVoice.findUnique({ where: { userId: user.id } }),
  ]);

  const planLabel = t(`plans.${PLAN_KEY[user.plan as PlanKey] ?? "free"}`);

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <SettingsForm
        name={user.name ?? ""}
        email={user.email}
        planLabel={planLabel}
        businessKind={businessKind(profile?.businessKind)}
        niche={profile?.niche ?? ""}
        targetMarket={profile?.targetMarket ?? ""}
        description={profile?.description ?? ""}
        audience={profile?.audience ?? ""}
        toneInstructions={voice?.instructions ?? ""}
        toneBanned={voice?.banned ?? []}
      />
    </>
  );
}
