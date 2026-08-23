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
}: {
  mode: "signin" | "signup";
  /** Page à rejoindre une fois identifié. */
  callbackURL: string;
  /** Bascule inscription ↔ connexion, destination conservée. */
  switchHref: string;
}) {
  return (
    <main className="flex min-h-dvh flex-col bg-bg">
      <Nav minimal />

      {/* Le bandeau animé, à la place de la carte du monde piquetée. Il suit la
          largeur du panneau : étalé sur toute la page, il écraserait le titre. */}
      <AuthHeroAnimation className="mx-auto max-w-lg px-5" />

      {/* Les trois repères se calent sur la même largeur que le bandeau : ils en
          prolongent le bloc plutôt que d'ouvrir une section à part. */}
      <AuthStats className="mx-auto w-full max-w-lg px-5 pb-2" />

      <section className="mx-auto w-full max-w-md flex-1 px-5 pb-16 pt-8 sm:pt-10">
        <AuthPanel
          mode={mode}
          callbackURL={callbackURL}
          googleEnabled={isGoogleAuthEnabled}
          switchHref={switchHref}
        />
      </section>
    </main>
  );
}
