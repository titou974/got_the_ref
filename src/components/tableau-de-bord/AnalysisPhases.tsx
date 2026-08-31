"use client";

import dynamic from "next/dynamic";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import fetching from "@/lottie/fetch.json";
import crawlers from "@/lottie/crawlers.json";
import citability from "@/lottie/citability.json";
import ranking from "@/lottie/ranking.json";
import score from "@/lottie/score.json";
import recommend from "@/lottie/recommend.json";
import assistant from "@/lottie/ai-assistant.json";

// lottie-react touche à `window` → chargé côté client uniquement.
const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

/**
 * Les sept temps de la mise en route, et l'animation de chacun.
 *
 * L'écran d'attente de l'analyse a toujours raconté l'audit en images plutôt
 * qu'en pourcentages, et c'est ce qui le rendait supportable : on ne regarde
 * pas une barre monter pendant trois minutes, on regarde une machine faire six
 * choses et les finir. Les sept animations reviennent donc ici, dans l'ordre
 * exact du travail — six passes d'audit, puis la planification des articles.
 *
 * Elles sont légères (4 à 28 Ko chacune, recolorées à la charte) : les sept
 * tiennent dans ce que pesait la seule animation de citabilité de l'ancienne
 * version. Elles peuvent donc être importées plutôt que récupérées au montage,
 * et aucune ne manque à l'appel sur une connexion lente.
 *
 * L'ordre n'est pas décoratif : c'est celui de `prepareDashboardAction`, puis
 * de `seedEditorialMonthAction`. Un client qui reconnaît « relevé de votre
 * place » au moment où l'audit interroge vraiment les moteurs comprend ce qu'il
 * a acheté ; une suite d'images sans rapport avec le travail ne serait qu'un
 * habillage de l'attente.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
const ANIMATIONS: any[] = [
  fetching,
  crawlers,
  citability,
  ranking,
  score,
  recommend,
  assistant,
];
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Les clés i18n des libellés, dans `dashboard.preparing`. */
export const PHASE_LABEL_KEYS = [
  "phaseSite",
  "phaseCrawlers",
  "phaseCitability",
  "phaseRankings",
  "phaseScore",
  "phasePlan",
  "phaseArticles",
] as const;

/** Les six passes de l'audit ; la septième est la planification des articles. */
export const AUDIT_PHASES = 6;
export const ARTICLES_PHASE = 6;

/**
 * L'animation de l'étape en cours, fondue sur la précédente.
 *
 * Le fondu croisé vaut mieux qu'une coupe : le changement d'étape est la seule
 * chose qui bouge à l'échelle de la minute sur cet écran, et une coupe nette
 * ferait croire à un rechargement. Sans mouvement, l'animation est remplacée
 * par sa première image, fixe — l'étape reste identifiable, rien ne s'agite.
 */
export function PhaseAnimation({ index }: { index: number }) {
  const reduced = useReducedMotion();
  const safe = Math.min(Math.max(index, 0), ANIMATIONS.length - 1);

  return (
    <div aria-hidden className="flex h-44 w-44 items-center justify-center sm:h-52 sm:w-52">
      <AnimatePresence mode="wait">
        <motion.div
          key={safe}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.05 }}
          transition={{ duration: 0.45, ease: "easeInOut" }}
          className="h-full w-full"
        >
          <Lottie
            animationData={ANIMATIONS[safe]}
            loop={!reduced}
            autoplay={!reduced}
            className="h-full w-full"
          />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
