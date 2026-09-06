"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useTranslations } from "next-intl";
import { motion, useReducedMotion } from "framer-motion";
import {
  approveArticleAction,
  publishArticleAction,
  unapproveArticleAction,
} from "@/features/dashboard/actions";
import {
  formatPublishDate,
  formatPublishTime,
  preferredPassOnDay,
  splitPublishInstant,
} from "@/constants/publishing";
import { ROUTES } from "@/constants/routes";
import { ConfirmDialog } from "../ConfirmDialog";

/**
 * La pilule de décision, au bas de l'atelier.
 *
 * Sur les autres onglets, le bas de l'écran porte « résoudre avec les agents
 * IA » : c'est le geste qu'on y vend. Dans un article ouvert, ce geste n'est pas
 * le bon — le client a un texte sous les yeux et une seule question en tête :
 * est-ce que celui-là part, et quand.
 *
 * Une seule pilule, et dedans un seul verbe en avant. L'état du départ à gauche
 * dit où l'on en est ; le bouton noir porte la décision qui reste à prendre —
 * valider tant que rien n'est validé, publier ensuite ; « Réécrire avec
 * l'agent » ouvre la consigne. Tout le reste — publier hors tour, préparer un
 * dépôt manuel, voir l'article en ligne, écarter le sujet — est descendu sous
 * les trois points. Ce sont des gestes qu'on cherche, pas des gestes qu'on
 * rencontre, et alignés en pilule ils disputaient la place à celui qui compte.
 *
 * Chaque décision passe par une fenêtre de confirmation. Ce sont les deux seuls
 * gestes du produit qui sortent du tableau de bord ; la fenêtre y annonce la
 * conséquence exacte — « dès maintenant », ou la date — avant de la déclencher.
 *
 * La barre ne se positionne plus elle-même : l'atelier tient le pied de son
 * écran, où la consigne de réécriture vient se glisser au-dessus d'elle.
 */

export function ArticleActionBar({
  articleId,
  status,
  scheduledFor,
  hasBody,
  canPublish,
  linked,
  locked,
  domain,
  externalUrl,
  onDrop,
  dropPending,
  onConnectSite,
  onPreparePublish,
  onRewrite,
  rewriteOpen,
}: {
  articleId: string;
  status: string;
  /** La date de départ enregistrée, en ISO. */
  scheduledFor: string | null;
  /** Un article vide ne se valide ni ne se publie : il se rédige d'abord. */
  hasBody: boolean;
  /** Le rattachement du site accepte le dépôt automatique. */
  canPublish: boolean;
  /**
   * Un site est rattaché — sans préjuger de ce qu'il laisse faire.
   *
   * La nuance décide de ce que propose le bouton quand rien ne peut partir tout
   * seul : rattacher le site, ou composer le texte à déposer à la main.
   */
  linked: boolean;
  /** L'offre du compte n'ouvre pas la publication : la barre mène aux tarifs. */
  locked: boolean;
  /** Le domaine où l'article sera déposé, nommé dans la confirmation. */
  domain: string | null;
  /** L'adresse de l'article en ligne, quand il est déjà parti. */
  externalUrl: string | null;
  /** Écarter le sujet — porté par l'atelier, qui tient l'état des actions. */
  onDrop: () => void;
  dropPending: boolean;
  /**
   * Ouvrir le rattachement du site, quand rien n'est encore rattaché.
   *
   * Le geste remplace « publier maintenant » plutôt que de s'ajouter à lui :
   * c'est la même intention — poser l'article en ligne — pour un client à qui il
   * manque la porte.
   */
  onConnectSite: () => void;
  /**
   * Composer le texte de dépôt, pour un site rattaché qui n'ouvre pas d'API.
   *
   * Le seul recours de ces comptes-là : les agents ne peuvent rien y déposer, et
   * l'article se recopie dans l'éditeur du client. Le geste ne se propose donc
   * qu'à eux — ailleurs, ce serait une porte de secours présentée comme la voie
   * normale.
   */
  onPreparePublish: () => void;
  /** Ouvrir ou fermer la consigne de réécriture, qui vit au-dessus de la pilule. */
  onRewrite: () => void;
  rewriteOpen: boolean;
}) {
  const t = useTranslations("dashboard.articleBar");
  const reduced = useReducedMotion();
  const router = useRouter();

  const [asking, setAsking] = useState<"publish" | "approve" | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  /**
   * Le jour choisi dans la fenêtre de validation.
   *
   * Nul tant que le client n'y a pas touché : la fenêtre s'ouvre alors sur la
   * date que porte l'article — celle de la barre du haut, y compris quand elle
   * vient d'être changée sans être encore enregistrée. Un état recopié à
   * l'ouverture du composant aurait figé la date d'arrivée sur la page.
   */
  const [chosenDay, setChosenDay] = useState<string | null>(null);

  const publish = useAction(publishArticleAction, {
    onSuccess: () => {
      setAsking(null);
      router.refresh();
    },
  });

  const approve = useAction(approveArticleAction, {
    onSuccess: () => {
      setAsking(null);
      router.refresh();
    },
  });

  // Retirer la validation ne demande aucune confirmation : le geste est
  // réversible d'un clic, et rien n'est perdu — l'article garde son texte, son
  // plan et sa date, il ne part simplement plus tout seul.
  const unapprove = useAction(unapproveArticleAction, { onSuccess: () => router.refresh() });

  // Un menu qui reste ouvert derrière le clic suivant colle à l'écran : il se
  // referme dès qu'on touche ailleurs, ou qu'on appuie sur Échap.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const approved = status === "approved";
  const done = status === "published" || status === "rejected";

  const day = chosenDay ?? splitPublishInstant(scheduledFor ?? new Date().toISOString()).day;

  /** Ce qui partira réellement si l'on valide le jour affiché dans la fenêtre. */
  const instant = preferredPassOnDay(day);
  const departure = new Date(instant);


  /* -------------------- L'article est parti, ou écarté -------------------- */

  // Plus rien à décider : la pilule ne garde que la position de l'article et,
  // s'il est en ligne, la porte pour aller le voir.
  if (done) {
    return (
      <Shell reduced={reduced}>
        <span className="flex items-center gap-2 px-4 text-[13px] text-muted">
          <span
            aria-hidden
            className={`size-[7px] rounded-pill ${
              status === "published" ? "bg-success" : "bg-pebble"
            }`}
          />
          {t(status === "published" ? "published" : "rejected")}
        </span>
        {externalUrl ? (
          <a
            href={externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex cursor-pointer items-center justify-center rounded-pill border border-pebble px-[18px] py-[11px] text-sm font-medium text-graphite transition-colors duration-200 hover:bg-mist"
          >
            {t("seeOnline")}
          </a>
        ) : null}
      </Shell>
    );
  }

  /* ------------------------------- Verrouillé ----------------------------- */

  if (locked) {
    return (
      <Shell reduced={reduced}>
        <Link
          href={ROUTES.pricing}
          className="flex cursor-pointer items-center justify-center rounded-pill bg-cta px-[22px] py-[11px] text-sm font-medium text-white shadow-[var(--shadow-pill)] transition-colors duration-200 hover:bg-cta-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40"
        >
          {t("unlock")}
        </Link>
      </Shell>
    );
  }

  /* ------------------------------ Les gestes ------------------------------ */

  /**
   * Publier hors tour, ou aller chercher la porte qui manque.
   *
   * Trois situations, et il ne faut pas les confondre. Le site est rattaché et
   * ouvre sa rédaction : on dépose, c'est « publier maintenant ». Il est
   * rattaché mais n'ouvre pas d'API — une boutique sans blog, une clé sans les
   * pages de contenu : le dépôt se fait à la main, et le bouton compose le
   * texte à recopier. Rien n'est rattaché du tout : proposer un prompt de dépôt
   * à ce moment-là, c'est répondre à côté — ce qui manque n'est pas le texte,
   * c'est la porte. Le bouton mène alors au rattachement.
   */
  const publishNow = () =>
    canPublish ? setAsking("publish") : linked ? onPreparePublish() : onConnectSite();
  const publishLabel = canPublish
    ? t("publishNow")
    : linked
      ? t("preparePublish")
      : t("connectSite");

  const primaryLabel = approved ? publishLabel : t("approve");
  const onPrimary = approved
    ? publishNow
    : () => {
        setChosenDay(null);
        setAsking("approve");
      };

  return (
    <>
      {/* ------------------------- Grand écran : la pilule ------------------ */}
      {/* L'état du départ n'est plus ici : il est remonté dans la barre du haut,
          contre la date de publication. Les deux disaient la même chose à deux
          endroits de l'écran, et celui du bas séparait le libellé de la date à
          laquelle il se rapportait. */}
      <Shell reduced={reduced} className="hidden lg:flex">
        <button
          type="button"
          disabled={!hasBody}
          title={hasBody ? undefined : t("needsBody")}
          onClick={onPrimary}
          className="flex cursor-pointer items-center justify-center rounded-pill bg-cta px-[22px] py-[11px] text-sm font-medium text-white shadow-[var(--shadow-pill)] transition-colors duration-200 hover:bg-cta-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {primaryLabel}
        </button>

        {/* Une fois l'article validé, le geste de repli n'est plus de le faire
            réécrire : il part tout seul à sa date, et la seule chose qu'on peut
            encore vouloir, c'est le retenir. Avant validation, c'est l'agent qui
            tient cette place — et sur un article encore vide il l'écrit, il ne
            le « réécrit » pas. */}
        <button
          type="button"
          onClick={approved ? () => unapprove.execute({ id: articleId }) : onRewrite}
          disabled={approved && unapprove.isPending}
          aria-expanded={approved ? undefined : rewriteOpen}
          className={`flex cursor-pointer items-center justify-center rounded-pill border px-[18px] py-[11px] text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40 disabled:cursor-not-allowed disabled:opacity-60 ${
            rewriteOpen && !approved
              ? "border-obsidian bg-mist text-obsidian"
              : "border-pebble text-graphite hover:bg-mist"
          }`}
        >
          {approved
            ? unapprove.isPending
              ? t("unapproving")
              : t("unapprove")
            : hasBody
              ? t("rewrite")
              : t("write")}
        </button>

        {/* Les gestes qu'on cherche : sous les trois points, pas dans la ligne. */}
        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            aria-label={t("more")}
            title={t("more")}
            className="flex cursor-pointer items-center justify-center rounded-pill px-3.5 py-[11px] text-sm text-steel transition-colors duration-200 hover:bg-mist hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40"
          >
            <span aria-hidden className="leading-none">⋯</span>
          </button>

          {menuOpen ? (
            <div
              role="menu"
              className="absolute bottom-[calc(100%+10px)] right-0 z-10 w-64 overflow-hidden rounded-3xl border border-border bg-snow p-1.5 shadow-[rgba(0,0,0,0.12)_0_10px_28px]"
            >
              {/* Un seul geste sous les trois points : écarter. Publier hors
                  tour est déjà porté par le bouton plein, et le prompt de dépôt
                  y arrive par le même bouton quand le site n'ouvre pas son API :
                  les répéter ici donnait trois chemins vers deux actions. */}
              <MenuItem
                danger
                disabled={dropPending}
                onClick={() => {
                  setMenuOpen(false);
                  onDrop();
                }}
              >
                {t("drop")}
              </MenuItem>
            </div>
          ) : null}
        </div>
      </Shell>

      {/* --------------------------- Téléphone : la pile ------------------- */}
      {/* Le pouce atteint le bas de l'écran, pas son milieu : la décision y est
          pleine largeur, et les deux gestes de repli tiennent la ligne dessous,
          en texte, là où ils ne se cliquent pas par erreur. */}
      <div className="pointer-events-auto w-full lg:hidden">
        <button
          type="button"
          disabled={!hasBody}
          title={hasBody ? undefined : t("needsBody")}
          onClick={onPrimary}
          className="block w-full cursor-pointer rounded-pill bg-cta px-[18px] py-3.5 text-center text-[15px] font-medium text-white shadow-[var(--shadow-pill)] transition-colors duration-200 hover:bg-cta-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {primaryLabel}
        </button>

        <div className="mt-2.5 flex items-center justify-center gap-5">
          {/* Validé, le geste de repli est de retenir l'article ; avant, c'est
              de le faire partir hors tour. Le bouton plein porte déjà l'autre
              moitié dans les deux cas. */}
          {approved ? (
            <button
              type="button"
              disabled={unapprove.isPending}
              onClick={() => unapprove.execute({ id: articleId })}
              className="cursor-pointer text-[13px] text-slate transition-colors duration-200 hover:text-ink disabled:opacity-50"
            >
              {unapprove.isPending ? t("unapproving") : t("unapprove")}
            </button>
          ) : (
            <button
              type="button"
              disabled={!hasBody}
              onClick={publishNow}
              className="cursor-pointer text-[13px] text-slate transition-colors duration-200 hover:text-ink disabled:opacity-50"
            >
              {publishLabel}
            </button>
          )}
          <button
            type="button"
            disabled={dropPending}
            onClick={onDrop}
            className="cursor-pointer text-[13px] text-steel transition-colors duration-200 hover:text-danger disabled:opacity-60"
          >
            {t("drop")}
          </button>
        </div>
      </div>

      {/* ------------------------ Publier maintenant ---------------------- */}
      <ConfirmDialog
        open={asking === "publish"}
        eyebrow={t("publishEyebrow")}
        title={t("publishTitle")}
        body={domain ? t("publishBodyDomain", { domain }) : t("publishBody")}
        confirmLabel={publish.isPending ? t("publishing") : t("publishNow")}
        cancelLabel={t("cancel")}
        pending={publish.isPending}
        error={publish.result.serverError ?? (publish.hasErrored ? t("publishFailed") : null)}
        onConfirm={() => publish.execute({ id: articleId })}
        onClose={() => setAsking(null)}
      />

      {/* --------------------- Valider l'autopublication ------------------ */}
      <ConfirmDialog
        open={asking === "approve"}
        eyebrow={t("approveEyebrow")}
        title={t("approveTitle")}
        body={t("approveBody", {
          date: formatPublishDate(departure),
          time: formatPublishTime(departure),
        })}
        confirmLabel={approve.isPending ? t("approving") : t("approveConfirm")}
        cancelLabel={t("cancel")}
        pending={approve.isPending}
        error={approve.result.serverError}
        onConfirm={() => approve.execute({ id: articleId, scheduledFor: instant })}
        onClose={() => setAsking(null)}
      >
        {/* La date se corrige dans la fenêtre : valider et dater sont une seule
            décision, et renvoyer le client au sélecteur du haut pour changer un
            jour lui ferait refaire tout le chemin. */}
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-steel">
            {t("departureDay")}
          </span>
          <input
            type="date"
            value={day}
            onChange={(event) => setChosenDay(event.target.value)}
            className="h-11 w-full cursor-pointer rounded-xl border border-border bg-surface px-3 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40"
          />
        </label>
      </ConfirmDialog>
    </>
  );
}

/** La pilule elle-même : le verre dépoli qui porte les boutons. */
function Shell({
  reduced,
  className = "",
  children,
}: {
  reduced: boolean | null;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15, duration: reduced ? 0 : 0.3, ease: "easeOut" }}
      className={`pointer-events-auto flex max-w-full items-center gap-2 rounded-pill border border-fog bg-snow/95 p-2 shadow-[rgba(0,0,0,0.10)_0_8px_24px] backdrop-blur-md ${className}`}
    >
      {children}
    </motion.div>
  );
}

function MenuItem({
  onClick,
  disabled = false,
  danger = false,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={`block w-full cursor-pointer rounded-2xl px-3.5 py-2.5 text-left text-sm transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${
        danger ? "text-steel hover:bg-mist hover:text-danger" : "text-text hover:bg-mist"
      }`}
    >
      {children}
    </button>
  );
}
