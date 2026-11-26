(() => {
  const API = 'https://ra-objednavky.rarex731.workers.dev';
  const TS_KLUC = '0x4AAAAAAGQzRVHjw4Z2OR71';
  const CENY = { vsetky: { mes: 749, rok: 7490 }, bazos: { mes: 490, rok: 4900 }, developer: { mes: 1290, rok: 12900 }, kancelaria: { mes: 649, rok: 6490 } };
  const $ = (i) => document.getElementById(i);
  const HASH0 = location.hash;  // pokracuj() mení adresu – kotvu (#kancelaria, #developer) si zapamätáme
  const ukaz = (i, a = true) => $(i).classList.toggle('hide', !a);
  const VIEWS = ['vVstup', 'vHeslo', 'vInfo', 'vApp', 'vUcet'];
  const view = (v) => VIEWS.forEach((x) => ukaz(x, x === v));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const datum = (iso) => { const [y, m, d] = String(iso || '').slice(0, 10).split('-'); return d ? `${+d}. ${+m}. ${y}` : ''; };
  const eur = (x) => (Number.isInteger(+x) ? String(+x) : (+x).toFixed(2).replace('.', ',')).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0') + ' Kč';
  const tok = { get: () => { try { return localStorage.getItem('ra_ucet') || ''; } catch { return ''; } }, set: (t) => { try { t ? localStorage.setItem('ra_ucet', t) : localStorage.removeItem('ra_ucet'); } catch { /* nič */ } } };

  // aplikácia: ucet.html?app=PORT&stav=XYZ
  const q = new URLSearchParams(location.search);
  const appPort = /^\d{4,5}$/.test(q.get('app') || '') && +q.get('app') > 1024 && +q.get('app') < 65536 ? q.get('app') : '';
  const appStav = /^[a-z0-9]{16,64}$/i.test(q.get('stav') || '') ? q.get('stav') : '';
  const preApp = !!(appPort && appStav);

  async function post(p, b = {}, s = false) {
    const h = { 'Content-Type': 'application/json' };
    if (s && tok.get()) h.Authorization = 'Bearer ' + tok.get();
    try {
      const r = await fetch(API + p + '?jazyk=cs', { method: 'POST', headers: h, body: JSON.stringify(b) });
      const j = await r.json().catch(() => ({ ok: false, chyba: 'Server neodpovídá správně. Zkuste to za chvíli.' }));
      if (j.odhlaseny) { tok.set(''); vstup(); }
      return j;
    } catch { return { ok: false, chyba: 'Spojení selhalo. Zkontrolujte internet a zkuste to znovu.' }; }
  }
  function msg(id, text, ok) { const m = $(id); m.textContent = text || ''; m.className = 'msg ' + (ok ? 'ok' : 'er') + (text ? '' : ' hide'); }
  function nadpis(h, l) { $('uNadpis').textContent = h; $('uLead').textContent = l || ''; }
  function info(h, t, tlacidla) {
    nadpis(h, ''); $('iNadpis').textContent = h; $('iText').innerHTML = t; $('iTl').innerHTML = '';
    (tlacidla || []).forEach(([text, fn, sec]) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn' + (sec ? ' sec' : ''); b.textContent = text; b.onclick = fn; $('iTl').appendChild(b); });
    view('vInfo');
  }
  const zamkni = (form, a) => form.querySelectorAll('button').forEach((b) => { b.disabled = a; });

  // ---------------- prihlásenie / registrácia
  let tsToken = '', tsId = null;
  function robot() {
    if (tsId !== null) return;
    tsId = -1;
    const sc = document.createElement('script'); sc.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; sc.async = true;
    sc.onload = () => { try { tsId = window.turnstile.render($('rTs'), { sitekey: TS_KLUC, language: 'sk', callback: (t) => { tsToken = t; }, 'expired-callback': () => { tsToken = ''; }, 'error-callback': () => { tsToken = ''; } }); } catch { tsId = null; } };
    sc.onerror = () => { tsId = null; };
    document.head.appendChild(sc);
  }
  function tab(reg) {
    $('tPrihl').classList.toggle('on', !reg); $('tReg').classList.toggle('on', reg);
    ukaz('fPrihl', !reg); ukaz('fReg', reg); msg('vMsg', '');
    nadpis(reg ? 'Vytvořte si účet' : 'Přihlášení', reg ? 'Účet je jeden pro web i aplikaci. Registrace trvá minutu.' : (preApp ? 'Přihlaste se – potom přihlásíme i aplikaci na tomto počítači.' : 'Přihlaste se do svého účtu. Stejným e-mailem a heslem se přihlásíte i do aplikace.'));
    if (reg) robot();
  }
  function vstup(reg = false) { view('vVstup'); tab(reg); google(); }
  $('tPrihl').onclick = () => tab(false);
  $('tReg').onclick = () => tab(true);

  let gNac = false;
  async function google() {
    if (gNac) return; gNac = true;
    const n = await post('/ucet/nastavenia');
    if (!n.ok || !n.google) return;
    const sc = document.createElement('script'); sc.src = 'https://accounts.google.com/gsi/client'; sc.async = true;
    sc.onload = () => {
      try {
        window.google.accounts.id.initialize({ client_id: n.google, callback: async (r) => {
          msg('vMsg', 'Přihlašujeme…', true);
          const j = await post('/ucet/google', { credential: r.credential, suhlas: true, jazyk: 'cs' });
          if (!j.ok) return msg('vMsg', j.chyba);
          tok.set(j.token); pokracuj();
        }, ux_mode: 'popup' });
        window.google.accounts.id.renderButton($('gBtn'), { theme: 'outline', size: 'large', text: 'continue_with', shape: 'pill', locale: 'sk', width: 300 });
        ukaz('gWrap');
      } catch { /* bez Google */ }
    };
    document.head.appendChild(sc);
  }

  $('fPrihl').addEventListener('submit', async (e) => {
    e.preventDefault(); msg('vMsg', '');
    const email = $('pEmail').value.trim(), heslo = $('pHeslo').value;
    if (!email || !heslo) return msg('vMsg', 'Zadajte e-mail a heslo.');
    zamkni(e.target, true);
    const j = await post('/ucet/prihlas', { email, heslo });
    zamkni(e.target, false);
    if (!j.ok) {
      msg('vMsg', j.chyba);
      if (j.neovereny) {
        const a = document.createElement('a'); a.href = '#'; a.className = 'link'; a.textContent = ' Poslat potvrzení znovu';
        a.onclick = async (ev) => { ev.preventDefault(); await post('/ucet/overenie-znova', { email }); msg('vMsg', 'Pokud účet existuje, poslali jsme nový odkaz pro potvrzení.', true); };
        $('vMsg').appendChild(a);
      }
      return;
    }
    tok.set(j.token); pokracuj();
  });
  $('pZabudol').addEventListener('click', async (e) => {
    e.preventDefault();
    const email = $('pEmail').value.trim();
    if (!email) { msg('vMsg', 'Napište svůj e-mail do pole výše a klikněte znovu na Zapomněli jste heslo.'); $('pEmail').focus(); return; }
    const j = await post('/ucet/zabudnute', { email });
    msg('vMsg', j.ok ? 'Pokud k tomuto e-mailu existuje účet, poslali jsme na něj odkaz pro nastavení hesla. Podívejte se i do složky spam.' : j.chyba, j.ok);
  });
  $('fReg').addEventListener('submit', async (e) => {
    e.preventDefault(); msg('vMsg', '');
    const d = { meno: $('rMeno').value.trim(), email: $('rEmail').value.trim(), heslo: $('rHeslo').value, telefon: $('rTel').value.trim(),
      firma: $('rFirma').value.trim(), ico: $('rIco').value.trim(), dic: $('rDic').value.trim(), adresa: $('rAdresa').value.trim(), suhlas: $('rSuhlas').checked, ts: tsToken };
    if (!d.meno || !d.email) return msg('vMsg', 'Vyplňte jméno a e-mail.');
    if (d.heslo.length < 8) return msg('vMsg', 'Heslo musí mít alespoň 8 znaků.');
    if (!d.suhlas) return msg('vMsg', 'Potvrďte souhlas s obchodními podmínkami.');
    zamkni(e.target, true);
    const j = await post('/ucet/registracia', { ...d, jazyk: 'cs' });
    zamkni(e.target, false);
    try { if (tsId !== null && tsId !== -1) window.turnstile.reset(tsId); tsToken = ''; } catch { /* nič */ }
    if (!j.ok) return msg('vMsg', j.chyba);
    try { sessionStorage.setItem('ra_app', preApp ? location.search : ''); } catch { /* nič */ }
    info('Potvrďte svůj e-mail', `Na adresu <b>${esc(d.email)}</b> jsme poslali odkaz pro potvrzení. Klikněte na něj a hned se dostanete do svého účtu. Nenašli jste e-mail? Podívejte se i do složky spam nebo hromadné.`,
      [['Poslat znovu', async () => { await post('/ucet/overenie-znova', { email: d.email }); $('iText').innerHTML += '<br><br><b>Poslali jsme nový odkaz.</b>'; }, true]]);
  });

  // ---------------- nové heslo
  let hesloTok = '';
  $('fHeslo').addEventListener('submit', async (e) => {
    e.preventDefault();
    const heslo = $('hNove').value;
    if (heslo.length < 8) return msg('hMsg', 'Heslo musí mít alespoň 8 znaků.');
    zamkni(e.target, true);
    const j = await post('/ucet/heslo', { token: hesloTok, heslo });
    zamkni(e.target, false);
    if (!j.ok) return msg('hMsg', j.chyba);
    tok.set(j.token); pokracuj('Heslo je uložené. Stejným heslem se přihlásíte i v aplikaci.');
  });

  // ---------------- prihlásenie aplikácie
  async function appKrok(email) {
    nadpis('Přihlášení aplikace', '');
    $('aEmail').textContent = email || ''; view('vApp');
  }
  $('aPotvrd').onclick = async () => {
    msg('aMsg', 'Přihlašujeme…', true);
    const j = await post('/ucet/app-kod', {}, true);
    if (!j.ok) return msg('aMsg', j.chyba || 'Nepodařilo se.');
    location.href = `http://127.0.0.1:${appPort}/prihlasenie?kod=${encodeURIComponent(j.kod)}&stav=${encodeURIComponent(appStav)}`;
    setTimeout(() => msg('aMsg', 'Hotovo – vraťte se do aplikace. Pokud se nic nestalo, zkontrolujte, zda je aplikace spuštěná, a zkuste to znovu.', true), 1500);
  };
  $('aIny').onclick = async () => { await post('/ucet/odhlas', {}, true); tok.set(''); vstup(); };

  // ---------------- účet (dashboard)
  let U = null;
  async function pokracuj(sprava) {
    let a = '';
    try { a = sessionStorage.getItem('ra_app') || ''; sessionStorage.removeItem('ra_app'); } catch { /* nič */ }
    if (a && !preApp) { location.replace('ucet.html' + a); return; }
    history.replaceState(null, '', location.pathname + location.search);
    await nacitaj();
    if (!U) return;
    if (preApp) return appKrok(U.ucet.email);
    if (sprava) msg('oMsg', sprava, true);
  }
  async function nacitaj() {
    const j = await post('/ucet/ja', {}, true);
    if (!j.ok) { if (!j.odhlaseny) info('Účet se nepodařilo načíst', esc(j.chyba || ''), [['Zkusit znovu', nacitaj]]); U = null; return; }
    U = j; vykresli();
  }
  function vykresli() {
    const u = U.ucet, l = U.licencia;
    nadpis('Můj účet', (u.meno ? u.meno + ' · ' : '') + u.email);
    $('dEmail').textContent = u.email;
    let st, txt = '';
    if (l.stav === 'aktivna') { st = `<span class="stav s-ok">Aktivní</span> ${esc({ 'Všetky portály': 'Všechny portály', 'Kancelária': 'Kancelář' }[l.plan_nazov] || l.plan_nazov)}`; txt = `Platí do ${datum(l.platna_do)}. Před koncem vám pošleme e-mail s prodloužením.`; }
    else if (l.stav === 'skusobna') { st = `<span class="stav s-sk">Zkušební doba</span> všechny funkce`; txt = `Aplikaci můžete používat do ${datum(l.skusobna_do)} (${l.zostava_dni} ${l.zostava_dni === 1 ? 'den' : l.zostava_dni < 5 ? 'dny' : 'dní'}). Potom si objednejte předplatné.`; }
    else if (l.stav === 'vyprsana') { st = '<span class="stav s-zle">Vypršelo</span>'; txt = `Předplatné platilo do ${datum(l.platna_do)}. Objednejte si prodloužení.`; }
    else if (l.stav === 'zrusena') { st = '<span class="stav s-zle">Zrušeno</span>'; txt = 'Pokud jde o omyl, napište nám.'; }
    else { st = '<span class="stav s-zle">Bez předplatného</span>'; txt = 'Zkušební doba skončila. Objednejte si předplatné a aplikace se hned odemkne.'; }
    $('dStav').innerHTML = st; $('dStavT').textContent = txt;
    $('dObjBtn').textContent = l.stav === 'aktivna' ? 'Prodloužit nebo změnit' : 'Objednat předplatné';
    const s = U.stiahnut || {};
    $('dStiahni').innerHTML = [['win', 'Windows'], ['apple', 'Mac (čip Apple M1–M4)'], ['intel', 'Mac (Intel)']].filter(([k]) => s[k]).map(([k, t], i) => `<a class="btn${i ? ' sec' : ''} sm" href="${esc(s[k])}">${t}</a>`).join('');
    $('dApp').innerHTML = U.aplikacia ? `Aplikace je přihlášená na počítači <b>${esc(U.aplikacia.popis || 'bez názvu')}</b> (naposledy ${new Date(U.aplikacia.posledna).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}). <a href="#" class="link" id="dOdApp">Odhlásit tento počítač</a>` : '<span class="mut">Aplikace zatím není přihlášená na žádném počítači.</span>';
    if ($('dOdApp')) $('dOdApp').onclick = async (e) => { e.preventDefault(); if (!confirm('Odhlásit aplikaci na tom počítači?')) return; await post('/ucet/odhlas-aplikaciu', {}, true); nacitaj(); };
    const ST = { nova: 'přijatá', caka_platbu: 'čeká na platbu', v_procese: 'zpracovává se', hotova: 'vyřízená', dodana: 'vyřízená' };
    $('dObj').innerHTML = U.objednavky.length ? `<table><thead><tr><th>Číslo</th><th>Datum</th><th>Služba</th><th>Cena</th><th>Stav</th></tr></thead><tbody>${U.objednavky.map((o) => `<tr><td><a class="link" href="${esc(o.stav_url)}">${esc(o.cislo)}</a></td><td>${datum(o.datum)}</td><td>${esc(o.popis)}</td><td>${o.mena === 'EUR' ? String(o.cena).replace('.', ',') + ' €' : eur(o.cena)}</td><td>${o.zaplatene ? 'zaplacená' : ''}${o.zaplatene && ST[o.stav] ? ', ' : ''}${ST[o.stav] || (o.zaplatene ? '' : esc(o.stav))}</td></tr>`).join('')}</tbody></table>` : '<p class="mut" style="margin:0">Zatím žádné objednávky.</p>';
    ['Meno', 'Tel', 'Firma', 'Ico', 'Dic', 'Adresa'].forEach((k) => { $('u' + k).value = u[{ Meno: 'meno', Tel: 'telefon', Firma: 'firma', Ico: 'ico', Dic: 'dic', Adresa: 'adresa' }[k]] || ''; });
    ukaz('zStareW', U.ma_heslo); $('zNad').textContent = U.ma_heslo ? 'Změna hesla' : 'Nastavit heslo pro aplikaci';
    view('vUcet');
    if (!window._hashObj && ['#kancelaria', '#developer'].includes(HASH0)) { window._hashObj = 1; $('dObjBtn').click(); $('fObj').scrollIntoView({ block: 'center' }); }
  }
  function ceny() {
    const p = document.querySelector('input[name=plan]:checked').value, n = p === 'kancelaria' ? miesta() : 1, c = { mes: CENY[p].mes * n, rok: CENY[p].rok * n };
    ukaz('oMiestaW', p === 'kancelaria');
    $('cMes').textContent = `${eur(c.mes)} měsíčně`; $('cRok').textContent = `${eur(c.rok)} ročně`; $('cRokS').textContent = eur(c.mes * 12);
  }
  const miesta = () => Math.min(50, Math.max(3, Math.round(Number($('oMiesta').value) || 3)));
  document.querySelectorAll('input[name=plan]').forEach((r) => r.addEventListener('change', ceny));
  $('oMiesta').addEventListener('input', ceny);
  $('oMiesta').addEventListener('change', () => { $('oMiesta').value = miesta(); ceny(); });
  $('dObjBtn').onclick = () => { ukaz('fObj'); ceny(); if (U && ['bazos', 'developer', 'kancelaria'].includes(U.licencia.plan) && U.licencia.stav === 'aktivna') document.querySelector(`input[name=plan][value=${U.licencia.plan}]`).checked = true; if (U && U.licencia.plan === 'kancelaria' && U.licencia.miesta) $('oMiesta').value = U.licencia.miesta; if (['#developer', '#kancelaria'].includes(HASH0)) document.querySelector(`input[name=plan][value=${HASH0.slice(1)}]`).checked = true; ceny(); };
  $('oZrus').onclick = () => ukaz('fObj', false);
  $('fObj').addEventListener('submit', async (e) => {
    e.preventDefault(); msg('oMsg', '');
    if (!$('oSuhlas').checked) return msg('oMsg', 'Potvrďte souhlas s obchodními podmínkami.');
    const plan = document.querySelector('input[name=plan]:checked').value, obdobie = document.querySelector('input[name=obd]:checked').value;
    zamkni(e.target, true);
    const j = await post('/ucet/objednat', { plan, obdobie, miesta: plan === 'kancelaria' ? miesta() : undefined, kod: $('oKod').value.trim(), suhlas: true, jazyk: 'cs' }, true);
    zamkni(e.target, false);
    if (!j.ok) return msg('oMsg', j.chyba);
    if (j.platba_url) { location.href = j.platba_url; return; }
    ukaz('fObj', false);
    msg('oMsg', `Děkujeme, objednávka ${j.cislo} je přijatá (${eur(j.cena)}). Fakturu vám pošleme e-mailem – po zaplacení se předplatné zapne samo.`, true);
    nacitaj();
  });
  $('fUdaje').addEventListener('submit', async (e) => {
    e.preventDefault();
    const j = await post('/ucet/uloz', { meno: $('uMeno').value, telefon: $('uTel').value, firma: $('uFirma').value, ico: $('uIco').value, dic: $('uDic').value, adresa: $('uAdresa').value }, true);
    msg('uMsg', j.ok ? 'Údaje jsou uložené.' : j.chyba, j.ok);
  });
  $('fZmena').addEventListener('submit', async (e) => {
    e.preventDefault();
    if ($('zNove').value.length < 8) return msg('zMsg', 'Nové heslo musí mít alespoň 8 znaků.');
    const j = await post('/ucet/heslo-zmen', { stare: $('zStare').value, nove: $('zNove').value }, true);
    msg('zMsg', j.ok ? 'Heslo je změněné. Na ostatních zařízeních se přihlásíte novým heslem.' : j.chyba, j.ok);
    if (j.ok) { $('zStare').value = ''; $('zNove').value = ''; U.ma_heslo = true; ukaz('zStareW', true); }
  });
  $('dOdhlas').onclick = async () => { await post('/ucet/odhlas', {}, true); tok.set(''); vstup(); };

  // ---------------- štart
  async function start() {
    const h = new URLSearchParams(location.hash.slice(1));
    if (h.get('over')) {
      nadpis('Potvrzujeme e-mail…', '');
      const j = await post('/ucet/over', { token: h.get('over') });
      history.replaceState(null, '', location.pathname + location.search);
      if (!j.ok) return info('Odkaz už neplatí', esc(j.chyba), [['Přihlásit se', () => vstup()]]);
      tok.set(j.token); return pokracuj('E-mail je potvrzený, vítejte! Stáhněte si aplikaci a přihlaste se v ní stejným e-mailem a heslem.');
    }
    if (h.get('heslo')) { hesloTok = h.get('heslo'); history.replaceState(null, '', location.pathname + location.search); nadpis('Nové heslo', ''); return view('vHeslo'); }
    if (location.hash === '#registracia') return vstup(true);
    if (tok.get()) { await pokracuj(); if (U) return; }
    vstup();
  }
  start();
})();
