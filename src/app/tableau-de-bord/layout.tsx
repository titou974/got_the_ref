import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { ROUTES } from "@/constants/routes";
import { analysisNeedsUpgrade, tierAtLeast } from "@/constants/access";
import { isOnboardingComplete } from "@/features/onboarding/queries";
import { getDashboardContext, listArticles } from "@/features/dashboard/queries";
import { buildDiagnostic } from "@/lib/geo/diagnostic";
import { CrispChat } from "@/components/CrispChat";
import { DashboardShell } from "@/components/tableau-de-bord/DashboardShell";
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

  // La barre d'exécution ne se monte qu'une fois l'analyse en place. Avant
  // ça — première ouverture, ou achat qui vient de rouvrir des mesures — les
  // pages affichent l'écran d'attente, et une barre « résoudre » posée dessus
  // proposerait de corriger un dossier qui n'est pas encore lu.
  const analysis =
    context.analysis && !analysisNeedsUpgrade(context.analysis.accessTier, context.tier)
      ? context.analysis
      : null;

  // Le planning éditorial nourrit le prompt : les articles déjà rédigés y
  // partent tels quels. Une lecture en base, pas un appel de modèle.
  const articles = analysis ? await listArticles(user.id) : [];

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
            rattacher le site, les agents publient et corrigent alors eux-mêmes,
            ou repartir avec le prompt, qui couvre les six sections d'un coup.

            Elle est là pour tout le monde : c'est le geste que le produit vend,
            et une page qui ne le montre pas ne le vend pas. Sur un compte
            gratuit, elle ramène d'abord à l'onglet Contenu — le seul travail que
            son offre lui ouvre — et n'y déploie la console des agents qu'une
            fois arrivée. Le prompt, lui, n'est même pas écrit côté serveur : ce
            qui n'atteint pas le navigateur ne se copie pas. */}
        {analysis && (
          <SolveAgentsDock
            userId={user.id}
            locked={!tierAtLeast(context.tier, "boost")}
            result={analysis}
            diagnostic={buildDiagnostic(analysis)}
            articles={articles.map((article) => ({
              title: article.title,
              keyword: article.keyword,
              status: article.status,
              scheduledFor: article.scheduledFor,
              excerpt: article.excerpt,
              outline: article.outline,
              body: article.body,
            }))}
          />
        )}
      </DashboardShell>
    </>
  );
}
