/* Tasca Beach Club · interface e movimento. Um único requestAnimationFrame para a página toda. */
(function () {
  'use strict';
  const C = window.TASCA, B = window.TascaBooking;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
  const calmo = matchMedia('(prefers-reduced-motion: reduce)');
  const moving = () => !calmo.matches;
  const Q = new URLSearchParams(location.search);
  const SVGNS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs = {}, parent) => { const n = document.createElementNS(SVGNS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); if (parent) parent.appendChild(n); return n; };
  const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const DIAS_LONGO = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const brl = n => 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 0 });
  const hh = h => (h === 24 ? '0' : h) + 'h';

  // geometria em cache: o laço só lê scrollY, sem forçar layout a cada quadro
  const geoCache = new Map(); let geoVer = 0;
  const regeo = () => { geoVer++; };
  addEventListener('resize', regeo); new ResizeObserver(regeo).observe(document.body);
  function geo(n) {
    let g = geoCache.get(n);
    if (!g || g.v !== geoVer) { let t = 0, e = n; while (e) { t += e.offsetTop; e = e.offsetParent; } g = { top: t, h: n.offsetHeight, v: geoVer }; geoCache.set(n, g); }
    return g;
  }
  let SY = scrollY, VH = innerHeight;
  // progresso de uma seção alta com conteúdo sticky (0 no topo, 1 no fim)
  function prog(node) { const g = geo(node), span = g.h - VH; return span <= 0 ? 0 : clamp((SY - g.top) / span); }
  function inView(node) { const g = geo(node); return SY + VH > g.top && SY < g.top + g.h; }

  /* ---------- laço único ---------- */
  const tasks = [];
  let last = performance.now();
  const jank = [];
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    SY = scrollY; VH = innerHeight;
    jank.push(dt * 1000); if (jank.length > 240) jank.shift();
    for (const t of tasks) { try { t(dt, now); } catch (e) { console.error(e); } }
    requestAnimationFrame(frame);
  }
  window.__jank = () => { const d = [...jank].sort((a, b) => a - b); return { p95: d[Math.floor(d.length * .95)] | 0, max: d[d.length - 1] | 0 }; };

  /* ---------- links de contato ---------- */
  const waMsg = t => `https://wa.me/${C.whatsapp}?text=${encodeURIComponent(t)}`;
  $$('.waLink').forEach(a => a.href = waMsg('Olá! Vim pelo site do Tasca e queria falar sobre as quadras.'));
  $('#whLink').href = waMsg('Olá! Tenho Wellhub e queria saber como jogar no Tasca.');
  $('#mapsLink').href = C.mapsUrl;
  $('#rateLink').href = C.mapsUrl;
  $('#year').textContent = new Date().getFullYear();

  /* ---------- menu do celular ---------- */
  const sheet = $('#sheet'), menuBtn = $('.nav-menu');
  const setSheet = open => { sheet.classList.toggle('open', open); sheet.setAttribute('aria-hidden', String(!open)); menuBtn.setAttribute('aria-expanded', String(open)); };
  menuBtn.addEventListener('click', () => setSheet(true));
  $('.sheet-close').addEventListener('click', () => setSheet(false));
  $$('#sheet a').forEach(a => a.addEventListener('click', () => setSheet(false)));

  /* ---------- entrada das seções ---------- */
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -10% 0px', threshold: .08 });
  $$('.rise').forEach(n => io.observe(n));

  /* ---------- HERO: recuo de câmera em 3 quadros alinhados ---------- */
  const hero = (function () {
    const sec = $('#hero'), cv = $('#pull'), ctx = cv.getContext('2d', { alpha: false });
    const WORLD = { w: 2752, h: 1536 };
    // retângulos de cada quadro no espaço do quadro aberto (kf3), alinhados pela bola
    const L = [
      { key: 'kf3', r: [0, 0, 2752, 1536] },
      { key: 'kf2', r: [771, 807, 1045, 588] },
      { key: 'kf1', r: [1151.4, 1105.2, 325.3, 184.6] }
    ];
    const BALL = { x: 1313.8, y: 1197.5, d: 93 };
    const size = () => (Math.min(innerWidth, 2400) * Math.min(devicePixelRatio || 1, 2) > 1700 ? 2400 : 1600);
    const imgs = {}, masked = {};
    let cw = 0, ch = 0, dpr = 1, cur = 0, target = 0, drawnAt = -1, ready = false;

    function feather(img, f) {
      // borda suave para o quadro de dentro desaparecer sem costura
      const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
      const x = c.getContext('2d'); x.drawImage(img, 0, 0);
      x.globalCompositeOperation = 'destination-in';
      const w = c.width, h = c.height, fx = w * f, fy = h * f * 1.4;
      let g = x.createLinearGradient(0, 0, w, 0);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(fx / w, '#000'); g.addColorStop(1 - fx / w, '#000'); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.fillRect(0, 0, w, h);
      g = x.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(fy / h, '#000'); g.addColorStop(1 - fy / h, '#000'); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.fillRect(0, 0, w, h);
      return c;
    }
    function load() {
      const s = size();
      const order = ['kf1', 'kf2', 'kf3'];
      return Promise.all(order.map((k, i) => new Promise(res => {
        const im = new Image(); im.decoding = 'async';
        im.onload = () => { imgs[k] = im; if (k !== 'kf3') masked[k] = feather(im, k === 'kf1' ? .12 : .1); res(); draw(true); };
        im.onerror = () => res();
        // kf1 primeiro, os outros logo depois
        setTimeout(() => { im.src = `img/hero/${k}-${s}.webp`; }, i === 0 ? 0 : 60);
      })));
    }
    function resize() {
      const r = cv.getBoundingClientRect(); dpr = Math.min(devicePixelRatio || 1, 2);
      cw = Math.max(2, Math.round(r.width * dpr)); ch = Math.max(2, Math.round(r.height * dpr));
      cv.width = cw; cv.height = ch; drawnAt = -1; draw(true);
    }
    function views() {
      const A = cw / ch;
      const k1 = L[2].r;
      // começo: dentro do quadro da bola
      let vw0, vh0;
      if (A >= k1[2] / k1[3]) { vw0 = k1[2]; vh0 = vw0 / A; } else { vh0 = k1[3]; vw0 = vh0 * A; }
      const c0 = { x: k1[0] + k1[2] / 2, y: k1[1] + k1[3] / 2 };
      // fim: o clube inteiro
      let vw1, vh1;
      if (A >= WORLD.w / WORLD.h) { vw1 = WORLD.w; vh1 = vw1 / A; } else { vh1 = WORLD.h; vw1 = vh1 * A; }
      const c1 = { x: A < 1 ? 1180 : WORLD.w / 2, y: WORLD.h / 2 };
      return { A, vw0, vh0, c0, vw1, vh1, c1 };
    }
    function camera(p) {
      const v = views();
      const e = p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2; // ease in-out
      const vw = v.vw0 * Math.pow(v.vw1 / v.vw0, e), vh = vw / v.A;
      const k = (vw - v.vw0) / (v.vw1 - v.vw0 || 1);
      let cx = lerp(v.c0.x, v.c1.x, k), cy = lerp(v.c0.y, v.c1.y, k);
      cx = clamp(cx, vw / 2, WORLD.w - vw / 2); cy = clamp(cy, vh / 2, WORLD.h - vh / 2);
      return { x: cx - vw / 2, y: cy - vh / 2, w: vw, h: vh };
    }
    function draw(force) {
      if (!cw || !imgs.kf1 && !imgs.kf3) return;
      if (!force && Math.abs(drawnAt - cur) < 0.00005) return;
      drawnAt = cur;
      const V = camera(cur), sx = cw / V.w, sy = ch / V.h;
      ctx.fillStyle = '#17132A'; ctx.fillRect(0, 0, cw, ch);
      const put = (src, r, a) => {
        if (!src || a <= 0.002) return;
        ctx.globalAlpha = a;
        ctx.drawImage(src, (r[0] - V.x) * sx, (r[1] - V.y) * sy, r[2] * sx, r[3] * sy);
      };
      put(imgs.kf3, L[0].r, 1);
      for (const i of [1, 2]) {
        const r = L[i].r; const over = Math.max(V.w / r[2], V.h / r[3]);
        // quadro de dentro aparece enquanto a vista cabe nele; some ao sair
        const a = 1 - smooth(1.0, i === 2 ? 1.55 : 1.5, over);
        const src = masked[L[i].key] && over > 1.0 ? masked[L[i].key] : imgs[L[i].key];
        put(src || masked[L[i].key], r, imgs.kf3 ? a : 1);
      }
      ctx.globalAlpha = 1;
    }
    const beats = $$('.beat'), chips = $$('.hero-rail .cap'), bar = $('#pullbar'); let lastUi = -1;
    function ui(p) {
      const win = [[-1, 0, .2, .3], [.3, .4, .58, .66], [.68, .78, 2, 3]];
      beats.forEach((b, i) => {
        const [a0, a1, b0, b1] = win[i];
        const v = Math.min(smooth(a0, a1, p), 1 - smooth(b0, b1, p));
        b.style.opacity = v.toFixed(3);
        b.style.transform = `translateY(${((1 - v) * (p < a1 ? 26 : -26)).toFixed(1)}px)`;
        b.style.visibility = v < .01 ? 'hidden' : 'visible';
        b.setAttribute('aria-hidden', String(v < .5));
        b.style.pointerEvents = v > .5 ? 'auto' : 'none';
      });
      const ch = p < .33 ? 0 : p < .7 ? 1 : 2;
      chips.forEach(c => c.classList.toggle('on', +c.dataset.ch === ch));
      bar.style.transform = `scaleX(${p.toFixed(4)})`;
    }
    function tick() {
      target = prog(sec);
      cur += (target - cur) * (moving() ? .14 : 1);
      if (Math.abs(target - cur) < .0004) cur = target;
      if (Math.abs(cur - lastUi) > 1e-5) { draw(false); ui(cur); lastUi = cur; }
    }
    function settle() { target = cur = prog(sec); draw(true); ui(cur); }
    addEventListener('resize', resize);
    resize(); const loading = load();
    return { tick, settle, loading };
  })();
  tasks.push(hero.tick);

  /* ---------- marquee ---------- */
  (function () {
    const ball = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="none" stroke="#11A79C" stroke-width="1.8"/><path d="M12 1a11 11 0 0 1 6 20M3 7c5 1 10 6 11 15M21 8c-6-2-13 1-17 8" fill="none" stroke="#11A79C" stroke-width="1.6"/></svg>';
    const items = ['Vôlei de praia', 'Beach tennis', 'Futevôlei', 'Bar na areia', 'R$ 90 a hora', 'Seis quadras', 'Pôr do sol'];
    const row = items.map(t => `<span>${t}${ball}</span>`).join('');
    $('#mq').innerHTML = row + row;
  })();

  /* ---------- status do clube (aberto/fechado) ---------- */
  let CFG = null;
  function status(now = new Date()) {
    const d = now.getDay(), h = now.getHours() + now.getMinutes() / 60, f = CFG.horarios[d];
    if (f && h >= f[0] && h < f[1]) return { open: true, closes: f[1], opens: f[0], frac: (h - f[0]) / (f[1] - f[0]), label: `Aberto agora · até ${hh(f[1])}` };
    for (let i = 0; i < 8; i++) {
      const dd = (d + i) % 7, ff = CFG.horarios[dd];
      if (!ff) continue;
      if (i === 0 && h >= ff[0]) continue;
      const quando = i === 0 ? 'hoje' : i === 1 ? 'amanhã' : DIAS_LONGO[dd];
      return { open: false, opens: ff[0], label: `Fechado · abre ${quando} às ${hh(ff[0])}`, quando };
    }
    return { open: false, label: 'Fechado' };
  }
  function pill(node, st) { node.classList.toggle('open', st.open); node.querySelector('span').textContent = st.label; }

  /* ---------- mapa das quadras ---------- */
  async function courtMap() {
    const svg = $('#courtmap'); svg.innerHTML = '';
    const n = CFG.quadras, cols = 3, rows = Math.ceil(n / cols);
    const W = 600, H = 380, gx = 18, gy = 22, cwid = (W - gx * (cols + 1)) / cols, chei = (H - gy * (rows + 1)) / rows;
    el('rect', { x: 0, y: 0, width: W, height: H, rx: 18, fill: '#EEE5D2' }, svg);
    const st = status(); const now = new Date();
    // aberto: agora. fechado: a primeira hora da próxima abertura
    let day = new Date(now), hr = now.getHours();
    if (!st.open && st.opens != null) { const add = st.quando === 'hoje' ? 0 : st.quando === 'amanhã' ? 1 : ((DIAS_LONGO.indexOf(st.quando) - now.getDay() + 7) % 7); day.setDate(day.getDate() + add); hr = st.opens; }
    let busy = new Set();
    try { busy = await B.ocupados(B.iso(day)); } catch (e) { console.warn(e); }
    let livres = 0;
    const courts = [];
    for (let i = 0; i < n; i++) {
      const q = i + 1, c = i % cols, r = Math.floor(i / cols);
      const x = gx + c * (cwid + gx), y = gy + r * (chei + gy);
      const free = !busy.has(q + '-' + hr);
      if (free) livres++;
      const g = el('g', { class: 'court' }, svg);
      const fill = free ? '#CFEDE8' : '#DCCFB6';
      el('rect', { x, y, width: cwid, height: chei, rx: 10, fill, class: 'c-fill' }, g);
      const pad = 14, ix = x + pad, iy = y + pad, iw = cwid - pad * 2, ih = chei - pad * 2;
      const stroke = free ? '#11A79C' : '#FFFCF5';
      const per = 2 * (iw + ih);
      el('rect', { x: ix, y: iy, width: iw, height: ih, fill: 'none', stroke, 'stroke-width': 2.5, 'stroke-dasharray': per, 'stroke-dashoffset': per, class: 'c-line', style: `transition:stroke-dashoffset 1.2s ${0.12 * i}s cubic-bezier(.16,1,.3,1)` }, g);
      el('line', { x1: ix + iw / 2, y1: iy - 6, x2: ix + iw / 2, y2: iy + ih + 6, stroke: '#12302D', 'stroke-width': 3, 'stroke-dasharray': ih + 12, 'stroke-dashoffset': ih + 12, class: 'c-line', style: `transition:stroke-dashoffset .9s ${0.12 * i + .5}s cubic-bezier(.16,1,.3,1)` }, g);
      const t = el('text', { x: ix + 8, y: iy + 20, 'font-family': 'Inter, sans-serif', 'font-weight': 700, 'font-size': 13, fill: '#12302D' }, g);
      t.textContent = 'Q' + q;
      if (free) {
        const p = el('circle', { cx: ix + iw - 14, cy: iy + 14, r: 6, fill: '#11A79C', class: 'c-pulse' }, g);
      } else {
        el('circle', { cx: ix + iw * .3, cy: iy + ih * .55, r: 7, fill: '#FEF102', stroke: '#12302D', 'stroke-width': 1.5 }, g);
      }
      courts.push(g);
    }
    const quando = st.open ? 'agora' : `${st.quando === 'hoje' ? 'hoje' : st.quando} às ${hh(hr)}`;
    $('#mapTitle').textContent = `${livres} de ${n} livres ${quando}`;
    $('#mapKicker').textContent = st.open ? 'Agora no Tasca' : 'Próxima abertura';
    pill($('#mapStatus'), st);
    const drawLines = () => $$('.c-line', svg).forEach(l => l.setAttribute('stroke-dashoffset', 0));
    const ob = new IntersectionObserver(es => { if (es[0].isIntersecting) { drawLines(); ob.disconnect(); } }, { threshold: .3 });
    if (!moving()) drawLines(); else ob.observe(svg);

  }

  /* ---------- jogadas dos esportes ---------- */
  function volleyball(parent, r) {
    const g = el('g', {}, parent);
    el('circle', { r, fill: '#FFFCF5', stroke: '#12302D', 'stroke-width': 1.6 }, g);
    el('path', { d: `M${-r * .2},${-r * .98} C${r * .6},${-r * .5} ${r * .7},${r * .3} ${r * .45},${r * .9}`, fill: 'none', stroke: '#11A79C', 'stroke-width': r * .42 }, g);
    el('path', { d: `M${-r * .95},${r * .1} C${-r * .4},${-r * .3} ${r * .3},${-r * .2} ${r * .9},${r * .35}`, fill: 'none', stroke: '#FEF102', 'stroke-width': r * .42 }, g);
    el('circle', { r, fill: 'none', stroke: '#12302D', 'stroke-width': 1.6 }, g);
    return g;
  }
  function play(id, cfg) {
    const svg = $('#' + id); if (!svg) return;
    const dark = svg.closest('.sport.main') !== null;
    const ink = dark ? '#FFFCF5' : '#12302D', soft = dark ? 'rgba(255,252,245,.35)' : 'rgba(18,48,45,.3)';
    const [W, H] = svg.getAttribute('viewBox').split(' ').slice(2).map(Number);
    const ground = H - 40;
    el('rect', { x: 0, y: ground, width: W, height: 40, rx: 10, fill: dark ? 'rgba(241,234,219,.14)' : '#E6DCC8' }, svg);
    el('line', { x1: W / 2, y1: ground, x2: W / 2, y2: cfg.net, stroke: ink, 'stroke-width': 3 }, svg);
    el('rect', { x: W / 2 - 3, y: cfg.net, width: 6, height: 26, fill: ink, opacity: .85 }, svg);
    for (let y = cfg.net + 34; y < ground - 6; y += 12) el('line', { x1: W / 2 - 3, y1: y, x2: W / 2 + 3, y2: y, stroke: soft, 'stroke-width': 1 }, svg);
    // caminho a partir dos pontos de toque: cada toque fica exatamente num vértice
    let d = `M${cfg.start[0]},${cfg.start[1]}`; const pts = [cfg.start]; const lens = [0];
    let prev = cfg.start;
    cfg.segs.forEach(sg => {
      const piece = sg.length === 4 ? `Q${sg[0]},${sg[1]} ${sg[2]},${sg[3]}` : `L${sg[0]},${sg[1]}`;
      const tmp = el('path', { d: `M${prev[0]},${prev[1]} ${piece}` }, svg); lens.push(lens[lens.length - 1] + tmp.getTotalLength()); tmp.remove();
      d += ' ' + piece; prev = sg.length === 4 ? [sg[2], sg[3]] : [sg[0], sg[1]]; pts.push(prev);
    });
    const total = lens[lens.length - 1];
    const path = el('path', { d, fill: 'none', stroke: soft, 'stroke-width': 2, 'stroke-dasharray': '2 7', 'stroke-linecap': 'round' }, svg);
    const trail = el('path', { d, fill: 'none', stroke: dark ? '#FEF102' : '#11A79C', 'stroke-width': 3.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, svg);
    trail.setAttribute('stroke-dasharray', total); trail.setAttribute('stroke-dashoffset', total);
    const marks = cfg.touches.map((pi, n) => {
      const [x, y] = pts[pi];
      const g = el('g', { opacity: .5 }, svg);
      el('circle', { cx: x, cy: y, r: 15, fill: dark ? '#12302D' : '#FFFCF5', stroke: ink, 'stroke-width': 1.6 }, g);
      const t = el('text', { x, y: y + 5, 'text-anchor': 'middle', 'font-family': 'Inter, sans-serif', 'font-weight': 700, 'font-size': 14, fill: ink }, g);
      t.textContent = n + 1;
      return { g, at: lens[pi] / total };
    });
    const ball = volleyball(svg, cfg.r || 11);
    if (cfg.felt) { ball.innerHTML = ''; el('circle', { r: 8, fill: '#FEF102', stroke: '#12302D', 'stroke-width': 1.4 }, ball); el('path', { d: 'M-6,-5 C-1,-1 -1,1 -6,5 M6,-5 C1,-1 1,1 6,5', fill: 'none', stroke: '#fff', 'stroke-width': 1.4 }, ball); }
    const splash = el('g', { opacity: 0 }, svg);
    const end = pts[pts.length - 1];
    for (let i = 0; i < 7; i++) { const a = Math.PI + (i / 6) * Math.PI; el('circle', { cx: end[0] + Math.cos(a) * 18, cy: ground + Math.sin(a) * 8 - 2, r: 2.4, fill: dark ? '#E6DCC8' : '#C9B994' }, splash); }
    const steps = cfg.steps ? $$('li', $(cfg.steps)) : [];
    const period = cfg.period || 3.6;
    let t = cfg.offset || 0, vis = false;
    new IntersectionObserver(es => vis = es[0].isIntersecting, { rootMargin: '80px' }).observe(svg);
    function render(tt) {
      const e = clamp((tt % period) / (period * .78));
      const pt = path.getPointAtLength(total * e);
      ball.setAttribute('transform', `translate(${pt.x.toFixed(1)},${pt.y.toFixed(1)}) rotate(${(e * 540).toFixed(0)})`);
      trail.setAttribute('stroke-dashoffset', (total * (1 - e)).toFixed(1));
      let active = -1;
      marks.forEach((m, i) => { const on = e >= m.at - .001; m.g.setAttribute('opacity', on ? 1 : .5); if (on) active = i; });
      steps.forEach((st, i) => st.classList.toggle('on', i === active));
      const u = (tt % period) / period;
      splash.setAttribute('opacity', (clamp((e - .97) / .03) * (1 - clamp((u - .82) / .18))).toFixed(2));
    }
    render(period * .78 * .999);
    tasks.push(dt => { if (!vis) return; if (!moving()) { render(period * .78 * .999); return; } t += dt; render(t); });
  }
  // vôlei: recepção, levantamento alto e ataque por cima da rede
  play('play-volei', { net: 96, r: 13, steps: '#steps-volei', period: 4.2,
    start: [90, 236], segs: [[130, 40, 230, 150], [250, -14, 294, 70], [482, 252]], touches: [0, 1, 2] });
  play('play-bt', { net: 120, felt: true, period: 3.4, offset: 1.1, steps: '#steps-bt',
    start: [100, 188], segs: [[330, -96, 560, 214]], touches: [0, 1] });
  play('play-fv', { net: 112, r: 11, period: 3.8, offset: 2, steps: '#steps-fv',
    start: [60, 40], segs: [[100, 70, 128, 128], [138, 40, 160, 176], [300, -50, 540, 214]], touches: [1, 2, 3] });

  /* ---------- reservas ---------- */
  const bk = { esporte: 'volei', data: null, quadra: null, horas: [], busy: new Set(), busyReq: 0, done: null };
  async function bookingInit() {
    const sp = $('#bkSport');
    sp.innerHTML = C.esportes.map(s => `<button type="button" class="chip" data-id="${s.id}" aria-pressed="${s.id === bk.esporte}">${s.nome}</button>`).join('');
    sp.addEventListener('click', e => { const b = e.target.closest('.chip'); if (!b) return; bk.esporte = b.dataset.id; $$('.chip', sp).forEach(c => c.setAttribute('aria-pressed', String(c === b))); ticket(); });
    const days = $('#bkDays'); const today = new Date(); today.setHours(0, 0, 0, 0);
    let first = null, html = '';
    for (let i = 0; i <= CFG.diasAntecedencia; i++) {
      const d = new Date(today); d.setDate(d.getDate() + i);
      const f = CFG.horarios[d.getDay()];
      const nowH = new Date().getHours();
      const open = !!f && !(i === 0 && nowH >= f[1] - 1);
      if (open && !first) first = B.iso(d);
      html += `<button type="button" class="day" data-d="${B.iso(d)}" ${open ? '' : 'disabled'} aria-pressed="false" aria-label="${DIAS_LONGO[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}${open ? '' : ', fechado'}"><small>${i === 0 ? 'Hoje' : DIAS[d.getDay()]}</small><b>${d.getDate()}</b><small>${MESES[d.getMonth()]}</small></button>`;
    }
    days.innerHTML = html;
    days.addEventListener('click', e => { const b = e.target.closest('.day'); if (!b || b.disabled) return; pickDay(b.dataset.d); });
    $('#bkDemo').innerHTML = B.LIVE ? '' : '<span class="demo-note"><i></i>Modo demonstração: o pedido fica salvo só neste navegador.</span>';
    $('#bkForm').addEventListener('submit', submit);
    $('#bkPhone').addEventListener('input', e => { const v = e.target.value.replace(/\D/g, '').slice(0, 11); e.target.value = v.length > 6 ? `(${v.slice(0, 2)}) ${v.slice(2, v.length - 4)}-${v.slice(-4)}` : v.length > 2 ? `(${v.slice(0, 2)}) ${v.slice(2)}` : v; });
    $('#bkGrid').addEventListener('click', e => { const s = e.target.closest('.slot'); if (!s || s.disabled) return; toggle(+s.dataset.q, +s.dataset.h); });
    if (first) pickDay(first); else $('#bkGrid').innerHTML = '<p class="closed-note">Sem dias abertos para reserva agora.</p>';
  }
  async function pickDay(d) {
    bk.data = d; bk.quadra = null; bk.horas = [];
    $$('#bkDays .day').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.d === d)));
    const dt = B.parse(d);
    $('#bkDayTitle').textContent = `${DIAS_LONGO[dt.getDay()][0].toUpperCase() + DIAS_LONGO[dt.getDay()].slice(1)}, ${dt.getDate()} de ${MESES[dt.getMonth()]}`;
    const req = ++bk.busyReq;
    grid(true);
    try { const s = await B.ocupados(d); if (req !== bk.busyReq) return; bk.busy = s; } catch (e) { console.warn(e); bk.busy = new Set(); msg('err', 'Não deu para carregar os horários agora. Tente de novo em instantes.'); }
    if (!bk.done) suggest();
    grid(false); ticket();
  }
  function suggest() {
    const d = B.parse(bk.data), f = CFG.horarios[d.getDay()]; if (!f) return;
    const isToday = bk.data === B.iso(new Date()), nowH = new Date().getHours();
    for (let h = f[0]; h < f[1]; h++) for (let q = 1; q <= CFG.quadras; q++) {
      if (isToday && h <= nowH) continue;
      if (!bk.busy.has(q + '-' + h)) { bk.quadra = q; bk.horas = [h]; bk.suggested = true; return; }
    }
  }
  function grid(loading) {
    const box = $('#bkGrid'); const d = B.parse(bk.data); const f = CFG.horarios[d.getDay()];
    if (!f) { box.innerHTML = '<p class="closed-note">O clube não abre neste dia.</p>'; return; }
    const isToday = bk.data === B.iso(new Date()); const nowH = new Date().getHours();
    let h = `<div class="grid${moving() ? ' enter' : ''}" style="--cols:${CFG.quadras}" role="grid" aria-label="Horários por quadra"><div></div>`;
    for (let q = 1; q <= CFG.quadras; q++) h += `<div class="hd">Q${q}</div>`;
    for (let hr = f[0]; hr < f[1]; hr++) {
      h += `<div class="hr">${hr}h</div>`;
      for (let q = 1; q <= CFG.quadras; q++) {
        const past = isToday && hr <= nowH, busy = !loading && bk.busy.has(q + '-' + hr);
        const sel = bk.quadra === q && bk.horas.includes(hr);
        const cls = past ? 'past' : busy ? 'busy' : sel ? 'sel' : '';
        const lab = `Quadra ${q}, ${hr}h às ${hr + 1}h, ${past ? 'encerrado' : busy ? 'ocupado' : sel ? 'selecionado' : 'livre'}`;
        h += `<button type="button" class="slot ${cls}" data-q="${q}" data-h="${hr}" ${past || busy || loading ? 'disabled' : ''} aria-label="${lab}" aria-pressed="${sel}"></button>`;
      }
    }
    box.innerHTML = h + '</div>';
    const g = box.firstElementChild;
    if (g.classList.contains('enter') && !loading) {
      const cells = $$('.slot', g);
      requestAnimationFrame(() => { cells.forEach((c, i) => { const row = Math.floor(i / CFG.quadras), col = i % CFG.quadras; c.style.transitionDelay = `${(row * 28 + col * 14)}ms`; }); g.classList.remove('enter'); setTimeout(() => cells.forEach(c => c.style.transitionDelay = ''), 1400); });
    }
  }
  function toggle(q, h) {
    if (bk.quadra !== q) { bk.quadra = q; bk.horas = [h]; }
    else if (bk.horas.includes(h)) {
      const s = [...bk.horas].sort((a, b) => a - b);
      if (h === s[0] || h === s[s.length - 1]) bk.horas = s.filter(x => x !== h); else bk.horas = [h];
      if (!bk.horas.length) bk.quadra = null;
    } else {
      const s = [...bk.horas, h].sort((a, b) => a - b);
      const contiguous = s.every((x, i) => i === 0 || x === s[i - 1] + 1);
      bk.horas = contiguous && s.length <= 4 ? s : [h];
    }
    $$('#bkGrid .slot').forEach(c => {
      const sel = +c.dataset.q === bk.quadra && bk.horas.includes(+c.dataset.h);
      if (!c.disabled) { c.classList.toggle('sel', sel); c.setAttribute('aria-pressed', String(sel)); }
    });
    bk.suggested = false; msg(); ticket();
  }
  function ticket() {
    const box = $('#bkTicket');
    if (bk.done) return;
    const tot = $('#bkTotal');
    if (!bk.quadra || !bk.horas.length) { box.innerHTML = '<div class="ticket-empty">Escolha um horário na grade para montar sua reserva.</div>'; tot.textContent = ''; return; }
    tot.textContent = `${bk.horas.length}h · ${brl(bk.horas.length * CFG.precoHora)} no local`;
    const d = B.parse(bk.data), s = [...bk.horas].sort((a, b) => a - b);
    const esporte = C.esportes.find(e => e.id === bk.esporte).nome;
    const rows = [['Esporte', esporte], ['Dia', `${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`], ['Quadra', 'Quadra ' + bk.quadra], ['Horário', `${s[0]}h às ${s[s.length - 1] + 1}h`]];
    const prev = box.querySelector('.ticket');
    box.innerHTML = `<div class="ticket">${bk.suggested ? '<p class="cap" style="color:var(--ink);margin-bottom:6px">Próximo horário livre</p>' : ''}${rows.map(r => `<div class="row"><span>${r[0]}</span><b>${r[1]}</b></div>`).join('')}<div class="total"><span>${s.length}h · pague no local</span><b class="num">${brl(s.length * CFG.precoHora)}</b></div></div>`;
    const rs = $$('.row', box);
    if (prev || !moving()) rs.forEach(r => r.classList.add('in'));
    else rs.forEach((r, i) => setTimeout(() => r.classList.add('in'), 80 + i * 110));
  }
  function msg(kind, text) { const m = $('#bkMsg'); m.innerHTML = kind ? `<div class="msg ${kind}">${text}</div>` : ''; }
  async function submit(e) {
    e.preventDefault();
    if (!bk.quadra || !bk.horas.length) { msg('err', 'Escolha pelo menos um horário na grade.'); $('#bkGrid').scrollIntoView({ behavior: moving() ? 'smooth' : 'auto', block: 'center' }); return; }
    const nome = $('#bkName').value, tel = $('#bkPhone').value;
    const btn = $('#bkSubmit'); btn.disabled = true; btn.firstElementChild.textContent = 'Enviando...';
    try {
      const horas = [...bk.horas].sort((a, b) => a - b);
      await B.reservar({ quadra: bk.quadra, data: bk.data, horas, esporte: bk.esporte, nome, telefone: tel });
      const d = B.parse(bk.data), esporte = C.esportes.find(x => x.id === bk.esporte).nome;
      const resumo = `${esporte} · ${DIAS[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1} · Quadra ${bk.quadra} · ${horas[0]}h às ${horas[horas.length - 1] + 1}h`;
      const wa = waMsg(`Olá! Acabei de pedir uma reserva pelo site.\n${resumo}\nNome: ${nome.trim()}\nPode confirmar?`);
      bk.done = true;
      $('#bkTicket').innerHTML = `<div class="ticket"><div class="done"><p class="cap" style="color:var(--ink)">Reserva pendente</p><p class="h3" style="font-size:30px">Pedido recebido</p><p style="margin:0">${resumo}</p><p style="margin:0;font-size:14px">Status: aguardando confirmação do clube. Total ${brl(horas.length * CFG.precoHora)}, pago no local.</p><a class="btn btn-ink btn-sm" href="${wa}" target="_blank" rel="noopener">Avisar o clube no WhatsApp<span class="dot"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 8h10M9 4l4 4-4 4"/></svg></span></a><button type="button" class="btn btn-ghost btn-sm" id="bkAgain">Fazer outra reserva</button></div></div>`;
      $('#bkAgain').addEventListener('click', () => { bk.done = null; pickDay(bk.data); });
      msg(); bk.quadra = null; bk.horas = []; $('#bkTotal').textContent = '';
      const s = await B.ocupados(bk.data); bk.busy = s; grid(false);
      courtMap();
    } catch (err) {
      msg('err', err.message || 'Não deu para reservar agora.');
      try { bk.busy = await B.ocupados(bk.data); grid(false); } catch (e2) {}
    } finally { btn.disabled = false; btn.firstElementChild.textContent = 'Pedir reserva'; }
  }

  /* ---------- bar e eventos: arco do sol ---------- */
  (function () {
    const sec = $('#bar'), stick = $('#duskStick'), svg = $('#sunarc');
    const lines = $$('#duskLines p'), photos = $$('.dusk-photos img'), clock = $('#duskClock');
    const hy = 196, cx = 300, rx = 260, ry = 128;
    const SUNSET = 18.6, A0 = Math.PI * .72; // 16h: alto, à esquerda · pôr do sol: horizonte à direita
    const sunAt = h => { const k = clamp((h - 16) / (SUNSET - 16)); const a = A0 * (1 - k); return { x: cx + Math.cos(a) * rx, y: hy - Math.sin(a) * ry }; };
    // varal de luzes no topo
    const bulbs = [], pts = [];
    for (let i = 0; i < 12; i++) { const x = 30 + i * 49, y = 12 + Math.sin(i / 11 * Math.PI) * 20; pts.push(`${x},${y}`); }
    el('polyline', { points: pts.join(' '), fill: 'none', stroke: 'currentColor', 'stroke-width': 1, opacity: .35 }, svg);
    pts.forEach(p => { const [x, y] = p.split(','); bulbs.push(el('circle', { cx: x, cy: +y + 5, r: 4.5, fill: '#FFE7A3', opacity: .14 }, svg)); });
    el('line', { x1: 14, y1: hy, x2: 586, y2: hy, stroke: 'currentColor', 'stroke-width': 1.5, opacity: .5 }, svg);
    const p0 = sunAt(16), p1 = sunAt(SUNSET);
    el('path', { d: `M${p0.x},${p0.y} A${rx},${ry} 0 0 1 ${p1.x},${p1.y}`, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.5, 'stroke-dasharray': '3 7', opacity: .5 }, svg);
    const lab = (x, y, t, anchor) => { const n = el('text', { x, y, 'text-anchor': anchor || 'middle', 'font-family': 'Inter, sans-serif', 'font-size': 13, 'font-weight': 600, fill: 'currentColor', opacity: .78 }, svg); n.textContent = t; };
    lab(p0.x, p0.y - 22, '16h · abre');
    lab(586, hy + 24, 'Pôr do sol', 'end');
    const clip = el('clipPath', { id: 'skyclip' }, el('defs', {}, svg)); el('rect', { x: 0, y: 0, width: 600, height: hy }, clip);
    const g = el('g', { 'clip-path': 'url(#skyclip)' }, svg);
    const sun = el('circle', { r: 18, fill: '#FEF102' }, g);
    const ink = [18, 48, 45], paper = [255, 252, 245], sand = [241, 234, 219], dusk = [23, 19, 42];
    const mix = (a, b, t) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;
    let lastIdx = -1;
    tasks.push(() => {
      if (!inView(sec)) return;
      const p = prog(sec); if (Math.abs(p - (sec._lp ?? -1)) < 1e-4) return; sec._lp = p;
      const hour = 16 + p * 6;
      const s1 = sunAt(Math.min(hour, SUNSET)), sink = Math.max(0, hour - SUNSET) * 60;
      sun.setAttribute('cx', s1.x.toFixed(1)); sun.setAttribute('cy', (s1.y + sink).toFixed(1));
      const dark = smooth(.4, .52, p);
      stick.style.setProperty('--bg', mix(sand, dusk, dark));
      stick.style.setProperty('--fg', mix(ink, paper, dark));
      bulbs.forEach((b, i) => b.setAttribute('opacity', (0.14 + 0.86 * smooth(.5 + i * .022, .54 + i * .022, p)).toFixed(2)));
      const H2 = Math.min(22, Math.floor(hour)), m = H2 >= 22 ? 0 : Math.floor((hour % 1) * 60);
      clock.textContent = `${String(H2).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      const idx = Math.min(3, Math.floor(p * 4));
      if (idx !== lastIdx) { lastIdx = idx; lines.forEach((l, i) => l.classList.toggle('on', i === idx)); photos.forEach((ph, i) => ph.classList.toggle('on', i === idx)); }
    });
  })();

  /* ---------- avaliações ---------- */
  (function () {
    const box = $('#stars'), num = $('#rateNum'), cnt = $('#rateCount');
    const nota = C.googleNota, total = C.googleAvaliacoes;
    const star = 'M12 1.8l3.1 6.6 7.1.8-5.3 4.9 1.5 7.1L12 17.6l-6.4 3.6 1.5-7.1L1.8 9.2l7.1-.8z';
    const fills = [];
    for (let i = 0; i < 5; i++) {
      const s = el('svg', { viewBox: '0 0 24 24' }, box);
      const id = 'st' + i; const cp = el('clipPath', { id }, el('defs', {}, s));
      const r = el('rect', { x: 0, y: 0, width: 0, height: 24 }, cp);
      el('path', { d: star, fill: 'none', stroke: '#12302D', 'stroke-width': 1.4, 'stroke-linejoin': 'round' }, s);
      el('path', { d: star, fill: '#FEF102', stroke: '#12302D', 'stroke-width': 1.4, 'stroke-linejoin': 'round', 'clip-path': `url(#${id})` }, s);
      fills.push(r);
    }
    const set = k => {
      const v = nota * k;
      num.textContent = v.toFixed(1).replace('.', ',');
      cnt.textContent = Math.round(total * k);
      fills.forEach((r, i) => r.setAttribute('width', (24 * clamp(v - i)).toFixed(2)));
    };
    set(0.0001);
    let t = -1;
    const ob = new IntersectionObserver(es => { if (es[0].isIntersecting) { ob.disconnect(); if (!moving()) set(1); else t = 0; } }, { threshold: .4 });
    ob.observe($('#rate'));
    tasks.push(dt => { if (t < 0) return; t += dt; const k = clamp(t / 1.6); set(1 - Math.pow(1 - k, 3)); if (k >= 1) t = -1; });
  })();

  /* ---------- galeria guiada pelo scroll ---------- */
  (function () {
    const sec = $('#galeria'), track = $('#galTrack'), bar = $('#galbar'), hour = $('#galHour');
    const items = $$('.gal-item', track);
    let lastH = '', lastP = -1, gv = -1, max = 0, centers = [];
    tasks.push(() => {
      if (!inView(sec)) return;
      if (gv !== geoVer) { gv = geoVer; max = Math.max(0, track.scrollWidth - innerWidth); centers = items.map(it => it.offsetLeft + it.offsetWidth / 2); }
      const p = prog(sec); if (Math.abs(p - lastP) < 1e-4) return; lastP = p;
      const x = -max * p;
      track.style.transform = `translate3d(${x.toFixed(1)}px,0,0)`;
      bar.style.transform = `scaleX(${p.toFixed(4)})`;
      const mid = innerWidth / 2; let bi = 0, bd = 1e9;
      centers.forEach((c, i) => { const d = Math.abs(c + x - mid); if (d < bd) { bd = d; bi = i; } });
      if (items[bi].dataset.hour !== lastH) { lastH = items[bi].dataset.hour; hour.textContent = lastH; }
    });
  })();

  /* ---------- mapa sob demanda (não pesa no carregamento) ---------- */
  $('#mapEmbed button').addEventListener('click', e => {
    const box = $('#mapEmbed');
    box.innerHTML = `<iframe title="Mapa do Tasca Beach Club" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://www.google.com/maps?q=${encodeURIComponent('Av. Dr. Armando Pannunzio, 1920, Sorocaba, SP')}&output=embed"></iframe>`;
  });

  /* ---------- semana de horários ---------- */
  function week() {
    const box = $('#weekRows'); const order = [1, 2, 3, 4, 5, 6, 0]; const today = new Date().getDay();
    const S = 8, E = 24, span = E - S;
    box.innerHTML = order.map(d => {
      const f = CFG.horarios[d];
      const l = f ? (f[0] - S) / span * 100 : 0, w = f ? (f[1] - f[0]) / span * 100 : 0;
      return `<div class="wrow${d === today ? ' today' : ''}${f ? '' : ' closed'}"><span class="d">${DIAS[d]}</span><span class="t"><i style="left:${l}%;width:${w}%;--s:0"></i></span><span class="h">${f ? `${f[0]}h às ${f[1]}h` : 'Fechado'}</span></div>`;
    }).join('');
    pill($('#weekStatus'), status());
    const now = new Date(), h = now.getHours() + now.getMinutes() / 60;
    if (h >= S) {
      const row = $('.wrow.today .t', box);
      const line = document.createElement('i'); line.className = 'now-line'; line.style.left = (clamp((h - S) / span) * 100) + '%';
      row.appendChild(line);
    }
    const bars = $$('.t > i:not(.now-line)', box);
    const go = () => bars.forEach((b, i) => setTimeout(() => b.style.setProperty('--s', 1), moving() ? i * 80 : 0));
    const ob = new IntersectionObserver(es => { if (es[0].isIntersecting) { ob.disconnect(); go(); } }, { threshold: .3 });
    ob.observe(box);
  }

  /* ---------- selo final: anel do horário ---------- */
  function seal() {
    const svg = $('#sealRing'); svg.innerHTML = '';
    const st = status(); const R = 92, L = 2 * Math.PI * R;
    el('circle', { cx: 100, cy: 100, r: R, fill: 'none', stroke: 'rgba(18,48,45,.18)', 'stroke-width': 6 }, svg);
    const arc = el('circle', { cx: 100, cy: 100, r: R, fill: 'none', stroke: '#12302D', 'stroke-width': 6, 'stroke-linecap': 'round', 'stroke-dasharray': L, 'stroke-dashoffset': L, transform: 'rotate(-90 100 100)' }, svg);
    const rest = st.open ? 1 - st.frac : 0;
    const g = el('g', {}, svg);
    el('path', { id: 'sealPath', d: 'M100,100 m-78,0 a78,78 0 1,1 156,0 a78,78 0 1,1 -156,0', fill: 'none' }, el('defs', {}, svg));
    const txt = el('text', { 'font-family': 'Inter, sans-serif', 'font-weight': 700, 'font-size': 11, 'letter-spacing': '2.6', fill: '#12302D' }, g);
    const tp = el('textPath', { href: '#sealPath' }, txt);
    const lab = (st.open ? `ABERTO AGORA · FECHA ÀS ${st.closes}H` : `FECHADO · ABRE ${(st.quando || '').toUpperCase()} ÀS ${st.opens}H`) + ' · ';
    tp.textContent = (lab + 'SOROCABA · ').repeat(2);
    const ob = new IntersectionObserver(es => { if (es[0].isIntersecting) { ob.disconnect(); arc.style.transition = moving() ? 'stroke-dashoffset 1.6s cubic-bezier(.16,1,.3,1)' : 'none'; arc.setAttribute('stroke-dashoffset', (L * (1 - rest)).toFixed(1)); } }, { threshold: .4 });
    ob.observe(svg);
    let rot = 0, vis = false; new IntersectionObserver(es => vis = es[0].isIntersecting).observe(svg);
    tasks.push(dt => { if (!vis || !moving()) return; rot = (rot + dt * 6) % 360; g.setAttribute('transform', `rotate(${rot.toFixed(2)} 100 100)`); });
  }

  /* ---------- início ---------- */
  (async function start() {
    CFG = await B.config();
    courtMap(); week(); seal(); bookingInit();
    // preço vindo do painel
    if (CFG.precoHora !== C.precoHora) $$('[data-preco]').forEach(n => n.textContent = brl(CFG.precoHora));
    const J = Q.get('jump');
    await Promise.race([hero.loading, new Promise(r => setTimeout(r, 4000))]);
    if (J !== null) { history.scrollRestoration = 'manual'; scrollTo(0, +J || 0); }
    SY = scrollY; VH = innerHeight; regeo();
    hero.settle();
    requestAnimationFrame(frame);
    requestAnimationFrame(() => requestAnimationFrame(() => { window.__ready = true; }));
  })();
})();
