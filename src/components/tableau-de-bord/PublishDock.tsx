"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useTranslations } from "next-intl";
import { RiCheckLine, RiExternalLinkLine } from "@remixicon/react";
import { publishArticleAction, setAutoPublishAction } from "@/features/dashboard/actions";
import { ROUTES } from "@/constants/routes";
import { Card } from "./Card";
import { ScheduleFields } from "./ScheduleFields";

/**
 * Le quai de départ : ce qui part tout seul, et quand.
 *
 * Un planning éditorial ne vaut que par la promesse qu'il tient — « votre
 * article du 8 partira le 8 ». Cette promesse n'était écrite nulle part : le
 * calendrier montrait des sujets, la file les déposait en silence, et le client
 * n'avait aucun endroit où lire ce qui allait se passer ni aucun moyen de le
 * devancer. Cette carte est cet endroit.
 *
 * Elle ne montre qu'un article : le prochain. Une liste de départs serait le
 * calendrier une seconde fois, en moins lisible. Ce que le client veut savoir
 * en ouvrant la page tient en une phrase — quoi, quand — et le reste du
 * planning est juste en dessous.
 *
 * Le titre de l'article porte la plus grande taille, pas l'heure. C'est par son
 * nom qu'on reconnaît son article ; l'heure ne devient intéressante qu'une fois
 * qu'on sait de quoi elle est l'heure.
 *
 * Le liseré vertical à gauche est la signature de l'état « à quai ». On le
 * retrouve, en deux pixels, sur chaque vignette validée du calendrier : même
 * signal, deux échelles, aucune couleur nouvelle à apprendre.
 */

export type DockArticle = {
  id: string;
  title: string;
  status: string;
  /** « mardi 8 septembre », composée côté serveur dans le fuseau du client. */
  dateLabel: string;
  /** « 09:00 ». Le moment du départ réel, pas celui de la consigne. */
  timeLabel: string;
  /**
   * Jours de calendrier d'ici au départ. Négatif quand la date est passée : la
   * file rattrape alors son retard au prochain passage, et l'écran le dit.
   *
   * Un nombre, pas une phrase toute faite : c'est aux textes de décider si l'on
   * écrit « demain » ou « dans 1 jour », pas au serveur.
   */
  days: number;
  /** La date déjà posée, pour ouvrir le formulaire de planification dessus. */
  iso: string;
};

export function PublishDock({
  next,
  queued,
  blocked,
  autoPublish,
  linked,
  canPublish,
}: {
  next: DockArticle | null;
  queued: number;
  blocked: number;
  autoPublish: boolean;
  /** Un site est rattaché — sans préjuger de ce qu'il laisse faire. */
  linked: boolean;
  canPublish: boolean;
}) {
  const t = useTranslations("dashboard.dock");
  const router = useRouter();
  const [scheduling, setScheduling] = useState(false);

  const publish = useAction(publishArticleAction, {
    onSuccess: () => router.refresh(),
  });

  const problem =
    publish.result.serverError ?? (publish.hasErrored ? t("publishFailed") : null);

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex">
        {/* Le liseré. Plein quand un départ est armé, sourd quand le quai est
            vide : la carte dit son état avant même d'être lue. */}
        <span
          aria-hidden
          className={`w-1 shrink-0 ${next && canPublish ? "bg-obsidian" : "bg-fog"}`}
        />

        <div className="min-w-0 flex-1 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-steel">
              {t("eyebrow")}
            </p>
            {queued > 0 ? (
              <span className="rounded-pill bg-mist px-2.5 py-1 text-[11px] font-semibold text-steel">
                {t("queued", { count: queued })}
              </span>
            ) : null}
          </div>

          {!canPublish ? (
            <NoDoor linked={linked} blocked={blocked} />
          ) : !next ? (
            <Empty />
          ) : (
            <>
              <p className="mt-3 text-lg font-semibold leading-snug text-text sm:text-xl">
                {next.title}
              </p>

              {/* La date et l'heure sur une seule ligne de chiffres tabulaires :
                  c'est une donnée, pas une légende, et deux départs successifs
                  doivent s'aligner à la verticale quand on les compare. */}
              <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                <span className="text-sm font-medium text-text">{next.dateLabel}</span>
                <span className="text-base font-semibold tabular-nums text-text">
                  {next.timeLabel}
                </span>
                <span
                  className={`text-sm ${next.days < 0 ? "font-medium text-warning" : "text-muted"}`}
                >
                  {next.days < 0 ? t("late") : t("inDays", { count: next.days })}
                </span>
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={publish.isPending}
                  onClick={() => publish.execute({ id: next.id })}
                  className="cursor-pointer rounded-pill bg-cta px-5 py-2.5 text-sm font-medium text-white shadow-[var(--shadow-pill)] transition-colors duration-200 hover:bg-cta-hover disabled:opacity-60"
                >
                  {publish.isPending ? t("publishing") : t("publishNow")}
                </button>

                <button
                  type="button"
                  onClick={() => setScheduling((open) => !open)}
                  aria-expanded={scheduling}
                  className="cursor-pointer rounded-pill border border-graphite px-4 py-2.5 text-sm font-medium text-graphite transition-colors duration-200 hover:bg-mist"
                >
                  {t("schedule")}
                </button>

                <Link
                  href={ROUTES.dashboardArticle(next.id)}
                  className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium text-muted underline decoration-pebble underline-offset-4 transition-colors duration-200 hover:text-text"
                >
                  {t("open")}
                  <RiExternalLinkLine className="size-3.5" aria-hidden />
                </Link>
              </div>

              {scheduling ? (
                <ScheduleFields
                  articleId={next.id}
                  current={next.iso}
                  onDone={() => setScheduling(false)}
                />
              ) : null}

              {problem ? <p className="mt-3 text-sm text-danger">{problem}</p> : null}
            </>
          )}

          {canPublish ? <AutoPilot enabled={autoPublish} /> : null}
        </div>
      </div>
    </Card>
  );
}

/**
 * Rien ne peut partir : il manque la porte, pas les articles.
 *
 * Deux situations, et il ne faut surtout pas les confondre. Sans site rattaché,
 * il y a un geste à faire et un bouton pour le faire. Avec un site rattaché qui
 * n'ouvre pas sa rédaction — une boutique Wix sans blog, un PrestaShop dont la
 * clé n'a pas les pages de contenu — il n'y a rien à brancher de plus : le
 * dépôt se fait à la main, article par article, et envoyer le client aux
 * réglages l'y ferait tourner en rond.
 */
function NoDoor({ linked, blocked }: { linked: boolean; blocked: number }) {
  const t = useTranslations("dashboard.dock");

  return (
    <>
      <p className="mt-3 text-base font-medium text-text">
        {linked ? t("manualTitle") : t("unconnectedTitle")}
      </p>
      <p className="mt-1 text-sm text-muted">
        {linked
          ? t("manualBody")
          : blocked > 0
            ? t("unconnectedWaiting", { count: blocked })
            : t("unconnectedBody")}
      </p>

      {linked ? null : (
        <Link
          href={ROUTES.dashboardSettings}
          className="mt-4 inline-flex cursor-pointer items-center rounded-pill bg-cta px-5 py-2.5 text-sm font-medium text-white shadow-[var(--shadow-pill)] transition-colors duration-200 hover:bg-cta-hover"
        >
          {t("connect")}
        </Link>
      )}
    </>
  );
}

/** Le lien est bon, le quai est vide : il manque une validation. */
function Empty() {
  const t = useTranslations("dashboard.dock");

  return (
    <>
      <p className="mt-3 text-base font-medium text-text">{t("emptyTitle")}</p>
      <p className="mt-1 text-sm text-muted">{t("emptyBody")}</p>
    </>
  );
}

/**
 * Le pilote automatique, posé en deux choix plutôt qu'en interrupteur.
 *
 * Un interrupteur intitulé « publication automatique » ne dit pas ce qu'il
 * change : les articles validés partent déjà tout seuls, coché ou non. Ce qui
 * se règle ici, c'est le degré de relecture que le client s'impose — et deux
 * phrases côte à côte le disent, là où un « on/off » demandait de deviner.
 */
function AutoPilot({ enabled }: { enabled: boolean }) {
  const t = useTranslations("dashboard.dock");
  const router = useRouter();
  const set = useAction(setAutoPublishAction, { onSuccess: () => router.refresh() });

  // L'état affiché suit le clic sans attendre le rechargement : le réglage est
  // instantané pour la main qui le pousse, et le serveur confirme derrière.
  const value = set.isPending ? (set.input?.autoPublish ?? enabled) : enabled;

  const options = [
    { key: false, label: t("autoOffLabel"), body: t("autoOffBody") },
    { key: true, label: t("autoOnLabel"), body: t("autoOnBody") },
  ];

  return (
    <div className="mt-6 border-t border-border pt-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-steel">
        {t("autoTitle")}
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {options.map((option) => {
          const active = value === option.key;
          return (
            <button
              key={String(option.key)}
              type="button"
              disabled={set.isPending}
              aria-pressed={active}
              onClick={() => set.execute({ autoPublish: option.key })}
              className={`cursor-pointer rounded-2xl border p-3.5 text-left transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40 disabled:opacity-60 ${
                active
                  ? "border-obsidian bg-mist"
                  : "border-border bg-surface hover:border-pebble"
              }`}
            >
              <span className="flex items-center gap-2">
                <span
                  aria-hidden
                  className={`flex size-4 shrink-0 items-center justify-center rounded-full border ${
                    active ? "border-obsidian bg-obsidian text-white" : "border-pebble"
                  }`}
                >
                  {active ? <RiCheckLine className="size-3" /> : null}
                </span>
                <span className="text-sm font-medium text-text">{option.label}</span>
              </span>
              <span className="mt-1.5 block pl-6 text-[13px] leading-snug text-muted">
                {option.body}
              </span>
            </button>
          );
        })}
      </div>

      {set.result.serverError ? (
        <p className="mt-2 text-sm text-danger">{set.result.serverError}</p>
      ) : null}
    </div>
  );
}
