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
import { ANALYSIS_QUOTAS, type PlanKey } from "@/constants/plans";

/** Utilisateur minimal requis pour décider du quota. */
export type AnalysisActor = { id: string; plan: PlanKey } | null;

export type AnalysisResult =
  | { ok: true; id: string }
  | { ok: false; reason: "invalid_url"; status: 400 }
  | { ok: false; reason: "invalid_maps_url"; status: 400 }
  | { ok: false; reason: "blocked_url"; status: 400; detail: string }
  | { ok: false; reason: "anon_quota"; status: 429 }
  | { ok: false; reason: "quota_exceeded"; status: 402; plan: PlanKey }
  | { ok: false; reason: "failed"; status: 500 };

/** Vérifie le quota anonyme (par IP) puis par plan. Retourne un échec ou null. */
async function checkQuota(
  actor: AnalysisActor,
  ip: string,
): Promise<Extract<AnalysisResult, { ok: false }> | null> {
  if (!actor) {
    const { limit, windowMs } = ANALYSIS_QUOTAS.anon;
    const res = rateLimit(`anon:${ip}`, limit, windowMs);
    if (!res.ok) return { ok: false, reason: "anon_quota", status: 429 };
    return null;
  }

  // Les analyses restent gratuites (aperçu partiel) : le quota ne sert qu'à
  // contenir les abus. Le paiement, lui, débloque une analyse déjà lancée.
  if (actor.plan === "free" || actor.plan === "pro") {
    const monthly =
      actor.plan === "free" ? ANALYSIS_QUOTAS.free.monthly : ANALYSIS_QUOTAS.pro.monthly;
    const since = new Date();
    since.setMonth(since.getMonth() - 1);
    const count = await prisma.analysis.count({
      where: { userId: actor.id, createdAt: { gte: since } },
    });
    if (count >= monthly) {
      return { ok: false, reason: "quota_exceeded", status: 402, plan: actor.plan };
    }
  }
  // agency : illimité
  return null;
}

/**
 * Orchestration complète d'une analyse GEO :
 * validation d'URL → anti-SSRF → quota → collecte de signaux → analyse → persistance.
 * Aucune dépendance au framework (pas de NextResponse) : réutilisable en route ou server action.
 */
export async function runAnalysis(params: {
  rawUrl: string;
  rawMapsUrl?: string | null;
  mode?: BusinessMode;
  actor: AnalysisActor;
  ip: string;
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

  const quotaFailure = await checkQuota(params.actor, params.ip);
  if (quotaFailure) return quotaFailure;

  try {
    const signals = await collectSignals(url);
    // Toujours "free" à la création : aucun appel payant (Claude, moteurs live)
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
        userId: params.actor?.id ?? null,
      },
    });

    return { ok: true, id: record.id };
  } catch (err) {
    console.error("Erreur d'analyse :", err);
    return { ok: false, reason: "failed", status: 500 };
  }
}

/**
 * Déclenche l'audit complet (Claude + moteurs live) pour une analyse déjà
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

  const ctx: AnalysisContext = { mode: stored.profile.mode, mapsUrl: stored.mapsUrl ?? null };

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
