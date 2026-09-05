"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { authActionClient } from "@/lib/safe-action";
import { sendEmail } from "@/lib/email";
import { analysisReadyEmail } from "./emails";
import { prisma } from "@/lib/prisma";
import { ROUTES } from "@/constants/routes";
import { AppError } from "@/lib/errors";
import { encryptJson, isCredentialsKeySet } from "@/lib/crypto";
import { connectorFor } from "@/constants/site-platforms";
import { preferredPassOnDay } from "@/constants/publishing";
import { ApifyError, isApifyConfigured } from "@/lib/apify/client";
import { fetchGooglePlace } from "@/lib/apify/google-place";
import { InvalidMapsUrlError, normalizeMapsUrl } from "@/lib/geo/maps";
import type { GooglePlace, MapsAdvice } from "@/lib/apify/place-types";
import { collectSignals } from "@/lib/geo/fetcher";
import { analyzeSite, refreshEngineRankings } from "@/lib/geo/analyzer";
import { regenerateOnPageElement } from "@/lib/geo/keywords";
import { findContactPoints, normalizeDomain } from "@/lib/geo/contact-finder";
import { DASHBOARD_ENGINES, type GeoAnalysisResult } from "@/lib/geo/types";
import { publishArticle, verifyConnection, type Credentials } from "./connectors";
import { applyOnPage, applyStructure } from "./site-sync";
import { buildStructureFiles } from "@/lib/geo/structure-files";
import {
  MAPS_PLACE_COOLDOWN_MS,
  type DashboardContext,
  getArticleQuota,
  getDashboardContext,
  getMapsPlace,
  homepageText,
  isDashboardReady,
  readSiteCredentials,
  startOfDay,
} from "./queries";
import { recordAnalysisSnapshot } from "./progress";
import {
  adviseAttributes,
  auditAttributes,
  draftReviewReplies,
  readSiteHours,
  writeListingAdvice,
} from "./maps-service";
import {
  releaseArticleGeneration,
  releaseOnPageRewrite,
  reserveArticleGeneration,
  reserveOnPageRewrite,
} from "./quota";
import { ARTICLE_QUOTAS, ON_PAGE_REWRITE_QUOTA } from "@/constants/plans";
import {
  FREE_CONTENT_REWRITES,
  analysisNeedsUpgrade,
  articleTopicsFor,
  draftsSeedArticles,
  runsEngine,
  tierAtLeast,
  type AccessTier,
} from "@/constants/access";
import { getAccess, requireSection } from "@/features/billing/access";
import { detectBrandIdentity } from "@/features/onboarding/service";
import { parseOutline, serializeOutline } from "./outline";
import {
  draftOutreachMessage,
  findProspects,
  planArticleTopics,
  planGooglePosts,
  rewriteOnPage,
  writeArticle,
} from "./service";
import {
  approveArticleSchema,
  articleIdSchema,
  autoPublishSchema,
  brandVoiceSchema,
  connectSiteSchema,
  disconnectSiteSchema,
  draftReviewRepliesSchema,
  googlePostIdSchema,
  planArticlesSchema,
  planGooglePostsSchema,
  prospectDraftSchema,
  prospectStatusSchema,
  readSiteHoursSchema,
  refreshMapsPlaceSchema,
  regenerateOnPageSchema,
  reviewReplySchema,
  saveMapsUrlSchema,
  scheduleArticleSchema,
  settingsSchema,
  updateArticleSchema,
  writeArticleSchema,
} from "./schemas";

/**
 * Les actions du tableau de bord.
 *
 * Toutes passent par `authActionClient` : chacune retrouve son utilisateur dans
 * `ctx.auth`, et aucune ne prend d'identifiant de compte en entrée. Les lectures
 * repassent systématiquement par `userId` dans le `where`, faute de quoi un
 * identifiant d'article deviné ouvrirait le brouillon d'un autre client.
 */

/**
 * « mardi 2 septembre » : la date à laquelle une rédaction se libère.
 *
 * Un délai en heures (« dans 61 h ») obligerait le client à faire le calcul.
 * Une date, il la lit et il sait s'il attend ou s'il écrit lui-même.
 */
function formatRenewal(renewsAt: Date | null): string {
  if (!renewsAt) return "sous peu";
  return `le ${renewsAt.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  })}`;
}

const revalidateDashboard = () => {
  revalidatePath(ROUTES.dashboard);
  revalidatePath(ROUTES.dashboardArticles);
  revalidatePath(ROUTES.dashboardPresence);
  revalidatePath(ROUTES.dashboardMaps);
  revalidatePath(ROUTES.dashboardContent);
};

// ── Analyse d'entrée ─────────────────────────────────────────────────────────

/**
 * L'analyse du site, lancée avant la première ouverture du tableau de bord —
 * et rejouée une fois, le jour où le compte achète.
 *
 * Le tunnel d'accueil a déjà crawlé le site ; ce qui manque ici, c'est l'audit
 * GEO complet, celui qui alimente les onglets Contenu et Architecture. Refaire
 * l'analyse à chaque visite n'aurait pas de sens : elle n'est déclenchée que
 * lorsque le compte n'en a aucune sur son domaine.
 *
 * Avec une exception, et c'est tout l'objet du niveau inscrit dans l'analyse.
 * Celle d'un compte gratuit est volontairement étroite : un seul moteur
 * interrogé, aucun relevé hors-site — on ne paie pas des appels dont le
 * résultat finira sous un voile. Le jour où ce compte prend le Coup de Boost ou
 * l'abonnement, ces appels-là ont enfin un écran où s'afficher : l'analyse est
 * donc refaite une fois, à son nouveau niveau, et remplace la précédente.
 * Ensuite elle est de nouveau à jour, et plus rien ne repart.
 */
/**
 * Le ton de la marque et sa couleur, relevés une fois, dès le premier achat.
 *
 * Cette lecture-là ne se vend pas à l'unité : elle ne sert que là où des textes
 * sortent au nom du client — les articles, les réécritures on-page, les posts.
 * Un compte gratuit n'en publie aucun, et la question ne lui est donc pas
 * posée. Dès le Coup de Boost en revanche, elle l'est : cette offre ouvre
 * l'onglet Articles et fait rédiger la première semaine dans la foulée de
 * l'achat (cf. `seedEditorialMonthAction`). Ces articles-là sont les premiers
 * textes que le client lit sous son propre nom ; les écrire sans avoir relevé
 * sa manière d'écrire revenait à les lui rendre dans la voix de personne, et
 * c'est exactement ce qui les faisait finir non publiés.
 *
 * D'où le fait qu'elle vive ici, dans l'analyse du tableau de bord, et pas dans
 * le tunnel d'accueil. Un client qui ouvre un compte gratuit puis achète trois
 * semaines plus tard ne repasse pas par l'accueil ; il repasse en revanche par
 * cette analyse, refaite une fois au niveau qu'il vient d'acheter. Le ton se
 * relève donc au moment exact où il devient utile, sans lui redemander quoi que
 * ce soit.
 *
 * Le texte lu est celui du crawl Firecrawl déjà en base (`getOrCrawlSite`), et
 * la lecture part sur le nano d'OpenAI (rôle `tone`) : c'est une extraction,
 * pas un jugement.
 *
 * Best-effort de bout en bout : un site injoignable ou un modèle muet rend le
 * ton déjà en base (souvent `null`), et l'audit continue. Rien de ce qui est
 * ici ne vaut de faire échouer l'analyse que le client attend à l'écran.
 */
async function ensureBrandIdentity(
  userId: string,
  tier: AccessTier,
  profile: {
    siteUrl: string | null;
    toneSummary: string | null;
    toneSampleUrl: string | null;
    brandColor: string | null;
  },
): Promise<string | null> {
  if (!tierAtLeast(tier, "boost")) return profile.toneSummary;

  // Déjà relevés : la voix d'une marque ne change pas d'une analyse à l'autre,
  // et la relire à chaque remesure serait un appel de modèle pour rien.
  if (profile.toneSummary && profile.brandColor) return profile.toneSummary;

  try {
    const brand = await detectBrandIdentity({
      siteUrl: profile.siteUrl,
      sampleUrl: profile.toneSampleUrl,
    });

    // Écriture champ par champ : une seconde passe qui ne retrouve que la
    // couleur ne doit pas effacer le ton relevé à la première.
    const data = {
      ...(brand.tone ? { toneSummary: brand.tone } : {}),
      ...(brand.color ? { brandColor: brand.color } : {}),
      ...(brand.sourceUrl ? { toneSampleUrl: brand.sourceUrl } : {}),
    };
    if (Object.keys(data).length > 0) {
      await prisma.onboardingProfile.update({ where: { userId }, data });
    }

    return brand.tone ?? profile.toneSummary;
  } catch (err) {
    console.error("Relevé du ton de marque échoué :", err);
    return profile.toneSummary;
  }
}

/**
 * Le contexte du tableau de bord, avec le ton de la marque relevé si besoin.
 *
 * `ensureBrandIdentity` ne passe que dans l'analyse, et l'analyse ne se refait
 * qu'au changement de niveau (cf. `analysisNeedsUpgrade`). Deux comptes lui
 * échappent donc, et ce sont précisément ceux qui écrivent : celui dont
 * l'analyse portait déjà le niveau acheté — les Coups de Boost pris avant
 * l'ouverture de ce relevé —, et celui dont la lecture avait échoué ce jour-là
 * sans jamais être retentée. Les deux feraient écrire leurs articles dans la
 * voix de personne.
 *
 * On repose donc la question ici, au moment d'écrire, et seulement si le ton
 * manque encore. Un compte qui l'a déjà ne déclenche rien ; un compte gratuit
 * non plus, il ne publie pas. Best-effort comme partout ailleurs : une lecture
 * qui échoue rend le contexte tel quel et la rédaction continue sans le ton.
 */
async function contextForWriting(userId: string): Promise<DashboardContext> {
  const context = await getDashboardContext(userId);
  if (context.tone.summary || !context.siteUrl) return context;
  if (!tierAtLeast(context.tier, "boost")) return context;

  const tone = await ensureBrandIdentity(userId, context.tier, {
    siteUrl: context.siteUrl,
    toneSummary: context.tone.summary,
    toneSampleUrl: context.tone.sampleUrl,
    brandColor: context.tone.color,
  });
  if (!tone) return context;

  return { ...context, tone: { ...context.tone, summary: tone } };
}

export const prepareDashboardAction = authActionClient
  .inputSchema(disconnectSiteSchema)
  .action(async ({ ctx }) => {
    const userId = ctx.auth.user.id;
    const profile = await prisma.onboardingProfile.findUnique({
      where: { userId },
      select: {
        siteUrl: true,
        domain: true,
        businessKind: true,
        mapsUrl: true,
        niche: true,
        cities: true,
        toneSummary: true,
        toneSampleUrl: true,
        brandColor: true,
      },
    });

    if (!profile?.siteUrl) {
      throw new AppError(
        "Aucun site enregistré : reprenez l'étape « votre site » de l'accueil.",
        "NO_SITE",
        400,
      );
    }

    // Un compte gratuit reçoit bien l'audit complet — c'est lui qui détecte la
    // niche et sort les mots-clés, les deux choses qu'il a le droit de voir —
    // mais ses classements ne sont relevés que sur Gemini (cf. `FREE_ENGINES`).
    // Et on s'arrête aux appels utiles : les relevés hors-site nourrissent des
    // onglets qui resteront sous voile, on ne les paie donc pas.
    const { tier } = await getAccess(userId);
    const engines = DASHBOARD_ENGINES.filter((engine) => runsEngine(tier, engine));

    const existing = await prisma.analysis.findFirst({
      where: { userId, ...(profile.domain ? { domain: profile.domain } : {}) },
      orderBy: { createdAt: "desc" },
      select: { id: true, data: true },
    });

    // Une analyse déjà faite au niveau du compte n'a aucune raison d'être
    // refaite : elle a coûté ce qu'elle devait coûter, et rejouer l'audit à
    // chaque ouverture reviendrait à repayer le même rapport.
    if (existing && !analysisNeedsUpgrade(readAnalysisTier(existing.data), tier)) {
      return { id: existing.id };
    }

    const mode = profile.businessKind === "online" ? "online" : "physical";
    const brandTone = await ensureBrandIdentity(userId, tier, profile);
    const signals = await collectSignals(profile.siteUrl);

    const result = await analyzeSite(
      signals,
      {
        mode,
        engines,
        offsite: tierAtLeast(tier, "allin"),
        mapsUrl: profile.mapsUrl ?? null,
        declaredNiche: profile.niche,
        declaredLocation: mode === "physical" ? (profile.cities[0] ?? null) : null,
        // Relevé juste au-dessus dès le premier achat : les correctifs on-page
        // de l'audit sont alors écrits dans la voix du client, pas dans celle
        // d'un modèle. En gratuit il n'y en a pas, et ils restent neutres.
        brandTone,
      },
      "paid",
    );

    // Le niveau est écrit dans l'analyse elle-même : c'est lui qui dira, à la
    // prochaine ouverture, si les appels qu'on vient de sauter ont désormais un
    // écran où s'afficher.
    const data = JSON.stringify({
      ...result,
      mapsUrl: profile.mapsUrl ?? null,
      tier: "paid",
      accessTier: tier,
    });

    const columns = {
      url: result.url,
      domain: result.domain,
      businessName: result.businessName,
      businessType: result.businessType,
      mapsUrl: profile.mapsUrl ?? null,
      overallScore: result.overallScore,
      data,
      unlocked: true,
    };

    // Mise à jour plutôt que création quand l'analyse existait déjà : le client
    // garde le même identifiant d'un bout à l'autre, et rien ne pointe vers un
    // rapport devenu orphelin.
    const record = existing
      ? await prisma.analysis.update({
          where: { id: existing.id },
          data: columns,
          select: { id: true },
        })
      : await prisma.analysis.create({
          data: { ...columns, userId },
          select: { id: true },
        });

    // La trace de cette version, pour que la première reprise ait quelque chose
    // à quoi se comparer. Écrite après l'analyse, jamais avant : un instantané
    // d'un rapport qui n'a pas été enregistré ne compare rien.
    await recordAnalysisSnapshot({
      userId,
      analysisId: record.id,
      result,
      reason: "initial",
    });

    // Les résultats partent aussi par e-mail. Beaucoup de clients ferment
    // l'onglet pendant les trois minutes d'audit ; sans ce message, ils ne
    // reviennent pas voir ce qu'ils ont demandé. Il est expédié après la
    // réponse — le tableau de bord n'a pas à attendre Resend — et son échec ne
    // remet pas en cause l'analyse, qui est écrite.
    const { subject, html, text } = analysisReadyEmail({
      userName: ctx.auth.user.name,
      analysis: result,
    });
    after(() =>
      sendEmail({
        to: ctx.auth.user.email,
        subject,
        html,
        text,
        // Adossée à l'analyse : la reprise après achat en réécrit une nouvelle
        // et mérite son e-mail, un double rendu de l'écran d'attente n'en
        // mérite pas un second.
        idempotencyKey: `analysis-ready/${record.id}/${tier}`,
      }),
    );

    revalidateDashboard();
    return { id: record.id };
  });

/**
 * La reprise quotidienne de l'analyse.
 *
 * Le client corrige son site — il colle un H1 réécrit, il pose un JSON-LD, il
 * publie un article. Rien de tout cela ne se voyait : la note du tableau de
 * bord était celle du jour de l'achat, et le plan d'action restait figé sur des
 * correctifs déjà appliqués. Cette action remesure, une fois par jour.
 *
 * Ce qu'elle refait, c'est l'audit : la note, les six catégories, le constat,
 * les correctifs, l'architecture et le contenu — tout ce qui dépend de ce que
 * la page montre aujourd'hui. Le site est donc recrawlé et repassé au modèle.
 *
 * Ce qu'elle ne touche pas, et c'est aussi important :
 *   — les articles déjà planifiés ou rédigés. Aucun n'est relu ici, aucun n'est
 *     réécrit, aucun calendrier n'est resemé : la rédaction se pilote depuis
 *     son propre onglet.
 *   — les backlinks. Le relevé hors-site est explicitement coupé (`offsite:
 *     false`) et l'ancien bloc est recopié tel quel : une estimation refaite
 *     chaque jour ferait osciller un chiffre que le client construit sur des
 *     mois, et effacerait le travail de prospection déjà mené.
 *   — les classements moteurs. Ils ont leur propre reprise
 *     (`refreshRankingsAction`), qui coûte quatre appels payants ; aucun moteur
 *     n'est interrogé ici (`engines: []`) et les relevés en place sont
 *     conservés.
 *
 * Une fois par journée civile, pas par tranche de vingt-quatre heures : une
 * reprise lancée à 23 h ne doit pas fermer la porte jusqu'au lendemain soir.
 *
 * Avant d'écrire, l'état courant est archivé dans `AnalysisSnapshot` : c'est ce
 * qui permet à l'écran de dire ce qui a monté, ce qui a baissé et quels
 * correctifs ont disparu.
 */
export const refreshAnalysisAction = authActionClient
  .inputSchema(disconnectSiteSchema)
  .action(async ({ ctx }) => {
    const userId = ctx.auth.user.id;

    // La reprise est un appel au grand modèle par jour et par compte : c'est une
    // dépense qui revient, elle appartient donc aux offres qui reviennent. Le
    // Coup de Boost est une passe unique — il ouvre l'audit d'entrée, pas une
    // mesure quotidienne. Seul l'abonnement Tout-en-un (et la démo qui en montre
    // la surface) y donne droit ; ailleurs, l'écran propose l'offre.
    const { tier } = await getAccess(userId);
    if (!tierAtLeast(tier, "allin")) {
      throw new AppError(
        "La reprise quotidienne de l'analyse est incluse dans l'abonnement Tout-en-un.",
        "UPGRADE_REQUIRED",
        403,
      );
    }

    const profile = await prisma.onboardingProfile.findUnique({
      where: { userId },
      select: {
        siteUrl: true,
        domain: true,
        businessKind: true,
        mapsUrl: true,
        niche: true,
        cities: true,
        toneSummary: true,
      },
    });

    if (!profile?.siteUrl) {
      throw new AppError(
        "Aucun site enregistré : reprenez l'étape « votre site » de l'accueil.",
        "NO_SITE",
        400,
      );
    }

    const record = await prisma.analysis.findFirst({
      where: { userId, ...(profile.domain ? { domain: profile.domain } : {}) },
      orderBy: { createdAt: "desc" },
      select: { id: true, data: true, createdAt: true, refreshedAt: true },
    });
    if (!record) throw new AppError("Analyse indisponible.", "NO_ANALYSIS", 400);

    // Sans reprise antérieure, c'est la date de l'analyse elle-même qui compte :
    // un audit fait ce matin n'a rien à remesurer ce soir.
    const last = record.refreshedAt ?? record.createdAt;
    if (last >= startOfDay()) {
      throw new AppError(
        "L'analyse a déjà été reprise aujourd'hui. La prochaine est disponible demain.",
        "REFRESH_DONE",
        429,
      );
    }

    let stored: GeoAnalysisResult & { tier?: string; accessTier?: AccessTier };
    try {
      stored = JSON.parse(record.data) as GeoAnalysisResult & {
        tier?: string;
        accessTier?: AccessTier;
      };
    } catch {
      throw new AppError("Analyse illisible.", "BAD_ANALYSIS", 500);
    }

    const mode = profile.businessKind === "online" ? "online" : "physical";
    const signals = await collectSignals(profile.siteUrl);

    const fresh = await analyzeSite(
      signals,
      {
        mode,
        // Aucun moteur interrogé, aucun relevé hors-site : la reprise mesure la
        // page, pas le marché. Ce qui coûte cher a sa propre commande.
        engines: [],
        offsite: false,
        mapsUrl: profile.mapsUrl ?? null,
        declaredNiche: profile.niche,
        declaredLocation: mode === "physical" ? (profile.cities[0] ?? null) : null,
        brandTone: profile.toneSummary,
      },
      "paid",
    );

    // Le rapport enregistré est celui d'aujourd'hui pour tout ce qui vient de la
    // page, et celui d'hier pour tout ce que la reprise n'a pas mesuré. Les
    // champs conservés sont écrits en dernier : sans eux, le `...fresh` les
    // remplacerait par des blocs vides, faute d'appels.
    const merged: GeoAnalysisResult = {
      ...stored,
      ...fresh,
      engines: stored.engines,
      liveQuery: stored.liveQuery ?? null,
      localRankings: stored.localRankings,
      webPresence: stored.webPresence,
      backlinks: stored.backlinks ?? null,
      mapsCoherence: stored.mapsCoherence ?? null,
      mapsUrl: profile.mapsUrl ?? stored.mapsUrl ?? null,
    };

    await prisma.analysis.update({
      where: { id: record.id },
      data: {
        url: merged.url,
        domain: merged.domain,
        businessName: merged.businessName,
        businessType: merged.businessType,
        overallScore: merged.overallScore,
        refreshedAt: new Date(),
        data: JSON.stringify({ ...stored, ...merged, tier: "paid", accessTier: tier }),
      },
    });

    await recordAnalysisSnapshot({
      userId,
      analysisId: record.id,
      result: merged,
      reason: "refresh",
    });

    revalidateDashboard();
    return {
      score: merged.overallScore,
      delta: merged.overallScore - stored.overallScore,
    };
  });

/**
 * Le tableau de bord est-il prêt à prendre la place de l'écran d'attente ?
 *
 * L'écran d'attente ne peut pas se fier au seul retour de `prepareDashboardAction` :
 * l'action peut avoir rendu la main pendant que la revalidation de la page
 * n'est pas encore visible, et une analyse écrite mais pas encore relue
 * laisserait le client sur une barre pleine à 100 % — le défaut que cette
 * action existe pour supprimer. Il demande donc au serveur, en toutes lettres,
 * si la page d'accueil afficherait autre chose que l'attente.
 *
 * Aucune écriture, aucun appel de modèle : deux lectures en base. C'est ce qui
 * autorise à la répéter toutes les deux secondes le temps que l'écriture
 * devienne visible.
 */
export const dashboardReadyAction = authActionClient
  .inputSchema(disconnectSiteSchema)
  .action(async ({ ctx }) => ({ ready: await isDashboardReady(ctx.auth.user.id) }));

/** Le niveau d'accès inscrit dans une analyse enregistrée, s'il l'a été. */
function readAnalysisTier(raw: string): AccessTier | null {
  try {
    return (JSON.parse(raw) as { accessTier?: AccessTier }).accessTier ?? null;
  } catch {
    return null;
  }
}

/**
 * Relève à nouveau la place du commerce dans les moteurs suivis.
 *
 * Le classement est la seule partie de l'audit qui bouge d'une semaine à
 * l'autre sans que le site change : on la reprend seule, auprès des API des
 * moteurs, plutôt que de relancer l'audit complet. Le reste de l'analyse
 * enregistrée est conservé tel quel.
 *
 * La requête envoyée est formée sur la niche et la ville déclarées à l'accueil,
 * comme dans l'analyse de base — pas sur le nom du site.
 */
export const refreshRankingsAction = authActionClient
  .inputSchema(disconnectSiteSchema)
  .action(async ({ ctx }) => {
    const userId = ctx.auth.user.id;
    const profile = await prisma.onboardingProfile.findUnique({
      where: { userId },
      select: { domain: true, businessKind: true, niche: true, cities: true },
    });

    const record = await prisma.analysis.findFirst({
      where: { userId, ...(profile?.domain ? { domain: profile.domain } : {}) },
      orderBy: { createdAt: "desc" },
      select: { id: true, data: true },
    });
    if (!record) throw new AppError("Analyse indisponible.", "NO_ANALYSIS", 400);

    let stored: GeoAnalysisResult & { tier?: string };
    try {
      stored = JSON.parse(record.data) as GeoAnalysisResult & { tier?: string };
    } catch {
      throw new AppError("Analyse illisible.", "BAD_ANALYSIS", 500);
    }

    const isPhysical = profile?.businessKind !== "online";

    // Un compte gratuit ne fait mesurer que Gemini : son relevé passe par le
    // grounding Google Search, sans appel facturé en plus. ChatGPT, Perplexity
    // et Claude se paient à chaque passage — ils ne sont donc pas exécutés, et
    // leurs cartes restent voilées plutôt que remplies d'un chiffre inventé.
    const { tier } = await getAccess(userId);
    const engines = DASHBOARD_ENGINES.filter((engine) => runsEngine(tier, engine));

    const { engines: refreshed, liveQuery } = await refreshEngineRankings(stored, {
      declared: {
        niche: profile?.niche ?? null,
        location: isPhysical ? (profile?.cities[0] ?? null) : null,
        isPhysical,
      },
      engines,
    });

    await prisma.analysis.update({
      where: { id: record.id },
      data: {
        data: JSON.stringify({
          ...stored,
          engines: refreshed,
          liveQuery,
          rankingsCheckedAt: new Date().toISOString(),
        }),
      },
    });

    revalidateDashboard();
    return { measured: refreshed.filter((engine) => engine.measured).length };
  });

// ── Mois éditorial d'accueil ─────────────────────────────────────────────────

/** Une publication par jour ouvré : du lundi au vendredi, samedi et dimanche off. */
const SEED_WEEKDAYS = [1, 2, 3, 4, 5] as const;
/**
 * Combien d'articles sont rédigés dans la foulée de la planification.
 *
 * Trois, et pas les cinq jours de la semaine ouvrée : ces rédactions partent en
 * parallèle derrière l'écran d'attente, et cinq appels au grand modèle lancés
 * ensemble dépassent le budget de la préparation. Le reste du mois attend la
 * demande du client, article par article.
 */
const SEED_DRAFTS = 3;

/**
 * Les dates du mois éditorial, à partir du lundi qui vient.
 *
 * On part toujours d'un lundi, jamais d'« aujourd'hui plus sept jours » : un
 * planning qui tombe le mardi puis le jeudi puis le samedi ne se lit pas comme
 * un calendrier éditorial, et le client ne sait plus quel jour il publie.
 *
 * Les dates sont produites au compte demandé, pas à un nombre de semaines fixe :
 * le volume du planning est une décision d'offre (`articleTopicsFor`), et cette
 * fonction n'a qu'à poser autant de jours ouvrés qu'il y a de sujets. Vingt-deux
 * sujets couvrent ainsi quatre semaines pleines plus deux jours.
 */
function seedSchedule(from: Date, count: number): Date[] {
  // Tout le calcul de jours se fait en UTC. Les variantes locales de `Date`
  // donnaient un lundi différent selon le fuseau de la machine : en production
  // le serveur est en UTC et l'écart ne se voyait pas, sur un poste à Paris le
  // planning glissait d'un jour.
  const monday = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()),
  );
  // getUTCDay() : 0 = dimanche. Le lundi suivant est à 1..7 jours d'ici, jamais
  // aujourd'hui — le premier article doit laisser le temps de la relecture.
  monday.setUTCDate(monday.getUTCDate() + ((8 - monday.getUTCDay()) % 7 || 7));

  const dates: Date[] = [];
  for (let index = 0; index < count; index += 1) {
    const week = Math.floor(index / SEED_WEEKDAYS.length);
    const weekday = SEED_WEEKDAYS[index % SEED_WEEKDAYS.length];
    const day = new Date(monday);
    day.setUTCDate(monday.getUTCDate() + week * 7 + (weekday - 1));
    // L'heure vient du rythme de la file, pas d'une constante posée ici. Elle
    // valait 9 h, quand la tâche planifiée passe à 8 h : chaque article était
    // daté une heure après le seul passage de sa journée, et repartait le
    // lendemain. Vingt-deux sujets, vingt-deux jours de retard silencieux.
    dates.push(new Date(preferredPassOnDay(day.toISOString().slice(0, 10))));
  }
  return dates;
}

/**
 * Les sujets d'articles posés avant la première ouverture du tableau de bord,
 * et complétés le jour de l'achat.
 *
 * Un calendrier vide, à l'arrivée, demande au client de deviner quoi écrire :
 * c'est exactement le travail qu'il vient de déléguer. On en pose donc d'entrée,
 * mais pas la même quantité selon ce que le compte a payé.
 *
 *   — gratuit : quatre sujets, la semaine qui vient. Ils sont datés, ils
 *     portent le mot-clé et l'angle, et ils s'affichent en clair sur l'accueil.
 *     Aucun n'est rédigé : écrire est le travail vendu, et trois appels au
 *     grand modèle pour un onglet resté sous voile ne servent personne. Cette
 *     planification-là tient en UN appel — le même qu'il rende quatre sujets ou
 *     vingt-deux —, c'est ce qui la rend tenable sur un compte qui ne paie rien.
 *   — Coup de Boost et abonnement : le mois entier, vingt-deux sujets à raison
 *     d'un par jour ouvré, dont les trois premiers rédigés dans la foulée.
 *
 * L'action est donc appelée deux fois dans la vie d'un compte gratuit qui
 * achète : à la mise en route, puis derrière l'écran d'attente de l'achat. Le
 * second passage ne refait pas ce qui existe — il complète jusqu'au volume du
 * nouveau niveau, en reprenant le planning là où le précédent s'était arrêté,
 * et rédige la première semaine.
 *
 * Ces rédactions offertes ne sont pas décomptées du quota hebdomadaire : elles
 * viennent avec la mise en route, et un client qui arriverait à zéro passe ne
 * pourrait plus rien reprendre de sa semaine.
 */
export const seedEditorialMonthAction = authActionClient
  .inputSchema(disconnectSiteSchema)
  .action(async ({ ctx }) => {
    const userId = ctx.auth.user.id;

    const { tier } = await getAccess(userId);
    const target = articleTopicsFor(tier);

    const existing = await prisma.article.count({ where: { userId } });
    if (existing >= target) return { planned: 0, written: 0 };

    const context = await contextForWriting(userId);
    const missing = target - existing;
    const topics = await planArticleTopics(context, missing);
    // Le planning complet est calculé d'un bloc, puis on n'en prend que les
    // dates encore libres : les quatre sujets du compte gratuit gardent leur
    // place, et les suivants s'ajoutent derrière eux au lieu de tomber le même
    // jour.
    const dates = seedSchedule(new Date(), target).slice(existing);

    await prisma.article.createMany({
      data: topics.slice(0, missing).map((topic, index) => ({
        userId,
        title: topic.title,
        keyword: topic.keyword,
        outline: serializeOutline(
          topic.outline.map((heading) => ({ heading, level: 2 as const, instruction: "" })),
        ),
        excerpt: topic.angle,
        scheduledFor: dates[index],
        status: "planned",
      })),
    });

    // Un compte gratuit s'arrête là : ses sujets sont au calendrier, lisibles,
    // et le bouton de publication mène aux tarifs.
    if (!draftsSeedArticles(tier)) {
      revalidateDashboard();
      return { planned: topics.length, written: 0 };
    }

    // Les trois premiers du planning encore à l'état de sujet, rédigés
    // ensemble : trois appels en parallèle tiennent dans le budget de la
    // préparation, trois à la suite non.
    const firstWeek = await prisma.article.findMany({
      where: { userId, status: "planned" },
      orderBy: { scheduledFor: "asc" },
      take: SEED_DRAFTS,
    });

    const drafts = await Promise.allSettled(
      firstWeek.map(async (article) => {
        const draft = await writeArticle(context, {
          title: article.title,
          keyword: article.keyword,
          outline: parseOutline(article.outline),
        });
        await prisma.article.update({
          where: { id: article.id },
          data: {
            title: draft.title,
            excerpt: draft.excerpt,
            body: draft.body,
            status: "drafted",
          },
        });
      }),
    );

    revalidateDashboard();
    return {
      planned: topics.length,
      // Un sujet qui n'a pas pu être rédigé reste « planifié » : le client le
      // relance d'un bouton, il ne perd rien.
      written: drafts.filter((draft) => draft.status === "fulfilled").length,
    };
  });

// ── Rattachement du site ─────────────────────────────────────────────────────

export const connectSiteAction = authActionClient
  .inputSchema(connectSiteSchema)
  .action(async ({ parsedInput, ctx }) => {
    const userId = ctx.auth.user.id;
    const connector = connectorFor(parsedInput.platform);
    if (!connector) throw new AppError("Plateforme inconnue.", "UNKNOWN_PLATFORM", 400);

    // Le formulaire grise les plateformes qui ne sont pas ouvertes ; l'inspecteur
    // du navigateur, lui, ne grise rien. Le refus tient ici.
    if (!connector.ready) {
      throw new AppError(
        `Le rattachement ${connector.name} n'est pas encore ouvert.`,
        "PLATFORM_NOT_READY",
        400,
      );
    }

    if (!isCredentialsKeySet()) {
      throw new AppError(
        "Le stockage sécurisé des identifiants n'est pas configuré sur ce serveur.",
        "NO_CREDENTIALS_KEY",
        500,
      );
    }

    const missing = connector.fields
      .filter((field) => field.required && !parsedInput.credentials[field.name]?.trim())
      .map((field) => field.name);
    if (missing.length) {
      throw new AppError(`Champs manquants : ${missing.join(", ")}.`, "MISSING_FIELDS", 400);
    }

    const credentials = parsedInput.credentials as Credentials;
    const verified = await verifyConnection(connector.id, credentials);

    const data = {
      platform: connector.id,
      siteUrl: verified.siteUrl ?? credentials.siteUrl ?? null,
      status: verified.ok ? "connected" : "error",
      lastError: verified.ok ? null : (verified.error ?? "Connexion refusée."),
      capabilities: verified.capabilities,
      credentials: verified.ok ? encryptJson(credentials) : null,
      connectedAt: verified.ok ? new Date() : null,
    };

    await prisma.siteConnection.upsert({
      where: { userId },
      create: { userId, ...data },
      // Un essai raté ne doit pas effacer un lien qui marchait : on garde les
      // identifiants précédents et on note seulement l'erreur.
      update: verified.ok ? data : { status: "error", lastError: data.lastError },
    });

    revalidateDashboard();
    return { ok: verified.ok, capabilities: verified.capabilities, error: data.lastError };
  });

export const disconnectSiteAction = authActionClient
  .inputSchema(disconnectSiteSchema)
  .action(async ({ ctx }) => {
    await prisma.siteConnection.deleteMany({ where: { userId: ctx.auth.user.id } });
    revalidateDashboard();
    return { ok: true };
  });

/**
 * Le rattachement en état de marche, ou une erreur qui dit laquelle.
 *
 * Les deux actions d'écriture ci-dessous commencent pareil : un lien vivant,
 * le droit de corriger, des identifiants lisibles. Autant le dire une fois.
 */
async function requireEditableLink(userId: string) {
  const link = await prisma.siteConnection.findUnique({ where: { userId } });
  if (!link || link.status !== "connected") {
    throw new AppError("Aucun site rattaché.", "NO_SITE_CONNECTION", 400);
  }
  if (!link.capabilities.includes("edit")) {
    throw new AppError(
      "Ce rattachement ne permet pas de corriger les pages.",
      "EDIT_UNSUPPORTED",
      400,
    );
  }

  const credentials = await readSiteCredentials<Credentials>(userId);
  if (!credentials) {
    throw new AppError(
      "Identifiants illisibles : refaites le rattachement.",
      "BAD_CREDENTIALS",
      400,
    );
  }

  return { link, credentials };
}

/**
 * Pose sur le site les textes on-page réécrits : balise title, méta
 * description, H1 et premier paragraphe de la page d'accueil.
 *
 * Les textes ne sont pas repris de l'écran mais recalculés ici depuis
 * l'analyse enregistrée : ce qui part sur le site du client est ce que l'audit
 * a proposé, pas ce qu'un formulaire aurait pu transporter en route.
 */
export const applyOnPageAction = authActionClient
  .inputSchema(disconnectSiteSchema)
  .action(async ({ ctx }) => {
    const userId = ctx.auth.user.id;
    await requireSection(userId, "architecture");
    const { link, credentials } = await requireEditableLink(userId);

    const context = await getDashboardContext(userId);
    const suggested = context.analysis?.trendingKeywords?.suggested;
    if (!suggested) {
      throw new AppError(
        "Aucune réécriture on-page disponible : relancez l'analyse de contenu.",
        "NO_REWRITE",
        400,
      );
    }

    const steps = await applyOnPage(link.platform, credentials, {
      title: suggested.title,
      metaDescription: suggested.metaDescription,
      h1: suggested.h1,
      firstParagraph: suggested.firstParagraph,
    });

    await prisma.siteConnection.update({
      where: { userId },
      data: {
        lastSyncAt: new Date(),
        lastError: steps.find((step) => step.status === "failed")?.detail ?? null,
      },
    });

    revalidateDashboard();
    return { steps };
  });

/**
 * Dépose les fichiers de structure manquants : /llms.txt, /robots.txt, et le
 * bloc JSON-LD de la page d'accueil.
 *
 * Ce que la plateforme refuse d'écrire ressort en « à faire à la main », avec
 * le contenu exact : c'est le cas de la racine chez Shopify, et des fichiers
 * de racine chez WordPress.
 */
export const applyStructureAction = authActionClient
  .inputSchema(disconnectSiteSchema)
  .action(async ({ ctx }) => {
    const userId = ctx.auth.user.id;
    // Les fichiers de structure sont le livrable du Coup de Boost : le voile
    // posé sur l'onglet ne les protège pas, la réponse renvoie leur contenu.
    await requireSection(userId, "architecture");
    const { link, credentials } = await requireEditableLink(userId);

    const context = await getDashboardContext(userId);
    if (!context.analysis) throw new AppError("Analyse indisponible.", "NO_ANALYSIS", 400);

    const files = buildStructureFiles(context.analysis);
    if (files.length === 0) {
      return { steps: [], files: [] };
    }

    const steps = await applyStructure(
      link.platform,
      credentials,
      files.map((file) => ({ kind: file.kind, path: file.path, content: file.content })),
    );

    await prisma.siteConnection.update({
      where: { userId },
      data: {
        lastSyncAt: new Date(),
        lastError: steps.find((step) => step.status === "failed")?.detail ?? null,
      },
    });

    revalidateDashboard();
    // Les contenus repartent avec la réponse : ce que la plateforme n'a pas
    // accepté, le client doit pouvoir le copier sans rouvrir un autre écran.
    return { steps, files };
  });

// ── Contenu ──────────────────────────────────────────────────────────────────

/** La réécriture on-page proposée pour la page d'accueil. */
export const rewriteOnPageAction = authActionClient
  .inputSchema(disconnectSiteSchema)
  .action(async ({ ctx }) => {
    // Une réécriture complète du on-page, sans compteur : c'est un appel au
    // modèle par clic. L'élément par élément, lui, a son quota
    // (`regenerateOnPageAction`) et reste ouvert au compte gratuit.
    await requireSection(ctx.auth.user.id, "architecture");
    const context = await getDashboardContext(ctx.auth.user.id);
    if (!context.analysis) throw new AppError("Analyse indisponible.", "NO_ANALYSIS", 400);
    return rewriteOnPage(context);
  });

/**
 * Une autre version d'un élément on-page, à la demande.
 *
 * Trois par élément et par jour : le plafond est vérifié ici, jamais dans le
 * composant — un bouton grisé côté client n'empêche personne d'appeler l'action.
 * La passe est réservée avant l'appel au modèle et rendue s'il échoue : un texte
 * qui n'arrive pas ne coûte rien, et deux clics simultanés ne peuvent pas
 * consommer deux fois la même place (cf. `quota.ts`).
 *
 * Le client d'action est celui de tout le tableau de bord, pas
 * `subscriberActionClient` : l'accès à la section est déjà la garde, et exiger
 * ici un abonnement Stripe actif renvoyait vers la page tarifs un client
 * pourtant assis devant son tableau de bord.
 */
export const regenerateOnPageAction = authActionClient
  .inputSchema(regenerateOnPageSchema)
  .action(async ({ parsedInput, ctx }) => {
    const userId = ctx.auth.user.id;
    const { element } = parsedInput;

    const context = await getDashboardContext(userId);

    const analysis = context.analysis;
    if (!analysis || !context.analysisId) {
      throw new AppError("Analyse indisponible.", "NO_ANALYSIS", 400);
    }
    const insight = analysis.trendingKeywords;
    if (!insight) {
      throw new AppError(
        "Les mots-clés de la niche ne sont pas encore relevés.",
        "NO_KEYWORDS",
        400,
      );
    }

    // La place est prise avant l'appel au modèle, pas après : deux clics
    // simultanés liraient sinon le même compteur et dépenseraient deux passes
    // pour une seule autorisée.
    const reservation = await reserveOnPageRewrite(userId, element);
    if (!reservation.ok) {
      // Deux refus différents, parce que ce ne sont pas les mêmes limites : le
      // compte gratuit a épuisé son unique essai — il n'y a pas de lendemain à
      // lui promettre —, l'abonné retrouvera son compteur demain matin.
      throw new AppError(
        tierAtLeast(reservation.tier, "boost")
          ? `Vous avez utilisé vos ${ON_PAGE_REWRITE_QUOTA.daily} réécritures du jour sur cet élément. Le compteur repart demain.`
          : `Votre offre gratuite comprend ${FREE_CONTENT_REWRITES} réécriture. Passez au Coup de Boost pour laisser les agents reprendre tout votre contenu.`,
        "QUOTA_EXCEEDED",
        429,
      );
    }

    let rewritten;
    try {
      rewritten = await regenerateOnPageElement(
        analysis.profile,
        analysis.signals,
        insight.keywords,
        element,
        insight.suggested,
        context.tone.summary,
      );
    } catch (error) {
      // Un appel qui échoue ne coûte pas une passe : la place est rendue.
      await releaseOnPageRewrite(reservation.id);
      throw error;
    }
    if (!rewritten) {
      await releaseOnPageRewrite(reservation.id);
      throw new AppError("La réécriture n'a rien donné. Réessayez.", "REWRITE_FAILED", 502);
    }

    const updated: GeoAnalysisResult = {
      ...analysis,
      trendingKeywords: { ...insight, suggested: { ...insight.suggested, ...rewritten } },
    };

    await prisma.analysis.update({
      where: { id: context.analysisId },
      data: { data: JSON.stringify(updated) },
    });

    revalidatePath(ROUTES.dashboardContent);
    return { remaining: reservation.remaining };
  });

// ── Articles ─────────────────────────────────────────────────────────────────

export const planArticlesAction = authActionClient
  .inputSchema(planArticlesSchema)
  .action(async ({ parsedInput, ctx }) => {
    const userId = ctx.auth.user.id;
    // Le voile posé sur l'onglet est une affaire d'écran ; c'est ce refus-ci qui
    // ferme réellement la rédaction à qui ne l'a pas payée.
    await requireSection(userId, "articles");
    const context = await contextForWriting(userId);
    const topics = await planArticleTopics(context, parsedInput.count);

    // Le planning reprend là où il s'arrête : le premier sujet tombe une période
    // après le dernier article déjà daté, pas aujourd'hui.
    const last = await prisma.article.findFirst({
      where: { userId, scheduledFor: { not: null } },
      orderBy: { scheduledFor: "desc" },
      select: { scheduledFor: true },
    });

    const start = last?.scheduledFor && last.scheduledFor > new Date() ? last.scheduledFor : new Date();
    const step = parsedInput.everyDays * 86_400_000;

    await prisma.article.createMany({
      data: topics.map((topic, index) => ({
        userId,
        title: topic.title,
        keyword: topic.keyword,
        outline: serializeOutline(
          topic.outline.map((heading) => ({ heading, level: 2 as const, instruction: "" })),
        ),
        excerpt: topic.angle,
        // Calé sur le passage de la file, comme les sujets du planning initial.
        // Une date posée entre deux passages n'avance rien : l'article attend
        // le suivant, et l'écart entre ce qu'annonce le calendrier et ce qui
        // se produit est exactement ce qu'on cherche à supprimer.
        scheduledFor: new Date(
          preferredPassOnDay(
            new Date(start.getTime() + step * (index + 1)).toISOString().slice(0, 10),
          ),
        ),
        status: "planned",
      })),
    });

    revalidatePath(ROUTES.dashboardArticles);
    return { added: topics.length };
  });

export const writeArticleAction = authActionClient
  .inputSchema(writeArticleSchema)
  .action(async ({ parsedInput, ctx }) => {
    const userId = ctx.auth.user.id;
    await requireSection(userId, "articles");
    const article = await prisma.article.findFirst({ where: { id: parsedInput.id, userId } });
    if (!article) throw new AppError("Article introuvable.", "NOT_FOUND", 404);

    // La place est prise avant l'appel au modèle, et rendue s'il échoue : une
    // rédaction qui n'aboutit pas ne coûte rien, et deux demandes lancées en
    // même temps ne peuvent pas consommer deux fois la dernière passe.
    const reservation = await reserveArticleGeneration(userId, article.id);
    if (!reservation.ok) {
      // Sans date de renouvellement, il n'y a rien à attendre : c'est la semaine
      // du Coup de Boost qui s'est refermée, et la suite s'appelle l'abonnement.
      const quota = await getArticleQuota(userId);
      throw new AppError(
        quota.renewsAt
          ? `Vous avez utilisé vos ${ARTICLE_QUOTAS.weekly} rédactions de la semaine. La prochaine se libère ${formatRenewal(quota.renewsAt)}.`
          : `Votre semaine de rédaction est terminée : les ${quota.limit} articles du Coup de Boost ont été écrits. L'abonnement Tout-en-un reprend la publication dans la durée.`,
        "ARTICLE_QUOTA",
        429,
      );
    }

    let draft;
    try {
      const context = await contextForWriting(userId);
      const outline = parseOutline(article.outline);
      draft = await writeArticle(
        context,
        { title: article.title, keyword: article.keyword, outline },
        parsedInput.instruction ?? null,
      );
    } catch (error) {
      await releaseArticleGeneration(reservation.id);
      throw error;
    }

    await prisma.article.update({
      where: { id: article.id },
      data: {
        title: draft.title,
        excerpt: draft.excerpt,
        body: draft.body,
        status: "drafted",
        revisions: article.body ? article.revisions + 1 : article.revisions,
      },
    });

    revalidatePath(ROUTES.dashboardArticles);
    revalidatePath(ROUTES.dashboardArticle(article.id));
    // L'atelier affiche la version rendue sans attendre le rechargement : sans
    // ce retour, le client verrait son ancien texte pendant la revalidation et
    // croirait la demande perdue.
    return {
      title: draft.title,
      body: draft.body,
      excerpt: draft.excerpt,
      remaining: reservation.remaining,
    };
  });

export const updateArticleAction = authActionClient
  .inputSchema(updateArticleSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { count } = await prisma.article.updateMany({
      where: { id: parsedInput.id, userId: ctx.auth.user.id },
      data: {
        title: parsedInput.title,
        body: parsedInput.body,
        excerpt: parsedInput.excerpt,
        scheduledFor: parsedInput.scheduledFor ? new Date(parsedInput.scheduledFor) : undefined,
        // Plan absent de l'envoi = plan inchangé. Une liste vide, elle, efface
        // volontairement le plan : c'est un geste du client, pas un oubli.
        outline: parsedInput.outline ? serializeOutline(parsedInput.outline) : undefined,
      },
    });
    if (!count) throw new AppError("Article introuvable.", "NOT_FOUND", 404);

    revalidatePath(ROUTES.dashboardArticle(parsedInput.id));
    revalidatePath(ROUTES.dashboardArticles);
    return { ok: true };
  });

/**
 * Valide un article — et pose sa date de départ si la modale en a fait choisir
 * une. Sans date, la file ne prendrait jamais l'article : la valider et la
 * dater sont une seule décision côté client, elles le restent ici.
 */
export const approveArticleAction = authActionClient
  .inputSchema(approveArticleSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { count } = await prisma.article.updateMany({
      where: { id: parsedInput.id, userId: ctx.auth.user.id, body: { not: "" } },
      data: {
        status: "approved",
        scheduledFor: parsedInput.scheduledFor ? new Date(parsedInput.scheduledFor) : undefined,
      },
    });
    if (!count) throw new AppError("Article introuvable ou pas encore rédigé.", "NOT_FOUND", 404);

    revalidatePath(ROUTES.dashboardArticles);
    revalidatePath(ROUTES.dashboardArticle(parsedInput.id));
    return { ok: true };
  });

/**
 * Déplace la date de publication d'un article.
 *
 * Le geste est réversible et sans effet de bord : il ne valide pas, ne rédige
 * pas, ne dépose rien. Un article validé et redaté repart simplement à la
 * nouvelle heure ; un sujet encore à écrire garde sa place au calendrier.
 *
 * La date passée est un instant complet, pas un jour : c'est l'écran qui a
 * composé le jour et l'heure dans le fuseau du client, et la file compare des
 * instants.
 */
export const scheduleArticleAction = authActionClient
  .inputSchema(scheduleArticleSchema)
  .action(async ({ parsedInput, ctx }) => {
    const userId = ctx.auth.user.id;
    await requireSection(userId, "articles");

    const { count } = await prisma.article.updateMany({
      // Un article déjà déposé n'a plus de date à venir : le redater laisserait
      // croire qu'il repartira, alors que la file écarte tout ce qui porte un
      // `publishedAt`.
      where: { id: parsedInput.id, userId, publishedAt: null },
      data: { scheduledFor: new Date(parsedInput.scheduledFor) },
    });
    if (!count) throw new AppError("Article introuvable ou déjà publié.", "NOT_FOUND", 404);

    revalidatePath(ROUTES.dashboardArticles);
    revalidatePath(ROUTES.dashboardArticle(parsedInput.id));
    return { ok: true };
  });

/**
 * Le pilote automatique : ce que la file s'autorise à déposer sans relecture.
 *
 * Fermé, elle ne dépose que les articles que le client a validés. Ouvert, elle
 * dépose aussi ceux qui sont rédigés et jamais ouverts. C'est un consentement,
 * et il se donne ici explicitement — jamais par défaut, jamais en effet de bord
 * d'un autre réglage.
 */
export const setAutoPublishAction = authActionClient
  .inputSchema(autoPublishSchema)
  .action(async ({ parsedInput, ctx }) => {
    const userId = ctx.auth.user.id;
    await requireSection(userId, "articles");

    const { count } = await prisma.siteConnection.updateMany({
      where: { userId },
      data: { autoPublish: parsedInput.autoPublish },
    });
    if (!count) throw new AppError("Aucun site rattaché.", "NO_SITE_CONNECTION", 400);

    revalidatePath(ROUTES.dashboardArticles);
    return { autoPublish: parsedInput.autoPublish };
  });

/** Dépose l'article sur le site du client, via le lien enregistré. */
export const publishArticleAction = authActionClient
  .inputSchema(articleIdSchema)
  .action(async ({ parsedInput, ctx }) => {
    const userId = ctx.auth.user.id;
    await requireSection(userId, "articles");
    const article = await prisma.article.findFirst({ where: { id: parsedInput.id, userId } });
    if (!article) throw new AppError("Article introuvable.", "NOT_FOUND", 404);
    if (!article.body) throw new AppError("Article encore vide.", "EMPTY_ARTICLE", 400);

    const link = await prisma.siteConnection.findUnique({ where: { userId } });
    if (!link || link.status !== "connected") {
      throw new AppError("Aucun site rattaché.", "NO_SITE_CONNECTION", 400);
    }
    if (!link.capabilities.includes("publish")) {
      throw new AppError(
        "Ce rattachement ne permet pas la publication automatique.",
        "PUBLISH_UNSUPPORTED",
        400,
      );
    }

    const credentials = await readSiteCredentials<Credentials>(userId);
    if (!credentials) {
      throw new AppError("Identifiants illisibles : refaites le rattachement.", "BAD_CREDENTIALS", 400);
    }

    const published = await publishArticle(link.platform, credentials, {
      title: article.title,
      body: article.body,
      excerpt: article.excerpt,
      slug: article.slug,
    });

    await prisma.article.update({
      where: { id: article.id },
      data: {
        status: "published",
        publishedAt: new Date(),
        externalUrl: published.url,
        externalId: published.externalId,
      },
    });
    await prisma.siteConnection.update({ where: { userId }, data: { lastSyncAt: new Date() } });

    revalidatePath(ROUTES.dashboardArticles);
    revalidatePath(ROUTES.dashboardArticle(article.id));
    return { url: published.url };
  });

export const rejectArticleAction = authActionClient
  .inputSchema(articleIdSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { count } = await prisma.article.updateMany({
      where: { id: parsedInput.id, userId: ctx.auth.user.id },
      data: { status: "rejected" },
    });
    if (!count) throw new AppError("Article introuvable.", "NOT_FOUND", 404);

    revalidatePath(ROUTES.dashboardArticles);
    return { ok: true };
  });

export const saveBrandVoiceAction = authActionClient
  .inputSchema(brandVoiceSchema)
  .action(async ({ parsedInput, ctx }) => {
    const userId = ctx.auth.user.id;
    await prisma.brandVoice.upsert({
      where: { userId },
      create: { userId, instructions: parsedInput.instructions, banned: parsedInput.banned },
      update: { instructions: parsedInput.instructions, banned: parsedInput.banned },
    });

    revalidatePath(ROUTES.dashboardArticles);
    return { ok: true };
  });

// ── Réglages ─────────────────────────────────────────────────────────────────

/**
 * Enregistre les réglages du compte : identité, fiche du commerce, ton.
 *
 * Trois tables, une seule écriture visible pour le client. La fiche d'accueil et
 * le ton sont créés au besoin : un compte ouvert avant ces champs n'a pas
 * forcément de ligne, et l'écran de réglages ne doit pas être le seul endroit
 * où ça se voit.
 *
 * Les pages du tableau de bord sont revalidées en bloc : la niche et le ton
 * nourrissent les prompts de presque toutes les sections.
 */
export const saveSettingsAction = authActionClient
  .inputSchema(settingsSchema)
  .action(async ({ parsedInput, ctx }) => {
    const userId = ctx.auth.user.id;

    // `null` plutôt que la chaîne vide : ailleurs, le code teste l'absence de
    // niche ou de description avec `??`, qu'une chaîne vide traverserait.
    const orNull = (value: string) => (value.length > 0 ? value : null);

    const profileFields = {
      businessKind: orNull(parsedInput.businessKind),
      niche: orNull(parsedInput.niche),
      targetMarket: orNull(parsedInput.targetMarket),
      description: orNull(parsedInput.description),
      audience: orNull(parsedInput.audience),
    };

    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { name: parsedInput.name } }),
      prisma.onboardingProfile.upsert({
        where: { userId },
        create: { userId, ...profileFields },
        update: profileFields,
      }),
      prisma.brandVoice.upsert({
        where: { userId },
        create: {
          userId,
          instructions: parsedInput.toneInstructions,
          banned: parsedInput.toneBanned,
        },
        update: {
          instructions: parsedInput.toneInstructions,
          banned: parsedInput.toneBanned,
        },
      }),
    ]);

    revalidatePath(ROUTES.dashboard, "layout");
    return { ok: true };
  });

// ── Présence web ─────────────────────────────────────────────────────────────

export const findProspectsAction = authActionClient
  .inputSchema(disconnectSiteSchema)
  .action(async ({ ctx }) => {
    const userId = ctx.auth.user.id;
    // La recherche coûte un appel au modèle et la liste se relit ensuite en
    // base : le voile de l'onglet ne suffit pas à la réserver à l'abonnement.
    await requireSection(userId, "presence");
    const context = await getDashboardContext(userId);
    const sites = await findProspects(context);

    // `createMany` avec `skipDuplicates` : relancer la recherche complète la
    // liste au lieu de la remplacer, et l'état d'un site déjà contacté survit.
    await prisma.outreachProspect.createMany({
      data: sites.map((site) => ({
        userId,
        domain: normalizeDomain(site.domain),
        name: site.name,
        reason: site.reason,
        contactEmail: site.contactEmail,
        contactUrl: site.contactUrl,
        authority: Math.round(site.authority),
      })),
      skipDuplicates: true,
    });

    const resolved = await resolveMissingContacts(userId);

    revalidatePath(ROUTES.dashboardPresence);
    return { found: sites.length, contacts: resolved };
  });

/**
 * Retrouve la page contact des sites qui n'en ont pas encore une.
 *
 * La liste vient d'un modèle : il connaît le site, rarement l'adresse exacte de
 * son formulaire. On va donc la chercher sur le site puis sur Google (voir
 * `lib/geo/contact-finder`), et on complète la fiche. La passe reprend aussi les
 * sites déjà en base — un compte ouvert avant cette recherche avait des lignes
 * sans contact, et c'est justement là qu'un client bloque.
 *
 * Quinze sites au plus par passe : chacun coûte quelques requêtes HTTP, et une
 * action serveur qui dépasse son budget ne rend rien du tout. Les suivants
 * seront servis à la prochaine recherche.
 */
async function resolveMissingContacts(userId: string): Promise<number> {
  const pending = await prisma.outreachProspect.findMany({
    where: { userId, contactUrl: null },
    select: { id: true, name: true, domain: true, contactEmail: true },
    orderBy: [{ authority: "desc" }, { createdAt: "desc" }],
    take: 15,
  });
  if (pending.length === 0) return 0;

  const points = await findContactPoints(
    pending.map((prospect) => ({ name: prospect.name, domain: prospect.domain })),
  );

  let updated = 0;
  for (const prospect of pending) {
    const point = points.get(normalizeDomain(prospect.domain));
    if (!point?.url && !point?.email) continue;
    // L'adresse déjà en base reste prioritaire : elle a pu être corrigée à la
    // main, et ce qu'on vient de lire ne vaut pas mieux qu'une saisie du client.
    const email = prospect.contactEmail ?? point.email;
    if (!point.url && email === prospect.contactEmail) continue;

    await prisma.outreachProspect.update({
      where: { id: prospect.id },
      data: { contactUrl: point.url, contactEmail: email },
    });
    updated += 1;
  }
  return updated;
}

export const draftProspectMessageAction = authActionClient
  .inputSchema(prospectDraftSchema)
  .action(async ({ parsedInput, ctx }) => {
    const userId = ctx.auth.user.id;
    await requireSection(userId, "presence");
    const prospect = await prisma.outreachProspect.findFirst({
      where: { id: parsedInput.id, userId },
    });
    if (!prospect) throw new AppError("Site introuvable.", "NOT_FOUND", 404);

    const context = await getDashboardContext(userId);
    const message = await draftOutreachMessage(context, {
      name: prospect.name,
      domain: prospect.domain,
      reason: prospect.reason,
      // Le jet précédent part avec la commande : sans lui, « réécrire » rendrait
      // le même message, et « autre sujet » reproposerait le même article.
      angle: parsedInput.angle,
      previous: parsedInput.angle ? prospect.message : null,
    });

    await prisma.outreachProspect.update({
      where: { id: prospect.id },
      data: {
        message: `${message.subject}\n\n${message.body}`,
        status: prospect.status === "found" ? "drafted" : prospect.status,
      },
    });

    revalidatePath(ROUTES.dashboardPresence);
    return message;
  });

export const setProspectStatusAction = authActionClient
  .inputSchema(prospectStatusSchema)
  .action(async ({ parsedInput, ctx }) => {
    const userId = ctx.auth.user.id;
    await requireSection(userId, "presence");
    const { count } = await prisma.outreachProspect.updateMany({
      where: { id: parsedInput.id, userId },
      data: {
        status: parsedInput.status,
        contactedAt: parsedInput.status === "contacted" ? new Date() : undefined,
      },
    });
    if (!count) throw new AppError("Site introuvable.", "NOT_FOUND", 404);

    revalidatePath(ROUTES.dashboardPresence);
    return { ok: true };
  });

// ── Google Maps ──────────────────────────────────────────────────────────────

const WEEKDAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

/**
 * La date de publication d'un post : la cadence, puis le bon jour.
 *
 * La cadence donne le rythme — un post par semaine — et le modèle donne le jour
 * qui a du sens pour ce post-là. On avance donc de la date théorique jusqu'au
 * prochain jour demandé, six jours au plus : décaler d'une poignée de jours pour
 * publier un post de week-end un samedi vaut mieux que le publier un mardi.
 *
 * Sans jour demandé, la date théorique tient telle quelle.
 */
function nextSlot(base: Date, weekday: string | null): Date {
  if (!weekday) return base;
  const target = WEEKDAYS.indexOf(weekday.toLowerCase());
  if (target === -1) return base;

  const shift = (target - base.getDay() + 7) % 7;
  return shift === 0 ? base : new Date(base.getTime() + shift * 86_400_000);
}

export const planGooglePostsAction = authActionClient
  .inputSchema(planGooglePostsSchema)
  .action(async ({ parsedInput, ctx }) => {
    const userId = ctx.auth.user.id;
    // Même raison que la présence web : la rédaction des posts coûte un appel
    // au modèle, et le calendrier produit se relit en base.
    await requireSection(userId, "maps");
    const [context, snapshot] = await Promise.all([
      getDashboardContext(userId),
      getMapsPlace(userId),
    ]);
    // La fiche donne les photos et ce que les avis retiennent. Sans relevé, les
    // posts s'écrivent quand même : ils sortent sans image, et le disent.
    const posts = await planGooglePosts(context, parsedInput.count, snapshot?.place ?? null);

    const last = await prisma.googlePost.findFirst({
      where: { userId, scheduledFor: { not: null } },
      orderBy: { scheduledFor: "desc" },
      select: { scheduledFor: true },
    });
    const start = last?.scheduledFor && last.scheduledFor > new Date() ? last.scheduledFor : new Date();
    const step = parsedInput.everyDays * 86_400_000;

    await prisma.googlePost.createMany({
      data: posts.map((post, index) => ({
        userId,
        title: post.title,
        body: post.body,
        keyword: post.keyword,
        cta: post.cta === "NONE" ? null : post.cta,
        imageUrl: post.imageUrl,
        scheduledFor: nextSlot(new Date(start.getTime() + step * (index + 1)), post.weekday),
      })),
    });

    revalidatePath(ROUTES.dashboardMaps);
    return { added: posts.length };
  });

export const approveGooglePostAction = authActionClient
  .inputSchema(googlePostIdSchema)
  .action(async ({ parsedInput, ctx }) => {
    const userId = ctx.auth.user.id;
    await requireSection(userId, "maps");
    const { count } = await prisma.googlePost.updateMany({
      where: { id: parsedInput.id, userId },
      data: { status: "approved" },
    });
    if (!count) throw new AppError("Post introuvable.", "NOT_FOUND", 404);

    revalidatePath(ROUTES.dashboardMaps);
    return { ok: true };
  });

/**
 * Relève la fiche Google Maps du commerce et la range en base.
 *
 * Le lien vient de la fiche d'accueil : c'est celui que le client a donné en
 * s'inscrivant. On le passe à Apify, qui ouvre la fiche comme un navigateur et
 * rend ce que Google montre — photos, horaires, attributs, avis. Le relevé
 * remplace le précédent : la fiche affichée est toujours la dernière connue.
 *
 * Deux gardes, parce que chaque relevé est un run Apify facturé :
 *   — le délai `MAPS_PLACE_COOLDOWN_MS` entre deux relevés du même lien, que
 *     `force` lève quand le client vient de corriger sa fiche ;
 *   — l'échec, enregistré dans `lastError` sans effacer le relevé précédent :
 *     une panne du scraper ne doit pas vider l'écran.
 */
/**
 * Enregistre le lien de la fiche, saisi depuis la page Google Maps elle-même.
 *
 * Un commerce qui reçoit du public arrive parfois ici sans avoir donné sa fiche
 * pendant l'accueil : le champ y était facultatif. Le renvoyer aux réglages
 * pour trois secondes de saisie, c'est lui faire quitter la page qu'il est venu
 * voir, et souvent ne pas l'y ramener. Il la donne donc ici, et le relevé part
 * dans la foulée.
 *
 * Le lien est normalisé avant d'être écrit : c'est cette forme que le scraper
 * reçoit, et une adresse raccourcie collée depuis un téléphone doit valoir la
 * même chose qu'une adresse longue copiée depuis un navigateur.
 */
export const saveMapsUrlAction = authActionClient
  .inputSchema(saveMapsUrlSchema)
  .action(async ({ parsedInput, ctx }) => {
    const userId = ctx.auth.user.id;

    let mapsUrl: string | null;
    try {
      mapsUrl = normalizeMapsUrl(parsedInput.mapsUrl);
    } catch (err) {
      if (err instanceof InvalidMapsUrlError) {
        throw new AppError(
          "Ce lien ne mène pas à une fiche Google Maps. Ouvrez votre fiche, touchez « Partager », puis collez le lien copié.",
          "INVALID_MAPS_URL",
          400,
        );
      }
      throw err;
    }

    if (!mapsUrl) {
      throw new AppError("Collez le lien de votre fiche.", "INVALID_MAPS_URL", 400);
    }

    await prisma.onboardingProfile.upsert({
      where: { userId },
      create: { userId, mapsUrl },
      update: { mapsUrl },
    });

    revalidatePath(ROUTES.dashboardMaps);
    return { mapsUrl };
  });

export const refreshMapsPlaceAction = authActionClient
  .inputSchema(refreshMapsPlaceSchema)
  .action(async ({ parsedInput, ctx }) => {
    const userId = ctx.auth.user.id;
    await requireSection(userId, "maps");

    if (!isApifyConfigured()) {
      throw new AppError(
        "Le relevé de fiche n'est pas configuré sur ce serveur.",
        "APIFY_NOT_CONFIGURED",
        503,
      );
    }

    const profile = await prisma.onboardingProfile.findUnique({
      where: { userId },
      select: { mapsUrl: true },
    });
    const mapsUrl = profile?.mapsUrl?.trim();
    if (!mapsUrl) {
      throw new AppError(
        "Aucun lien de fiche Google Maps enregistré. Ajoutez-le depuis vos réglages.",
        "NO_MAPS_URL",
        400,
      );
    }

    const existing = await prisma.mapsPlace.findUnique({ where: { userId } });
    const sameLink = existing?.mapsUrl === mapsUrl;
    const age = existing ? Date.now() - existing.fetchedAt.getTime() : Infinity;
    if (existing && sameLink && !parsedInput.force && age < MAPS_PLACE_COOLDOWN_MS) {
      const minutes = Math.max(1, Math.ceil((MAPS_PLACE_COOLDOWN_MS - age) / 60_000));
      throw new AppError(
        `Fiche relevée il y a moins d'une heure. Nouveau relevé possible dans ${minutes} min.`,
        "MAPS_PLACE_COOLDOWN",
        429,
      );
    }

    let place: GooglePlace | null;
    try {
      place = await fetchGooglePlace(mapsUrl);
    } catch (err) {
      const message =
        err instanceof ApifyError
          ? err.message
          : "Le relevé de la fiche a échoué. Réessayez dans quelques minutes.";
      // On note l'échec sans toucher au relevé précédent, s'il y en a un.
      if (existing) {
        await prisma.mapsPlace.update({ where: { userId }, data: { lastError: message } });
      }
      throw new AppError(message, "MAPS_PLACE_FAILED", 502);
    }

    if (!place) {
      throw new AppError(
        "Aucune fiche trouvée derrière ce lien. Vérifiez l'adresse de votre fiche Google Maps.",
        "MAPS_PLACE_NOT_FOUND",
        404,
      );
    }

    const data = {
      mapsUrl,
      placeId: place.placeId,
      title: place.title,
      rating: place.rating,
      reviewsCount: place.reviewsCount,
      payload: JSON.stringify(place),
      lastError: null,
      fetchedAt: new Date(),
    };
    await prisma.mapsPlace.upsert({ where: { userId }, create: { userId, ...data }, update: data });

    revalidatePath(ROUTES.dashboardMaps);
    return { title: place.title, reviewsCount: place.reviewsCount };
  });

/**
 * Écrit ce qu'il faut changer sur la fiche : le nom, les deux descriptions, et
 * le tri des attributs manquants.
 *
 * Deux appels au modèle, dans cet ordre : le tri des attributs d'abord, parce
 * que la réécriture des textes s'appuie sur ce que le commerce propose vraiment.
 * Ils partagent une seule ligne en base, relue telle quelle après un
 * rechargement — le client copie ces textes dans son back-office Google en
 * plusieurs fois, souvent sur plusieurs jours.
 */
export const writeMapsAdviceAction = authActionClient
  .inputSchema(disconnectSiteSchema)
  .action(async ({ ctx }) => {
    const userId = ctx.auth.user.id;
    await requireSection(userId, "maps");

    const [context, snapshot] = await Promise.all([
      getDashboardContext(userId),
      getMapsPlace(userId),
    ]);
    if (!snapshot) {
      throw new AppError(
        "Relevez d'abord votre fiche Google Maps : les propositions partent de son contenu.",
        "NO_MAPS_PLACE",
        400,
      );
    }

    const place = snapshot.place;
    const attributes = await adviseAttributes(context, place, auditAttributes(place));
    const advice = await writeListingAdvice(context, place);
    const payload: MapsAdvice = { ...advice, attributes };

    const data = { placeId: place.placeId, payload: JSON.stringify(payload) };
    await prisma.mapsOptimization.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });

    revalidatePath(ROUTES.dashboardMaps);
    return { title: payload.title };
  });

/**
 * Rédige une réponse pour chaque avis qui n'en a pas.
 *
 * Les avis auxquels le commerce a déjà répondu sont écartés : la réponse est en
 * ligne, et en proposer une autre ferait croire qu'il faut la remplacer. Ceux
 * dont la réponse est déjà validée ici le sont aussi — on ne réécrit pas un
 * texte que le client a relu.
 */
export const draftReviewRepliesAction = authActionClient
  .inputSchema(draftReviewRepliesSchema)
  .action(async ({ parsedInput, ctx }) => {
    const userId = ctx.auth.user.id;
    await requireSection(userId, "maps");

    const [context, snapshot, existing] = await Promise.all([
      getDashboardContext(userId),
      getMapsPlace(userId),
      prisma.mapsReviewReply.findMany({ where: { userId }, select: { reviewId: true, status: true } }),
    ]);
    if (!snapshot) {
      throw new AppError(
        "Relevez d'abord votre fiche Google Maps : les avis viennent de là.",
        "NO_MAPS_PLACE",
        400,
      );
    }

    const approved = new Set(
      existing.filter((row) => row.status === "approved").map((row) => row.reviewId),
    );
    const wanted = new Set(parsedInput.reviewIds);
    const targets = snapshot.place.reviews.filter((review) => {
      if (review.ownerResponse !== null) return false;
      if (approved.has(review.id)) return false;
      return wanted.size === 0 || wanted.has(review.id);
    });

    if (targets.length === 0) {
      throw new AppError(
        "Tous les avis relevés ont déjà une réponse.",
        "NO_REVIEW_TO_ANSWER",
        400,
      );
    }

    const replies = await draftReviewReplies(context, snapshot.place, targets);
    const byId = new Map(targets.map((review) => [review.id, review]));

    for (const reply of replies) {
      const review = byId.get(reply.reviewId);
      if (!review) continue;
      const data = {
        reviewerName: review.name,
        stars: Math.round(review.stars),
        reviewText: review.text,
        reply: reply.reply,
        status: "draft",
      };
      await prisma.mapsReviewReply.upsert({
        where: { userId_reviewId: { userId, reviewId: review.id } },
        create: { userId, reviewId: review.id, ...data },
        update: data,
      });
    }

    revalidatePath(ROUTES.dashboardMaps);
    return { drafted: replies.length };
  });

/** Marque une réponse comme relue : elle ne sera plus réécrite. */
export const approveReviewReplyAction = authActionClient
  .inputSchema(reviewReplySchema)
  .action(async ({ parsedInput, ctx }) => {
    const userId = ctx.auth.user.id;
    await requireSection(userId, "maps");

    const { count } = await prisma.mapsReviewReply.updateMany({
      where: { id: parsedInput.id, userId },
      data: { status: "approved" },
    });
    if (!count) throw new AppError("Réponse introuvable.", "NOT_FOUND", 404);

    revalidatePath(ROUTES.dashboardMaps);
    return { ok: true };
  });

/**
 * Relit les horaires affichés sur la page d'accueil et les confronte à la fiche.
 *
 * L'extraction porte sur le crawl déjà en base : la page d'accueil y est
 * enregistrée en markdown, et la recharger ferait attendre le client pour le
 * même texte. Sans crawl, on le dit plutôt que d'aller chercher le site à la
 * volée — c'est l'analyse qui explore, pas cet écran.
 */
export const readSiteHoursAction = authActionClient
  .inputSchema(readSiteHoursSchema)
  .action(async ({ ctx }) => {
    const userId = ctx.auth.user.id;
    const context = await getDashboardContext(userId);
    const domain = context.domain;
    if (!domain) {
      throw new AppError("Aucun site enregistré.", "NO_DOMAIN", 400);
    }

    const [text, snapshot] = await Promise.all([homepageText(domain), getMapsPlace(userId)]);
    if (!text) {
      throw new AppError(
        "La page d'accueil n'a pas encore été explorée. Relancez une analyse.",
        "NO_CRAWL",
        400,
      );
    }

    const check = await readSiteHours(text, snapshot?.place ?? null);
    const data = {
      domain,
      payload: JSON.stringify(check),
      absent: !check.found,
      fetchedAt: new Date(),
    };
    await prisma.siteHours.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });

    revalidatePath(ROUTES.dashboardContent);
    revalidatePath(ROUTES.dashboardMaps);
    return { found: check.found, conflicts: check.conflicts.length };
  });
