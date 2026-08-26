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
import { DASHBOARD_ENGINES, type GeoAnalysisResult } from "@/lib/geo/types";
import { publishArticle, verifyConnection, type Credentials } from "./connectors";
import { getArticleQuota, getDashboardContext, readSiteCredentials } from "./queries";
import { ARTICLE_QUOTAS } from "@/constants/plans";
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
 * L'analyse du site, lancée avant la première ouverture du tableau de bord.
 *
 * Le tunnel d'accueil a déjà crawlé le site ; ce qui manque ici, c'est l'audit
 * GEO complet, celui qui alimente les onglets Contenu et Architecture. Refaire
 * l'analyse à chaque visite n'aurait pas de sens : elle n'est déclenchée que
 * lorsque le compte n'en a aucune sur son domaine.
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

    const existing = await prisma.analysis.findFirst({
      where: { userId, ...(profile.domain ? { domain: profile.domain } : {}) },
      select: { id: true },
    });
    if (existing) return { id: existing.id };

    const mode = profile.businessKind === "online" ? "online" : "physical";
    const signals = await collectSignals(profile.siteUrl);
    const result = await analyzeSite(
      signals,
      {
        mode,
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

    const record = await prisma.analysis.create({
      data: {
        url: result.url,
        domain: result.domain,
        businessName: result.businessName,
        businessType: result.businessType,
        mapsUrl: profile.mapsUrl ?? null,
        overallScore: result.overallScore,
        data: JSON.stringify({ ...result, mapsUrl: profile.mapsUrl ?? null, tier: "paid" }),
        unlocked: true,
        userId,
      },
      select: { id: true },
    });

    revalidateDashboard();
    return { id: record.id };
  });

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
    const { engines, liveQuery } = await refreshEngineRankings(stored, {
      declared: {
        niche: profile?.niche ?? null,
        location: isPhysical ? (profile?.cities[0] ?? null) : null,
        isPhysical,
      },
      engines: DASHBOARD_ENGINES,
    });

    await prisma.analysis.update({
      where: { id: record.id },
      data: {
        data: JSON.stringify({
          ...stored,
          engines,
          liveQuery,
          rankingsCheckedAt: new Date().toISOString(),
        }),
      },
    });

    revalidateDashboard();
    return { measured: engines.filter((engine) => engine.measured).length };
  });

// ── Mois éditorial d'accueil ─────────────────────────────────────────────────

/** Trois publications par semaine : lundi, mercredi, vendredi. */
const SEED_WEEKDAYS = [1, 3, 5] as const;
/** Quatre semaines : le mois entier est posé avant la première visite. */
const SEED_WEEKS = 4;
const SEED_COUNT = SEED_WEEKDAYS.length * SEED_WEEKS;
/** Publication à 9 h : l'heure où le planning se lit comme un agenda. */
const SEED_HOUR = 9;

/**
 * Les douze dates du mois, à partir du lundi qui vient.
 *
 * On part toujours d'un lundi, jamais d'« aujourd'hui plus sept jours » : un
 * planning qui tombe le mardi puis le jeudi puis le samedi ne se lit pas comme
 * un calendrier éditorial, et le client ne sait plus quel jour il publie.
 */
function seedSchedule(from: Date): Date[] {
  const monday = new Date(from);
  monday.setHours(SEED_HOUR, 0, 0, 0);
  // getDay() : 0 = dimanche. Le lundi suivant est à 1..7 jours d'ici, jamais
  // aujourd'hui — le premier article doit laisser le temps de la relecture.
  monday.setDate(monday.getDate() + ((8 - monday.getDay()) % 7 || 7));

  const dates: Date[] = [];
  for (let week = 0; week < SEED_WEEKS; week += 1) {
    for (const weekday of SEED_WEEKDAYS) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + week * 7 + (weekday - 1));
      dates.push(date);
    }
  }
  return dates;
}

/**
 * Le mois d'articles posé avant la première ouverture du tableau de bord.
 *
 * Un calendrier vide, à l'arrivée, demande au client de deviner quoi écrire :
 * c'est exactement le travail qu'il vient de déléguer. Douze sujets sont donc
 * planifiés d'un coup — trois par semaine sur quatre semaines — et les trois de
 * la première semaine sont rédigés dans la foulée, pour qu'il ait du texte à
 * lire, pas seulement des titres.
 *
 * Ces trois rédactions ne sont pas décomptées du quota hebdomadaire : elles
 * sont offertes avec la mise en route, et un client qui arriverait à zéro
 * passe ne pourrait plus rien reprendre de sa semaine.
 *
 * L'action est sans effet si le compte a déjà des articles : elle est appelée
 * juste après l'analyse d'entrée, qui peut être rejouée.
 */
export const seedEditorialMonthAction = authActionClient
  .inputSchema(disconnectSiteSchema)
  .action(async ({ ctx }) => {
    const userId = ctx.auth.user.id;

    const existing = await prisma.article.count({ where: { userId } });
    if (existing > 0) return { planned: 0, written: 0 };

    const context = await getDashboardContext(userId);
    const topics = await planArticleTopics(context, SEED_COUNT);
    const dates = seedSchedule(new Date());

    await prisma.article.createMany({
      data: topics.slice(0, SEED_COUNT).map((topic, index) => ({
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

    // Les trois premiers du planning, rédigés ensemble : trois appels en
    // parallèle tiennent dans le budget de la préparation, trois à la suite
    // non.
    const firstWeek = await prisma.article.findMany({
      where: { userId },
      orderBy: { scheduledFor: "asc" },
      take: SEED_WEEKDAYS.length,
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

// ── Contenu ──────────────────────────────────────────────────────────────────

/** La réécriture on-page proposée pour la page d'accueil. */
export const rewriteOnPageAction = authActionClient
  .inputSchema(disconnectSiteSchema)
  .action(async ({ ctx }) => {
    const context = await getDashboardContext(ctx.auth.user.id);
    if (!context.analysis) throw new AppError("Analyse indisponible.", "NO_ANALYSIS", 400);
    return rewriteOnPage(context);
  });

// ── Articles ─────────────────────────────────────────────────────────────────

export const planArticlesAction = authActionClient
  .inputSchema(planArticlesSchema)
  .action(async ({ parsedInput, ctx }) => {
    const userId = ctx.auth.user.id;
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
    const article = await prisma.article.findFirst({ where: { id: parsedInput.id, userId } });
    if (!article) throw new AppError("Article introuvable.", "NOT_FOUND", 404);

    // Le quota se vérifie avant l'appel au modèle, pas après : une rédaction
    // refusée ne doit rien coûter.
    const quota = await getArticleQuota(userId);
    if (quota.remaining <= 0) {
      throw new AppError(
        `Vous avez utilisé vos ${ARTICLE_QUOTAS.weekly} rédactions de la semaine. La prochaine se libère ${formatRenewal(quota.renewsAt)}.`,
        "ARTICLE_QUOTA",
        429,
      );
    }

    const context = await getDashboardContext(userId);
    const outline = parseOutline(article.outline);
    const draft = await writeArticle(
      context,
      { title: article.title, keyword: article.keyword, outline },
      parsedInput.instruction ?? null,
    );

    await prisma.$transaction([
      prisma.article.update({
        where: { id: article.id },
        data: {
          title: draft.title,
          excerpt: draft.excerpt,
          body: draft.body,
          status: "drafted",
          revisions: article.body ? article.revisions + 1 : article.revisions,
        },
      }),
      // La passe n'est décomptée qu'une fois le texte obtenu : un modèle qui
      // échoue ne doit pas consommer la semaine du client.
      prisma.articleGeneration.create({ data: { userId, articleId: article.id } }),
    ]);

    revalidatePath(ROUTES.dashboardArticles);
    revalidatePath(ROUTES.dashboardArticle(article.id));
    // L'atelier affiche la version rendue sans attendre le rechargement : sans
    // ce retour, le client verrait son ancien texte pendant la revalidation et
    // croirait la demande perdue.
    return {
      title: draft.title,
      body: draft.body,
      excerpt: draft.excerpt,
      remaining: quota.remaining - 1,
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

// ── Présence web ─────────────────────────────────────────────────────────────

export const findProspectsAction = authActionClient
  .inputSchema(disconnectSiteSchema)
  .action(async ({ ctx }) => {
    const userId = ctx.auth.user.id;
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
    const { count } = await prisma.outreachProspect.updateMany({
      where: { id: parsedInput.id, userId: ctx.auth.user.id },
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
    const { count } = await prisma.googlePost.updateMany({
      where: { id: parsedInput.id, userId: ctx.auth.user.id },
      data: { status: "approved" },
    });
    if (!count) throw new AppError("Post introuvable.", "NOT_FOUND", 404);

    revalidatePath(ROUTES.dashboardMaps);
    return { ok: true };
  });
