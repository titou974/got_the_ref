import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { GrowthChart } from "./GrowthChart";
import { GoogleMark } from "./GoogleMark";

type Stat = { label: string; value: string };

/**
 * Les deux débouchés d'un même travail, côte à côte : la place sur Google et la
 * citation dans les assistants. À gauche, la courbe porte le repère de mise en
 * service — la croissance vient après, pas avant. À droite, la réponse d'un
 * assistant où l'établissement est nommé.
 */
export async function RankAndMentions() {
  const t = await getTranslations("rankAndMentions");
  const stats = t.raw("rank.stats") as Stat[];
  const bullets = t.raw("mentions.answerBullets") as string[];

  return (
    <section className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-5 px-5 py-16 sm:py-20 lg:grid-cols-2">
      {/* Google */}
      <div className="card-cal p-6 sm:p-7">
        <h2 className="text-2xl font-bold leading-snug">{t("rank.title")}</h2>
        <p className="mt-2 max-w-md text-pretty text-sm leading-relaxed text-muted">
          {t("rank.body")}
        </p>

        <span className="mt-4 inline-flex items-center gap-2 rounded-full border border-fog bg-mist px-3 py-1.5 text-xs font-medium text-graphite">
          <GoogleMark size={14} />
          {t("rank.verify")}
        </span>

        <div className="mt-5 overflow-hidden rounded-[20px] border border-fog bg-snow">
          <dl className="grid grid-cols-2 divide-fog border-b border-fog sm:grid-cols-4 sm:divide-x">
            {stats.map((stat) => (
              <div key={stat.label} className="px-3 py-2.5">
                <dt className="truncate text-[10px] font-semibold uppercase tracking-wider text-steel">
                  {stat.label}
                </dt>
                <dd className="mt-0.5 text-lg font-bold tabular-nums">{stat.value}</dd>
              </div>
            ))}
          </dl>

          <div className="p-3">
            <GrowthChart markerLabel={t("rank.marker")} />
          </div>
        </div>

        <p className="mt-3 text-[11px] text-ash">{t("rank.caption")}</p>
      </div>

      {/* Assistants IA */}
      <div className="card-cal p-6 sm:p-7">
        <h2 className="text-2xl font-bold leading-snug">{t("mentions.title")}</h2>
        <p className="mt-2 max-w-md text-pretty text-sm leading-relaxed text-muted">
          {t("mentions.body")}
        </p>

        <span className="mt-4 inline-flex items-center gap-2 rounded-full border border-fog bg-mist px-3 py-1.5 text-xs font-medium text-graphite">
          <Image src="/chatgpt.png" alt="" aria-hidden width={32} height={32} className="h-3.5 w-3.5" />
          {t("mentions.verify")}
        </span>

        <div className="mt-5 overflow-hidden rounded-[20px] border border-fog bg-snow">
          <div className="flex items-center gap-2 border-b border-fog px-4 py-2.5">
            <Image src="/chatgpt.png" alt="" aria-hidden width={32} height={32} className="h-4 w-4" />
            <span className="text-sm font-semibold text-[#0d0d0d]">ChatGPT</span>
          </div>

          <div className="space-y-3 p-4">
            <div className="flex justify-end">
              <p className="max-w-[85%] rounded-[18px] bg-[#f4f4f4] px-3.5 py-2 text-[13px] leading-relaxed text-[#0d0d0d]">
                {t("mentions.question")}
              </p>
            </div>

            <div className="flex items-start gap-2.5">
              <Image
                src="/chatgpt.png"
                alt=""
                aria-hidden
                width={32}
                height={32}
                className="mt-0.5 h-4 w-4 shrink-0"
              />
              <div className="min-w-0 text-[13px] leading-relaxed text-[#1f1f1f]">
                <p>
                  {t("mentions.answerBefore")}{" "}
                  <strong className="font-semibold">{t("mentions.answerBrand")}</strong>
                  {t("mentions.answerAfter")}
                </p>
                <ul className="mt-2 space-y-1.5">
                  {bullets.map((bullet) => (
                    <li key={bullet} className="flex gap-2">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ash" aria-hidden />
                      {bullet}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
