import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { RiArrowLeftLine } from "@remixicon/react";
import { Logo } from "./Logo";
import { SignOutButton } from "./SignOutButton";
import { NavCta } from "./NavCta";
import { MobileMenu } from "./MobileMenu";
import { getCurrentUser } from "@/lib/auth";
import { hasReadyWorkspace } from "@/features/auth/destination";
import { isDemoFirst } from "@/features/experiments/path";
import { ROUTES } from "@/constants/routes";

export async function Nav({
  minimal = false,
  backTo = null,
  showSession = true,
  showSignUp = true,
  showSignOut = true,
}: {
  minimal?: boolean;
  /**
   * D'où vient le client identifié, et où la flèche le ramène.
   *
   * Sur les tarifs, il arrive de son tableau de bord pour comparer deux offres,
   * puis il veut y retourner. La barre lui tendait « Tableau de bord » et
   * « Déconnexion » côte à côte, à droite : deux liens de même poids dont l'un
   * ferme sa session, au moment précis où il hésite sur un prix. La flèche les
   * remplace tous les deux, à gauche, où se trouve le retour partout ailleurs.
   *
   * Sans session, rien ne s'affiche : un visiteur qui découvre la page n'a pas
   * de tableau de bord d'où revenir.
   */
  backTo?: string | null;
  /**
   * Montre-t-on, à un client identifié, son tableau de bord et sa déconnexion ?
   *
   * Sur la grille tarifaire, non. Un compte qui vient de naître n'a pas encore
   * de tableau de bord — le lui tendre le déposait sur un espace vide, quand ce
   * n'était pas dans le tunnel de mise en route qu'il n'a pas demandé — et la
   * déconnexion, posée à côté, ferme la session au moment exact où il choisit
   * une offre. La page ne garde donc qu'une issue : la décision, ou la flèche de
   * retour quand il y a bien un espace derrière.
   *
   * Sans session, ce réglage ne change rien : le bouton d'inscription reste, il
   * est l'appel de la page.
   */
  showSession?: boolean;
  /**
   * L'appel d'inscription pour un visiteur sans compte.
   *
   * Faux sur la page d'inscription elle-même : une pilule qui mène au
   * formulaire déjà ouvert sous les yeux du visiteur n'est pas un appel, c'est
   * un doublon. La bascule vers la connexion, elle, vit dans le panneau.
   */
  showSignUp?: boolean;
  /**
   * La déconnexion, à droite de la barre.
   *
   * Absente de la page d'accueil : c'est une page de vente, lue par des
   * visiteurs qui n'ont pas de compte et par des comptes qui n'ont pas encore
   * d'espace. Y poser « Déconnexion » à côté de l'appel principal met une
   * sortie de session là où l'on demande une décision. Elle reste à un geste —
   * le tiroir mobile la porte, et les réglages du tableau de bord aussi.
   */
  showSignOut?: boolean;
} = {}) {
  const user = await getCurrentUser();
  const t = await getTranslations("common");

  // Identifié ne veut pas dire installé. Un compte gratuit ouvert il y a deux
  // minutes n'a ni fiche d'accueil ni analyse : son tableau de bord n'existe que
  // de nom, et le lui tendre dans la barre le déposait sur un écran vide. Tant
  // que rien ne tourne, la barre lui propose ce qui lui manque — les offres, ou
  // la mise en route dans la branche testée du parcours — plutôt qu'une porte
  // sur du vide.
  const [workspace, demoFirst] = await Promise.all([
    user ? hasReadyWorkspace(user.id) : Promise.resolve(false),
    isDemoFirst(),
  ]);
  const pending = demoFirst ? ROUTES.onboarding : ROUTES.pricing;

  // Rapport d'analyse et tarifs : aucune sortie latérale. À ces deux endroits, le
  // visiteur est dans un parcours de décision — seul le compte reste accessible.
  const links = minimal
    ? []
    : [
        { href: ROUTES.demo, label: t("demo") },
        { href: ROUTES.contact, label: t("contact") },
        { href: ROUTES.pricing, label: t("pricing") },
      ];

  // Identifié, on ramène au tableau de bord — l'ancienne page « mon compte » a
  // disparu, et c'est là que le client retrouve son projet et sa facturation ;
  // sinon on propose d'ouvrir un compte plutôt que la connexion. Un visiteur qui découvre le site n'a pas de compte à retrouver :
  // lui tendre « Connexion » lui demandait de se souvenir d'un mot de passe
  // qu'il n'a jamais créé. La connexion reste à un geste — depuis le tiroir
  // mobile, et depuis la page d'inscription qui l'annonce en tête.
  //
  // Bouton secondaire, pas primaire : la barre suit le visiteur sur toute la
  // page, une pilule noire pleine y entrerait en concurrence avec le CTA du
  // haut de page et avec la barre basse.
  const accountLink =
    user && workspace ? (
    <Link
      href={ROUTES.dashboard}
      className="cursor-pointer truncate text-sm text-muted transition-colors duration-200 hover:text-text"
    >
      {t("account")}
    </Link>
  ) : (
    <Link
      href={user ? pending : ROUTES.signUp}
      className="inline-flex shrink-0 cursor-pointer items-center justify-center whitespace-nowrap rounded-full border border-graphite bg-snow px-5 py-2.5 text-sm font-medium text-graphite transition-colors duration-200 hover:bg-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40"
    >
      {user && demoFirst ? t("finishSetup") : t("freeTrial")}
    </Link>
  );

  return (
    // Barre collante sur tout le site : le logo et le compte restent à portée
    // quelle que soit la profondeur de la page. `sticky` plutôt que `fixed` —
    // l'en-tête garde sa place dans le flux, donc aucune page n'a à réserver
    // l'espace sous la barre.
    //
    // `z-50` la met au-dessus du contenu et de la pilule flottante (`z-30`),
    // mais sous les calques modaux (`z-[90]` et plus) : le tiroir mobile et
    // l'overlay d'analyse continuent de la recouvrir.
    <header className="sticky top-0 z-50 w-full border-b border-fog/60 bg-bg/85 backdrop-blur-md">
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-5 py-2.5">
        {/* Le déclencheur du tiroir se place à gauche du logo — c'est le premier
            geste attendu sur mobile, il vient donc avant la marque. */}
        <div className="flex shrink-0 items-center gap-3">
          {backTo && user && (
            <Link
              href={backTo}
              aria-label={t("backToDashboard")}
              title={t("backToDashboard")}
              className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-fog text-steel transition-colors duration-200 hover:border-pebble hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40"
            >
              <RiArrowLeftLine className="size-5" aria-hidden />
            </Link>
          )}
          {!minimal && (
            <MobileMenu
              links={links}
              isAuthenticated={!!user}
              hasWorkspace={workspace}
              pendingHref={pending}
              labels={{
                menu: t("menu"),
                closeMenu: t("closeMenu"),
                account: t("account"),
                signIn: t("signIn"),
                freeTrial: t("freeTrial"),
              }}
            />
          )}
          <Logo />
        </div>

        {/* Barre desktop */}
        <div className="hidden items-center gap-5 sm:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="cursor-pointer text-sm text-muted transition-colors duration-200 hover:text-text"
            >
              {l.label}
            </Link>
          ))}
          {user ? (
            // La flèche de retour porte déjà la sortie : répéter le lien du
            // tableau de bord à droite, et poser la déconnexion à côté, ferait
            // trois issues pour un écran qui n'en demande qu'une. Même silence
            // là où la page refuse la sortie latérale (`showSession`).
            backTo || !showSession ? null : (
              <>
                {accountLink}
                {showSignOut && <SignOutButton />}
              </>
            )
          ) : (
            showSignUp && accountLink
          )}
          {!minimal && <NavCta label={t("analyzeMyBusiness")} />}
        </div>

        {/* Mobile : plus de bouton d'inscription dans la barre.

            Il n'y avait pas la place. « Commencer gratuitement » demande 194 px
            sur une ligne ; à côté du logo (191 px) et de la gouttière, il en
            faut 350, soit exactement la largeur utile d'un écran de 390 px. Le
            libellé se repliait donc sur deux lignes, ce qui doublait la hauteur
            de la barre, et à 320 px l'ensemble débordait de 33 px.

            L'inscription reste atteignable : le tiroir la porte sur la page
            d'accueil, et ailleurs ce sont les appels de la page elle-même —
            cartes tarifaires, bandeau de fin de rapport — qui y mènent.

            Un client identifié garde en revanche l'accès à son tableau de bord :
            c'est un lien de texte, il tient à côté du logo. Un compte sans
            espace, lui, n'a que la pilule d'offres à montrer — 194 px, la
            largeur qui ne rentre pas : le tiroir la porte déjà. */}
        {user && workspace && !backTo && showSession && (
          <div className="flex min-w-0 items-center gap-4 sm:hidden">{accountLink}</div>
        )}
      </nav>
    </header>
  );
}
