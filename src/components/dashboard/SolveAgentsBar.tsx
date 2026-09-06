"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "next-intl";
import type { DetectedStack } from "@/lib/geo/types";
import type { SiteConnectSetup } from "@/components/tableau-de-bord/SiteConnectForm";
import { ConnectSiteModal } from "./ConnectSiteModal";

/**
 * Barre d'action du rapport. Elle reste à portée de pouce en permanence :
 * une pilule flottante au-dessus du contenu, à toutes les tailles. Deux
 * actions, une seule dominante — résoudre ; partager reste volontairement
 * discret.
 *
 * Sur téléphone, elle formait auparavant un bandeau blanc pleine largeur collé
 * au bord bas. Deux ennuis : ce fond posait une seconde barre d'outils sous
 * celle du navigateur, et la bulle de discussion, ancrée en bas à droite,
 * tombait en travers du bouton « partager ». La pilule est donc remontée
 * au-dessus de la bulle et ne porte plus que sa propre surface.
 */

const COPIED_FEEDBACK_MS = 2200;

function SparkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z"
        fill="currentColor"
      />
      <path d="M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z" fill="currentColor" />
    </svg>
  );
}

export function SolveAgentsBar({
  domain,
  stack,
  issues,
  locked = false,
  connect = null,
  contentHref = null,
  articlesHref = null,
  articles = [],
}: {
  domain: string;
  stack: DetectedStack | null;
  /** Manques relevés dans le rapport, rejoués dans la modale (3 au plus). */
  issues: string[];
  /**
   * Compte gratuit : la barre et la modale s'ouvrent à l'identique. C'est le
   * serveur MCP qui borne ensuite ce que l'agent reçoit, et le rattachement du
   * site reste ouvert.
   */
  locked?: boolean;
  /**
   * De quoi rattacher le site depuis la modale. Nul depuis le rapport public,
   * qui n'a pas de session : le bouton y mène aux réglages.
   */
  connect?: SiteConnectSetup | null;
  /**
   * L'onglet Contenu, quand la barre doit y ramener avant d'ouvrir la modale.
   *
   * C'est le parcours du compte gratuit : la seule chose qu'il peut faire
   * corriger, c'est son contenu, et l'écran qui le montre est l'onglet Contenu.
   * La barre y mène donc d'abord — « corriger le contenu » —, et c'est une fois
   * arrivé, devant ses propres textes, qu'elle redevient « résoudre avec les
   * agents IA » et ouvre la console. Proposer les agents depuis l'accueil
   * revenait à ouvrir une modale sur un travail que le compte ne voit pas
   * encore.
   *
   * Nul pour un compte payant, et depuis le rapport public : la barre y ouvre
   * la modale partout.
   */
  contentHref?: string | null;
  /**
   * L'onglet Articles, et les prochains textes du client.
   *
   * Sur cet écran, la barre ne parle plus de correctifs : le client y regarde un
   * calendrier de textes prêts, et ce qui lui manque est la porte par où ils
   * partiront. Elle dit donc « connecter le site », et la modale montre ses
   * articles qui se posent plutôt que ses manques qui se corrigent. C'est la
   * même modale et le même geste : seule change la raison qu'on lui en donne.
   */
  articlesHref?: string | null;
  articles?: { title: string; dateLabel: string }[];
}) {
  const t = useTranslations("analysisReport.solve");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const onArticles = Boolean(articlesHref && pathname === articlesHref);

  // Le renvoi ne vaut que hors de l'onglet Contenu : une fois dessus, un bouton
  // qui recharge la page où l'on est déjà ne ferait rien de visible.
  const redirect = contentHref && pathname !== contentHref ? contentHref : null;

  /**
   * Sur un écran tactile, le partage passe par la feuille système (SMS, mail,
   * messageries). Ailleurs, il n'y a rien à ouvrir : on copie le lien, c'est
   * l'équivalent le plus direct.
   */
  async function share() {
    const url = window.location.href;
    const coarse =
      typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;

    if (coarse && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: t("shareTitle", { domain }), url });
        return;
      } catch {
        // Partage refusé ou annulé : on retombe sur la copie du lien.
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
    } catch {
      // Presse-papiers refusé (contexte non sécurisé) : rien à annoncer.
    }
  }

  return (
    <>
      {/* La hauteur du décalage bas dégage la bulle de discussion, qui occupe
          le coin inférieur droit sur toute la largeur d'un téléphone. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-40 flex justify-center px-4 sm:bottom-6">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.35, ease: "easeOut" }}
          className="pointer-events-auto flex max-w-full items-center gap-1.5 rounded-full border border-fog bg-snow/95 p-1.5 shadow-[var(--shadow-md)] backdrop-blur-md"
        >
          {redirect ? (
            /* Hors de l'onglet Contenu, sur un compte gratuit : la barre ne
               promet que ce que le compte peut réellement faire aujourd'hui, et
               elle emmène à l'endroit où ça se fait. Le compte de corrections
               reste affiché — c'est lui qui donne envie d'y aller. */
            <Link
              href={redirect}
              className="flex min-w-0 cursor-pointer items-center justify-center gap-2 rounded-full bg-cta px-5 py-3 text-sm font-medium text-white shadow-[var(--shadow-pill)] transition-colors duration-200 hover:bg-cta-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40 sm:px-6"
            >
              <SparkIcon />
              {t("ctaContent")}
              {issues.length > 0 && (
                <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-semibold tabular-nums">
                  {issues.length}
                </span>
              )}
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="flex min-w-0 cursor-pointer items-center justify-center gap-2 rounded-full bg-cta px-5 py-3 text-sm font-medium text-white shadow-[var(--shadow-pill)] transition-colors duration-200 hover:bg-cta-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40 sm:px-6"
            >
              <SparkIcon />
              {onArticles ? t("ctaPublish") : t("cta")}
              {/* Le compteur porte ce que le bouton promet : des manques à
                  corriger ailleurs, des articles à faire partir ici. */}
              {(onArticles ? articles.length : issues.length) > 0 && (
                <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-semibold tabular-nums">
                  {onArticles ? articles.length : issues.length}
                </span>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={share}
            aria-label={t("share")}
            className="flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full border border-transparent px-3.5 py-3 text-sm font-medium text-muted transition-colors duration-200 hover:border-fog hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40 sm:px-4"
          >
            {copied ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M5 13l4 4L19 7"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M12 3v12M12 3 8 7M12 3l4 4"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                />
              </svg>
            )}
            <span className="hidden sm:inline">{copied ? t("copied") : t("share")}</span>
          </button>
        </motion.div>
      </div>

      <AnimatePresence>
        {open && (
          <ConnectSiteModal
            domain={domain}
            stack={stack}
            issues={issues}
            locked={locked}
            connect={connect}
            purpose={onArticles ? "publish" : "fix"}
            articles={articles}
            onClose={() => setOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
