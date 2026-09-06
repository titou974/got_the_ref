"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { PLATFORMS } from "@/constants/platforms";

/**
 * Le bento de la home : sept promesses, chacune démontrée par une petite
 * maquette animée plutôt que décrite. Le principe est constant d'une carte à
 * l'autre — on montre le produit en train de faire la chose, à l'échelle d'une
 * vignette. Tout est inline (SVG, logos, données de démo) : aucune image à
 * charger, aucun appel réseau au rendu.
 *
 * Toutes les animations démarrent à l'entrée dans le champ de vision et se
 * taisent sous `prefers-reduced-motion` — la maquette reste alors lisible dans
 * son état final, jamais figée à mi-course.
 */
export function FeatureCards() {
  const t = useTranslations("features");

  return (
    <section
      id="fonctionnalites"
      className="mx-auto w-full max-w-6xl scroll-mt-8 px-5 py-16 sm:py-20"
    >
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="mt-2 text-balance text-3xl font-bold leading-tight sm:text-4xl">
          {t("title")}
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-pretty text-muted">
          {t("subtitle")}
        </p>
      </div>

      <div className="mt-10 flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Card
            title={t("voice.title")}
            body={t("voice.body")}
            icon={<IconPen />}
          >
            <VoiceDemo />
          </Card>
          <Card
            title={t("strategy.title")}
            body={t("strategy.body")}
            icon={<IconCalendar />}
          >
            <StrategyDemo />
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <Card
            title={t("publish.title")}
            body={t("publish.body")}
            icon={<IconBookmark />}
          >
            <PublishDemo />
          </Card>
          <Card
            title={t("authority.title")}
            body={t("authority.body")}
            icon={<IconShare />}
          >
            <AuthorityDemo />
          </Card>
          <Card
            title={t("fix.title")}
            body={t("fix.body")}
            icon={<IconWrench />}
          >
            <FixDemo />
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Card
            title={t("social.title")}
            body={t("social.body")}
            icon={<IconMonitor />}
          >
            <SocialDemo />
          </Card>
          <Card
            title={t("recommend.title")}
            body={t("recommend.body")}
            icon={<IconEye />}
          >
            <RecommendDemo />
          </Card>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------- Coquille -------------------------------- */

function Card({
  title,
  body,
  icon,
  children,
}: {
  title: string;
  body: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <article className="card-cal flex flex-col overflow-hidden p-6 sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <h3 className="text-balance text-xl font-bold leading-snug sm:text-2xl">
          {title}
        </h3>
        <span className="mt-1 shrink-0 text-ash" aria-hidden>
          {icon}
        </span>
      </div>
      <p className="mt-3 max-w-md text-pretty text-sm leading-relaxed text-muted">
        {body}
      </p>
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

/* ---------------------------- 1 · Ton de marque --------------------------- */

function VoiceDemo() {
  const t = useTranslations("features.voice");
  const reduce = useReducedMotion();
  const { ref, inView } = useSeen<HTMLDivElement>();
  const full = t("demo");
  const [len, setLen] = useState(0);

  useEffect(() => {
    if (!inView || reduce) return;
    if (len >= full.length) return;
    const id = setTimeout(() => setLen((n) => n + 1), 26);
    return () => clearTimeout(id);
  }, [inView, len, full.length, reduce]);

  // Sans mouvement, la phrase est simplement là, entière : rien ne se tape.
  const shown = reduce ? full.length : len;
  const done = shown >= full.length;

  return (
    <div ref={ref} className="rounded-[24px] border border-fog bg-mist p-4">
      <div className="rounded-[18px] border border-fog bg-snow p-4">
        <p className="min-h-[5.5rem] text-[13px] leading-relaxed text-text sm:min-h-[4.5rem]">
          <span className={done ? undefined : "caret"}>
            {full.slice(0, shown)}
          </span>
        </p>
      </div>
      <motion.p
        initial={{ opacity: 0, y: 6 }}
        animate={done ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-snow px-3 py-1.5 text-[11px] font-semibold text-graphite ring-1 ring-fog"
      >
        <SparkleIcon />
        {t("badge")}
      </motion.p>
    </div>
  );
}

/* ---------------------------- 2 · Calendrier ------------------------------ */

/** Jours du mois portant un article programmé (donnée de démo). */
const PLANNED_DAYS = [2, 5, 9, 12, 16, 19, 23, 26, 30];

function StrategyDemo() {
  const t = useTranslations("features.strategy");
  const reduce = useReducedMotion();
  const { ref, inView } = useSeen<HTMLDivElement>();

  return (
    <div ref={ref} className="rounded-[24px] border border-fog bg-mist p-4">
      <div className="flex items-center justify-between px-1 pb-3">
        <span className="text-xs font-semibold text-graphite">
          {t("month")}
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-muted">
          <span className="h-2 w-2 rounded-full bg-obsidian" aria-hidden />
          {t("legend")}
        </span>
      </div>

      <div className="grid grid-cols-7 gap-1.5 rounded-[18px] border border-fog bg-snow p-3">
        {Array.from({ length: 35 }).map((_, i) => {
          const day = i + 1;
          const planned = PLANNED_DAYS.includes(day);
          const order = PLANNED_DAYS.indexOf(day);
          return (
            <div
              key={i}
              className="relative flex aspect-square items-center justify-center rounded-lg bg-mist text-[10px] text-ash"
            >
              {day <= 31 ? day : ""}
              {planned && (
                <motion.span
                  initial={{ scale: 0, opacity: 0 }}
                  animate={
                    inView ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }
                  }
                  transition={{
                    delay: reduce ? 0 : 0.12 * order,
                    duration: reduce ? 0 : 0.35,
                    ease: [0.175, 0.885, 0.32, 1.2],
                  }}
                  className="absolute inset-0 flex items-center justify-center rounded-lg bg-obsidian text-[10px] font-semibold text-white"
                >
                  {day}
                </motion.span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------- 3 · Publication ----------------------------- */

/** Arrondi au centième — cf. la note sur l'hydratation de l'anneau de logos. */
function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function PublishDemo() {
  const reduce = useReducedMotion();
  const radius = 86;

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[260px]">
      {/* Cibles concentriques et rayons : le décor fixe du radar. */}
      <svg
        viewBox="0 0 240 240"
        className="absolute inset-0 h-full w-full text-pebble"
        aria-hidden
      >
        {[46, 70, 94].map((r) => (
          <circle
            key={r}
            cx="120"
            cy="120"
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            strokeDasharray="3 5"
            opacity="0.7"
          />
        ))}
        {Array.from({ length: 8 }).map((_, i) => {
          const a = (i * Math.PI) / 4;
          return (
            <line
              key={i}
              x1={120 + Math.cos(a) * 26}
              y1={120 + Math.sin(a) * 26}
              x2={120 + Math.cos(a) * 94}
              y2={120 + Math.sin(a) * 94}
              stroke="currentColor"
              strokeWidth="1"
              strokeDasharray="3 5"
              opacity="0.55"
            />
          );
        })}
      </svg>

      {/* Anneau de logos : il tourne, chaque logo contre-tourne pour rester droit. */}
      <div className={`absolute inset-0 ${reduce ? "" : "orbit-ring"}`}>
        {PLATFORMS.map((p, i) => {
          const angle = (i / PLATFORMS.length) * 2 * Math.PI - Math.PI / 2;
          return (
            <div
              key={p.name}
              className="absolute left-1/2 top-1/2 h-9 w-9"
              // Coordonnées arrondies au centième : `Math.cos` rend des valeurs
              // comme `-43.000000000000036`, que le navigateur renormalise en
              // `-43px` à la lecture. React comparait alors sa chaîne au style
              // relu du DOM et signalait un écart d'hydratation à chaque visite
              // de la home. Deux décimales suffisent au placement.
              style={{
                transform: `translate(-50%, -50%) translate(${round2(
                  Math.cos(angle) * radius,
                )}px, ${round2(Math.sin(angle) * radius)}px)`,
              }}
            >
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full border border-fog bg-snow shadow-[var(--shadow-md)] ${
                  reduce ? "" : "orbit-badge"
                }`}
                title={p.name}
              >
                <svg
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill={p.color}
                  aria-hidden
                >
                  <path d={p.path} />
                </svg>
              </div>
            </div>
          );
        })}
      </div>

      {/* Centre : l'envoi. */}
      <div className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl border border-fog bg-snow shadow-[var(--shadow-md)]">
        <motion.span
          animate={reduce ? undefined : { y: [0, -3, 0], x: [0, 3, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          className="text-obsidian"
          aria-hidden
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path
              d="M21 3 3 10.5l7 2.5 2.5 7L21 3Z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
          </svg>
        </motion.span>
      </div>
    </div>
  );
}

/* ------------------------------ 4 · Autorité ------------------------------ */

function AuthorityDemo() {
  const t = useTranslations("features.authority");
  const reduce = useReducedMotion();
  const { ref, inView } = useSeen<HTMLDivElement>();

  return (
    <div ref={ref} className="relative">
      {/* Fenêtre d'arrière-plan : suggère une pile de pages du réseau. */}
      <div className="absolute -left-1 top-6 hidden w-[72%] rounded-[16px] border border-fog bg-snow p-3 sm:block">
        <div className="space-y-2" aria-hidden>
          <div className="h-2 w-3/4 rounded-full bg-mist" />
          <div className="h-2 w-1/2 rounded-full bg-mist" />
          <div className="h-2 w-2/3 rounded-full bg-mist" />
        </div>
      </div>

      {/* Fenêtre au premier plan. */}
      <div className="relative ml-auto w-[92%] overflow-hidden rounded-[18px] border border-fog bg-snow shadow-[var(--shadow-md)]">
        <div className="flex items-center gap-2 border-b border-fog px-3 py-2">
          <span className="flex gap-1" aria-hidden>
            <span className="h-1.5 w-1.5 rounded-full bg-[#ff5f57]" />
            <span className="h-1.5 w-1.5 rounded-full bg-[#febc2e]" />
            <span className="h-1.5 w-1.5 rounded-full bg-[#28c840]" />
          </span>
          <span className="truncate rounded-full bg-mist px-2 py-0.5 text-[10px] text-muted">
            {t("url")}
          </span>
        </div>

        <div className="space-y-2 p-3" aria-hidden>
          <div className="h-2 w-2/3 rounded-full bg-mist" />
          <div className="h-2 w-1/2 rounded-full bg-mist" />
          <div className="h-14 w-full rounded-lg bg-mist" />
          <div className="h-2 w-3/4 rounded-full bg-mist" />
        </div>
      </div>

      {/* Le lien contextuel repéré : il monte dans le cadre et reste. */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 }}
        transition={{ delay: reduce ? 0 : 0.5, duration: 0.4, ease: "easeOut" }}
        className="absolute bottom-3 left-0 flex items-center gap-2 rounded-[14px] border border-fog bg-snow px-3 py-2 shadow-[var(--shadow-md)]"
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-mist text-obsidian">
          <LinkIcon />
        </span>
        <span className="min-w-0">
          <span className="block text-[9px] font-semibold uppercase tracking-wider text-steel">
            {t("mentionLabel")}
          </span>
          <span className="block truncate text-[11px] font-semibold">
            {t("mentionText")}
          </span>
        </span>
      </motion.div>
    </div>
  );
}

/* ------------------------------ 5 · Correctifs ---------------------------- */

const SEVERITIES = ["high", "medium", "medium", "low"] as const;

function FixDemo() {
  const t = useTranslations("features.fix");
  const reduce = useReducedMotion();
  const { ref, inView } = useSeen<HTMLDivElement>();
  const rows = t.raw("rows") as string[];
  const [corrected, setCorrected] = useState(false);

  useEffect(() => {
    if (!inView || reduce) return;
    const id = setTimeout(() => setCorrected(true), 900);
    return () => clearTimeout(id);
  }, [inView, reduce]);

  // Sans mouvement, la ligne corrigée est affichée d'emblée dans son état final.
  const fixed = reduce || corrected;

  const severityLabel = { high: t("high"), medium: t("medium"), low: t("low") };
  const severityClass = {
    high: "border-danger/30 text-danger",
    medium: "border-warning/30 text-warning",
    low: "border-pebble text-steel",
  };

  return (
    <div ref={ref} className="rounded-[24px] border border-fog bg-mist p-4">
      <div className="flex items-center justify-between px-1 pb-3 text-[10px] font-semibold uppercase tracking-wider text-steel">
        <span>{t("page")}</span>
        <span className="flex items-center gap-3">
          <span>
            {t("score")} <span className="text-obsidian">82</span>
          </span>
          <span>
            {t("issues")}{" "}
            <span className="text-danger tabular-nums">{fixed ? 8 : 9}</span>
          </span>
        </span>
      </div>

      <ul className="space-y-1.5">
        {rows.map((row, i) => {
          const sev = SEVERITIES[i];
          const isFixed = fixed && i === 0;
          return (
            <li
              key={row}
              className="flex items-center gap-2 rounded-full border border-fog bg-snow py-1.5 pl-2 pr-1.5"
            >
              <span
                className={`shrink-0 rounded-full border bg-snow px-2 py-0.5 text-[9px] font-semibold ${severityClass[sev]}`}
              >
                {severityLabel[sev]}
              </span>
              <span className="min-w-0 flex-1 truncate text-[11px] text-graphite">
                {row}
              </span>

              {isFixed ? (
                <motion.span
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.28, ease: "easeOut" }}
                  className="flex shrink-0 items-center gap-1 rounded-full bg-obsidian px-2 py-0.5 text-[9px] font-semibold text-white"
                >
                  {t("fixed")}
                  <CheckIcon />
                </motion.span>
              ) : (
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-obsidian text-white">
                  <ArrowIcon />
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* --------------------------- 6 · Visibilité sociale ----------------------- */

function SocialDemo() {
  const t = useTranslations("features.social");
  const reduce = useReducedMotion();
  const { ref, inView } = useSeen<HTMLDivElement>();

  return (
    <div ref={ref} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {/* Fil Reddit, avec le commentaire suggéré */}
      <div className="rounded-[18px] border border-fog bg-snow p-3">
        <RedditMark />
        <div className="mt-3 flex items-center gap-2" aria-hidden>
          <span className="h-5 w-5 rounded-full bg-mist" />
          <span className="h-2 w-20 rounded-full bg-mist" />
        </div>
        <div className="mt-3 space-y-1.5" aria-hidden>
          <div className="h-2 w-full rounded-full bg-mist" />
          <div className="h-2 w-4/5 rounded-full bg-mist" />
        </div>
        <div
          className="mt-3 flex items-center gap-2 text-[10px] text-ash"
          aria-hidden
        >
          <span className="rounded-full bg-mist px-2 py-0.5">↑ 74 ↓</span>
          <span className="rounded-full bg-mist px-2 py-0.5">💬 26</span>
        </div>

        <p className="mt-4 flex items-center gap-1 text-[10px] font-semibold text-graphite">
          {t("suggested")}
          <SparkleIcon />
        </p>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
          transition={{
            delay: reduce ? 0 : 0.35,
            duration: 0.35,
            ease: "easeOut",
          }}
          className="mt-2 rounded-[14px] border border-fog p-2"
        >
          <div className="space-y-1.5" aria-hidden>
            <div className="shimmer h-2 w-full rounded-full" />
            <div className="shimmer h-2 w-2/3 rounded-full" />
          </div>
          <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-obsidian px-2.5 py-1 text-[10px] font-semibold text-white">
            {t("copy")}
            <ArrowIcon />
          </span>
        </motion.div>
      </div>

      {/* Fil Quora */}
      <div className="hidden rounded-[18px] border border-fog bg-snow p-3 sm:block">
        <span
          className="font-serif text-xl font-bold leading-none text-[#b92b27]"
          aria-hidden
        >
          Q
        </span>
        <div className="mt-4 space-y-1.5" aria-hidden>
          <div className="h-2 w-full rounded-full bg-mist" />
          <div className="h-2 w-5/6 rounded-full bg-mist" />
          <div className="h-2 w-1/2 rounded-full bg-mist" />
        </div>
        <div
          className="mt-4 flex items-center gap-2 text-[10px] text-ash"
          aria-hidden
        >
          <span className="rounded-full bg-mist px-2 py-0.5">↑ 1,6 k</span>
          <span className="rounded-full bg-mist px-2 py-0.5">💬 26</span>
        </div>
        <div className="mt-4 border-t border-fog pt-3" aria-hidden>
          <div className="space-y-1.5">
            <div className="h-2 w-3/4 rounded-full bg-mist" />
            <div className="h-2 w-2/3 rounded-full bg-mist" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* --------------------------- 7 · Recommandations -------------------------- */

type QueryRow = {
  engine: "chatgpt" | "gemini";
  searches: string;
  cited: boolean;
};

const QUERY_ROWS: QueryRow[] = [
  { engine: "chatgpt", searches: "1 800", cited: true },
  { engine: "gemini", searches: "1 100", cited: false },
  { engine: "chatgpt", searches: "740", cited: false },
];

function RecommendDemo() {
  const t = useTranslations("features.recommend");
  const reduce = useReducedMotion();
  const { ref, inView } = useSeen<HTMLDivElement>();
  const queries = t.raw("queries") as string[];

  return (
    <div
      ref={ref}
      className="overflow-hidden rounded-[18px] border border-fog bg-snow shadow-[var(--shadow-md)]"
    >
      <div
        className="flex items-center gap-1 border-b border-fog px-3 py-2"
        aria-hidden
      >
        <span className="h-1.5 w-1.5 rounded-full bg-[#ff5f57]" />
        <span className="h-1.5 w-1.5 rounded-full bg-[#febc2e]" />
        <span className="h-1.5 w-1.5 rounded-full bg-[#28c840]" />
      </div>

      <ul className="space-y-2 p-3">
        {QUERY_ROWS.map((row, i) => (
          <motion.li
            key={queries[i]}
            initial={{ opacity: 0, y: 10 }}
            animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
            transition={{
              delay: reduce ? 0 : 0.15 + i * 0.18,
              duration: 0.35,
              ease: "easeOut",
            }}
            className="rounded-[14px] border border-fog p-3"
          >
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-fog bg-snow">
                <Image
                  src={
                    row.engine === "chatgpt" ? "/chatgpt.png" : "/gemini.webp"
                  }
                  alt=""
                  aria-hidden
                  width={32}
                  height={32}
                  className="h-3.5 w-3.5"
                />
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[9px] font-semibold uppercase tracking-wider text-steel">
                    {t("queryLabel")}
                  </span>
                  <span className="shrink-0 text-[10px] text-muted">
                    {t("searches", { count: row.searches })}
                  </span>
                </div>
                <p className="truncate text-[12px] font-medium text-text">
                  {queries[i]}
                </p>
                <p
                  className={`mt-1.5 flex items-center gap-1 text-[10px] ${
                    row.cited ? "text-graphite" : "text-danger"
                  }`}
                >
                  {row.cited ? <CheckCircleIcon /> : <AlertIcon />}
                  {row.cited ? t("cited") : t("missing")}
                </p>
              </div>
            </div>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}

/* -------------------------------- Icônes ---------------------------------- */

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function IconPen() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
      <path d="M4 20h4L20 8a2.8 2.8 0 0 0-4-4L4 16v4Z" {...stroke} />
      <path d="M14 6l4 4" {...stroke} />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
      <rect x="3.5" y="5" width="17" height="15" rx="3" {...stroke} />
      <path d="M3.5 10h17M8 3.5v3M16 3.5v3" {...stroke} />
    </svg>
  );
}

function IconBookmark() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
      <path d="M6 4h12v16l-6-4-6 4V4Z" {...stroke} />
      <path d="m9.5 9.5 1.8 1.8 3.2-3.4" {...stroke} />
    </svg>
  );
}

function IconShare() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
      <circle cx="18" cy="5.5" r="2.5" {...stroke} />
      <circle cx="18" cy="18.5" r="2.5" {...stroke} />
      <circle cx="6" cy="12" r="2.5" {...stroke} />
      <path d="m8.3 10.8 7.4-4M8.3 13.2l7.4 4" {...stroke} />
    </svg>
  );
}

function IconWrench() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
      <path
        d="M20 5.5a4.5 4.5 0 0 1-5.9 5.9L6 19.5 4.5 18l8.1-8.1A4.5 4.5 0 0 1 18.5 4l-2.6 2.6 1.5 1.5L20 5.5Z"
        {...stroke}
      />
    </svg>
  );
}

function IconMonitor() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
      <rect x="3.5" y="4.5" width="17" height="12" rx="2.5" {...stroke} />
      <path d="M9 20h6M12 16.5V20" {...stroke} />
    </svg>
  );
}

function IconEye() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
      <path
        d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"
        {...stroke}
      />
      <circle cx="12" cy="12" r="2.8" {...stroke} />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden>
      <path
        d="M10 13.5a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1.2 1.2"
        {...stroke}
      />
      <path
        d="M14 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1.2-1.2"
        {...stroke}
      />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" {...stroke} strokeWidth={2.2} />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" aria-hidden>
      <path d="m5 12.5 4.5 4.5L19 7" {...stroke} strokeWidth={2.4} />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      aria-hidden
      className="shrink-0"
    >
      <circle cx="12" cy="12" r="9" {...stroke} />
      <path d="m8 12.2 2.6 2.6L16 9.4" {...stroke} strokeWidth={2} />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      aria-hidden
      className="shrink-0"
    >
      <circle cx="12" cy="12" r="9" {...stroke} />
      <path d="M12 7.5v5M12 16.2v.1" {...stroke} strokeWidth={2} />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 2c.9 5.3 4.7 9.1 10 10-5.3.9-9.1 4.7-10 10-.9-5.3-4.7-9.1-10-10 5.3-.9 9.1-4.7 10-10Z" />
    </svg>
  );
}

/** Marque Reddit simplifiée — dessinée plutôt qu'importée. */
function RedditMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="11" fill="#ff4500" />
      <circle cx="12" cy="13.5" r="6.2" fill="#fff" />
      <circle cx="9.6" cy="12.8" r="1.05" fill="#ff4500" />
      <circle cx="14.4" cy="12.8" r="1.05" fill="#ff4500" />
      <path
        d="M9.4 15.6c1.5 1.1 3.7 1.1 5.2 0"
        fill="none"
        stroke="#ff4500"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      <path
        d="M13.6 7.2 12.9 4l2.6.6"
        fill="none"
        stroke="#fff"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      <circle cx="16" cy="4.9" r="1.3" fill="#fff" />
    </svg>
  );
}
