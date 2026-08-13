import { getTranslations } from "next-intl/server";
import { BookCallButton } from "@/components/BookCallButton";
import { BrandProof } from "@/components/BrandProof";

/**
 * Le dernier geste proposé par la home : si le tarif n'a pas suffi, on parle.
 * Placé juste après le tarif et avant la FAQ — les questions qui restent à ce
 * stade trouvent leur réponse en dessous, ou dans l'appel.
 */
export async function DemoCtaSection() {
  const t = await getTranslations("homeDemoCta");

  return (
    <div className="px-5 pb-4">
      <section className="card-cal sweep relative mx-auto w-full max-w-6xl overflow-hidden px-6 py-14 text-center sm:px-10">
        <p className="text-xs font-semibold uppercase tracking-wider text-steel">{t("eyebrow")}</p>
        <h2 className="mx-auto mt-2 max-w-2xl text-balance text-3xl font-bold leading-tight sm:text-4xl">
          {t("title")}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-pretty text-muted">{t("subtitle")}</p>

        <div className="mt-8 flex justify-center">
          <BookCallButton label={t("button")} />
        </div>

        <BrandProof className="mt-8" />
      </section>
    </div>
  );
}
