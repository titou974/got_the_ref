import { getTranslations } from "next-intl/server";
import { BookCallButton } from "@/components/BookCallButton";

/**
 * Le dernier geste proposé par la home : si le tarif n'a pas suffi, on parle.
 * Une phrase et un bouton — le comparatif juste au-dessus a déjà tenu
 * l'argumentaire, et la FAQ répond juste en dessous.
 */
export async function DemoCtaSection() {
  const t = await getTranslations("homeDemoCta");

  return (
    <div className="px-5 pb-4">
      <section className="card-cal sweep relative mx-auto w-full max-w-6xl overflow-hidden px-6 py-12 text-center sm:px-10">
        <h2 className="text-balance text-3xl font-bold leading-tight sm:text-4xl">{t("title")}</h2>
        <div className="mt-7 flex justify-center">
          <BookCallButton label={t("button")} />
        </div>
      </section>
    </div>
  );
}
