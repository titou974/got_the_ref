"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

/**
 * Les tracés du tableau de bord : une courbe de fond pour la carte de tête, une
 * miniature pour les chiffres, un demi-anneau pour la note, des barres pour les
 * mentions modèle par modèle.
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

export type MonthBar = {
  /** Le mois abrégé écrit sous la barre, « août », « sept. »… */
  label: string;
  value: number;
};

/**
 * Les mentions mois par mois, sur douze mois.
 *
 * Des barres et non une aire : ces relevés sont mensuels, chacun mesuré à part,
 * et une courbe continue laisserait croire à une mesure de tous les jours.
 * L'axe des mois reste écrit en entier — douze repères tiennent, même sur un
 * téléphone, à condition de les incliner un peu.
 */
export function MonthlyMentionsChart({ data }: { data: MonthBar[] }) {
  return (
    <div className="h-48 w-full sm:h-56">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        <BarChart data={data} margin={{ top: 12, right: 4, bottom: 0, left: 4 }}>
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            interval={0}
            tick={{ fill: "#a1a1aa", fontSize: 10 }}
          />
          <YAxis hide domain={[0, "dataMax + 1"]} />
          <Bar
            dataKey="value"
            fill={EMBER}
            radius={[6, 6, 0, 0]}
            maxBarSize={34}
            isAnimationActive={false}
          >
            <LabelList
              dataKey="value"
              position="top"
              className="fill-obsidian"
              fontSize={11}
              fontWeight={600}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export type ModelBar = {
  /** Le nom du modèle, écrit à gauche de sa barre. */
  label: string;
  value: number;
  /** La plateforme, qui décide de la couleur : Google, ChatGPT, autre. */
  platform: string;
};

/** La couleur d'une barre, une par plateforme pour les distinguer d'un coup d'œil. */
function barColor(platform: string): string {
  if (platform === "google") return INK;
  if (platform === "chat_gpt") return EMBER;
  return ORCHID;
}

/**
 * Les mentions par modèle, en barres horizontales.
 *
 * Horizontales et non verticales : les noms de modèles sont longs (« Aperçus IA
 * de Google »), et verticalement ils se coucheraient ou se tronqueraient. La
 * hauteur suit le nombre de barres — un graphique à trois modèles ne doit pas
 * réserver la place de huit.
 */
export function ModelMentionsChart({ data }: { data: ModelBar[] }) {
  const height = Math.max(120, data.length * 46 + 16);

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 44, bottom: 4, left: 0 }}
          barCategoryGap={12}
        >
          <XAxis type="number" hide domain={[0, "dataMax"]} />
          <YAxis
            type="category"
            dataKey="label"
            tickLine={false}
            axisLine={false}
            width={148}
            tick={{ fill: "#71717a", fontSize: 12 }}
          />
          <Bar dataKey="value" radius={[6, 6, 6, 6]} isAnimationActive={false} barSize={22}>
            {data.map((entry) => (
              <Cell key={entry.label} fill={barColor(entry.platform)} />
            ))}
            <LabelList
              dataKey="value"
              position="right"
              className="fill-obsidian"
              fontSize={12}
              fontWeight={600}
            />
          </Bar>
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
