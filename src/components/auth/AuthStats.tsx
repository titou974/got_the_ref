import { getTranslations } from "next-intl/server";
import { ADOPTERS_COUNT } from "@/constants/site";
import { GUARANTEE_DAYS } from "@/constants/plans";

/** Nombre de moteurs suivis, aligné sur les logos du haut de la home. */
const TRACKED_ENGINES = 4;

/**
 * Les trois repères posés sous le bandeau animé des pages d'inscription et de
 * connexion : adoption, périmètre, garantie.
 *
 * Ils ne servent pas à décorer. À l'instant où l'on demande une adresse e-mail,
 * le visiteur cherche une raison de la donner ; ces trois chiffres la donnent
 * sans une phrase de vente. Les valeurs viennent des constantes du produit —
 * `ADOPTERS_COUNT` est une allégation commerciale (cf. la note qui l'accompagne)
 * et doit rester alignée sur le nombre réel de comptes.
 *
 * Les icônes sont décoratives : la valeur et son libellé portent déjà le sens.
 */
export async function AuthStats({ className = "" }: { className?: string }) {
  const t = await getTranslations("auth");

  const stats = [
    { icon: <StoreIcon />, value: `${ADOPTERS_COUNT}+`, label: t("statAdoptersLabel") },
    { icon: <TrendIcon />, value: String(TRACKED_ENGINES), label: t("statEnginesLabel") },
    { icon: <ClockIcon />, value: t("statGuaranteeValue", { days: GUARANTEE_DAYS }), label: t("statGuaranteeLabel") },
  ];

  return (
    <ul className={`grid grid-cols-3 items-start ${className}`}>
      {stats.map((stat, index) => (
        <li
          key={stat.label}
          // Les séparateurs sont portés par les bordures gauches plutôt que par
          // des éléments dédiés : rien à masquer sur la première colonne.
          className={`flex flex-col items-center px-2 text-center ${
            index > 0 ? "border-l border-fog" : ""
          }`}
        >
          <span
            aria-hidden
            className="flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-pebble text-muted sm:h-14 sm:w-14"
          >
            {stat.icon}
          </span>
          <span className="mt-3 text-xl font-bold leading-none sm:text-2xl">{stat.value}</span>
          <span className="mt-1.5 text-xs text-muted sm:text-sm">{stat.label}</span>
        </li>
      ))}
    </ul>
  );
}

function StoreIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 9.5V19a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M3.5 6.2 4.8 4h14.4l1.3 2.2a3 3 0 0 1-5.25 2.9 3 3 0 0 1-5.25 0 3 3 0 0 1-5.25-2.9Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M10 20v-4.5h4V20" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function TrendIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 15.5 9 10l3.5 3.5L20 6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M15 6h5v5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 7.5V12l3 1.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
