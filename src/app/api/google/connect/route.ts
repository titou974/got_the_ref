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
 * `?suite=` dit où revenir. Le rattachement ne se propose plus dans le tunnel
 * d'accueil : le tableau de bord est le seul point de départ, et donc le retour
 * par défaut.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(`${SITE.url}${ROUTES.signIn}`);
  }

  const returnTo = safeNextPath(request.nextUrl.searchParams.get("suite"), ROUTES.dashboard);

  if (!isGoogleConfigured()) {
    return NextResponse.redirect(`${SITE.url}${returnTo}?google=indisponible`);
  }

  return NextResponse.redirect(await buildGoogleAuthUrl(returnTo));
}
