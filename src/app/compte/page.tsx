import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ROUTES } from "@/constants/routes";

/**
 * « Mon compte » n'est plus un écran : c'est le tableau de bord.
 *
 * Cette page listait le plan, le bouton de facturation et l'historique des
 * analyses. Le tableau de bord fait tout cela mieux, et deux portes d'entrée
 * pour un même compte obligeaient le client à choisir laquelle ouvrir. La
 * route reste en place — elle est encore la destination par défaut de la
 * connexion, du retour de paiement et du portail Stripe — mais elle ne fait
 * plus que rediriger. La gestion de l'abonnement vit désormais dans la colonne
 * du tableau de bord.
 */
export default async function ComptePage() {
  const user = await getCurrentUser();
  if (!user) redirect(ROUTES.signIn);
  redirect(ROUTES.dashboard);
}
