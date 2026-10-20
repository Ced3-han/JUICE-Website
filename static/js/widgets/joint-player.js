/* JUICE widget: "Joint generation, step by step".
   export function mount(el): el = <div class="widget" data-widget="joint-player" data-src="static/data/joint.json">
   Steps through decoded states of unconditional joint samples: the image estimate, the caption read out at that
   step (words changed since the previous shown step are highlighted) and the position on the square of noise
   levels. Works with any number of decoded steps per sample; only real decoded states are shown. */
import { h, sv, frame, unframe, loadJSON, reduceMotion, segmented, snapRange, watchView, icon, assetURL, square } from './time-square.js';

export async function mount(el) {
  if (!el || el.dataset.mounted) return;
  el.dataset.mounted = 'loading';
  let data;
  try { data = await loadJSON(el); } catch (err) { delete el.dataset.mounted; throw err; }
  try {
    // eslint-disable-next-line no-new
    new JointPlayer(el, data);
    el.dataset.mounted = '1';
  } catch (err) { unframe(el, 'w-joint-player'); throw err; }
}

class JointPlayer {
  constructor(el, data) {
    this.el = el;
    this.d = data;
    this.sid = data.default || data.samples[0].id;
    this.k = 0;
    this.playing = false;
    this.userPaused = false;
    this.inView = false;
    this.timer = 0;
    this.build();
    this.setSample(this.sid, true);
  }

  get s() { return this.d.samples.find((x) => x.id === this.sid) || this.d.samples[0]; }

  build() {
    const f = frame(this.el, { cls: 'w-joint-player', title: 'Joint generation, step by step' });
    this.f = f;
    this.playBtn = h('button', { type: 'button', class: 'w-iconbtn w-iconbtn--play', onclick: () => this.togglePlay() });
    f.ctrls.append(this.playBtn);

    this.pick = segmented({
      label: 'Sample',
      items: this.d.samples.map((s) => ({ id: s.id, label: `${s.variant_label} #${s.sample}` })),
      value: this.sid,
      cls: 'w-seg--keep jp-pick',
      onChange: (id) => { this.pause(true); this.setSample(id); },
    });
    // thumbnails of the final images inside the buttons
    this.pick.btns.forEach((b, i) => {
      const s = this.d.samples[i];
      const last = s.steps[s.steps.length - 1];
      b.prepend(h('img', { src: assetURL(last.img), width: 40, height: 40, alt: '', loading: 'lazy', decoding: 'async' }));
    });

    // image card
    this.imgPill = h('span', { class: 'jp-pill jp-pill--img' });
    this.imA = h('img', { width: 224, height: 224, alt: '', decoding: 'async' });
    this.imB = h('img', { width: 224, height: 224, alt: '', decoding: 'async', class: 'is-hidden' });
    this.front = this.imA;
    this.imgNote = h('p', { class: 'jp-note' });
    const imgCard = h('figure', { class: 'jp-card jp-card--img' },
      h('figcaption', { class: 'jp-head' }, h('span', null, 'Image'), this.imgPill),
      h('div', { class: 'jp-plate' }, this.imA, this.imB), this.imgNote);

    // text card
    this.txtPill = h('span', { class: 'jp-pill jp-pill--txt' });
    this.cap = h('p', { class: 'jp-caption' });
    this.capNote = h('p', { class: 'jp-note' });
    const txtCard = h('div', { class: 'jp-card jp-card--txt' },
      h('div', { class: 'jp-head' }, h('span', null, 'Text'), this.txtPill), this.cap, this.capNote);

    // square
    this.sq = square({ side: 220, m: { l: 50, r: 18, t: 22, b: 48 }, label: 'Square of noise levels with the joint sampling path' });
    this.curve = sv('polyline', { class: 'p-joint', 'stroke-width': 4 });
    this.sq.layers.paths.append(this.curve);
    this.dot = sv('g', { class: 'sq-dotg dot-joint', 'aria-hidden': 'true' },
      sv('circle', { class: 'sq-halo f-joint', r: 11, opacity: 0.25 }), sv('circle', { class: 'sq-dot f-joint', r: 6.5 }));
    this.sq.layers.dot.append(this.dot);
    const sqBox = h('div', { class: 'jp-square' }, this.sq.svg,
      h('p', { class: 'jp-note' }, 'Where this step sits on the square: the text clock runs ahead of the image clock.'));

    const prev = h('button', { type: 'button', class: 'w-iconbtn', 'aria-label': 'Previous step', onclick: () => { this.pause(true); this.go(Math.max(0, this.k - 1)); } }, icon('prev'));
    const next = h('button', { type: 'button', class: 'w-iconbtn', 'aria-label': 'Next step', onclick: () => { this.pause(true); this.go(Math.min(this.s.steps.length - 1, this.k + 1)); } }, icon('next'));
    this.range = snapRange({
      label: 'Sampling step', ticks: ['0'], value: 0,
      valueText: (v) => { const st = this.s.steps[v]; return st ? `step ${st.step} of ${this.d.total_steps}` : ''; },
      onInput: (v) => { this.pause(true); this.go(v); },
    });
    const controls = h('div', { class: 'jp-controls' }, prev, this.range.el, next);

    const body = h('div', { class: 'jp-body' }, imgCard, txtCard, sqBox);
    this.note = h('p', { class: 'jp-sample-note' });
    this.el.append(this.pick.el, this.note, body, controls, f.status, f.foot);
    const D = this.d;
    f.foot.innerHTML = D.every_step
      ? `<strong>Data.</strong> The four selected unconditional samples of the paper's trajectory figure, decoded at every step: ${D.source}. ${D.total_steps} steps, no guidance, 224×224. Each step shows the clean estimate at the start of that step, and step ${D.total_steps} the final sample; step 0 is the estimate from pure noise. Caption: ${D.decoder}. Highlighted words changed since the previous step.`
      : `<strong>Data.</strong> Real decoded states of selected unconditional samples (${D.source}), ${D.total_steps} sampling steps, no guidance, 224×224. The caption at each step is read with the ${D.decoder}; highlighted words changed since the previous step shown. Nothing is interpolated between the steps shown.`;

    watchView(body, (v) => {
      this.inView = v;
      if (v) this.maybeAutoplay();
      else if (this.playing) this.pause(false);
    });
    this.setPlayIcon();
  }

  hold() { return Math.max(180, Math.min(1500, 9000 / this.s.steps.length)); }

  setSample(id, quiet = false) {
    this.sid = id;
    this.pick.set(id);
    const s = this.s;
    this.note.textContent = s.note || '';
    this.note.hidden = !s.note;
    this.curve.setAttribute('points', this.sq.curve(s.alpha));
    // marks at the decoded steps
    const { X, Y, layers } = this.sq;
    layers.marks.textContent = '';
    this.marks = s.steps.map((st) => {
      const c = sv('circle', { class: 'sq-snap', cx: X(st.t_image), cy: Y(st.t_text), r: s.steps.length > 16 ? 2.4 : 4 });
      layers.marks.append(c);
      return c;
    });
    const n = s.steps.length;
    this.range.setTicks(s.steps.map((st, i) => (n <= 16 || i === 0 || i === n - 1 || st.step % 8 === 0 ? String(st.step) : '')));
    for (const st of s.steps) { const im = new Image(); im.src = assetURL(st.img); }
    this.go(Math.min(this.k, n - 1), quiet);
  }

  go(k, quiet = false) {
    const s = this.s;
    const st = s.steps[k];
    const prevStep = this.k;
    this.k = k;
    this.range.set(k);
    const final = k === s.steps.length - 1;
    const { X, Y } = this.sq;
    this.dot.setAttribute('transform', `translate(${X(st.t_image).toFixed(2)},${Y(st.t_text).toFixed(2)})`);
    this.marks.forEach((c, i) => c.classList.toggle('is-on', i <= k));
    this.imgPill.textContent = `t = ${st.t_image.toFixed(2)}`;
    this.txtPill.textContent = `t = ${st.t_text.toFixed(2)}`;
    this.imgNote.textContent = final ? `Final image, step ${st.step} of ${this.d.total_steps}` : `Current estimate at step ${st.step} of ${this.d.total_steps}`;
    // image crossfade
    const src = assetURL(st.img);
    const srcset = st.img2x ? `${src} 1x, ${assetURL(st.img2x)} 2x` : '';
    const alt = `${s.variant_label} sample ${s.sample}, decoded image at step ${st.step} of ${this.d.total_steps}`;
    const front = this.front, back = front === this.imA ? this.imB : this.imA;
    if (!front.getAttribute('src')) { if (srcset) front.srcset = srcset; front.src = src; front.alt = alt; }
    else if (front.getAttribute('src') !== src) {
      if (srcset) back.srcset = srcset; back.src = src; back.alt = alt;
      const swap = () => { back.classList.remove('is-hidden'); front.classList.add('is-hidden'); this.front = back; };
      if (back.decode && !reduceMotion()) back.decode().then(swap, swap); else swap();
    }
    // caption, changed words highlighted when moving forward by one shown step
    const fwd = k === prevStep + 1;
    const ch = new Set(fwd ? st.changed || [] : []);
    this.cap.textContent = '';
    st.caption.split(' ').forEach((w, i) => { if (i) this.cap.append(' '); this.cap.append(ch.has(i) ? h('span', { class: 'w-new' }, w) : w); });
    const nCh = (st.changed || []).length;
    this.capNote.textContent = k === 0 ? 'First decoded step shown.' : nCh ? `${nCh} word${nCh > 1 ? 's' : ''} changed since step ${s.steps[k - 1].step}.` : `No change since step ${s.steps[k - 1].step}.`;
    if (!quiet) this.f.status.textContent = `${s.variant_label} sample ${s.sample}, step ${st.step} of ${this.d.total_steps}: image time ${st.t_image.toFixed(2)}, text time ${st.t_text.toFixed(2)}. ${this.capNote.textContent}`;
  }

  /* playback */
  setPlayIcon() {
    this.playBtn.textContent = '';
    this.playBtn.append(icon(this.playing ? 'pause' : 'play'));
    this.playBtn.setAttribute('aria-label', this.playing ? 'Pause' : 'Play the steps');
  }
  maybeAutoplay() { if (!this.inView || this.userPaused || this.playing || reduceMotion()) return; this.play(); }
  togglePlay() {
    if (this.playing) { this.pause(true); return; }
    this.userPaused = false;
    if (this.k === this.s.steps.length - 1) this.go(0);
    this.play();
  }
  play() { this.playing = true; this.setPlayIcon(); this.schedule(); }
  schedule() {
    clearTimeout(this.timer);
    const last = this.s.steps.length - 1;
    this.timer = setTimeout(() => {
      if (!this.playing) return;
      if (this.k >= last) { this.pause(false); return; }
      this.go(this.k + 1);
      this.schedule();
    }, this.k === 0 ? 900 : this.hold());
  }
  pause(byUser) { clearTimeout(this.timer); this.playing = false; if (byUser) this.userPaused = true; this.setPlayIcon(); }
}
