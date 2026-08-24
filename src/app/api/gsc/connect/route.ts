import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ROUTES } from "@/constants/routes";
import { SITE } from "@/constants/site";
import { buildGscAuthUrl, isGscConfigured } from "@/features/onboarding/gsc";

/**
 * Départ vers Google pour rattacher une propriété Search Console.
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

  if (!isGscConfigured()) {
    return NextResponse.redirect(
      `${SITE.url}${ROUTES.onboardingStep("search-console")}?gsc=indisponible`,
    );
  }

  return NextResponse.redirect(await buildGscAuthUrl());
}
