import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { isCredentialsKeySet } from "@/lib/crypto";
import { connectorForStack } from "@/constants/site-platforms";
import { getDashboardContext } from "@/features/dashboard/queries";
import { writeSolutionPrompt } from "@/features/dashboard/solution-prompt";
import type { SiteConnectSetup } from "@/components/tableau-de-bord/SiteConnectForm";
import type { ArticleFact } from "@/lib/geo/solution-facts";
import type { AnalysisDiagnostic } from "@/lib/geo/diagnostic";
import type { GeoAnalysisResult } from "@/lib/geo/types";
import { SolveAgentsBar } from "@/components/dashboard/SolveAgentsBar";

/**
 * La barre « résoudre avec les agents IA » de l'accueil du tableau de bord.
 *
 * C'est la même barre que celle du rapport d'analyse, à une différence près :
 * le prompt qu'elle porte ne couvre pas une section mais les six. Le client
 * n'a plus à passer d'onglet en onglet pour ramasser ses correctifs — il copie
 * une fois, son agent applique tout.
 *
 * L'écriture du prompt prend deux à trois secondes. Derrière une frontière
 * `Suspense` sans repli : la page s'affiche entière tout de suite, la barre
 * arrive après. Un repli qui montrerait la barre avec un prompt provisoire
 * fermerait la modale au moment de la bascule, en pleine lecture.
 */
export function SolveAgentsDock({
  userId,
  result,
  diagnostic,
  articles,
  locked = false,
}: {
  /** Le compte dont on lit le rattachement, pour l'ouvrir dans la modale. */
  userId: string;
  result: GeoAnalysisResult;
  diagnostic: AnalysisDiagnostic;
  /** Le planning éditorial : les articles rédigés partent dans le prompt. */
  articles: ArticleFact[];
  /**
   * Compte gratuit : la barre s'affiche, la modale s'ouvre et le site se
   * rattache, mais le prompt passe sous voile. Il n'est alors pas écrit du
   * tout — c'est un appel au modèle de deux à trois secondes, et un texte qui
   * n'atteint pas le navigateur ne se copie pas.
   */
  locked?: boolean;
}) {
  return (
    <Suspense fallback={null}>
      <Dock
        userId={userId}
        result={result}
        diagnostic={diagnostic}
        articles={articles}
        locked={locked}
      />
    </Suspense>
  );
}

async function Dock({
  userId,
  result,
  diagnostic,
  articles,
  locked,
}: {
  userId: string;
  result: GeoAnalysisResult;
  diagnostic: AnalysisDiagnostic;
  articles: ArticleFact[];
  locked: boolean;
}) {
  const t = await getTranslations("analysisReport");

  // Manques réellement relevés : la barre en annonce le nombre, la modale les
  // rejoue. Faute de manque, on montre les premiers contrôles d'architecture —
  // ce sont ceux que les agents tiennent à jour.
  const failing = [
    ...diagnostic.architecture.checks
      .filter((c) => c.status === "ko" || c.status === "warn")
      .map((c) => `architecture.checks.${c.key}`),
    ...diagnostic.content.checks
      .filter((c) => c.status === "ko" || c.status === "warn")
      .map((c) => `content.checks.${c.key}`),
  ];
  const issueKeys = (
    failing.length
      ? failing
      : diagnostic.architecture.checks.map((c) => `architecture.checks.${c.key}`)
  ).slice(0, 3);

  const solutionPrompt = locked
    ? ""
    : await writeSolutionPrompt({
        tab: "all",
        result,
        diagnostic,
        articles,
      });

  // Le rattachement du site s'ouvre dans la modale, et pas seulement dans les
  // réglages : c'est ici que le client demande qu'on corrige son site, donc
  // c'est ici qu'on lui demande la clé de sa maison. Le contexte est déjà lu
  // par la coque du tableau de bord, et mémorisé le temps de la requête.
  //
  // Le rattachement reste ouvert à un compte gratuit : il ne donne accès à
  // rien de payant par lui-même, et le faire d'abord évite au client de
  // s'abonner puis de découvrir qu'il lui manque un mot de passe d'application.
  const context = await getDashboardContext(userId);

  // La date est mise en forme ici : la modale est rendue chez le client, et son
  // fuseau ferait diverger le premier rendu de celui du serveur.
  const connectedOn = context.site?.connectedAt
    ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(context.site.connectedAt)
    : null;

  const connect: SiteConnectSetup = {
    link: context.site
      ? {
          platform: context.site.platform,
          siteUrl: context.site.siteUrl,
          status: context.site.status,
          capabilities: context.site.capabilities,
          connectedOn,
          lastError: context.site.lastError,
        }
      : null,
    suggestedPlatform: connectorForStack(result.signals.stack?.id).id,
    suggestedSiteUrl: context.siteUrl ?? (context.domain ? `https://${context.domain}` : null),
    credentialsKeyReady: isCredentialsKeySet(),
  };

  return (
    <>
      {/* La barre flotte au-dessus du bas de l'écran : sans cette réserve, elle
          recouvrirait la dernière carte de la page une fois défilée. La hauteur
          suit son décalage — pilule comprise, elle occupe environ 140 px sur
          téléphone, où elle est remontée pour dégager la bulle de discussion. */}
      <div className="h-40 sm:h-24" aria-hidden />
      <SolveAgentsBar
        domain={result.domain}
        stack={result.signals.stack ?? null}
        issues={issueKeys.map((key) => t(key))}
        solutionPrompt={solutionPrompt}
        scope="dashboard"
        locked={locked}
        connect={connect}
      />
    </>
  );
}
