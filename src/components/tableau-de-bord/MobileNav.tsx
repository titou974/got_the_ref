"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Portal } from "@/components/Portal";
import { ROUTES } from "@/constants/routes";
import type { AccessTier } from "@/constants/access";
import { initials } from "@/lib/initials";
import { useBodyScrollLock } from "@/lib/useBodyScrollLock";
import { SidebarNav } from "./SidebarNav";
import { SiteFavicon } from "./SiteFavicon";
import { currentItem, navItems } from "./navItems";

/**
 * La navigation du tableau de bord sur téléphone : un bandeau qui suit le
 * défilement, et le tiroir qu'il ouvre sur le côté.
 *
 * Ce qui existait avant : les six sections en rangée horizontale, à faire
 * défiler du pouce au-dessus du contenu. Trois entrées visibles sur six, aucun
 * repère de l'endroit où l'on se trouve dès qu'on avait fait glisser la rangée,
 * et une bande qui disparaissait dès le premier défilement de la page — sur un
 * rapport long, revenir au menu voulait dire remonter tout l'écran.
 *
 * Le bandeau ne porte donc pas trois lignes anonymes mais la réponse aux deux
 * questions qu'on se pose en arrivant : dans quelle section suis-je, et sur
 * quel site. L'icône de la section ouverte, pleine, sert de poignée — c'est la
 * même que celle allumée dans la liste, le tiroir déplie ce que le bandeau
 * résume. Il reste collé en haut : le menu est à un pouce, où qu'on en soit
 * dans la page.
 *
 * Le tiroir passe par un `Portal` vers `<body>` : le bandeau est `sticky` avec
 * un `backdrop-blur`, et un `backdrop-filter` établit un bloc conteneur. Rendu
 * dedans, un calque `fixed` se replierait sur la hauteur du bandeau — de
 * l'extérieur, le bouton « n'ouvrirait rien ».
 */

/** Au-delà de cette distance vers la gauche, le glissement vaut fermeture. */
const SWIPE_CLOSE_PX = 70;
/** Un geste rapide ferme aussi, même court : c'est le réflexe du pouce. */
const SWIPE_CLOSE_VELOCITY = -400;

export function MobileNav({
  domain,
  showMaps,
  tier,
  userName,
}: {
  domain: string | null;
  showMaps: boolean;
  /** Le niveau du compte : il décide des onglets grisés dans le tiroir. */
  tier: AccessTier;
  userName: string | null;
}) {
  const t = useTranslations("dashboard.nav");
  const tSettings = useTranslations("dashboard.settings");
  const pathname = usePathname();
  const reduced = useReducedMotion();

  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Les réglages ne sont pas une section de la colonne — on y entre par
  // l'avatar — mais le bandeau doit quand même dire où l'on est. Sans cette
  // exception, il afficherait « Accueil » pendant qu'on change son mot de passe.
  const onSettings = pathname.startsWith(ROUTES.dashboardSettings);
  const current = currentItem(navItems(showMaps), pathname);
  const currentLabel = onSettings ? tSettings("title") : t(current.key);

  useBodyScrollLock(open);

  // Échap ferme, et le retour arrière du navigateur aussi : sans ça, le geste
  // de retour changerait la page sous un tiroir resté ouvert par-dessus.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onPopState = () => setOpen(false);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("popstate", onPopState);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("popstate", onPopState);
    };
  }, [open]);

  // Le focus entre dans le tiroir à l'ouverture et revient sur la poignée à la
  // fermeture : au clavier comme au lecteur d'écran, on ne se retrouve pas
  // renvoyé en haut de page à chaque aller-retour.
  //
  // Le premier passage ne fait rien : au chargement de la page, le tiroir est
  // fermé sans avoir jamais été ouvert, et rendre la main à la poignée volerait
  // le focus à ce que le visiteur regarde.
  const everOpened = useRef(false);
  useEffect(() => {
    if (open) {
      everOpened.current = true;
      closeRef.current?.focus();
    } else if (everOpened.current) {
      triggerRef.current?.focus({ preventScroll: true });
    }
  }, [open]);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-bg/85 px-4 py-2.5 backdrop-blur-md lg:hidden">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-label={t("openMenu")}
          className="flex w-full cursor-pointer items-center gap-3 rounded-2xl border border-border bg-surface px-2.5 py-2 text-left transition-colors duration-200 hover:border-pebble focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40"
        >
          {/* La marque, pas l'icône de la section : c'est le seul endroit du
              téléphone où le logo a sa place, et le nom de la section juste à
              côté dit déjà où l'on est. Le carré noir des icônes de colonne y
              ressemblait de loin à une pastille sans signification. */}
          <Image
            src="/logo.svg"
            alt=""
            width={40}
            height={40}
            priority
            className="size-10 shrink-0 rounded-xl"
          />

          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-semibold leading-tight text-text">
              {currentLabel}
            </span>
            {domain && (
              <span className="mt-0.5 block truncate text-[11px] uppercase tracking-[0.14em] text-steel">
                {domain}
              </span>
            )}
          </span>

          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden
            className="shrink-0 text-steel"
          >
            <path
              d="m8 10 4 4 4-4"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </header>

      <Portal>
        <AnimatePresence>
          {open && (
            <>
              <motion.div
                key="backdrop"
                aria-hidden
                onClick={() => setOpen(false)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-[90] cursor-pointer bg-obsidian/45 backdrop-blur-[2px] lg:hidden"
              />

              <motion.aside
                key="drawer"
                role="dialog"
                aria-modal="true"
                aria-label={t("menuLabel")}
                // `inset-y-0` plutôt qu'une hauteur en unités de viewport : le
                // tiroir se cale sur son bloc conteneur — le viewport, grâce au
                // portail — sans dépendre des barres d'outils mobiles qui font
                // varier `vh`.
                className="fixed inset-y-0 left-0 z-[95] flex w-[19rem] max-w-[86vw] flex-col bg-surface shadow-[var(--shadow-md)] lg:hidden"
                initial={reduced ? { opacity: 0 } : { x: "-100%" }}
                animate={reduced ? { opacity: 1 } : { x: 0 }}
                exit={reduced ? { opacity: 0 } : { x: "-100%" }}
                transition={{ type: "tween", duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
                // Le tiroir se repousse d'où il est venu : le pouce le renvoie
                // vers la gauche, comme on referme un rabat.
                drag={reduced ? false : "x"}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={{ top: 0, bottom: 0, left: 0.9, right: 0 }}
                dragMomentum={false}
                onDragEnd={(_, info) => {
                  if (info.offset.x < -SWIPE_CLOSE_PX || info.velocity.x < SWIPE_CLOSE_VELOCITY) {
                    setOpen(false);
                  }
                }}
              >
                <div className="flex items-center justify-between gap-3 px-4 pt-4">
                  <Link
                    href={ROUTES.home}
                    onClick={() => setOpen(false)}
                    className="inline-flex min-w-0 cursor-pointer items-center gap-2 font-display text-lg font-bold tracking-tight"
                  >
                    <Image
                      src="/logo.svg"
                      alt=""
                      width={28}
                      height={28}
                      className="h-7 w-7 shrink-0 rounded-[9px]"
                    />
                    <span className="truncate">got_the_ref</span>
                  </Link>

                  <button
                    ref={closeRef}
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label={t("closeMenu")}
                    className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full border border-fog text-text transition-colors duration-200 hover:border-pebble focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path
                        d="M6 6l12 12M18 6 6 18"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                </div>

                {/* Le site suivi, en clair. Le sélecteur de la colonne de gauche
                    n'a pas sa place ici : il n'ouvre qu'une seule entrée tant
                    qu'un compte ne suit qu'un site, et sa liste se poserait
                    derrière le tiroir. */}
                {domain && (
                  <div className="mt-4 flex items-center gap-2.5 border-b border-border px-4 pb-4">
                    <SiteFavicon domain={domain} />
                    <span className="min-w-0 truncate text-sm font-medium">{domain}</span>
                  </div>
                )}

                <nav className="mt-3 min-h-0 flex-1 overflow-y-auto px-3 pb-3">
                  <SidebarNav
                    showMaps={showMaps}
                    tier={tier}
                    onNavigate={() => setOpen(false)}
                  />
                </nav>

                {/* Le compte n'était atteignable nulle part sur téléphone : le
                    pied de la colonne de gauche est masqué sous `lg`. Il tient
                    ici, au même endroit que sur grand écran. */}
                <div className="border-t border-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                  <Link
                    href={ROUTES.dashboardSettings}
                    onClick={() => setOpen(false)}
                    className="flex cursor-pointer items-center gap-2.5 rounded-2xl px-3 py-2 transition-colors duration-200 hover:bg-mist"
                  >
                    <span
                      aria-hidden
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-obsidian text-xs font-bold uppercase text-white"
                    >
                      {initials(userName)}
                    </span>
                    <span className="min-w-0 truncate text-sm font-medium">{userName ?? ""}</span>
                  </Link>
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>
      </Portal>
    </>
  );
}
