/* JUICE widget: "Visual spatial planning, step by step".
   export function mount(el): el = <div class="widget" data-widget="vsp-player" data-src="static/data/vsp.json">
   Steps through coupled sampling on FrozenLake maps: the decoded image (the drawn path) and the decoded moves at
   each step shown. Moves are written in runs (L³ = three L), and a run that changed since the previous step shown
   is marked, with a line saying what was corrected. If a frame gives the cell where the moves fail ({r, c} on an
   n x n grid), a red cross is drawn there; keyframes cropped from the paper already carry it. */
import { h, sv, frame, unframe, loadJSON, reduceMotion, segmented, snapRange, watchView, icon, assetURL } from './time-square.js';

const STATUS_ICON = { agree: 'check', warn: 'neq', bad: 'cross' };
const SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
const sup = (n) => (n > 1 ? String(n).split('').map((d) => SUP[d]).join('') : '');
const NAME = { L: 'left', R: 'right', U: 'up', D: 'down' };

/** "LULLLD" -> [{d:'L',n:1},{d:'U',n:1},{d:'L',n:3},{d:'D',n:1}] */
export function runs(moves) {
  const out = [];
  for (const ch of moves) {
    const last = out[out.length - 1];
    if (last && last.d === ch) last.n += 1; else out.push({ d: ch, n: 1 });
  }
  return out;
}

/** Which runs of `cur` changed relative to `prev`, and a sentence describing the correction. */
export function diffRuns(prev, cur) {
  const a = runs(prev), b = runs(cur);
  const changed = new Set();
  const notes = [];
  if (a.length === b.length && a.every((r, i) => r.d === b[i].d)) {
    b.forEach((r, i) => {
      if (r.n !== a[i].n) {
        changed.add(i);
        const diff = r.n - a[i].n;
        const amt = Math.abs(diff) === 1 ? 'one' : String(Math.abs(diff));
        notes.push(`${amt} ${diff > 0 ? 'more' : 'fewer'} ${NAME[r.d] || r.d} in run ${i + 1}: ${r.d}${sup(a[i].n)} → ${r.d}${sup(r.n)}`);
      }
    });
  } else {
    // different run structure: mark runs of cur that do not appear at the same position in prev
    b.forEach((r, i) => { if (!a[i] || a[i].d !== r.d || a[i].n !== r.n) changed.add(i); });
    notes.push(`moves rewritten: ${fmt(prev)} → ${fmt(cur)}`);
  }
  return { changed, notes };
}
const fmt = (m) => runs(m).map((r) => r.d + sup(r.n)).join(' ');

export async function mount(el) {
  if (!el || el.dataset.mounted) return;
  el.dataset.mounted = 'loading';
  let data;
  try { data = await loadJSON(el); } catch (err) { delete el.dataset.mounted; throw err; }
  try {
    // eslint-disable-next-line no-new
    new VspPlayer(el, data);
    el.dataset.mounted = '1';
  } catch (err) { unframe(el, 'w-vsp-player'); throw err; }
}

class VspPlayer {
  constructor(el, data) {
    this.el = el;
    this.d = data;
    this.mi = 0;
    this.k = 0;
    this.playing = false;
    this.userPaused = false;
    this.inView = false;
    this.timer = 0;
    this.build();
    this.setMap(0, true);
  }

  get map() { return this.d.maps[this.mi]; }

  build() {
    const f = frame(this.el, { cls: 'w-vsp-player', title: 'Visual spatial planning, step by step' });
    this.f = f;
    this.playBtn = h('button', { type: 'button', class: 'w-iconbtn w-iconbtn--play', onclick: () => this.togglePlay() });
    f.ctrls.append(this.playBtn);
    this.mapSeg = segmented({
      label: 'Map',
      items: this.d.maps.map((m, i) => ({ id: String(i), label: m.label, sub: m.sub })),
      value: '0',
      cls: 'w-seg--keep',
      onChange: (id) => { this.pause(true); this.setMap(+id); },
    });
    this.explain = h('p', { class: 'vp-explain' });
    this.jump = h('button', { type: 'button', class: 'vp-jump', hidden: true });

    this.img = h('img', { width: 290, height: 290, alt: '', decoding: 'async' });
    this.overlay = sv('svg', { class: 'vp-overlay', viewBox: '0 0 100 100', preserveAspectRatio: 'none', 'aria-hidden': 'true' });
    this.stepLbl = h('span', { class: 'vp-step' });
    const stage = h('div', { class: 'vp-stage' }, this.img, this.overlay);
    const left = h('figure', { class: 'vp-card' }, h('figcaption', { class: 'vp-head' }, h('span', null, 'Drawn path (image)'), this.stepLbl), stage);

    this.moves = h('p', { class: 'vp-moves', 'aria-live': 'off' });
    this.expanded = h('p', { class: 'vp-expanded' });
    this.chip = h('span', { class: 'w-status-chip' });
    this.fix = h('div', { class: 'vp-fix' });
    const right = h('div', { class: 'vp-card vp-card--txt' },
      h('div', { class: 'vp-head' }, h('span', null, 'Moves (text)'), this.chip),
      this.moves, this.expanded, this.fix);

    const prev = h('button', { type: 'button', class: 'w-iconbtn', 'aria-label': 'Previous step', onclick: () => { this.pause(true); this.go(Math.max(0, this.k - 1)); } }, icon('prev'));
    const next = h('button', { type: 'button', class: 'w-iconbtn', 'aria-label': 'Next step', onclick: () => { this.pause(true); this.go(Math.min(this.map.frames.length - 1, this.k + 1)); } }, icon('next'));
    this.range = snapRange({
      label: 'Sampling step', ticks: ['1'], value: 0,
      valueText: (v) => { const fr = this.map.frames[v]; return fr ? `step ${fr.step}` : ''; },
      onInput: (v) => { this.pause(true); this.go(v); },
    });
    const controls = h('div', { class: 'vp-controls' }, prev, this.range.el, next);
    const L = this.d.legend;
    const legend = h('div', { class: 'vp-legend' },
      h('span', null, h('i', { class: 'vp-sw vp-sw--path' }), L.path),
      h('span', null, h('i', { class: 'vp-sw vp-sw--moves' }), L.moves),
      h('span', null, h('b', { class: 'vp-x' }, '×'), L.fail),
      h('span', null, h('u', null, 'L⁴'), 'run changed since the previous step'));
    const body = h('div', { class: 'vp-body' }, left, right);
    this.el.append(this.mapSeg.el, h('div', { class: 'vp-explain-row' }, this.explain, this.jump), body, controls, legend, f.status, f.foot);
    const D = this.d;
    f.foot.innerHTML = D.keyframes_only
      ? `<strong>Data.</strong> Selected maps from ${D.source}: the first and the last of ${D.steps_per_stream} coupled steps; the paper does not show the steps in between, so none are drawn. The drawn path stays fixed in these maps; only the moves change.`
      : `<strong>Data.</strong> Selected maps, decoded at every one of the ${D.steps_per_stream} coupled steps (0 to ${D.steps_per_stream - 1}): ${D.source}. The red line is the drawn path decoded from the image; the dashed line and the red × come from walking the decoded moves on the map. Marked runs changed since the previous step.`;
    watchView(body, (v) => {
      this.inView = v;
      if (v) this.maybeAutoplay();
      else if (this.playing) this.pause(false);
    });
    this.setPlayIcon();
  }

  setMap(i, quiet = false) {
    this.mi = i;
    this.mapSeg.set(String(i));
    const m = this.map;
    this.explain.textContent = m.explain;
    const n = m.frames.length;
    this.range.setTicks(m.frames.map((fr, j) => (n <= 16 || j === 0 || j === n - 1 || fr.step % 4 === 0 ? String(fr.step) : '')));
    const fixIdx = m.fixed_at != null ? m.frames.findIndex((fr) => fr.step === m.fixed_at) : -1;
    [...this.range.el.querySelectorAll('.w-ticks > span')].forEach((t, j) => t.classList.toggle('is-fix', j === fixIdx));
    this.jump.hidden = fixIdx < 0;
    if (fixIdx >= 0) {
      this.jump.textContent = `Go to the correction (step ${m.fixed_at})`;
      this.jump.onclick = () => { this.pause(true); this.go(fixIdx); };
    }
    for (const fr of m.frames) { const im = new Image(); im.src = assetURL(fr.img); }
    this.go(0, quiet);
  }

  go(k, quiet = false) {
    const m = this.map;
    const fr = m.frames[k];
    this.k = k;
    this.range.set(k);
    const src = assetURL(fr.img);
    if (this.img.getAttribute('src') !== src) this.img.src = src;
    this.img.alt = `${m.label} (${m.sub}), decoded image at step ${fr.step}: the drawn path in red.`;
    const lastStep = m.frames[m.frames.length - 1].step;
    this.stepLbl.textContent = fr.step === lastStep ? `step ${fr.step}, final` : `step ${fr.step}`;
    // route of the moves (dashed) and the failure cell, both simulated on the map by the build script
    this.overlay.textContent = '';
    if (m.size) {
      const c = 100 / m.size;
      if (fr.route && fr.route.length > 1) {
        const pts = fr.route.map(([r, cc]) => `${((cc + 0.5) * c).toFixed(2)},${((r + 0.5) * c).toFixed(2)}`).join(' ');
        this.overlay.append(sv('polyline', { class: 'vp-route-casing', points: pts }), sv('polyline', { class: 'vp-route', points: pts }));
      }
      if (fr.fail) {
        const cx = (fr.fail.c + 0.5) * c, cy = (fr.fail.r + 0.5) * c, r = c * 0.3;
        const d = `M${cx - r} ${cy - r}L${cx + r} ${cy + r}M${cx + r} ${cy - r}L${cx - r} ${cy + r}`;
        this.overlay.append(sv('path', { class: 'vp-xmark-casing', d }), sv('path', { class: 'vp-xmark', d }));
      }
    }
    // moves in runs; changed runs marked relative to the previous frame
    const prevFr = k > 0 ? m.frames[k - 1] : null;
    const { changed, notes } = prevFr && prevFr.moves !== fr.moves ? diffRuns(prevFr.moves, fr.moves) : { changed: new Set(), notes: [] };
    this.moves.textContent = '';
    runs(fr.moves).forEach((r, i) => {
      if (i) this.moves.append(' ');
      const t = r.d + sup(r.n);
      this.moves.append(changed.has(i) ? h('u', { class: 'vp-changed' }, t) : t);
    });
    this.moves.dataset.kind = fr.status_kind;
    this.expanded.textContent = `${fr.moves.length} moves: ${fr.moves.split('').join(' ')}`;
    if (!reduceMotion() && changed.size) this.moves.animate([{ opacity: 0.35 }, { opacity: 1 }], { duration: 320, easing: 'ease-out' });
    this.chip.dataset.kind = fr.status_kind;
    this.chip.textContent = '';
    this.chip.append(icon(STATUS_ICON[fr.status_kind] || 'neq'), fr.status);
    this.fix.textContent = '';
    if (notes.length) {
      this.fix.append(h('b', null, `Correction at step ${fr.step}`), h('span', null, notes.join('; ')));
      this.fix.dataset.on = '1';
    } else if (k === 0) {
      this.fix.append(h('span', null, fr.status_kind === 'bad'
        ? `The moves fail at the red ×.${m.fixed_at != null ? ` They are corrected at step ${m.fixed_at}.` : ''}`
        : 'The moves solve the map from the first step; nothing changes in later steps.'));
      this.fix.dataset.on = '';
    } else {
      this.fix.append(h('span', null, `No change since step ${prevFr.step}.`));
      this.fix.dataset.on = '';
    }
    if (!quiet) this.f.status.textContent = `${m.label}, step ${fr.step}: moves ${fmt(fr.moves)}, ${fr.status}. ${notes.join('; ')}`;
  }

  setPlayIcon() {
    this.playBtn.textContent = '';
    this.playBtn.append(icon(this.playing ? 'pause' : 'play'));
    this.playBtn.setAttribute('aria-label', this.playing ? 'Pause' : 'Play the steps');
  }
  maybeAutoplay() { if (!this.inView || this.userPaused || this.playing || reduceMotion()) return; this.play(); }
  togglePlay() {
    if (this.playing) { this.pause(true); return; }
    this.userPaused = false;
    if (this.k === this.map.frames.length - 1) this.go(0);
    this.play();
  }
  play() { this.playing = true; this.setPlayIcon(); this.schedule(); }
  schedule() {
    clearTimeout(this.timer);
    const last = this.map.frames.length - 1;
    const hold = Math.max(350, Math.min(1800, 7000 / this.map.frames.length));
    this.timer = setTimeout(() => {
      if (!this.playing) return;
      if (this.k >= last) { this.pause(false); return; }
      this.go(this.k + 1);
      this.schedule();
    }, this.k === 0 ? 1400 : hold);
  }
  pause(byUser) { clearTimeout(this.timer); this.playing = false; if (byUser) this.userPaused = true; this.setPlayIcon(); }
}
