(() => {
  const API = 'https://ra-objednavky.rarex731.workers.dev';
  const TS_KLUC = '0x4AAAAAAGQzRVHjw4Z2OR71';
  const CENY = { vsetky: { mes: 29, rok: 290 }, bazos: { mes: 19, rok: 190 }, developer: { mes: 49, rok: 490 } };
  const $ = (i) => document.getElementById(i);
  const ukaz = (i, a = true) => $(i).classList.toggle('hide', !a);
  const VIEWS = ['vVstup', 'vHeslo', 'vInfo', 'vApp', 'vUcet'];
  const view = (v) => VIEWS.forEach((x) => ukaz(x, x === v));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const datum = (iso) => { const [y, m, d] = String(iso || '').slice(0, 10).split('-'); return d ? `${+d}. ${+m}. ${y}` : ''; };
  const eur = (x) => (Number.isInteger(+x) ? String(+x) : (+x).toFixed(2).replace('.', ',')) + ' €';
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
      const r = await fetch(API + p, { method: 'POST', headers: h, body: JSON.stringify(b) });
      const j = await r.json().catch(() => ({ ok: false, chyba: 'Server neodpovedá správne. Skúste to o chvíľu.' }));
      if (j.odhlaseny) { tok.set(''); vstup(); }
      return j;
    } catch { return { ok: false, chyba: 'Spojenie zlyhalo. Skontrolujte internet a skúste to znova.' }; }
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
    nadpis(reg ? 'Vytvorte si účet' : 'Prihlásenie', reg ? 'Účet je jeden pre web aj aplikáciu. Registrácia trvá minútu.' : (preApp ? 'Prihláste sa – potom prihlásime aj aplikáciu na tomto počítači.' : 'Prihláste sa do svojho účtu. Tým istým e-mailom a heslom sa prihlásite aj do aplikácie.'));
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
          msg('vMsg', 'Prihlasujeme…', true);
          const j = await post('/ucet/google', { credential: r.credential, suhlas: true });
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
        const a = document.createElement('a'); a.href = '#'; a.className = 'link'; a.textContent = ' Poslať potvrdenie znova';
        a.onclick = async (ev) => { ev.preventDefault(); await post('/ucet/overenie-znova', { email }); msg('vMsg', 'Ak účet existuje, poslali sme nový odkaz na potvrdenie.', true); };
        $('vMsg').appendChild(a);
      }
      return;
    }
    tok.set(j.token); pokracuj();
  });
  $('pZabudol').addEventListener('click', async (e) => {
    e.preventDefault();
    const email = $('pEmail').value.trim();
    if (!email) { msg('vMsg', 'Napíšte svoj e-mail do poľa vyššie a kliknite znova na Zabudli ste heslo.'); $('pEmail').focus(); return; }
    const j = await post('/ucet/zabudnute', { email });
    msg('vMsg', j.ok ? 'Ak k tomuto e-mailu existuje účet, poslali sme naň odkaz na nastavenie hesla. Pozrite aj priečinok spam.' : j.chyba, j.ok);
  });
  $('fReg').addEventListener('submit', async (e) => {
    e.preventDefault(); msg('vMsg', '');
    const d = { meno: $('rMeno').value.trim(), email: $('rEmail').value.trim(), heslo: $('rHeslo').value, telefon: $('rTel').value.trim(),
      firma: $('rFirma').value.trim(), ico: $('rIco').value.trim(), dic: $('rDic').value.trim(), adresa: $('rAdresa').value.trim(), suhlas: $('rSuhlas').checked, ts: tsToken };
    if (!d.meno || !d.email) return msg('vMsg', 'Vyplňte meno a e-mail.');
    if (d.heslo.length < 8) return msg('vMsg', 'Heslo musí mať aspoň 8 znakov.');
    if (!d.suhlas) return msg('vMsg', 'Potvrďte súhlas s obchodnými podmienkami.');
    zamkni(e.target, true);
    const j = await post('/ucet/registracia', d);
    zamkni(e.target, false);
    try { if (tsId !== null && tsId !== -1) window.turnstile.reset(tsId); tsToken = ''; } catch { /* nič */ }
    if (!j.ok) return msg('vMsg', j.chyba);
    try { sessionStorage.setItem('ra_app', preApp ? location.search : ''); } catch { /* nič */ }
    info('Potvrďte svoj e-mail', `Na adresu <b>${esc(d.email)}</b> sme poslali odkaz na potvrdenie. Kliknite naň a hneď sa dostanete do svojho účtu. Nenašli ste e-mail? Pozrite aj priečinok spam alebo propagácie.`,
      [['Poslať znova', async () => { await post('/ucet/overenie-znova', { email: d.email }); $('iText').innerHTML += '<br><br><b>Poslali sme nový odkaz.</b>'; }, true]]);
  });

  // ---------------- nové heslo
  let hesloTok = '';
  $('fHeslo').addEventListener('submit', async (e) => {
    e.preventDefault();
    const heslo = $('hNove').value;
    if (heslo.length < 8) return msg('hMsg', 'Heslo musí mať aspoň 8 znakov.');
    zamkni(e.target, true);
    const j = await post('/ucet/heslo', { token: hesloTok, heslo });
    zamkni(e.target, false);
    if (!j.ok) return msg('hMsg', j.chyba);
    tok.set(j.token); pokracuj('Heslo je uložené. Rovnakým heslom sa prihlásite aj v aplikácii.');
  });

  // ---------------- prihlásenie aplikácie
  async function appKrok(email) {
    nadpis('Prihlásenie aplikácie', '');
    $('aEmail').textContent = email || ''; view('vApp');
  }
  $('aPotvrd').onclick = async () => {
    msg('aMsg', 'Prihlasujeme…', true);
    const j = await post('/ucet/app-kod', {}, true);
    if (!j.ok) return msg('aMsg', j.chyba || 'Nepodarilo sa.');
    location.href = `http://127.0.0.1:${appPort}/prihlasenie?kod=${encodeURIComponent(j.kod)}&stav=${encodeURIComponent(appStav)}`;
    setTimeout(() => msg('aMsg', 'Hotovo – vráťte sa do aplikácie. Ak sa nič nestalo, skontrolujte, či je aplikácia spustená, a skúste to znova.', true), 1500);
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
    if (!j.ok) { if (!j.odhlaseny) info('Účet sa nepodarilo načítať', esc(j.chyba || ''), [['Skúsiť znova', nacitaj]]); U = null; return; }
    U = j; vykresli();
  }
  function vykresli() {
    const u = U.ucet, l = U.licencia;
    nadpis('Môj účet', (u.meno ? u.meno + ' · ' : '') + u.email);
    $('dEmail').textContent = u.email;
    let st, txt = '';
    if (l.stav === 'aktivna') { st = `<span class="stav s-ok">Aktívne</span> ${esc(l.plan_nazov)}`; txt = `Platí do ${datum(l.platna_do)}. Pred koncom vám pošleme e-mail s predĺžením.`; }
    else if (l.stav === 'skusobna') { st = `<span class="stav s-sk">Skúšobná doba</span> všetky funkcie`; txt = `Aplikáciu môžete používať do ${datum(l.skusobna_do)} (${l.zostava_dni} ${l.zostava_dni === 1 ? 'deň' : l.zostava_dni < 5 ? 'dni' : 'dní'}). Potom si objednajte predplatné.`; }
    else if (l.stav === 'vyprsana') { st = '<span class="stav s-zle">Vypršalo</span>'; txt = `Predplatné platilo do ${datum(l.platna_do)}. Objednajte si predĺženie.`; }
    else if (l.stav === 'zrusena') { st = '<span class="stav s-zle">Zrušené</span>'; txt = 'Ak ide o omyl, napíšte nám.'; }
    else { st = '<span class="stav s-zle">Bez predplatného</span>'; txt = 'Skúšobná doba skončila. Objednajte si predplatné a aplikácia sa hneď odomkne.'; }
    $('dStav').innerHTML = st; $('dStavT').textContent = txt;
    $('dObjBtn').textContent = l.stav === 'aktivna' ? 'Predĺžiť alebo zmeniť' : 'Objednať predplatné';
    const s = U.stiahnut || {};
    $('dStiahni').innerHTML = [['win', 'Windows'], ['apple', 'Mac (Apple čip M1–M4)'], ['intel', 'Mac (Intel)']].filter(([k]) => s[k]).map(([k, t], i) => `<a class="btn${i ? ' sec' : ''} sm" href="${esc(s[k])}">${t}</a>`).join('');
    $('dApp').innerHTML = U.aplikacia ? `Aplikácia je prihlásená na počítači <b>${esc(U.aplikacia.popis || 'bez názvu')}</b> (naposledy ${new Date(U.aplikacia.posledna).toLocaleString('sk-SK', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}). <a href="#" class="link" id="dOdApp">Odhlásiť tento počítač</a>` : '<span class="mut">Aplikácia zatiaľ nie je prihlásená na žiadnom počítači.</span>';
    if ($('dOdApp')) $('dOdApp').onclick = async (e) => { e.preventDefault(); if (!confirm('Odhlásiť aplikáciu na tom počítači?')) return; await post('/ucet/odhlas-aplikaciu', {}, true); nacitaj(); };
    const ST = { nova: 'prijatá', caka_platbu: 'čaká na platbu', v_procese: 'spracúva sa', hotova: 'vybavená', dodana: 'vybavená' };
    $('dObj').innerHTML = U.objednavky.length ? `<table><thead><tr><th>Číslo</th><th>Dátum</th><th>Služba</th><th>Cena</th><th>Stav</th></tr></thead><tbody>${U.objednavky.map((o) => `<tr><td><a class="link" href="${esc(o.stav_url)}">${esc(o.cislo)}</a></td><td>${datum(o.datum)}</td><td>${esc(o.popis)}</td><td>${o.mena === 'CZK' ? Math.round(o.cena) + ' Kč' : eur(o.cena)}</td><td>${o.zaplatene ? 'zaplatená' : ''}${o.zaplatene && ST[o.stav] ? ', ' : ''}${ST[o.stav] || (o.zaplatene ? '' : esc(o.stav))}</td></tr>`).join('')}</tbody></table>` : '<p class="mut" style="margin:0">Zatiaľ žiadne objednávky.</p>';
    ['Meno', 'Tel', 'Firma', 'Ico', 'Dic', 'Adresa'].forEach((k) => { $('u' + k).value = u[{ Meno: 'meno', Tel: 'telefon', Firma: 'firma', Ico: 'ico', Dic: 'dic', Adresa: 'adresa' }[k]] || ''; });
    ukaz('zStareW', U.ma_heslo); $('zNad').textContent = U.ma_heslo ? 'Zmena hesla' : 'Nastaviť heslo pre aplikáciu';
    view('vUcet');
  }
  function ceny() {
    const p = document.querySelector('input[name=plan]:checked').value, c = CENY[p];
    $('cMes').textContent = `${c.mes} € mesačne`; $('cRok').textContent = `${c.rok} € ročne`; $('cRokS').textContent = `${c.mes * 12} €`;
  }
  document.querySelectorAll('input[name=plan]').forEach((r) => r.addEventListener('change', ceny));
  $('dObjBtn').onclick = () => { ukaz('fObj'); ceny(); if (U && ['bazos', 'developer'].includes(U.licencia.plan) && U.licencia.stav === 'aktivna') document.querySelector(`input[name=plan][value=${U.licencia.plan}]`).checked = true; if (location.hash === '#developer') document.querySelector('input[name=plan][value=developer]').checked = true; ceny(); };
  $('oZrus').onclick = () => ukaz('fObj', false);
  $('fObj').addEventListener('submit', async (e) => {
    e.preventDefault(); msg('oMsg', '');
    if (!$('oSuhlas').checked) return msg('oMsg', 'Potvrďte súhlas s obchodnými podmienkami.');
    const plan = document.querySelector('input[name=plan]:checked').value, obdobie = document.querySelector('input[name=obd]:checked').value;
    zamkni(e.target, true);
    const j = await post('/ucet/objednat', { plan, obdobie, kod: $('oKod').value.trim(), suhlas: true }, true);
    zamkni(e.target, false);
    if (!j.ok) return msg('oMsg', j.chyba);
    if (j.platba_url) { location.href = j.platba_url; return; }
    ukaz('fObj', false);
    msg('oMsg', `Ďakujeme, objednávka ${j.cislo} je prijatá (${eur(j.cena)}). Faktúru vám pošleme e-mailom – po zaplatení sa predplatné zapne samo.`, true);
    nacitaj();
  });
  $('fUdaje').addEventListener('submit', async (e) => {
    e.preventDefault();
    const j = await post('/ucet/uloz', { meno: $('uMeno').value, telefon: $('uTel').value, firma: $('uFirma').value, ico: $('uIco').value, dic: $('uDic').value, adresa: $('uAdresa').value }, true);
    msg('uMsg', j.ok ? 'Údaje sú uložené.' : j.chyba, j.ok);
  });
  $('fZmena').addEventListener('submit', async (e) => {
    e.preventDefault();
    if ($('zNove').value.length < 8) return msg('zMsg', 'Nové heslo musí mať aspoň 8 znakov.');
    const j = await post('/ucet/heslo-zmen', { stare: $('zStare').value, nove: $('zNove').value }, true);
    msg('zMsg', j.ok ? 'Heslo je zmenené. Na ostatných zariadeniach sa prihlásite novým heslom.' : j.chyba, j.ok);
    if (j.ok) { $('zStare').value = ''; $('zNove').value = ''; U.ma_heslo = true; ukaz('zStareW', true); }
  });
  $('dOdhlas').onclick = async () => { await post('/ucet/odhlas', {}, true); tok.set(''); vstup(); };

  // ---------------- štart
  async function start() {
    const h = new URLSearchParams(location.hash.slice(1));
    if (h.get('over')) {
      nadpis('Potvrdzujeme e-mail…', '');
      const j = await post('/ucet/over', { token: h.get('over') });
      history.replaceState(null, '', location.pathname + location.search);
      if (!j.ok) return info('Odkaz už neplatí', esc(j.chyba), [['Prihlásiť sa', () => vstup()]]);
      tok.set(j.token); return pokracuj('E-mail je potvrdený, vitajte! Stiahnite si aplikáciu a prihláste sa v nej rovnakým e-mailom a heslom.');
    }
    if (h.get('heslo')) { hesloTok = h.get('heslo'); history.replaceState(null, '', location.pathname + location.search); nadpis('Nové heslo', ''); return view('vHeslo'); }
    if (location.hash === '#registracia') return vstup(true);
    if (tok.get()) { await pokracuj(); if (U) return; }
    vstup();
  }
  start();
})();
