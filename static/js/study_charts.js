// Pretraining-study charts (the paper's Figures 3, 4 and 5), redrawn as SVG so they can animate: the training curves
// advance one 10k-update checkpoint at a time, and the encoder bars grow to their values. Each chart is a pure function
// of a progress value p in [0, 1] (set(p)); set(1) is the paper figure. Self-contained (no imports), so the project
// page loads the same file: blog/static/js/study_charts.js is a copy (rebuild_paper_story.sh checks they match).
// Geometry is in the figures' 1800-unit layout (the units of data.js STUDIES), measured from repo/Figures/fig_*.pdf.
// Numbers: repo/tools/figures/curves.json (Figures 3 and 4) and repo/tools/figures/plot_encoder.py (Figure 5).
const NS = 'http://www.w3.org/2000/svg';
const FONT = "'Liberation Serif', 'Times New Roman', Times, serif";
const PT = 3.98;                                   // layout units per point of the PDF figures

const STEPS = [0, 10, 20, 30, 40, 50];             // training updates (k)
const CURVES = {
  frameworks: {
    order: ['JUICE', 'Transfusion-style', 'D-DiT-style', 'MMaDA-style'],
    legend: [[243, 349], [492, 596], [887, 987], [1202, 1305]],   // [handle x, text x]
    ylims: { GenEval: [0, 52], DPG: [0, 82], CIDEr: [0, 170], CLIP: [40, 82] },
    yticks: { GenEval: [0, 20, 40], DPG: [0, 20, 40, 60, 80], CIDEr: [0, 50, 100, 150], CLIP: [40, 50, 60, 70, 80] },
    data: {
      GenEval: { JUICE: [0.21, 34.66, 41.32, 44.32, 46.84, 48.41], 'Transfusion-style': [0.21, 28.67, 35.24, 39.48, 42.2, 44.23],
                 'D-DiT-style': [0.21, 21.89, 27.48, 30.5, 32.52, 34.5], 'MMaDA-style': [0.21, 15.33, 20.93, 28.2, 35.75, 41.61] },
      DPG: { JUICE: [9.95, 66.71, 72.72, 75.73, 77.48, 78.85], 'Transfusion-style': [9.95, 61.05, 68.73, 72.27, 74.52, 76.84],
             'D-DiT-style': [9.95, 57.75, 64.35, 69.53, 72.26, 74.35], 'MMaDA-style': [9.95, 37.18, 47.81, 55.5, 61.55, 66.5] },
      CIDEr: { JUICE: [0.01, 38.35, 57.67, 70.46, 80.08, 88.8], 'Transfusion-style': [0.19, 58.86, 92.86, 120.0, 142.0, 160.52],
               'D-DiT-style': [0.04, 43.26, 67.8, 86.8, 102.24, 115.22], 'MMaDA-style': [0.05, 23.41, 39.24, 55.41, 72.8, 89.53] },
      CLIP: { JUICE: [51.51, 70.36, 74.6, 77.11, 79.0, 80.2], 'Transfusion-style': [48.0, 71.36, 75.15, 78.15, 79.57, 80.37],
              'D-DiT-style': [44.17, 69.42, 74.42, 77.05, 78.73, 79.82], 'MMaDA-style': [44.75, 62.02, 64.54, 67.04, 69.55, 71.61] },
    },
  },
  mixtures: {
    order: ['Mixing', 'Multi-task'],
    legend: [[623, 727], [879, 984]],
    ylims: { GenEval: [0, 52], DPG: [0, 82], CIDEr: [0, 95], CLIP: [40, 82] },
    yticks: { GenEval: [0, 20, 40], DPG: [0, 20, 40, 60, 80], CIDEr: [0, 20, 40, 60, 80], CLIP: [40, 50, 60, 70, 80] },
    data: {
      GenEval: { Mixing: [0.21, 34.66, 41.32, 44.32, 46.84, 48.41], 'Multi-task': [0.21, 28.95, 32.95, 34.5, 35.5, 36.3] },
      DPG: { Mixing: [9.95, 66.71, 72.72, 75.73, 77.48, 78.85], 'Multi-task': [9.95, 61.03, 69.5, 73.5, 76.05, 77.71] },
      CIDEr: { Mixing: [0.01, 38.35, 57.67, 70.46, 80.08, 88.8], 'Multi-task': [0.01, 27.04, 44.02, 58.01, 69.01, 79.41] },
      CLIP: { Mixing: [51.51, 70.36, 74.6, 77.11, 79.0, 80.2], 'Multi-task': [51.51, 65.02, 68.03, 71.05, 72.95, 75.07] },
    },
  },
};
const COLOR = { JUICE: '#0072B2', Mixing: '#0072B2', 'Transfusion-style': '#D55E00', 'D-DiT-style': '#CC79A7',
                'MMaDA-style': '#009E73', 'Multi-task': '#009E73' };
const METRICS = ['GenEval', 'DPG', 'CIDEr', 'CLIP'];
const TITLES = { GenEval: 'GenEval (%)', DPG: 'DPG-Bench (%)', CIDEr: 'CIDEr', CLIP: 'CLIPScore (×100)' };

const ENCODERS = {
  img: { label: 'Image spaces (T5 text)', top: 88, rows: {
    SigLIP2: [48.41, 78.85, 88.80, 80.20], DINO: [49.07, 77.85, 68.80, 71.66], 'FLUX VAE': [35.42, 74.05, 49.95, 64.91], Pixels: [24.48, 71.64, 49.57, 65.51] } },
  txt: { label: 'Text spaces (SigLIP2 images)', top: 469, rows: {
    T5: [48.41, 78.85, 88.80, 80.20], 'Qwen3-E': [43.07, 78.04, 88.50, 76.54], 'Qwen3-VL-E': [39.28, 78.70, 84.24, 75.94], 'SigLIP2 text': [33.08, 74.19, 85.54, 74.52] } },
};
const BAR_COLORS = ['#0072B2', '#E69F00', '#009E73', '#CC79A7'];
const XMAX = [60, 100, 105, 100];

const clamp = (x) => Math.min(1, Math.max(0, x));
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const easeOut = (x) => 1 - Math.pow(1 - x, 3);
const f2 = (v) => v.toFixed(2);

function el(tag, parent, attrs = {}, text = null) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (text !== null) e.textContent = text;
  if (parent) parent.appendChild(e);
  return e;
}

function svgRoot(parent, w, h, label) {
  const svg = el('svg', parent, { viewBox: `0 0 ${w} ${h}`, width: '100%', role: 'img', 'aria-label': label,
    style: `display:block;font-family:${FONT};overflow:visible` });
  return svg;
}

/**
 * Figures 3 and 4: four panels of training curves. which: 'frameworks' | 'mixtures'.
 * set(p): the curves advance one checkpoint per fifth of p; each segment is drawn over the first 80% of its fifth, and
 * the new checkpoint's marker lands in the rest. Reached x-tick labels turn black, and a faint guide marks the step.
 */
export function trainingChart(parent, which) {
  const C = CURVES[which];
  const AX = { x0: [55.8, 513.9, 972.0, 1430.1], w: 346.5, top: 124.2, bottom: 495 };
  const svg = svgRoot(parent, 1800, 598, which === 'frameworks'
    ? 'Training curves over 50k updates for four frameworks on GenEval, DPG-Bench, CIDEr and CLIPScore.'
    : 'Training curves over 50k updates for Mixing and Multi-task on GenEval, DPG-Bench, CIDEr and CLIPScore.');
  const SPINE = 0.7 * PT, TICK = 2.5 * PT;

  // legend
  C.order.forEach((name, i) => {
    const [hx, tx] = C.legend[i], main = i === 0;
    el('line', svg, { x1: hx, y1: 33, x2: hx + 81, y2: 33, stroke: COLOR[name], 'stroke-width': (main ? 2 : 1.5) * PT });
    el('circle', svg, { cx: hx + 40.5, cy: 33, r: (main ? 3.6 : 3.0) * PT / 2, fill: COLOR[name], stroke: '#fff', 'stroke-width': 0.6 * PT });
    el('text', svg, { x: tx, y: 33, 'font-size': 8.5 * PT, 'dominant-baseline': 'central' }, name);
  });
  el('text', svg, { x: 875, y: 583, 'font-size': 9 * PT, 'text-anchor': 'middle' }, 'Training updates (k)');

  const panels = METRICS.map((m, pi) => {
    const x0 = AX.x0[pi], [lo, hi] = C.ylims[m];
    const X = (k) => x0 + (k / 50) * AX.w;
    const Y = (v) => AX.bottom - ((v - lo) / (hi - lo)) * (AX.bottom - AX.top);
    const g = el('g', svg);
    el('text', g, { x: x0 + AX.w / 2, y: 108, 'font-size': 9.5 * PT, 'font-weight': 700, 'text-anchor': 'middle' }, TITLES[m]);
    C.yticks[m].forEach((v) => {
      if (v !== lo) el('line', g, { x1: x0, x2: x0 + AX.w, y1: Y(v), y2: Y(v), stroke: '#e6e6e6', 'stroke-width': 0.6 * PT });
      el('line', g, { x1: x0 - TICK, x2: x0, y1: Y(v), y2: Y(v), stroke: '#000', 'stroke-width': SPINE });
      el('text', g, { x: x0 - TICK - 2 * PT, y: Y(v), 'font-size': 8 * PT, 'text-anchor': 'end', 'dominant-baseline': 'central' }, String(v));
    });
    const xlabels = STEPS.map((k) => {
      el('line', g, { x1: X(k), x2: X(k), y1: AX.bottom, y2: AX.bottom + TICK, stroke: '#000', 'stroke-width': SPINE });
      return el('text', g, { x: X(k), y: 535, 'font-size': 8 * PT, 'text-anchor': 'middle' }, String(k));
    });
    el('path', g, { d: `M${x0} ${AX.top}V${AX.bottom}H${x0 + AX.w}`, fill: 'none', stroke: '#000', 'stroke-width': SPINE, 'stroke-linecap': 'square' });
    const guide = el('line', g, { y1: AX.top, y2: AX.bottom, stroke: '#8c939b', 'stroke-width': 0.6 * PT, 'stroke-dasharray': `${2 * PT} ${2 * PT}`, opacity: 0 });
    // series: the main one on top, the others in reverse legend order (as matplotlib stacks them)
    const series = C.order.slice().reverse().map((name) => {
      const main = name === C.order[0];
      const sg = el('g', g);
      const pts = C.data[m][name].map((v, j) => [X(STEPS[j]), Y(v)]);
      const path = el('path', sg, { fill: 'none', stroke: COLOR[name], 'stroke-width': (main ? 2 : 1.5) * PT, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' });
      const r = (main ? 3.6 : 3.0) * PT / 2;
      const dots = pts.map(([x, y]) => el('circle', sg, { cx: x, cy: y, r, fill: COLOR[name], stroke: '#fff', 'stroke-width': 0.6 * PT }));
      return { pts, path, dots, r };
    });
    return { X, xlabels, guide, series };
  });

  const DRAW = 0.8;
  function set(p) {
    p = clamp(p);
    const u = p * 5, k = Math.min(4, Math.floor(u)), tau = u - k;
    const d = easeInOut(clamp(tau / DRAW));
    const landed = clamp((tau - DRAW) / (1 - DRAW));
    const guideO = 0.9 * Math.min(1, p * 25, (1 - p) * 25);
    panels.forEach((P) => {
      P.series.forEach((S) => {
        const head = [S.pts[k][0] + (S.pts[k + 1][0] - S.pts[k][0]) * d, S.pts[k][1] + (S.pts[k + 1][1] - S.pts[k][1]) * d];
        const pts = S.pts.slice(0, k + 1).concat([head]);
        S.path.setAttribute('d', 'M' + pts.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join('L'));
        S.dots.forEach((c, j) => {
          const s = j <= k ? 1 : j === k + 1 && d >= 1 ? 0.55 + 0.45 * easeOut(landed) : 0;
          c.setAttribute('r', (S.r * s).toFixed(2));
          c.style.visibility = s > 0 ? 'visible' : 'hidden';
        });
      });
      const reached = k + (d >= 1 ? 1 : 0);
      P.xlabels.forEach((t, j) => t.setAttribute('fill', j <= reached ? '#000' : '#b4b8bd'));
      const gx = P.X(STEPS[k] + 10 * d).toFixed(2);
      P.guide.setAttribute('x1', gx); P.guide.setAttribute('x2', gx);
      P.guide.setAttribute('opacity', guideO.toFixed(3));
    });
  }
  set(1);
  return { svg, set, steps: STEPS.length - 1 };
}

/**
 * Figure 5: representation spaces, bars of final scores at 668M. groups: ['img', 'txt'] (the full figure) or ['img']
 * (its top half, 1800 x 372, as the video shows it). set(p): the groups grow in turn (overlapping), rows staggered
 * slightly; each value counts up with its bar. The best value per column is bold, as in the paper.
 */
export function encoderChart(parent, groups = ['img', 'txt']) {
  const H = groups.length === 2 ? 744 : 372;
  const svg = svgRoot(parent, 1800, H, groups.length === 2
    ? 'Bar charts at 668M of GenEval, DPG-Bench, CIDEr and CLIPScore for four image spaces with T5 text and four text spaces with SigLIP2 images.'
    : 'Bar charts at 668M of GenEval, DPG-Bench, CIDEr and CLIPScore for four image spaces with T5 text.');
  const X0 = [188.1, 600.3, 1013.4, 1426.5], W = 368.6, AXH = 270, UNIT = AXH / 4.2, BARH = 0.68 * UNIT;
  ['GenEval (%)', 'DPG-Bench (%)', 'CIDEr', 'CLIPScore (×100)'].forEach((t, c) =>
    el('text', svg, { x: X0[c] + W / 2, y: 31, 'font-size': 9.5 * PT, 'font-weight': 700, 'text-anchor': 'middle' }, t));
  const bars = [];
  groups.forEach((gk, gi) => {
    const G = ENCODERS[gk], names = Object.keys(G.rows);
    el('text', svg, { x: 27, y: G.top - 16, 'font-size': 8.5 * PT, 'font-style': 'italic', fill: '#4d4d4d' }, G.label);
    const cy = (r) => G.top + AXH - (3 - r + 0.6) * UNIT;
    names.forEach((n, r) => el('text', svg, { x: X0[0] - 11, y: cy(r), 'font-size': 8 * PT, 'text-anchor': 'end', 'dominant-baseline': 'central' }, n));
    for (let c = 0; c < 4; c++) {
      const vals = names.map((n) => G.rows[n][c]), best = vals.indexOf(Math.max(...vals));
      const scale = W / (XMAX[c] * 1.18);
      names.forEach((n, r) => {
        const v = vals[r];
        const rect = el('rect', svg, { x: X0[c], y: cy(r) - BARH / 2, height: BARH, fill: BAR_COLORS[r] });
        const label = el('text', svg, { y: cy(r), 'font-size': 7.8 * PT, 'dominant-baseline': 'central', 'font-weight': r === best ? 700 : 400 });
        bars.push({ gi, r, v, rect, label, x0: X0[c], scale, pad: XMAX[c] * 0.015 * scale });
      });
      el('line', svg, { x1: X0[c], x2: X0[c], y1: G.top, y2: G.top + AXH, stroke: '#000', 'stroke-width': 0.7 * PT });
    }
  });

  const n = groups.length, SPAN = n === 2 ? 0.6 : 1, LAG = n === 2 ? 0.4 : 0, STAG = 0.08;
  function set(p) {
    p = clamp(p);
    bars.forEach((B) => {
      const q = (p - B.gi * LAG) / SPAN;
      const e = easeOut(clamp((q - B.r * STAG) / (1 - 3 * STAG)));
      const w = B.v * e * B.scale;
      B.rect.setAttribute('width', w.toFixed(2));
      B.label.setAttribute('x', (B.x0 + w + B.pad).toFixed(2));
      B.label.textContent = f2(B.v * e);
      B.label.style.visibility = e > 0 ? 'visible' : 'hidden';
    });
  }
  set(1);
  return { svg, set };
}
