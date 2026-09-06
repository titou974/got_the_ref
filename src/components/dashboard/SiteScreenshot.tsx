"use client";

import { useEffect, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { StackBadge } from "@/components/StackMark";
import type { DetectedStack } from "@/lib/geo/types";

/** Aperçu de secours (WordPress mShots, gratuit et sans clé) si ApiFlash échoue. */
function mshots(url: string) {
  return `https://s.wordpress.com/mshots/v1/${encodeURIComponent(url)}?w=1280&h=800`;
}

/**
 * Capture d'écran paysage du site (ou de la fiche Google Maps) audité,
 * encadrée comme une fenêtre de navigateur. L'image est générée à la volée
 * via ApiFlash, servie par la route proxy `/api/screenshot` (la clé reste
 * côté serveur). Si ApiFlash échoue, on retombe sur l'aperçu WordPress mShots.
 * Un shimmer occupe le cadre pendant le chargement, puis l'image apparaît en fondu.
 */
export function SiteScreenshot({
  url,
  domain,
  variant = "site",
  label,
  stack = null,
  children,
}: {
  url: string;
  /** Affiché dans la barre d'adresse (site) — ignoré pour la variante maps. */
  domain?: string;
  variant?: "site" | "maps";
  /** Légende de la barre pour la variante maps (ex. nom de la fiche). */
  label?: string;
  /** Plateforme reconnue : affichée dans la barre du navigateur, à droite. */
  stack?: DetectedStack | null;
  /** Contenu superposé, centré sur la capture assombrie (ex. note globale). */
  children?: ReactNode;
}) {
  const t = useTranslations("analysisReport.stack");
  const [loaded, setLoaded] = useState(false);
  const [src, setSrc] = useState(
    `/api/screenshot?url=${encodeURIComponent(url)}`,
  );
  const isMaps = variant === "maps";
  const hasOverlay = Boolean(children);

  // Même filet que dans AnimatedCard : la figure porte le CTA superposé, elle ne
  // doit jamais rester transparente si l'IntersectionObserver ne répond pas.
  const [forceVisible, setForceVisible] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setForceVisible(true), 1200);
    return () => clearTimeout(id);
  }, []);

  return (
    <motion.figure
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      animate={forceVisible ? { opacity: 1, y: 0 } : undefined}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="overflow-hidden rounded-[36px] border border-fog bg-snow shadow-[var(--shadow-md)] max-w-2xl mx-auto"
    >
      {/* Chrome de fenêtre */}
      <div className="flex items-center gap-3 border-b border-fog bg-mist px-4 py-3">
        {isMaps ? (
          <span
            className="inline-flex items-center gap-1.5 text-obsidian"
            aria-hidden
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 21s-7-6.3-7-11a7 7 0 1 1 14 0c0 4.7-7 11-7 11Z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
              <circle
                cx="12"
                cy="10"
                r="2.4"
                stroke="currentColor"
                strokeWidth="1.6"
              />
            </svg>
          </span>
        ) : (
          <span className="flex shrink-0 gap-1.5" aria-hidden>
            <span className="h-2.5 w-2.5 rounded-full bg-pebble" />
            <span className="h-2.5 w-2.5 rounded-full bg-pebble" />
            <span className="h-2.5 w-2.5 rounded-full bg-pebble" />
          </span>
        )}
        <span className="min-w-0 flex-1 truncate rounded-full border border-fog bg-snow px-3 py-1 text-xs text-steel">
          {isMaps ? (label ?? "Google Maps") : (domain ?? url)}
        </span>
        {/* Plateforme du site, lue pendant le crawl : elle appartient à la
            fenêtre du navigateur autant que l'adresse. */}
        {!isMaps && stack && (
          <StackBadge stack={stack} probableLabel={t("probableShort")} />
        )}
      </div>

      {/* Capture. Avec contenu superposé, le cadre est un conteneur flex dont la
          hauteur minimale ne fait que garantir une belle proportion : le contenu
          reste dans le flux et peut donc le faire grandir. En le positionnant en
          absolu, tout ce qui dépassait de `min-h` sortait du cadre — sur mobile,
          le titre, la ligne de méta et le verdict passaient sous la découpe. */}
      <div
        className={`relative w-full bg-mist ${
          hasOverlay
            ? "flex min-h-[300px] flex-col sm:min-h-[420px]"
            : "aspect-[16/10]"
        }`}
      >
        {!loaded && <div className="shimmer absolute inset-0" aria-hidden />}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={
            isMaps
              ? `Aperçu de la fiche Google Maps ${label ?? ""}`.trim()
              : `Aperçu du site ${domain ?? url}`
          }
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => {
            // ApiFlash indisponible : on bascule une fois sur l'aperçu mShots.
            const fallback = mshots(url);
            if (src !== fallback) setSrc(fallback);
          }}
          className={`absolute inset-0 h-full w-full object-cover object-top transition-opacity duration-500 ${
            loaded ? "opacity-100" : "opacity-0"
          }`}
        />

        {hasOverlay && (
          <>
            {/* Filtre noir pour faire ressortir le contenu superposé */}
            <div
              className="pointer-events-none absolute inset-0 bg-black/65"
              aria-hidden
            />
            {/* Le contenu superposé reste dans le flux, en enfant flex qui
                occupe la place restante. Posé en absolu, il était centré dans
                un cadre de 300 px de haut et tout ce qui dépassait sortait par
                le haut et par le bas — sur téléphone, l'anneau de note mordait
                sur la barre du navigateur et le verdict passait sous la
                découpe. En flux, c'est lui qui fait grandir le cadre. */}
            <div className="relative flex w-full flex-1 flex-col items-center justify-center gap-4 px-5 py-7 text-center sm:gap-5 sm:px-6 sm:py-8">
              {children}
            </div>
          </>
        )}
      </div>
    </motion.figure>
  );
}
