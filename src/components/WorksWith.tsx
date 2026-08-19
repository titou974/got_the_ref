import { getTranslations } from "next-intl/server";
import { DETECTABLE_PLATFORMS } from "@/constants/platforms";
import { StackMark } from "@/components/StackMark";

/**
 * Bandeau « fonctionne avec » : lève l'objection technique juste sous le champ
 * d'analyse. got_the_ref lit un site depuis l'extérieur — la plateforme n'a donc aucune
 * importance, et c'est précisément ce que ce rappel doit faire comprendre d'un
 * coup d'œil, sans que personne ait à lire une ligne.
 *
 * La liste est exactement celle que l'analyse sait reconnaître sur un site
 * (`constants/platforms`) : ce qui est promis ici est ce qui est détecté.
 */
export async function WorksWith({ className = "" }: { className?: string }) {
  const t = await getTranslations("worksWith");

  return (
    <section className={className}>
      <p className="text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-ash">
        {t("eyebrow")}
      </p>

      <ul className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
        {DETECTABLE_PLATFORMS.map((p) => (
          <li key={p.id} className="flex items-center gap-2 text-steel">
            <StackMark id={p.id} size={18} />
            <span className="text-sm font-medium">{p.name}</span>
          </li>
        ))}
      </ul>

      <p className="mt-5 text-center text-sm font-semibold text-text">{t("otherTitle")}</p>
      <p className="mt-1 text-center text-sm text-muted">{t("otherBody")}</p>
    </section>
  );
}
