import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ROUTES } from "@/constants/routes";

type Step = { title: string; caption: string };

/** Captures d'écran du cas réel — l'ordre suit le récit : question → réponses. */
const STEP_IMAGES = [
  { src: "/promptgptlacotriade.webp", position: "object-top" },
  { src: "/resultats-gpt-lacotriade.webp", position: "object-top" },
  { src: "/resultats-gemini-lacotriade.webp", position: "object-top" },
] as const;

/**
 * Preuve par l'exemple : un commerce réel cité par ChatGPT et Gemini, et l'avis
 * Google d'un client arrivé par l'IA. C'est l'argument central de la home —
 * il rend concret ce que l'analyse mesure.
 */
export async function ProofSection() {
  const t = await getTranslations("proof");
  const steps = t.raw("steps") as Step[];

  return (
    <section className="mx-auto w-full max-w-6xl px-5 py-16 sm:py-20">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-steel">
          {t("eyebrow")}
        </p>
        <h2 className="mt-2 text-balance text-3xl font-bold leading-tight sm:text-4xl">
          {t("title")}
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-pretty text-muted">{t("subtitle")}</p>
      </div>

      {/* Le récit en trois captures : la question, puis les deux réponses IA. */}
      <ol className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-3">
        {steps.map((step, i) => (
          <li
            key={step.title}
            className="flex flex-col items-center rounded-[28px] border border-fog bg-snow p-5 text-center"
          >
            <div className="w-full max-w-[240px] overflow-hidden rounded-[24px] bg-obsidian shadow-[var(--shadow-md)]">
              <Image
                src={STEP_IMAGES[i].src}
                alt={step.title}
                width={725}
                height={1568}
                sizes="(min-width: 640px) 240px, 70vw"
                className={`h-auto w-full ${STEP_IMAGES[i].position}`}
              />
            </div>
            <span className="mt-5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-obsidian text-xs font-bold text-white">
              {i + 1}
            </span>
            <h3 className="mt-3 font-semibold">{step.title}</h3>
            <p className="mt-1 text-sm text-muted">{step.caption}</p>
          </li>
        ))}
      </ol>

      {/* La conséquence commerciale : un client réel, arrivé par ChatGPT. */}
      <div className="mt-8 grid grid-cols-1 gap-6 rounded-[36px] border border-fog bg-snow p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center">
        <div className="grid grid-cols-2 gap-4">
          <Image
            src="/googlemapslacotriade.png"
            alt={t("mapsAlt")}
            width={540}
            height={893}
            sizes="(min-width: 1024px) 240px, 45vw"
            className="h-auto w-full rounded-2xl border border-fog"
          />
          <Image
            src="/avisgooglemapsdecouvertpargpt.png"
            alt={t("reviewAlt")}
            width={522}
            height={710}
            sizes="(min-width: 1024px) 240px, 45vw"
            className="h-auto w-full rounded-2xl border border-fog"
          />
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-steel">
            {t("resultEyebrow")}
          </p>
          <h3 className="mt-2 text-2xl font-bold leading-tight">{t("resultTitle")}</h3>
          <blockquote className="mt-4 border-l-2 border-obsidian pl-4 text-pretty text-lg leading-relaxed">
            {t("quote")}
          </blockquote>
          <p className="mt-2 text-sm text-muted">{t("quoteAuthor")}</p>
          <p className="mt-4 text-pretty text-sm text-muted">{t("resultBody")}</p>

          <Link
            href={`${ROUTES.home}#analyser`}
            className="mt-6 inline-flex cursor-pointer items-center gap-2 rounded-full bg-cta px-5 py-3 text-sm font-medium text-white shadow-[var(--shadow-pill)] transition-colors duration-200 hover:bg-cta-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40"
          >
            {t("cta")}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M5 12h14M13 6l6 6-6 6"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}
