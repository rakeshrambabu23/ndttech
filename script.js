/* NDT Tech - script.js */
(function () {
  'use strict';

  const $ = (s, c) => (c || document).querySelector(s);
  const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));

  /* ---------- Scroll-driven cinematic hero ----------
     The video is never "played". Its currentTime follows the scroll position,
     and each scene's text is faded in/out from the same scroll progress. */
  const sv = $('#home'), stage = $('.sv__stage'), video = $('#heroVideo');
  const scenes = $$('.sv__scene'), dots = $$('#svDots button'), fbs = $$('.fb');
  const hudN = $('#svNum'), hudL = $('#svLabel'), pbar = $('#svBar'), hint = $('#svHint');

  // Scroll progress (0..1) where each scene starts. Last value = end.
  const B = [0, .134, .272, .414, .548, .671, .782, 1];  // = shot cuts at 1.46s, 2.96s, 4.5s, 5.96s, 7.29s, 8.5s of the 10s video
  // Video reaches its last frame at this progress; the remainder holds the final "team still".
  const VEND = .92;
  const LABELS = ['Aerial survey','Ultrasonic testing','Radiographic testing','Magnetic particle','Phased array & TOFD','Rope access','Our people'];
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const sm = t => { t = clamp(t); return t * t * (3 - 2 * t); };

  let rawP = 0, cur = 0, running = false, fb = false, lastScene = -1;

  const pinTop = () => parseFloat(getComputedStyle(stage).top) || 0;
  const range = () => Math.max(1, sv.offsetHeight - stage.offsetHeight);
  const readP = () => clamp((pinTop() - sv.getBoundingClientRect().top) / range());

  function render(p) {
    const last = scenes.length - 1;

    scenes.forEach((el, i) => {
      const l = clamp((p - B[i]) / (B[i + 1] - B[i]));
      const enter = i === 0 ? 1 : sm(l / .2);
      const exit = i === last ? 1 : 1 - sm((l - .8) / .2);
      const o = enter * exit;
      el.style.visibility = o > .01 ? 'visible' : 'hidden';
      el.classList.toggle('live', o > .6);
      $$('.ln', el).forEach((n, j) => {
        const e = i === 0 ? 1 : sm((l - j * .045) / .2);
        const x = exit;
        n.style.opacity = (e * x).toFixed(3);
        n.style.transform = 'translate3d(0,' + ((1 - e) * 42 - (1 - x) * 30).toFixed(1) + 'px,0)';
      });
    });

    // slow push-in and letterbox bars opening for the final reveal
    stage.style.setProperty('--zoom', (1 + p * .08).toFixed(4));
    const lb = p < .8 ? 1 : 1 - sm((p - .8) / .15);
    stage.style.setProperty('--lb', lb.toFixed(3));
    pbar.style.transform = 'scaleX(' + p.toFixed(4) + ')';
    hint.style.opacity = (1 - clamp(p / .035)).toFixed(2);

    // HUD + dots
    let idx = 0;
    for (let i = 0; i < B.length - 1; i++) if (p >= B[i]) idx = i;
    if (idx !== lastScene) {
      lastScene = idx;
      hudN.textContent = '0' + (idx + 1) + ' / 07';
      hudL.textContent = LABELS[idx];
      dots.forEach((d, k) => d.classList.toggle('on', k === idx));
    }

    // preview layers (no video file)
    if (fb) {
      fbs.forEach((f, i) => {
        const c = (B[i] + B[i + 1]) / 2;
        const d = Math.abs(p - c);
        f.style.opacity = clamp(1 - (d - .07) / .06).toFixed(3);
        f.style.transform = 'scale(' + (1.02 + (p - c) * .35).toFixed(3) + ')';
      });
    }
  }

  // eased video scrubbing
  function tick() {
    const dur = video.duration;
    if (!fb && dur && isFinite(dur)) {
      const want = clamp(rawP / VEND) * dur;
      cur += (want - cur) * (REDUCED ? 1 : .14);
      if (Math.abs(want - cur) < .005) cur = want;
      if (Math.abs(video.currentTime - cur) > .03) video.currentTime = cur;
      running = Math.abs(want - cur) > .005;
    } else running = false;
    if (running) requestAnimationFrame(tick);
  }

  function onScroll() {
    rawP = readP();
    render(rawP);
    if (!running) { running = true; requestAnimationFrame(tick); }
  }

  function goFallback() {
    if (fb) return;
    fb = true;
    sv.classList.add('fb-on');
    render(rawP);
  }

  video.pause();
  video.addEventListener('loadeddata', () => { if (!fb) { video.classList.add('ready'); video.pause(); onScroll(); } });
  video.addEventListener('error', goFallback, true);
  video.querySelectorAll('source').forEach(s => s.addEventListener('error', () => { if (s === video.lastElementChild) goFallback(); }));

  // iOS Safari only allows seeking after one user-gesture play/pause
  addEventListener('touchstart', () => { video.play().then(() => video.pause()).catch(() => {}); }, { once: true, passive: true });

  dots.forEach((d, i) => d.addEventListener('click', () => {
    const y = sv.offsetTop - pinTop() + (B[i] + .012) * range();
    scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
  }));

  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  onScroll();

  /* ---------- Header / mobile nav ---------- */
  const header = $('#header');
  window.addEventListener('scroll', () => header.classList.toggle('scrolled', scrollY > 20), { passive: true });
  const nav = $('#nav'), burger = $('#burger');
  burger.addEventListener('click', () => nav.classList.toggle('open'));
  $$('#nav a').forEach(a => a.addEventListener('click', () => nav.classList.remove('open')));

  // Active link on scroll
  const links = $$('#nav a');
  const secs = links.map(a => $(a.getAttribute('href')));
  secs.forEach((s, i) => {
    if (!s) return;
    new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) links.forEach(l => l.classList.toggle('active', l === links[i]));
    }), { rootMargin: '-45% 0px -50% 0px' }).observe(s);
  });

  /* ---------- Reveal on scroll + counters + bars ---------- */
  function countUp(el) {
    const end = +el.dataset.count, suf = el.dataset.suffix || '', dur = 1600, t0 = performance.now();
    (function f(n) {
      const p = Math.min(1, (n - t0) / dur), v = Math.floor(end * (1 - Math.pow(1 - p, 3)));
      el.textContent = v.toLocaleString() + suf;
      if (p < 1) requestAnimationFrame(f);
    })(t0);
  }
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add('in');
    $$('[data-count]', e.target).forEach(countUp);
    if (e.target.matches('[data-count]')) countUp(e.target);
    io.unobserve(e.target);
  }), { threshold: 0.18 });
  $$('.reveal, .bar, .badge-exp').forEach(el => io.observe(el));

  /* ---------- Services slider ---------- */
  const sl = $('#svSlider');
  const step = () => (sl.firstElementChild.getBoundingClientRect().width + 24);
  $('#svNext').addEventListener('click', () => sl.scrollBy({ left: step(), behavior: 'smooth' }));
  $('#svPrev').addEventListener('click', () => sl.scrollBy({ left: -step(), behavior: 'smooth' }));

  /* ---------- Testimonials ---------- */
  const qs = $$('#testi blockquote'), tDots = $$('#testiDots button');
  let qi = 0, qt;
  function showQ(i) {
    qi = i; qs.forEach((q, k) => q.classList.toggle('on', k === i)); tDots.forEach((d, k) => d.classList.toggle('on', k === i));
  }
  tDots.forEach((d, k) => d.addEventListener('click', () => { showQ(k); reset(); }));
  function reset() { clearInterval(qt); qt = setInterval(() => showQ((qi + 1) % qs.length), 6000); }
  reset();

  /* ---------- Contact form (front-end validation only; connect to your backend / Formspree) ---------- */
  const form = $('#form'), ok = $('#formOk');
  form.addEventListener('submit', e => {
    e.preventDefault();
    let valid = true;
    $$('[required]', form).forEach(f => {
      const bad = !f.value.trim() || (f.type === 'email' && !/^\S+@\S+\.\S+$/.test(f.value));
      f.classList.toggle('err', bad); if (bad) valid = false;
    });
    if (!valid) return;
    // TODO: fetch('YOUR_ENDPOINT', {method:'POST', body:new FormData(form)})
    ok.hidden = false; form.reset();
    setTimeout(() => ok.hidden = true, 5000);
  });

  $('#yr').textContent = new Date().getFullYear();
})();

/* ---------- Preloader: progress follows the real video download ---------- */
(function () {
  const pre = document.getElementById('pre'), v = document.getElementById('heroVideo');
  if (!pre) return;
  const ring = document.getElementById('preRing'), num = document.getElementById('preN'), txt = document.getElementById('preT');
  const MIN = matchMedia('(prefers-reduced-motion: reduce)').matches ? 500 : 2400, MAX = 7000, C = 590.6;
  const root = document.documentElement, t0 = performance.now();
  root.classList.add('lock');
  let shown = 0, over = false;
  const loaded = () => {
    if (v.readyState >= 4) return 1;
    try { return v.duration ? Math.min(1, v.buffered.end(v.buffered.length - 1) / v.duration) : 0; } catch (e) { return 0; }
  };
  function frame(now) {
    const el = now - t0, timeP = Math.min(1, el / MIN);
    const target = el > MAX ? 1 : Math.min(timeP, loaded() || (v.readyState >= 3 ? timeP : timeP * .85));
    shown += (target - shown) * .12;
    if (target >= 1 && 1 - shown < .004) shown = 1;
    const p = Math.round(shown * 100);
    num.textContent = p;
    ring.style.strokeDashoffset = (C * (1 - shown)).toFixed(1);
    txt.textContent = p < 30 ? 'Calibrating probe' : p < 65 ? 'Scanning weld seam' : p < 100 ? 'Analysing signal' : 'No defects found';
    if (shown >= 1 && !over) {
      over = true;
      setTimeout(() => { pre.classList.add('done'); root.classList.remove('lock'); setTimeout(() => pre.remove(), 1400); }, 450);
      return;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
