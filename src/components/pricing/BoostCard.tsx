import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { BoostCheckoutButton } from "@/components/BoostCheckoutButton";
import { BOOST } from "@/constants/plans";

/** Montant formaté à la française, sans décimales (49 €). */
const euros = (amount: number) => `${amount.toLocaleString("fr-FR")} €`;

function Check() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className="mt-0.5 shrink-0 text-obsidian"
    >
      <path
        d="M5 13l4 4L19 7"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * La rampe : les trois temps de la passe, et le trophée qui la termine — là où
 * l'abonnement, lui, n'a pas de fin. Tout le sens de l'offre tient dans cette
 * ligne : ça avance, ça arrive quelque part, puis ça s'arrête.
 *
 * Points et libellés partagent la même grille, une colonne par temps : c'est ce
 * qui garantit que chaque libellé tombe sous son point, quelle que soit la
 * largeur de la carte.
 */
function Ramp({ steps, note }: { steps: string[]; note: string }) {
  return (
    <div>
      <div className="grid grid-cols-[repeat(3,minmax(0,1fr))_auto] items-center gap-x-1.5 gap-y-2">
        {steps.map((step) => (
          <span key={step} className="flex items-center gap-1.5" aria-hidden>
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-obsidian" />
            <span className="h-px flex-1 bg-pebble" />
          </span>
        ))}
        <Image
          src="/trophee-3d.png"
          alt=""
          aria-hidden
          width={64}
          height={64}
          className="h-6 w-6 shrink-0 object-contain"
        />
        {/* Le libellé démarre sur le centre de son point, pas sur son bord
            gauche : sans ce décalage il glisse visiblement à gauche de la ligne.
            2 px et non 3 (la moitié du point) — la marge propre au glyphe
            fournit le pixel manquant, mesure faite. */}
        {steps.map((step) => (
          <span key={step} className="pl-[2px] text-[11px] font-medium text-ink">
            {step}
          </span>
        ))}
      </div>
      <p className="mt-1.5 text-[11px] text-steel">{note}</p>
    </div>
  );
}

/**
 * Le « Coup de Boost » : la carte claire, à côté de la carte sombre de
 * l'abonnement. Une passe des agents, payée une fois — la carte le dit trois
 * fois, et de trois manières : le rythme annoncé au-dessus (là où l'abonnement
 * propose un choix, celle-ci n'a qu'une option), le montant suivi de « une
 * fois », et la rampe qui se termine sur un butoir.
 *
 * La frontière avec l'abonnement est écrite en toutes lettres en bas de carte :
 * ce qui manque ici — la remesure et les publications dans la durée — est
 * exactement ce qu'on vend à côté.
 */
export async function BoostCard({
  analysisId,
  compact = false,
  className = "",
}: {
  /** Rapport à l'origine de l'achat, s'il y en a un : il est débloqué au retour. */
  analysisId?: string;
  /** Version resserrée, pour le bas de la home. */
  compact?: boolean;
  className?: string;
}) {
  const t = await getTranslations("pricing");
  const steps = t.raw("boost.steps") as string[];

  // En bas de home, la carte d'abonnement en face perd son roster d'agents : la
  // liste complète ferait dépasser le Coup de Boost de deux cents pixels sous
  // elle. On y garde les trois lignes qui font l'offre — la page tarifs, elle,
  // les donne toutes.
  const features = compact
    ? [
        t("boost.features.analysis"),
        t("boost.features.fix"),
        t("boost.features.articles", { count: BOOST.articles }),
      ]
    : [
        t("boost.features.analysis"),
        t("boost.features.measure"),
        t("boost.features.fix"),
        t("boost.features.articles", { count: BOOST.articles }),
        t("boost.features.report"),
      ];

  return (
    <div className={`flex h-full flex-col ${className}`}>
      {/* Le pendant des onglets de facturation de l'abonnement : même pilule,
          même hauteur — donc les deux cartes démarrent à la même ligne —, mais
          rien à choisir, l'offre n'a qu'un rythme. */}
      <div className="flex justify-center">
        <div className="inline-flex items-center rounded-full border border-fog bg-snow p-1 shadow-[var(--shadow-md)]">
          <span className="rounded-full px-5 py-2 text-sm font-medium text-muted">
            {t("boost.rhythm")}
          </span>
        </div>
      </div>

      <section
        className={`mt-5 flex flex-1 flex-col rounded-[36px] border border-pebble bg-snow shadow-[var(--shadow-md)] ${
          compact ? "p-6 pt-7 sm:p-7 sm:pt-8" : "p-6 pt-8 sm:p-9 sm:pt-10"
        }`}
      >
        <p className="text-xs font-semibold uppercase tracking-wider text-steel">
          {t("boost.eyebrow")}
        </p>
        <h2 className="mt-2 text-2xl font-bold">{t("boost.name")}</h2>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">{t("boost.tagline")}</p>

        <div
          className={`flex flex-wrap items-baseline gap-x-3 gap-y-1 ${compact ? "mt-4" : "mt-6"}`}
        >
          <span
            className={`font-display font-bold tabular-nums tracking-tight ${
              compact ? "text-4xl sm:text-5xl" : "text-5xl sm:text-6xl"
            }`}
          >
            {euros(BOOST.price)}
          </span>
          <span className="text-base text-muted">{t("boost.onceLabel")}</span>
        </div>

        {/* Même réserve de hauteur que la note de l'abonnement, en face : sans
            elle, les deux boutons ne tomberaient pas sur la même ligne. */}
        <p
          className={`min-h-[3.75rem] max-w-sm text-xs leading-relaxed text-steel ${
            compact ? "mt-3" : "mt-4"
          }`}
        >
          {t("boost.terms")}
          {" · "}
          {t("vat")}
        </p>

        <div className={compact ? "mt-5" : "mt-7"}>
          <BoostCheckoutButton label={t("boost.cta")} analysisId={analysisId} />
          <p className="mt-2.5 text-center text-xs text-muted">{t("boost.ctaNote")}</p>
        </div>

        <div className={compact ? "mt-6" : "mt-7"}>
          <Ramp steps={steps} note={t("boost.stepsNote")} />
        </div>

        <ul className={`space-y-2.5 ${compact ? "mt-6" : "mt-7"}`}>
          {features.map((f) => (
            <li key={f} className="flex items-start gap-2.5 text-sm text-ink">
              <Check />
              <span>{f}</span>
            </li>
          ))}
        </ul>

        {/* Collé au bas de la carte : quand les deux colonnes s'alignent sur la
            même hauteur, l'espace en trop tombe au-dessus de ce bloc, jamais
            entre deux lignes de la liste. */}
        <div className="mt-6 flex flex-1 flex-col justify-end">
          <p className="rounded-2xl bg-mist px-4 py-3 text-xs leading-relaxed text-steel">
            {t("boost.limit")}
          </p>
        </div>
      </section>
    </div>
  );
}
