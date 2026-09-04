/**
 * La page pendant que Google répond.
 *
 * Le relevé passe par un scraper et prend une minute ou deux. Un voile opaque
 * ferait attendre devant une porte fermée : on montre plutôt la page qui se
 * remplit, à sa forme définitive — l'échelle des trois gestes, l'avis en
 * chantier, la fiche à droite. Le client sait ce qui arrive avant que ça
 * arrive, et reconnaît l'écran quand il se pose.
 *
 * Les blocs ne scintillent pas tous : seuls ceux dont le contenu vient de
 * Google. Les cadres, eux, sont déjà en place — ils ne changeront plus.
 */
export function MapsSkeleton({ step }: { step: string }) {
  return (
    <div className="space-y-5" aria-busy aria-live="polite">
      <p className="sr-only">{step}</p>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4">
          <header className="space-y-2.5">
            <span className="block h-8 w-[19rem] max-w-full rounded-2xl shimmer" />
            <span className="block h-4 w-[26rem] max-w-full rounded-full bg-fog" />
          </header>

          <ol className="space-y-3">
            {[0, 1, 2].map((row) => (
              <li
                key={row}
                className="flex items-center gap-4 rounded-3xl border border-border bg-surface px-5 py-4 sm:px-[22px]"
              >
                <span
                  className={`grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full text-[15px] font-bold tabular-nums ${
                    row === 0 ? "bg-obsidian text-white" : "bg-mist text-ash"
                  }`}
                >
                  {row + 1}
                </span>
                <span className="min-w-0 flex-1 space-y-2">
                  <span
                    className="block h-4 rounded-full shimmer"
                    style={{ width: ["60%", "48%", "40%"][row] }}
                  />
                  <span
                    className="block h-3 rounded-full bg-fog"
                    style={{ width: ["82%", "70%", "64%"][row] }}
                  />
                </span>
                <span className="hidden h-9 w-24 shrink-0 rounded-pill bg-mist sm:block" />
              </li>
            ))}
          </ol>

          <section className="rounded-card-compact border border-border bg-surface p-5 sm:p-6">
            <div className="mb-4 space-y-2">
              <span className="block h-4 w-44 rounded-full shimmer" />
              <span className="block h-3 w-72 max-w-full rounded-full bg-fog" />
            </div>

            <div className="rounded-2xl border border-fog px-5 py-[18px]">
              <div className="flex items-start gap-3">
                <span className="h-10 w-10 shrink-0 rounded-full shimmer" />
                <div className="min-w-0 flex-1 space-y-2 pt-1">
                  <span className="block h-3.5 w-40 rounded-full shimmer" />
                  <span className="block h-3 w-24 rounded-full bg-fog" />
                </div>
              </div>

              <div className="mt-3.5 space-y-2">
                <span className="block h-3 w-full rounded-full shimmer" />
                <span className="block h-3 w-full rounded-full shimmer" />
                <span className="block h-3 w-2/3 rounded-full shimmer" />
              </div>

              <div className="mt-4 border-t border-fog pt-3.5">
                <span className="block h-[68px] w-full rounded-2xl bg-mist" />
              </div>
            </div>
          </section>

          <section className="rounded-card-compact border border-border bg-surface p-5 sm:p-6">
            <div className="mb-4 space-y-2">
              <span className="block h-4 w-40 rounded-full shimmer" />
              <span className="block h-3 w-64 max-w-full rounded-full bg-fog" />
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div className="w-full shrink-0 overflow-hidden rounded-xl border border-fog sm:w-[300px]">
                <div className="flex items-center gap-2.5 p-3">
                  <span className="h-[34px] w-[34px] shrink-0 rounded-md bg-mist" />
                  <span className="block h-3 w-32 rounded-full shimmer" />
                </div>
                <span className="block h-[190px] w-full bg-fog" />
                <div className="space-y-2 p-3">
                  <span className="block h-3 w-full rounded-full shimmer" />
                  <span className="block h-3 w-4/5 rounded-full shimmer" />
                </div>
              </div>

              <ul className="min-w-0 flex-1 space-y-2.5">
                {[0, 1, 2, 3].map((row) => (
                  <li key={row} className="flex items-center gap-3 px-4 py-3">
                    <span className="h-9 w-9 shrink-0 rounded-lg bg-mist" />
                    <span
                      className="block h-3.5 rounded-full shimmer"
                      style={{ width: ["58%", "44%", "50%", "38%"][row] }}
                    />
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>

        <div className="space-y-4">
          <div className="overflow-hidden rounded-3xl border border-border bg-surface">
            <div className="grid h-[76px] grid-cols-[2fr_1fr] gap-0.5">
              <span className="block shimmer" />
              <span className="block shimmer" />
            </div>
            <div className="space-y-2 px-4 pb-4 pt-3">
              <span className="block h-4 w-3/4 rounded-full shimmer" />
              <span className="block h-3 w-1/2 rounded-full bg-fog" />
              <span className="block h-3 w-2/3 rounded-full bg-fog" />
            </div>
            <div className="border-t border-fog px-4 py-2.5">
              <span className="block h-3 w-28 rounded-full bg-fog" />
            </div>
          </div>

          {[0, 1].map((card) => (
            <div key={card} className="rounded-3xl border border-border bg-surface p-[18px]">
              <span className="block h-3.5 w-24 rounded-full shimmer" />
              <div className="mt-3.5 space-y-2.5">
                {[0, 1, 2].map((row) => (
                  <span key={row} className="block h-3 w-full rounded-full bg-fog" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
