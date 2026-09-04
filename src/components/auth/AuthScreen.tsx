import { Nav } from "@/components/Nav";
import { AuthHeroAnimation } from "@/components/auth/AuthHeroAnimation";
import { AuthPanel } from "@/components/auth/AuthPanel";
import { AuthStats } from "@/components/auth/AuthStats";
import { isGoogleAuthEnabled } from "@/features/auth/better-auth.config";

/**
 * L'écran commun à l'inscription et à la connexion : un bandeau animé en tête,
 * les trois repères chiffrés dessous, puis le panneau d'authentification.
 *
 * `Nav minimal` : ici comme sur la page tarifs, le visiteur est dans un parcours
 * de décision — on ne lui rouvre pas de sortie latérale.
 */
export function AuthScreen({
  mode,
  callbackURL,
  switchHref,
  error = null,
  notice = null,
}: {
  mode: "signin" | "signup";
  /** Page à rejoindre une fois identifié. */
  callbackURL: string;
  /** Bascule inscription ↔ connexion, destination conservée. */
  switchHref: string;
  /** Échec renvoyé par Google, déjà traduit. */
  error?: string | null;
  /** Confirmation à afficher en tête — mot de passe réinitialisé, par exemple. */
  notice?: string | null;
}) {
  return (
    <main className="flex min-h-dvh flex-col bg-bg">
      {/* Pas d'appel d'inscription sur l'écran d'inscription : le formulaire est
          juste dessous, et la pilule n'y menait que par un détour. Sur la
          connexion elle garde son sens — c'est la seule invitation à ouvrir un
          compte pour qui n'en a pas. */}
      <Nav minimal showSignUp={mode !== "signup"} />

      {/* Le bandeau animé, à la place de la carte du monde piquetée. Il suit la
          largeur du panneau : étalé sur toute la page, il écraserait le titre.
          Les repères remontent par-dessus son dernier quart — celui-ci ne porte
          que le sol de la scène, et l'écran d'inscription tient ainsi en une
          hauteur de plus sans rien amputer du dessin. */}
      <div className="mx-auto w-full max-w-lg">
        <AuthHeroAnimation className="px-5" />
        <AuthStats className="-mt-[7%] w-full px-5" />
      </div>

      <section className="mx-auto w-full max-w-md flex-1 px-5 pb-10 pt-6">
        <AuthPanel
          mode={mode}
          callbackURL={callbackURL}
          googleEnabled={isGoogleAuthEnabled}
          switchHref={switchHref}
          error={error}
          notice={notice}
        />
      </section>
    </main>
  );
}
