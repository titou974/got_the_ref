"use client";

import { motion } from "framer-motion";

/**
 * Le clavier du produit, dessiné comme un objet.
 *
 * Capuchons pleins sur un socle sourd, arête claire, et une lèvre intérieure
 * sous chaque touche qui s'écrase à l'appui. C'est la même grammaire que la
 * pilule noire du système — l'ombre inset qui donne le toucher de verre pressé —,
 * appliquée à une touche. Les rangées sont décalées comme sur un vrai AZERTY :
 * sans ce décalage, dix carrés alignés se lisent comme un tableau, pas comme un
 * clavier.
 *
 * Il vient de l'écran d'analyse, où la question du client se tape sous ses yeux
 * (cf. `AiKeysAnimation`). L'atelier d'article s'en sert pour la même raison,
 * dans un autre moment : pendant qu'un texte s'écrit. Il vit donc ici plutôt
 * qu'au fond de l'un des deux, pour qu'un seul objet ne se dessine pas deux fois
 * de deux façons.
 *
 * Deux tailles. `full` est celle de l'écran d'analyse, qui n'a que ça à
 * montrer ; `compact` tient sous une feuille d'article, où le clavier accompagne
 * le texte au lieu d'en être le sujet.
 *
 * Décoratif du point de vue de l'assistance vocale : ce qui se tape est toujours
 * lisible en toutes lettres à côté, et faire lire chaque touche ferait un fond
 * sonore de trois minutes.
 */

/** Trois rangées, disposition française. Assez pour qu'on y reconnaisse un clavier. */
const ROWS = [
  ["A", "Z", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["Q", "S", "D", "F", "G", "H", "J", "K", "L", "M"],
  ["W", "X", "C", "V", "B", "N"],
];

/** Le décalage de chaque rangée, en classes de retrait — l'escalier du clavier. */
const ROW_INDENT = ["", "pl-3 sm:pl-5", "pl-8 sm:pl-[3.25rem]"];
const ROW_INDENT_COMPACT = ["", "pl-2.5", "pl-6"];

/** Capuchon au repos : arête claire et lèvre intérieure, comme une touche moulée. */
const CAP_UP = "inset 0 -2px 0 0 rgba(9, 9, 11, 0.09), 0 1px 1px 0 rgba(9, 9, 11, 0.04)";
/** Capuchon enfoncé : la lèvre s'écrase, l'ombre portée disparaît. */
const CAP_DOWN = "inset 0 1px 0 0 rgba(255, 255, 255, 0.18)";

export function Keyboard({
  pressed,
  spacePressed = false,
  size = "full",
}: {
  /** La lettre enfoncée, en majuscule. Vide, ou hors clavier : rien ne descend. */
  pressed: string;
  /** La barre d'espace, à part : aucune lettre ne lui correspond. */
  spacePressed?: boolean;
  size?: "full" | "compact";
}) {
  const compact = size === "compact";
  const indent = compact ? ROW_INDENT_COMPACT : ROW_INDENT;

  return (
    <div
      aria-hidden
      className={`inline-flex flex-col rounded-[24px] border border-fog bg-mist ${
        compact ? "gap-1 p-2" : "gap-1.5 p-3 sm:gap-2 sm:p-4"
      }`}
    >
      {ROWS.map((row, rowIndex) => (
        <div
          key={rowIndex}
          className={`flex ${compact ? "gap-1" : "gap-1.5 sm:gap-2"} ${indent[rowIndex]}`}
        >
          {row.map((key) => (
            <Keycap key={key} label={key} pressed={key === pressed} compact={compact} />
          ))}
        </div>
      ))}

      {/* La barre d'espace est centrée sous les trois rangées, comme sur un
          clavier : alignée sur le retrait de la dernière, elle tirait tout le
          bloc vers la gauche. */}
      <div className="flex justify-center">
        <Keycap wide pressed={spacePressed} compact={compact} />
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
  compact,
  wide = false,
}: {
  label?: string;
  pressed: boolean;
  compact: boolean;
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
      className={
        compact
          ? `flex h-7 items-center justify-center rounded-lg border text-[10px] font-semibold ${
              wide ? "w-28" : "w-5"
            }`
          : `flex h-9 items-center justify-center rounded-xl border text-[11px] font-semibold sm:h-12 sm:text-[13px] ${
              wide ? "w-40 sm:w-56" : "w-6 sm:w-10"
            }`
      }
    >
      {label}
    </motion.span>
  );
}
