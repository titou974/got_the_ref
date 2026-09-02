import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isCredentialsKeySet } from "@/lib/crypto";
import { getDashboardContext } from "@/features/dashboard/queries";
import type { PlanKey } from "@/constants/plans";
import { connectorForStack } from "@/constants/site-platforms";
import { PageHeader } from "@/components/tableau-de-bord/Card";
import { Divider } from "@/components/tableau-de-bord/Field";
import { SettingsForm } from "@/components/tableau-de-bord/SettingsForm";
import { SiteConnectionPanel } from "@/components/tableau-de-bord/SiteConnectionPanel";
import { AutoPublishChoice } from "@/components/tableau-de-bord/AutoPublishChoice";
import { BrandToneBar } from "@/components/tableau-de-bord/BrandToneBar";

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

  // Le contexte est déjà lu par la coque du tableau de bord, et mémorisé le
  // temps de la requête : le redemander ici ne coûte rien.
  const [profile, voice, context] = await Promise.all([
    prisma.onboardingProfile.findUnique({ where: { userId: user.id } }),
    prisma.brandVoice.findUnique({ where: { userId: user.id } }),
    getDashboardContext(user.id),
  ]);

  const planLabel = t(`plans.${PLAN_KEY[user.plan as PlanKey] ?? "free"}`);

  // La date est mise en forme ici : le composant est rendu chez le client, et
  // son fuseau ferait diverger le premier rendu de celui du serveur.
  const connectedOn = context.site?.connectedAt
    ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(context.site.connectedAt)
    : null;

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

      {/* Ce que les agents ont relevé de votre manière d'écrire, contre le
          formulaire qui l'amende. La carte était en tête de l'atelier
          d'article ; elle y répétait à chaque ouverture une contrainte qu'on
          pose une fois. Ici, le relevé et les consignes se lisent côte à côte,
          à l'endroit où l'on écrit les secondes. */}
      <div className="mt-6">
        <BrandToneBar
          tone={context.tone}
          voice={voice ? { instructions: voice.instructions, banned: voice.banned } : null}
        />
      </div>

      <Divider className="my-12" />

      <SiteConnectionPanel
        link={
          context.site
            ? {
                platform: context.site.platform,
                siteUrl: context.site.siteUrl,
                status: context.site.status,
                capabilities: context.site.capabilities,
                connectedOn,
                lastError: context.site.lastError,
              }
            : null
        }
        // La plateforme reconnue au crawl est proposée d'emblée : neuf clients
        // sur dix n'ont alors qu'à coller deux identifiants.
        suggestedPlatform={connectorForStack(context.analysis?.signals.stack?.id).id}
        suggestedSiteUrl={context.siteUrl ?? (context.domain ? `https://${context.domain}` : null)}
        credentialsKeyReady={isCredentialsKeySet()}
      />

      {/* Le pilote automatique se règle sous la porte qu'il commande, et non
          plus en tête de la page Articles : c'est un consentement qu'on donne
          une fois, pas une décision qu'on reprend à chaque planning. Il n'a de
          sens que si le site accepte le dépôt — sinon rien ne part, coché ou
          non. */}
      {context.site?.status === "connected" && context.site.capabilities.includes("publish") ? (
        <div className="mt-6">
          <AutoPublishChoice enabled={context.site.autoPublish} />
        </div>
      ) : null}
    </>
  );
}
