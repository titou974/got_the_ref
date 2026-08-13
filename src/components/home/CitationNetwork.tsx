"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { PLATFORMS } from "@/constants/platforms";
import { ROUTES } from "@/constants/routes";

/**
 * La constellation : chaque point est un site du réseau, chaque trait une
 * citation. Les traits sont pointillés et défilent lentement — on voit le
 * maillage circuler plutôt qu'un schéma figé — et quelques nœuds pulsent à tour
 * de rôle, comme autant de citations qui viennent d'être posées.
 *
 * Positions et liens sont calculés une fois, en dur : aucune simulation de
 * forces, donc aucun coût au rendu et un dessin identique à chaque visite.
 */

const SIZE = 340;
const CENTER = SIZE / 2;
const NODE_COUNT = 16;

/** Deux couronnes légèrement irrégulières : le nuage respire, sans désordre. */
const NODES = Array.from({ length: NODE_COUNT }, (_, i) => {
  const angle = (i / NODE_COUNT) * Math.PI * 2 - Math.PI / 2;
  const radius = i % 2 === 0 ? 138 : 96;
  const jitter = ((i * 37) % 11) - 5;
  return {
    x: CENTER + Math.cos(angle) * (radius + jitter),
    y: CENTER + Math.sin(angle) * (radius + jitter),
    /** Un nœud sur trois porte un logo de plateforme, les autres restent des points. */
    platform: i % 3 === 0 ? PLATFORMS[(i / 3) % PLATFORMS.length] : null,
    pulses: i % 5 === 1,
  };
});

/** Chaque nœud est relié à deux voisins distants : le motif en étoile de BLG. */
const EDGES = NODES.flatMap((node, i) =>
  [5, 7].map((step) => {
    const target = NODES[(i + step) % NODE_COUNT];
    return { x1: node.x, y1: node.y, x2: target.x, y2: target.y, key: `${i}-${step}` };
  }),
);

export function CitationNetwork() {
  const t = useTranslations("network");
  const reduce = useReducedMotion();
  const bullets = t.raw("bullets") as string[];

  return (
    <section className="mx-auto w-full max-w-6xl px-5 py-16 sm:py-20">
      <p className="text-xs font-semibold uppercase tracking-wider text-steel">{t("eyebrow")}</p>
      <h2 className="mt-3 max-w-3xl text-balance text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
        {t("titleStrong")} <span className="text-gradient">{t("titleMuted")}</span>
      </h2>

      <div className="mt-10 grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-14">
        <div>
          <h3 className="text-xl font-bold">{t("listTitle")}</h3>
          <ul className="mt-5 space-y-3">
            {bullets.map((bullet, i) => (
              <motion.li
                key={bullet}
                initial={{ opacity: 0, x: -8 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.6 }}
                transition={{ delay: reduce ? 0 : i * 0.1, duration: 0.32, ease: "easeOut" }}
                className="flex items-start gap-2.5 text-sm text-graphite"
              >
                <span className="mt-0.5 shrink-0 text-obsidian" aria-hidden>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 3l7 3v5.5c0 4.2-2.9 7.9-7 9.5-4.1-1.6-7-5.3-7-9.5V6l7-3Z"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinejoin="round"
                    />
                    <path
                      d="m9 12 2 2 4-4"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                {bullet}
              </motion.li>
            ))}
          </ul>

          <Link
            href={ROUTES.demo}
            className="mt-7 inline-flex cursor-pointer items-center gap-2 rounded-full bg-cta px-6 py-3.5 text-sm font-medium text-white shadow-[var(--shadow-pill)] transition-colors duration-200 hover:bg-cta-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40"
          >
            {t("cta")}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M5 12h14M13 6l6 6-6 6"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>

          <p className="mt-5 max-w-sm text-xs text-ash">{t("note")}</p>
        </div>

        {/* La constellation */}
        <div className="relative mx-auto w-full max-w-[380px]">
          <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full" aria-hidden>
            {EDGES.map((edge) => (
              <line
                key={edge.key}
                x1={edge.x1}
                y1={edge.y1}
                x2={edge.x2}
                y2={edge.y2}
                stroke="var(--color-pebble)"
                strokeWidth="0.9"
                className={reduce ? undefined : "net-edge"}
              />
            ))}
            {NODES.map((node, i) => (
              <line
                key={`c-${i}`}
                x1={CENTER}
                y1={CENTER}
                x2={node.x}
                y2={node.y}
                stroke="var(--color-fog)"
                strokeWidth="0.9"
              />
            ))}
          </svg>

          {/* Nœuds posés en absolu : les logos restent nets, jamais mis à l'échelle par le SVG. */}
          {NODES.map((node, i) => (
            <motion.div
              key={i}
              className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center"
              style={{ left: `${(node.x / SIZE) * 100}%`, top: `${(node.y / SIZE) * 100}%` }}
              animate={
                reduce || !node.pulses ? undefined : { scale: [1, 1.14, 1], opacity: [1, 0.85, 1] }
              }
              transition={{ duration: 2.8, repeat: Infinity, delay: i * 0.35, ease: "easeInOut" }}
            >
              {node.platform ? (
                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-fog bg-snow shadow-[var(--shadow-md)]">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill={node.platform.color} aria-hidden>
                    <path d={node.platform.path} />
                  </svg>
                </span>
              ) : (
                <span className="h-2.5 w-2.5 rounded-full bg-pebble" aria-hidden />
              )}
            </motion.div>
          ))}

          {/* Centre : got_the_ref, le point qui tient le maillage. */}
          <div className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl border border-fog bg-snow shadow-[var(--shadow-md)]">
            <Image src="/logo.svg" alt="" aria-hidden width={36} height={36} className="h-9 w-9 rounded-xl" />
          </div>
        </div>
      </div>
    </section>
  );
}
