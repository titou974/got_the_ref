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

// ── Neutralisation ───────────────────────────────────────────────────────────
//
// Les six animations ci-dessus venaient de la même série et partageaient trois
// verts exacts : une correspondance couleur par couleur suffisait. Une
// animation venue d'ailleurs n'a aucune couleur en commun avec elles, et aucune
// table de correspondance ne la ramènerait à la charte.
//
// On la convertit alors par la luminance : chaque couleur est remplacée par le
// gris du thème dont elle a la clarté. Le dessin garde ses contrastes — ce qui
// se détachait se détache encore, ce qui servait de fond reste en fond — et
// perd sa teinte. C'est la conversion d'une image couleur en noir et blanc,
// appliquée à un fichier vectoriel.
//
// Vide aujourd'hui, et c'est délibéré. `ai-assistant.json` y était passée le
// temps de servir l'écran d'attente ; elle n'y sert plus, et deux autres écrans
// l'affichent en couleur depuis toujours. La neutraliser leur retirait une
// couleur qu'ils n'avaient pas demandé à perdre. Le mécanisme reste, pour la
// prochaine animation venue d'une autre série.
const NEUTRALIZE = new Set([]);

/** La rampe neutre du thème, de l'obsidienne au blanc, en clarté. */
const NEUTRALS = [0.035, 0.247, 0.443, 0.631, 0.831, 0.925, 1];

/** Rec. 709 : la clarté perçue, pas la moyenne des trois canaux. */
function luminance(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Le gris de la rampe le plus proche en clarté. */
function toNeutral(r, g, b) {
  const l = luminance(r, g, b);
  const grey = NEUTRALS.reduce((best, step) =>
    Math.abs(step - l) < Math.abs(best - l) ? step : best,
  );
  return [grey, grey, grey];
}

function neutralize(node, counts) {
  if (Array.isArray(node)) {
    for (const item of node) neutralize(item, counts);
    return;
  }
  if (!node || typeof node !== "object") return;

  for (const [key, value] of Object.entries(node)) {
    // Une couleur pleine : `{ c: { a: 0, k: [r, g, b, a?] } }`.
    const k = key === "c" && value && typeof value === "object" ? value.k : null;
    if (Array.isArray(k) && k.length >= 3 && k.every((n) => typeof n === "number")) {
      const [r, g, b] = toNeutral(k[0], k[1], k[2]);
      value.k = k.length === 4 ? [r, g, b, k[3]] : [r, g, b];
      counts.couleurs = (counts.couleurs ?? 0) + 1;
      continue;
    }

    // Un dégradé : `{ g: { p: n, k: { k: [pos, r, g, b, pos, r, g, b, …] } } }`.
    // Les positions sont laissées telles quelles, seules les couleurs changent.
    const stops = key === "g" && value?.k?.k;
    if (Array.isArray(stops) && stops.length % 4 === 0) {
      for (let i = 0; i < stops.length; i += 4) {
        const [r, g, b] = toNeutral(stops[i + 1], stops[i + 2], stops[i + 3]);
        stops[i + 1] = r;
        stops[i + 2] = g;
        stops[i + 3] = b;
      }
      counts.degrades = (counts.degrades ?? 0) + 1;
      continue;
    }

    neutralize(value, counts);
  }
}

for (const file of readdirSync(DIR).sort()) {
  const path = join(DIR, file);
  const counts = {};

  if (TARGETS.has(file)) {
    const data = JSON.parse(readFileSync(path, "utf8"));
    repaint(data, counts);
    writeFileSync(path, JSON.stringify(data));
  } else if (NEUTRALIZE.has(file)) {
    const data = JSON.parse(readFileSync(path, "utf8"));
    neutralize(data, counts);
    writeFileSync(path, JSON.stringify(data));
  } else {
    continue;
  }

  const summary = Object.entries(counts)
    .map(([name, n]) => `${name} ×${n}`)
    .join(", ");
  console.log(`${file} — ${summary || "rien à repeindre"}`);
}
