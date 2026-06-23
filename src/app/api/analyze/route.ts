import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { runAnalysis } from "@/features/analysis/service";
import { getCurrentUser } from "@/lib/auth";
import { clientIp } from "@/lib/rate-limit";
import type { PlanKey } from "@/constants/plans";
import type { BusinessMode } from "@/lib/geo/types";

export const runtime = "nodejs";
// L'analyse enchaîne collecte + Claude (thinking) + 3 appels moteurs réels :
// on élargit le budget d'exécution (borné par la plateforme de déploiement).
export const maxDuration = 300;

export async function POST(request: Request) {
  const t = await getTranslations("analysisApi");

  let rawUrl: string;
  let rawMapsUrl: string | null = null;
  let mode: BusinessMode = "physical";
  try {
    const body = await request.json();
    rawUrl = String(body.url ?? "");
    rawMapsUrl = body.mapsUrl ? String(body.mapsUrl) : null;
    mode = body.mode === "online" ? "online" : "physical";
  } catch {
    return NextResponse.json({ error: t("invalidUrl") }, { status: 400 });
  }

  const user = await getCurrentUser();
  const actor = user ? { id: user.id, plan: user.plan as PlanKey } : null;

  const result = await runAnalysis({
    rawUrl,
    rawMapsUrl,
    mode,
    actor,
    ip: clientIp(request),
  });

  if (result.ok) {
    return NextResponse.json({ id: result.id });
  }

  switch (result.reason) {
    case "invalid_url":
      return NextResponse.json({ error: t("invalidUrl") }, { status: 400 });
    case "invalid_maps_url":
      return NextResponse.json({ error: t("invalidMapsUrl") }, { status: 400 });
    case "blocked_url":
      return NextResponse.json({ error: result.detail }, { status: 400 });
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
