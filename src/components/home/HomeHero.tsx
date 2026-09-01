import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { RotatingWord } from "./RotatingWord";
import { GoogleMark } from "./GoogleMark";
import { AiSearchSimulation } from "@/components/AiSearchSimulation";
import { ROUTES } from "@/constants/routes";
import { TRIAL, hasActiveSubscription } from "@/constants/plans";
import { getCurrentUser } from "@/lib/auth";

/**
 * Ancre du haut de page, partagée avec `StickyCtaBar` : la barre basse
 * n'apparaît qu'une fois ce bloc dépassé.
 */
export const HERO_ID = "hero";

/** Les moteurs dont on parle en haut de page — logos servis depuis /public. */
const ENGINES = [
  { src: "/chatgpt.png", altKey: "logoOpenaiAlt" },
  { src: "/gemini.webp", altKey: "logoGeminiAlt" },
  { src: "/perplexity.png", altKey: "logoPerplexityAlt" },
] as const;

/**
 * Logos affichés devant le mot qui tourne dans le titre. L'ordre suit celui de
 * `homeHero.engines` dans les traductions — ChatGPT, Gemini, Perplexity, puis
 * Google, dont la marque est un SVG et non une image.
 */
const HEADING_MARKS = [
  ...ENGINES.map((engine) => (
    <Image
      key={engine.src}
      src={engine.src}
      alt=""
      aria-hidden
      width={64}
      height={64}
    />
  )),
  <GoogleMark key="google" size={22} />,
];

/**
 * Haut de page : à gauche une promesse et un seul bouton, à droite la
 * conversation IA qui se joue toute seule — c'est elle qui fait comprendre le
 * produit en trois secondes, avant la moindre ligne lue.
 *
 * Le champ d'analyse, lui, vit plus bas (section « Analyse gratuite ») : en
 * haut, un seul geste est proposé, ouvrir un compte.
 */
export async function HomeHero() {
  const t = await getTranslations("homeHero");
  const th = await getTranslations("home");

  // Un compte déjà identifié n'arrive plus jusqu'ici — la home le renvoie chez
  // lui — mais le hero sert aussi ailleurs, et le bouton doit rester juste : il
  // mène au tableau de bord pour qui en a déjà un, à l'inscription sinon.
  const user = await getCurrentUser();
  const home = hasActiveSubscription(user?.subscription);

  return (
    // `id` lu par `StickyCtaBar` : c'est le passage sous ce bloc qui déclenche
    // l'apparition de la barre basse.
    <section
      id={HERO_ID}
      className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-10 px-5 pb-8 pt-6 lg:grid-cols-2 lg:gap-14 lg:pt-10"
    >
      <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
        <div className="flex items-center gap-3">
          {ENGINES.map((engine) => (
            <div
              key={engine.src}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-fog bg-snow p-2"
            >
              <Image
                src={engine.src}
                alt={th(engine.altKey)}
                width={100}
                height={100}
              />
            </div>
          ))}
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-fog bg-snow p-2">
            <GoogleMark size={22} />
          </div>
        </div>

        <h1 className="mt-6 text-balance text-4xl font-bold leading-[1.05] sm:text-5xl lg:text-[3.4rem]">
          {t("headingBefore")}{" "}
          <RotatingWord
            words={t.raw("engines") as string[]}
            marks={HEADING_MARKS}
          />{" "}
          {t("headingAfter")}
        </h1>

        <p className="mt-5 max-w-md text-pretty text-base text-muted sm:text-lg">
          {t("subtitle")}
        </p>

        {/* CTA unique : démarrer l'essai. L'inscription précède les tarifs —
            avec Google branché, ouvrir un compte tient en un geste — et c'est
            sur les tarifs que les trois jours se prennent, carte enregistrée
            chez Stripe, rien débité avant la fin. */}
        <Link
          href={home ? ROUTES.dashboard : ROUTES.signUp}
          className="mt-8 inline-flex cursor-pointer items-center gap-2 rounded-full bg-cta px-7 py-4 text-base font-medium text-white shadow-[var(--shadow-pill)] transition-colors duration-200 hover:bg-cta-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40"
        >
          {home ? t("ctaDashboard") : t("cta", { days: TRIAL.days })}
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden
          >
            <path
              d="M5 12h14M13 6l6 6-6 6"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>

        {/* Aucun prix au-dessus du pli : la home vend l'essai, la page tarifs vend
            l'abonnement. Ici, on lève le risque plutôt que d'annoncer un montant. */}
        <p className="mt-4 flex items-center gap-2 text-xs text-graphite">
          <span
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-obsidian text-white"
            aria-hidden
          >
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none">
              <path
                d="m5 12.5 4.5 4.5L19 7"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          {t("guaranteeMain")}
        </p>
      </div>

      {/* La conversation IA, jouée en boucle : la démonstration avant l'argument. */}
      <div className="w-full">
        <AiSearchSimulation />
        <p className="mt-3 text-center text-xs text-muted">
          {th("simulationCaption")}
        </p>
      </div>
    </section>
  );
}
