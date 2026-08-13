"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";

/**
 * À qui got_the_ref s'adresse — deux publics, deux façons d'être cité, chacune
 * démontrée par une maquette animée plutôt que décrite : à gauche la liste des
 * sources d'une réponse IA où le site remonte au premier rang, à droite la
 * carte du quartier où le commerce se détache de ses voisins.
 *
 * Même grammaire que le bento juste au-dessus : tout est inline (SVG, données
 * de démo), les animations démarrent à l'entrée dans le champ de vision et se
 * taisent sous `prefers-reduced-motion` — la maquette reste alors lisible dans
 * son état final, jamais figée à mi-course.
 */
export function Audiences() {
  const t = useTranslations("audiences");

  return (
    <section id="pour-qui" className="mx-auto w-full max-w-6xl scroll-mt-8 px-5 py-16 sm:py-20">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-steel">{t("eyebrow")}</p>
        <h2 className="mt-2 text-balance text-3xl font-bold leading-tight sm:text-4xl">
          {t("title")}
        </h2>
        <p className="mx-auto mt-3 text-pretty text-muted">{t("subtitle")}</p>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card
          title={t("online.title")}
          body={t("online.body")}
          points={t.raw("online.points") as string[]}
          icon={<IconGlobe />}
        >
          <OnlineDemo />
        </Card>
        <Card
          title={t("local.title")}
          body={t("local.body")}
          points={t.raw("local.points") as string[]}
          icon={<IconPin />}
        >
          <LocalDemo />
        </Card>
      </div>
    </section>
  );
}

/* ------------------------------- Coquille -------------------------------- */

function Card({
  title,
  body,
  points,
  icon,
  children,
}: {
  title: string;
  body: string;
  points: string[];
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <article className="card-cal flex flex-col overflow-hidden p-6 sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <h3 className="text-balance text-xl font-bold leading-snug sm:text-2xl">{title}</h3>
        <span className="mt-1 shrink-0 text-ash" aria-hidden>
          {icon}
        </span>
      </div>
      <p className="mt-3 max-w-md text-pretty text-sm leading-relaxed text-muted">{body}</p>

      <ul className="mt-4 flex flex-wrap gap-2">
        {points.map((p) => (
          <li
            key={p}
            className="rounded-full border border-fog bg-mist px-3 py-1 text-[11px] font-medium text-graphite"
          >
            {p}
          </li>
        ))}
      </ul>

      <div className="mt-7 flex flex-1 items-end">
        <div className="w-full">{children}</div>
      </div>
    </article>
  );
}

/** Déclenche une animation une fois la carte visible — et une seule fois. */
function useSeen<T extends Element>() {
  const ref = useRef<T>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  return { ref, inView };
}

/* ------------------- 1 · En ligne : la source qui remonte ------------------ */

function OnlineDemo() {
  const t = useTranslations("audiences.online");
  const reduce = useReducedMotion();
  const { ref, inView } = useSeen<HTMLDivElement>();
  const sources = t.raw("sources") as string[];
  const [promoted, setPromoted] = useState(false);

  // Le site apparaît en bas de liste, puis prend la première place : c'est tout
  // le sujet de la carte, joué une fois, sans boucle.
  useEffect(() => {
    if (!inView || reduce) return;
    const id = setTimeout(() => setPromoted(true), 900);
    return () => clearTimeout(id);
  }, [inView, reduce]);

  const shown = reduce || promoted;
  const you = { name: t("you"), you: true };
  const others = sources.map((name) => ({ name, you: false }));
  const list = shown ? [you, ...others] : [...others, you];

  return (
    <div ref={ref} className="rounded-[24px] border border-fog bg-mist p-4">
      <p className="px-1 text-[11px] leading-relaxed text-muted">{t("query")}</p>

      <div className="mt-3 rounded-[18px] border border-fog bg-snow p-3">
        <p className="px-1 pb-2 text-[10px] font-semibold uppercase tracking-wider text-ash">
          {t("caption")}
        </p>

        <ul className="space-y-1.5">
          {list.map((item, i) => (
            <motion.li
              key={item.name + (item.you ? "-you" : "")}
              layout={!reduce}
              transition={{ type: "spring", stiffness: 260, damping: 26 }}
              className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-[12px] ${
                item.you && shown
                  ? "bg-obsidian text-white"
                  : "bg-mist text-muted"
              }`}
            >
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold ${
                  item.you && shown ? "bg-white text-obsidian" : "bg-pebble text-snow"
                }`}
              >
                {i + 1}
              </span>
              <span className="truncate">{item.name}</span>
            </motion.li>
          ))}
        </ul>
      </div>

      <motion.p
        initial={{ opacity: 0, y: 6 }}
        animate={shown ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
        transition={{ duration: 0.3, ease: "easeOut", delay: reduce ? 0 : 0.25 }}
        className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-snow px-3 py-1.5 text-[11px] font-semibold text-graphite ring-1 ring-fog"
      >
        <IconQuote />
        {t("badge")}
      </motion.p>
    </div>
  );
}

/* ------------------ 2 · Local : la carte et les voisins ------------------- */

/** Position des commerces sur la carte de démo, en pourcentage du cadre. */
const COMPETITOR_PINS = [
  { x: 22, y: 30 },
  { x: 74, y: 26 },
  { x: 66, y: 70 },
];

function LocalDemo() {
  const t = useTranslations("audiences.local");
  const reduce = useReducedMotion();
  const { ref, inView } = useSeen<HTMLDivElement>();
  const competitors = t.raw("competitors") as string[];
  const play = inView || reduce;

  return (
    <div ref={ref} className="rounded-[24px] border border-fog bg-mist p-4">
      <p className="px-1 text-[11px] leading-relaxed text-muted">{t("query")}</p>

      <div className="relative mt-3 aspect-[16/10] overflow-hidden rounded-[18px] border border-fog bg-snow">
        {/* Le plan : quelques rues et un parc, assez pour lire « carte » sans en dire plus. */}
        <svg viewBox="0 0 320 200" className="absolute inset-0 h-full w-full" aria-hidden>
          <rect width="320" height="200" fill="#f8f8f9" />
          <path d="M0 128h320M0 62h320M96 0v200M228 0v200" stroke="#ececee" strokeWidth="10" />
          <path d="M0 96h320M160 0v200" stroke="#f1f1f2" strokeWidth="6" />
          <rect x="196" y="132" width="88" height="46" rx="10" fill="#e8f0e6" />
          <rect x="16" y="146" width="58" height="34" rx="8" fill="#eef0f2" />
        </svg>

        {/* Les voisins : présents, mais éteints. */}
        {COMPETITOR_PINS.map((p, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={play ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.6 }}
            transition={{ duration: reduce ? 0 : 0.3, delay: reduce ? 0 : 0.15 * i }}
            className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
            style={{ left: `${p.x}%`, top: `${p.y}%` }}
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full border border-pebble bg-snow text-ash">
              <IconPin small />
            </span>
            <span className="rounded-full bg-snow/90 px-1.5 text-[9px] text-ash">
              {competitors[i]}
            </span>
          </motion.div>
        ))}

        {/* Vous : le seul point noir de la carte, et le seul qui respire. */}
        <motion.div
          initial={{ opacity: 0, scale: 0.4 }}
          animate={play ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.4 }}
          transition={{
            duration: reduce ? 0 : 0.45,
            delay: reduce ? 0 : 0.6,
            ease: [0.175, 0.885, 0.32, 1.2],
          }}
          className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
        >
          <span className="relative flex h-9 w-9 items-center justify-center">
            {!reduce && (
              <motion.span
                className="absolute inset-0 rounded-full bg-obsidian/15"
                animate={play ? { scale: [1, 1.8], opacity: [0.5, 0] } : {}}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut", delay: 0.9 }}
              />
            )}
            <span className="relative flex h-7 w-7 items-center justify-center rounded-full bg-obsidian text-white shadow-[var(--shadow-md)]">
              <IconPin small />
            </span>
          </span>

          <motion.span
            initial={{ opacity: 0, y: 4 }}
            animate={play ? { opacity: 1, y: 0 } : { opacity: 0, y: 4 }}
            transition={{ duration: reduce ? 0 : 0.3, delay: reduce ? 0 : 1 }}
            className="mt-1 whitespace-nowrap rounded-full bg-obsidian px-2.5 py-1 text-[10px] font-semibold text-white"
          >
            {t("you")}
          </motion.span>
        </motion.div>
      </div>

      <motion.p
        initial={{ opacity: 0, y: 6 }}
        animate={play ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
        transition={{ duration: reduce ? 0 : 0.3, delay: reduce ? 0 : 1.2 }}
        className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-snow px-3 py-1.5 text-[11px] font-semibold text-graphite ring-1 ring-fog"
      >
        <IconStar />
        {t("badge")}
      </motion.p>
    </div>
  );
}

/* -------------------------------- Icônes --------------------------------- */

function IconGlobe() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M3.5 12h17M12 3.5c2.2 2.3 3.3 5.2 3.3 8.5S14.2 18.2 12 20.5c-2.2-2.3-3.3-5.2-3.3-8.5S9.8 5.8 12 3.5z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function IconPin({ small = false }: { small?: boolean }) {
  const size = small ? 12 : 22;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 21s7-5.6 7-10.5a7 7 0 1 0-14 0C5 15.4 12 21 12 21z"
        stroke="currentColor"
        strokeWidth={small ? 2 : 1.5}
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10.5" r="2.4" stroke="currentColor" strokeWidth={small ? 2 : 1.5} />
    </svg>
  );
}

function IconQuote() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9.5 6C6.5 7.5 5 10 5 13v5h6v-6H8c0-2 .5-3.5 2.5-4.5zM19.5 6c-3 1.5-4.5 4-4.5 7v5h6v-6h-3c0-2 .5-3.5 2.5-4.5z"
        fill="currentColor"
      />
    </svg>
  );
}

function IconStar() {
  return (
    <svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path d="M10 1.6l2.5 5.1 5.6.8-4 3.9 1 5.6-5.1-2.7-5 2.7 1-5.6-4.1-3.9 5.6-.8z" />
    </svg>
  );
}
