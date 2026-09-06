import { scoreColor } from "@/lib/score";

/**
 * Les trois axes techniques du modèle GEO, en barres.
 *
 * Ils étaient jusqu'ici tracés en radar. À trois points, un radar est un
 * triangle : sa forme change du tout au tout selon l'ordre des axes, et deux
 * scores proches y deviennent illisibles. La barre dit la même chose sans
 * détour — la valeur est écrite, la longueur la confirme, et la couleur reprend
 * l'échelle des scores du reste du produit.
 */
export function AxisBars({ axes }: { axes: { label: string; score: number }[] }) {
  return (
    <div className="flex flex-col gap-3.5">
      {axes.map((axis) => {
        const color = scoreColor(axis.score);
        return (
          <div key={axis.label}>
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-slate">{axis.label}</span>
              <span className="font-bold tabular-nums" style={{ color }}>
                {axis.score}
              </span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-pill bg-mist">
              <span
                className="block h-full rounded-pill"
                style={{ width: `${axis.score}%`, background: color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
