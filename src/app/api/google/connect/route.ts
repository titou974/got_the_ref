import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ROUTES, safeNextPath } from "@/constants/routes";
import { SITE } from "@/constants/site";
import { buildGoogleAuthUrl, isGoogleConfigured } from "@/features/onboarding/google";

/**
 * Départ vers Google pour rattacher Search Console et Analytics.
 *
 * Une route plutôt qu'une action serveur : le flux OAuth est une navigation du
 * navigateur vers un domaine tiers, et il faut poser le cookie `state` sur cette
 * même réponse.
 *
 * `?suite=` dit où revenir : l'étape 7 du tunnel par défaut, le tableau de bord
 * quand le rattachement est lancé depuis lui.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(`${SITE.url}${ROUTES.signIn}`);
  }

  const returnTo = safeNextPath(
    request.nextUrl.searchParams.get("suite"),
    ROUTES.onboardingStep("search-console"),
  );

  if (!isGoogleConfigured()) {
    return NextResponse.redirect(`${SITE.url}${returnTo}?google=indisponible`);
  }

  return NextResponse.redirect(await buildGoogleAuthUrl(returnTo));
}
