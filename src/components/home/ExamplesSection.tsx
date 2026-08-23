"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";

type Bullet = { strong: string; text: string };
type Article = {
  date: string;
  readTime: string;
  category: string;
  title: string;
  intro: string;
  beforeList: string;
  bullets: Bullet[];
  takeawaysLead: string;
  tableRows: string[][];
  toc: string[];
};
type Site = {
  domain: string;
  colors: string[];
  voice: string[];
  offers: string[];
  article: Article;
};

/**
 * La preuve par l'exemple : on montre l'article, pas la promesse d'article. À
 * gauche, ce que got_the_ref a relevé du site avant d'écrire — couleurs, ton,
 * offres à relier entre elles ; à droite, la page produite ; en dessous, les
 * points de citabilité qu'elle coche.
 *
 * Les trois onglets changent l'ensemble : chaque site de démonstration a son
 * univers, son ton et son article. C'est ce basculement qui fait comprendre que
 * rien n'est générique.
 */
export function ExamplesSection() {
  const t = useTranslations("examples");
  const reduce = useReducedMotion();
  const sites = t.raw("sites") as Site[];
  const checks = t.raw("checks") as string[];
  const stats = t.raw("stats") as { label: string; value: string }[];
  const tableHead = t.raw("tableHead") as string[];
  const [active, setActive] = useState(0);

  const site = sites[active];
  const article = site.article;

  return (
    <section className="mx-auto w-full max-w-6xl px-5 py-16 sm:py-20">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-steel">{t("eyebrow")}</p>
        <h2 className="mt-2 text-balance text-3xl font-bold leading-tight sm:text-4xl">
          {t("title")}
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-pretty text-muted">{t("subtitle")}</p>
      </div>

      {/* Les sites de démonstration : changer d'onglet change tout le bloc. */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
        {sites.map((s, i) => (
          <button
            key={s.domain}
            type="button"
            onClick={() => setActive(i)}
            aria-pressed={i === active}
            className={`cursor-pointer rounded-full px-4 py-2 text-sm font-medium transition-colors duration-200 ${
              i === active
                ? "bg-obsidian text-white shadow-[var(--shadow-pill)]"
                : "border border-fog bg-snow text-muted hover:text-text"
            }`}
          >
            {s.domain}
          </button>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        {/* Ce que l'agent a relevé du site */}
        <div className="card-cal h-fit p-6 sm:p-7">
          <p className="text-xs text-muted">
            {t("tailoredFor")} <span className="font-semibold text-text">{site.domain}</span>
          </p>

          <AnimatePresence mode="wait" initial={false}>
            <motion.ol
              key={site.domain}
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="mt-6 space-y-6"
            >
              <Block num="1" title={t("blocks.0.title")}>
                <div className="flex flex-wrap gap-2">
                  {site.colors.map((color) => (
                    <span
                      key={color}
                      className="flex items-center gap-2 rounded-full border border-fog bg-snow py-1 pl-1 pr-2.5 text-[11px] font-medium tabular-nums text-graphite"
                    >
                      <span
                        className="h-4 w-4 rounded-full border border-fog"
                        style={{ background: color }}
                        aria-hidden
                      />
                      {color}
                    </span>
                  ))}
                </div>
              </Block>

              <Block num="2" title={t("blocks.1.title")}>
                <div className="flex flex-wrap gap-2">
                  {site.voice.map((v) => (
                    <span
                      key={v}
                      className="rounded-full border border-fog bg-mist px-3 py-1.5 text-[11px] text-graphite"
                    >
                      {v}
                    </span>
                  ))}
                </div>
              </Block>

              <Block num="3" title={t("blocks.2.title")}>
                <ul className="space-y-1.5">
                  {site.offers.map((offer) => (
                    <li key={offer} className="flex items-center gap-2 text-[12px] text-graphite">
                      <span className="text-ash" aria-hidden>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                          <path
                            d="M10 13.5a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1.2 1.2M14 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1.2-1.2"
                            stroke="currentColor"
                            strokeWidth="1.7"
                            strokeLinecap="round"
                          />
                        </svg>
                      </span>
                      {offer}
                    </li>
                  ))}
                </ul>
              </Block>
            </motion.ol>
          </AnimatePresence>
        </div>

        {/* L'article produit */}
        <div className="card-cal relative overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            <motion.article
              key={site.domain}
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduce ? undefined : { opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="max-h-[34rem] overflow-hidden p-6 sm:p-8"
            >
              <p className="text-[11px] uppercase tracking-wider text-ash">
                {article.date} · {article.readTime}
              </p>
              <span className="mt-3 inline-block rounded-full bg-mist px-2.5 py-1 text-[11px] font-medium text-graphite">
                {article.category}
              </span>

              <h3 className="mt-3 text-balance text-2xl font-bold leading-snug">{article.title}</h3>

              {/* Visuel de l'article : bandeau teinté aux couleurs de la marque détectée. */}
              <div
                className="mt-4 h-24 w-full rounded-[16px] border border-fog"
                style={{
                  background: `linear-gradient(120deg, ${site.colors[0]} 0%, ${site.colors[1]} 55%, ${site.colors[2]} 100%)`,
                }}
                aria-hidden
              />

              <p className="mt-4 text-[13px] leading-relaxed text-graphite">{article.intro}</p>

              <p className="mt-4 text-[13px] font-semibold">{article.beforeList}</p>
              <ul className="mt-2 space-y-2">
                {article.bullets.map((b) => (
                  <li key={b.strong} className="flex gap-2 text-[13px] leading-relaxed text-graphite">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-obsidian" aria-hidden />
                    <span>
                      <strong className="font-semibold text-text">{b.strong}</strong> {b.text}
                    </span>
                  </li>
                ))}
              </ul>

              <h4 className="mt-6 text-base font-bold">{t("takeawaysTitle")}</h4>
              <p className="mt-1.5 text-[13px] leading-relaxed text-graphite">
                {article.takeawaysLead}
              </p>

              <div className="mt-3 overflow-hidden rounded-[16px] border border-fog">
                <table className="w-full text-left text-[12px]">
                  <thead className="bg-mist text-[11px] font-semibold uppercase tracking-wider text-steel">
                    <tr>
                      {tableHead.map((h) => (
                        <th key={h} className="px-3 py-2">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-fog">
                    {article.tableRows.map((row) => (
                      <tr key={row[0]}>
                        <td className="w-1/3 px-3 py-2 font-medium">{row[0]}</td>
                        <td className="px-3 py-2 text-muted">{row[1]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h4 className="mt-6 text-base font-bold">{t("tocTitle")}</h4>
              <ol className="mt-2 space-y-1 text-[13px] text-muted">
                {article.toc.map((entry) => (
                  <li key={entry} className="underline decoration-fog underline-offset-4">
                    {entry}
                  </li>
                ))}
              </ol>
            </motion.article>
          </AnimatePresence>

          {/* Le dégradé dit « ça continue » sans imposer une barre de défilement. */}
          <div
            className="pointer-events-none absolute inset-x-0 bottom-11 h-24 bg-gradient-to-t from-snow to-transparent"
            aria-hidden
          />
          <p className="absolute inset-x-0 bottom-0 border-t border-fog bg-snow px-6 py-3 text-[11px] text-muted">
            {t("publishedTo")}{" "}
            <span className="font-medium text-text">{site.domain}/journal</span>
          </p>
        </div>
      </div>

      {/* Ce qui rend l'article citable */}
      <div className="card-cal mt-5 p-6 sm:p-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div>
            <h3 className="text-xl font-bold leading-snug">{t("checklistTitle")}</h3>
            <p className="mt-2 max-w-md text-pretty text-sm leading-relaxed text-muted">
              {t("checklistBody")}
            </p>

            <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {stats.map((stat) => (
                <div key={stat.label} className="rounded-[16px] border border-fog bg-mist px-3 py-2">
                  <dt className="text-[10px] font-semibold uppercase tracking-wider text-steel">
                    {stat.label}
                  </dt>
                  <dd className="mt-0.5 text-base font-bold tabular-nums">{stat.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <ul className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
            {checks.map((check, i) => (
              <motion.li
                key={check}
                initial={{ opacity: 0, x: -6 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ delay: reduce ? 0 : 0.04 * i, duration: 0.26, ease: "easeOut" }}
                className="flex items-center gap-2 text-[13px] text-graphite"
              >
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-obsidian text-white">
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d="m5 12.5 4.5 4.5L19 7"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                {check}
              </motion.li>
            ))}
          </ul>
        </div>
      </div>

      <p className="mt-5 text-center text-xs text-ash">{t("demoNote")}</p>
    </section>
  );
}

function Block({
  num,
  title,
  children,
}: {
  num: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li>
      <div className="flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-obsidian text-[10px] font-bold text-white">
          {num}
        </span>
        <span className="text-sm font-semibold">{title}</span>
      </div>
      <div className="mt-2.5 pl-7">{children}</div>
    </li>
  );
}
