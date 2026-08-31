"use server";

import { revalidatePath } from "next/cache";
import { authActionClient } from "@/lib/safe-action";
import { prisma } from "@/lib/prisma";
import { ROUTES } from "@/constants/routes";
import { AppError } from "@/lib/errors";
import { encryptJson, isCredentialsKeySet } from "@/lib/crypto";
import { connectorFor } from "@/constants/site-platforms";
import { collectSignals } from "@/lib/geo/fetcher";
import { analyzeSite, refreshEngineRankings } from "@/lib/geo/analyzer";
import { regenerateOnPageElement } from "@/lib/geo/keywords";
import { DASHBOARD_ENGINES, type GeoAnalysisResult } from "@/lib/geo/types";
import { publishArticle, verifyConnection, type Credentials } from "./connectors";
import { applyOnPage, applyStructure } from "./site-sync";
import { buildStructureFiles } from "@/lib/geo/structure-files";
import { getArticleQuota, getDashboardContext, readSiteCredentials } from "./queries";
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
  articleIdSchema,
  brandVoiceSchema,
  connectSiteSchema,
  disconnectSiteSchema,
  googlePostIdSchema,
  planArticlesSchema,
  planGooglePostsSchema,
  prospectIdSchema,
  prospectStatusSchema,
  regenerateOnPageSchema,
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
        // L'étape « tonalité » précède le tableau de bord : quand elle a
        // abouti, les correctifs on-page de l'audit sont écrits dans la voix du
        // client, pas dans celle d'un modèle.
        brandTone: profile.toneSummary,
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

    revalidateDashboard();
    return { id: record.id };
  });

/** Le niveau d'accès inscrit dans une analyse enregistrée, s'il l'a été. */
function readAnalysisTier(raw: string): AccessTier | null {
  try {
    return (JSON.parse(raw) as { accessTier?: AccessTier }).accessTier ?? null;
  } catch {
    return null;
  }
}

/**
 * Relève à nouveau la place du commerce dans ChatGPT et Gemini.
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
    // grounding Google Search, sans appel facturé en plus. ChatGPT consomme un
    // appel à l'outil de recherche d'OpenAI par passage — il n'est donc pas
    // exécuté, et sa carte reste voilée plutôt que remplie d'un chiffre inventé.
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
/** Publication à 9 h : l'heure où le planning se lit comme un agenda. */
const SEED_HOUR = 9;
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
  const monday = new Date(from);
  monday.setHours(SEED_HOUR, 0, 0, 0);
  // getDay() : 0 = dimanche. Le lundi suivant est à 1..7 jours d'ici, jamais
  // aujourd'hui — le premier article doit laisser le temps de la relecture.
  monday.setDate(monday.getDate() + ((8 - monday.getDay()) % 7 || 7));

  const dates: Date[] = [];
  for (let index = 0; index < count; index += 1) {
    const week = Math.floor(index / SEED_WEEKDAYS.length);
    const weekday = SEED_WEEKDAYS[index % SEED_WEEKDAYS.length];
    const date = new Date(monday);
    date.setDate(monday.getDate() + week * 7 + (weekday - 1));
    dates.push(date);
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

    const context = await getDashboardContext(userId);
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
    const context = await getDashboardContext(userId);
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
        scheduledFor: new Date(start.getTime() + step * (index + 1)),
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
      const context = await getDashboardContext(userId);
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

export const approveArticleAction = authActionClient
  .inputSchema(articleIdSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { count } = await prisma.article.updateMany({
      where: { id: parsedInput.id, userId: ctx.auth.user.id, body: { not: "" } },
      data: { status: "approved" },
    });
    if (!count) throw new AppError("Article introuvable ou pas encore rédigé.", "NOT_FOUND", 404);

    revalidatePath(ROUTES.dashboardArticles);
    revalidatePath(ROUTES.dashboardArticle(parsedInput.id));
    return { ok: true };
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
        domain: site.domain.replace(/^https?:\/\//, "").replace(/\/.*$/, ""),
        name: site.name,
        reason: site.reason,
        contactEmail: site.contactEmail,
        contactUrl: site.contactUrl,
        authority: Math.round(site.authority),
      })),
      skipDuplicates: true,
    });

    revalidatePath(ROUTES.dashboardPresence);
    return { found: sites.length };
  });

export const draftProspectMessageAction = authActionClient
  .inputSchema(prospectIdSchema)
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

export const planGooglePostsAction = authActionClient
  .inputSchema(planGooglePostsSchema)
  .action(async ({ parsedInput, ctx }) => {
    const userId = ctx.auth.user.id;
    // Même raison que la présence web : la rédaction des posts coûte un appel
    // au modèle, et le calendrier produit se relit en base.
    await requireSection(userId, "maps");
    const context = await getDashboardContext(userId);
    const posts = await planGooglePosts(context, parsedInput.count);

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
        scheduledFor: new Date(start.getTime() + step * (index + 1)),
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
