import { getTranslations } from "next-intl/server";

type FaqItem = { q: string; a: string };

/** FAQ tarifs, en accordéon natif (`<details>`) : pas de JS, pas de layout shift. */
export async function PricingFaq({ className = "" }: { className?: string }) {
  const t = await getTranslations("pricing.faq");
  const items = t.raw("items") as FaqItem[];

  return (
    <section className={className}>
      <div className="mx-auto max-w-3xl px-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-steel">
          {t("title")}
        </h2>

        <div className="mt-4 divide-y divide-fog rounded-[28px] border border-fog bg-mist/60">
          {items.map((item) => (
            <details key={item.q} className="group px-5 py-4 sm:px-6">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium text-text marker:content-none">
                {item.q}
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden
                  className="shrink-0 text-steel transition-transform duration-200 group-open:rotate-180"
                >
                  <path
                    d="M6 9l6 6 6-6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
