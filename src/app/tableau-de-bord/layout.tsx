import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { ROUTES } from "@/constants/routes";
import { analysisNeedsUpgrade, tierAtLeast } from "@/constants/access";
import { isOnboardingComplete } from "@/features/onboarding/queries";
import { getDashboardContext } from "@/features/dashboard/queries";
import { backfillBrandTone } from "@/features/dashboard/brand-tone";
import { backfillUpcomingDrafts } from "@/features/dashboard/upcoming-drafts";
import { buildDiagnostic } from "@/lib/geo/diagnostic";
import { CrispChat } from "@/components/CrispChat";
import { DashboardShell } from "@/components/tableau-de-bord/DashboardShell";
import { DockSlot } from "@/components/tableau-de-bord/DockSlot";
import { SolveAgentsDock } from "@/components/tableau-de-bord/SolveAgentsDock";
import { WelcomeModal } from "@/components/tableau-de-bord/WelcomeModal";

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

  // Le ton de la marque, rattrapé au retour du client dans son interface.
  //
  // Il ne se relevait qu'à l'analyse — sautée dès qu'il y en a déjà une au bon
  // niveau — ou à la première rédaction. Un Coup de Boost pris avant l'ouverture
  // de ce relevé, ou une lecture tombée un jour où le site ne répondait pas,
  // laissaient donc le champ vide indéfiniment : les articles sortaient dans la
  // voix de personne et l'atelier affichait une carte de ton vide. La coque est
  // le seul endroit par lequel tout le monde repasse, quel que soit l'onglet.
  //
  // Derrière `after()` : la lecture crawle et interroge un modèle, et le tableau
  // de bord n'a pas à l'attendre pour s'afficher. Elle ne part que là où le ton
  // sert — démo, abonnement, Coup de Boost — et seulement s'il manque encore.
  //
  // Puis les articles à venir, écrits en tâche de fond pour l'abonnement
  // Tout-en-un : la semaine qui court et la suivante, jamais devant le client.
  //
  // La mise en route n'en rédige que trois — c'est la semaine que vend le Coup
  // de Boost, et c'est un sommaire pour un abonné. La fenêtre avance à chaque
  // retour : les sujets qui viennent d'y entrer sont écrits pendant qu'il lit
  // sa page. Le ton d'abord, puisque c'est lui qui donne leur voix aux articles,
  // et la rédaction ensuite, dans le même passage.
  after(async () => {
    await backfillBrandTone(user.id);
    await backfillUpcomingDrafts(user.id);
  });

  // La barre d'exécution ne se monte qu'une fois l'analyse en place. Avant
  // ça — première ouverture, ou achat qui vient de rouvrir des mesures — les
  // pages affichent l'écran d'attente, et une barre « résoudre » posée dessus
  // proposerait de corriger un dossier qui n'est pas encore lu.
  const analysis =
    context.analysis && !analysisNeedsUpgrade(context.analysis.accessTier, context.tier)
      ? context.analysis
      : null;

  return (
    <>
      {/* La bulle de discussion : le client est abonné, quelqu'un lui répond. */}
      <CrispChat />

      {/* Le mot d'accueil, une seule fois, quelle que soit la section où le
          client atterrit. Posé hors de la coque : c'est un calque plein écran,
          et l'espacement vertical du contenu décalerait son ancrage. */}
      <WelcomeModal />

      <DashboardShell
        domain={context.domain}
        showMaps={context.isPhysical}
        tier={context.tier}
        userName={user.name ?? user.email}
      >
        {children}

        {/* L'exécution ne vit pas au bas d'une page : la barre fixe la porte, et
            elle suit le client d'un onglet à l'autre. Elle mène aux deux voies —
            rattacher le site, les agents publient alors eux-mêmes, ou brancher
            son agent IA sur le serveur MCP, qui lui sert les six chantiers.

            Elle est là pour tout le monde : c'est le geste que le produit vend,
            et une page qui ne le montre pas ne le vend pas. Sur un compte
            gratuit, elle ramène d'abord à l'onglet Contenu — le seul travail que
            son offre lui ouvre — et n'y déploie la console des agents qu'une
            fois arrivée. Ce que l'offre borne ensuite, c'est ce que le serveur
            sert à l'agent : les chantiers fermés arrivent nommés et vides. */}
        {analysis && (
          /* Sauf dans un article ouvert : l'atelier y pose sa propre barre, qui
             publie ou valide le texte affiché. */
          <DockSlot>
            <SolveAgentsDock
              userId={user.id}
              locked={!tierAtLeast(context.tier, "boost")}
              result={analysis}
              diagnostic={buildDiagnostic(analysis)}
            />
          </DockSlot>
        )}
      </DashboardShell>
    </>
  );
}
