import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { resolveAuthDestination } from "@/features/auth/destination";
import { claimPendingDemo } from "@/features/analysis/demo";
import { NEXT_PARAM, ROUTES } from "@/constants/routes";

/**
 * L'aiguillage d'après-identification : aucune interface, une redirection.
 *
 * Google revient toujours ici après un « S'inscrire avec Google » ; c'est le
 * seul endroit où l'on sait enfin qui vient d'entrer. Un client déjà abonné
 * repart chez lui plutôt que sur la grille tarifaire, un vrai nouveau venu
 * poursuit vers la page qu'il visait.
 *
 * C'est aussi ici que se rattrape la démonstration gratuite partie chez Google.
 * Le visiteur avait donné son site sur la page d'accueil, puis quitté la page :
 * le site l'attend dans un cookie, on le pose sur sa fiche d'accueil et on
 * l'emmène directement sur son tableau de bord, où l'analyse se lance. Sans ce
 * rattrapage, il rentrerait de chez Google sur la grille tarifaire, sans lien
 * visible avec ce qu'il venait de demander.
 */
export default async function BienvenuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const requested = (await searchParams)[NEXT_PARAM];

  if (await claimPendingDemo(user.id, user.email)) redirect(ROUTES.dashboard);

  redirect(await resolveAuthDestination(user.id, requested));
}
