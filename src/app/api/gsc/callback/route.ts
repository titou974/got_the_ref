import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ROUTES } from "@/constants/routes";
import { SITE } from "@/constants/site";
import {
  consumeGscState,
  exchangeGscCode,
  listGscProperties,
  saveGscConnection,
} from "@/features/onboarding/gsc";

/** Retour de Google : on ramène toujours sur l'étape 7, avec le verdict en clair. */
const back = (status: string) =>
  NextResponse.redirect(`${SITE.url}${ROUTES.onboardingStep("search-console")}?gsc=${status}`);

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  // Le `state` est consommé quoi qu'il arrive — un refus de Google ne doit pas
  // laisser traîner un cookie encore valable pour un second essai.
  const stateOk = await consumeGscState(params.get("state"));

  if (params.get("error")) return back("refuse");
  if (!stateOk) return back("etat-invalide");

  const code = params.get("code");
  if (!code) return back("echec");

  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(`${SITE.url}${ROUTES.signIn}`);

  try {
    const tokens = await exchangeGscCode(code);
    if (!tokens.access_token) return back("echec");

    const properties = await listGscProperties(tokens.access_token);
    const profile = await prisma.onboardingProfile.findUnique({
      where: { userId: user.id },
      select: { domain: true },
    });

    await saveGscConnection({
      userId: user.id,
      tokens,
      properties,
      domain: profile?.domain ?? null,
    });

    return back(properties.length > 0 ? "connecte" : "aucune-propriete");
  } catch (error) {
    console.error("[gsc] rattachement impossible", error);
    return back("echec");
  }
}
