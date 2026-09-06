"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

// lottie-react touche à `window` → chargé côté client uniquement.
const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

/**
 * Les six temps de la mise en route, et ce qu'on regarde à chacun.
 *
 * Les animations sont celles de la toute première version de l'analyse — le
 * satellite, la loupe, la fusée, et la citabilité. Elles ont été choisies pour
 * cet écran-là, et c'est là qu'elles reviennent.
 *
 * Sauf à la première étape. Le carnet de notes gris qui l'occupait n'illustrait
 * rien de ce qui se passe pendant qu'on lit le site : c'est le clavier qui y
 * tient sa place désormais, comme à l'étape des moteurs — le client voit tout
 * de suite la question dont dépend son chiffre d'affaires plutôt qu'une page
 * qui se remplit toute seule.
 *
 * Une seule scène à la fois, comme sur l'écran d'origine. La version
 * précédente empilait l'animation et le clavier en permanence : deux objets
 * qui bougent l'un au-dessus de l'autre pendant trois minutes, et le regard ne
 * savait plus lequel regarder. Ici le clavier n'accompagne plus, il occupe —
 * c'est une étape à part entière, celle où l'on interroge réellement les
 * moteurs, et de loin la plus longue.
 *
 * L'ordre n'est pas décoratif : c'est celui de `prepareDashboardAction`, puis
 * de `seedEditorialMonthAction`. Un client qui voit la question s'écrire au
 * moment où l'audit interroge vraiment ChatGPT comprend ce qu'il a acheté ;
 * une suite d'images sans rapport avec le travail habillerait l'attente.
 *
 * Les fichiers ne sont pas importés mais chargés à la demande. Le satellite
 * pèse 800 Ko à lui seul : statiques, les cinq mettraient un mégaoctet dans le
 * paquet du tableau de bord, payé par tous les écrans et à chaque visite. En
 * `import()`, chacun est un morceau à part, récupéré quand son étape approche —
 * et l'étape d'avant dure largement le temps qu'il arrive.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnimationModule = { default: any };

/**
 * Le chargeur de chaque étape. `null` pour le clavier : il n'a pas de fichier,
 * il est dessiné.
 */
const LOADERS: (null | (() => Promise<AnimationModule>))[] = [
  null, // le clavier : la lecture du site
  () => import("@/assets/animation2.json"), // satellite + bulles
  () => import("@/lottie/citability.json"), // citabilité
  null, // le clavier : les moteurs interrogés
  () => import("@/assets/animation3.json"), // loupe
  () => import("@/assets/animation5.json"), // fusée
];
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Les clés i18n des libellés, dans `dashboard.preparing`. */
export const PHASE_LABEL_KEYS = [
  "phaseSite",
  "phaseCrawlers",
  "phaseCitability",
  "phaseEngines",
  "phaseRankings",
  "phaseArticles",
] as const;

/**
 * L'étape est-elle une étape de clavier ?
 *
 * La question se lit sur la table des chargeurs plutôt que sur une liste tenue
 * à côté : une étape sans fichier Lottie est une étape que le clavier occupe,
 * et les deux ne peuvent pas se contredire.
 */
export function usesKeyboard(index: number): boolean {
  return LOADERS[index] === null;
}

/** La dernière étape, celle de la planification des articles (seconde passe). */
export const ARTICLES_PHASE = 5;

/**
 * Le poids de chaque étape de l'audit, en parts de la montée vers 70 %.
 *
 * L'étape du clavier en prend trois sur sept : c'est celle où le client a
 * quelque chose à lire — sa propre requête, tapée sous ses yeux — et la seule
 * dont on ne se lasse pas au bout de vingt secondes. Les autres illustrent, et
 * une illustration qui s'attarde devient un écran figé.
 */
export const AUDIT_WEIGHTS = [1, 1, 1, 3, 1] as const;

const TOTAL_WEIGHT = AUDIT_WEIGHTS.reduce((sum, weight) => sum + weight, 0);

/**
 * L'étape de l'audit correspondant à une avance donnée.
 *
 * L'étape se déduit de la barre : il n'y a qu'une horloge sur cet écran, et
 * l'image ne peut donc pas raconter autre chose que le pourcentage.
 */
export function auditPhaseFor(progress: number, ceiling: number): number {
  const share = Math.min(1, Math.max(0, progress / ceiling));
  let consumed = 0;
  for (let index = 0; index < AUDIT_WEIGHTS.length; index++) {
    consumed += AUDIT_WEIGHTS[index] / TOTAL_WEIGHT;
    if (share < consumed) return index;
  }
  return AUDIT_WEIGHTS.length - 1;
}

/**
 * L'animation de l'étape en cours, fondue sur la précédente.
 *
 * Le fondu croisé vaut mieux qu'une coupe : le changement d'étape est la seule
 * chose qui bouge à l'échelle de la minute, et une coupe nette ferait croire à
 * un rechargement. Sans mouvement, l'animation est remplacée par sa première
 * image, fixe — l'étape reste identifiable, rien ne s'agite.
 *
 * L'étape suivante est récupérée pendant celle-ci : quand le fondu arrive, le
 * fichier est déjà là, et il n'y a pas de trou entre les deux images.
 */
export function PhaseAnimation({ index }: { index: number }) {
  const reduced = useReducedMotion();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [animations, setAnimations] = useState<Record<number, any>>({});

  useEffect(() => {
    let alive = true;

    const load = async (phase: number) => {
      const loader = LOADERS[phase];
      if (!loader) return;
      const loaded = await loader().catch(() => null);
      if (!alive || !loaded) return;
      setAnimations((current) =>
        current[phase] ? current : { ...current, [phase]: loaded.default },
      );
    };

    void load(index);
    void load(index + 1);

    return () => {
      alive = false;
    };
  }, [index]);

  const animation = animations[index];

  return (
    <div aria-hidden className="flex h-52 w-52 items-center justify-center sm:h-64 sm:w-64">
      <AnimatePresence mode="wait">
        {animation ? (
          <motion.div
            key={index}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.45, ease: "easeInOut" }}
            className="h-full w-full"
          >
            <Lottie
              animationData={animation}
              loop={!reduced}
              autoplay={!reduced}
              className="h-full w-full"
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
