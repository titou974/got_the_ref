import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { UrlAnalyzeForm } from "@/components/UrlAnalyzeForm";
import { AuditAnchorLanding } from "@/components/home/AuditAnchorLanding";
import { WorksWith } from "@/components/WorksWith";
import { getCurrentUser } from "@/lib/auth";
import { isGoogleAuthEnabled } from "@/features/auth/better-auth.config";
import { isOnboardingComplete } from "@/features/onboarding/queries";

/**
 * L'analyse gratuite, désormais au milieu de la page plutôt qu'en haut : le
 * visiteur a vu la promesse, le produit et les preuves — c'est ici qu'il a une
 * raison de coller son adresse. L'ancre `#analyser` est conservée, tous les
 * liens du site (navigation, boutons de rapport) continuent d'y tomber juste.
 */
/**
 * L'ancre du formulaire. `ROUTES.homeAudit` (`/#analyser`) et son alias court
 * `ROUTES.freeAudit` (`/analyse-gratuite`, redirigé dans `next.config.ts`) y
 * mènent tous les deux.
 */
const AUDIT_ANCHOR = "analyser";

export async function FreeAuditSection() {
  const t = await getTranslations("audit");
  // Visiteur non connecté : l'analyse gratuite passe par une modale
  // d'inscription — Google, ou une adresse et un mot de passe —, et le compte
  // gratuit ouvre le tableau de bord où l'analyse se joue. Un membre connecté
  // n'a rien à donner de plus.
  //
  // Reste le cas du milieu, et c'est lui que ce formulaire doit servir : un
  // compte ouvert mais sans espace de travail — souvent revenu des tarifs sans
  // rien avoir pris. Pas de modale à lui montrer, mais pas de rapport public
  // non plus : son site remplit sa fiche d'accueil et l'emmène sur son tableau
  // de bord. Ce formulaire est la seule porte qui l'ouvre (cf.
  // `features/onboarding/access.ts`), il doit donc l'ouvrir vraiment.
  const user = await getCurrentUser();
  const openDashboard = user ? !(await isOnboardingComplete(user.id)) : false;

  return (
    <section id={AUDIT_ANCHOR} className="mx-auto w-full max-w-6xl scroll-mt-6 px-5 py-16 sm:py-20">
      <AuditAnchorLanding targetId={AUDIT_ANCHOR} />
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
          <UrlAnalyzeForm
            size="lg"
            askEmail={!user}
            openDashboard={openDashboard}
            googleEnabled={isGoogleAuthEnabled}
          />
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
