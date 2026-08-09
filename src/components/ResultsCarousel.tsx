import Image from "next/image";
import { getTranslations } from "next-intl/server";
import {
  RESULT_SHOTS,
  TESTIMONIALS,
  TESTIMONIALS_ARE_PLACEHOLDERS,
  type ResultShot,
  type Testimonial,
} from "@/constants/testimonials";

/**
 * Bandeau de preuves qui défile sans fin : captures de progression et paroles de
 * clients alternées, pour que le chiffre et la voix se répondent au lieu de
 * s'empiler. Le ruban déborde volontairement de la grille — il donne à voir une
 * file qui continue hors écran, plutôt qu'une liste qu'on aurait finie de lire.
 *
 * Animation en CSS pur (aucun JavaScript), suspendue au survol et désactivée
 * sous `prefers-reduced-motion`.
 */
export async function ResultsCarousel({ className = "" }: { className?: string }) {
  const t = await getTranslations("results");

  // Alternance capture / témoignage : la preuve chiffrée puis la preuve humaine.
  const items: ({ type: "shot" } & ResultShot | { type: "quote" } & Testimonial)[] = [];
  const longest = Math.max(RESULT_SHOTS.length, TESTIMONIALS.length);
  for (let i = 0; i < longest; i++) {
    if (RESULT_SHOTS[i]) items.push({ type: "shot", ...RESULT_SHOTS[i] });
    if (TESTIMONIALS[i]) items.push({ type: "quote", ...TESTIMONIALS[i] });
  }

  const labels = {
    clicks: t("clicks"),
    impressions: t("impressions"),
    position: t("position"),
    placeholder: t("placeholder"),
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
              {items.map((item, i) =>
                item.type === "shot" ? (
                  <ShotCard key={`${pass}-s-${i}`} shot={item} labels={labels} />
                ) : (
                  <QuoteCard key={`${pass}-q-${i}`} quote={item} placeholder={labels.placeholder} />
                ),
              )}
            </ul>
          ))}
        </div>
      </div>
    </section>
  );
}

function ShotCard({
  shot,
  labels,
}: {
  shot: ResultShot;
  labels: { clicks: string; impressions: string; position: string };
}) {
  return (
    <li className="w-[19rem] shrink-0 overflow-hidden rounded-[28px] border border-fog bg-snow shadow-[var(--shadow-md)] sm:w-[22rem]">
      <Image
        src={shot.src}
        alt=""
        width={720}
        height={496}
        className="h-auto w-full"
        sizes="(max-width: 640px) 19rem, 22rem"
      />
      <dl className="grid grid-cols-3 gap-2 border-t border-fog px-4 py-3 text-center">
        <Stat label={labels.clicks} value={shot.clicks} />
        <Stat label={labels.impressions} value={shot.impressions} />
        <Stat label={labels.position} value={shot.position} />
      </dl>
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

function QuoteCard({ quote, placeholder }: { quote: Testimonial; placeholder: string }) {
  return (
    <li className="flex w-[19rem] shrink-0 flex-col justify-between rounded-[28px] border border-fog bg-snow p-6 shadow-[var(--shadow-md)] sm:w-[22rem]">
      <div>
        <div className="flex items-center gap-2">
          <Stars />
          {TESTIMONIALS_ARE_PLACEHOLDERS && (
            <span className="rounded-full bg-mist px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-steel">
              {placeholder}
            </span>
          )}
        </div>
        <blockquote className="mt-4 text-pretty text-sm leading-relaxed text-text">
          « {quote.quote} »
        </blockquote>
      </div>
      <figcaption className="mt-5 border-t border-fog pt-4">
        <p className="text-sm font-semibold">{quote.author}</p>
        <p className="mt-0.5 text-xs text-muted">{quote.role}</p>
      </figcaption>
    </li>
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
