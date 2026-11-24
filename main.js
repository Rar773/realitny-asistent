/* Realitný asistent – web */
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Hlavička: tieň pri posúvaní ---------- */
(function () {
  const h = document.getElementById('hlavicka'); if (!h) return;
  const f = () => h.classList.toggle('scrolled', scrollY > 8);
  addEventListener('scroll', f, { passive: true }); f();
})();

/* ---------- Menu (mobil) a rozbaľovacie Služby ---------- */
(function () {
  const b = document.querySelector('.mnav'), m = document.getElementById('menu'); if (!b || !m) return;
  const close = () => { m.classList.remove('open'); const h2 = document.getElementById('hlavicka'); if (h2) h2.classList.remove('menu-otvorene'); b.setAttribute('aria-expanded', 'false'); document.body.style.overflow = ''; };
  const hd = document.getElementById('hlavicka');
  b.addEventListener('click', () => { const o = m.classList.toggle('open'); b.setAttribute('aria-expanded', o); document.body.style.overflow = o ? 'hidden' : ''; if (hd) { hd.classList.toggle('menu-otvorene', o); document.documentElement.style.setProperty('--hh', hd.getBoundingClientRect().height + 'px'); } });
  m.querySelectorAll('a').forEach(a => a.addEventListener('click', close));
  addEventListener('keydown', e => { if (e.key === 'Escape') { close(); document.querySelectorAll('.dd.open').forEach(d => { d.classList.remove('open'); d.querySelector('button').setAttribute('aria-expanded', 'false'); }); } });
  document.querySelectorAll('.dd').forEach(d => {
    const btn = d.querySelector('button');
    const set = o => { d.classList.toggle('open', o); btn.setAttribute('aria-expanded', o); };
    btn.addEventListener('click', e => { e.stopPropagation(); set(!d.classList.contains('open')); });
    if (matchMedia('(hover:hover) and (min-width:981px)').matches) {
      let t; d.addEventListener('pointerenter', () => { clearTimeout(t); set(true); });
      d.addEventListener('pointerleave', () => { t = setTimeout(() => set(false), 150); });
    }
    document.addEventListener('click', e => { if (!d.contains(e.target)) set(false); });
  });
})();

/* ---------- Notebook v úvode: striedanie obrazoviek aplikácie ---------- */
(function () {
  document.querySelectorAll('.lview.rot').forEach(v => {
    const p = [...v.querySelectorAll('picture')]; if (p.length < 2 || RM) return;
    let i = 0;
    setInterval(() => { p[i].classList.remove('on'); i = (i + 1) % p.length; p[i].classList.add('on'); }, 3200);
  });
  if (RM) document.querySelectorAll('.phone video').forEach(v => { v.removeAttribute('autoplay'); v.pause(); });
})();

/* ---------- Ukážky aplikácie (záložky) ---------- */
const SHOTS = {
  prehlad: ['Prehľad – čo je dôležité dnes: inzeráty, nevybavené dopyty, obhliadky a upozornenia.', 'Prehľad: počet inzerátov, nevybavené dopyty, úlohy na dnes a posledné upozornenia'],
  inzeraty: ['Inzeráty – zmena ceny zadarmo, TOP, vloženie znova po 60 dňoch a presun starých inzerátov z Bazoša.', 'Inzeráty na Bazoši s cenou, zobrazeniami, platnosťou a tlačidlami na zmenu ceny a TOP'],
  dopyty: ['Dopyty – správy záujemcov zoradené podľa inzerátu, odpoveď priamo z aplikácie.', 'Dopyty od záujemcov zoradené podľa inzerátov s možnosťou odpovedať'],
  statistiky: ['Štatistiky – zobrazenia, dopyty a obhliadky po týždňoch a pri každom inzeráte.', 'Štatistiky: dopyty a obhliadky po týždňoch a tabuľka inzerátov'],
  klienti: ['Klienti – všetci záujemcovia na jednom mieste, s poznámkami a históriou.', 'Zoznam klientov s kontaktmi, stavom a poznámkami'],
  obhliadky: ['Obhliadky – naplánujete jedným klikom a pridáte do Google Kalendára.', 'Plánovanie obhliadok s tlačidlom do Google Kalendára']
};
(function () {
  const sh = document.querySelector('.shots'); if (!sh) return;
  const bs = [...sh.querySelectorAll('.tabs button')], im = document.getElementById('shotImg'), ws = document.getElementById('shotWebp'), cap = document.getElementById('shotCap');
  bs.forEach(b => { const x = new Image(); x.src = 'img/app_' + b.dataset.i + '.jpg'; });
  function show(b) {
    const i = b.dataset.i;
    bs.forEach(x => x.setAttribute('aria-selected', x === b));
    im.style.opacity = '.3';
    setTimeout(() => { ws.srcset = 'img/app_' + i + '.webp'; im.src = 'img/app_' + i + '.jpg'; im.alt = SHOTS[i][1]; cap.textContent = SHOTS[i][0]; im.style.opacity = '1'; }, 120);
  }
  im.style.transition = 'opacity .3s';
  let t = null, stop = RM;
  const prog = () => { bs.forEach(b => b.classList.remove('run')); if (stop) return; const a = bs.find(b => b.getAttribute('aria-selected') === 'true'); if (a) { void a.offsetWidth; a.classList.add('run'); } };
  const next = () => { const i = bs.findIndex(b => b.getAttribute('aria-selected') === 'true'); show(bs[(i + 1) % bs.length]); prog(); };
  const auto = () => { clearInterval(t); if (!stop) { t = setInterval(next, 5000); prog(); } };
  bs.forEach(b => b.addEventListener('click', () => { stop = true; clearInterval(t); show(b); prog(); }));
  sh.addEventListener('pointerenter', () => { clearInterval(t); bs.forEach(b => b.classList.remove('run')); });
  sh.addEventListener('pointerleave', auto);
  new IntersectionObserver(es => es.forEach(e => e.isIntersecting ? auto() : clearInterval(t))).observe(sh);
})();

/* ---------- Cenník asistenta: mesačne / ročne ---------- */
document.querySelectorAll('.obd button').forEach(b => b.addEventListener('click', () => {
  const o = b.dataset.o;
  document.querySelectorAll('.obd button').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); });
  document.querySelectorAll('#cennik [data-m]').forEach(e => e.innerHTML = e.dataset[o]);
  document.querySelectorAll('#cennik .plan a[href*="asistent"]').forEach(a => { a.href = a.href.replace(/%20%E2%80%93%20ro%C4%8Dne/, '') + (o == 'r' ? '%20%E2%80%93%20ro%C4%8Dne' : ''); });
}));

/* ---------- Konfigurátor webu ---------- */
function wStav() {
  const f = document.getElementById('konf'); const t = f.querySelector('input[name=typ]:checked'); const c = +t.dataset.c; const a = document.getElementById('wAsist').checked;
  const e = document.getElementById('wCena'), p = document.getElementById('wPozn');
  document.getElementById('wAsR').hidden = !a; document.getElementById('wZlR').hidden = !(a && c);
  if (!c) { e.textContent = 'dohodou'; p.textContent = a ? 'zľavu 20 % na web uplatníme aj pri webe na mieru' : 'pripravíme podľa zadania'; return; }
  const k = a ? Math.round(c * 0.8) : c;
  e.innerHTML = k + ' €' + (a ? '<span class="old">' + c + ' €</span>' : '');
  p.textContent = 'jednorazovo za web';
  document.getElementById('wZl').textContent = '−' + (c - k) + ' €';
}
function wOdoslat(ev) {
  ev.preventDefault(); const f = ev.target; const d = new FormData(f); const t = f.querySelector('input[name=typ]:checked').value; const a = document.getElementById('wAsist').checked;
  const ex = d.getAll('extra');
  const L = ['Typ webu: ' + t, 'Orientačná cena: ' + document.getElementById('wCena').textContent.replace(/(\d) €(\d)/, '$1 € (pôvodne $2') + (a ? ')' : ''), 'Správa webu: 120 € ročne',
    'S Realitným asistentom – Všetky portály na rok (−20 % na web): ' + (a ? 'áno' : 'nie'), 'Čo by som chcel: ' + (ex.length ? ex.join(', ') : '—'), '',
    'Meno: ' + d.get('meno'), 'Kancelária: ' + (d.get('rk') || '—'), 'E-mail: ' + d.get('email'), 'Telefón: ' + (d.get('tel') || '—'), 'Vzorový web: ' + (d.get('vzor') || '—'), '', 'Poznámka: ' + (d.get('pozn') || '—')];
  location.href = 'mailto:info@realitnyasistent.eu?subject=' + encodeURIComponent('Návrh webu – ' + t) + '&body=' + encodeURIComponent(L.join('\n'));
  return false;
}
(function () {
  const k = document.getElementById('konf'); if (!k) return;
  k.addEventListener('change', wStav); wStav();
  /* mobil: cena stále na očiach počas vypĺňania */
  const nv = document.getElementById('navrh'), wc = document.getElementById('wCena');
  const m = document.createElement('div'); m.className = 'msum'; m.setAttribute('aria-hidden', 'true');
  m.innerHTML = '<div><small>Orientačná cena</small><b></b></div><a class="btn" href="#konf" tabindex="-1">Poslať návrh</a>'; document.body.append(m);
  const b = m.querySelector('b'), s = () => { b.textContent = wc.textContent.replace(/(\d) €(\d)/, '$1 € · pred zľavou $2'); }; s();
  new MutationObserver(s).observe(wc, { childList: true, subtree: true, characterData: true });
  m.querySelector('a').addEventListener('click', e => { e.preventDefault(); k.querySelector('button[type=submit]').scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'center' }); });
  new IntersectionObserver(es => es.forEach(e => m.classList.toggle('on', e.isIntersecting))).observe(nv);
})();

/* ---------- Jemné objavovanie obsahu ---------- */
(function () {
  if (RM || !('IntersectionObserver' in window)) return;
  document.documentElement.classList.add('js-rv');
  const els = document.querySelectorAll('main .sh, main .g3>*, main .why>*, main .feat>*, main .steps>*, main .bgrid>*, main .plans2>*, main .wgrid>*, main .ukz2>*, main .faq, main .cta, main .refbox, main .soonbox, main .wben>*, main .packs>*');
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -6% 0px' });
  els.forEach((e, i) => { e.classList.add('rv'); e.style.transitionDelay = ((i % 3) * 70) + 'ms'; io.observe(e); });
})();

/* ---------- Asistent: výber verzie v úvode ---------- */
(function () {
  const f = document.getElementById('pick'), go = document.getElementById('pickGo'); if (!f || !go) return;
  const set = () => { const r = f.querySelector('input:checked'); go.href = 'mailto:info@realitnyasistent.eu?subject=' + encodeURIComponent(r.dataset.s); };
  f.addEventListener('change', set); set();
})();

// Pred/po posuvník
document.querySelectorAll('.ba').forEach(ba => {
  const r = ba.querySelector('input');
  const set = v => { v = Math.max(0, Math.min(100, v)); ba.style.setProperty('--p', v + '%'); r.value = v; };
  const mv = e => { const b = ba.getBoundingClientRect(); set((e.clientX - b.left) / b.width * 100); };
  let d = false;
  r.addEventListener('input', () => set(+r.value));
  ba.addEventListener('pointerdown', e => { d = true; try { ba.setPointerCapture(e.pointerId); } catch (x) {} mv(e); });
  ba.addEventListener('pointermove', e => { if (d) mv(e); });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(t => ba.addEventListener(t, () => { d = false; }));
});

// odkaz ambasádora (?amb=KOD) – zapamätáme na 60 dní
(() => { try { const k = new URLSearchParams(location.search).get('amb'); if (k && /^AMB-[A-Za-z0-9]{3,20}$/.test(k)) localStorage.setItem('ra_amb', JSON.stringify({ k: k.toUpperCase(), t: Date.now() })); } catch (e) { /* nič */ } })();
