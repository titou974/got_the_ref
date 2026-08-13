import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { UrlAnalyzeForm } from "@/components/UrlAnalyzeForm";
import { WorksWith } from "@/components/WorksWith";

/**
 * L'analyse gratuite, désormais au milieu de la page plutôt qu'en haut : le
 * visiteur a vu la promesse, le produit et les preuves — c'est ici qu'il a une
 * raison de coller son adresse. L'ancre `#analyser` est conservée, tous les
 * liens du site (navigation, boutons de rapport) continuent d'y tomber juste.
 */
export async function FreeAuditSection() {
  const t = await getTranslations("audit");

  return (
    <section id="analyser" className="mx-auto w-full max-w-6xl scroll-mt-6 px-5 py-16 sm:py-20">
      <div className="card-cal overflow-hidden px-6 py-10 sm:px-10 sm:py-12">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-steel">{t("eyebrow")}</p>
          <h2 className="mt-2 text-balance text-3xl font-bold leading-tight sm:text-4xl">
            {t("titleBefore")} <span className="text-gradient">{t("titleHighlight")}</span>{" "}
            {t("titleAfter")}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-pretty text-muted">{t("subtitle")}</p>

          <ul className="mt-7 flex flex-wrap items-center justify-center gap-2">
            <EngineChip label="ChatGPT" src="/chatgpt.png" />
            <EngineChip label="Gemini" src="/gemini.webp" />
            <EngineChip label="Perplexity" src="/perplexity.png" />
            <EngineChip label="Claude" />
          </ul>
        </div>

        <div className="mx-auto mt-8 w-full max-w-lg">
          <UrlAnalyzeForm size="lg" />
        </div>

        <WorksWith className="mt-10" />
      </div>
    </section>
  );
}

function EngineChip({ label, src }: { label: string; src?: string }) {
  return (
    <li className="flex items-center gap-2 rounded-full border border-fog bg-mist px-3.5 py-2 text-sm font-medium text-graphite">
      <span className="flex h-4 w-4 items-center justify-center" aria-hidden>
        {src ? (
          <Image src={src} alt="" width={32} height={32} className="h-4 w-4 object-contain" />
        ) : (
          <ClaudeMark />
        )}
      </span>
      {label}
    </li>
  );
}

/** Marque Claude simplifiée — dessinée plutôt qu'importée, pour rester hors réseau. */
function ClaudeMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <g stroke="#d97757" strokeWidth="2.1" strokeLinecap="round">
        <path d="M12 3.5v17M3.5 12h17M6 6l12 12M18 6 6 18" />
      </g>
    </svg>
  );
}
