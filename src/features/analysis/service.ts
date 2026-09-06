import "server-only";

import {
  collectSignals,
  normalizeUrl,
  assertPublicUrl,
  BlockedUrlError,
} from "@/lib/geo/fetcher";
import { analyzeSite } from "@/lib/geo/analyzer";
import { normalizeMapsUrl, InvalidMapsUrlError } from "@/lib/geo/maps";
import type { AnalysisContext } from "@/lib/geo/analyzer";
import type { BusinessMode, GeoAnalysisResult } from "@/lib/geo/types";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { captureLead, normalizeEmail } from "@/features/leads/service";
import { ANALYSIS_QUOTAS, type PlanKey } from "@/constants/plans";

/** Utilisateur minimal requis pour décider du quota. */
export type AnalysisActor = { id: string; plan: PlanKey } | null;

export type AnalysisResult =
  | {
      ok: true;
      id: string;
      /**
       * Vrai quand l'analyse n'a pas été refaite : c'est celle que ce visiteur
       * avait déjà de ce site, rouverte telle quelle.
       */
      reused?: boolean;
    }
  | { ok: false; reason: "invalid_url"; status: 400 }
  | { ok: false; reason: "invalid_maps_url"; status: 400 }
  | { ok: false; reason: "blocked_url"; status: 400; detail: string }
  | { ok: false; reason: "anon_quota"; status: 429 }
  | {
      ok: false;
      reason: "already_used";
      status: 409;
      /** L'analyse déjà obtenue, pour y renvoyer plutôt que de refuser sec. */
      analysisId: string | null;
    }
  | { ok: false; reason: "quota_exceeded"; status: 402; plan: PlanKey }
  | { ok: false; reason: "failed"; status: 500 };

/**
 * L'analyse gratuite est-elle encore disponible ?
 *
 * Trois cas, dans cet ordre. Un visiteur qui a déjà son analyse en poche
 * (cookie) est renvoyé dessus : il ne recommence pas, mais il ne perd pas non
 * plus son rapport. Un visiteur anonyme sans cookie passe le garde-fou par IP,
 * qui n'attrape que la rafale. Un compte gratuit, enfin, a droit à une analyse
 * dans toute sa vie : au-delà, c'est l'abonnement.
 */
async function checkQuota(
  actor: AnalysisActor,
  ip: string,
  usedAnalysisId: string | null,
): Promise<Extract<AnalysisResult, { ok: false }> | null> {
  if (!actor) {
    if (usedAnalysisId) {
      return { ok: false, reason: "already_used", status: 409, analysisId: usedAnalysisId };
    }
    const { limit, windowMs } = ANALYSIS_QUOTAS.anon;
    const res = rateLimit(`anon:${ip}`, limit, windowMs);
    if (!res.ok) return { ok: false, reason: "anon_quota", status: 429 };
    return null;
  }

  // Le compte gratuit garde l'aperçu partiel de son unique analyse ; refaire la
  // mesure, sur ce site ou sur un autre, relève de l'abonnement.
  if (actor.plan === "free") {
    const count = await prisma.analysis.count({ where: { userId: actor.id } });
    if (count >= ANALYSIS_QUOTAS.free.lifetime) {
      return { ok: false, reason: "quota_exceeded", status: 402, plan: actor.plan };
    }
  }
  // pro (abonné) et agency : illimité
  return null;
}

/**
 * L'analyse que ce visiteur a déjà de ce site, s'il en a une.
 *
 * Un même site ne se mesure qu'une fois par personne. Sans ce repêchage, celui
 * qui recolle son adresse — parce qu'il a fermé l'onglet, perdu le lien, ou
 * simplement recommencé depuis l'accueil — repartait pour un crawl complet et
 * repartait avec un deuxième rapport du même site, sur une autre adresse, aux
 * notes légèrement différentes. Deux vérités pour un seul site : il n'y en a
 * qu'une, et c'est celle-là qu'on rouvre.
 *
 * Le repêchage reste strictement personnel, et c'est délibéré. Une analyse
 * anonyme se débloque en la payant, et son déblocage récrit le rapport en place
 * : rendre une ligne à quelqu'un d'autre que son auteur ferait passer l'achat
 * de l'un pour le rapport complet de l'autre.
 *
 * Deux chemins seulement, donc, et tous deux sont des preuves : la session du
 * compte, ou le cookie déposé au moment de l'analyse. L'adresse e-mail saisie
 * dans le formulaire n'en est pas une — elle se tape, et taper celle d'un
 * inconnu suffirait à repartir avec son rapport. Un visiteur qui a effacé ses
 * cookies refait donc son analyse : c'est le prix à payer pour que personne ne
 * puisse réclamer celle d'autrui.
 */
async function findReusableAnalysis(params: {
  actor: AnalysisActor;
  domain: string;
  mapsUrl: string | null;
  usedAnalysisId: string | null;
}): Promise<string | null> {
  const { actor, domain, mapsUrl, usedAnalysisId } = params;

  // La fiche Google est une donnée en plus. Quand le visiteur en apporte une
  // que l'ancienne mesure n'avait pas, il demande bien autre chose : la mesure
  // repart plutôt que de lui rendre un rapport aveugle sur sa fiche.
  const sameMaps = (stored: string | null) => mapsUrl === null || stored === mapsUrl;

  if (actor) {
    // Les offres payantes remesurent quand elles veulent — c'est ce qu'elles
    // achètent. Le compte gratuit, lui, a une analyse à vie : la lui rendre
    // vaut mieux que de l'envoyer sur la page des tarifs pour un site qu'il a
    // déjà fait mesurer.
    if (actor.plan !== "free") return null;

    const own = await prisma.analysis.findFirst({
      where: { userId: actor.id, domain },
      orderBy: { createdAt: "desc" },
      select: { id: true, mapsUrl: true },
    });
    return own && sameMaps(own.mapsUrl) ? own.id : null;
  }

  // Le cookie de l'analyse gratuite : le chemin le plus sûr, c'est le sien.
  if (usedAnalysisId) {
    const cookied = await prisma.analysis.findUnique({
      where: { id: usedAnalysisId },
      select: { id: true, domain: true, mapsUrl: true },
    });
    if (cookied && cookied.domain === domain && sameMaps(cookied.mapsUrl)) {
      return cookied.id;
    }
  }

  return null;
}

/**
 * Orchestration complète d'une analyse GEO : validation d'URL → anti-SSRF →
 * repêchage → quota → collecte de signaux → analyse → persistance.
 *
 * Le repêchage passe avant le quota : rouvrir sa propre analyse d'un site déjà
 * mesuré ne coûte rien et ne consomme donc rien.
 *
 * Aucune dépendance au framework (pas de NextResponse) : réutilisable en route ou server action.
 */
export async function runAnalysis(params: {
  rawUrl: string;
  rawMapsUrl?: string | null;
  /** E-mail laissé par un visiteur non connecté avant de lancer l'analyse. */
  leadEmail?: string | null;
  mode?: BusinessMode;
  actor: AnalysisActor;
  ip: string;
  /**
   * L'analyse gratuite déjà consommée par ce navigateur, lue dans le cookie.
   * `null` pour un visiteur qui n'en a jamais lancé.
   */
  usedAnalysisId?: string | null;
}): Promise<AnalysisResult> {
  const mode: BusinessMode = params.mode === "online" ? "online" : "physical";
  let url: string;
  try {
    url = normalizeUrl(params.rawUrl);
  } catch {
    return { ok: false, reason: "invalid_url", status: 400 };
  }

  let mapsUrl: string | null;
  try {
    // La fiche Maps n'a de sens que pour un commerce physique.
    mapsUrl = mode === "physical" ? normalizeMapsUrl(params.rawMapsUrl) : null;
  } catch (err) {
    if (err instanceof InvalidMapsUrlError) {
      return { ok: false, reason: "invalid_maps_url", status: 400 };
    }
    throw err;
  }

  try {
    await assertPublicUrl(url);
  } catch (err) {
    const detail =
      err instanceof BlockedUrlError ? err.message : "URL non autorisée.";
    return { ok: false, reason: "blocked_url", status: 400, detail };
  }

  // Visiteur anonyme : son e-mail est rattaché à l'analyse (même colonne que
  // l'e-mail de paiement invité). Une saisie farfelue est simplement ignorée.
  const guestEmail = params.actor ? null : normalizeEmail(params.leadEmail);
  const domain = new URL(url).hostname.replace(/^www\./, "");

  // Le même site, déjà mesuré pour ce visiteur : on le rouvre. Avant le quota,
  // parce que rouvrir son propre rapport ne consomme rien — ni crawl, ni
  // analyse, ni le droit à la mesure qu'il n'a pas encore utilisé.
  const reusable = await findReusableAnalysis({
    actor: params.actor,
    domain,
    mapsUrl,
    usedAnalysisId: params.usedAnalysisId ?? null,
  });

  if (reusable) {
    // L'adresse repart quand même vers la liste de diffusion : elle vit hors du
    // cycle des analyses, et le visiteur vient de la donner à nouveau.
    if (guestEmail) await rememberLead(guestEmail, domain, reusable);
    return { ok: true, id: reusable, reused: true };
  }

  const quotaFailure = await checkQuota(
    params.actor,
    params.ip,
    params.usedAnalysisId ?? null,
  );
  if (quotaFailure) return quotaFailure;

  try {
    const signals = await collectSignals(url);
    // Toujours "free" à la création : aucun appel payant (audit DeepSeek, moteurs live)
    // tant que l'analyse n'est pas débloquée — voir `ensurePaidAnalysis`.
    const result = await analyzeSite(signals, { mode, mapsUrl }, "free");

    const record = await prisma.analysis.create({
      data: {
        url: result.url,
        domain: result.domain,
        businessName: result.businessName,
        businessType: result.businessType,
        mapsUrl,
        overallScore: result.overallScore,
        data: JSON.stringify({ ...result, mapsUrl, tier: "free" }),
        guestEmail,
        userId: params.actor?.id ?? null,
      },
    });

    if (guestEmail) await rememberLead(guestEmail, result.domain, record.id);

    return { ok: true, id: record.id };
  } catch (err) {
    console.error("Erreur d'analyse :", err);
    return { ok: false, reason: "failed", status: 500 };
  }
}

/**
 * Liste de diffusion : une ligne par adresse, hors du cycle de vie des analyses.
 *
 * Best-effort — une erreur ici ne doit pas priver le visiteur du rapport qu'il
 * vient d'attendre.
 */
async function rememberLead(
  email: string,
  domain: string,
  analysisId: string,
): Promise<void> {
  try {
    await captureLead({ email, domain, analysisId });
  } catch (err) {
    console.error("Enregistrement du lead échoué :", err);
  }
}

/**
 * Déclenche l'audit complet (DeepSeek + moteurs live) pour une analyse déjà
 * débloquée, si ce n'est pas déjà fait. Idempotent — best-effort : en cas
 * d'échec, l'analyse gratuite déjà en base reste affichée.
 */
export async function ensurePaidAnalysis(analysisId: string): Promise<void> {
  const existing = await prisma.analysis.findUnique({ where: { id: analysisId } });
  if (!existing) return;

  let stored: GeoAnalysisResult & { mapsUrl?: string | null; tier?: "free" | "paid" };
  try {
    stored = JSON.parse(existing.data);
  } catch {
    return;
  }
  if (stored.tier === "paid") return;

  // Une analyse débloquée après paiement peut appartenir à un client qui a déjà
  // fait son accueil : sa tonalité sert alors aux correctifs on-page. Pour un
  // visiteur anonyme il n'y en a pas, et les correctifs restent neutres.
  const profile = existing.userId
    ? await prisma.onboardingProfile.findUnique({
        where: { userId: existing.userId },
        select: { toneSummary: true },
      })
    : null;

  const ctx: AnalysisContext = {
    mode: stored.profile.mode,
    mapsUrl: stored.mapsUrl ?? null,
    brandTone: profile?.toneSummary ?? null,
  };

  try {
    const result = await analyzeSite(stored.signals, ctx, "paid");
    await prisma.analysis.update({
      where: { id: analysisId },
      data: {
        businessName: result.businessName,
        businessType: result.businessType,
        overallScore: result.overallScore,
        data: JSON.stringify({ ...result, mapsUrl: stored.mapsUrl ?? null, tier: "paid" }),
      },
    });
  } catch (err) {
    console.error("Audit payant échoué :", err);
  }
}
