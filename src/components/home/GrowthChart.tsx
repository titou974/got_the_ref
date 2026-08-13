"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";

/**
 * Courbe de croissance avec repère de mise en service : deux séries (clics et
 * impressions) plates jusqu'au trait pointillé, puis qui décollent. Le repère
 * porte le logo got_the_ref — c'est tout l'argument du graphique, montrer
 * *quand* la bascule a eu lieu plutôt que d'afficher une jolie pente.
 *
 * Les points sont générés une fois pour toutes ci-dessous : il s'agit d'une
 * courbe de démonstration, jamais de données client.
 *
 * Le tracé s'anime au montage, et non à l'entrée dans le champ de vision : le
 * graphique vit dans le ruban de preuves, dont les cartes sont déplacées par une
 * animation CSS. Un `IntersectionObserver` n'y voit pas passer les cartes de
 * façon fiable — les courbes restaient alors à `pathLength: 0`, c'est-à-dire
 * invisibles, sur un cadre vide.
 */

const W = 420;
const H = 170;
const PAD = { top: 14, right: 8, bottom: 22, left: 8 };
const POINTS = 26;
/** Index où got_the_ref entre en jeu : un bon quart de la courbe reste plat. */
const START_INDEX = 7;

/** Palier plat, puis montée en cloche accélérée — la forme d'un référencement qui prend. */
function series(offset: number) {
  return Array.from({ length: POINTS }, (_, i) => {
    if (i <= START_INDEX) return 0.04 + i * 0.004 + offset * 0.01;
    const p = (i - START_INDEX) / (POINTS - 1 - START_INDEX);
    return 0.05 + Math.pow(p, 1.7) * (0.9 - offset * 0.06);
  });
}

function path(values: number[]) {
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  return values
    .map((v, i) => {
      const x = PAD.left + (i / (values.length - 1)) * innerW;
      const y = PAD.top + innerH - v * innerH;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

const CLICKS = series(0);
const IMPRESSIONS = series(1.4);
const MARKER_X = PAD.left + (START_INDEX / (POINTS - 1)) * (W - PAD.left - PAD.right);

const DATES = ["01/09/25", "01/11/25", "01/01/26", "01/03/26"];

export function GrowthChart({ markerLabel }: { markerLabel: string }) {
  const reduce = useReducedMotion();

  return (
    <div className="relative w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={markerLabel}>
        {/* Lignes de repère horizontales, très discrètes */}
        {[0, 0.25, 0.5, 0.75, 1].map((r) => {
          const y = PAD.top + (H - PAD.top - PAD.bottom) * r;
          return (
            <line
              key={r}
              x1={PAD.left}
              y1={y}
              x2={W - PAD.right}
              y2={y}
              stroke="var(--color-fog)"
              strokeWidth="1"
            />
          );
        })}

        {/* Repère de mise en service */}
        <line
          x1={MARKER_X}
          y1={PAD.top - 4}
          x2={MARKER_X}
          y2={H - PAD.bottom}
          stroke="var(--color-pebble)"
          strokeWidth="1.2"
          strokeDasharray="4 4"
        />

        <motion.path
          d={path(IMPRESSIONS)}
          fill="none"
          stroke="var(--color-ash)"
          strokeWidth="2"
          strokeLinecap="round"
          initial={reduce ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: reduce ? 0 : 1.6, ease: "easeOut" }}
        />
        <motion.path
          d={path(CLICKS)}
          fill="none"
          stroke="var(--color-obsidian)"
          strokeWidth="2.4"
          strokeLinecap="round"
          initial={reduce ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: reduce ? 0 : 1.6, ease: "easeOut", delay: reduce ? 0 : 0.15 }}
        />

        {DATES.map((date, i) => (
          <text
            key={date}
            x={PAD.left + (i / (DATES.length - 1)) * (W - PAD.left - PAD.right)}
            y={H - 6}
            textAnchor={i === 0 ? "start" : i === DATES.length - 1 ? "end" : "middle"}
            fontSize="9"
            fill="var(--color-ash)"
          >
            {date}
          </text>
        ))}
      </svg>

      {/* Étiquette du repère : hors SVG, pour garder le logo net et le texte lisible */}
      <div
        className="absolute top-[18%] flex -translate-x-1/2 flex-col items-center gap-1"
        style={{ left: `${(MARKER_X / W) * 100}%` }}
      >
        <span className="whitespace-nowrap rounded-full bg-obsidian px-2.5 py-1 text-[10px] font-semibold text-white shadow-[var(--shadow-md)]">
          {markerLabel}
        </span>
        <Image
          src="/logo.svg"
          alt=""
          aria-hidden
          width={24}
          height={24}
          className="h-6 w-6 rounded-lg"
        />
      </div>
    </div>
  );
}
