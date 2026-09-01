"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useTranslations } from "next-intl";
import {
  dashboardReadyAction,
  prepareDashboardAction,
  seedEditorialMonthAction,
} from "@/features/dashboard/actions";
import { draftsSeedArticles, type AccessTier } from "@/constants/access";
import { buildLoadingPrompts, type BusinessHint } from "@/lib/geo/loading-prompts";
import { Card } from "./Card";
import { AiKeysAnimation } from "./AiKeysAnimation";
import {
  ARTICLES_PHASE,
  KEYBOARD_PHASE,
  PHASE_LABEL_KEYS,
  PhaseAnimation,
  auditPhaseFor,
} from "./AnalysisPhases";

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
 * ## Ce que l'écran montre
 *
 * Une scène à la fois, comme sur l'écran d'analyse d'origine : l'animation du
 * temps en cours, son nom, la barre. Sur l'étape des moteurs, cette scène est
 * le clavier — la question du client s'y écrit, « boulangerie artisanale au
 * Havre », et c'est la requête dont dépend son chiffre d'affaires. C'est de
 * loin l'étape la plus longue, parce que c'est la seule où il y a quelque
 * chose à lire plutôt qu'à regarder.
 *
 * La barre de progression n'est pas un pourcentage mesuré — personne ne sait à
 * l'avance combien de pages a un site. C'est une avance dans le temps, bornée
 * par passe : l'audit monte vers 70 %, la planification vers 96 %, et le 100 %
 * n'arrive qu'une fois le travail réellement fini. Elle ne recule jamais et ne
 * se fige jamais tout à fait, parce qu'une barre arrêtée passe pour un plantage
 * — mais elle ne ment pas non plus en annonçant une fin qui n'a pas eu lieu.
 * L'étape affichée se déduit de cette même barre : il n'y a qu'une horloge, et
 * l'image ne peut donc pas raconter autre chose que le pourcentage.
 *
 * ## La sortie de l'écran
 *
 * C'est la partie qui a le plus de raisons de mal tourner, donc celle qui a le
 * plus de garde-fous. Le travail fini, l'écran n'est pas pour autant en droit
 * de disparaître : il faut que le serveur, relancé, réponde autre chose que
 * cette attente. On procède par degrés, du plus doux au plus brutal.
 *
 * 1. On demande au serveur s'il est prêt (`dashboardReadyAction`) plutôt que de
 *    le supposer. Tant qu'il dit non, on redemande toutes les deux secondes.
 * 2. Dès qu'il dit oui, `router.refresh()` rejoue le rendu serveur ; la page
 *    d'accueil prend la place de ce composant, qui se démonte.
 * 3. Si six secondes plus tard ce composant est toujours monté, c'est que le
 *    rafraîchissement n'a pas suffi : on recharge la page pour de bon. Une
 *    seule fois, marquée dans la session — sans ce verrou, un serveur qui ne
 *    devient jamais prêt ferait boucler le navigateur sur ses propres
 *    rechargements, ce qui est pire que l'écran figé qu'on veut supprimer.
 * 4. Passé ce point, on arrête d'insister et on le dit. Un bouton rend la main
 *    au client plutôt que de le laisser devant une barre pleine.
 *
 * L'ancienne version se contentait du degré 2, répété toutes les quatre
 * secondes indéfiniment : quand le rendu serveur ne changeait pas, le client
 * restait devant 100 % sans rien à cliquer et sans rien à comprendre.
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

/** Le travail est fini : à quelle cadence demande-t-on au serveur s'il suit. */
const READY_POLL_MS = 2000;
/** Après un rafraîchissement resté sans effet, le délai avant le rechargement. */
const HARD_RELOAD_MS = 6000;
/** Au-delà, on cesse d'insister et on passe la main au client. */
const SETTLE_TIMEOUT_MS = 60_000;

/**
 * Le rechargement forcé n'a lieu qu'une fois par session de navigation.
 * `sessionStorage` peut être fermé (navigation privée, réglage strict) : son
 * indisponibilité ne doit pas empêcher l'écran de fonctionner, elle fait
 * seulement retomber sur le bouton manuel.
 */
const RELOAD_FLAG = "boostgeo:dashboard-reloaded";

function readReloadFlag(): boolean {
  try {
    return window.sessionStorage.getItem(RELOAD_FLAG) === "1";
  } catch {
    return true;
  }
}

function markReloaded(value: boolean) {
  try {
    if (value) window.sessionStorage.setItem(RELOAD_FLAG, "1");
    else window.sessionStorage.removeItem(RELOAD_FLAG);
  } catch {
    /* stockage fermé : le bouton manuel reste la sortie */
  }
}

/** Avance asymptotique : `from` vers `to`, jamais atteint. */
function ease(from: number, to: number, elapsed: number, tau: number): number {
  return from + (to - from) * (1 - Math.exp(-elapsed / tau));
}

export function PreparingAnalysis({
  tier = "free",
  business,
}: {
  tier?: AccessTier;
  /** La niche et la ville, quand le crawl d'accueil les a déjà lues. */
  business?: BusinessHint;
}) {
  const t = useTranslations("dashboard.preparing");
  // Le texte de la seconde passe annonce ce qui part vraiment : sur un compte
  // gratuit, des sujets planifiés et rien de rédigé. Promettre trois brouillons
  // à qui n'en recevra aucun serait le seul vrai mensonge de cet écran.
  const drafts = draftsSeedArticles(tier);
  const router = useRouter();
  const started = useRef(false);

  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  /** Le travail est fini mais le serveur ne l'a pas encore montré. */
  const [stalled, setStalled] = useState(false);

  // Les questions sont composées une fois pour toutes : elles ne dépendent que
  // de la niche et de la ville, qui ne bougent pas pendant l'attente.
  const prompts = useMemo(
    () => buildLoadingPrompts(business ?? { niche: null, city: null, isPhysical: true }),
    [business],
  );

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

  // La sonde de disponibilité. Gardée dans un ref parce qu'elle est appelée
  // depuis une boucle : l'effet qui négocie la sortie n'a pas à redémarrer
  // chaque fois que le hook recrée une référence.
  const probe = useAction(dashboardReadyAction);
  const probeRef = useRef(probe.executeAsync);
  useEffect(() => {
    probeRef.current = probe.executeAsync;
  }, [probe.executeAsync]);

  const relaunch = useCallback(() => {
    markReloaded(false);
    setDone(false);
    setStalled(false);
    setProgress(0);
    execute({});
  }, [execute]);

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

  // Le travail est fini : on négocie la sortie de cet écran, par degrés.
  // Tous les minuteurs meurent avec le composant — s'il est démonté, c'est que
  // l'accueil a pris sa place et il n'y a plus rien à négocier.
  useEffect(() => {
    if (!done || stalled) return;

    let alive = true;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const escalate = () => {
      // Le rafraîchissement n'a pas rendu la main : on recharge pour de bon,
      // une seule fois, puis on passe la main au client.
      if (!alive) return;
      if (readReloadFlag()) {
        setStalled(true);
        return;
      }
      markReloaded(true);
      window.location.reload();
    };

    const poll = async () => {
      if (!alive) return;
      const outcome = await probeRef.current({});
      if (!alive) return;

      if (outcome?.data?.ready) {
        router.refresh();
        timers.push(setTimeout(escalate, HARD_RELOAD_MS));
        return;
      }
      timers.push(setTimeout(poll, READY_POLL_MS));
    };

    void poll();
    // Filet de dernier recours : au bout d'une minute sans issue — serveur muet,
    // action en échec, analyse écrite ailleurs —, l'écran le dit au lieu de
    // tourner en silence.
    timers.push(setTimeout(() => alive && setStalled(true), SETTLE_TIMEOUT_MS));

    return () => {
      alive = false;
      for (const timer of timers) clearTimeout(timer);
    };
  }, [done, stalled, router]);

  // Le 100 % se déduit de l'état, il ne s'écrit pas : la barre est pleine
  // parce que le travail est fini, pas parce qu'un effet l'a poussée là.
  const shown = done ? 100 : progress;

  // L'étape sort de la barre elle-même : les cinq passes de l'audit se
  // partagent la montée vers 70 %, chacune selon son poids, et la sixième est
  // la planification des articles.
  const phase =
    seedPending || done ? ARTICLES_PHASE : auditPhaseFor(progress, AUDIT_CEILING);

  const failed = Boolean(result.serverError) && !isPending;

  if (failed) {
    return (
      <Card className="text-center">
        <h1 className="text-xl font-bold">{t("title")}</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">{result.serverError}</p>
        <RetryButton label={t("retry")} onClick={relaunch} />
      </Card>
    );
  }

  if (stalled) {
    return (
      <Card className="text-center">
        <h1 className="text-xl font-bold">{t("stalledTitle")}</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">{t("stalledBody")}</p>
        <RetryButton label={t("openDashboard")} onClick={() => window.location.reload()} />
      </Card>
    );
  }

  const phaseLabel = done ? t("progressDone") : t(PHASE_LABEL_KEYS[phase]);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <header className="text-center">
        <h1 className="text-xl font-bold">{seedPending ? t("articlesTitle") : t("title")}</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">
          {seedPending ? t(drafts ? "articlesBody" : "articlesBodyFree") : t("body")}
        </p>
      </header>

      <section className="rounded-[36px] border border-border bg-surface px-5 py-7 sm:px-8 sm:py-9">
        <div className="flex flex-col items-center">
          {/* Une seule scène à la fois. Sur l'étape des moteurs, le clavier
              prend toute la place : c'est le moment où le client a quelque
              chose à lire — sa propre requête — plutôt qu'à regarder. */}
          {phase === KEYBOARD_PHASE ? (
            <AiKeysAnimation prompts={prompts} />
          ) : (
            <PhaseAnimation index={phase} />
          )}

          <p
            aria-live="polite"
            className="mt-5 text-center text-sm font-semibold sm:text-base"
          >
            {phaseLabel}
          </p>

          <div
            className="mt-4 w-full max-w-md"
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
            <p className="mt-2 text-right font-mono text-xs tabular-nums text-muted">
              {Math.round(shown)} %
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

/** La pilule noire du système, pour la seule action de ces deux écrans. */
function RetryButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-5 cursor-pointer rounded-pill bg-obsidian px-5 py-2.5 text-sm font-medium text-white transition-colors duration-200 hover:bg-ink"
    >
      {label}
    </button>
  );
}
