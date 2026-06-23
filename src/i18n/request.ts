import { getRequestConfig } from "next-intl/server";
import { SITE } from "@/constants/site";

/**
 * App mono-langue (FR) : pas de routing i18n, locale fixe.
 * next-intl sert uniquement à externaliser tous les textes.
 */
export default getRequestConfig(async () => {
  const locale = SITE.lang;
  return {
    locale,
    messages: (await import("./messages/fr.json")).default,
  };
});
