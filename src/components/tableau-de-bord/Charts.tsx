"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

/**
 * Les tracés du tableau de bord : une courbe de fond pour la carte de tête, une
 * miniature pour les chiffres, un demi-anneau pour la note, des barres groupées
 * pour l'évolution des mentions modèle d'IA par modèle d'IA.
 *
 * Aucun axe des ordonnées, aucune infobulle : ces graphiques disent une allure,
 * et le chiffre exact est déjà écrit à côté en gros. Les axes ne feraient que
 * rétrécir la courbe.
 */

const INK = "#09090b";
const EMBER = "#ff5a00";
const ORCHID = "#fe45e2";

export type Point = { date: string; value: number };

/** La courbe principale : aire dégradée, repères de dates en bas. */
export function TrafficChart({ data, labels }: { data: Point[]; labels: string[] }) {
  return (
    <div className="h-56 w-full sm:h-64">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        <AreaChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
          <defs>
            <linearGradient id="aiTrafficFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={EMBER} stopOpacity={0.22} />
              <stop offset="100%" stopColor={EMBER} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            ticks={labels}
            tick={{ fill: "#a1a1aa", fontSize: 11 }}
            minTickGap={24}
          />
          <YAxis hide domain={[0, "dataMax + 2"]} />
          <Area
            type="monotone"
            dataKey="value"
            stroke={EMBER}
            strokeWidth={2}
            fill="url(#aiTrafficFill)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Une plateforme dans la légende : sa clé dans les lignes, son nom, sa couleur. */
export type DeltaSeries = {
  /** La clé lue dans chaque ligne, « google », « chat_gpt »… */
  key: string;
  label: string;
  color: string;
};

/** Un mois du graphique : son étiquette, puis une valeur par plateforme. */
export type DeltaRow = { label: string } & Record<string, string | number>;

/**
 * Les couleurs des plateformes, dans l'ordre où elles arrivent.
 *
 * Le noir d'abord, parce que la première série est celle des aperçus IA de
 * Google — la plus fournie, celle qui doit se lire d'un coup d'œil.
 */
export const DELTA_COLORS = [INK, EMBER, ORCHID];

/**
 * L'évolution mensuelle, une case de couleur par modèle d'IA.
 *
 * Des barres groupées : à chaque mois, une barre par plateforme, côte à côte.
 * C'est ce qui permet de lire deux choses à la fois — la marche du mois, et
 * lequel des modèles la produit.
 *
 * Ce que ces barres portent est un écart, pas un total : DataForSEO rend la
 * variation par rapport au mois précédent. Une barre peut donc descendre sous
 * zéro, d'où la ligne de base tracée à 0 et le domaine ouvert vers le bas ;
 * sans elle, une baisse se lirait comme une hausse.
 */
export function PlatformDeltaChart({
  rows,
  series,
}: {
  rows: DeltaRow[];
  series: DeltaSeries[];
}) {
  return (
    <div className="h-52 w-full sm:h-60">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        <BarChart data={rows} margin={{ top: 12, right: 4, bottom: 0, left: 4 }}>
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            interval={0}
            tick={{ fill: "#a1a1aa", fontSize: 10 }}
          />
          <YAxis hide domain={["dataMin - 1", "dataMax + 1"]} />
          <ReferenceLine y={0} stroke="#e4e4e7" strokeWidth={1} />
          <Legend
            verticalAlign="bottom"
            height={28}
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 11, color: "#71717a" }}
          />
          {series.map((entry) => (
            <Bar
              key={entry.key}
              dataKey={entry.key}
              name={entry.label}
              fill={entry.color}
              radius={[4, 4, 0, 0]}
              maxBarSize={22}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** La miniature d'une carte de chiffre. */
export function Sparkline({ data }: { data: Point[] }) {
  return (
    <div className="h-12 w-24">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        <LineChart data={data} margin={{ top: 4, right: 2, bottom: 4, left: 2 }}>
          <YAxis hide domain={["dataMin", "dataMax"]} />
          <Line
            type="monotone"
            dataKey="value"
            stroke={INK}
            strokeWidth={1.75}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Le demi-anneau de note. Tracé à la main plutôt qu'avec la bibliothèque : un
 * arc et un chiffre au centre n'ont pas besoin d'un graphique complet.
 */
export function Gauge({
  value,
  label,
  caption,
}: {
  value: number;
  label: string;
  caption?: string;
}) {
  const radius = 68;
  const circumference = Math.PI * radius;
  const filled = Math.max(0, Math.min(100, value)) / 100;

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 160 92" className="w-full max-w-[220px]" role="img" aria-label={label}>
        <path
          d="M12 82a68 68 0 0 1 136 0"
          fill="none"
          stroke="#ececee"
          strokeWidth="14"
          strokeLinecap="round"
        />
        <path
          d="M12 82a68 68 0 0 1 136 0"
          fill="none"
          stroke={INK}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={`${circumference * filled} ${circumference}`}
        />
        <text
          x="80"
          y="70"
          textAnchor="middle"
          className="fill-obsidian font-display"
          fontSize="30"
          fontWeight="700"
        >
          {Math.round(value)}
        </text>
      </svg>
      <p className="-mt-1 text-[11px] font-semibold uppercase tracking-wider text-steel">{label}</p>
      {caption ? <p className="mt-1 text-center text-xs text-muted">{caption}</p> : null}
    </div>
  );
}
