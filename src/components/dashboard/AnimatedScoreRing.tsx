"use client";

import { useEffect } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { scoreColor } from "@/lib/score";

/** Jauge circulaire avec compteur animé et tracé progressif (style cal.com). */
export function AnimatedScoreRing({
  score,
  size = 180,
  sizeSm,
  stroke = 14,
  label,
  trackColor = "rgba(9,9,11,0.08)",
  labelClassName = "text-muted",
}: {
  score: number;
  size?: number;
  /**
   * Diamètre sous le point de rupture `sm`. Par défaut identique à `size`.
   * Appliqué en CSS (classe `.score-ring`, cf. globals.css) plutôt qu'en
   * mesurant la fenêtre : pas de JS, donc pas d'écart d'hydratation ni de
   * premier rendu à la mauvaise taille.
   */
  sizeSm?: number;
  stroke?: number;
  label?: string;
  /** Couleur de l'anneau de fond (à éclaircir sur fond sombre). */
  trackColor?: string;
  /** Classe du libellé sous le score (à éclaircir sur fond sombre). */
  labelClassName?: string;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const color = scoreColor(score);

  const count = useMotionValue(0);
  const rounded = useTransform(count, (v) => Math.round(v));
  const dashoffset = useTransform(count, (v) => circumference * (1 - v / 100));

  useEffect(() => {
    const controls = animate(count, score, { duration: 1.2, ease: "easeOut" });
    return () => controls.stop();
  }, [score, count]);

  return (
    <div
      className="score-ring relative inline-flex shrink-0 items-center justify-center"
      style={
        {
          "--ring": `${size}px`,
          "--ring-sm": `${sizeSm ?? size}px`,
        } as React.CSSProperties
      }
    >
      {/* Tracé en viewBox : l'anneau suit la largeur imposée par `.score-ring`. */}
      <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          style={{ strokeDashoffset: dashoffset, filter: `drop-shadow(0 0 6px ${color}66)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span className="font-display text-3xl font-bold sm:text-4xl" style={{ color }}>
          {rounded}
        </motion.span>
        {label && <span className={`mt-0.5 text-xs ${labelClassName}`}>{label}</span>}
      </div>
    </div>
  );
}
