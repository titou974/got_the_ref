"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useTranslations } from "next-intl";
import {
  prepareDashboardAction,
  seedEditorialMonthAction,
} from "@/features/dashboard/actions";
import { draftsSeedArticles, type AccessTier } from "@/constants/access";
import { Card } from "./Card";
import { AiKeysAnimation } from "@/components/AiKeysAnimation";
import { useNicheQuestions } from "@/components/useNicheQuestions";

/**
 * L'analyse lancée à la première ouverture du tableau de bord — et rejouée le
 * jour de l'achat —, puis les sujets d'articles posés dans la foulée.
 *
 * Deux passes, une seule attente : l'audit GEO, puis les sujets planifiés. Le
 * client n'arrive donc jamais sur un calendrier vide — c'est le travail qu'il
 * vient de déléguer. Le volume dépend de son offre : quatre sujets sur un compte
 * gratuit, le mois entier dès le Coup de Boost, avec la première semaine rédigée.
 *
 * Le même écran sert deux fois. À la mise en route, il fait l'analyse d'entrée.
 * Le jour où le compte achète, il la refait — le gratuit n'avait fait mesurer
 * qu'un moteur et sauté les relevés hors-site, et ces appels-là ont enfin un
 * écran où s'afficher — puis complète le calendrier. Le client voit donc
 * exactement la même barre qu'à son arrivée, ce qui est le but : il sait ce que
 * ça veut dire.
 *
 * Elle part toute seule : le client vient de finir le tunnel d'accueil, ou de
 * payer ; lui demander un clic de plus pour obtenir ce qu'il attend
 * n'apporterait rien. Le garde-fou `started` évite qu'un double rendu en
 * déclenche deux.
 *
 * La barre de progression n'est pas un pourcentage mesuré — personne ne sait à
 * l'avance combien de pages a un site. C'est une avance dans le temps, bornée
 * par passe : l'audit monte vers 70 %, la planification vers 96 %, et le 100 %
 * n'arrive qu'une fois le travail réellement fini. Elle ne recule jamais et ne
 * se fige jamais tout à fait, parce qu'une barre arrêtée passe pour un plantage
 * — mais elle ne ment pas non plus en annonçant une fin qui n'a pas eu lieu.
 *
 * En dessous, la question est tapée sous les yeux du client dans ChatGPT,
 * Perplexity puis Gemini : c'est exactement ce qui se joue pendant qu'il attend.
 */

/** Le rythme de rafraîchissement de la barre. */
const TICK_MS = 200;

/**
 * Les deux passes et leur plafond. Les constantes de temps sont l'ordre de
 * grandeur observé : l'audit met une à trois minutes, la planification une
 * minute. L'avance est asymptotique — on approche le plafond sans l'atteindre,
 * ce qui laisse la barre vivante même sur un site plus lent que prévu.
 */
const AUDIT_CEILING = 70;
const AUDIT_TAU_MS = 75_000;
const SEED_CEILING = 96;
const SEED_TAU_MS = 30_000;

/** Avance asymptotique : `from` vers `to`, jamais atteint. */
function ease(from: number, to: number, elapsed: number, tau: number): number {
  return from + (to - from) * (1 - Math.exp(-elapsed / tau));
}

export function PreparingAnalysis({
  tier = "free",
  siteUrl = null,
  isPhysical = true,
}: {
  tier?: AccessTier;
  /**
   * Le site du client, pour que les questions tapées sous ses yeux soient les
   * siennes. Absent — fiche d'accueil incomplète —, le clavier tape ses
   * questions d'attente, ce qui reste préférable à un écran figé.
   */
  siteUrl?: string | null;
  isPhysical?: boolean;
}) {
  const t = useTranslations("dashboard.preparing");
  const { questions, niche } = useNicheQuestions(siteUrl, isPhysical ? "physical" : "online");
  // Le texte de la seconde passe annonce ce qui part vraiment : sur un compte
  // gratuit, des sujets planifiés et rien de rédigé. Promettre trois brouillons
  // à qui n'en recevra aucun serait le seul vrai mensonge de cet écran.
  const drafts = draftsSeedArticles(tier);
  const router = useRouter();
  const started = useRef(false);

  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);

  // Le mois d'articles est posé dans la foulée de l'audit : le client arrive
  // sur un calendrier rempli, dont la première semaine est déjà rédigée. Si
  // cette passe échoue, on ouvre quand même le tableau de bord — l'analyse,
  // elle, est faite, et le planning se relance d'un bouton.
  const seed = useAction(seedEditorialMonthAction, {
    onSettled: () => setDone(true),
  });

  const { execute, result, isPending } = useAction(prepareDashboardAction, {
    onSuccess: () => seed.execute({}),
    // L'audit a échoué : on ne lance pas la planification, et l'écran d'erreur
    // prend la main plutôt que de laisser une barre monter dans le vide.
    onError: () => setProgress(0),
  });

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    execute({});
  }, [execute]);

  // Deux phases, deux horloges. Le passage de l'une à l'autre repart du niveau
  // atteint : la barre ne saute pas et ne redescend jamais.
  const seedPending = seed.isPending;
  useEffect(() => {
    if (done) return;
    const startedAt = performance.now();
    const from = seedPending ? AUDIT_CEILING : 0;
    const to = seedPending ? SEED_CEILING : AUDIT_CEILING;
    const tau = seedPending ? SEED_TAU_MS : AUDIT_TAU_MS;
    const id = setInterval(() => {
      const value = ease(from, to, performance.now() - startedAt, tau);
      setProgress((current) => Math.max(current, value));
    }, TICK_MS);
    return () => clearInterval(id);
  }, [seedPending, done]);

  // Le travail est fini : la barre va au bout, puis le tableau de bord se
  // substitue à cet écran de lui-même. `router.refresh()` rejoue le rendu
  // serveur de la page — l'analyse existe désormais en base, donc l'accueil
  // s'affiche à la place de ce composant, sans que le client touche à rien.
  //
  // La relance périodique est un filet : si le rafraîchissement part avant que
  // l'écriture ne soit visible, un seul essai laisserait l'écran d'attente en
  // place indéfiniment. On réessaie donc tant que ce composant est monté —
  // s'il est démonté, c'est que l'accueil a pris sa place et l'horloge meurt
  // avec lui.
  useEffect(() => {
    if (!done) return;
    router.refresh();
    const id = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(id);
  }, [done, router]);

  // Le 100 % se déduit de l'état, il ne s'écrit pas : la barre est pleine
  // parce que le travail est fini, pas parce qu'un effet l'a poussée là.
  const shown = done ? 100 : progress;

  const failed = Boolean(result.serverError) && !isPending;

  if (failed) {
    return (
      <Card className="text-center">
        <h1 className="text-xl font-bold">{t("title")}</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">{result.serverError}</p>
        <button
          type="button"
          onClick={() => {
            setDone(false);
            setProgress(0);
            execute({});
          }}
          className="mt-5 cursor-pointer rounded-pill bg-obsidian px-5 py-2.5 text-sm font-medium text-white transition-colors duration-200 hover:bg-ink"
        >
          {t("retry")}
        </button>
      </Card>
    );
  }

  const phaseLabel = done
    ? t("progressDone")
    : seedPending
      ? t("progressArticles")
      : t("progressAudit");

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h1 className="text-xl font-bold">{seedPending ? t("articlesTitle") : t("title")}</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">
          {seedPending ? t(drafts ? "articlesBody" : "articlesBodyFree") : t("body")}
        </p>
      </div>

      <div
        className="mx-auto w-full max-w-md"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(shown)}
        aria-label={phaseLabel}
      >
        <div className="h-2 w-full overflow-hidden rounded-full bg-fog">
          <div
            className="h-full rounded-full bg-obsidian transition-[width] duration-300 ease-linear"
            style={{ width: `${shown}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted">
          <span className="min-w-0 truncate">{phaseLabel}</span>
          <span className="shrink-0 font-mono tabular-nums">{Math.round(shown)} %</span>
        </div>
      </div>

      <AiKeysAnimation questions={questions} niche={niche} />
    </div>
  );
}
