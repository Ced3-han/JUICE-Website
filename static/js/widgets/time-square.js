/* JUICE widget A: "Two clocks, one square".
   export function mount(el): el = <div class="widget" data-widget="time-square" data-src="static/data/time_square.json">
   This module also exports the small helpers (DOM, frame, square, controls) used by
   train-coverage.js and maze-player.js. No dependencies. */

const SVGNS = 'http://www.w3.org/2000/svg';

/* ------------------------------------------------------------------ helpers */
function setAttrs(n, attrs) {
  if (!attrs) return;
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') n.setAttribute('class', v);
    else if (k === 'text') n.textContent = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') {
      for (const [sk, sv2] of Object.entries(v)) {
        if (sk.startsWith('--')) n.style.setProperty(sk, sv2);
        else n.style[sk] = sv2;
      }
    } else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? '' : String(v));
  }
}
function append(n, kids) {
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false) continue;
    n.append(k.nodeType ? k : document.createTextNode(String(k)));
  }
}
export function h(tag, attrs, ...kids) {
  const n = document.createElement(tag);
  setAttrs(n, attrs);
  append(n, kids);
  return n;
}
export function sv(tag, attrs, ...kids) {
  const n = document.createElementNS(SVGNS, tag);
  setAttrs(n, attrs);
  append(n, kids);
  return n;
}
export const assetURL = (p) => new URL(p, document.baseURI).href;
export async function loadJSON(el) {
  const src = el.getAttribute('data-src');
  const res = await fetch(new URL(src, document.baseURI));
  if (!res.ok) throw new Error(`${src}: HTTP ${res.status}`);
  return res.json();
}
export const reduceMotion = () =>
  !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
/** Image time shift S_alpha(u) = u / (alpha + (1 - alpha) u). */
export const shift = (alpha, u) => u / (alpha + (1 - alpha) * u);
export const uid = (p) => `${p}-${Math.random().toString(36).slice(2, 8)}`;
export const sub = (base, s) => `${base}<sub>${s}</sub>`;
export const T_I = 't<sub>i</sub>';
export const T_T = 't<sub>t</sub>';

const ICONS = {
  play: 'M8 5.2v13.6L19 12z',
  pause: 'M6.5 5h4v14h-4zM13.5 5h4v14h-4z',
  replay: 'M12 4.5V1.8L7.2 5.6 12 9.4V6.6a5.4 5.4 0 1 1-5.4 5.4H4.5A7.5 7.5 0 1 0 12 4.5z',
  prev: 'M6 5.5h2.2v13H6zM9.6 12 18 18.3V5.7z',
  next: 'M15.8 5.5H18v13h-2.2zM6 18.3 14.4 12 6 5.7z',
  check: 'M9.2 16.6 4.9 12.3l1.6-1.6 2.7 2.7 8.3-8.3 1.6 1.6z',
  cross: 'M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6 10.6 12 5 6.4z',
  neq: 'M5 8.2h9.6l1.8-3.4 1.8.9-1.4 2.5H19v2h-3.3l-1.7 3.4H19v2h-6l-2 3.6-1.8-.9 1.5-2.7H5v-2h6.8l1.7-3.4H5z',
};
export function icon(name) {
  return sv('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false' },
    sv('path', { d: ICONS[name], fill: 'currentColor' }));
}

/** Builds the shared widget frame on the mount element itself. */
export function frame(el, { cls, title }) {
  el.textContent = '';
  el.classList.add('w-frame', cls);
  const id = uid('w-title');
  el.setAttribute('role', 'region');
  el.setAttribute('aria-labelledby', id);
  const ctrls = h('div', { class: 'w-head-ctrls' });
  const head = h('div', { class: 'w-head' },
    h('div', { class: 'w-head-main' },
      h('h3', { class: 'w-title', id }, title),
      h('span', { class: 'w-chip' }, 'Interactive')),
    ctrls);
  const status = h('p', { class: 'w-status', 'aria-live': 'polite', 'aria-atomic': 'true' });
  const foot = h('p', { class: 'w-foot' });
  el.append(head);
  return { el, head, ctrls, status, foot };
}

/** Undo frame() after a failed mount, so a restored fallback is not styled as a widget. */
export function unframe(el, cls) {
  el.classList.remove('w-frame', cls);
  el.removeAttribute('role');
  el.removeAttribute('aria-labelledby');
  delete el.dataset.mounted;
}

/** Segmented buttons (aria-pressed); arrow keys move between options. */
export function segmented({ label, items, value, onChange, cls = '' }) {
  const wrap = h('div', { class: `w-seg ${cls}`, role: 'group', 'aria-label': label, style: { '--n': items.length } });
  const btns = items.map((it) => h('button', {
    type: 'button', 'data-id': it.id, 'aria-pressed': String(it.id === value),
    onclick: () => { set(it.id); onChange(it.id); },
  }, it.label, it.sub ? h('span', { class: 'w-seg-sub' }, it.sub) : null));
  wrap.append(...btns);
  wrap.addEventListener('keydown', (e) => {
    const i = btns.indexOf(document.activeElement);
    if (i < 0) return;
    let j = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % btns.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = (i - 1 + btns.length) % btns.length;
    else if (e.key === 'Home') j = 0;
    else if (e.key === 'End') j = btns.length - 1;
    if (j < 0) return;
    e.preventDefault();
    btns[j].focus();
    btns[j].click();
  });
  function set(id) {
    for (const b of btns) b.setAttribute('aria-pressed', String(b.dataset.id === id));
  }
  return { el: wrap, set, btns };
}

/** Range input that snaps to indices 0..n-1, with tick labels under the real data points. */
export function snapRange({ label, ticks, value = 0, onInput, valueText }) {
  const input = h('input', { type: 'range', min: 0, max: ticks.length - 1, step: 1, value, 'aria-label': label });
  const row = h('div', { class: 'w-ticks', 'aria-hidden': 'true' });
  const wrap = h('div', { class: 'w-range' }, input, row);
  function setTicks(t) {
    row.textContent = '';
    for (const s of t) row.append(h('span', null, s));
    input.max = t.length - 1;
    update();
  }
  function update() {
    const v = +input.value;
    const max = +input.max || 1;
    input.style.setProperty('--fill', `${(v / max) * 100}%`);
    [...row.children].forEach((s, i) => s.classList.toggle('is-on', i === v));
    if (valueText) input.setAttribute('aria-valuetext', valueText(v));
  }
  input.addEventListener('input', () => { update(); onInput(+input.value); });
  setTicks(ticks);
  return { el: wrap, input, set(v) { input.value = v; update(); }, setTicks };
}

/** Calls cb(true/false) as `target` crosses 50% visibility. */
export function watchView(target, cb) {
  if (!('IntersectionObserver' in window)) { cb(true); return () => {}; }
  let last = null;
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const v = e.isIntersecting && e.intersectionRatio >= 0.5;
      if (v !== last) { last = v; cb(v); }
    }
  }, { threshold: [0, 0.25, 0.5, 0.75, 1] });
  io.observe(target);
  return () => io.disconnect();
}

/** The unit square of noise levels: x = image time t_i, y = text time t_t, 0 noise -> 1 clean. */
export function square({ m = { l: 58, r: 26, t: 38, b: 56 }, side = 360, label = '' } = {}) {
  const W = m.l + side + m.r;
  const H = m.t + side + m.b;
  const X = (ti) => m.l + ti * side;
  const Y = (tt) => m.t + (1 - tt) * side;
  const svg = sv('svg', { class: 'w-square', viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': label });
  const gid = uid('sqg');
  // Absolute fragment URL so the gradient survives a <base href>.
  const fillRef = `url(${location.href.split('#')[0]}#${gid})`;
  svg.append(
    sv('defs', null,
      sv('radialGradient', { id: gid, cx: X(0), cy: Y(0), r: side * 1.2, gradientUnits: 'userSpaceOnUse' },
        sv('stop', { offset: 0, class: 'sq-grad-a' }),
        sv('stop', { offset: 1, class: 'sq-grad-b' }))),
    sv('rect', { class: 'sq-bg', x: X(0), y: Y(1), width: side, height: side }),
    sv('rect', { x: X(0), y: Y(1), width: side, height: side, fill: fillRef }),
  );
  const grid = sv('g', { 'aria-hidden': 'true' });
  for (const v of [0.25, 0.5, 0.75]) {
    grid.append(
      sv('line', { class: 'sq-grid', x1: X(v), x2: X(v), y1: Y(0), y2: Y(1) }),
      sv('line', { class: 'sq-grid', x1: X(0), x2: X(1), y1: Y(v), y2: Y(v) }));
  }
  svg.append(grid, sv('rect', { class: 'sq-box', x: X(0), y: Y(1), width: side, height: side }));

  const ax = sv('g', { 'aria-hidden': 'true' });
  // x axis
  ax.append(
    sv('text', { class: 'sq-tick', x: X(0), y: Y(0) + 17, 'text-anchor': 'middle' }, '0'),
    sv('text', { class: 'sq-tick', x: X(1), y: Y(0) + 17, 'text-anchor': 'middle' }, '1'),
    sv('text', { class: 'sq-tick', x: X(0) + 12, y: Y(0) + 17, 'text-anchor': 'start' }, 'noise'),
    sv('text', { class: 'sq-tick', x: X(1) - 10, y: Y(0) + 17, 'text-anchor': 'end' }, 'clean'),
    sv('text', { class: 'sq-axis sq-axis--img', x: X(0.5), y: Y(0) + 42, 'text-anchor': 'middle' },
      'image time t', sv('tspan', { class: 'sub', dy: 3 }, 'i')),
  );
  // y axis
  const yl = X(0) - 42;
  ax.append(
    sv('text', { class: 'sq-tick', x: X(0) - 14, y: Y(0) + 4, 'text-anchor': 'end' }, '0'),
    sv('text', { class: 'sq-tick', x: X(0) - 14, y: Y(1) + 4, 'text-anchor': 'end' }, '1'),
    sv('text', { class: 'sq-axis sq-axis--txt', x: yl, y: Y(0.5), 'text-anchor': 'middle', transform: `rotate(-90 ${yl} ${Y(0.5)})` },
      'text time t', sv('tspan', { class: 'sub', dy: 3 }, 't')),
  );
  // corners
  ax.append(
    sv('circle', { class: 'sq-corner-dot', cx: X(0), cy: Y(0), r: 3 }),
    sv('circle', { class: 'sq-corner-dot', cx: X(1), cy: Y(1), r: 3 }),
    sv('text', { class: 'sq-corner', x: X(0) + 10, y: Y(0) - 9 }, 'both noise'),
    sv('text', { class: 'sq-corner', x: X(1) - 12, y: Y(1) + 26, 'text-anchor': 'end' }, 'both clean'),
  );
  svg.append(ax);
  const layers = {};
  for (const k of ['under', 'paths', 'marks', 'tags', 'dot']) {
    layers[k] = sv('g', { class: `sq-${k}` });
    svg.append(layers[k]);
  }
  const pt = (ti, tt) => `${X(ti).toFixed(2)},${Y(tt).toFixed(2)}`;
  /** Polyline points of the joint path t_t = s, t_i = S_alpha(s). */
  const curve = (alpha, s0 = 0, s1 = 1, n = 120) => {
    const pts = [];
    for (let k = 0; k <= n; k++) {
      const s = s0 + ((s1 - s0) * k) / n;
      pts.push(pt(shift(alpha, s), s));
    }
    return pts.join(' ');
  };
  return { svg, X, Y, W, H, side, m, layers, pt, curve };
}

/** A label tag (rounded rect + text) placed in an SVG; anchor = 'start' | 'middle' | 'end'. */
export function tag(parent, { x, y, text, num, kind = 'muted', anchor = 'middle', dashed = false }) {
  const g = sv('g', { class: `sq-tag sq-tag--${kind}` });
  const t = sv('text', { x: 0, y: 0, 'dominant-baseline': 'central' }, text);
  if (num != null) t.append(sv('tspan', { class: 'num', dx: 5 }, num));
  const r = sv('rect', { rx: 6, ry: 6 });
  if (dashed) r.setAttribute('stroke-dasharray', '4 3');
  g.append(r, t);
  parent.append(g);
  // Measure after insertion; fall back to an estimate if layout is unavailable.
  let w = 0;
  try { w = t.getComputedTextLength(); } catch (_) { /* not rendered yet */ }
  if (!w) w = (text.length + (num ? String(num).length + 1 : 0)) * 6.2;
  const padX = 7;
  const bw = w + padX * 2 + (num != null ? 5 : 0);
  const bh = 21;
  const x0 = anchor === 'start' ? x : anchor === 'end' ? x - bw : x - bw / 2;
  r.setAttribute('x', x0);
  r.setAttribute('y', y - bh / 2);
  r.setAttribute('width', bw);
  r.setAttribute('height', bh);
  t.setAttribute('x', x0 + padX);
  t.setAttribute('y', y + 0.5);
  return g;
}

/** Small arrowhead at (x, y) pointing in direction (dx, dy). */
export function arrow(parent, x, y, dx, dy, cls, size = 9) {
  const L = Math.hypot(dx, dy) || 1;
  const ux = dx / L;
  const uy = dy / L;
  const bx = x - ux * size;
  const by = y - uy * size;
  const px = -uy * size * 0.55;
  const py = ux * size * 0.55;
  parent.append(sv('path', { class: cls, d: `M${x},${y}L${bx + px},${by + py}L${bx - px},${by - py}Z` }));
}

function ring(cls = '') {
  const C = 2 * Math.PI * 22;
  const fg = sv('circle', { class: 'fg', cx: 27, cy: 27, r: 22, 'stroke-dasharray': `${C} ${C}`, 'stroke-dashoffset': C });
  const el = sv('svg', { class: `ts-ring ${cls}`, viewBox: '0 0 54 54', 'aria-hidden': 'true' },
    sv('circle', { class: 'bg', cx: 27, cy: 27, r: 22 }), fg);
  return { el, set(p) { fg.setAttribute('stroke-dashoffset', String(C * (1 - Math.max(0, Math.min(1, p))))); } };
}

/* ------------------------------------------------------------------ widget */
const DUR = { t2i: 4400, vqa: 3000, jointHold: 1500, jointMove: 480 };
const PRESETS = [
  { id: 't2i', label: 'Text → Image' },
  { id: 'vqa', label: 'Captioning / VQA' },
  { id: 'joint', label: 'Joint' },
  { id: 'samplers', label: 'Samplers' },
];

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
    new TimeSquare(el, data);
    el.dataset.mounted = '1';
  } catch (err) {
    unframe(el, 'w-time-square');
    throw err;
  }
}

class TimeSquare {
  constructor(el, data) {
    this.el = el;
    this.d = data;
    this.preset = 't2i';
    this.progress = { t2i: 0, vqa: 0 };
    this.done = { t2i: false, vqa: false, joint: false };
    this.snap = 0;
    this.sampleId = data.joint.default;
    this.samplersOn = new Set(['independent', 'image_first', 'text_first', 'coupled']);
    this.samplerFocus = 'coupled';
    if (reduceMotion()) {
      // No autoplay: open the edge presets on their finished state; play steps through them.
      this.progress = { t2i: 1, vqa: 1 };
      this.done = { t2i: true, vqa: true, joint: false };
    }
    this.playing = false;
    this.userPaused = false;
    this.inView = false;
    this.raf = 0;
    this.timer = 0;
    this.build();
    this.setPreset('t2i');
    // Sampler tags are sized from measured text; re-measure once the web fonts are in.
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => { if (this.preset === 'samplers') this.drawSamplers(); });
    }
  }

  /* ---------- layout */
  build() {
    const f = frame(this.el, { cls: 'w-time-square', title: 'Paths through the square' });
    this.f = f;
    this.playBtn = h('button', { type: 'button', class: 'w-iconbtn w-iconbtn--play', onclick: () => this.togglePlay() });
    f.ctrls.append(this.playBtn);
    this.seg = segmented({
      label: 'Task', items: PRESETS, value: this.preset,
      onChange: (id) => { this.userPaused = false; this.setPreset(id, true); },
    });
    this.el.append(this.seg.el);
    this.sq = square({ label: 'Square of noise levels' });
    this.dot = sv('g', { class: 'sq-dotg', 'aria-hidden': 'true' },
      sv('circle', { class: 'sq-halo', r: 15 }), sv('circle', { class: 'sq-dot', r: 8 }));
    this.sq.layers.dot.append(this.dot);
    this.left = h('div', { class: 'ts-left' }, this.sq.svg);
    this.below = h('div', { class: 'ts-slider' });
    this.left.append(this.below);
    this.right = h('div', { class: 'ts-right' });
    this.el.append(h('div', { class: 'w-body' }, this.left, this.right), f.status, f.foot);
    watchView(this.sq.svg, (v) => {
      this.inView = v;
      if (v) this.maybeAutoplay();
      else if (this.playing) this.pause(false);
    });
  }

  /* ---------- play state */
  setPlayIcon() {
    const p = this.preset;
    const finished = (p === 't2i' || p === 'vqa') ? this.progress[p] >= 1 : (p === 'joint' && this.snap === 4);
    this.playBtn.hidden = p === 'samplers';
    this.playBtn.textContent = '';
    if (this.playing) {
      this.playBtn.append(icon('pause'));
      this.playBtn.setAttribute('aria-label', 'Pause');
    } else if (finished) {
      this.playBtn.append(icon('replay'));
      this.playBtn.setAttribute('aria-label', 'Replay');
    } else {
      this.playBtn.append(icon('play'));
      this.playBtn.setAttribute('aria-label', 'Play');
    }
  }
  maybeAutoplay() {
    if (!this.inView || this.userPaused || reduceMotion() || this.playing) return;
    const p = this.preset;
    if (p === 'samplers' || this.done[p]) return;
    this.play();
  }
  togglePlay() {
    if (this.playing) { this.pause(true); return; }
    this.userPaused = false;
    this.play(true);
  }
  stopTimers() {
    cancelAnimationFrame(this.raf);
    clearTimeout(this.timer);
    this.raf = 0;
    this.timer = 0;
  }
  pause(byUser) {
    const moving = this.preset === 'joint' && this.raf;
    this.stopTimers();
    if (moving) this.goSnap(this.snap, false);
    this.playing = false;
    if (byUser) this.userPaused = true;
    this.setPlayIcon();
  }
  play() {
    const p = this.preset;
    this.stopTimers();
    if (p === 't2i' || p === 'vqa') {
      if (this.progress[p] >= 1) { this.progress[p] = 0; this.renderEdge(0); }
      this.playing = true;
      this.setPlayIcon();
      this.say(p === 't2i'
        ? 'Generating the image. The text stays clean at t = 1.'
        : 'Generating the answer. The image and question stay clean at t = 1.');
      if (reduceMotion()) { this.stepEdge(p); return; }
      const total = DUR[p];
      const t0 = performance.now() - this.progress[p] * total;
      const tick = (now) => {
        const q = Math.min(1, (now - t0) / total);
        this.progress[p] = q;
        this.renderEdge(q);
        if (q < 1) this.raf = requestAnimationFrame(tick);
        else this.finishEdge();
      };
      this.raf = requestAnimationFrame(tick);
    } else if (p === 'joint') {
      if (this.snap === 4) this.goSnap(0, false);
      this.playing = true;
      this.setPlayIcon();
      const next = () => {
        if (this.snap >= 4) { this.playing = false; this.done.joint = true; this.setPlayIcon(); return; }
        this.goSnap(this.snap + 1, true);
        this.timer = setTimeout(next, DUR.jointHold);
      };
      this.timer = setTimeout(next, this.snap === 0 ? 900 : DUR.jointHold);
    }
  }
  /** Reduced motion: advance the edge presets in visible discrete steps, no tweening. */
  stepEdge(p) {
    const n = p === 't2i' ? this.d.t2i.steps : this.d.vqa.steps;
    const k = Math.round(this.progress[p] * n);
    if (k >= n) { this.finishEdge(); return; }
    this.progress[p] = (k + 1) / n;
    this.renderEdge(this.progress[p]);
    if (this.progress[p] >= 1) { this.finishEdge(); return; }
    this.timer = setTimeout(() => this.stepEdge(p), 120);
  }
  finishEdge() {
    const p = this.preset;
    this.progress[p] = 1;
    this.done[p] = true;
    this.playing = false;
    this.renderEdge(1);
    this.setPlayIcon();
    if (p === 't2i') this.say('Done: the image is clean (image time 1). Selected sample, 224×224.');
    else this.say(`Done: the answer is “${this.d.vqa.answer}” (reference “${this.d.vqa.reference}”).`);
  }
  say(msg) { this.f.status.textContent = msg; }

  /* ---------- presets */
  setPreset(id, user = false) {
    this.stopTimers();
    this.playing = false;
    this.preset = id;
    this.seg.set(id);
    const L = this.sq.layers;
    for (const k of ['under', 'paths', 'marks', 'tags']) L[k].textContent = '';
    this.right.textContent = '';
    this.below.textContent = '';
    this.dot.style.display = id === 'samplers' ? 'none' : '';
    this.dot.setAttribute('class', `sq-dotg dot-${id}`);
    const fillCls = id === 't2i' ? 'f-img' : id === 'vqa' ? 'f-txt' : 'f-joint';
    this.dot.children[0].setAttribute('class', `sq-halo ${fillCls}`);
    this.dot.children[1].setAttribute('class', `sq-dot ${fillCls}`);
    if (id === 't2i' || id === 'vqa') this.buildEdge(id);
    else if (id === 'joint') this.buildJoint();
    else this.buildSamplers();
    this.setPlayIcon();
    if (user && (id === 't2i' || id === 'vqa' || id === 'joint') && !reduceMotion()) {
      // A click on a preset is a request to see it run.
      this.done[id] = false;
      if (id === 'joint') this.goSnap(0, false);
      else { this.progress[id] = 0; this.renderEdge(0); }
      this.play();
    } else {
      this.maybeAutoplay();
    }
  }

  ghostPaths(active) {
    const { X, Y, layers, curve } = this.sq;
    const a = this.d.schedule.alpha.siglip;
    if (active !== 't2i') layers.under.append(sv('line', { class: 'p-img is-ghost', x1: X(0), y1: Y(1), x2: X(1), y2: Y(1), 'stroke-width': 4 }));
    if (active !== 'vqa') layers.under.append(sv('line', { class: 'p-txt is-ghost', x1: X(1), y1: Y(0), x2: X(1), y2: Y(1), 'stroke-width': 4 }));
    if (active !== 'joint') layers.under.append(sv('polyline', { class: 'p-joint is-ghost', points: curve(a), 'stroke-width': 3 }));
  }

  clocks() {
    const mk = (kind, name) => {
      const bar = h('i');
      const val = h('span', { class: 'ts-clock-val' });
      const st = h('span', { class: 'ts-state' });
      const row = h('div', { class: `ts-clock ts-clock--${kind}` },
        h('span', { class: 'ts-clock-name', html: name }), h('span', { class: 'ts-clock-bar' }, bar), val, st);
      return { row, set: (t, state) => {
        bar.style.setProperty('--v', t);
        val.textContent = t.toFixed(2);
        st.dataset.s = state;
        st.textContent = state === 'cond' ? 'condition' : state === 'done' ? 'done' : 'generating';
      } };
    };
    const img = mk('img', `Image ${T_I}`);
    const txt = mk('txt', `Text ${T_T}`);
    const box = h('div', { class: 'ts-clocks', role: 'group', 'aria-label': 'Noise levels' }, img.row, txt.row);
    this.ui.clockImg = img;
    this.ui.clockTxt = txt;
    return box;
  }

  explainLine() {
    return h('p', { class: 'ts-explain' },
      h('span', { html: '<b>t&nbsp;=&nbsp;1</b> clean condition' }),
      h('span', { html: '<b>t&nbsp;&lt;&nbsp;1</b> being generated' }),
      h('span', { html: '<b>t&nbsp;=&nbsp;0</b> pure noise' }));
  }

  /* ---------- T2I and VQA: one edge */
  buildEdge(id) {
    const { X, Y, layers } = this.sq;
    this.ui = {};
    this.ghostPaths(id);
    const isT2I = id === 't2i';
    const D = isT2I ? this.d.t2i : this.d.vqa;
    const n = D.steps;
    const alpha = isT2I ? D.alpha : 1;
    if (isT2I) {
      layers.paths.append(sv('line', { class: 'p-img', x1: X(0), y1: Y(1), x2: X(1), y2: Y(1), 'stroke-width': 7 }));
      for (let k = 0; k <= n; k++) {
        const x = X(shift(alpha, k / n));
        layers.marks.append(sv('line', { class: 'p-img sq-tickmark', x1: x, x2: x, y1: Y(1) + 6, y2: Y(1) + 13 }));
      }
      layers.tags.append(sv('text', { class: 'sq-note sq-note--img', x: X(0), y: Y(1) - 12 }, 'text clean (t', sv('tspan', { class: 'sub', dy: 3 }, 't'), sv('tspan', { dy: -3 }, ' = 1): generate the image →')));
    } else {
      layers.paths.append(sv('line', { class: 'p-txt', x1: X(1), y1: Y(0), x2: X(1), y2: Y(1), 'stroke-width': 7 }));
      for (let k = 0; k <= n; k++) {
        const y = Y(k / n);
        layers.marks.append(sv('line', { class: 'p-txt sq-tickmark', x1: X(1) + 6, x2: X(1) + 13, y1: y, y2: y }));
      }
      layers.tags.append(sv('text', { class: 'sq-note sq-note--txt', x: X(1) - 20, y: Y(0.06), 'text-anchor': 'end' }, 'image clean (t', sv('tspan', { class: 'sub', dy: 3 }, 'i'), sv('tspan', { dy: -3 }, ' = 1):')));
      layers.tags.append(sv('text', { class: 'sq-note sq-note--txt', x: X(1) - 20, y: Y(0.06) + 15, 'text-anchor': 'end' }, 'generate the text ↑'));
    }
    this.sq.svg.setAttribute('aria-label', isT2I
      ? 'Unit square of noise levels. Text to image runs along the top edge, where the text is clean.'
      : 'Unit square of noise levels. Captioning and VQA run along the right edge, where the image is clean.');

    // readout
    const R = this.right;
    R.append(h('p', { class: 'ts-lede', html: isT2I
      ? `<strong>Text clean, image generated.</strong> The prompt is held at ${T_T}&nbsp;=&nbsp;1. Only the image clock runs, along the top edge.`
      : `<strong>Image clean, text generated.</strong> The photo and the question stay at t&nbsp;=&nbsp;1. Only the answer tokens move, up the right edge.` }));
    R.append(this.clocks());

    const imgCard = h('figure', { class: 'ts-card ts-card--img' });
    const txtCard = h('div', { class: 'ts-card ts-card--txt' });
    const imgPill = h('span', { class: 'ts-state' });
    imgCard.append(h('figcaption', { class: 'ts-card-head' }, h('span', null, 'Image'), imgPill));
    const plate = h('div', { class: 'ts-plate' });
    const ui = this.ui;
    ui.imgPill = imgPill;
    ui.plate = plate;
    if (isT2I) {
      const rg = ring();
      const stepTxt = h('span', { class: 'ts-pending-step' });
      plate.append(
        h('div', { class: 'ts-pending', 'aria-hidden': 'true' }, rg.el, stepTxt,
          h('span', { class: 'ts-pending-note' }, 'shown when decoded at the end')),
        h('img', { class: 'ts-final', src: assetURL(D.img), srcset: `${assetURL(D.img)} 1x, ${assetURL(D.img2x)} 2x`, width: 224, height: 224, alt: D.alt, decoding: 'async' }));
      ui.ring = rg;
      ui.stepTxt = stepTxt;
      imgCard.append(plate, h('p', { class: 'ts-card-note' }, `Selected sample · ${D.variant_label} · 224×224`));
      txtCard.append(
        h('div', { class: 'ts-card-head' }, h('span', null, 'Text'), h('span', { class: 'ts-state', 'data-s': 'cond', title: 'clean condition' }, 't = 1')),
        h('p', { class: 'ts-mono ts-quote' }, `“${D.prompt}”`),
        h('p', { class: 'ts-card-note' }, 'The prompt is the condition. It never changes.'));
    } else {
      plate.append(h('img', { class: 'ts-cond', src: assetURL(D.img), width: 380, height: 380, alt: D.alt, decoding: 'async' }));
      imgPill.dataset.s = 'cond';
      imgPill.textContent = 't = 1';
      imgPill.title = 'clean condition';
      imgCard.append(plate, h('p', { class: 'ts-card-note' }, `Input photo (${D.benchmark}) · the model sees it at 224×224`));
      const rg = ring('ts-ring--txt');
      const stepTxt = h('span', { class: 'ts-pending-step' });
      const ans = h('div', { class: 'ts-answer', 'aria-live': 'off' }, rg.el,
        h('span', { class: 'ts-pending-text' }, stepTxt, h('span', { class: 'ts-pending-note', style: { display: 'block', maxWidth: 'none' } }, 'answer tokens, being generated')),
        h('span', { class: 'ts-answer-final' }, D.answer));
      ui.ring = rg;
      ui.stepTxt = stepTxt;
      ui.answer = ans;
      txtCard.append(
        h('div', { class: 'ts-card-head' }, h('span', null, 'Text'), h('span', { class: 'ts-state', 'data-s': 'cond', title: 'question is a clean condition' }, 't = 1')),
        h('div', null, h('p', { class: 'ts-qa-label' }, 'Question'), h('p', { class: 'ts-mono ts-quote' }, D.question)),
        h('div', null, h('p', { class: 'ts-qa-label' }, `Answer (${D.variant_label} variant)`), ans),
        h('p', { class: 'ts-card-note' }, `Reference answer: “${D.reference}”. The DINO variant also answers “${D.answer_dino}”.`));
    }
    R.append(h('div', { class: 'ts-cards' }, imgCard, txtCard));
    R.append(this.explainLine());

    this.below.append(h('p', { class: 'ts-hint', html: isT2I
      ? `Ticks mark the ${n}-step sampling grid. The image schedule S<sub>α</sub> (α = ${D.alpha}) spends most steps while the image is still noisy.`
      : `Ticks mark the ${n}-step sampling grid of the answer. Text is not shifted, so the steps are evenly spaced.` }));

    this.f.foot.innerHTML = isT2I
      ? `<strong>Data.</strong> Selected sample from the paper's Fig. 7 (${D.variant_label} variant, 224×224, ${n} steps, guidance ${D.guidance}). The paper shows no intermediate images for this sample, so none are drawn: the plate stays empty until the final image.`
      : `<strong>Data.</strong> VQAv2 counting question from the paper's Fig. 9, answered by the ${D.variant_label} variant (${n} steps, guidance ${D.guidance}). The input photo is shown at its source size; the model reads it at 224×224.`;
    this.say(isT2I
      ? 'Text → Image: the prompt is clean; the image is generated along the top edge.'
      : 'Captioning / VQA: the image is clean; the answer is generated along the right edge.');
    this.renderEdge(this.progress[id]);
  }

  renderEdge(q) {
    const p = this.preset;
    const ui = this.ui;
    if (!ui || !ui.ring) return;
    const isT2I = p === 't2i';
    const D = isT2I ? this.d.t2i : this.d.vqa;
    const n = D.steps;
    const k = q >= 1 ? n : Math.floor(q * n + 1e-9);
    const t = isT2I ? shift(D.alpha, q) : q;
    const { X, Y } = this.sq;
    const x = isT2I ? X(t) : X(1);
    const y = isT2I ? Y(1) : Y(t);
    this.dot.setAttribute('transform', `translate(${x.toFixed(2)},${y.toFixed(2)})`);
    const finished = q >= 1;
    ui.ring.set(q);
    ui.stepTxt.textContent = `step ${k} / ${n}`;
    if (isT2I) {
      ui.clockImg.set(t, finished ? 'done' : 'gen-img');
      ui.clockTxt.set(1, 'cond');
      ui.imgPill.dataset.s = finished ? 'done' : 'gen-img';
      ui.imgPill.textContent = finished ? 't = 1' : `t = ${t.toFixed(2)}`;
      ui.plate.classList.toggle('is-revealed', finished);
    } else {
      ui.clockImg.set(1, 'cond');
      ui.clockTxt.set(t, finished ? 'done' : 'gen-txt');
      ui.answer.classList.toggle('is-revealed', finished);
    }
  }

  /* ---------- Joint */
  sample() { return this.d.joint.samples.find((s) => s.id === this.sampleId) || this.d.joint.samples[0]; }

  buildJoint() {
    const { layers } = this.sq;
    this.ui = {};
    this.ghostPaths('joint');
    const R = this.right;
    const J = this.d.joint;
    R.append(h('p', { class: 'ts-lede', html: '<strong>Both clocks run.</strong> Neither stream is a condition. The text clock runs ahead, so the caption takes shape before the image does.' }));
    const picker = h('div', { class: 'ts-samples', role: 'group', 'aria-label': 'Joint sample' });
    this.ui.pickBtns = J.samples.map((s) => {
      const last = s.steps[s.steps.length - 1];
      const b = h('button', {
        type: 'button', class: 'ts-sample', 'aria-pressed': String(s.id === this.sampleId),
        'aria-label': `${s.variant_label} sample ${s.sample}`,
        onclick: () => this.setSample(s.id),
      }, h('img', { src: assetURL(last.img), width: 64, height: 64, alt: '', loading: 'lazy', decoding: 'async' }),
        h('span', null, h('span', { class: `v-${s.variant}` }, s.variant_label), ` #${s.sample}`));
      picker.append(b);
      return b;
    });
    R.append(picker, this.clocks());

    const imgPill = h('span', { class: 'ts-state', 'data-s': 'gen-img' });
    const txtPill = h('span', { class: 'ts-state', 'data-s': 'gen-txt' });
    const imA = h('img', { width: 224, height: 224, alt: '', decoding: 'async' });
    const imB = h('img', { width: 224, height: 224, alt: '', decoding: 'async', class: 'is-hidden' });
    const plate = h('div', { class: 'ts-plate' }, imA, imB);
    const cap = h('p', { class: 'ts-mono ts-caption' });
    const imgNote = h('p', { class: 'ts-card-note' });
    R.append(h('div', { class: 'ts-cards' },
      h('figure', { class: 'ts-card ts-card--img' }, h('figcaption', { class: 'ts-card-head' }, h('span', null, 'Image'), imgPill), plate, imgNote),
      h('div', { class: 'ts-card ts-card--txt' }, h('div', { class: 'ts-card-head' }, h('span', null, 'Text'), txtPill), cap)));
    R.append(h('p', { class: 'ts-hint' }, 'Captions are read with the autoregressive caption decoder (first 28 words). Selected samples; the captions contain model errors. Highlighted words changed since the previous step.'));
    R.append(this.explainLine());
    Object.assign(this.ui, { imgPill, txtPill, imA, imB, cap, imgNote, front: imA });

    // path, snap markers
    const s = this.sample();
    this.ui.curve = sv('polyline', { class: 'p-joint', points: this.sq.curve(s.alpha), 'stroke-width': 5 });
    layers.paths.append(this.ui.curve);
    this.ui.snapMarks = [];
    this.drawSnaps();

    // slider
    const lbl = h('div', { class: 'ts-slider-label' }, h('span', null, 'Decoded step'), h('span', { html: '' }));
    this.ui.sliderLbl = lbl.lastChild;
    this.ui.range = snapRange({
      label: 'Sampling step', ticks: J.snaps.map(String), value: this.snap,
      valueText: (v) => `step ${J.snaps[v]} of ${J.total_steps}`,
      onInput: (v) => { this.pause(true); this.goSnap(v, true); },
    });
    this.below.append(lbl, this.ui.range.el);
    this.f.foot.innerHTML = `<strong>Data.</strong> Real decoded states at steps ${J.snaps.join(', ')} of ${J.total_steps} (paper Fig. 21, appendix); nothing is shown between them. Curve: ${T_T} = s, ${T_I} = S<sub>α</sub>(s), α = ${this.d.schedule.alpha.siglip} (SigLIP2) or ${this.d.schedule.alpha.dino} (DINO); the dot sits at the (${T_I}, ${T_T}) printed for each step. Selected samples, 224×224.`;
    this.sq.svg.setAttribute('aria-label', 'Unit square of noise levels with the joint sampling path, which bends toward the text axis.');
    this.preload(s);
    this.goSnap(this.snap, false);
    this.say(`Joint generation, ${s.variant_label} sample ${s.sample}: both streams start from noise.`);
  }

  drawSnaps() {
    const { X, Y, layers } = this.sq;
    layers.marks.textContent = '';
    const s = this.sample();
    this.ui.snapMarks = s.steps.map((st, i) => {
      const c = sv('circle', { class: 'sq-snap', cx: X(st.t_image), cy: Y(st.t_text), r: 4.5 });
      layers.marks.append(c);
      if (st.step !== 64) {
        layers.marks.append(sv('text', { class: 'sq-snap-label', x: X(st.t_image) + 10, y: Y(st.t_text) + 4 }, String(st.step)));
      }
      void i;
      return c;
    });
    layers.marks.append(sv('text', { class: 'sq-snap-label', x: X(1) - 2, y: Y(1) - 12, 'text-anchor': 'end' }, '64'));
  }

  preload(s) {
    for (const st of s.steps) {
      const im = new Image();
      im.srcset = `${assetURL(st.img)} 1x, ${assetURL(st.img2x)} 2x`;
      im.src = assetURL(st.img);
    }
  }

  setSample(id) {
    if (id === this.sampleId) return;
    this.sampleId = id;
    this.ui.pickBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(this.d.joint.samples[i].id === id)));
    const s = this.sample();
    this.ui.curve.setAttribute('points', this.sq.curve(s.alpha));
    this.drawSnaps();
    this.preload(s);
    this.ui.prevCaption = null;
    this.goSnap(this.snap, false, true);
    this.say(`${s.variant_label} sample ${s.sample}, step ${s.steps[this.snap].step} of 64.`);
  }

  /** Moves to decoded step index k. Cards change only when the dot arrives. */
  goSnap(k, animate, forceCards = false) {
    const s = this.sample();
    const J = this.d.joint;
    const from = this.snap;
    const st = s.steps[k];
    this.snap = k;
    if (this.ui.range) this.ui.range.set(k);
    if (this.ui.sliderLbl) this.ui.sliderLbl.innerHTML = `<b>step ${st.step}</b> of ${J.total_steps}`;
    const { X, Y } = this.sq;
    const place = (ti, tt) => this.dot.setAttribute('transform', `translate(${X(ti).toFixed(2)},${Y(tt).toFixed(2)})`);
    const arrive = () => { place(st.t_image, st.t_text); this.showState(s, k, forceCards || from !== k); };
    cancelAnimationFrame(this.raf);
    if (!animate || reduceMotion() || from === k) { arrive(); return; }
    // Travel along the real curve; endpoints blend into the printed (t_i, t_t) of each step.
    const a = s.steps[from];
    const sa = a.step / J.total_steps;
    const sb = st.step / J.total_steps;
    const offA = [a.t_image - shift(s.alpha, sa), a.t_text - sa];
    const offB = [st.t_image - shift(s.alpha, sb), st.t_text - sb];
    const t0 = performance.now();
    const tick = (now) => {
      const q = Math.min(1, (now - t0) / DUR.jointMove);
      const e = q < 0.5 ? 2 * q * q : 1 - (-2 * q + 2) ** 2 / 2;
      const sc = sa + (sb - sa) * e;
      place(shift(s.alpha, sc) + offA[0] * (1 - e) + offB[0] * e, sc + offA[1] * (1 - e) + offB[1] * e);
      if (q < 1) this.raf = requestAnimationFrame(tick);
      else arrive();
    };
    this.raf = requestAnimationFrame(tick);
  }

  showState(s, k, changed) {
    const st = s.steps[k];
    const ui = this.ui;
    const final = st.step === 64;
    ui.clockImg.set(st.t_image, final ? 'done' : 'gen-img');
    ui.clockTxt.set(st.t_text, final ? 'done' : 'gen-txt');
    ui.imgPill.dataset.s = final ? 'done' : 'gen-img';
    ui.imgPill.textContent = `t = ${st.t_image.toFixed(2)}`;
    ui.txtPill.dataset.s = final ? 'done' : 'gen-txt';
    ui.txtPill.textContent = `t = ${st.t_text.toFixed(2)}`;
    ui.imgNote.textContent = final
      ? `Final sample, step 64 of 64 · ${s.variant_label} · 224×224`
      : `Current estimate at step ${st.step} of 64 · 224×224`;
    this.ui.snapMarks.forEach((c, i) => c.classList.toggle('is-on', i <= k));
    // image: crossfade between two stacked images (<= 180 ms), or a hard cut under reduced motion
    const src = assetURL(st.img);
    const srcset = `${assetURL(st.img)} 1x, ${assetURL(st.img2x)} 2x`;
    const front = ui.front;
    const back = front === ui.imA ? ui.imB : ui.imA;
    const alt = `${s.variant_label} sample ${s.sample}, decoded image estimate at step ${st.step} of 64`;
    if (!front.getAttribute('src')) {
      front.srcset = srcset; front.src = src; front.alt = alt;
    } else if (front.getAttribute('src') !== src) {
      back.srcset = srcset; back.src = src; back.alt = alt;
      const swap = () => { back.classList.remove('is-hidden'); front.classList.add('is-hidden'); ui.front = back; };
      if (back.decode) back.decode().then(swap, swap); else swap();
    }
    // caption with changed words highlighted
    const words = st.caption.split(' ');
    const ch = new Set(changed ? st.changed : []);
    ui.cap.textContent = '';
    words.forEach((w, i) => {
      if (i) ui.cap.append(' ');
      ui.cap.append(ch.has(i) ? h('span', { class: 'w-new' }, w) : w);
    });
    if (changed) {
      const nCh = st.changed.length;
      this.say(`Step ${st.step} of 64: image time ${st.t_image.toFixed(2)}, text time ${st.t_text.toFixed(2)}. ${k === 0 ? 'First decoded step.' : nCh ? `${nCh} caption word${nCh > 1 ? 's' : ''} changed.` : 'The caption did not change.'}`);
    }
    this.setPlayIcon();
  }

  /* ---------- Samplers */
  buildSamplers() {
    this.ui = {};
    const { layers } = this.sq;
    const S = this.d.samplers;
    const R = this.right;
    R.append(h('p', { class: 'ts-lede', html: '<strong>Samplers are paths too.</strong> Each sampler queries the network along its own route through the square. Toggle them to compare.' }));
    const list = h('div', { class: 'ts-samplers', role: 'group', 'aria-label': 'Samplers' });
    const desc = h('p', { class: 'ts-sampler-desc', 'aria-live': 'polite' });
    this.ui.desc = desc;
    this.ui.rows = {};
    for (const it of S.items) {
      const row = h('button', {
        type: 'button', class: `ts-sampler ts-sampler--${it.id}`, 'aria-pressed': String(this.samplersOn.has(it.id)),
        onclick: () => this.toggleSampler(it.id),
        onmouseenter: () => this.focusSampler(it.id), onfocus: () => this.focusSampler(it.id),
        onmouseleave: () => this.focusSampler(null), onblur: () => this.focusSampler(null),
      }, this.samplerSwatch(it.id),
        h('span', { class: 'ts-sampler-name' }, it.label, h('span', { class: 'ts-sampler-order' }, it.order === 'none' ? (it.id === 'coupled' ? 'no order chosen' : 'no order, no exchange') : `order: ${it.order}`)),
        h('span', { class: 'ts-sampler-val' }, `${it.success.toFixed(1)}%`));
      this.ui.rows[it.id] = row;
      list.append(row);
    }
    R.append(list, desc, h('p', { class: 'ts-hint' }, `${S.metric}. Higher means the drawn route and the written moves agree more often.`), this.explainLine());
    this.ui.groups = {};
    this.drawSamplers();
    this.describeSampler(this.samplerFocus);
    this.below.append(h('p', { class: 'ts-hint', html: 'Blue segments generate the image, orange the text, violet both at once. Dashed: independent sampling, where neither stream sees the other.' }));
    this.f.foot.innerHTML = `<strong>Data.</strong> ${S.metric}: ${S.setting} (paper ${S.source}). Paths follow the paper's sampler definitions; the not-yet-generated stream sits at t = 0.`;
    this.sq.svg.setAttribute('aria-label', 'Unit square of noise levels showing where each sampler queries the network.');
    this.say('Samplers: independent, image first, text first and coupled.');
  }

  samplerSwatch(id) {
    const g = sv('svg', { viewBox: '0 0 34 26', 'aria-hidden': 'true' });
    const L = (cls, d, extra = {}) => g.append(sv('path', Object.assign({ class: cls, d, fill: 'none', 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, extra)));
    const st = (c) => ({ style: { stroke: `var(${c})` } });
    if (id === 'independent') { L('', 'M4 22H30', { ...st('--img'), 'stroke-dasharray': '4 3' }); L('', 'M4 22V3', { ...st('--txt'), 'stroke-dasharray': '4 3' }); }
    if (id === 'image_first') { L('', 'M4 22H29', st('--img')); L('', 'M29 22V3', st('--txt')); }
    if (id === 'text_first') { L('', 'M5 23V4', st('--txt')); L('', 'M5 4H30', st('--img')); }
    if (id === 'coupled') { const a = this.d.schedule.alpha.siglip; let d = ''; for (let k = 0; k <= 30; k++) { const s = k / 30; d += `${k ? 'L' : 'M'}${(4 + 26 * shift(a, s)).toFixed(1)} ${(23 - 20 * s).toFixed(1)}`; } L('', d, st('--joint')); }
    return g;
  }

  drawSamplers() {
    const { X, Y, layers, curve } = this.sq;
    const S = this.d.samplers;
    const a = this.d.schedule.alpha.siglip;
    layers.paths.textContent = '';
    layers.tags.textContent = '';
    const o = 5;
    const byId = Object.fromEntries(S.items.map((i) => [i.id, i]));
    const make = (id) => {
      const g = sv('g', { class: 'sampler', 'data-id': id });
      layers.paths.append(g);
      this.ui.groups[id] = g;
      return g;
    };
    const line = (g, cls, x1, y1, x2, y2, extra = {}) => g.append(sv('line', Object.assign({ class: cls, x1, y1, x2, y2, 'stroke-width': 3.5 }, extra)));
    const dash = { 'stroke-dasharray': '7 6' };
    // Independent: two separate traces on the outer side of the bottom and left edges
    let g = make('independent');
    line(g, 'p-img', X(0) + 4, Y(0) + o, X(1) - 4, Y(0) + o, dash);
    arrow(g, X(1) + 2, Y(0) + o, 1, 0, 'f-img');
    line(g, 'p-txt', X(0) - o, Y(0) - 4, X(0) - o, Y(1) + 4, dash);
    arrow(g, X(0) - o, Y(1) - 2, 0, -1, 'f-txt');
    // Image first: bottom edge (image), then up the right edge (text)
    g = make('image_first');
    line(g, 'p-img', X(0) + 4, Y(0) - o, X(1) - o, Y(0) - o);
    line(g, 'p-txt', X(1) - o, Y(0) - o, X(1) - o, Y(1) + 6);
    arrow(g, X(1) - o, Y(1) + 2, 0, -1, 'f-txt');
    // Text first: left edge (text), then along the top edge (image)
    g = make('text_first');
    line(g, 'p-txt', X(0) + o, Y(0) - 4, X(0) + o, Y(1) + o);
    line(g, 'p-img', X(0) + o, Y(1) + o, X(1) - 6, Y(1) + o);
    arrow(g, X(1) - 2, Y(1) + o, 1, 0, 'f-img');
    // Coupled: the interior curve
    g = make('coupled');
    g.append(sv('polyline', { class: 'p-joint', points: curve(a, 0, 0.985), 'stroke-width': 4.5 }));
    arrow(g, X(1) - 1, Y(1) + 1, X(1) - X(shift(a, 0.96)), Y(1) - Y(0.96), 'f-joint', 11);

    // labels
    const T = (id, x, y, kind, anchor, dashed) => {
      const t = tag(layers.tags, { x, y, text: byId[id].label, num: `${byId[id].success.toFixed(1)}%`, kind, anchor, dashed });
      t.setAttribute('data-id', id);
      this.ui.groups[`${id}-tag`] = t;
    };
    T('text_first', X(0.5), Y(1) - 20, 'muted', 'middle');
    T('image_first', X(1) - 16, Y(0.36), 'muted', 'end');
    T('independent', X(0) + 16, Y(0.13), 'muted', 'start', true);
    T('coupled', X(0.36), Y(0.74), 'joint', 'start');
    this.applySamplerVisibility();
  }

  applySamplerVisibility() {
    for (const it of this.d.samplers.items) {
      const on = this.samplersOn.has(it.id);
      for (const k of [it.id, `${it.id}-tag`]) {
        const g = this.ui.groups[k];
        if (!g) continue;
        g.style.display = on ? '' : 'none';
        g.classList.toggle('is-dim', !!this.hoverSampler && this.hoverSampler !== it.id);
      }
      this.ui.rows[it.id].setAttribute('aria-pressed', String(on));
      this.ui.rows[it.id].classList.toggle('is-focus', this.hoverSampler === it.id);
    }
  }

  toggleSampler(id) {
    if (this.samplersOn.has(id)) this.samplersOn.delete(id);
    else this.samplersOn.add(id);
    this.samplerFocus = id;
    this.applySamplerVisibility();
    this.describeSampler(id);
    const g = this.ui.groups[id];
    if (this.samplersOn.has(id) && g && !reduceMotion()) {
      g.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: 'ease-out' });
    }
  }

  focusSampler(id) {
    this.hoverSampler = id && this.samplersOn.has(id) ? id : null;
    if (id) this.describeSampler(id);
    this.applySamplerVisibility();
  }

  describeSampler(id) {
    const it = this.d.samplers.items.find((x) => x.id === id) || this.d.samplers.items[3];
    const on = this.samplersOn.has(it.id);
    this.ui.desc.innerHTML = '';
    this.ui.desc.append(h('b', null, `${it.label}: ${it.success.toFixed(1)}%`), on ? '' : ' (hidden)', h('br'), it.desc);
  }
}
