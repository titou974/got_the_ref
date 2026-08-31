import { getTranslations } from "next-intl/server";
import { SiteConnectForm, type SiteConnectSetup, type SiteLinkView } from "./SiteConnectForm";

export type { SiteLinkView };

/**
 * Le rattachement du site du client, depuis les réglages.
 *
 * Tout ce qui suit — vérifier les identifiants, publier, corriger les textes,
 * dérouler le planning sans personne devant l'écran — existait déjà côté
 * serveur et n'avait aucune porte d'entrée. Celle-ci est la porte large : la
 * page des réglages, où l'on vient régler son compte. L'autre est la modale
 * « résoudre avec les agents IA », qui la propose au moment utile. Les deux
 * servent le même formulaire (`SiteConnectForm`).
 */
export async function SiteConnectionPanel(setup: SiteConnectSetup) {
  const t = await getTranslations("dashboard.settings.site");

  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-10">
      <div>
        <h2 className="font-semibold">{t("title")}</h2>
        <p className="mt-1 text-sm leading-6 text-muted">{t("body")}</p>
      </div>

      <div className="md:col-span-2">
        <SiteConnectForm setup={setup} />
      </div>
    </div>
  );
}
