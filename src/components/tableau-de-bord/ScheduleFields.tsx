"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useTranslations } from "next-intl";
import { scheduleArticleAction } from "@/features/dashboard/actions";
import {
  PUBLISH_DEFAULT_HOUR,
  PUBLISH_HOURS,
  splitPublishInstant,
  toPublishInstant,
} from "@/constants/publishing";

/**
 * Choisir le jour et l'heure d'une publication.
 *
 * Le même bloc sert au quai de départ et à l'atelier d'article : planifier est
 * un seul geste dans le produit, il doit avoir une seule forme. Il s'ouvre sous
 * le bouton qui l'appelle plutôt que dans une fenêtre — la question tient en
 * deux champs, et une modale pour deux champs fait perdre de vue l'article
 * qu'on est en train de dater.
 *
 * Les heures sont pleines et prises dans une liste courte, pas saisies. Ce
 * n'est pas de la simplification : la file de publication ne repasse pas plus
 * finement que l'heure (`constants/publishing`), et laisser saisir 14 h 37
 * promettrait une précision que rien derrière ne tient.
 *
 * Le jour passe par le champ de date du navigateur : il est déjà traduit,
 * navigable au clavier et ouvre le calendrier natif du téléphone. Le remplacer
 * par un calendrier maison coûterait trois cents lignes pour reprendre ce qu'il
 * fait mieux.
 */
export function ScheduleFields({
  articleId,
  current,
  onDone,
}: {
  articleId: string;
  /** La date déjà posée, en ISO. Le formulaire s'ouvre dessus. */
  current: string | null;
  onDone?: () => void;
}) {
  const t = useTranslations("dashboard.dock");
  const router = useRouter();

  const start = current ? splitPublishInstant(current) : null;
  const [day, setDay] = useState(start?.day ?? todayInParis());
  const [hour, setHour] = useState(start?.hour ?? PUBLISH_DEFAULT_HOUR);

  const schedule = useAction(scheduleArticleAction, {
    onSuccess: () => {
      router.refresh();
      onDone?.();
    },
  });

  // L'heure choisie peut ne pas figurer dans la liste — une date posée par le
  // planning automatique, ou reprise d'un ancien réglage. On l'y ajoute plutôt
  // que de la remplacer en douce : le client verrait son heure changer seule.
  const hours = PUBLISH_HOURS.includes(hour as (typeof PUBLISH_HOURS)[number])
    ? [...PUBLISH_HOURS]
    : [...PUBLISH_HOURS, hour].sort((a, b) => a - b);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        schedule.execute({ id: articleId, scheduledFor: toPublishInstant(day, hour) });
      }}
      className="mt-4 flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-mist/50 p-3.5"
    >
      <label className="flex min-w-0 flex-col gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-steel">
          {t("scheduleDay")}
        </span>
        <input
          type="date"
          value={day}
          onChange={(event) => setDay(event.target.value)}
          required
          className="h-10 cursor-pointer rounded-xl border border-border bg-surface px-3 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-steel">
          {t("scheduleHour")}
        </span>
        <select
          value={hour}
          onChange={(event) => setHour(Number(event.target.value))}
          className="h-10 cursor-pointer rounded-xl border border-border bg-surface px-3 text-sm tabular-nums text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40"
        >
          {hours.map((value) => (
            <option key={value} value={value}>
              {`${String(value).padStart(2, "0")}:00`}
            </option>
          ))}
        </select>
      </label>

      <button
        type="submit"
        disabled={schedule.isPending}
        className="h-10 cursor-pointer rounded-pill bg-obsidian px-4 text-sm font-medium text-white transition-colors duration-200 hover:bg-ink disabled:opacity-60"
      >
        {schedule.isPending ? t("scheduleSaving") : t("scheduleConfirm")}
      </button>

      {onDone ? (
        <button
          type="button"
          onClick={onDone}
          className="h-10 cursor-pointer px-1 text-sm text-muted underline decoration-pebble underline-offset-4 transition-colors duration-200 hover:text-text"
        >
          {t("scheduleCancel")}
        </button>
      ) : null}

      {schedule.result.serverError ? (
        <p className="w-full text-sm text-danger">{schedule.result.serverError}</p>
      ) : null}
    </form>
  );
}

/** Aujourd'hui dans le fuseau de publication, au format du champ de date. */
function todayInParis(): string {
  return splitPublishInstant(new Date().toISOString()).day;
}
