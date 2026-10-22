/* JUICE project page behaviour. Plain ES2017, no dependencies.
   theme · link buttons · sticky bar + scrollspy + progress · tooltips · count-up ·
   tabs · lightbox · BibTeX copy · promo video · lazy widget loader.
   Every feature degrades to the static HTML when it cannot run. */
(function () {
  'use strict';

  var doc = document;
  var root = doc.documentElement;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasIO = 'IntersectionObserver' in window;

  function $(sel, ctx) { return (ctx || doc).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel)); }
  function safe(name, fn) {
    try { fn(); } catch (err) { if (window.console) console.warn('[juice] ' + name + ' failed', err); }
  }

  /* ------------------------------------------------------------ theme */
  function systemDark() {
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }
  function currentTheme() {
    var t = root.getAttribute('data-theme');
    return t === 'dark' || t === 'light' ? t : (systemDark() ? 'dark' : 'light');
  }
  function labelToggles() {
    var next = currentTheme() === 'dark' ? 'light' : 'dark';
    $$('.theme-toggle').forEach(function (b) { b.setAttribute('aria-label', 'Switch to ' + next + ' theme'); });
  }
  function setTheme(t) {
    root.setAttribute('data-theme', t);
    try { localStorage.setItem('juice-theme', t); } catch (e) { /* private mode */ }
    labelToggles();
    doc.dispatchEvent(new CustomEvent('juice:themechange', { detail: { theme: t } }));
  }
  function initTheme() {
    labelToggles();
    $$('.theme-toggle').forEach(function (b) {
      b.addEventListener('click', function () { setTheme(currentTheme() === 'dark' ? 'light' : 'dark'); });
    });
    if (window.matchMedia) {
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      var onChange = function () {
        if (!root.hasAttribute('data-theme')) {
          labelToggles();
          doc.dispatchEvent(new CustomEvent('juice:themechange', { detail: { theme: currentTheme() } }));
        }
      };
      if (mq.addEventListener) mq.addEventListener('change', onChange);
    }
  }

  /* ------------------------------------------------------------ link buttons from JUICE_LINKS */
  function initLinks() {
    var links = window.JUICE_LINKS || {};
    $$('[data-link]').forEach(function (a) {
      var url = links[a.getAttribute('data-link')];
      if (typeof url === 'string' && url.trim()) {
        a.href = url.trim();
        a.classList.remove('btn--soon');
        a.removeAttribute('aria-disabled');
        a.removeAttribute('role');
        a.removeAttribute('title');
        a.hidden = false;
        if (/^https?:\/\//i.test(url) || /\.pdf$/i.test(url)) { a.target = '_blank'; a.rel = 'noopener'; }
      } else if (a.hasAttribute('data-optional')) {
        a.hidden = true;
      } else {
        a.removeAttribute('href');
        a.classList.add('btn--soon');
        a.setAttribute('aria-disabled', 'true');
        a.setAttribute('role', 'link');
        a.title = 'Coming soon';
      }
    });
  }

  /* ------------------------------------------------------------ sticky bar, scrollspy, progress */
  function initBar() {
    var bar = $('#bar');
    var tldr = $('#tldr');
    if (!bar) return;

    // Checked from geometry on every scroll frame. An IntersectionObserver on the TL;DR misses a
    // jump from below it to the top of the page (Home key, reduced motion): on a phone the TL;DR
    // starts below the fold, so its intersection state never changes and the bar stayed up.
    var setVisible = function () {
      bar.classList.toggle('is-visible', tldr ? tldr.getBoundingClientRect().bottom < 0 : window.scrollY > 600);
    };

    // bar visibility + reading progress, one rAF per frame at most
    var ticking = false;
    var update = function () {
      ticking = false;
      setVisible();
      var max = doc.documentElement.scrollHeight - window.innerHeight;
      var p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      bar.style.setProperty('--progress', p.toFixed(4));
    };
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; window.requestAnimationFrame(update); }
    }, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    update();

    // scrollspy
    var linkFor = {};
    var targets = [];
    $$('.bar__links a[data-spy]').forEach(function (a) {
      var el = doc.getElementById(a.getAttribute('data-spy'));
      if (el) { linkFor[el.id] = a; targets.push(el); }
    });
    if (!hasIO || !targets.length) return;
    var strip = $('.bar__links');
    var active = null;
    var activate = function (id) {
      if (active === id) return;
      active = id;
      Object.keys(linkFor).forEach(function (k) {
        var on = k === id;
        linkFor[k].classList.toggle('is-active', on);
        if (on) linkFor[k].setAttribute('aria-current', 'location');
        else linkFor[k].removeAttribute('aria-current');
      });
      var a = id && linkFor[id];
      if (a && strip && strip.scrollWidth > strip.clientWidth + 2) {
        var left = a.offsetLeft - (strip.clientWidth - a.offsetWidth) / 2;
        strip.scrollTo({ left: Math.max(0, left), behavior: reduceMotion ? 'auto' : 'smooth' });
      }
    };
    var visible = {};
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { visible[e.target.id] = e.isIntersecting; });
      var hit = null;
      for (var i = 0; i < targets.length; i++) { if (visible[targets[i].id]) { hit = targets[i].id; break; } }
      if (hit) activate(hit);
      else if (targets[0].getBoundingClientRect().top > window.innerHeight * 0.5) activate(null);
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
    targets.forEach(function (t) { spy.observe(t); });
  }

  /* ------------------------------------------------------------ keyword tooltips */
  function initTooltips() {
    var kws = $$('.kw');
    if (!kws.length) return;
    var openedByTap = false;

    function place(kw) {
      var tip = $('.tip', kw);
      tip.style.setProperty('--dx', '0px');
      tip.classList.remove('tip--below');
      var r = tip.getBoundingClientRect();
      var m = 12;
      var vw = doc.documentElement.clientWidth;
      var dx = 0;
      if (r.left < m) dx = m - r.left;
      else if (r.right > vw - m) dx = vw - m - r.right;
      tip.style.setProperty('--dx', Math.round(dx) + 'px');
      var barH = 64;
      if (r.top < barH) tip.classList.add('tip--below');
    }
    function close(kw) {
      kw.classList.remove('is-open');
      $('.kw__btn', kw).setAttribute('aria-expanded', 'false');
    }
    function closeAll(except) { kws.forEach(function (k) { if (k !== except) close(k); }); }
    function open(kw) {
      closeAll(kw);
      kw.classList.add('is-open');
      $('.kw__btn', kw).setAttribute('aria-expanded', 'true');
      place(kw);
    }

    kws.forEach(function (kw) {
      var btn = $('.kw__btn', kw);
      var timer = null;
      btn.setAttribute('aria-expanded', 'false');
      kw.addEventListener('mouseenter', function (e) {
        if (e.pointerType === 'touch') return;
        clearTimeout(timer); openedByTap = false; open(kw);
      });
      kw.addEventListener('mouseleave', function () {
        if (openedByTap) return;
        timer = setTimeout(function () { close(kw); }, 120);
      });
      btn.addEventListener('focus', function () { open(kw); });
      btn.addEventListener('blur', function () { if (!openedByTap) close(kw); });
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (kw.classList.contains('is-open') && openedByTap) { close(kw); openedByTap = false; }
        else { openedByTap = true; open(kw); }
      });
    });
    doc.addEventListener('click', function (e) {
      if (!e.target.closest || !e.target.closest('.kw')) { closeAll(); openedByTap = false; }
    });
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeAll(); });
    // a tapped tooltip closes once the reader scrolls on, not on the last pixels of a momentum scroll
    var openedAtY = 0;
    kws.forEach(function (kw) { $('.kw__btn', kw).addEventListener('click', function () { openedAtY = window.scrollY; }); });
    window.addEventListener('scroll', function () {
      if (openedByTap && Math.abs(window.scrollY - openedAtY) > 48) { closeAll(); openedByTap = false; }
    }, { passive: true });
    window.addEventListener('resize', function () { closeAll(); }, { passive: true });
  }

  /* ------------------------------------------------------------ metric count-up */
  function initCountUp() {
    var nums = $$('[data-count]');
    if (!nums.length || reduceMotion || !hasIO) return;
    var fmt = function (el, v) {
      var d = parseInt(el.getAttribute('data-decimals') || '0', 10);
      el.textContent = v.toFixed(d) + (el.getAttribute('data-suffix') || '');
    };
    var run = function (el) {
      var target = parseFloat(el.getAttribute('data-count'));
      if (!isFinite(target)) return;
      var t0 = null;
      var dur = 600;
      var step = function (now) {
        if (t0 === null) t0 = now;
        var k = Math.min(1, (now - t0) / dur);
        var eased = 1 - Math.pow(1 - k, 3);
        fmt(el, target * eased);
        if (k < 1) window.requestAnimationFrame(step); else fmt(el, target);
      };
      window.requestAnimationFrame(step);
    };
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { io.unobserve(e.target); run(e.target); }
      });
    }, { threshold: 0.6 });
    nums.forEach(function (n) { io.observe(n); });
  }

  /* ------------------------------------------------------------ ARIA tabs (gallery pills) */
  function initTabs() {
    $$('[role="tablist"]').forEach(function (list) {
      var tabs = $$('[role="tab"]', list).filter(function (t) { return t.parentNode === list; });
      if (!tabs.length) return;
      var panelOf = function (t) { return doc.getElementById(t.getAttribute('aria-controls')); };
      var warm = function (t) {
        var p = panelOf(t);
        if (p) $$('img[loading="lazy"]', p).forEach(function (img) { img.loading = 'eager'; });
      };
      var select = function (tab, focus) {
        tabs.forEach(function (t) {
          var on = t === tab;
          t.setAttribute('aria-selected', on ? 'true' : 'false');
          t.tabIndex = on ? 0 : -1;
          var p = panelOf(t);
          if (p) {
            p.hidden = !on;
            if (on && !reduceMotion) {
              p.classList.remove('is-entering');
              void p.offsetWidth;
              p.classList.add('is-entering');
            }
          }
        });
        if (focus) tab.focus();
      };
      tabs.forEach(function (t, i) {
        t.addEventListener('click', function () { select(t, false); });
        t.addEventListener('pointerenter', function () { warm(t); });
        t.addEventListener('focus', function () { warm(t); });
        t.addEventListener('keydown', function (e) {
          var j = null;
          if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % tabs.length;
          else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = (i - 1 + tabs.length) % tabs.length;
          else if (e.key === 'Home') j = 0;
          else if (e.key === 'End') j = tabs.length - 1;
          if (j !== null) { e.preventDefault(); select(tabs[j], true); }
        });
      });
      var initial = tabs.filter(function (t) { return t.getAttribute('aria-selected') === 'true'; })[0] || tabs[0];
      select(initial, false);
      $$('.is-entering', list.parentNode).forEach(function (p) { p.classList.remove('is-entering'); });
    });
  }

  /* ------------------------------------------------------------ lightbox */
  function initLightbox() {
    var box = $('#lightbox');
    if (!box || typeof box.showModal !== 'function') return;
    var img = $('.lightbox__img', box);
    var cap = $('.lightbox__cap', box);
    var group = [];
    var index = 0;

    var captionFor = function (el) {
      var fig = el.closest('figure, .card');
      var fc = fig && $('figcaption', fig);
      if (el.hasAttribute('data-caption')) return el.getAttribute('data-caption');
      if (fc && fc.textContent.trim()) return fc.textContent.trim();
      return el.alt || '';
    };
    var show = function (i) {
      index = (i + group.length) % group.length;
      var el = group[index];
      img.removeAttribute('src');
      img.classList.toggle('is-sample', el.hasAttribute('data-sample'));
      img.src = el.getAttribute('data-zoom') || el.currentSrc || el.src;
      img.alt = el.alt || '';
      cap.textContent = captionFor(el);
      box.classList.toggle('is-single', group.length < 2);
    };
    var open = function (el) {
      var scope = el.closest('[role="tabpanel"]') || el.closest('section') || doc.body;
      group = $$('[data-zoom]', scope).filter(function (x) { return x.offsetParent !== null; });
      if (!group.length) group = [el];
      show(Math.max(0, group.indexOf(el)));
      box.showModal();
      $('.lightbox__close', box).focus();
    };

    doc.addEventListener('click', function (e) {
      var el = e.target.closest && e.target.closest('[data-zoom]');
      if (el && !box.contains(el)) { e.preventDefault(); open(el); }
    });
    // figures (not every gallery thumbnail) get a keyboard stop
    $$('.plate img[data-zoom]').forEach(function (el) {
      el.tabIndex = 0;
      el.setAttribute('role', 'button');
      el.setAttribute('aria-label', 'Enlarge: ' + (el.alt || 'figure'));
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(el); }
      });
    });
    $('.lightbox__close', box).addEventListener('click', function () { box.close(); });
    $('.lightbox__prev', box).addEventListener('click', function (e) { e.stopPropagation(); show(index - 1); });
    $('.lightbox__next', box).addEventListener('click', function (e) { e.stopPropagation(); show(index + 1); });
    box.addEventListener('click', function (e) {
      if (e.target === box || e.target.classList.contains('lightbox__fig')) box.close();
    });
    box.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); show(index + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); show(index - 1); }
    });
    box.addEventListener('close', function () { img.removeAttribute('src'); });
  }

  /* ------------------------------------------------------------ BibTeX copy */
  function initCopy() {
    var status = $('#copy-status');
    $$('[data-copy]').forEach(function (btn) {
      var label = $('.copy__label', btn) || btn;
      btn.addEventListener('click', function () {
        var src = $(btn.getAttribute('data-copy'));
        if (!src) return;
        var text = src.innerText.replace(/\s+$/, '') + '\n';
        var done = function (ok) {
          label.textContent = ok ? 'Copied' : 'Press ⌘C';
          btn.classList.toggle('is-done', ok);
          if (status) status.textContent = ok ? 'BibTeX copied to clipboard.' : 'Copy failed; select the text manually.';
          setTimeout(function () { label.textContent = 'Copy'; btn.classList.remove('is-done'); }, 1800);
        };
        var fallback = function () {
          var ta = doc.createElement('textarea');
          ta.value = text;
          ta.setAttribute('readonly', '');
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          doc.body.appendChild(ta);
          ta.select();
          var ok = false;
          try { ok = doc.execCommand('copy'); } catch (e) { ok = false; }
          doc.body.removeChild(ta);
          done(ok);
        };
        if (navigator.clipboard && window.isSecureContext) {
          navigator.clipboard.writeText(text).then(function () { done(true); }, fallback);
        } else {
          fallback();
        }
      });
    });
  }

  /* ------------------------------------------------------------ promo video */
  function initVideo() {
    var fig = $('.promo');
    var v = fig && $('video', fig);
    if (!v) return;
    // No video files yet: hide the block and the hero "Video" button that points at it.
    var markMissing = function () {
      fig.classList.add('is-missing');
      $$('a[href="#video"]').forEach(function (a) { a.hidden = true; });
    };
    if (fig.classList.contains('is-missing')) markMissing();
    var sources = $$('source', v);
    if (sources.length) sources[sources.length - 1].addEventListener('error', markMissing);
    v.addEventListener('error', markMissing);
    if (v.networkState === 3 /* NETWORK_NO_SOURCE */) markMissing();
    if (v.error) markMissing();

    // Scroll-autoplay only for a muted video; the narrated cut plays when the viewer presses play.
    if (reduceMotion || !hasIO || !v.muted) { v.removeAttribute('autoplay'); return; }
    var userPaused = false;
    var auto = false;
    v.addEventListener('pause', function () { if (!auto && !v.ended) userPaused = true; });
    v.addEventListener('play', function () { if (!auto) userPaused = false; });
    new IntersectionObserver(function (entries) {
      var e = entries[0];
      if (fig.classList.contains('is-missing')) return;
      if (e.isIntersecting && e.intersectionRatio >= 0.5) {
        if (!userPaused && v.paused) {
          auto = true;
          var p = v.play();
          var reset = function () { auto = false; };
          if (p && p.then) p.then(reset, reset); else reset();
        }
      } else if (!v.paused) {
        auto = true;
        v.pause();
        auto = false;
      }
    }, { threshold: [0, 0.5] }).observe(v);
  }

  /* ------------------------------------------------------------ animated study charts */
  // Figures 3-5 are redrawn by study_charts.js (shared with the video) and animate once when their plate is in view.
  // The paper's image stays in the plate as the no-JS fallback; clicking the chart enlarges that image.
  function initAnimFigs() {
    var plates = $$('.plate[data-anim]');
    if (!plates.length) return;
    import('./study_charts.js').then(function (m) {
      plates.forEach(function (plate) {
        var img = $('img', plate), kind = plate.getAttribute('data-anim');
        var host = doc.createElement('div');
        host.className = 'anim-fig';
        host.setAttribute('data-zoom', img.getAttribute('data-zoom'));
        host.tabIndex = 0;
        host.setAttribute('role', 'button');
        host.setAttribute('aria-label', 'Enlarge: ' + (img.alt || 'figure'));
        host.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); host.click(); }
        });
        plate.insertBefore(host, img);
        var chart = kind === 'encoders' ? m.encoderChart(host) : m.trainingChart(host, kind);
        chart.svg.setAttribute('aria-label', img.alt);
        img.style.display = 'none';
        if (reduceMotion || !hasIO) return;   // the final frame only
        var dur = kind === 'encoders' ? 2200 : 3000, raf = 0;
        var btn = doc.createElement('button');
        btn.type = 'button';
        btn.className = 'anim-replay';
        btn.textContent = 'Replay';
        plate.appendChild(btn);
        var play = function () {
          cancelAnimationFrame(raf);
          btn.classList.remove('is-ready');
          var t0 = performance.now();
          var tick = function (now) {
            var p = Math.min(1, (now - t0) / dur);
            chart.set(p);
            if (p < 1) raf = requestAnimationFrame(tick); else btn.classList.add('is-ready');
          };
          chart.set(0);
          raf = requestAnimationFrame(tick);
        };
        btn.addEventListener('click', play);
        chart.set(0);
        var io = new IntersectionObserver(function (entries) {
          if (entries[0].isIntersecting) { io.disconnect(); play(); }
        }, { threshold: 0.6 });
        io.observe(plate);
      });
    }).catch(function (err) {
      if (window.console) console.warn('[juice] animated figures unavailable; keeping the images.', err);
    });
  }

  /* ------------------------------------------------------------ lazy widget loader */
  function loadWidget(el) {
    var name = el.getAttribute('data-widget') || '';
    if (!/^[a-z0-9-]+$/.test(name)) return;
    var saved = Array.prototype.slice.call(el.childNodes);
    // [data-persist] fallback content stays on the page (after the widget) once the widget mounts
    var keep = el.querySelector('[data-persist]');
    el.classList.add('is-loading');
    el.setAttribute('aria-busy', 'true');
    var finish = function () {
      el.classList.remove('is-loading');
      el.removeAttribute('aria-busy');
      reaim(el);
    };
    var fail = function (err) {
      if (window.console) console.warn('[juice] widget "' + name + '" unavailable; keeping the static fallback.', err);
      if (keep && keep.parentNode && keep.parentNode !== el) keep.parentNode.removeChild(keep);
      el.replaceChildren.apply(el, saved);
      el.classList.add('is-fallback');
      finish();
    };
    try {
      import('./widgets/' + name + '.js').then(function (m) {
        if (!m || typeof m.mount !== 'function') throw new Error('module has no mount(el)');
        if (keep) el.parentNode.insertBefore(keep, el.nextSibling);
        return m.mount(el);
      }).then(function () {
        el.classList.add('is-mounted');
        finish();
      }).catch(fail);
    } catch (err) {
      fail(err);
    }
  }
  // A widget is taller than its fallback, so one that mounts during an in-page jump pushes the target down
  // and the jump stops short. Re-aim at the target once such a widget is in; any input from the reader cancels.
  var jump = null;
  function initJumps() {
    doc.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href^="#"]');
      var t = a && a.getAttribute('href').length > 1 && doc.getElementById(a.getAttribute('href').slice(1));
      jump = t ? { el: t, until: Date.now() + 4000 } : null;
    });
    ['wheel', 'touchstart', 'keydown'].forEach(function (ev) {
      window.addEventListener(ev, function () { jump = null; }, { passive: true });
    });
  }
  function reaim(widget) {
    if (!jump || Date.now() > jump.until) { jump = null; return; }
    if (widget.compareDocumentPosition(jump.el) & Node.DOCUMENT_POSITION_FOLLOWING) jump.el.scrollIntoView({ block: 'start' });
  }
  function initWidgets() {
    var els = $$('.widget[data-widget]');
    if (!els.length) return;
    if (!hasIO) { els.forEach(loadWidget); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { io.unobserve(e.target); loadWidget(e.target); }
      });
    }, { rootMargin: '400px 0px' });
    els.forEach(function (el) { io.observe(el); });
  }

  /* ------------------------------------------------------------ boot */
  function boot() {
    safe('theme', initTheme);
    safe('links', initLinks);
    safe('bar', initBar);
    safe('tooltips', initTooltips);
    safe('count-up', initCountUp);
    safe('tabs', initTabs);
    safe('lightbox', initLightbox);
    safe('copy', initCopy);
    safe('video', initVideo);
    safe('jumps', initJumps);
    safe('widgets', initWidgets);
    safe('anim-figs', initAnimFigs);
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
