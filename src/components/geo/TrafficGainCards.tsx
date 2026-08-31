import Image from "next/image";
import { getTranslations } from "next-intl/server";
import type { TrafficGain } from "@/lib/geo/traffic-gain";

/**
 * Ce que les corrections rapportent, en visites, réparties sur les quatre
 * surfaces qui les envoient.
 *
 * La rangée se lit dans un seul sens : le total d'abord, sur la seule carte
 * sombre de l'écran, puis les quatre parts qui le composent. Le contraste
 * n'est pas décoratif — c'est ce que le client achète en haut, et le détail de
 * la facture en dessous.
 *
 * Les cartes de moteur ne portent pas de pastille de variation. Une pastille
 * verte « +12 % » annonce une mesure comparée à la période précédente, et il
 * n'y a rien à comparer ici : ce sont des visites qui n'existent pas encore.
 * À sa place, un filet de répartition — la part de ce moteur dans le total.
 * Les quatre filets côte à côte forment une distribution, ce qui est
 * exactement ce que les quatre chiffres racontent.
 *
 * Rien n'est présenté comme relevé : le mot « estimées » est dans le titre, et
 * la note sous la rangée dit d'où sort le calcul (cf. `lib/geo/traffic-gain`).
 */
export async function TrafficGainCards({
  gain,
  title,
  caption,
  note,
}: {
  gain: TrafficGain;
  /** L'intitulé porté par la carte sombre, au-dessus du total. */
  title: string;
  /** Ce qui déclenche ce gain : les corrections de contenu, toutes, l'offre. */
  caption: string;
  /** D'où sort le calcul. Une ligne, sous la rangée. */
  note: string;
}) {
  const t = await getTranslations("trafficGain");

  return (
    <section>
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {/* Le total, sur toute la largeur : c'est la seule ligne que le client
            retiendra, et la seule surface sombre de la page. */}
        <div className="col-span-2 rounded-[28px] bg-obsidian p-5 text-white sm:p-6 lg:col-span-4">
          <dt className="text-[11px] font-semibold uppercase tracking-wider text-white/60">
            {title}
          </dt>
          <dd className="mt-2 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <span className="text-[44px] font-bold leading-none tabular-nums sm:text-[56px]">
              +{gain.total.toLocaleString("fr-FR")}
            </span>
            <span className="text-sm font-medium text-white/60">{t("perMonth")}</span>
          </dd>
          <p className="mt-3 max-w-lg text-pretty text-sm leading-relaxed text-white/70">
            {caption}
          </p>
        </div>

        {gain.engines.map((engine) => (
          <div
            key={engine.engine}
            className="rounded-[24px] border border-border bg-surface p-4 sm:p-5"
          >
            <div className="flex items-start justify-between gap-2">
              <dt className="min-w-0 truncate text-sm font-medium text-text">{engine.label}</dt>
              {/* Le logo dans son disque clair : posé à même la carte blanche,
                  un carré de marque se lit comme une image collée. */}
              <span
                aria-hidden
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-mist"
              >
                <Image
                  src={engine.logo}
                  alt=""
                  width={18}
                  height={18}
                  className="h-[18px] w-[18px] object-contain"
                />
              </span>
            </div>

            <dd className="mt-2.5 text-[26px] font-bold leading-none tabular-nums sm:text-[30px]">
              +{engine.visits.toLocaleString("fr-FR")}
            </dd>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-steel">
              {t("unit")}
            </p>

            {/* La part de ce moteur dans le total. Quatre filets remplis à des
                hauteurs différentes disent la répartition sans qu'on ait à
                lire les quatre chiffres. */}
            <div className="mt-3.5 flex items-center gap-2">
              <span aria-hidden className="h-1 min-w-0 flex-1 rounded-full bg-mist">
                <span
                  className="block h-1 rounded-full bg-obsidian"
                  style={{ width: `${engine.share}%` }}
                />
              </span>
              <span className="shrink-0 text-[11px] font-semibold tabular-nums text-steel">
                {t("share", { share: engine.share })}
              </span>
            </div>
          </div>
        ))}
      </dl>

      <p className="mt-3 text-xs leading-relaxed text-muted">{note}</p>
    </section>
  );
}
