import { getTranslations } from "next-intl/server";
import { AGENCY_BENCHMARK_YEARLY, BOOST, SUBSCRIPTION_PRICE } from "@/constants/plans";

/** Montant formaté à la française, sans décimales (20 000 €). */
const euros = (amount: number) => `${amount.toLocaleString("fr-FR")} €`;

function Dash() {
  return (
    <span aria-hidden className="mt-2.5 h-[2px] w-3.5 shrink-0 rounded-full bg-ash" />
  );
}

function Check() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden className="mt-0.5 shrink-0">
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
 * Le comparatif, en deux cartes plutôt qu'en tableau : à gauche ce que coûte
 * l'alternative, à droite ce qu'on propose, chaque ligne séparée par un filet
 * pour qu'on lise deux colonnes en vis-à-vis. La carte de droite reprend la
 * surface sombre de l'abonnement — le seul endroit du site où le fond bascule,
 * et donc l'endroit où l'œil se pose en dernier.
 *
 * Les deux montants du bas viennent des constantes (`AGENCY_BENCHMARK_YEARLY`,
 * `BOOST`) : aucun chiffre n'est écrit en dur dans l'i18n. Côté got_the_ref,
 * c'est le ticket d'entrée réel qui s'affiche — le Coup de Boost, payé une fois
 * — et rien d'autre : un tarif barré à côté ferait douter du chiffre annoncé,
 * juste là où on demande de nous croire sur le coût.
 */
export async function PricingComparison({ cta }: { cta?: React.ReactNode }) {
  const t = await getTranslations("pricing.compare");
  const tp = await getTranslations("pricing");

  // Le budget mensuel d'agence se déduit du repère annuel, arrondi à la centaine :
  // deux chiffres qui se contredisent sur la même page seraient pires qu'un seul.
  const agencyMonthly = Math.round(AGENCY_BENCHMARK_YEARLY.min / 12 / 100) * 100;

  const agencyPoints = [
    t("agency.budget", { price: euros(agencyMonthly) }),
    ...(t.raw("agency.points") as string[]),
  ];
  const ourPoints = [
    t("ours.entry", { boost: euros(BOOST.price), monthly: euros(SUBSCRIPTION_PRICE) }),
    ...(t.raw("ours.points") as string[]),
  ];

  return (
    <section className="mt-16">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-balance text-2xl font-bold leading-tight sm:text-3xl">{t("title")}</h2>
        <p className="mx-auto mt-3 text-pretty text-sm text-muted">{t("subtitle")}</p>
      </div>

      <div className="mt-9 grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* L'alternative : lue, pas choisie — d'où les hachures et le registre sourd. */}
        <div
          className="rounded-[36px] border border-fog bg-mist p-6 sm:p-8"
          style={{
            backgroundImage:
              "repeating-linear-gradient(135deg, rgba(9,9,11,0.025) 0 1px, transparent 1px 9px)",
          }}
        >
          <h3 className="font-display text-xl font-bold text-steel">{t("agency.name")}</h3>

          <ul className="mt-5 divide-y divide-pebble/60">
            {agencyPoints.map((p) => (
              <li key={p} className="flex items-start gap-3 py-3.5 text-sm text-steel">
                <Dash />
                <span>{p}</span>
              </li>
            ))}
          </ul>

          <div className="mt-5 flex flex-wrap items-baseline justify-between gap-2 rounded-[24px] border border-pebble px-5 py-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-ash">
              {t("costLabel")}
            </span>
            <span className="font-display text-xl font-bold tabular-nums text-steel">
              {euros(AGENCY_BENCHMARK_YEARLY.min)}
              <span className="text-sm font-medium text-ash">{t("perYear")}</span>
            </span>
          </div>
        </div>

        {/* Nous */}
        <div className="rounded-[36px] bg-obsidian p-6 text-white shadow-[var(--shadow-md)] sm:p-8">
          <h3 className="font-display text-xl font-bold">{t("ours.name")}</h3>

          <ul className="mt-5 divide-y divide-white/10">
            {ourPoints.map((p) => (
              <li key={p} className="flex items-start gap-3 py-3.5 text-sm text-white/85">
                <Check />
                <span>{p}</span>
              </li>
            ))}
          </ul>

          <div className="mt-5 flex flex-wrap items-baseline justify-between gap-2 rounded-[24px] border border-white/15 bg-white/5 px-5 py-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-white/50">
              {t("costLabel")}
            </span>
            <span className="font-display text-xl font-bold tabular-nums">
              {euros(BOOST.price)}
              <span className="text-sm font-medium text-white/50"> {tp("boost.onceLabel")}</span>
            </span>
          </div>
        </div>
      </div>

      {cta && <div className="mt-8 flex justify-center">{cta}</div>}
    </section>
  );
}
