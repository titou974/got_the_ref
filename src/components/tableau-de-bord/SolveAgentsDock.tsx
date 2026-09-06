import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { ROUTES } from "@/constants/routes";
import { formatPublishDate, nextPublishPass } from "@/constants/publishing";
import { getDashboardContext } from "@/features/dashboard/queries";
import { connectSetupFor } from "@/features/dashboard/connect-setup";
import type { AnalysisDiagnostic } from "@/lib/geo/diagnostic";
import type { GeoAnalysisResult } from "@/lib/geo/types";
import { SolveAgentsBar } from "@/components/dashboard/SolveAgentsBar";

/**
 * La barre « résoudre avec les agents IA » du tableau de bord.
 *
 * Elle est posée dans la coque, pas dans une page : c'est le geste que le
 * produit vend, et il doit rester à portée de pouce sur les six onglets. Elle
 * n'était montée que sur l'accueil, et le client qui descendait dans le détail
 * d'une section perdait en route le bouton qui l'applique.
 *
 * Elle n'écrit plus rien. Auparavant elle rédigeait, à chaque affichage, le
 * prompt de correction des six sections — deux à trois secondes d'appel au
 * modèle pour un texte que le client copiait ensuite à la main. L'exécution
 * passe désormais par le serveur MCP : l'agent va chercher lui-même les
 * correctifs, et la barre n'a plus qu'à ouvrir la modale.
 *
 * Elle reste derrière une frontière `Suspense` sans repli. Ce qu'elle attend
 * n'est plus un modèle mais le rattachement du site, lu en base : la coque
 * s'affiche entière tout de suite, la barre arrive après.
 */
export function SolveAgentsDock({
  userId,
  result,
  diagnostic,
  locked = false,
}: {
  /** Le compte dont on lit le rattachement, pour l'ouvrir dans la modale. */
  userId: string;
  result: GeoAnalysisResult;
  diagnostic: AnalysisDiagnostic;
  /**
   * Compte gratuit : la barre et la modale s'affichent à l'identique. Ce qui
   * change est ce que l'agent recevra une fois connecté — le serveur ne lui
   * sert que les chantiers ouverts par l'offre.
   */
  locked?: boolean;
}) {
  return (
    <Suspense fallback={null}>
      <Dock userId={userId} result={result} diagnostic={diagnostic} locked={locked} />
    </Suspense>
  );
}

async function Dock({
  userId,
  result,
  diagnostic,
  locked,
}: {
  userId: string;
  result: GeoAnalysisResult;
  diagnostic: AnalysisDiagnostic;
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

  // Le rattachement du site s'ouvre dans la modale, et pas seulement dans les
  // réglages : c'est ici que le client demande qu'on corrige son site, donc
  // c'est ici qu'on lui demande la clé de sa maison. Le contexte est déjà lu
  // par la coque du tableau de bord, et mémorisé le temps de la requête.
  //
  // Le rattachement reste ouvert à un compte gratuit : il ne donne accès à
  // rien de payant par lui-même, et le faire d'abord évite au client de
  // s'abonner puis de découvrir qu'il lui manque un mot de passe d'application.
  const context = await getDashboardContext(userId);

  // Les prochains textes du client, pour la modale ouverte depuis son
  // calendrier : elle y montre ses articles qui se posent sur son site, avec
  // leurs vrais titres et leurs vraies dates. Trois lignes suffisent à faire
  // comprendre le mouvement, et les lire coûte une requête indexée.
  const nextArticles = await prisma.article.findMany({
    where: { userId, status: { in: ["drafted", "approved"] } },
    orderBy: { scheduledFor: "asc" },
    take: 3,
    select: { title: true, scheduledFor: true },
  });

  const connect = connectSetupFor(context, result.signals.stack?.id);

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
        locked={locked}
        connect={connect}
        // Le compte gratuit passe par l'onglet Contenu avant d'ouvrir la
        // console : c'est le seul travail que son offre lui ouvre, et la barre
        // l'y emmène tant qu'il n'y est pas.
        contentHref={locked ? ROUTES.dashboardContent : null}
        // Sur le calendrier d'articles, la barre change de propos : le client y
        // a des textes prêts, pas des manques à corriger.
        articlesHref={ROUTES.dashboardArticles}
        articles={nextArticles.map((article) => ({
          title: article.title,
          dateLabel: article.scheduledFor
            ? formatPublishDate(nextPublishPass(article.scheduledFor))
            : t("solve.modal.undated"),
        }))}
      />
    </>
  );
}
