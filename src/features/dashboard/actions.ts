"use server";

import { revalidatePath } from "next/cache";
import { authActionClient } from "@/lib/safe-action";
import { prisma } from "@/lib/prisma";
import { ROUTES } from "@/constants/routes";
import { AppError } from "@/lib/errors";
import { encryptJson, isCredentialsKeySet } from "@/lib/crypto";
import { connectorFor } from "@/constants/site-platforms";
import { collectSignals } from "@/lib/geo/fetcher";
import { analyzeSite } from "@/lib/geo/analyzer";
import { publishArticle, verifyConnection, type Credentials } from "./connectors";
import { getDashboardContext, readSiteCredentials } from "./queries";
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
      select: { siteUrl: true, domain: true, businessKind: true, mapsUrl: true },
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
    const result = await analyzeSite(signals, { mode, mapsUrl: profile.mapsUrl ?? null }, "paid");

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
        outline: JSON.stringify(topic.outline),
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

    const context = await getDashboardContext(userId);
    const outline = article.outline ? (JSON.parse(article.outline) as string[]) : [];
    const draft = await writeArticle(
      context,
      { title: article.title, keyword: article.keyword, outline },
      parsedInput.instruction ?? null,
    );

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
    return { ok: true };
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
