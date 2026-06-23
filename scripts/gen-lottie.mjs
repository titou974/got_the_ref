// Génère des animations Lottie JSON (loop seamless, palette émeraude) dans public/lottie/.
// Format Lottie 5.7 — canvas 240x240, 60fps, 120 frames (boucle de 2 s).
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "lottie");
mkdirSync(OUT, { recursive: true });

const W = 240, H = 240, FR = 60, OP = 120, C = 120; // centre

// Palette (RGBA 0..1)
const E1 = [0.067, 0.706, 0.549, 1]; // #11b48c
const E2 = [0.247, 0.839, 0.678, 1]; // #3fd6ad
const E3 = [0.498, 0.914, 0.812, 1]; // #7fe9cf

// Easings
const LIN_O = { x: [0], y: [0] };
const LIN_I = { x: [1], y: [1] };
const EASE_O = { x: [0.6], y: [0] };
const EASE_I = { x: [0.4], y: [1] };

// Helpers de propriété
const sk = (k) => ({ a: 0, k });
const kf = (frames, ease = true) =>
  frames.map((f, idx) =>
    idx === frames.length - 1
      ? { t: f.t, s: f.s }
      : { t: f.t, s: f.s, o: ease ? EASE_O : LIN_O, i: ease ? EASE_I : LIN_I },
  );
const ak = (frames, ease = true) => ({ a: 1, k: kf(frames, ease) });

// Shapes
const ellipse = (size, p = [0, 0]) => ({ ty: "el", d: 1, s: sk(size), p: sk(p), nm: "el" });
const rect = (size, r = 0, p = [0, 0]) => ({ ty: "rc", d: 1, s: sk(size), p: sk(p), r: sk(r), nm: "rc" });
const star = (or, ir, pts = 4) => ({
  ty: "sr", sy: 1, d: 1, pt: sk(pts), p: sk([0, 0]), r: sk(0),
  or: sk(or), os: sk(0), ir: sk(ir), is: sk(0), nm: "star",
});
const fill = (c, o = 100) => ({ ty: "fl", c: sk(c), o: sk(o), r: 1, bm: 0, nm: "fl" });
const stroke = (c, w, o = 100) => ({ ty: "st", c: sk(c), o: sk(o), w: sk(w), lc: 2, lj: 2, ml: 1, bm: 0, nm: "st" });
const trim = (s, e, o = 0) => ({ ty: "tm", s: sk(s), e: sk(e), o: sk(o), m: 1, nm: "tm" });

// Transform de groupe (2D)
const tr = ({ p = sk([0, 0]), a = sk([0, 0]), s = sk([100, 100]), r = sk(0), o = sk(100) } = {}) => ({
  ty: "tr", p, a, s, r, o, sk: sk(0), sa: sk(0), nm: "tr",
});
const group = (items) => ({ ty: "gr", it: items, nm: "gr", bm: 0 });

// Layer shape
let _ind = 0;
const layer = (shapes, ks = {}) => ({
  ddd: 0, ind: ++_ind, ty: 4, nm: "l", sr: 1,
  ks: {
    o: ks.o ?? sk(100),
    r: ks.r ?? sk(0),
    p: ks.p ?? sk([C, C, 0]),
    a: ks.a ?? sk([0, 0, 0]),
    s: ks.s ?? sk([100, 100, 100]),
  },
  ao: 0, shapes, ip: 0, op: OP, st: 0, bm: 0,
});

const comp = (nm, layers) => ({ v: "5.7.4", fr: FR, ip: 0, op: OP, w: W, h: H, nm, ddd: 0, assets: [], layers });

function save(name, data) {
  _ind = 0;
  writeFileSync(join(OUT, name), JSON.stringify(data));
  console.log("✓", name);
}

/* ───────────────────────── RADAR / SCAN ───────────────────────── */
// Onde concentrique échantillonnée (le saut de boucle est masqué par opacité ~0).
function ringPulse(offset, color) {
  const P = 60; // période en frames
  const frames = [];
  for (let t = 0; t <= OP; t += 3) {
    const lp = (((t - offset) % P) + P) % P / P; // 0..1
    const scale = 26 + 100 * lp;
    const op = lp < 0.12 ? (lp / 0.12) * 70 : 70 * (1 - (lp - 0.12) / 0.88);
    frames.push({ t, scale, op: Math.max(0, op) });
  }
  return group([
    ellipse([150, 150]),
    stroke(color, 5),
    tr({
      s: { a: 1, k: kf(frames.map((f) => ({ t: f.t, s: [f.scale, f.scale] })), true) },
      o: { a: 1, k: kf(frames.map((f) => ({ t: f.t, s: [f.op] })), true) },
    }),
  ]);
}
function radar() {
  const sweep = layer(
    [group([ellipse([150, 150]), stroke(E2, 6), trim(0, 26, 0), tr()])],
    { r: ak([{ t: 0, s: [0] }, { t: OP, s: [360] }], false) },
  );
  const dimRing = layer([group([ellipse([150, 150]), stroke(E1, 1.5, 22), tr()])]);
  const ring1 = layer([ringPulse(0, E3)]);
  const ring2 = layer([ringPulse(30, E2)]);
  const core = layer([group([ellipse([34, 34]), fill(E1), tr()])], {
    s: ak([{ t: 0, s: [88, 88, 100] }, { t: 60, s: [106, 106, 100] }, { t: 120, s: [88, 88, 100] }]),
  });
  const coreGlow = layer([group([ellipse([60, 60]), fill(E2, 16), tr()])], {
    s: ak([{ t: 0, s: [80, 80, 100] }, { t: 60, s: [120, 120, 100] }, { t: 120, s: [80, 80, 100] }]),
  });
  return comp("radar", [core, sweep, ring1, ring2, coreGlow, dimRing]);
}

/* ───────────────────────── ORBIT ───────────────────────── */
function orbit() {
  const dot = (size, p, c) => group([ellipse([size, size], p), fill(c), tr()]);
  const ringOuter = layer([group([ellipse([150, 150]), stroke(E1, 1.5, 18), tr()])]);
  const ringInner = layer([group([ellipse([96, 96]), stroke(E1, 1.5, 14), tr()])]);
  const spin1 = layer(
    [dot(16, [75, 0], E3), dot(12, [-37, 65], E2), dot(12, [-37, -65], E2)],
    { r: ak([{ t: 0, s: [0] }, { t: OP, s: [360] }], false) },
  );
  const spin2 = layer(
    [dot(10, [48, 0], E2), dot(8, [-48, 0], E3)],
    { r: ak([{ t: 0, s: [360] }, { t: OP, s: [0] }], false) },
  );
  const core = layer([group([ellipse([30, 30]), fill(E1), tr()])], {
    s: ak([{ t: 0, s: [90, 90, 100] }, { t: 60, s: [108, 108, 100] }, { t: 120, s: [90, 90, 100] }]),
  });
  return comp("orbit", [core, spin1, spin2, ringInner, ringOuter]);
}

/* ───────────────────────── BARS (analytics) ───────────────────────── */
function bars() {
  const colors = [E2, E3, E1, E3, E2];
  const heights = [
    [40, 95, 55], [70, 40, 85], [50, 100, 45], [90, 55, 95], [45, 80, 50],
  ];
  const baseY = C + 56;
  const layers = colors.map((c, i) => {
    const x = C - 88 + i * 44;
    const [a, b, d] = heights[i];
    return layer([
      group([
        rect([26, 120], 13, [0, 0]),
        fill(c),
        tr({
          a: sk([0, 60]), // ancre en bas de la barre
          s: ak([{ t: 0, s: [100, a] }, { t: 45, s: [100, b] }, { t: 90, s: [100, d] }, { t: 120, s: [100, a] }]),
        }),
      ]),
    ], { p: sk([x, baseY, 0]) });
  });
  const baseline = layer([group([rect([200, 3], 2, [0, 0]), fill(E1, 20), tr()])], {
    p: sk([C, baseY + 2, 0]),
  });
  return comp("bars", [...layers, baseline]);
}

/* ───────────────────────── SPARKLE (recommandations) ───────────────────────── */
function sparkle() {
  const twinkle = (p, scale, color, phase) => {
    const off = (t) => (t + phase) % OP;
    return layer([group([star(scale, scale * 0.42, 4), fill(color), tr()])], {
      p: sk([p[0], p[1], 0]),
      r: ak([{ t: 0, s: [0] }, { t: OP, s: [90] }], false),
      s: ak([
        { t: off(0), s: [10, 10, 100] },
        { t: off(40), s: [100, 100, 100] },
        { t: off(80), s: [10, 10, 100] },
        { t: OP, s: [10, 10, 100] },
      ].sort((u, v) => u.t - v.t)),
      o: ak([
        { t: off(0), s: [0] },
        { t: off(40), s: [100] },
        { t: off(80), s: [0] },
        { t: OP, s: [0] },
      ].sort((u, v) => u.t - v.t)),
    });
  };
  const core = layer([group([ellipse([26, 26]), fill(E1), tr()])], {
    s: ak([{ t: 0, s: [90, 90, 100] }, { t: 60, s: [110, 110, 100] }, { t: 120, s: [90, 90, 100] }]),
  });
  const glow = layer([group([ellipse([54, 54]), fill(E2, 14), tr()])], {
    s: ak([{ t: 0, s: [80, 80, 100] }, { t: 60, s: [120, 120, 100] }, { t: 120, s: [80, 80, 100] }]),
  });
  return comp("sparkle", [
    twinkle([C, C - 62], 26, E3, 0),
    twinkle([C + 60, C + 6], 20, E2, 45),
    twinkle([C - 58, C + 14], 22, E3, 80),
    twinkle([C + 28, C - 40], 14, E2, 20),
    core, glow,
  ]);
}

save("radar.json", radar());
save("orbit.json", orbit());
save("bars.json", bars());
save("sparkle.json", sparkle());
console.log("Terminé →", OUT);
