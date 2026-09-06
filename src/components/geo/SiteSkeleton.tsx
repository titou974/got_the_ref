"use client";

import { useState } from "react";
import Link from "next/link";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { applyStructureAction } from "@/features/dashboard/actions";
import { ROUTES } from "@/constants/routes";
import { StackMark } from "@/components/StackMark";
import type { DetectedStack } from "@/lib/geo/types";
import type { SiteNode, SiteNodeStatus, SiteTree } from "@/lib/geo/site-tree";

/**
 * Le squelette du site : ce que les moteurs de réponse cherchent à la racine,
 * et ce qu'ils n'y trouvent pas.
 *
 * La carte porte tout le geste d'un bout à l'autre — la plateforme qui sert le
 * site, les fichiers relevés, et le bouton qui dépose ceux qui manquent. C'est
 * volontaire : l'écran disait jusqu'ici « données structurées : absentes » sans
 * jamais dire où le fichier devait aller ni qui l'y mettrait, et le client
 * repartait avec un constat plutôt qu'un correctif.
 *
 * L'arborescence est la seule liberté prise sur la sobriété du tableau de bord.
 * Elle est tenue : pastilles monospace, filets d'indentation, et le rouge tramé
 * réservé aux lignes qui n'existent pas. Tout le reste de la page reste plat.
 */

const TONE: Record<
  Exclude<SiteNodeStatus, "root">,
  { label: string; color: string; row: string; glyph: string; border: string }
> = {
  ok: {
    label: "Présent",
    color: "#11b48c",
    row: "",
    glyph: "bg-mist text-steel",
    border: "border border-fog",
  },
  warn: {
    label: "À corriger",
    color: "#d97706",
    row: "bg-warning/5",
    glyph: "bg-warning/10 text-warning",
    border: "border border-warning/30",
  },
  missing: {
    label: "Absent",
    color: "#dc2626",
    row: "bg-danger/[0.04]",
    glyph: "bg-danger/10 text-danger",
    // Le trait tramé dit l'absence avant même qu'on lise l'étiquette.
    border: "border border-dashed border-danger/45",
  },
};

/**
 * Le statut d'une étape de dépôt, lu sur l'action plutôt qu'importé de
 * `site-sync` : ce module est `server-only`, et un composant client n'a pas à
 * en dépendre, fût-ce pour un type. La dérivation garde le lien — l'union
 * change, ces deux tables cessent de compiler.
 */
type StepStatus = NonNullable<
  Awaited<ReturnType<typeof applyStructureAction>>["data"]
>["steps"][number]["status"];

/**
 * Le compte rendu du dépôt, dans le vocabulaire du connecteur.
 *
 * « À faire à la main » n'est pas un échec : c'est le cas normal chez les
 * plateformes qui ferment leur racine — Shopify, WordPress. Le dire autrement
 * ferait lire un refus de la plateforme comme une panne du produit.
 */
const STEP_LABEL: Record<StepStatus, string> = {
  applied: "Déposé",
  manual: "À faire à la main",
  failed: "Refusé",
  skipped: "Déjà en place",
};

const STEP_DOT: Record<StepStatus, string> = {
  applied: "bg-success",
  manual: "bg-warning",
  failed: "bg-danger",
  skipped: "bg-pebble",
};

export function SiteSkeleton({
  tree,
  stack,
  pagesCrawled,
  /** Le site est rattaché et le connecteur sait écrire : le dépôt est possible. */
  canApply,
  /**
   * L'offre n'ouvre pas la page : l'arbre se montre, le pied de carte se tait.
   *
   * Les lignes à corriger arrivent alors déjà masquées du serveur (cf.
   * `veilSiteTree`) et se floutent ici ; le dépôt et les contenus proposés
   * disparaissent, puisqu'il n'y a rien à déposer ni à lire. L'appel vers les
   * tarifs est posé sous la carte par le voile qui l'enveloppe, pas ici : une
   * carte ne vend pas, elle montre.
   */
  locked = false,
}: {
  tree: SiteTree;
  stack: DetectedStack | null;
  pagesCrawled: number;
  canApply: boolean;
  locked?: boolean;
}) {
  const router = useRouter();
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const { execute, isPending, result, reset } = useAction(applyStructureAction, {
    onSuccess: () => router.refresh(),
  });

  const steps = result.data?.steps ?? [];

  return (
    <section className="overflow-hidden rounded-[28px] border border-border bg-surface">
      <header className="flex flex-wrap items-center gap-x-6 gap-y-5 border-b border-fog bg-mist/60 p-5 sm:px-7 sm:py-6">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-[20px] bg-obsidian text-white">
          {stack ? <StackMark id={stack.id} size={26} /> : <UnknownStackMark />}
        </span>

        <div className="min-w-0 flex-1 basis-64">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-steel">
            Technologie de site détectée
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span className="text-[28px] font-bold leading-none tracking-tight">
              {stack ? stack.name : "Non identifiée"}
            </span>
            {stack ? (
              <span
                className="rounded-pill px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                style={
                  stack.confidence === "sure"
                    ? { background: "rgba(17,180,140,0.18)", color: "#0a8f6e" }
                    : { background: "rgba(148,163,184,0.18)", color: "#52525b" }
                }
              >
                {stack.confidence === "sure" ? "Détecté" : "Probable"}
              </span>
            ) : null}
          </div>
          <p className="mt-2 max-w-[62ch] text-pretty text-[13px] text-muted">
            {stack
              ? `Reconnu à ${stack.evidence}. La plateforme décide de l'endroit où se posent les correctifs : un llms.txt, un schéma ou une balise ne s'ajoutent pas au même endroit sur chacune.`
              : "Le site ne laisse aucune empreinte publique reconnaissable. Les fichiers ci-dessous restent à déposer à la main, avec le contenu proposé."}
          </p>
        </div>

        <dl className="flex shrink-0 gap-7">
          <Tally label="Manquant" value={tree.missingCount} color="text-danger" />
          <Tally label="À corriger" value={tree.warnCount} color="text-warning" />
          <Tally label="En place" value={tree.okCount} color="text-success" />
        </dl>
      </header>

      <div className="flex flex-wrap items-end justify-between gap-3 px-5 pb-2 pt-5 sm:px-7">
        <div>
          <h2 className="text-base font-semibold">Squelette du site</h2>
          <p className="mt-0.5 text-[13px] text-muted">
            Ce que les moteurs de réponse cherchent à la racine, et ce qu&apos;ils n&apos;y trouvent
            pas.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-mist px-3 py-1 text-[11px] font-semibold text-slate">
          <span aria-hidden className="size-1.5 rounded-full bg-success" />
          Relevé sur {pagesCrawled} page{pagesCrawled > 1 ? "s" : ""} lue
          {pagesCrawled > 1 ? "s" : ""}
        </span>
      </div>

      <ul className="px-2 pb-2 sm:px-4">
        {tree.nodes.map((node) => (
          <TreeRow
            key={node.key}
            node={node}
            open={!node.veiled && (showAll || openKey === node.key)}
            onToggle={() => setOpenKey((current) => (current === node.key ? null : node.key))}
          />
        ))}
      </ul>

      {tree.hasFixes && !locked ? (
        <footer className="mt-2 border-t border-fog px-5 py-5 sm:px-7">
          <div className="flex flex-wrap items-center gap-3">
            <p className="min-w-60 flex-1 text-pretty text-[13px] text-muted">
              Les fichiers manquants sont déjà rédigés avec les faits relevés sur votre site — nom,
              niche, ville, horaires.
              {canApply
                ? ` Les agents peuvent les déposer sur ${stack?.name ?? "votre site"}.`
                : " Rattachez le site pour qu'ils s'y déposent tout seuls."}
            </p>

            {canApply ? (
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  reset();
                  execute({});
                }}
                className="inline-flex cursor-pointer items-center gap-2 rounded-pill bg-obsidian px-4.5 py-2.5 text-[13px] font-semibold text-white transition-colors duration-200 hover:bg-ink disabled:opacity-60"
              >
                {isPending ? (
                  <span
                    aria-hidden
                    className="size-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white"
                  />
                ) : null}
                {isPending ? "Dépôt en cours…" : "Déposer les fichiers manquants"}
              </button>
            ) : (
              <Link
                href={ROUTES.dashboardSettings}
                className="inline-flex items-center rounded-pill bg-obsidian px-4.5 py-2.5 text-[13px] font-semibold text-white transition-colors duration-200 hover:bg-ink"
              >
                Rattacher le site
              </Link>
            )}

            <button
              type="button"
              onClick={() => {
                setShowAll((current) => !current);
                setOpenKey(null);
              }}
              className="inline-flex cursor-pointer items-center rounded-pill border border-border bg-surface px-4 py-2.5 text-[13px] font-semibold transition-colors duration-200 hover:bg-mist"
            >
              {showAll ? "Masquer les contenus" : "Voir les contenus proposés"}
            </button>
          </div>

          {result.serverError ? (
            <p className="mt-3 text-[13px] text-danger">{result.serverError}</p>
          ) : null}

          {steps.length ? (
            <>
              <ul className="mt-4 space-y-2 border-t border-fog pt-4">
                {steps.map((step) => (
                  <li key={step.key} className="flex items-start gap-2.5 text-[13px]">
                    <span
                      aria-hidden
                      className={`mt-1.5 size-1.5 shrink-0 rounded-full ${STEP_DOT[step.status]}`}
                    />
                    <span className="text-muted">
                      <span className="font-semibold text-text">{STEP_LABEL[step.status]}</span> —{" "}
                      {step.detail}
                    </span>
                  </li>
                ))}
              </ul>
              {steps.some((step) => step.status === "manual") ? (
                <p className="mt-3 text-[13px] text-muted">
                  Ce que la plateforme n&apos;écrit pas se dépose à la main : ouvrez « Voir les
                  contenus proposés » et copiez le fichier tel quel.
                </p>
              ) : null}
            </>
          ) : null}
        </footer>
      ) : null}
    </section>
  );
}

function Tally({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-steel">{label}</dt>
      <dd className={`mt-1 text-2xl font-bold tabular-nums ${color}`}>{value}</dd>
    </div>
  );
}

/**
 * Une ligne de l'arborescence. Elle ne devient cliquable que si elle porte un
 * contenu à montrer : un fichier présent n'a rien à déplier.
 */
function TreeRow({
  node,
  open,
  onToggle,
}: {
  node: SiteNode;
  open: boolean;
  onToggle: () => void;
}) {
  if (node.status === "root") {
    return (
      <li className="flex items-center gap-2.5 px-2.5 py-2">
        <span aria-hidden className="text-ash">
          ▸
        </span>
        <span className="font-mono text-[13px] font-bold text-obsidian">{node.name}</span>
        <span className="truncate text-xs text-ash">{node.note}</span>
      </li>
    );
  }

  const tone = TONE[node.status];
  const expandable = Boolean(node.fix) && !node.veiled;
  // Le flou ne cache rien qui soit là : le nom et le relevé ont été retirés au
  // serveur. Il dit seulement, à l'œil, que cette ligne-là se paie.
  const veil = node.veiled ? "select-none blur-[5px]" : "";

  return (
    <li>
      <div className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 ${tone.row}`}>
        {/* Le filet d'indentation : il descend de la ligne parente jusqu'à la
            pastille, et sa longueur porte à elle seule la profondeur. */}
        <span
          aria-hidden
          className="ml-2.5 block h-6 shrink-0 border-l border-fog"
          style={{ width: `${(node.depth - 1) * 20 + 10}px` }}
        />
        <span
          aria-hidden
          className={`flex h-[22px] w-[26px] shrink-0 items-center justify-center rounded-[7px] font-mono text-[9px] font-bold ${tone.glyph} ${tone.border} ${veil}`}
        >
          {node.glyph}
        </span>

        <span
          aria-hidden={node.veiled || undefined}
          className={`shrink-0 font-mono text-[13px] ${veil} ${
            node.status === "missing" ? "font-semibold text-text" : "text-graphite"
          }`}
        >
          {node.name}
        </span>
        {node.veiled ? <span className="sr-only">Ligne réservée au Coup de Boost</span> : null}
        {/* La note est le premier élément sacrifié quand la ligne se resserre :
            le nom du fichier et son état suffisent à la lire. */}
        <span className="hidden truncate text-xs text-ash sm:block">{node.note}</span>

        <span className="flex-1" />

        <span
          className="shrink-0 rounded-pill px-2.5 py-0.5 text-[10px] font-semibold"
          style={{ background: `${tone.color}22`, color: tone.color }}
        >
          {tone.label}
        </span>

        {expandable ? (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            className="shrink-0 cursor-pointer rounded-pill border border-border bg-surface px-2.5 py-1 text-[11px] font-semibold transition-colors duration-200 hover:bg-mist"
          >
            {open ? "Masquer" : "Voir"}
            <span className="hidden sm:inline">{open ? "" : " le contenu"}</span>
          </button>
        ) : null}
      </div>

      {open && node.fix ? (
        <pre className="mb-2 ml-12 max-h-64 overflow-auto whitespace-pre-wrap border-l-2 border-fog py-1.5 pl-3 font-mono text-[11px] leading-relaxed text-steel">
          {node.fix.content}
        </pre>
      ) : null}
    </li>
  );
}

/** Marque de repli quand aucune plateforme n'est reconnue. */
function UnknownStackMark() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7h16M4 12h16M4 17h10"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
