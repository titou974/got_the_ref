"use client";

import Image from "next/image";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { RiStarFill } from "@remixicon/react";
import { writeMapsAdviceAction } from "@/features/dashboard/actions";
import type { GooglePlace, MapsAdvice } from "@/lib/apify/place-types";
import { Badge } from "@/components/tremor/Badge";
import { Card, CardTitle } from "../Card";
import { formatCount, formatRating, photoAt } from "./place-format";

/**
 * Ce que la fiche dit aujourd'hui, ce qu'elle devrait dire.
 *
 * Même grammaire que la page Contenu : l'existant à gauche, la flèche, la
 * proposition à droite. Le client a déjà vu cette forme pour son site ; il n'a
 * pas à en apprendre une seconde pour sa fiche.
 *
 * Une différence, et elle vient de l'objet : sur le site, l'existant est du
 * texte. Sur une fiche Google, l'existant est un objet visuel — la photo, le
 * nom, la note, tous lus ensemble. Le panneau « avant » du bloc titre le montre
 * donc tel quel, photo comprise, parce que c'est ce que le client reconnaît.
 */
export function ListingCompare({
  place,
  advice,
  only,
  bare = false,
}: {
  place: GooglePlace;
  advice: MapsAdvice | null;
  /**
   * Un seul des trois textes. Ils se corrigent à trois endroits différents du
   * back-office Google : chacun est un chantier, et s'ouvre seul.
   */
  only?: "title" | "description" | "about";
  bare?: boolean;
}) {
  const router = useRouter();
  const [isRefreshing, startRefresh] = useTransition();
  const { execute, isPending, result } = useAction(writeMapsAdviceAction, {
    onSuccess: () => startRefresh(() => router.refresh()),
  });

  const working = isPending || isRefreshing;
  const shows = (field: "title" | "description" | "about") => only === undefined || only === field;

  // Le même bouton écrit les trois textes d'un coup. Il suit donc le champ
  // qu'on regarde : ouvert seul sur la description, le client doit pouvoir la
  // faire écrire sans aller la demander ailleurs.
  const writeButton = (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => execute({})}
        disabled={working}
        className="cursor-pointer rounded-pill border border-border bg-surface px-3 py-1.5 text-sm font-medium transition-colors duration-200 hover:bg-mist disabled:cursor-not-allowed disabled:opacity-50"
      >
        {working ? "Rédaction…" : advice ? "Proposer autre chose" : "Proposer des textes"}
      </button>
      {result.serverError ? (
        <span className="max-w-[240px] text-right text-[11px] text-danger">
          {result.serverError}
        </span>
      ) : null}
    </div>
  );

  return (
    <div className={only ? "" : "space-y-4"}>
      {shows("title") ? (
      <Card bare={bare}>
        <CardTitle
          title="Le nom de votre fiche"
          hint={
            advice?.keyword
              ? `Aligné sur « ${advice.keyword} », le mot-clé du titre de votre site.`
              : "Le nom que Google affiche en tête, et sur lequel il vous classe."
          }
          action={writeButton}
        />

        <Compare
          before={<HeaderPreview place={place} title={place.title} />}
          after={
            advice ? <HeaderPreview place={place} title={advice.title} highlight /> : null
          }
          busy={working}
          skeleton={<HeaderSkeleton place={place} />}
        />

        {advice?.reasons[0] ? <Why text={advice.reasons[0]} /> : null}
      </Card>
      ) : null}

      {shows("description") ? (
      <Card bare={bare}>
        <CardTitle
          title="La description courte"
          hint="Les deux lignes sous le nom, dans les résultats et en tête de fiche."
          action={writeButton}
        />
        <Compare
          before={<Prose text={place.description} missing="Aucune description sur la fiche." />}
          after={advice ? <Prose text={advice.description} /> : null}
          busy={working}
          skeleton={<ProseSkeleton lines={3} />}
        />
        {advice?.reasons[1] ? <Why text={advice.reasons[1]} /> : null}
      </Card>
      ) : null}

      {shows("about") ? (
      <Card bare={bare}>
        <CardTitle
          title="La présentation de l'onglet « À propos »"
          hint="Le texte que vous écrivez vous-même dans Google Business Profile."
          action={writeButton}
        />
        <Compare
          before={
            <Prose
              text={place.ownerDescription}
              missing="Vous n'avez pas encore écrit de présentation."
            />
          }
          after={advice ? <Prose text={advice.about} /> : null}
          busy={working}
          skeleton={<ProseSkeleton lines={7} />}
        />
        {advice?.reasons[2] ? <Why text={advice.reasons[2]} /> : null}
      </Card>
      ) : null}
    </div>
  );
}

/**
 * Trois colonnes : avant, pivot, après.
 *
 * Repris de la page Contenu au pixel près, y compris la bascule de la flèche
 * d'un quart de tour quand les colonnes s'empilent. Deux écrans qui montrent le
 * même geste doivent le montrer pareil.
 */
function Compare({
  before,
  after,
  busy,
  skeleton,
}: {
  before: React.ReactNode;
  after: React.ReactNode | null;
  busy: boolean;
  skeleton: React.ReactNode;
}) {
  return (
    <div className="grid items-center gap-3 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:gap-4">
      <Panel tone="before" label="Aujourd'hui">
        {before}
      </Panel>

      <Pivot />

      {busy ? (
        <Panel tone="after" label="Proposé" busy>
          {skeleton}
        </Panel>
      ) : after ? (
        <Panel tone="after" label="Proposé">
          {after}
        </Panel>
      ) : (
        <p className="rounded-2xl border border-dashed border-pebble px-4 py-10 text-center text-sm text-muted">
          Aucune proposition pour l'instant.
        </p>
      )}
    </div>
  );
}

function Panel({
  label,
  tone,
  busy = false,
  children,
}: {
  label: string;
  tone: "before" | "after";
  busy?: boolean;
  children: React.ReactNode;
}) {
  const after = tone === "after";

  return (
    <div
      aria-busy={busy || undefined}
      aria-live={after ? "polite" : undefined}
      className={`rounded-2xl border p-4 ${
        after
          ? "border-obsidian/15 bg-surface shadow-[0_1px_2px_rgba(9,9,11,0.04)]"
          : "border-border bg-mist/60"
      }`}
    >
      <span
        className={`inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] ring-1 ring-inset ${
          after
            ? "bg-success/10 text-success ring-success/25"
            : "bg-warning/10 text-warning ring-warning/25"
        }`}
      >
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
        {label}
      </span>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Pivot() {
  return (
    <div className="flex items-center justify-center gap-2 py-1 lg:h-full lg:flex-col lg:py-6">
      <span
        aria-hidden
        className="h-px flex-1 border-t border-dashed border-pebble lg:h-auto lg:w-px lg:border-l lg:border-t-0"
      />
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border bg-surface">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4 rotate-90 text-steel lg:rotate-0"
          role="img"
          aria-label="devient"
        >
          <path d="M4 12h15" />
          <path d="m13 6 6 6-6 6" />
        </svg>
      </span>
      <span
        aria-hidden
        className="h-px flex-1 border-t border-pebble lg:h-auto lg:w-px lg:border-l lg:border-t-0"
      />
    </div>
  );
}

/**
 * La tête de fiche telle que Google la montre : la photo, le nom, la note.
 *
 * C'est cet objet-là que le client reconnaît, pas une ligne de texte. Le nom
 * proposé s'y substitue au nom actuel, tout le reste inchangé — la comparaison
 * porte sur le nom, et sur rien d'autre.
 */
function HeaderPreview({
  place,
  title,
  highlight = false,
}: {
  place: GooglePlace;
  title: string;
  /** Le nom proposé : mis en avant, pour que l'œil aille droit dessus. */
  highlight?: boolean;
}) {
  const photo = place.images[0] ?? null;

  return (
    <div className="flex gap-3">
      {photo ? (
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl">
          <Image
            src={photoAt(photo, 200, 200)}
            alt=""
            fill
            sizes="64px"
            className="object-cover"
            unoptimized
            referrerPolicy="no-referrer"
          />
        </div>
      ) : (
        <div className="h-16 w-16 shrink-0 rounded-xl bg-mist" />
      )}

      <div className="min-w-0">
        <p
          className={`text-sm leading-snug ${
            highlight ? "font-semibold text-text" : "font-medium text-text"
          }`}
        >
          {title}
        </p>
        <p className="mt-1 flex items-center gap-1 text-xs text-muted">
          {place.rating !== null ? (
            <>
              <span className="tabular-nums">{formatRating(place.rating)}</span>
              <RiStarFill size={11} className="text-[#e7711b]" />
              <span>({formatCount(place.reviewsCount)})</span>
              <span>·</span>
            </>
          ) : null}
          <span className="truncate">{place.category ?? "Établissement"}</span>
        </p>
        <p className="mt-0.5 truncate text-xs text-ash">{place.address}</p>
      </div>
    </div>
  );
}

function HeaderSkeleton({ place }: { place: GooglePlace }) {
  return (
    <div className="flex gap-3">
      <div className="h-16 w-16 shrink-0 rounded-xl bg-mist" />
      <div className="min-w-0 flex-1 space-y-2 pt-1">
        <span className="block h-4 w-4/5 rounded-full shimmer" />
        <span className="block h-3 w-1/2 rounded-full bg-mist" />
        <p className="truncate text-xs text-ash">{place.address}</p>
      </div>
    </div>
  );
}

/** Un texte de fiche, ou la phrase qui dit qu'il n'y en a pas. */
function Prose({ text, missing }: { text: string | null; missing?: string }) {
  if (!text) {
    return <p className="text-sm italic text-muted">{missing ?? "Aucun texte."}</p>;
  }

  return (
    <div className="space-y-2">
      {text.split(/\n{2,}/).map((paragraph, index) => (
        <p key={index} className="text-sm leading-relaxed">
          {paragraph}
        </p>
      ))}
      <p className="pt-1 text-[11px] tabular-nums text-ash">{text.length} signes</p>
    </div>
  );
}

function ProseSkeleton({ lines }: { lines: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }, (_, index) => (
        <span
          key={index}
          className="block h-3 rounded-full shimmer"
          style={{ width: index === lines - 1 ? "60%" : "100%" }}
        />
      ))}
    </div>
  );
}

/** Ce que le changement rapporte, sous la comparaison. */
function Why({ text }: { text: string }) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border pt-4">
      <Badge variant="neutral">Ce que ça change</Badge>
      <span className="min-w-0 flex-1 text-sm text-muted">{text}</span>
    </div>
  );
}
