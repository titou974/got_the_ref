import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_PATH_VARIANT,
  PATH_VARIANT_COOKIE,
  isPathVariant,
  type PathVariant,
} from "@/constants/experiments";
import { getSession } from "@/features/auth/queries";

/**
 * Dans quelle branche du test de parcours tombe la personne qui lit cette page ?
 *
 * Deux sources, dans cet ordre. Le compte d'abord, quand il en a un : la branche
 * y est figée, et c'est elle qui suit la personne d'un appareil à l'autre. Le
 * cookie ensuite — celui que `proxy.ts` pose au premier passage. Et à défaut, le
 * parcours d'aujourd'hui : un robot d'indexation, un navigateur qui refuse les
 * cookies ou un rendu sans requête ne doivent pas se retrouver dans la branche
 * expérimentale.
 *
 * La bascule du cookie vers le compte se fait ici, à la première page lue une
 * fois identifié, plutôt qu'à la création du compte. Le compte naît de quatre
 * endroits — le formulaire, Google, le retour de Stripe, la démonstration de la
 * page d'accueil — et poser l'écriture dans chacun aurait laissé sans branche
 * celui qu'on aurait oublié.
 *
 * L'écriture est protégée : `updateMany` avec `pathVariant: null` en condition.
 * Deux onglets ouverts en même temps ne peuvent donc pas se contredire, et une
 * branche déjà posée n'est jamais réécrite.
 *
 * `cache` : la page, la barre de navigation et l'appel de bas de page se posent
 * tous la même question dans le même rendu.
 */
export const getPathVariant = cache(async function getPathVariant(): Promise<PathVariant> {
  const cookieValue = (await cookies()).get(PATH_VARIANT_COOKIE)?.value;
  const fromCookie = isPathVariant(cookieValue) ? cookieValue : null;

  const session = await getSession();
  if (!session?.user) return fromCookie ?? DEFAULT_PATH_VARIANT;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { pathVariant: true },
  });

  if (isPathVariant(user?.pathVariant)) return user.pathVariant;

  const variant = fromCookie ?? DEFAULT_PATH_VARIANT;
  await prisma.user.updateMany({
    where: { id: session.user.id, pathVariant: null },
    data: { pathVariant: variant },
  });

  return variant;
});

/**
 * La branche testée : l'analyse gratuite d'abord, la grille tarifaire après.
 *
 * Lue partout où le parcours bifurque — la destination d'après-identification,
 * la porte du tunnel d'accueil, la page d'accueil, la barre de navigation et la
 * grille tarifaire. Une seule question posée au même endroit : deux versions de
 * cette règle finiraient par diverger, et l'une des deux servirait un parcours
 * mi-témoin mi-testé, qui ne mesurerait rien.
 */
export async function isDemoFirst(): Promise<boolean> {
  return (await getPathVariant()) === "demo-first";
}
