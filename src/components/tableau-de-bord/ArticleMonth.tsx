"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { RiArrowLeftSLine, RiArrowRightSLine } from "@remixicon/react";
import { ROUTES } from "@/constants/routes";
import { alignToPass, formatPublishTime } from "@/constants/publishing";
import { Card, CardTitle } from "./Card";

/**
 * Le calendrier éditorial, sur deux formats qui ne montrent pas la même chose.
 *
 * Sur grand écran, le mois entier posé sur sa grille de jours : vingt-deux
 * publications alignées du lundi au vendredi, le rythme se lit d'un coup d'œil,
 * et les flèches font défiler les mois — le planning ne s'arrête pas au
 * trentième.
 *
 * Sur téléphone, la grille ne tenait pas : sept colonnes sur trois cent
 * cinquante pixels laissent quarante pixels par case, où un titre d'article se
 * réduit à deux mots coupés. Le client voyait des cases pleines sans jamais
 * savoir ce qui y était prévu. Le format change donc de nature plutôt que de
 * taille : sept jours à partir d'aujourd'hui, un par ligne, le jour tenu à
 * gauche sur son rail et le sujet écrit en toutes lettres à droite. On perd la
 * vue du mois — elle ne se lisait pas — et on gagne la seule chose qu'un
 * calendrier doit dire : ce qui sort, et quand.
 *
 * Tout le calcul de dates passe en UTC. Les constructeurs `Date` locaux
 * donneraient un jour de la semaine différent selon le fuseau, et le premier du
 * mois glisserait d'une colonne entre le rendu du serveur et celui du
 * navigateur.
 */

const MONTHS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

/**
 * Les mêmes mois abrégés, pour la fenêtre de sept jours du téléphone. Ils sont
 * écrits à la main : une troncature mécanique rendrait « avri. » et « déce. ».
 */
const MONTHS_SHORT = [
  "janv.", "févr.", "mars", "avr.", "mai", "juin",
  "juil.", "août", "sept.", "oct.", "nov.", "déc.",
];

/** Lundi en tête : la semaine de travail commence là, le planning aussi. */
const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];

/** Les mêmes jours écrits pour le rail du téléphone, où la place ne manque pas. */
const WEEKDAYS_SHORT = ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"];

/** Sept jours : la fenêtre du rail, et le pas de ses flèches. */
const WEEK_DAYS = 7;

export type MonthArticle = {
  id: string;
  title: string;
  status: string;
  /** Date de publication en ISO, ou `null` si le sujet n'est pas encore daté. */
  scheduledFor: string | null;
};

/**
 * Ce qu'une vignette dit d'elle-même, sans qu'on ait à lire son état.
 *
 * Le calendrier ne distinguait rien : validé et publié partageaient le même
 * vert pâle, et l'article qui allait partir demain ressemblait à celui qui
 * était en ligne depuis trois semaines. Or ce sont les deux seuls moments qui
 * demandent quelque chose au client — l'un qu'il le laisse partir, l'autre
 * rien du tout.
 *
 * D'où une seule vignette pleine dans toute la grille : celle d'un article
 * validé, à quai. Le système de couleurs dit « emphase = sombre, pas d'accent
 * chromatique » : dans une grille faite de filets sur blanc, un pavé obsidian
 * est le contraste le plus fort que la palette permette, et il n'introduit
 * aucune teinte à apprendre.
 *
 * Le publié, lui, se distingue par sa forme et non par sa teinte : un bord
 * gauche vert, épais de deux pixels. Un aplat vert à sept pour cent avait été
 * essayé d'abord — à l'écran, il ne se distinguait ni du rédigé ni du sujet
 * retenu, et la légende alignait trois carrés blancs qui n'apprenaient rien.
 * Une arête franche se voit à cette taille, et reste discrète : c'est de
 * l'histoire, elle n'a pas à crier plus fort que ce qui reste à faire.
 */
const TILE: Record<string, string> = {
  planned: "border-fog bg-mist text-steel hover:bg-fog",
  drafted: "border-pebble bg-surface text-text hover:bg-mist",
  approved: "border-obsidian bg-obsidian text-white hover:bg-ink",
  published: "border-fog border-l-2 border-l-success bg-surface text-steel hover:bg-mist",
  rejected: "border-fog bg-surface text-ash line-through hover:bg-mist",
};

const tileClass = (status: string) => TILE[status] ?? TILE.planned;

/** Le jour d'une date, ramené à sa seule journée UTC : « 2026-09-01 ». */
function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * L'heure de départ d'un article, « 09:00 ».
 *
 * Mise en forme dans le fuseau de publication, explicitement : c'est la seule
 * façon d'obtenir la même chaîne au rendu du serveur — en UTC — et dans le
 * navigateur du client, qui est à Paris. Sans lui, l'heure changerait sous ses
 * yeux à l'hydratation.
 */
function hourOf(scheduledFor: string | null): string {
  if (!scheduledFor) return "";
  const date = new Date(scheduledFor);
  return Number.isNaN(date.getTime()) ? "" : formatPublishTime(alignToPass(date));
}

/** Décalage du 1ᵉʳ du mois dans une grille commençant le lundi (0 = lundi). */
function mondayOffset(year: number, month: number): number {
  return (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;
}

/** Nombre de jours du mois (le jour 0 du mois suivant = dernier jour). */
function daysInMonthUtc(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

export function ArticleMonth({
  articles,
  today,
  locked = false,
  action = null,
}: {
  articles: MonthArticle[];
  /**
   * La journée en cours, lue par le serveur et transmise en « AAAA-MM-JJ ».
   * Un `new Date()` appelé ici ferait diverger le premier rendu de l'hydratation
   * dès qu'un client ouvre la page à cheval sur minuit.
   */
  today: string;
  /**
   * L'offre du compte n'ouvre pas la rédaction : les sujets restent lisibles —
   * la grille est ce qu'on vend — mais ils mènent aux tarifs, pas à l'atelier.
   */
  locked?: boolean;
  /**
   * Ce qu'on peut faire au planning depuis son en-tête — aujourd'hui, demander
   * quatre sujets de plus. La carte est devenue le seul bloc de la page : ce
   * qui la remplit se commande depuis elle, et non depuis une carte voisine.
   */
  action?: React.ReactNode;
}) {
  const t = useTranslations("dashboard.calendar");

  /** Les articles rangés par journée, une bonne fois : « 2026-09-01 » → sujets. */
  const byDay = useMemo(() => {
    const map = new Map<string, MonthArticle[]>();
    for (const article of articles) {
      if (!article.scheduledFor) continue;
      const date = new Date(article.scheduledFor);
      if (Number.isNaN(date.getTime())) continue;
      const key = dayKey(date);
      map.set(key, [...(map.get(key) ?? []), article]);
    }
    return map;
  }, [articles]);

  /**
   * Le mois d'ouverture : celui de la première publication programmée, sinon le
   * mois en cours. Ouvrir sur un mois vide alors que le planning commence trois
   * semaines plus tard donnerait l'impression que rien n'est prévu.
   */
  const opening = useMemo(() => {
    const first = [...byDay.keys()].sort()[0] ?? today;
    const [year, month] = first.split("-").map(Number);
    return { year, month: month - 1 };
  }, [byDay, today]);

  // Deux navigations pour deux vues : les mois sur grand écran, la fenêtre de
  // sept jours sur téléphone. Elles ne se croisent jamais — un seul des deux
  // blocs est à l'écran à la fois — et garder deux compteurs évite de traduire
  // un mois en semaine à chaque bascule de format.
  const [monthShift, setMonthShift] = useState(0);
  const [dayShift, setDayShift] = useState(0);

  const shown = new Date(Date.UTC(opening.year, opening.month + monthShift, 1));
  const year = shown.getUTCFullYear();
  const month = shown.getUTCMonth();

  const placed = [...byDay.values()].reduce((total, list) => total + list.length, 0);

  return (
    <Card>
      <CardTitle
        title={t("title")}
        hint={t("hint")}
        action={
          <span className="flex items-center gap-2">
            <span className="rounded-xl bg-mist px-2.5 py-1 text-[11px] font-semibold text-steel">
              {t("count", { count: placed })}
            </span>
            {action}
          </span>
        }
      />

      {/* ---- Grand écran : le mois entier ---- */}
      <div className="hidden sm:block">
        <Stepper
          label={<span className="capitalize">{`${MONTHS[month]} ${year}`}</span>}
          prevLabel={t("prevMonth")}
          nextLabel={t("nextMonth")}
          onPrev={() => setMonthShift((s) => s - 1)}
          onNext={() => setMonthShift((s) => s + 1)}
          onReset={monthShift === 0 ? null : () => setMonthShift(0)}
          resetLabel={t("backToday")}
        />

        <MonthGrid
          year={year}
          month={month}
          byDay={byDay}
          today={today}
          locked={locked}
        />
      </div>

      {/* ---- Téléphone : les sept jours qui viennent ---- */}
      <div className="sm:hidden">
        <WeekRail
          today={today}
          shift={dayShift}
          byDay={byDay}
          locked={locked}
          onPrev={() => setDayShift((s) => s - WEEK_DAYS)}
          onNext={() => setDayShift((s) => s + WEEK_DAYS)}
          onReset={dayShift === 0 ? null : () => setDayShift(0)}
        />
      </div>

      {placed === 0 ? <p className="mt-4 text-sm text-muted">{t("empty")}</p> : null}

      <Legend />
    </Card>
  );
}

/**
 * La clé de lecture de la grille.
 *
 * Une vignette noire au milieu de vignettes grises est un signal fort, mais un
 * signal fort qu'on ne sait pas lire n'est qu'une bizarrerie. Quatre échantillons
 * et quatre mots suffisent, et ils reprennent exactement les classes des
 * vignettes : la légende ne peut pas se désaccorder de ce qu'elle légende.
 *
 * L'échantillon est un rectangle et non un carré : c'est un bord gauche qui
 * distingue le publié, et sur douze pixels de côté ce bord occupait un sixième
 * de la surface — la pastille ressortait blanche, et la légende expliquait un
 * signe qu'elle ne montrait pas.
 *
 * L'ordre suit la vie d'un article, de ce qui part à ce qui est parti : c'est
 * la seule séquence que la liste puisse encoder, et elle est vraie.
 */
function Legend() {
  const t = useTranslations("dashboard.agenda.status");

  return (
    <ul className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-3">
      {(["approved", "drafted", "planned", "published"] as const).map((status) => (
        <li key={status} className="flex items-center gap-1.5 text-[11px] text-muted">
          <span aria-hidden className={`h-3 w-5 rounded-[4px] border ${tileClass(status)}`} />
          {t(status)}
        </li>
      ))}
    </ul>
  );
}

/**
 * La barre de navigation commune aux deux vues : la période au centre de la
 * lecture, ses deux flèches de part et d'autre, et le retour au présent qui
 * n'apparaît qu'une fois qu'on s'en est éloigné.
 */
function Stepper({
  label,
  prevLabel,
  nextLabel,
  onPrev,
  onNext,
  onReset,
  resetLabel,
}: {
  /**
   * Le nom de la période. Un nœud, pas une chaîne : le mois se met en capitale
   * initiale, la fenêtre de sept jours — « Du 31 août au 6 sept. » — non, et
   * une classe `capitalize` posée ici les capitaliserait mot par mot.
   */
  label: React.ReactNode;
  prevLabel: string;
  nextLabel: string;
  onPrev: () => void;
  onNext: () => void;
  onReset: (() => void) | null;
  resetLabel: string;
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <p className="min-w-0 flex-1 truncate text-sm font-semibold">{label}</p>

      {onReset ? (
        <button
          type="button"
          onClick={onReset}
          className="cursor-pointer rounded-pill px-2.5 py-1 text-[11px] font-semibold text-muted transition-colors duration-200 hover:bg-mist hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40"
        >
          {resetLabel}
        </button>
      ) : null}

      <div className="flex shrink-0 items-center gap-1">
        <StepButton label={prevLabel} onClick={onPrev}>
          <RiArrowLeftSLine className="size-4" aria-hidden />
        </StepButton>
        <StepButton label={nextLabel} onClick={onNext}>
          <RiArrowRightSLine className="size-4" aria-hidden />
        </StepButton>
      </div>
    </div>
  );
}

function StepButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex size-8 cursor-pointer items-center justify-center rounded-full border border-border text-steel transition-colors duration-200 hover:border-pebble hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40"
    >
      {children}
    </button>
  );
}

/** Le mois sur sa grille de jours, tel qu'il se lit sur un grand écran. */
function MonthGrid({
  year,
  month,
  byDay,
  today,
  locked,
}: {
  year: number;
  month: number;
  byDay: Map<string, MonthArticle[]>;
  today: string;
  locked: boolean;
}) {
  const offset = mondayOffset(year, month);
  const daysInMonth = daysInMonthUtc(year, month);
  const cells = Array.from({ length: offset + daysInMonth }, (_, i) =>
    i < offset ? null : i - offset + 1,
  );

  return (
    <div className="grid grid-cols-7 gap-1.5">
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
        const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const dayArticles = byDay.get(key) ?? [];
        const isToday = key === today;
        return (
          <div
            key={day}
            className={`min-h-[84px] rounded-xl border p-1.5 ${
              dayArticles.length ? "border-pebble/70 bg-mist" : "border-fog bg-surface"
            }`}
          >
            {/* Aujourd'hui se marque d'un cerne, pas d'un aplat. La pastille
                était noire et pleine, ce qui allait tant que rien d'autre ne
                l'était ; depuis que la vignette d'un article validé l'est, les
                deux se confondaient en une seule tache et le client lisait un
                état là où il n'y a qu'une position dans le mois. Le noir reste
                donc à l'état, et la date en emprunte le trait. */}
            <span
              className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-semibold tabular-nums ${
                isToday ? "border border-obsidian text-obsidian" : "text-steel"
              }`}
            >
              {day}
            </span>
            <span className="mt-1 flex flex-col gap-1">
              {dayArticles.map((article) => (
                <Link
                  key={article.id}
                  href={locked ? ROUTES.pricing : ROUTES.dashboardArticle(article.id)}
                  className={`block cursor-pointer overflow-hidden rounded-lg border px-1.5 py-1 text-[10px] leading-snug transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40 ${tileClass(article.status)}`}
                >
                  <span className="line-clamp-3">{article.title}</span>
                  {/* L'heure n'apparaît que sur ce qui part : ailleurs, elle
                      remplirait la case d'un chiffre sans conséquence. */}
                  {article.status === "approved" ? (
                    <span className="mt-0.5 block text-[9px] font-semibold tabular-nums text-white/70">
                      {hourOf(article.scheduledFor)}
                    </span>
                  ) : null}
                </Link>
              ))}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Les sept jours qui viennent, un par ligne.
 *
 * La fenêtre roule à partir d'aujourd'hui plutôt que de se caler sur un lundi :
 * le client ouvre son tableau de bord un jeudi et veut savoir ce qui sort d'ici
 * jeudi prochain, pas ce qu'il a manqué lundi.
 */
function WeekRail({
  today,
  shift,
  byDay,
  locked,
  onPrev,
  onNext,
  onReset,
}: {
  today: string;
  shift: number;
  byDay: Map<string, MonthArticle[]>;
  locked: boolean;
  onPrev: () => void;
  onNext: () => void;
  onReset: (() => void) | null;
}) {
  const t = useTranslations("dashboard.calendar");
  const ts = useTranslations("dashboard.agenda.status");

  const [y, m, d] = today.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, d + shift));

  const days = Array.from({ length: WEEK_DAYS }, (_, i) => {
    const date = new Date(Date.UTC(y, m - 1, d + shift + i));
    return { date, key: dayKey(date), articles: byDay.get(dayKey(date)) ?? [] };
  });

  const last = days[days.length - 1].date;
  const range = t("range", {
    from: `${start.getUTCDate()} ${MONTHS_SHORT[start.getUTCMonth()]}`,
    to: `${last.getUTCDate()} ${MONTHS_SHORT[last.getUTCMonth()]}`,
  });

  const count = days.reduce((total, day) => total + day.articles.length, 0);

  return (
    <>
      <Stepper
        label={range}
        prevLabel={t("prevWeek")}
        nextLabel={t("nextWeek")}
        onPrev={onPrev}
        onNext={onNext}
        onReset={onReset}
        resetLabel={t("backToday")}
      />

      {/* Un rail plutôt qu'une pile de cartes : le filet vertical tient les sept
          jours ensemble et donne au regard une seule colonne à descendre. */}
      <ul className="divide-y divide-border border-y border-border">
        {days.map((day) => {
          const isToday = day.key === today;
          const weekday = WEEKDAYS_SHORT[(day.date.getUTCDay() + 6) % 7];

          return (
            <li key={day.key} className="flex items-stretch gap-3 py-2.5">
              <div className="flex w-11 shrink-0 flex-col items-center border-r border-border pr-3">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-steel">
                  {weekday}
                </span>
                <span
                  className={`mt-0.5 flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[13px] font-semibold tabular-nums ${
                    isToday ? "border border-obsidian text-obsidian" : "text-text"
                  }`}
                >
                  {day.date.getUTCDate()}
                </span>
              </div>

              <div className="min-w-0 flex-1">
                {day.articles.length === 0 ? (
                  <p className="py-1.5 text-[13px] text-ash">{t("dayEmpty")}</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {day.articles.map((article) => {
                      const approved = article.status === "approved";
                      return (
                        <Link
                          key={article.id}
                          href={locked ? ROUTES.pricing : ROUTES.dashboardArticle(article.id)}
                          className={`block cursor-pointer rounded-xl border px-3 py-2 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40 ${tileClass(article.status)}`}
                        >
                          <span className="block text-[13px] font-medium leading-snug">
                            {article.title}
                          </span>
                          <span
                            className={`mt-0.5 flex items-center gap-1.5 text-[11px] ${
                              approved ? "text-white/70" : "text-steel"
                            }`}
                          >
                            {ts(article.status)}
                            {approved ? (
                              <span className="font-semibold tabular-nums">
                                {hourOf(article.scheduledFor)}
                              </span>
                            ) : null}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <p className="mt-3 text-[13px] text-muted">{t("weekCount", { count })}</p>
    </>
  );
}
