import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ROUTES } from "@/constants/routes";
import { SITE } from "@/constants/site";
import {
  consumeGoogleReturn,
  consumeGoogleState,
  exchangeGoogleCode,
  grantedScopes,
  listGa4Properties,
  listGscProperties,
  saveGoogleConnection,
} from "@/features/onboarding/google";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  // Là d'où le rattachement est parti — le tableau de bord, sauf `?suite=`.
  // Le verdict repart avec, en clair, dans la query string.
  const returnTo = (await consumeGoogleReturn()) ?? ROUTES.dashboard;
  const back = (status: string) =>
    NextResponse.redirect(`${SITE.url}${returnTo}?google=${status}`);

  // Le `state` est consommé quoi qu'il arrive — un refus de Google ne doit pas
  // laisser traîner un cookie encore valable pour un second essai.
  const stateOk = await consumeGoogleState(params.get("state"));

  if (params.get("error")) return back("refuse");
  if (!stateOk) return back("etat-invalide");

  const code = params.get("code");
  if (!code) return back("echec");

  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(`${SITE.url}${ROUTES.signIn}`);

  try {
    const tokens = await exchangeGoogleCode(code);
    if (!tokens.access_token) return back("echec");

    // Le client a pu décocher l'un des deux services : on n'interroge que ce
    // qu'il a accordé, sinon Google répondrait 403 sur l'autre.
    const granted = grantedScopes(tokens.scope);
    if (!granted.gsc && !granted.ga4) return back("refuse");

    const [gscProperties, ga4Properties] = await Promise.all([
      granted.gsc ? listGscProperties(tokens.access_token) : Promise.resolve([]),
      granted.ga4 ? listGa4Properties(tokens.access_token) : Promise.resolve([]),
    ]);

    const profile = await prisma.onboardingProfile.findUnique({
      where: { userId: user.id },
      select: { domain: true },
    });

    await saveGoogleConnection({
      userId: user.id,
      tokens,
      gscProperties,
      ga4Properties,
      domain: profile?.domain ?? null,
    });

    // Le verdict tient en deux mots : l'étape relit l'état réel des deux
    // services en base pour le détailler service par service.
    const complete =
      granted.gsc && granted.ga4 && gscProperties.length > 0 && ga4Properties.length > 0;

    return back(complete ? "connecte" : "partiel");
  } catch (error) {
    console.error("[google] rattachement impossible", error);
    return back("echec");
  }
}
