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
  prehlad: ['Přehled – co je dnes důležité: inzeráty, nevyřízené poptávky, prohlídky a upozornění.', 'Přehled: počet inzerátů, nevyřízené poptávky, úkoly na dnes a poslední upozornění'],
  inzeraty: ['Inzeráty – změna ceny, topování, obnovení inzerátu a přesun starých inzerátů do aplikace.', 'Inzeráty s cenou, zobrazeními, platností a tlačítky pro změnu ceny a topování'],
  dopyty: ['Poptávky – zprávy zájemců seřazené podle inzerátu, odpověď přímo z aplikace.', 'Poptávky od zájemců seřazené podle inzerátů s možností odpovědět'],
  statistiky: ['Statistiky – zobrazení, poptávky a prohlídky po týdnech a u každého inzerátu.', 'Statistiky: poptávky a prohlídky po týdnech a tabulka inzerátů'],
  obchody: ['Obchody – každá nemovitost krok za krokem od náboru po předání, se smlouvami a ověřením klienta.', 'Obchod: kroky od náboru po předání, doklady, strany obchodu a smlouvy'],
  zmluvy: ['Smlouvy – všechny smlouvy s číslem a stavem. Smlouvu o zprostředkování vyplníte z listu vlastnictví.', 'Seznam smluv s číslem, typem, klientem a stavem'],
  objednat: ['Objednávky – virtuální zařízení, videa a Reels objednáte v aplikaci a hotové soubory se stáhnou samy.', 'Objednávky: moje objednávky se stavem a výběr služby'],
  klienti: ['Klienti – všichni zájemci na jednom místě, s poznámkami a historií.', 'Seznam klientů s kontakty, stavem a poznámkami'],
  obhliadky: ['Prohlídky – naplánujete jedním klikem a přidáte do Google Kalendáře.', 'Plánování prohlídek s tlačítkem do Google Kalendáře']
};
(function () {
  const sh = document.querySelector('.shots'); if (!sh) return;
  const bs = [...sh.querySelectorAll('.tabs button')], im = document.getElementById('shotImg'), ws = document.getElementById('shotWebp'), cap = document.getElementById('shotCap');
  bs.forEach(b => { const x = new Image(); x.src = '../img/app_' + b.dataset.i + '.jpg'; });
  function show(b) {
    const i = b.dataset.i;
    bs.forEach(x => x.setAttribute('aria-selected', x === b));
    im.style.opacity = '.3';
    setTimeout(() => { ws.srcset = '../img/app_' + i + '.webp'; im.src = '../img/app_' + i + '.jpg'; im.alt = SHOTS[i][1]; cap.textContent = SHOTS[i][0]; im.style.opacity = '1'; }, 120);
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
  if (!c) { e.textContent = 'dohodou'; p.textContent = a ? 'slevu 20 % na web uplatníme i u webu na míru' : 'připravíme podle zadání'; return; }
  const k = a ? Math.round(c * 0.8) : c;
  const kc = (x) => String(x).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0') + '\u00a0Kč';
  const od = t.dataset.od ? 'od ' : '';
  e.innerHTML = od + kc(k) + (a ? '<span class="old">' + od + kc(c) + '</span>' : '');
  p.textContent = 'jednorázově za web';
  document.getElementById('wZl').textContent = '−' + kc(c - k);
}
function wOdoslat(ev) {
  ev.preventDefault(); const f = ev.target; const d = new FormData(f); const t = f.querySelector('input[name=typ]:checked').value; const a = document.getElementById('wAsist').checked;
  const ex = d.getAll('extra');
  const L = ['Typ webu: ' + t, 'Orientační cena: ' + document.getElementById('wCena').textContent.replace(/Kč(\d)/, 'Kč (původně $1') + (a ? ')' : ''), 'Správa webu: 2 990 Kč ročně',
    'S Realitním asistentem – Všechny portály na rok (−20 % na web): ' + (a ? 'ano' : 'ne'), 'Co bych chtěl: ' + (ex.length ? ex.join(', ') : '—'), '',
    'Jméno: ' + d.get('meno'), 'Kancelář: ' + (d.get('rk') || '—'), 'E-mail: ' + d.get('email'), 'Telefon: ' + (d.get('tel') || '—'), 'Vzorový web: ' + (d.get('vzor') || '—'), '', 'Poznámka: ' + (d.get('pozn') || '—'), '', '(česká verze webu)'];
  location.href = 'mailto:info@realitnyasistent.eu?subject=' + encodeURIComponent('Návrh webu – ' + t) + '&body=' + encodeURIComponent(L.join('\n'));
  return false;
}
(function () {
  const k = document.getElementById('konf'); if (!k) return;
  k.addEventListener('change', wStav); wStav();
  /* mobil: cena stále na očiach počas vypĺňania */
  const nv = document.getElementById('navrh'), wc = document.getElementById('wCena');
  const m = document.createElement('div'); m.className = 'msum'; m.setAttribute('aria-hidden', 'true');
  m.innerHTML = '<div><small>Orientační cena</small><b></b></div><a class="btn" href="#konf" tabindex="-1">Poslat návrh</a>'; document.body.append(m);
  const b = m.querySelector('b'), s = () => { b.textContent = wc.textContent.replace(/Kč(\d)/, 'Kč · před slevou $1'); }; s();
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
  const set = () => { const r = f.querySelector('input:checked'); go.href = 'ucet.html#registracia'; go.dataset.plan = r.dataset.s; };
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

// balíky na mobile: posúvateľný pás s bodkami, na začiatku v strede najobľúbenejší balík
(() => {
  const g = document.querySelector('.bpanel .bgrid');
  if (!g) return;
  const karty = [...g.querySelectorAll('.bcard')];
  if (karty.length < 2) return;
  const dots = document.createElement('div');
  dots.className = 'bdots';
  dots.setAttribute('aria-label', 'Přepínání balíčků');
  karty.forEach((k, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-label', 'Balíček ' + (k.querySelector('h3') ? k.querySelector('h3').textContent : i + 1));
    b.addEventListener('click', () => g.scrollTo({ left: k.offsetLeft - (g.clientWidth - k.offsetWidth) / 2, behavior: 'smooth' }));
    dots.appendChild(b);
  });
  g.after(dots);
  const oznac = () => {
    const stred = g.scrollLeft + g.clientWidth / 2;
    let naj = 0, d = Infinity;
    karty.forEach((k, i) => { const x = Math.abs(k.offsetLeft + k.offsetWidth / 2 - stred); if (x < d) { d = x; naj = i; } });
    dots.querySelectorAll('button').forEach((b, i) => b.classList.toggle('on', i === naj));
  };
  g.addEventListener('scroll', () => requestAnimationFrame(oznac), { passive: true });
  const start = () => {
    if (getComputedStyle(g).display !== 'flex') return;
    const hl = g.querySelector('.bcard.hl') || karty[1];
    g.scrollLeft = hl.offsetLeft - (g.clientWidth - hl.offsetWidth) / 2;
    oznac();
  };
  if (document.readyState === 'complete') start(); else window.addEventListener('load', start);
  oznac();
})();

// chat s pomocníkom – načíta sa až po načítaní stránky
(function () {
  function nacitaj() {
    if (document.getElementById('rac-btn')) return;
    var m = document.querySelector('script[src*="main.js"]'), v = m && m.src.split('?')[1];
    var s = document.createElement('script'); s.src = 'chat.js' + (v ? '?' + v : ''); s.defer = true; document.body.appendChild(s);
  }
  if (document.readyState === 'complete') setTimeout(nacitaj, 400); else window.addEventListener('load', function () { setTimeout(nacitaj, 400); });
})();

// ukážka Reels – prehrá sa, až keď je na obrazovke
(function () {
  var v = document.querySelector('.reels-tel video'); if (!v) return;
  if (!('IntersectionObserver' in window)) { v.preload = 'auto'; v.play().catch(function () {}); return; }
  new IntersectionObserver(function (z) { z.forEach(function (e) { if (e.isIntersecting) { v.preload = 'auto'; v.play().catch(function () {}); } else v.pause(); }); }, { threshold: 0.35 }).observe(v);
})();
