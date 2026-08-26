// Repeint les animations Lottie d'attente dans la palette du thème.
//
// Ces animations ont été dessinées à l'époque de la charte émeraude : trois
// verts, du plus soutenu au plus pâle. Le thème actuel n'a aucun accent
// chromatique dans l'interface — le contraste s'y fait au graphite — et ce vert
// était devenu la seule couleur de toute la page pendant l'attente.
//
// La correspondance garde les trois niveaux de la rampe d'origine, de sorte que
// le dessin reste lisible : ce qui portait le trait principal reste le plus
// sombre, ce qui servait de fond reste le plus clair.
//
//   node scripts/recolor-lottie.mjs
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "lottie");

/** Émeraude d'origine → graphite du thème, niveau par niveau. */
const RAMP = [
  { from: [0.067, 0.706, 0.549], to: [0.035, 0.035, 0.043], nm: "#11b48c → obsidian" },
  { from: [0.247, 0.839, 0.678], to: [0.443, 0.443, 0.478], nm: "#3fd6ad → steel" },
  { from: [0.498, 0.914, 0.812], to: [0.831, 0.831, 0.847], nm: "#7fe9cf → pebble" },
];

/** Les animations d'attente, et elles seules : les autres viennent d'ailleurs. */
const TARGETS = new Set([
  "citability.json",
  "crawlers.json",
  "fetch.json",
  "ranking.json",
  "recommend.json",
  "score.json",
]);

const near = (a, b) => Math.abs(a - b) < 0.004;

/** Une couleur Lottie est un `{ a: 0, k: [r, g, b, a] }` posé sous la clé `c`. */
function repaint(node, counts) {
  if (Array.isArray(node)) {
    for (const item of node) repaint(item, counts);
    return;
  }
  if (!node || typeof node !== "object") return;

  for (const [key, value] of Object.entries(node)) {
    const k = key === "c" && value && typeof value === "object" ? value.k : null;
    if (Array.isArray(k) && k.length === 4 && k.every((n) => typeof n === "number")) {
      const match = RAMP.find((step) => step.from.every((n, i) => near(n, k[i])));
      if (match) {
        value.k = [...match.to, k[3]];
        counts[match.nm] = (counts[match.nm] ?? 0) + 1;
      }
      continue;
    }
    repaint(value, counts);
  }
}

for (const file of readdirSync(DIR).sort()) {
  if (!TARGETS.has(file)) continue;
  const path = join(DIR, file);
  const data = JSON.parse(readFileSync(path, "utf8"));
  const counts = {};
  repaint(data, counts);
  writeFileSync(path, JSON.stringify(data));
  const summary = Object.entries(counts)
    .map(([name, n]) => `${name} ×${n}`)
    .join(", ");
  console.log(`${file} — ${summary || "rien à repeindre"}`);
}
