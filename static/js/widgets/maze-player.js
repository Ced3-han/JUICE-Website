/* JUICE widget C: "When two answers must agree".
   export function mount(el): el = <div class="widget" data-widget="maze-player" data-src="static/data/maze.json">
   Only the paper's keyframes are shown (Fig. 11); nothing is interpolated. */
import { h, sv, frame, unframe, loadJSON, reduceMotion, segmented, snapRange, watchView, icon, assetURL } from './time-square.js';

const HOLD = 1700;
const HOLD_END = 2600;
const STATUS_ICON = { agree: 'check', warn: 'neq', bad: 'cross' };

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
    new MazePlayer(el, data);
    el.dataset.mounted = '1';
  } catch (err) {
    unframe(el, 'w-maze-player');
    throw err;
  }
}

class MazePlayer {
  constructor(el, data) {
    this.el = el;
    this.d = data;
    this.mi = 0;
    this.fi = 0;
    this.variant = 'siglip';
    this.playing = false;
    this.userPaused = false;
    this.inView = false;
    this.timer = 0;
    this.build();
    this.setMaze(0, true);
    this.renderScore(false);
  }

  get maze() { return this.d.mazes[this.mi]; }

  build() {
    const f = frame(this.el, { cls: 'w-maze-player', title: 'Two traced mazes' });
    this.f = f;
    this.el.dataset.tab = 'coupled';
    this.mazeSeg = segmented({
      label: 'Maze',
      items: this.d.mazes.map((m, i) => ({ id: String(i), label: m.label, sub: m.subtitle })),
      value: '0',
      cls: 'w-seg--keep',
      onChange: (id) => { this.pause(true); this.setMaze(+id); },
    });
    this.explain = h('p', { class: 'mz-explain' });
    this.tabs = segmented({
      label: 'Sampler shown',
      items: [{ id: 'coupled', label: 'Coupled' }, { id: 'independent', label: 'Independent' }],
      value: 'coupled',
      cls: 'mz-tabs w-seg--keep',
      onChange: (id) => { this.el.dataset.tab = id; },
    });
    this.panels = {
      coupled: this.panel('coupled', 'Coupled', 'each stream sees the other'),
      independent: this.panel('independent', 'Independent', 'separate streams'),
    };
    const panels = h('div', { class: 'mz-panels' }, this.panels.coupled.el, this.panels.independent.el);

    this.playBtn = h('button', { type: 'button', class: 'w-iconbtn w-iconbtn--play', onclick: () => this.togglePlay() });
    const prev = h('button', { type: 'button', class: 'w-iconbtn', 'aria-label': 'Previous keyframe', onclick: () => { this.pause(true); this.go(Math.max(0, this.fi - 1)); } }, icon('prev'));
    const next = h('button', { type: 'button', class: 'w-iconbtn', 'aria-label': 'Next keyframe', onclick: () => { this.pause(true); this.go(Math.min(this.maze.frames.length - 1, this.fi + 1)); } }, icon('next'));
    this.range = snapRange({
      label: 'Keyframe', ticks: ['0'], value: 0,
      valueText: (v) => this.frameText(v),
      onInput: (v) => { this.pause(true); this.go(v); },
    });
    const controls = h('div', { class: 'mz-controls' }, this.playBtn, prev, this.range.el, next);
    const L = this.d.legend;
    const legend = h('div', { class: 'mz-legend' },
      h('span', null, h('img', { src: assetURL(L.start), alt: '', width: 12, height: 12 }), 'start'),
      h('span', null, h('img', { src: assetURL(L.goal), alt: '', width: 12, height: 12 }), 'goal'),
      h('span', null, h('img', { class: 'wide', src: assetURL(L.route), alt: '', width: 22, height: 8 }), 'drawn route (image)'),
      h('span', null, sv('svg', { viewBox: '0 0 26 10', 'aria-hidden': 'true' },
        sv('line', { x1: 1, y1: 5, x2: 25, y2: 5, class: 'mz-route-casing', style: { strokeWidth: '6px' } }),
        sv('line', { x1: 1, y1: 5, x2: 25, y2: 5, class: 'mz-route', style: { strokeWidth: '3.5px', strokeDasharray: '5 3' } })), 'route of the moves (text)'));

    this.score = this.buildScore();
    this.el.append(this.mazeSeg.el, this.explain, this.tabs.el, panels, controls, legend, f.status, this.score, f.foot);
    const S = this.d.scoreboard;
    f.foot.innerHTML = this.d.every_step
      ? `<strong>Data.</strong> The two mazes traced in the paper (${this.d.source}), decoded at every coupled step (0 to 15). Independent sampling, with the same 16 steps per stream, is shown at its start, shared with coupled sampling, and at its last step. Scores: ${S.setting} (paper ${S.source}).`
      : `<strong>Data.</strong> Selected mazes: keyframes from the paper's ${this.d.source}; the independent run there used 16 steps per stream. Both samplers start from the same state at step 0, and the coupled outputs do not change after the last step shown. Scores: ${S.setting} (paper ${S.source}).`;

    watchView(panels, (v) => {
      this.inView = v;
      if (v) this.maybeAutoplay();
      else if (this.playing) this.pause(false);
    });
    this.setPlayIcon();
  }

  panel(kind, title, sub) {
    const img = h('img', { width: 312, height: 312, alt: '', decoding: 'async' });
    const casing = sv('polyline', { class: 'mz-route-casing' });
    const route = sv('polyline', { class: 'mz-route' });
    const svg = sv('svg', { viewBox: `0 0 ${this.d.grid_px} ${this.d.grid_px}`, 'aria-hidden': 'true' }, casing, route);
    const pending = h('div', { class: 'mz-pending' });
    const stage = h('div', { class: 'mz-stage' }, img, svg, pending);
    const step = h('span', { class: 'mz-step' });
    const chip = h('span', { class: 'w-status-chip' });
    const moves = h('span', { class: 'mz-moves-str' });
    const el = h('section', { class: `mz-panel mz-panel--${kind}`, 'aria-label': title },
      h('div', { class: 'mz-panel-head' }, h('span', { class: 'mz-panel-title' }, title, h('small', null, sub)), step),
      stage,
      h('div', { class: 'mz-meta' }, h('span', { class: 'mz-moves' }, h('span', { class: 'mz-moves-label' }, 'Moves'), moves), chip));
    return { el, img, casing, route, stage, pending, step, chip, moves };
  }

  buildScore() {
    const S = this.d.scoreboard;
    this.varSeg = segmented({
      label: 'Encoder variant',
      items: Object.entries(S.variants).map(([id, label]) => ({ id, label })),
      value: this.variant,
      cls: 'w-seg--compact w-seg--keep mz-seg-variant',
      onChange: (id) => { this.variant = id; this.renderScore(true); },
    });
    const head = h('div', { class: 'mz-score-head' },
      h('p', { class: 'mz-score-title' }, `${S.metric} on 500 test mazes, 224×224`, h('small', null, 'Both outputs valid and showing the same route')),
      this.varSeg.el);
    this.barEls = {};
    const row = (r) => {
      const fill = h('span', { class: 'mz-fill' });
      const val = h('span', { class: 'mz-bar-val' });
      const lab = h('span', { class: 'mz-bar-label' }, r.label, r.accent ? h('small', null, 'no order chosen') : null);
      const el = h('div', { class: `mz-bar mz-bar--${r.id}`, role: 'listitem' }, lab, h('span', { class: 'mz-track' }, fill), val);
      this.barEls[r.id] = { el, fill, val };
      return el;
    };
    const rows = S.rows;
    const seq = rows.filter((r) => r.group === 'sequential');
    const bars = h('div', { class: 'mz-bars', role: 'list', 'aria-label': S.metric });
    for (const r of rows) {
      if (r.group === 'sequential') {
        if (r === seq[0]) {
          bars.append(h('div', { class: 'mz-seq' },
            h('div', { class: 'mz-seq-rows' }, seq.map(row)),
            h('span', { class: 'mz-bracket' }, 'order fixed in advance')));
        }
      } else bars.append(row(r));
    }
    this.honest = h('p', { class: 'mz-honest' });
    return h('div', { class: 'mz-score' }, head, bars, this.honest);
  }

  renderScore(animate) {
    const S = this.d.scoreboard;
    const v = this.variant;
    for (const r of S.rows) {
      const b = this.barEls[r.id];
      if (!animate || reduceMotion()) {
        b.fill.style.transition = 'none';
        requestAnimationFrame(() => { b.fill.style.transition = ''; });
      }
      b.fill.style.setProperty('--v', r[v]);
      b.val.textContent = r[v].toFixed(1);
      b.el.setAttribute('aria-label', `${r.label}: ${r[v].toFixed(1)}%`);
    }
    const gap = S.gap_to_better_order[v];
    const name = S.variants[v];
    this.honest.textContent = `Coupled sampling needs no order and lands within ${gap.toFixed(1)} point${gap === 1 ? '' : 's'} of the better order (${name}). Image first is slightly higher, but you have to know to pick it.`;
  }

  /* ---------- playback */
  setPlayIcon() {
    this.playBtn.textContent = '';
    this.playBtn.append(icon(this.playing ? 'pause' : 'play'));
    this.playBtn.setAttribute('aria-label', this.playing ? 'Pause' : 'Play keyframes');
  }
  maybeAutoplay() {
    if (!this.inView || this.userPaused || this.playing || reduceMotion()) return;
    this.play();
  }
  togglePlay() {
    if (this.playing) { this.pause(true); return; }
    this.userPaused = false;
    if (this.fi === this.maze.frames.length - 1) this.go(0);
    this.play();
  }
  play() {
    this.playing = true;
    this.setPlayIcon();
    this.schedule();
  }
  schedule() {
    clearTimeout(this.timer);
    const last = this.maze.frames.length - 1;
    this.timer = setTimeout(() => {
      if (!this.playing) return;
      this.go(this.fi >= last ? 0 : this.fi + 1);
      this.schedule();
    }, this.fi >= last ? HOLD_END : (this.d.every_step ? 650 : HOLD));
  }
  pause(byUser) {
    clearTimeout(this.timer);
    this.playing = false;
    if (byUser) this.userPaused = true;
    this.setPlayIcon();
  }

  setMaze(i, quiet = false) {
    this.mi = i;
    this.mazeSeg.set(String(i));
    const m = this.maze;
    this.explain.textContent = m.explain;
    this.range.setTicks(m.frames.map((fr) => String(fr.step)));
    // preload this maze's rasters
    for (const fr of m.frames) for (const p of [fr.coupled, fr.independent]) if (p) { const im = new Image(); im.src = assetURL(p.img); }
    this.go(0, quiet);
  }

  frameText(k) {
    const fr = this.maze.frames[k];
    if (!fr) return '';
    return k === this.maze.frames.length - 1 ? `final, step ${fr.step}` : `step ${fr.step}`;
  }

  go(k, quiet = false) {
    const m = this.maze;
    const fr = m.frames[k];
    this.fi = k;
    this.range.set(k);
    const last = k === m.frames.length - 1;
    const prevFr = k > 0 ? m.frames[k - 1] : null;
    // Coupled
    const c = fr.coupled;
    this.show(this.panels.coupled, c,
      c.held_from != null ? `steps ${c.held_from}–${fr.step} · no change` : `step ${fr.step}`,
      prevFr && prevFr.coupled ? prevFr.coupled.moves : null);
    // Independent: the paper shows only its start (shared with coupled) and its last step
    const ind = fr.independent;
    const P = this.panels.independent;
    if (ind) {
      this.show(P, ind, ind.shared_start ? `step 0 · same start` : `step ${ind.step} · last step`, null);
      P.stage.classList.remove('is-pending');
    } else {
      const start = m.frames[0].independent;
      this.show(P, start, `step ${fr.step} · not shown`, null);
      P.stage.classList.add('is-pending');
      P.pending.innerHTML = '';
      P.pending.append(h('b', null, 'Still running'), this.d.every_step
        ? `Independent sampling is shown at its start and at its last step (${m.frames[m.frames.length - 1].independent.step}).`
        : `The paper shows independent sampling only at step 0 and at its last step (${m.frames[m.frames.length - 1].independent.step}).`);
      P.chip.dataset.kind = 'none';
      P.chip.textContent = 'not shown';
      P.moves.classList.add('is-faded');
    }
    if (!quiet) {
      const indTxt = ind ? `independent: ${ind.status}` : 'independent: not shown at this step';
      this.f.status.textContent = `${m.label}, ${last ? 'final' : `step ${fr.step}`}. Coupled: ${c.status}${c.moves !== (prevFr && prevFr.coupled ? prevFr.coupled.moves : c.moves) ? `, moves now ${c.moves}` : ''}; ${indTxt}.`;
    }
  }

  show(P, p, stepText, prevMoves) {
    P.step.textContent = stepText;
    const src = assetURL(p.img);
    if (P.img.getAttribute('src') !== src) P.img.src = src;
    P.img.alt = `Decoded maze image (${p.status}); the blue route is drawn by the image stream.`;
    const pts = p.route.map(([x, y]) => `${(x * this.d.grid_px).toFixed(1)},${(y * this.d.grid_px).toFixed(1)}`).join(' ');
    P.casing.setAttribute('points', pts);
    P.route.setAttribute('points', pts);
    // moves with changed letters underlined (from the paper's underlined_idx)
    P.moves.classList.remove('is-faded');
    P.moves.textContent = '';
    const u = new Set(p.underlined_idx || []);
    [...p.moves].forEach((ch, i) => P.moves.append(u.has(i) ? h('u', null, ch) : ch));
    P.moves.setAttribute('aria-label', `Moves ${p.moves}${u.size ? `; changed: ${[...u].map((i) => p.moves[i]).join(', ')}` : ''}`);
    if (!reduceMotion() && prevMoves && prevMoves !== p.moves) {
      P.moves.animate([{ opacity: 0.3 }, { opacity: 1 }], { duration: 300, easing: 'ease-out' });
    }
    // status chip
    P.chip.dataset.kind = p.status_kind;
    P.chip.textContent = '';
    P.chip.append(icon(STATUS_ICON[p.status_kind]), p.status);
  }
}
