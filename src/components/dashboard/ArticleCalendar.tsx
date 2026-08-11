"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { BusinessProfile } from "@/lib/geo/types";
import { AnimatedCard } from "./AnimatedCard";
import { LockedPill, Obscured, UnlockBar } from "./LockedContent";

/**
 * Calendrier éditorial : les articles SEO générés puis publiés automatiquement
 * pour la niche, posés sur les jours du mois à venir.
 *
 * Aucune logique serveur pour l'instant — aucun article n'est réellement écrit
 * ni programmé. Les entrées affichées sont une projection dérivée de la niche,
 * là pour montrer la forme de la livraison : verrouillée, elle apparaît floutée.
 *
 * La projection est **déterministe** (hachage de la niche, mois calculé depuis la
 * date d'analyse) : le rendu serveur et le rendu client coïncident, sans quoi
 * l'hydratation signalerait un écart à chaque chargement.
 */

const MONTHS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];

/** Gabarits d'articles : `{niche}`, `{categorie}` et `{zone}` sont substitués. */
const TEMPLATES = [
  "Comment choisir {niche}{zone} : les 7 critères qui comptent",
  "{categorie}{zone} : les questions que l'on nous pose le plus",
  "Combien coûte {niche}{zone} ? Prix réels et fourchettes",
  "{niche} : ce qui change cette saison{zone}",
  "Notre guide complet de {categorie}{zone}",
  "5 erreurs à éviter avant de choisir {categorie}{zone}",
  "{niche}{zone} : comparatif des solutions disponibles",
  "Les tendances {categorie} à suivre ce mois-ci",
  "Avis clients : ce qu'ils retiennent de {niche}{zone}",
  "Checklist : bien préparer votre venue{zone}",
  "{categorie} : le vocabulaire à connaître, expliqué simplement",
  "Foire aux questions : tout savoir sur {niche}{zone}",
];

/** Hachage FNV-1a : une graine stable, identique côté serveur et client. */
function hash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Générateur pseudo-aléatoire déterministe (mulberry32). */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type PlannedArticle = { day: number; title: string };

/**
 * Mélange de Fisher-Yates piloté par la graine. Un `sort()` avec comparateur
 * aléatoire ne suffirait pas : l'ordre obtenu dépend de l'algorithme de tri du
 * moteur, donc diffère entre le rendu serveur et un navigateur non-V8.
 */
function shuffle<T>(items: readonly T[], rand: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Tout le calendrier se calcule en UTC : les constructeurs `Date` locaux
 * donneraient un jour de la semaine différent selon le fuseau du serveur et
 * celui du navigateur, et l'hydratation signalerait l'écart.
 */
/** Décalage du 1ᵉʳ du mois dans une grille commençant le lundi (0 = lundi). */
function mondayOffset(year: number, month: number): number {
  return (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;
}

/** Nombre de jours du mois (le jour 0 du mois suivant = dernier jour). */
function daysInMonthUtc(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/** Jour de la semaine (0 = dimanche) pour une date donnée, en UTC. */
function weekdayUtc(year: number, month: number, day: number): number {
  return new Date(Date.UTC(year, month, day)).getUTCDay();
}

function fill(template: string, profile: BusinessProfile): string {
  const zone = profile.location ? ` à ${profile.location}` : "";
  return template
    .replace(/\{niche\}/g, profile.niche.toLowerCase())
    .replace(/\{categorie\}/g, (profile.generalCategory || profile.niche).toLowerCase())
    .replace(/\{zone\}/g, zone)
    .replace(/^./, (c) => c.toUpperCase());
}

/**
 * Répartit 8 articles sur le mois : un tous les 3-4 jours, jamais le dimanche
 * (rythme d'un vrai calendrier éditorial plutôt qu'un semis au hasard).
 */
function planArticles(profile: BusinessProfile, year: number, month: number): PlannedArticle[] {
  const rand = seeded(hash(`${profile.niche}|${profile.location ?? ""}|${year}-${month}`));
  const daysInMonth = daysInMonthUtc(year, month);
  const titles = shuffle(TEMPLATES, rand).map((tpl) => fill(tpl, profile));

  const planned: PlannedArticle[] = [];
  let day = 1 + Math.floor(rand() * 3);
  let i = 0;
  while (day <= daysInMonth && planned.length < 8) {
    // On saute le dimanche : personne ne programme sa publication ce jour-là.
    if (weekdayUtc(year, month, day) !== 0) {
      planned.push({ day, title: titles[i % titles.length] });
      i += 1;
    }
    day += 3 + Math.floor(rand() * 2);
  }
  return planned;
}

export function ArticleCalendar({
  profile,
  createdAt,
  locked,
}: {
  profile: BusinessProfile;
  /** Date de l'analyse : le calendrier porte sur le mois suivant. */
  createdAt: string;
  locked: boolean;
}) {
  const t = useTranslations("analysisReport.articlesPlan");

  const { year, month, planned, offset, daysInMonth } = useMemo(() => {
    const base = new Date(createdAt);
    const ref = Number.isNaN(base.getTime()) ? new Date(Date.UTC(2026, 0, 1)) : base;
    // Mois suivant l'analyse : le plan commence après la remise du rapport.
    const y = ref.getUTCMonth() === 11 ? ref.getUTCFullYear() + 1 : ref.getUTCFullYear();
    const m = (ref.getUTCMonth() + 1) % 12;
    return {
      year: y,
      month: m,
      planned: planArticles(profile, y, m),
      offset: mondayOffset(y, m),
      daysInMonth: daysInMonthUtc(y, m),
    };
  }, [createdAt, profile]);

  const byDay = new Map(planned.map((p) => [p.day, p.title]));
  const cells = Array.from({ length: offset + daysInMonth }, (_, i) =>
    i < offset ? null : i - offset + 1,
  );

  const body = (
    <div className="space-y-4">
      <AnimatedCard>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="font-semibold capitalize">
            {MONTHS[month]} {year}
          </h4>
          <span className="rounded-full bg-mist px-2.5 py-0.5 text-[11px] font-medium text-steel">
            {t("countLabel", { count: planned.length })}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-7 gap-1.5">
          {WEEKDAYS.map((d, i) => (
            <div
              key={`${d}-${i}`}
              className="pb-1 text-center text-[11px] font-semibold uppercase tracking-wide text-steel"
            >
              {d}
            </div>
          ))}
          {cells.map((day, i) => {
            if (day == null) return <div key={`empty-${i}`} />;
            const title = byDay.get(day);
            return (
              <div
                key={day}
                className={`min-h-[68px] rounded-xl border p-1.5 ${
                  title ? "border-pebble/70 bg-mist" : "border-fog bg-snow"
                }`}
              >
                <span className="block text-[11px] font-semibold tabular-nums text-steel">{day}</span>
                {title && (
                  <span className="mt-1 block overflow-hidden text-[10px] leading-snug text-text">
                    {/* Deux lignes suffisent dans une case : le titre entier est listé dessous. */}
                    <span className="line-clamp-2">{title}</span>
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </AnimatedCard>

      <AnimatedCard delay={0.05}>
        <h4 className="font-semibold">{t("queueTitle")}</h4>
        <p className="mt-1 text-sm text-muted">{t("queueSubtitle")}</p>
        <ul className="mt-3 space-y-2">
          {planned.map((p) => (
            <li
              key={p.day}
              className="flex items-center justify-between gap-3 rounded-xl border border-fog bg-mist px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm text-text">{p.title}</p>
                <p className="mt-0.5 text-xs text-steel tabular-nums">
                  {p.day} {MONTHS[month]}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-obsidian/[0.06] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-graphite">
                {t("statusScheduled")}
              </span>
            </li>
          ))}
        </ul>
      </AnimatedCard>
    </div>
  );

  return (
    <section>
      <div className="mb-3 mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <h3 className="text-lg font-bold">{t("title")}</h3>
        {locked && <LockedPill />}
      </div>
      <p className="mb-4 max-w-2xl text-sm text-muted">{t("subtitle")}</p>

      {locked ? (
        <>
          <div className="relative isolate">
            <Obscured>{body}</Obscured>
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-bg"
            />
          </div>
          <UnlockBar variant="articles" />
        </>
      ) : (
        body
      )}
      <p className="mt-3 text-xs text-muted/80">{t("disclaimer")}</p>
    </section>
  );
}
