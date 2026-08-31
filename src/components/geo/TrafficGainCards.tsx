import Image from "next/image";
import { getTranslations } from "next-intl/server";
import type { TrafficGain } from "@/lib/geo/traffic-gain";

/**
 * Ce que les corrections rapportent, en visites, réparties sur les quatre
 * surfaces qui les envoient.
 *
 * La rangée se lit dans un seul sens : le total d'abord, puis les quatre parts
 * qui le composent. Toutes les cartes sont claires, et le seul aplat sombre de
 * la rangée est la pastille qui tient le total. C'est ce que le client achète
 * en haut, le détail en dessous, et une seule tache d'encre pour dire lequel
 * des deux compte.
 *
 * Une carte de moteur ne porte que quatre choses : le nom, le logo, le nombre
 * de visites et son unité. Pas de pastille de variation, il n'y a pas de
 * période précédente à comparer. Pas de pourcentage de répartition non plus :
 * les quatre nombres sont déjà dans la même unité, à l'écran en même temps, et
 * un pourcentage à côté de chacun ne dit rien de plus que ce que l'œil fait
 * déjà en les comparant.
 *
 * Rien n'est présenté comme relevé : le mot « estimées » est dans le titre de
 * chaque rangée, et c'est le seul endroit où il ait besoin d'être. Le détail
 * du calcul vit dans `lib/geo/traffic-gain`, pas sous la rangée : une ligne de
 * méthode posée là allongeait trois écrans pour répéter ce que le titre dit
 * déjà en un mot.
 */
export async function TrafficGainCards({
  gain,
  title,
  caption,
}: {
  gain: TrafficGain;
  /** L'intitulé de la rangée, au-dessus du total. */
  title: string;
  /** Ce qui déclenche ce gain : les corrections de contenu, toutes, l'offre. */
  caption: string;
}) {
  const t = await getTranslations("trafficGain");

  return (
    <section>
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {/* Le total, sur toute la largeur. La carte reste claire comme les
            quatre autres : c'est la pastille du chiffre qui porte le sombre.
            Une surface pleine en primary écrasait le reste de l'écran et
            faisait du total une bannière ; ramené à sa pastille, il se lit
            comme le résultat des quatre cartes plutôt que comme une réclame. */}
        <div className="col-span-2 rounded-[24px] border border-border bg-surface p-5 sm:p-6 lg:col-span-4">
          <dt className="text-[11px] font-semibold uppercase tracking-wider text-steel">
            {title}
          </dt>
          <div className="mt-2.5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
            <dd className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <span className="rounded-pill bg-obsidian px-3.5 py-1.5 text-[26px] font-bold leading-none tabular-nums text-white sm:text-[30px]">
                +{gain.total.toLocaleString("fr-FR")}
              </span>
              <span className="text-sm font-medium text-muted">{t("perMonth")}</span>
            </dd>
            <p className="text-pretty text-sm leading-relaxed text-muted sm:max-w-md sm:text-right">
              {caption}
            </p>
          </div>
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
          </div>
        ))}
      </dl>
    </section>
  );
}
