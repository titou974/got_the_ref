import Link from "next/link";
import { Nav } from "@/components/Nav";
import { AuthHeroAnimation } from "@/components/auth/AuthHeroAnimation";
import { ROUTES } from "@/constants/routes";
import {
  ONBOARDING_STEPS,
  previousStep,
  stepNumber,
  type OnboardingStep,
} from "@/features/onboarding/steps";

/**
 * Le cadre commun aux sept étapes de l'accueil.
 *
 * Il reprend la mise en page des pages d'inscription — même bandeau Lottie,
 * même largeur de colonne — parce que le client vient tout juste d'en sortir :
 * changer de décor entre le paiement et la première question donnerait
 * l'impression d'avoir été renvoyé sur un autre produit.
 *
 * Le compteur « ÉTAPE 03 / 07 » n'est pas décoratif non plus. Sept questions
 * annoncées, c'est un engagement tenable ; sept questions découvertes une par
 * une, c'est un tunnel dont on ne voit pas le bout, et on le quitte.
 */
export function OnboardingShell({
  step,
  title,
  subtitle,
  children,
}: {
  step: OnboardingStep;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const index = stepNumber(step);
  const total = ONBOARDING_STEPS.length;
  const back = previousStep(step);

  return (
    <main className="flex min-h-dvh flex-col bg-bg">
      <Nav minimal />

      {/* Même montage que l'écran d'inscription, dont le client sort à l'instant :
          la barre remonte sur le dernier quart du bandeau, qui ne porte que le
          sol de la scène. On récupère une hauteur d'écran sur mobile sans rien
          amputer du dessin. La progression se lit d'une ligne pleine, sans
          pourcentage — le compteur chiffré dit déjà où l'on en est. */}
      <div className="mx-auto w-full max-w-lg">
        <AuthHeroAnimation className="px-5" />

        <div className="-mt-[7%] px-5">
          <div className="h-1 w-full overflow-hidden rounded-pill bg-fog">
            <div
              className="h-full rounded-pill bg-obsidian transition-[width] duration-500 ease-out"
              style={{ width: `${(index / total) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <section className="mx-auto w-full max-w-lg flex-1 px-5 pb-40 pt-6">
        <div className="flex items-center gap-3">
          <p className="text-sm font-bold uppercase tracking-[0.14em]">
            Étape {String(index).padStart(2, "0")}
            <span className="text-muted"> / {String(total).padStart(2, "0")}</span>
          </p>

          {back && (
            <Link
              href={ROUTES.onboardingStep(back)}
              className="ml-auto cursor-pointer text-sm text-muted underline decoration-pebble underline-offset-4 transition-colors duration-200 hover:text-text"
            >
              Revenir
            </Link>
          )}
        </div>

        <h1 className="mt-4 text-3xl font-bold leading-tight sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-3 text-base leading-relaxed text-muted">{subtitle}</p>}

        <div className="mt-8">{children}</div>
      </section>
    </main>
  );
}
