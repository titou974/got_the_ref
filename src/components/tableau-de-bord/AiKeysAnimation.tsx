"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { AiKeycaps } from "@/components/AiKeycaps";

/**
 * Ce que l'audit est en train de faire, montré plutôt que décrit : la question
 * d'un client se tape sous les yeux du commerçant, dans ChatGPT, puis dans
 * Perplexity, puis dans Gemini.
 *
 * Les questions viennent de sa niche. « boulangerie artisanale au Havre » n'est
 * pas une phrase d'ambiance : c'est la requête dont dépend son chiffre
 * d'affaires, et la voir s'écrire pendant qu'on la mesure dit tout ce que
 * l'écran a à dire. Tant que la niche n'est pas lue, on tape les questions
 * génériques — le produit se raconte quand même, sans prétendre le connaître.
 *
 * Le clavier est l'objet signature de cet écran, et il est dessiné comme un
 * objet : capuchons pleins sur un socle sourd, arête claire, et une lèvre
 * intérieure sous chaque touche qui s'écrase à l'appui. C'est la même grammaire
 * que la pilule noire du système — l'ombre inset qui donne le toucher de verre
 * pressé —, appliquée à une touche. Les rangées sont décalées comme sur un vrai
 * AZERTY : sans ce décalage, dix carrés alignés se lisent comme un tableau, pas
 * comme un clavier.
 *
 * Au-dessus, les trois grosses touches des moteurs — celles du crawl et des
 * recherches, ramenées ici. Elles ne tournent pas en rond : celle qui s'enfonce
 * est le moteur à qui la question est réellement posée, et elle change quand la
 * question change. C'est ce qui les rend meilleures que la pastille qu'elles
 * remplacent dans la barre de saisie — un logo de seize pixels dit à qui l'on
 * parle, une touche enfoncée dit qu'on est en train de lui parler.
 *
 * Tout est en transform, opacity et couleur, sans mesure de la fenêtre : la
 * boucle reste fluide sur un portable qui, par ailleurs, attend une réponse
 * réseau. Sans mouvement, la question s'affiche entière et les touches restent
 * posées : il n'y a rien à comprendre dans l'appui, seulement dans le texte.
 *
 * Bloc décoratif du point de vue de l'assistance vocale : la barre de
 * progression, au-dessus, annonce déjà l'étape en cours. Faire lire chaque
 * changement de moteur ferait un fond sonore de trois minutes.
 */

/** Trois rangées, disposition française. Assez pour qu'on y reconnaisse un clavier. */
const ROWS = [
  ["A", "Z", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["Q", "S", "D", "F", "G", "H", "J", "K", "L", "M"],
  ["W", "X", "C", "V", "B", "N"],
];

/** Le décalage de chaque rangée, en classes de retrait — l'escalier du clavier. */
const ROW_INDENT = ["", "pl-3 sm:pl-5", "pl-8 sm:pl-[3.25rem]"];

/** Une frappe toutes les 55 ms : le rythme d'une main qui va vite sans courir. */
const TYPE_MS = 55;
/** Le temps de lire la question une fois écrite, avant de passer à la suivante. */
const HOLD_MS = 1800;
/** Sans mouvement, chaque question reste lisible le temps d'être lue en entier. */
const STATIC_MS = 4500;

/** Capuchon au repos : arête claire et lèvre intérieure, comme une touche moulée. */
const CAP_UP = "inset 0 -2px 0 0 rgba(9, 9, 11, 0.09), 0 1px 1px 0 rgba(9, 9, 11, 0.04)";
/** Capuchon enfoncé : la lèvre s'écrase, l'ombre portée disparaît. */
const CAP_DOWN = "inset 0 1px 0 0 rgba(255, 255, 255, 0.18)";

export function AiKeysAnimation({ prompts }: { prompts: string[] }) {
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState(0);

  const question = prompts[index % prompts.length] ?? "";

  // Une seule horloge pour les deux régimes : on écrit lettre à lettre, puis on
  // laisse lire, puis on passe à la question suivante. Sans mouvement, l'étape
  // d'écriture est sautée — la question est posée d'un coup.
  useEffect(() => {
    if (reduced) {
      const timer = setTimeout(() => setIndex((n) => n + 1), STATIC_MS);
      return () => clearTimeout(timer);
    }
    if (typed < question.length) {
      const timer = setTimeout(() => setTyped((n) => n + 1), TYPE_MS);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(() => {
      setIndex((n) => n + 1);
      setTyped(0);
    }, HOLD_MS);
    return () => clearTimeout(timer);
  }, [reduced, typed, question.length]);

  const shown = reduced ? question : question.slice(0, typed);
  // La touche enfoncée est celle du dernier caractère écrit. L'espace allume la
  // barre, la ponctuation n'allume rien : aucune touche ne lui correspond.
  const lastChar = !reduced && typed > 0 ? question[typed - 1].toUpperCase() : "";

  return (
    <div aria-hidden className="flex flex-col items-center gap-5">
      {/* Les trois moteurs. Celui à qui la question est posée reste enfoncé le
          temps qu'elle s'écrive : c'est lui qu'on interroge, pas une ronde. */}
      <AiKeycaps active={index} />

      {/* La question, dans la boîte où on la tape. Deux lignes réservées : la
          boîte ne saute pas quand une question longue passe à la ligne. */}
      <div className="w-full max-w-lg rounded-[20px] border border-pebble bg-snow px-4 py-3.5">
        <p className="min-h-[2.5rem] text-sm leading-relaxed text-text">
          {shown}
          <span className="ml-0.5 inline-block h-4 w-px animate-[blink_1s_step-end_infinite] bg-obsidian align-middle" />
        </p>
      </div>

      {/* Le clavier. Socle sourd, capuchons pleins, rangées en escalier. */}
      <div className="inline-flex flex-col gap-1.5 rounded-[24px] border border-fog bg-mist p-3 sm:gap-2 sm:p-4">
        {ROWS.map((row, rowIndex) => (
          <div key={rowIndex} className={`flex gap-1.5 sm:gap-2 ${ROW_INDENT[rowIndex]}`}>
            {row.map((key) => (
              <Keycap key={key} label={key} pressed={key === lastChar} />
            ))}
          </div>
        ))}
        {/* La barre d'espace est centrée sous les trois rangées, comme sur un
            clavier : alignée sur le retrait de la dernière, elle tirait tout le
            bloc vers la gauche. */}
        <div className="flex justify-center">
          <Keycap wide pressed={question[typed - 1] === " " && !reduced} />
        </div>
      </div>
    </div>
  );
}

/**
 * Un capuchon de lettre. Au repos il porte sa lèvre et son ombre ; enfoncé il
 * descend de deux pixels, se remplit de noir et perd son relief — la descente
 * et la perte d'ombre font l'appui, la couleur ne fait que le confirmer.
 *
 * Les touches des moteurs, elles, ne passent pas par ici : leurs visuels de
 * marque sont déjà dessinés en volume (cf. `AiKeycaps`), et les poser dans ce
 * cadre ferait une touche dans une touche.
 */
function Keycap({
  label,
  pressed,
  wide = false,
}: {
  label?: string;
  pressed: boolean;
  wide?: boolean;
}) {
  return (
    <motion.span
      animate={{
        y: pressed ? 2 : 0,
        backgroundColor: pressed ? "#09090b" : "#ffffff",
        borderColor: pressed ? "#09090b" : "#d4d4d8",
        color: pressed ? "#ffffff" : "#71717a",
        boxShadow: pressed ? CAP_DOWN : CAP_UP,
      }}
      transition={{ duration: 0.09, ease: "easeOut" }}
      className={`flex h-9 items-center justify-center rounded-xl border text-[11px] font-semibold sm:h-12 sm:text-[13px] ${
        wide ? "w-40 sm:w-56" : "w-6 sm:w-10"
      }`}
    >
      {label}
    </motion.span>
  );
}
