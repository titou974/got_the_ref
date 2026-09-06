import "server-only";

import { isCredentialsKeySet } from "@/lib/crypto";
import { connectorForStack } from "@/constants/site-platforms";
import type { SiteConnectSetup } from "@/components/tableau-de-bord/SiteConnectForm";
import type { DashboardContext } from "./queries";

/**
 * De quoi rattacher le site, tel que le formulaire l'attend.
 *
 * Composé ici plutôt que dans chaque écran qui ouvre la modale : la barre des
 * agents le faisait déjà, et l'atelier d'article en a besoin à son tour — il
 * prend l'écran entier, la barre n'y est pas montée, et il ouvre donc sa propre
 * modale. Deux copies de cette construction auraient fini par diverger sur le
 * détail qui compte : la plateforme proposée, celle que neuf clients sur dix
 * n'ont plus qu'à confirmer.
 *
 * La date est mise en forme ici, côté serveur : la modale est rendue chez le
 * client, et son fuseau ferait diverger le premier rendu de l'hydratation.
 */
export function connectSetupFor(
  context: DashboardContext,
  stackId: string | undefined,
): SiteConnectSetup {
  return {
    link: context.site
      ? {
          platform: context.site.platform,
          siteUrl: context.site.siteUrl,
          status: context.site.status,
          capabilities: context.site.capabilities,
          connectedOn: context.site.connectedAt
            ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(
                context.site.connectedAt,
              )
            : null,
          lastError: context.site.lastError,
        }
      : null,
    suggestedPlatform: connectorForStack(stackId).id,
    suggestedSiteUrl: context.siteUrl ?? (context.domain ? `https://${context.domain}` : null),
    credentialsKeyReady: isCredentialsKeySet(),
  };
}
