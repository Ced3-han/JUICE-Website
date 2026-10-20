/* JUICE widget B: "Train where you sample".
   export function mount(el): el = <div class="widget" data-widget="train-coverage" data-src="static/data/coverage.json">
   Training draws are generated client-side from the paper's time distributions with a seeded RNG. */
import { h, sv, frame, unframe, loadJSON, reduceMotion, segmented, shift, square, tag, T_I, T_T } from './time-square.js';

function mulberry32(a) {
  return function rand() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const sigmoid = (x) => 1 / (1 + Math.exp(-x));

export async function mount(el) {
  if (!el || el.dataset.mounted) return;
  el.dataset.mounted = 'loading';
  let data;
  try {
    data = await loadJSON(el);
  } catch (err) {
    // Nothing has been changed yet; rethrow so the page loader keeps the static fallback.
    delete el.dataset.mounted;
    throw err;
  }
  try {
    // eslint-disable-next-line no-new
    new Coverage(el, data);
    el.dataset.mounted = '1';
  } catch (err) {
    unframe(el, 'w-train-coverage');
    throw err;
  }
}

class Coverage {
  constructor(el, data) {
    this.el = el;
    this.d = data;
    this.recipe = data.recipes[0].id;
    this.draws = this.makeDraws();
    this.build();
    this.setRecipe(this.recipe, false);
    // Label boxes are sized from measured text; re-measure once the web fonts are in.
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => this.setRecipe(this.recipe, false));
  }

  makeDraws() {
    const { n_draws: n, seed, image, text } = this.d;
    const rand = mulberry32(seed);
    const normal = () => {
      let u = 0;
      while (u === 0) u = rand();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
    };
    const out = [];
    for (let i = 0; i < n; i++) {
      out.push({
        r: rand(),
        ti: shift(image.alpha, sigmoid(image.mu + image.s * normal())),
        tt: shift(text.alpha, sigmoid(text.mu + text.s * normal())),
        jit: rand(),
      });
    }
    return out;
  }

  build() {
    const f = frame(this.el, { cls: 'w-train-coverage', title: 'Where each recipe trains' });
    this.f = f;
    this.seg = segmented({
      label: 'Training recipe',
      items: this.d.recipes.map((r) => ({ id: r.id, label: r.label, sub: r.tag })),
      value: this.recipe,
      cls: 'w-seg--keep',
      onChange: (id) => this.setRecipe(id, true),
    });
    this.el.append(this.seg.el);

    this.sq = square({ m: { l: 58, r: 34, t: 44, b: 56 }, label: 'Training draws in the square of noise levels' });
    const { X, Y, layers, curve } = this.sq;
    // dots
    this.dotG = sv('g', { class: 'tc-dots', 'aria-hidden': 'true' });
    layers.under.append(this.dotG);
    this.dots = this.draws.map(() => {
      const c = sv('circle', { class: 'tc-dot', r: 2.3, cx: 0, cy: 0 });
      this.dotG.append(c);
      return c;
    });
    // sampling paths
    const a = this.d.image.alpha;
    this.paths = {
      t2i: sv('line', { class: 'p-img', x1: X(0), y1: Y(1), x2: X(1), y2: Y(1), 'stroke-width': 3 }),
      i2t: sv('line', { class: 'p-txt', x1: X(1), y1: Y(0), x2: X(1), y2: Y(1), 'stroke-width': 3 }),
      joint: sv('polyline', { class: 'p-joint', points: curve(a), 'stroke-width': 3 }),
    };
    this.flags = {
      t2i: sv('line', { class: 'p-bad', x1: X(0), y1: Y(1), x2: X(1), y2: Y(1), 'stroke-width': 4, 'stroke-dasharray': '7 6' }),
      i2t: sv('line', { class: 'p-bad', x1: X(1), y1: Y(0), x2: X(1), y2: Y(1), 'stroke-width': 4, 'stroke-dasharray': '7 6' }),
      joint: sv('polyline', { class: 'p-bad', points: curve(a, 0.03, 0.97), 'stroke-width': 4, 'stroke-dasharray': '7 6' }),
    };
    layers.paths.append(this.paths.t2i, this.paths.i2t, this.paths.joint);
    layers.marks.append(this.flags.t2i, this.flags.i2t, this.flags.joint);

    // readout
    this.mixBar = h('div', { class: 'tc-mix', role: 'img' },
      h('i', { class: 'm-joint' }), h('i', { class: 'm-t2i' }), h('i', { class: 'm-i2t' }));
    this.mixLabel = h('p', { class: 'tc-mix-label' });
    this.explain = h('p', { class: 'tc-explain', 'aria-live': 'polite' });
    const max = 60;
    this.bars = this.d.recipes.map((r) => h('button', {
      type: 'button', class: 'tc-bar', 'aria-pressed': 'false',
      'aria-label': `${r.label}: GenEval ${r.geneval.toFixed(2)} at guidance ${r.best_w}`,
      onclick: () => { this.seg.set(r.id); this.setRecipe(r.id, true); },
    }, h('span', null, r.label),
      h('span', { class: 'tc-track' }, h('span', { class: 'tc-fill', style: { '--v': r.geneval / max } })),
      h('span', { class: 'tc-val' }, h('b', null, r.geneval.toFixed(2)), ` · w=${r.best_w}`)));

    const right = h('div', { class: 'tc-right' },
      h('div', null, h('p', { class: 'tc-block-title' }, 'Training mix'), this.mixBar, this.mixLabel),
      this.explain,
      h('div', null,
        h('p', { class: 'tc-block-title' }, 'GenEval (%), best guidance · 668M · 224×224'),
        h('div', { class: 'tc-bars' }, this.bars)),
      h('div', { class: 'tc-legend' },
        h('span', null, h('i', { class: 'l-joint' }), 'joint draw (both noisy)'),
        h('span', null, h('i', { class: 'l-t2i' }), 'T2I draw (text clean)'),
        h('span', null, h('i', { class: 'l-i2t' }), 'I2T draw (image clean)'),
        h('span', null, h('i', { class: 'l-bad' }), 'path never trained here')));

    this.el.append(h('div', { class: 'w-body' }, h('div', null, this.sq.svg,
      h('p', { class: 'tc-paths-note', html: `Lines are the sampling paths: T2I along the top edge (${T_T} = 1), captioning along the right edge (${T_I} = 1), joint generation through the interior. Edge draws sit just outside their edge.` })), right),
    f.status, f.foot);
    const S = this.d.source;
    f.foot.innerHTML = `<strong>Data.</strong> 668M backbone, 224×224 images, 50k updates, single runs; GenEval at each recipe's best guidance scale (paper ${S.geneval}; recipes in ${S.recipes}, curves in ${S.figure}). Dots: ${this.d.n_draws} seeded draws from the paper's time distributions (image: logit-normal(${this.d.image.mu}, ${this.d.image.s}) shifted with α = ${this.d.image.alpha}; text: logit-normal(${this.d.text.mu}, ${this.d.text.s}), unshifted). Simplified to one time per example; the paper also corrupts per-token spans.`;
  }

  setRecipe(id, user) {
    this.recipe = id;
    this.seg.set(id);
    const r = this.d.recipes.find((x) => x.id === id);
    const { X, Y, layers } = this.sq;
    const animate = user && !reduceMotion();
    const jEnd = r.mix.joint;
    const tEnd = r.mix.joint + r.mix.t2i;
    this.draws.forEach((d, i) => {
      const reg = d.r < jEnd ? 'joint' : d.r < tEnd ? 't2i' : 'i2t';
      let x;
      let y;
      if (reg === 'joint') { x = X(d.ti); y = Y(d.tt); }
      else if (reg === 't2i') { x = X(d.ti); y = Y(1) - 4 - d.jit * 13; }
      else { x = X(1) + 4 + d.jit * 13; y = Y(d.tt); }
      const c = this.dots[i];
      c.setAttribute('class', `tc-dot d-${reg}`);
      c.style.transitionDelay = animate ? `${(i % 90) * 4}ms` : '0ms';
      if (!animate) c.style.transition = 'none';
      c.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      if (!animate) { void c.getBoundingClientRect; requestAnimationFrame(() => { c.style.transition = ''; }); }
    });
    // coverage: an edge is trained only by its conditional task; the interior only by joint denoising
    const covered = { t2i: r.mix.t2i > 0, i2t: r.mix.i2t > 0, joint: r.mix.joint > 0 };
    layers.tags.textContent = '';
    for (const k of ['t2i', 'i2t', 'joint']) {
      this.flags[k].style.display = covered[k] ? 'none' : '';
      this.paths[k].classList.toggle('is-ghost', !covered[k]);
    }
    if (!covered.t2i) tag(layers.tags, { x: X(0.5), y: Y(1) - 16, text: 'never trained here', kind: 'bad' });
    if (!covered.i2t) tag(layers.tags, { x: X(1) - 14, y: Y(0.72), text: 'never trained here', kind: 'bad', anchor: 'end' });
    if (!covered.joint) tag(layers.tags, { x: X(0.3), y: Y(0.66), text: 'never trained here', kind: 'bad', anchor: 'start' });

    ['joint', 't2i', 'i2t'].forEach((k, i) => {
      const seg = this.mixBar.children[i];
      seg.style.setProperty('--v', r.mix[k]);
      seg.hidden = r.mix[k] === 0;
    });
    this.mixBar.setAttribute('aria-label', `Training mix: ${r.mix_label}`);
    this.mixLabel.textContent = r.mix_label;
    this.explain.textContent = r.explain;
    this.bars.forEach((b, i) => b.setAttribute('aria-pressed', String(this.d.recipes[i].id === id)));
    const miss = ['t2i', 'i2t', 'joint'].filter((k) => !covered[k]).map((k) => ({ t2i: 'text-to-image', i2t: 'captioning', joint: 'joint' }[k]));
    this.sq.svg.setAttribute('aria-label', `${r.label}: ${r.mix_label}. ${miss.length ? `Untrained sampling paths: ${miss.join(', ')}.` : 'All sampling paths are covered.'}`);
    this.f.status.textContent = `${r.label}: GenEval ${r.geneval.toFixed(2)} at its best guidance (w = ${r.best_w}).${miss.length ? ` The ${miss.join(' and ')} path${miss.length > 1 ? 's run' : ' runs'} where this recipe never trained.` : ''}`;
  }
}
