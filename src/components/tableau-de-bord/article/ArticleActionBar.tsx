"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useTranslations } from "next-intl";
import { motion, useReducedMotion } from "framer-motion";
import { approveArticleAction, publishArticleAction } from "@/features/dashboard/actions";
import {
  formatPublishDate,
  formatPublishTime,
  nextPublishPass,
  preferredPassOnDay,
  splitPublishInstant,
} from "@/constants/publishing";
import { ROUTES } from "@/constants/routes";
import { ConfirmDialog } from "../ConfirmDialog";

/**
 * La barre d'action d'un article.
 *
 * Sur les autres onglets, le bas de l'écran porte « résoudre avec les agents
 * IA » : c'est le geste qu'on y vend. Dans un article ouvert, ce geste n'est
 * pas le bon — le client a un texte sous les yeux et une seule question en
 * tête : est-ce que celui-là part, et quand. La barre change donc de contenu
 * avec la page, et ne propose ici que les deux décisions qui concernent cet
 * article.
 *
 * Deux décisions, pas six. Publier maintenant dépose le texte tout de suite ;
 * valider l'autopublication laisse la file le déposer à sa date. « Écarter »
 * reste, en retrait, parce qu'un sujet dont on ne veut pas doit pouvoir sortir
 * du planning — mais il ne dispute pas la place aux deux autres.
 *
 * Chaque décision passe par une fenêtre de confirmation. Ce sont les deux seuls
 * gestes du produit qui sortent du tableau de bord ; la fenêtre y annonce la
 * conséquence exacte — « dès maintenant », ou la date — avant de la déclencher.
 */

export function ArticleActionBar({
  articleId,
  status,
  scheduledFor,
  hasBody,
  canPublish,
  locked,
  domain,
  onDrop,
  dropPending,
  onPreparePublish,
}: {
  articleId: string;
  status: string;
  /** La date de départ enregistrée, en ISO. */
  scheduledFor: string | null;
  /** Un article vide ne se valide ni ne se publie : il se rédige d'abord. */
  hasBody: boolean;
  /** Le rattachement du site accepte le dépôt automatique. */
  canPublish: boolean;
  /** L'offre du compte n'ouvre pas la publication : la barre mène aux tarifs. */
  locked: boolean;
  /** Le domaine où l'article sera déposé, nommé dans la confirmation. */
  domain: string | null;
  /** Écarter le sujet — porté par l'atelier, qui tient l'état des actions. */
  onDrop: () => void;
  dropPending: boolean;
  /**
   * Composer le prompt de dépôt, quand le site ne s'ouvre pas à une API.
   *
   * Le geste remplace « publier maintenant » plutôt que de s'ajouter à lui :
   * c'est la même intention — poser l'article en ligne — pour un site qui
   * demande qu'on le fasse à la main.
   */
  onPreparePublish: () => void;
}) {
  const t = useTranslations("dashboard.articleBar");
  const reduced = useReducedMotion();
  const router = useRouter();

  const [asking, setAsking] = useState<"publish" | "approve" | null>(null);

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

  // Un article publié n'a plus de décision à prendre : la barre disparaît et
  // laisse la place au lien vers la page en ligne, dans l'atelier.
  if (status === "published" || status === "rejected") return null;

  const approved = status === "approved";

  const day =
    chosenDay ?? splitPublishInstant(scheduledFor ?? new Date().toISOString()).day;

  /** Ce qui partira réellement si l'on valide le jour affiché dans la fenêtre. */
  const instant = preferredPassOnDay(day);
  const departure = new Date(instant);

  const scheduledLabel = scheduledFor
    ? t("scheduledOn", {
        date: formatPublishDate(nextPublishPass(new Date(scheduledFor))),
        time: formatPublishTime(nextPublishPass(new Date(scheduledFor))),
      })
    : t("undated");

  return (
    <>
      {/* La réserve sous la page : sans elle, la barre flottante recouvrirait
          la fin du document. La hauteur suit son décalage — sur téléphone, la
          barre est remontée pour dégager la bulle de discussion. */}
      <div className="h-40 sm:h-28" aria-hidden />

      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-40 flex justify-center px-4 sm:bottom-6">
        <motion.div
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: reduced ? 0 : 0.35, ease: "easeOut" }}
          className="pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-1.5 rounded-[28px] border border-fog bg-snow/95 p-1.5 shadow-[var(--shadow-md)] backdrop-blur-md sm:rounded-full"
        >
          {/* L'état du départ, à gauche de la pilule : la décision se prend en
              sachant ce qui est déjà prévu, pas en le cherchant plus haut. */}
          <span className="hidden max-w-[16rem] truncate px-4 text-[13px] text-muted sm:block">
            {approved ? scheduledLabel : t("notValidated")}
          </span>

          {locked ? (
            <Link
              href={ROUTES.pricing}
              className="flex cursor-pointer items-center justify-center rounded-full bg-cta px-6 py-3 text-sm font-medium text-white shadow-[var(--shadow-pill)] transition-colors duration-200 hover:bg-cta-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40"
            >
              {t("unlock")}
            </Link>
          ) : (
            <>
              {/* Valider disparaît une fois l'article validé : le geste est
                  fait, et un bouton qui ne changerait plus rien laisserait
                  croire qu'il manque encore quelque chose. */}
              {approved ? null : (
                <button
                  type="button"
                  disabled={!hasBody}
                  title={hasBody ? undefined : t("needsBody")}
                  onClick={() => {
                    setChosenDay(null);
                    setAsking("approve");
                  }}
                  className="flex cursor-pointer items-center justify-center rounded-full bg-cta px-5 py-3 text-sm font-medium text-white shadow-[var(--shadow-pill)] transition-colors duration-200 hover:bg-cta-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40 disabled:cursor-not-allowed disabled:opacity-50 sm:px-6"
                >
                  {t("approve")}
                </button>
              )}

              {canPublish ? (
                <button
                  type="button"
                  disabled={!hasBody}
                  title={hasBody ? undefined : t("needsBody")}
                  onClick={() => setAsking("publish")}
                  className={`flex cursor-pointer items-center justify-center rounded-full px-5 py-3 text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40 disabled:cursor-not-allowed disabled:opacity-50 sm:px-6 ${
                    approved
                      ? "bg-cta text-white shadow-[var(--shadow-pill)] hover:bg-cta-hover"
                      : "border border-graphite text-graphite hover:bg-mist"
                  }`}
                >
                  {t("publishNow")}
                </button>
              ) : (
                /* Le site n'ouvre pas sa rédaction à une API : le dépôt se fait
                   à la main, et la barre prépare le texte à poser plutôt que de
                   promettre un envoi qui n'aura pas lieu. */
                <button
                  type="button"
                  disabled={!hasBody}
                  title={hasBody ? undefined : t("needsBody")}
                  onClick={onPreparePublish}
                  className="flex cursor-pointer items-center justify-center rounded-full border border-graphite px-5 py-3 text-sm font-medium text-graphite transition-colors duration-200 hover:bg-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40 disabled:cursor-not-allowed disabled:opacity-50 sm:px-6"
                >
                  {t("preparePublish")}
                </button>
              )}

              <button
                type="button"
                disabled={dropPending}
                onClick={onDrop}
                className="cursor-pointer rounded-full px-4 py-3 text-sm font-medium text-muted transition-colors duration-200 hover:bg-mist hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40 disabled:opacity-60"
              >
                {t("drop")}
              </button>
            </>
          )}
        </motion.div>
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
