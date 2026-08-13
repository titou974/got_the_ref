import { getTranslations } from "next-intl/server";
import { PLATFORMS } from "@/constants/platforms";

/**
 * Bandeau « fonctionne avec » : lève l'objection technique juste sous le champ
 * d'analyse. got_the_ref lit un site depuis l'extérieur — la plateforme n'a donc aucune
 * importance, et c'est précisément ce que ce rappel doit faire comprendre d'un
 * coup d'œil, sans que personne ait à lire une ligne.
 *
 * Tracés issus de Simple Icons (CC0), inlinés : aucun appel réseau au rendu, et
 * chaque marque reste monochrome pour ne pas voler la vedette au contenu.
 */

/** Les CMS : ce qui répond à « ça marche avec mon site ? ». Réseaux sociaux exclus. */
const CMS = PLATFORMS.filter((p) => !["Notion", "X"].includes(p.name));

export async function WorksWith({ className = "" }: { className?: string }) {
  const t = await getTranslations("worksWith");

  return (
    <section className={className}>
      <p className="text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-ash">
        {t("eyebrow")}
      </p>

      <ul className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
        {CMS.map((p) => (
          <li key={p.name} className="flex items-center gap-2 text-steel">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden
              className="shrink-0"
            >
              <path d={p.path} />
            </svg>
            <span className="text-sm font-medium">{p.name}</span>
          </li>
        ))}
      </ul>

      <p className="mt-5 text-center text-sm font-semibold text-text">{t("otherTitle")}</p>
      <p className="mt-1 text-center text-sm text-muted">{t("otherBody")}</p>
    </section>
  );
}
