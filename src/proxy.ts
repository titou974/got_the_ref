import { NextResponse, type NextRequest } from "next/server";
import {
  DEFAULT_PATH_VARIANT,
  PATH_VARIANTS,
  PATH_VARIANT_COOKIE,
  PATH_VARIANT_COOKIE_MAX_AGE,
  isPathVariant,
} from "@/constants/experiments";

/**
 * Le tirage au sort du parcours d'entrée, et rien d'autre.
 *
 * Il se fait ici, avant la page, parce que c'est le seul endroit qui voit
 * arriver un visiteur avant qu'on lui rende quoi que ce soit : poser le cookie
 * depuis un composant serveur est interdit pendant le rendu, et le poser depuis
 * le navigateur ferait clignoter la page — le temps que le script décide, la
 * mauvaise branche est déjà à l'écran.
 *
 * Une pièce lancée une fois, gardée un an (cf. `constants/experiments.ts`). Une
 * fois le compte ouvert, la branche est recopiée sur le compte lui-même
 * (`User.pathVariant`) et c'est elle qui fait foi : un client qui rouvre le site
 * sur son téléphone doit retrouver le parcours qu'il a commencé sur son
 * ordinateur, sinon la mesure compte deux personnes là où il n'y en a qu'une.
 *
 * `Math.random` suffit. On ne cherche pas à répartir des cohortes stables sur
 * plusieurs tests, seulement à couper le trafic en deux : à l'échelle de
 * quelques milliers de visites, l'écart entre les deux moitiés se compte en
 * pourcents, loin devant ce que le test cherche à mesurer.
 */
export function proxy(request: NextRequest) {
  const response = NextResponse.next();

  const existing = request.cookies.get(PATH_VARIANT_COOKIE)?.value;
  if (isPathVariant(existing)) return response;

  const variant = PATH_VARIANTS[Math.floor(Math.random() * PATH_VARIANTS.length)];

  response.cookies.set({
    name: PATH_VARIANT_COOKIE,
    value: variant ?? DEFAULT_PATH_VARIANT,
    path: "/",
    maxAge: PATH_VARIANT_COOKIE_MAX_AGE,
    sameSite: "lax",
    // Lisible par le navigateur à dessein : la mesure côté client (l'événement
    // envoyé à Vercel Analytics) doit pouvoir dire dans quelle branche elle
    // tombe, et il n'y a rien de sensible dans le nom d'une branche.
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}

/**
 * On ne tire au sort que sur les pages, jamais sur les ressources.
 *
 * `Set-Cookie` sur une image ou un fichier statique n'a aucun sens et rend la
 * réponse impossible à mettre en cache. Sont donc exclus les routes d'API — le
 * tirage n'a lieu que là où une page peut en dépendre —, les fichiers internes
 * de Next, et tout chemin qui porte une extension.
 */
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.[^/]+$).*)"],
};
