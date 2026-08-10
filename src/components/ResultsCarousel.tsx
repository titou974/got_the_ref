import Image from "next/image";
import { getTranslations } from "next-intl/server";
import {
  PROOF_IS_ILLUSTRATIVE,
  TESTIMONIALS,
  type Testimonial,
} from "@/constants/testimonials";

/**
 * Bandeau de preuves qui défile sans fin. Chaque carte porte une parole ; les
 * activités en ligne y ajoutent leur courbe Search Console, parce que c'est là
 * que leur progression se mesure — un restaurant, lui, se juge à sa salle.
 *
 * Le ruban déborde volontairement de la grille : il donne à voir une file qui
 * continue hors écran, plutôt qu'une liste qu'on aurait finie de lire.
 * Animation en CSS pur (aucun JavaScript), suspendue au survol et désactivée
 * sous `prefers-reduced-motion`.
 */
export async function ResultsCarousel({ className = "" }: { className?: string }) {
  const t = await getTranslations("results");

  // Alternance physique / en ligne : la salle et la courbe se répondent au lieu
  // de s'empiler par familles.
  const locals = TESTIMONIALS.filter((x) => x.kind === "local");
  const onlines = TESTIMONIALS.filter((x) => x.kind === "online");
  const items: Testimonial[] = [];
  for (let i = 0; i < Math.max(locals.length, onlines.length); i++) {
    if (locals[i]) items.push(locals[i]);
    if (onlines[i]) items.push(onlines[i]);
  }

  const labels = {
    clicks: t("clicks"),
    impressions: t("impressions"),
    position: t("position"),
  };

  return (
    <section className={className}>
      <div className="mx-auto max-w-6xl px-5 text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-steel">{t("eyebrow")}</p>
        <h2 className="mt-2 text-balance text-2xl font-bold sm:text-3xl">{t("title")}</h2>
        <p className="mx-auto mt-3 max-w-xl text-pretty text-sm text-muted">{t("subtitle")}</p>
      </div>

      {/* Le ruban sort de la grille : plein cadre, sans jamais faire défiler la page. */}
      <div className="marquee mt-8">
        <div className="marquee-track">
          {/* Deux passes identiques : la seconde prend le relais sans rupture. */}
          {[0, 1].map((pass) => (
            <ul key={pass} className="marquee-row" aria-hidden={pass === 1 || undefined}>
              {items.map((item, i) => (
                <TestimonialCard key={`${pass}-${i}`} item={item} labels={labels} />
              ))}
            </ul>
          ))}
        </div>
      </div>

      {PROOF_IS_ILLUSTRATIVE && (
        <p className="mx-auto mt-6 max-w-2xl px-5 text-center text-xs text-ash">
          {t("illustrativeNote")}
        </p>
      )}
    </section>
  );
}

function TestimonialCard({
  item,
  labels,
}: {
  item: Testimonial;
  labels: { clicks: string; impressions: string; position: string };
}) {
  return (
    <li className="flex w-[19rem] shrink-0 flex-col overflow-hidden rounded-[28px] border border-fog bg-snow shadow-[var(--shadow-md)] sm:w-[23rem]">
      <figure className="flex flex-1 flex-col p-6">
        <Stars />
        <blockquote className="mt-4 flex-1 text-pretty text-sm leading-relaxed text-text">
          « {item.quote} »
        </blockquote>
        <figcaption className="mt-5 border-t border-fog pt-4">
          <p className="text-sm font-semibold">{item.author}</p>
          <p className="mt-0.5 text-xs text-muted">{item.role}</p>
        </figcaption>
      </figure>

      {/* Activité en ligne : la courbe et ses chiffres closent la carte. */}
      {item.stats && (
        <div className="border-t border-fog">
          <Image
            src={item.stats.shot}
            alt=""
            width={720}
            height={496}
            className="h-auto w-full"
            sizes="(max-width: 640px) 19rem, 23rem"
          />
          <dl className="grid grid-cols-3 gap-2 border-t border-fog px-4 py-3 text-center">
            <Stat label={labels.clicks} value={item.stats.clicks} />
            <Stat label={labels.impressions} value={item.stats.impressions} />
            <Stat label={labels.position} value={item.stats.position} />
          </dl>
        </div>
      )}
    </li>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-steel">{label}</dt>
      <dd className="mt-0.5 text-sm font-bold tabular-nums">{value}</dd>
    </div>
  );
}

/** Cinq étoiles pleines, dessinées plutôt qu'importées : une image de moins à charger. */
function Stars() {
  return (
    <span className="flex gap-0.5" aria-hidden>
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} width="14" height="14" viewBox="0 0 24 24" fill="#11b48c">
          <path d="M12 2.5l2.9 5.9 6.5.95-4.7 4.58 1.11 6.47L12 17.4l-5.81 3.05 1.11-6.47-4.7-4.58 6.5-.95L12 2.5Z" />
        </svg>
      ))}
    </span>
  );
}
