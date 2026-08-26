import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { resolveAuthDestination } from "@/features/auth/destination";
import { NEXT_PARAM } from "@/constants/routes";

/**
 * L'aiguillage d'après-identification : aucune interface, une redirection.
 *
 * Google revient toujours ici après un « S'inscrire avec Google » ; c'est le
 * seul endroit où l'on sait enfin qui vient d'entrer. Un client déjà abonné
 * repart chez lui plutôt que sur la grille tarifaire, un vrai nouveau venu
 * poursuit vers la page qu'il visait.
 */
export default async function BienvenuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const requested = (await searchParams)[NEXT_PARAM];

  redirect(await resolveAuthDestination(user.id, requested));
}
