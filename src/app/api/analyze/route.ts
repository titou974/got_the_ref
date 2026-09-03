import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { runAnalysis } from "@/features/analysis/service";
import { startFreeDashboardDemo } from "@/features/analysis/demo";
import { getCurrentUser } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import {
  FREE_ANALYSIS_COOKIE,
  FREE_ANALYSIS_COOKIE_MAX_AGE,
  FREE_DEMO_QUOTA,
  type PlanKey,
} from "@/constants/plans";
import { ROUTES } from "@/constants/routes";
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

  // Le chemin normal d'un visiteur qui laisse son adresse : on lui ouvre un
  // compte gratuit et on l'envoie sur le tableau de bord, où l'écran d'attente
  // joue l'analyse et où les voiles du niveau gratuit montrent le reste. Le
  // rapport public d'autrefois n'est plus qu'un repli — pour une adresse déjà
  // rattachée à un compte, à qui on ne peut pas ouvrir de session, et pour un
  // visiteur qui n'a laissé aucune adresse.
  //
  // Le plafond par adresse IP est posé avant l'ouverture du compte : cette
  // branche crée un utilisateur sur une simple adresse e-mail, et un plafond
  // vérifié après coup aurait déjà laissé passer la création.
  const ip = clientIp(request);
  const wantsDemo = !actor && Boolean(rawEmail);
  // Le court-circuit compte : sans lui, un membre identifié ou un visiteur sans
  // adresse consommerait un jeton d'un plafond qui ne le concerne pas.
  const demoAllowed =
    wantsDemo && rateLimit(`demo:${ip}`, FREE_DEMO_QUOTA.limit, FREE_DEMO_QUOTA.windowMs).ok;

  if (demoAllowed) {
    const demo = await startFreeDashboardDemo({
      rawUrl,
      rawMapsUrl,
      rawEmail,
      mode,
    });

    if (demo.ok) {
      const response = NextResponse.json({ redirect: ROUTES.dashboard });
      for (const cookie of demo.cookies) {
        response.headers.append("set-cookie", cookie);
      }
      return response;
    }

    switch (demo.reason) {
      case "invalid_url":
        return NextResponse.json({ error: t("invalidUrl") }, { status: 400 });
      case "invalid_maps_url":
        return NextResponse.json({ error: t("invalidMapsUrl") }, { status: 400 });
      case "blocked_url":
        return NextResponse.json({ error: demo.detail }, { status: 400 });
      // Adresse d'un compte existant, adresse illisible, ou inscription
      // refusée : on retombe sur l'analyse anonyme et son rapport public.
      default:
        break;
    }
  }

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
    ip,
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
