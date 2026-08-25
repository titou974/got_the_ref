import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { runAnalysis } from "@/features/analysis/service";
import { getCurrentUser } from "@/lib/auth";
import { clientIp } from "@/lib/rate-limit";
import {
  FREE_ANALYSIS_COOKIE,
  FREE_ANALYSIS_COOKIE_MAX_AGE,
  type PlanKey,
} from "@/constants/plans";
import type { BusinessMode } from "@/lib/geo/types";

export const runtime = "nodejs";
// L'analyse enchaîne collecte + audit DeepSeek + appels moteurs réels :
// on élargit le budget d'exécution (borné par la plateforme de déploiement).
export const maxDuration = 300;

export async function POST(request: Request) {
  const t = await getTranslations("analysisApi");

  let rawUrl: string;
  let rawMapsUrl: string | null = null;
  let rawEmail: string | null = null;
  let mode: BusinessMode = "physical";
  try {
    const body = await request.json();
    rawUrl = String(body.url ?? "");
    rawMapsUrl = body.mapsUrl ? String(body.mapsUrl) : null;
    rawEmail = body.email ? String(body.email) : null;
    mode = body.mode === "online" ? "online" : "physical";
  } catch {
    return NextResponse.json({ error: t("invalidUrl") }, { status: 400 });
  }

  const user = await getCurrentUser();
  const actor = user ? { id: user.id, plan: user.plan as PlanKey } : null;

  // L'analyse gratuite déjà consommée par ce navigateur. Elle ne concerne que
  // les visiteurs anonymes : un membre est décompté sur son compte, pas sur son
  // navigateur, et changer de poste ne doit rien lui rouvrir.
  const jar = await cookies();
  const usedAnalysisId = actor ? null : (jar.get(FREE_ANALYSIS_COOKIE)?.value ?? null);

  const result = await runAnalysis({
    rawUrl,
    rawMapsUrl,
    // E-mail laissé dans la modale de l'analyse gratuite : rattaché à l'analyse
    // du visiteur anonyme, ignoré pour un membre déjà identifié.
    leadEmail: rawEmail,
    mode,
    actor,
    ip: clientIp(request),
    usedAnalysisId,
  });

  if (result.ok) {
    const response = NextResponse.json({ id: result.id });
    // Le verrou de l'analyse gratuite. `httpOnly` pour qu'un script de page ne
    // puisse pas l'effacer, et un an de durée : c'est une démonstration, elle
    // n'a pas vocation à se rejouer chaque mois.
    if (!actor) {
      response.cookies.set(FREE_ANALYSIS_COOKIE, result.id, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: FREE_ANALYSIS_COOKIE_MAX_AGE,
      });
    }
    return response;
  }

  switch (result.reason) {
    case "invalid_url":
      return NextResponse.json({ error: t("invalidUrl") }, { status: 400 });
    case "invalid_maps_url":
      return NextResponse.json({ error: t("invalidMapsUrl") }, { status: 400 });
    case "blocked_url":
      return NextResponse.json({ error: result.detail }, { status: 400 });
    case "already_used":
      return NextResponse.json(
        {
          error: t("alreadyUsed"),
          code: "already_used",
          analysisId: result.analysisId,
        },
        { status: 409 },
      );
    case "anon_quota":
      return NextResponse.json(
        { error: t("anonQuota"), code: "anon_quota" },
        { status: 429 },
      );
    case "quota_exceeded":
      return NextResponse.json(
        {
          error: result.plan === "pro" ? t("quotaPro") : t("quotaFree"),
          code: "quota_exceeded",
          plan: result.plan,
        },
        { status: 402 },
      );
    default:
      return NextResponse.json({ error: t("failed") }, { status: 500 });
  }
}
