import { getTranslations } from "next-intl/server";
import { SITE } from "@/constants/site";
import { JsonLd } from "@/lib/seo/json-ld";

type Item = { q: string; a: string };

/** FAQPage : reprend exactement le texte visible, question par question. */
function faqJsonLd(items: Item[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}

/**
 * FAQ en `<details>` natifs : l'ouverture, la navigation au clavier et la
 * recherche du navigateur (Ctrl+F déplie la réponse) sont gratuites, sans une
 * ligne de JavaScript. Les questions reprennent les objections réelles —
 * compétence, délai, réseau, contenu IA, plateforme, commerce physique.
 *
 * Aucun montant et aucune condition d'essai ici : la home vend l'essai, la page
 * tarifs porte les chiffres.
 */
export async function Faq() {
  const t = await getTranslations("faq");
  const items = t.raw("items") as Item[];

  return (
    <section className="mx-auto w-full max-w-3xl px-5 py-16 sm:py-20">
      <JsonLd data={faqJsonLd(items)} />
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-steel">{t("eyebrow")}</p>
        <h2 className="mt-2 text-balance text-3xl font-bold leading-tight sm:text-4xl">
          {t("title")}
        </h2>
        <p className="mt-3 text-sm text-muted">
          {t("subtitle")}{" "}
          <a
            href={`mailto:${SITE.contactEmail}`}
            className="cursor-pointer font-medium text-text underline underline-offset-4"
          >
            {t("contact")}
          </a>
        </p>
      </div>

      <div className="mt-10 divide-y divide-fog overflow-hidden rounded-[28px] border border-fog bg-snow">
        {items.map((item) => (
          <details key={item.q} className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 text-left text-[15px] font-semibold [&::-webkit-details-marker]:hidden">
              {item.q}
              <span className="shrink-0 text-ash transition-transform duration-200 group-open:rotate-45">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M12 5v14M5 12h14"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            </summary>
            <p className="px-6 pb-5 text-pretty text-sm leading-relaxed text-muted">
              {item.a}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}
