import { Nav } from "@/components/Nav";
import { AuthHeroAnimation } from "@/components/auth/AuthHeroAnimation";

/**
 * Le cadre de l'accueil client.
 *
 * Il reprend la mise en page des pages d'inscription — même bandeau Lottie,
 * même largeur de colonne — parce que le client vient tout juste d'en sortir :
 * changer de décor entre l'inscription et la première question donnerait
 * l'impression d'avoir été renvoyé sur un autre produit.
 *
 * Le compteur « ÉTAPE 03 / 06 » et la barre de progression ont disparu avec les
 * cinq autres questions : annoncer une progression sur un tunnel qui en compte
 * une seule reviendrait à inventer une longueur qu'il n'a pas.
 */
export function OnboardingShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-dvh flex-col bg-bg">
      <Nav minimal />

      {/* Même montage que l'écran d'inscription, dont le client sort à l'instant. */}
      <div className="mx-auto w-full max-w-lg">
        <AuthHeroAnimation className="px-5" />
      </div>

      <section className="mx-auto w-full max-w-lg flex-1 px-5 pb-40 pt-6">
        <h1 className="text-3xl font-bold leading-tight sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-3 text-base leading-relaxed text-muted">{subtitle}</p>}

        <div className="mt-8">{children}</div>
      </section>
    </main>
  );
}
