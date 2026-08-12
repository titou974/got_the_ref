"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { type Segment, segmentsText } from "@/lib/rich-text";
import aiAssistant from "@/lottie/ai-assistant.json";

// lottie-react touche à `window` → chargé côté client uniquement.
const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

/**
 * Rendu « aperçu IA » d'un texte d'analyse : en-tête signé, paragraphes,
 * intertitres, puces et pastilles de source — et la frappe progressive qui
 * donne à lire le constat comme si l'agent l'écrivait à l'instant.
 *
 * Le corps animé est masqué aux technologies d'assistance (`aria-hidden`) et
 * doublé d'une version complète en `sr-only` : un lecteur d'écran reçoit le
 * texte entier d'un coup, sans subir la frappe caractère par caractère.
 */

export type OverviewBlock =
  | { kind: "paragraph"; segments: Segment[] }
  | { kind: "heading"; text: string }
  | { kind: "bullet"; icon: BulletIcon; segments: Segment[] }
  | { kind: "chip"; text: string };

export type BulletIcon = "check" | "cross" | "dot";

/** Nombre de caractères à « taper » pour un bloc (les pastilles sont instantanées). */
function blockLength(b: OverviewBlock): number {
  switch (b.kind) {
    case "paragraph":
    case "bullet":
      return segmentsText(b.segments).length;
    case "heading":
      return b.text.length;
    case "chip":
      return 0;
  }
}

function blockText(b: OverviewBlock): string {
  return b.kind === "chip" ? b.text : b.kind === "heading" ? b.text : segmentsText(b.segments);
}

/** Coupe une suite de segments à `count` caractères, marqueurs conservés. */
function sliceSegments(segments: Segment[], count: number): Segment[] {
  const out: Segment[] = [];
  let left = count;
  for (const s of segments) {
    if (left <= 0) break;
    out.push(left >= s.text.length ? s : { ...s, text: s.text.slice(0, left) });
    left -= s.text.length;
  }
  return out;
}

function Segments({ segments }: { segments: Segment[] }) {
  return (
    <>
      {segments.map((s, i) => {
        if (s.mark === "bold") {
          return (
            <strong key={i} className="font-semibold text-text">
              {s.text}
            </strong>
          );
        }
        if (s.mark === "highlight") {
          return (
            <mark key={i} className="rounded-[3px] bg-highlight px-0.5 font-medium text-text">
              {s.text}
            </mark>
          );
        }
        return <span key={i}>{s.text}</span>;
      })}
    </>
  );
}

/** Puce de constat : les icônes 3D pour l'acquis et le manque, un point sinon. */
function BulletMark({ icon }: { icon: BulletIcon }) {
  if (icon === "dot") {
    return <span aria-hidden className="mt-[0.45rem] h-1.5 w-1.5 shrink-0 rounded-full bg-pebble" />;
  }
  const src = icon === "check" ? "/check-3d.png" : "/cross-3d.png";
  return (
    <Image
      src={src}
      alt=""
      aria-hidden
      width={40}
      height={32}
      className="mt-0.5 h-4 w-4 shrink-0 object-contain"
    />
  );
}

/** Curseur de frappe, posé à la fin du dernier bloc en cours d'écriture. */
function Caret() {
  return (
    <span
      aria-hidden
      className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[0.15em] bg-obsidian align-baseline"
      style={{ animation: "blink 1s steps(2, start) infinite" }}
    />
  );
}

export function AiOverview({
  headline,
  blocks,
  cta,
  ctaHref,
}: {
  /** Titre du constat : posé d'emblée, il annonce ce que la frappe va dérouler. */
  headline: string;
  blocks: OverviewBlock[];
  /** Appel à l'action final. Omis sur un rapport déjà ouvert : rien à débloquer. */
  cta?: string;
  ctaHref?: string;
}) {
  const lengths = useMemo(() => blocks.map(blockLength), [blocks]);
  const offsets = useMemo(() => {
    const acc: number[] = [];
    let sum = 0;
    for (const l of lengths) {
      acc.push(sum);
      sum += l;
    }
    return acc;
  }, [lengths]);
  const total = lengths.reduce((a, b) => a + b, 0);

  const [revealed, setRevealed] = useState(0);

  useEffect(() => {
    if (total === 0) return;

    // ~7 ms par caractère, bornée : assez vif pour ne pas faire attendre, assez
    // lent pour qu'on voie l'agent écrire. Mouvement réduit demandé : durée
    // nulle, la première image affiche tout — un seul chemin de code, plutôt
    // qu'un `setState` posé directement dans l'effet.
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reduced ? 0 : Math.min(11000, Math.max(3500, total * 7));

    let raf = 0;
    let startedAt: number | null = null;
    const tick = (ts: number) => {
      startedAt ??= ts;
      const progress = duration === 0 ? 1 : (ts - startedAt) / duration;
      setRevealed(Math.min(total, Math.round(progress * total)));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [total]);

  const done = revealed >= total;
  // Dernier bloc entamé : c'est lui qui porte le curseur.
  const writingIndex = blocks.findIndex((_, i) => revealed < offsets[i] + lengths[i]);

  return (
    <section className="rounded-[36px] border border-fog bg-snow p-6 shadow-[var(--shadow-md)] sm:p-8">
      <OverviewHeader />

      <h2 className="mt-5 text-balance text-xl font-bold sm:text-2xl">{headline}</h2>

      {/* Corps animé : décoratif pour l'assistance, doublé en sr-only plus bas. */}
      <div aria-hidden className="mt-4 space-y-3.5">
        {blocks.map((b, i) => {
          const shown = Math.min(lengths[i], Math.max(0, revealed - offsets[i]));
          // Un bloc pas encore entamé n'occupe pas de place : la carte s'écrit.
          // Une pastille ne se tape pas : elle apparaît dès que le bloc qui la
          // précède est écrit (sa longueur étant nulle, `shown` reste à zéro).
          if (shown <= 0 && !(b.kind === "chip" && revealed >= offsets[i])) return null;
          const caret = !done && i === writingIndex ? <Caret /> : null;

          if (b.kind === "heading") {
            return (
              <h3 key={i} className="pt-2 text-base font-bold text-text sm:text-lg">
                {b.text.slice(0, shown)}
                {caret}
              </h3>
            );
          }
          if (b.kind === "chip") {
            return <SourceChip key={i} text={b.text} />;
          }
          if (b.kind === "bullet") {
            return (
              <div key={i} className="flex items-start gap-2.5 text-sm leading-relaxed text-muted">
                <BulletMark icon={b.icon} />
                <p className="min-w-0">
                  <Segments segments={sliceSegments(b.segments, shown)} />
                  {caret}
                </p>
              </div>
            );
          }
          return (
            <p key={i} className="max-w-3xl text-pretty text-sm leading-relaxed text-muted">
              <Segments segments={sliceSegments(b.segments, shown)} />
              {caret}
            </p>
          );
        })}
      </div>

      {/* Version intégrale, hors flux visuel, pour les lecteurs d'écran. */}
      <div className="sr-only">
        {blocks.map((b, i) => (
          <p key={i}>{blockText(b)}</p>
        ))}
      </div>

      {cta && ctaHref && (
        <Link
          href={ctaHref}
          className={`mt-6 inline-flex cursor-pointer items-center justify-center gap-2 rounded-full bg-cta px-6 py-3 text-sm font-medium text-white shadow-[var(--shadow-pill)] transition-opacity duration-500 hover:bg-cta-hover ${
            done ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          {cta}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      )}
    </section>
  );
}

/** En-tête signé : l'agent animé, la marque, et les moteurs consultés. */
function OverviewHeader() {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <span className="h-8 w-8 shrink-0" aria-hidden>
          <Lottie animationData={aiAssistant} loop autoplay className="h-full w-full" />
        </span>
        <span className="text-base font-semibold text-text">got_the_ref</span>
      </div>
      <div className="flex items-center">
        {["/chatgpt.png", "/gemini.webp"].map((src, i) => (
          <Image
            key={src}
            src={src}
            alt=""
            aria-hidden
            width={24}
            height={24}
            className={`h-6 w-6 rounded-full border border-fog bg-snow object-contain p-0.5 ${
              i > 0 ? "-ml-2" : ""
            }`}
          />
        ))}
      </div>
    </div>
  );
}

/** Pastille de source, à la manière des références d'un aperçu IA. */
function SourceChip({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-mist px-2.5 py-1 text-[11px] font-medium text-steel">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M12 3l1.9 4.6 4.6 1.9-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3Z" fill="currentColor" />
      </svg>
      {text}
    </span>
  );
}
