import { getTranslations } from "next-intl/server";
import { AiSearchSimulation } from "@/components/AiSearchSimulation";

/**
 * La simulation de réponse IA, sortie du haut de page : elle valait mieux qu'un
 * décor de hero. Ici, après les preuves et le produit, elle illustre exactement
 * ce que got_the_ref mesure — la place que vous occupez dans la réponse.
 */
export async function AiMentionsSection() {
  const t = await getTranslations("aiMentions");
  const th = await getTranslations("home");

  return (
    <section className="mx-auto w-full max-w-6xl px-5 py-16 sm:py-20">
      <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-14">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-steel">{t("eyebrow")}</p>
          <h2 className="mt-2 text-balance text-3xl font-bold leading-tight sm:text-4xl">
            {t("title")}
          </h2>
          <p className="mt-3 max-w-md text-pretty text-muted">{t("subtitle")}</p>
        </div>

        <div className="w-full">
          <AiSearchSimulation />
          <p className="mt-3 text-center text-xs text-muted">{th("simulationCaption")}</p>
        </div>
      </div>
    </section>
  );
}
