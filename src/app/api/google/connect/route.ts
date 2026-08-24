import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ROUTES } from "@/constants/routes";
import { SITE } from "@/constants/site";
import { buildGoogleAuthUrl, isGoogleConfigured } from "@/features/onboarding/google";

/**
 * Départ vers Google pour rattacher Search Console et Analytics.
 *
 * Une route plutôt qu'une action serveur : le flux OAuth est une navigation du
 * navigateur vers un domaine tiers, et il faut poser le cookie `state` sur cette
 * même réponse.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(`${SITE.url}${ROUTES.signIn}`);
  }

  if (!isGoogleConfigured()) {
    return NextResponse.redirect(
      `${SITE.url}${ROUTES.onboardingStep("search-console")}?google=indisponible`,
    );
  }

  return NextResponse.redirect(await buildGoogleAuthUrl());
}
