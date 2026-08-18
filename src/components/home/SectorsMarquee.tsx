import { getTranslations } from "next-intl/server";

/**
 * Ruban des secteurs couverts, juste sous le pli : il répond en une seconde à
 * « est-ce que c'est fait pour mon métier ? ». Même mécanique que le ruban de
 * preuves — deux copies de la liste, translation de la moitié exacte de la
 * piste, raccord invisible et zéro JavaScript.
 */
export async function SectorsMarquee() {
  const t = await getTranslations("sectors");
  const items = t.raw("items") as string[];

  return (
    <section className="w-full py-8">
      <h2 className="mx-auto mt-2 max-w-2xl text-balance px-5 text-center text-lg font-semibold sm:text-xl">
        {t("title")}
      </h2>

      <div className="marquee mt-6">
        <div className="marquee-track marquee-track--fast">
          {[0, 1].map((pass) => (
            <ul
              key={pass}
              className="marquee-row"
              aria-hidden={pass === 1 || undefined}
            >
              {items.map((item) => (
                <li
                  key={`${pass}-${item}`}
                  className="flex shrink-0 items-center gap-2 rounded-full border border-fog bg-snow px-5 py-2.5 text-sm font-medium text-graphite"
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-obsidian"
                    aria-hidden
                  />
                  {item}
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </section>
  );
}
