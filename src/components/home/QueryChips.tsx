import { getTranslations } from "next-intl/server";

/**
 * Trois rubans de requêtes qui glissent en sens contraires. C'est la traduction
 * visuelle de ce que got_the_ref suit réellement : des phrases entières, telles
 * qu'un client les tape dans une IA — pas des mots-clés isolés.
 */
export async function QueryChips() {
  const t = await getTranslations("queries");
  const items = t.raw("items") as string[];

  // Trois tranches de longueur voisine : les rangées restent équilibrées.
  const size = Math.ceil(items.length / 3);
  const rows = [items.slice(0, size), items.slice(size, size * 2), items.slice(size * 2)];

  return (
    <section className="w-full py-16 sm:py-20">
      <div className="mx-auto max-w-2xl px-5 text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-steel">{t("eyebrow")}</p>
        <h2 className="mt-2 text-balance text-3xl font-bold leading-tight sm:text-4xl">
          {t("title")}
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-pretty text-muted">{t("subtitle")}</p>
      </div>

      <div className="mt-10 flex flex-col gap-3">
        {rows.map((row, i) => (
          <div key={i} className="marquee">
            <div
              className={`marquee-track ${i === 1 ? "marquee-track--reverse" : ""} ${
                i === 2 ? "marquee-track--fast" : ""
              }`}
            >
              {[0, 1].map((pass) => (
                <ul key={pass} className="marquee-row" aria-hidden={pass === 1 || undefined}>
                  {row.map((query) => (
                    <li
                      key={`${pass}-${query}`}
                      className="flex shrink-0 items-center gap-2 rounded-full border border-fog bg-snow px-4 py-2 text-sm text-graphite"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0 text-ash">
                        <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
                        <path d="m16 16 4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                      </svg>
                      {query}
                    </li>
                  ))}
                </ul>
              ))}
            </div>
          </div>
        ))}
      </div>

      <p className="mx-auto mt-8 max-w-xl px-5 text-center text-sm text-muted">{t("footnote")}</p>
    </section>
  );
}
