/* Realitný asistent – okno chatu (web aj aplikácia)
   Nastavenie: window.RA_CHAT = { api, zdroj: 'web'|'aplikacia', objednat: url alebo funkcia, sukromie: url } */
(function () {
  'use strict';
  if (window.__raChat) return; window.__raChat = true;
  var C = Object.assign({
    api: 'https://ra-objednavky.rarex731.workers.dev',
    zdroj: 'web',
    objednat: 'objednavka',
    sukromie: 'sukromie#pomocnik',
    otvorene: false
  }, window.RA_CHAT || {});
  var KLUC = 'ra_chat_v1';
  var UVOD = 'Dobrý deň! Som automatický pomocník Realitného asistenta. Poradím vám s cenami, službami a objednávkou. Na čo sa chcete opýtať?';
  var RYCHLE = C.zdroj === 'aplikacia'
    ? ['Ako presuniem inzeráty na Bazoš API?', 'Ako objednám virtuálne zariadenie?', 'Koľko stojí video?']
    : ['Koľko stojí video?', 'Ako funguje virtuálne zariadenie?', 'Čo obsahuje balík Profi?'];

  // ---------- štýly ----------
  var css = '' +
  '#rac-btn{position:fixed;right:20px;bottom:20px;z-index:2147483000;width:58px;height:58px;border-radius:50%;border:0;cursor:pointer;display:grid;place-items:center;color:#fff;background:linear-gradient(135deg,#8B3DF0,#6A22D8);box-shadow:0 10px 28px -6px rgba(106,34,216,.55),0 2px 6px rgba(0,0,0,.12);transition:transform .2s ease,opacity .2s ease;-webkit-tap-highlight-color:transparent}' +
  '#rac-btn:hover{transform:translateY(-2px) scale(1.04)}#rac-btn:focus-visible{outline:3px solid #CDB8F7;outline-offset:3px}' +
  '#rac-btn svg{width:26px;height:26px}#rac-btn.rac-skry{opacity:0;pointer-events:none;transform:scale(.8)}' +
  '#rac-tip{position:fixed;right:88px;bottom:31px;z-index:2147483000;background:#fff;color:#202436;font:600 14px/1 Inter,system-ui,sans-serif;padding:10px 14px;border-radius:999px;box-shadow:0 8px 24px rgba(32,36,54,.16);cursor:pointer;white-space:nowrap;animation:racIn .35s ease both}' +
  '#rac-tip b{color:#7728E6}@media(max-width:700px){#rac-tip{display:none}}' +
  '#rac{margin:0;padding:0;border:0;text-align:left;letter-spacing:normal;position:fixed;right:20px;bottom:90px;z-index:2147483001;width:380px;height:min(620px,calc(100vh - 120px));display:flex;flex-direction:column;background:#fff;border-radius:20px;box-shadow:0 24px 70px -12px rgba(32,36,54,.35),0 0 0 1px rgba(32,36,54,.06);overflow:hidden;font:15px/1.5 Inter,system-ui,-apple-system,Segoe UI,sans-serif;color:#202436;animation:racIn .22s ease both}' +
  '#rac[hidden]{display:none}@keyframes racIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}' +
  '#rac *{box-sizing:border-box}#rac p,#rac ul{max-width:none}#rac button{margin:0}' +
  '.rac-h{display:flex;align-items:center;gap:11px;padding:14px 14px 14px 16px;background:linear-gradient(135deg,#8B3DF0,#6A22D8);color:#fff;flex:none}' +
  '.rac-av{width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,.18);display:grid;place-items:center;flex:none}.rac-av svg{width:21px;height:21px}' +
  '.rac-t{flex:1;min-width:0}.rac-t b{display:block;font-size:15.5px;line-height:1.2}.rac-t span{font-size:12.5px;opacity:.85;display:flex;align-items:center;gap:6px}.rac-t span:before{content:"";width:7px;height:7px;border-radius:50%;background:#6CE9A6}' +
  '.rac-x{width:36px;height:36px;border-radius:10px;border:0;background:transparent;color:#fff;cursor:pointer;display:grid;place-items:center}.rac-x:hover{background:rgba(255,255,255,.15)}.rac-x svg{width:20px;height:20px}' +
  '.rac-m{flex:1;overflow-y:auto;padding:16px 14px 8px;background:#F7F7FB;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}' +
  '.rac-s{display:flex;margin:0 0 10px}.rac-s.u{justify-content:flex-end}' +
  '.rac-b{max-width:86%;padding:10px 13px;border-radius:16px;word-wrap:break-word;overflow-wrap:anywhere;font-size:14.5px}' +
  '.rac-s.a .rac-b{background:#fff;border:1px solid #ECEDF3;border-bottom-left-radius:6px}.rac-s.u .rac-b{background:#7728E6;color:#fff;border-bottom-right-radius:6px;white-space:pre-wrap}' +
  '.rac-b p{margin:0 0 6px}.rac-b p:last-child{margin:0}.rac-b ul{margin:4px 0 6px;padding-left:18px}.rac-b li{margin:2px 0}.rac-b a{color:#7728E6;font-weight:600}.rac-b strong{font-weight:700}' +
  '.rac-ak{display:flex;flex-wrap:wrap;gap:6px;margin:-2px 0 12px}' +
  '.rac-chip,.rac-ab{font:600 13.5px/1.2 inherit;font-family:inherit;border-radius:999px;padding:8px 13px;cursor:pointer;text-decoration:none;border:1.5px solid #DCCBFA;background:#fff;color:#6A22D8;text-align:left}' +
  '.rac-chip:hover,.rac-ab:hover{background:#F5EFFF}.rac-ab.p{background:#7728E6;border-color:#7728E6;color:#fff}.rac-ab.p:hover{background:#6A22D8}' +
  '.rac-dots{display:inline-flex;gap:4px;padding:4px 2px}.rac-dots i{width:7px;height:7px;border-radius:50%;background:#B9A6E8;animation:racD 1.2s infinite}.rac-dots i:nth-child(2){animation-delay:.15s}.rac-dots i:nth-child(3){animation-delay:.3s}' +
  '@keyframes racD{0%,60%,100%{opacity:.35;transform:none}30%{opacity:1;transform:translateY(-3px)}}' +
  '.rac-f{flex:none;padding:10px 12px 8px;border-top:1px solid #ECEDF3;background:#fff}' +
  '.rac-in{display:flex;align-items:flex-end;gap:8px;border:1.5px solid #E2E4EC;border-radius:14px;padding:6px 6px 6px 12px;background:#fff}.rac-in:focus-within{border-color:#A57CF2}' +
  '.rac-in textarea{flex:1;border:0;outline:0;resize:none;font:15px/1.45 inherit;font-family:inherit;color:#202436;max-height:110px;padding:6px 0;background:transparent}' +
  '.rac-go{width:38px;height:38px;flex:none;border:0;border-radius:10px;background:#7728E6;color:#fff;cursor:pointer;display:grid;place-items:center}.rac-go:disabled{background:#D0D5DD;cursor:default}.rac-go svg{width:18px;height:18px}' +
  '.rac-pozn{font-size:11.5px;color:#8A90A2;text-align:center;margin-top:6px;line-height:1.35}.rac-pozn a{color:#8A90A2}' +
  '.rac-k{background:#fff;border:1px solid #ECEDF3;border-radius:16px;padding:14px;margin:0 0 12px}.rac-k b{display:block;margin-bottom:2px}.rac-k p{margin:0 0 10px;font-size:13.5px;color:#667085}' +
  '.rac-k input,.rac-k textarea{width:100%;font:14.5px/1.4 inherit;font-family:inherit;border:1.5px solid #E2E4EC;border-radius:10px;padding:9px 11px;margin:0 0 8px;color:#202436;background:#fff}.rac-k input:focus,.rac-k textarea:focus{outline:0;border-color:#A57CF2}' +
  '.rac-k .rac-hp{position:absolute;left:-9999px;width:1px;height:1px;opacity:0}' +
  '.rac-k .rac-ab{width:100%;text-align:center;border-radius:10px;padding:11px}.rac-k .rac-ch{color:#B42318;font-size:13px;margin:0 0 8px}' +
  '@media(max-width:980px){body:has(.msum.on) #rac-btn{bottom:92px}}' +
  '@media(max-width:600px){#rac{inset:0;width:auto;height:100%;max-height:none;border-radius:0;bottom:0;right:0}' +
  '.rac-h{padding-top:max(14px,env(safe-area-inset-top))}.rac-f{padding-bottom:max(8px,env(safe-area-inset-bottom))}#rac-btn{right:16px;bottom:16px;width:54px;height:54px}.rac-in textarea{font-size:16px}}';

  var IK = {
    chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12z"/><path d="M8.5 11h.01M12 11h.01M15.5 11h.01" stroke-width="2.6"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    dom: '<svg viewBox="0 0 48 44" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 21 24 4l20 17"/><path d="M9 17v23h30V17"/><rect x="18.5" y="22" width="11" height="10" rx="1" stroke-width="3"/></svg>'
  };

  // ---------- stav ----------
  var spravy = [];  // {r:'u'|'a', t, ak:[]}
  try { spravy = JSON.parse(sessionStorage.getItem(KLUC) || '[]') || []; } catch (e) { spravy = []; }
  function uloz() { try { sessionStorage.setItem(KLUC, JSON.stringify(spravy.slice(-40))); } catch (e) { /* nič */ } }
  function zid() {
    var z = '';
    try { z = localStorage.getItem('ra_zid') || ''; if (!z) { z = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2)); localStorage.setItem('ra_zid', z); } } catch (e) { /* nič */ }
    return z;
  }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function bezpecnyOdkaz(u) {
    u = String(u || '').trim();
    if (/^mailto:info@realitnyasistent\.eu/i.test(u)) return u;
    if (/^https:\/\/(www\.)?realitnyasistent\.eu(\/|$)/i.test(u)) return u;
    if (/^(\.?\/)?[\w-]+(\.html)?(#[\w-]*)?$/i.test(u) || /^#[\w-]+$/.test(u) || /^(\.\.\/|\.?\/)?ukazka\d?\/?$/.test(u)) {
      return C.zdroj === 'aplikacia' ? 'https://realitnyasistent.eu/' + u.replace(/^\.?\//, '') : u;
    }
    return '';
  }
  function inline(t) {
    t = esc(t);
    t = t.replace(/\[([^\]]{1,80})\]\(([^)\s]{1,200})\)/g, function (m, txt, url) {
      var u = bezpecnyOdkaz(url.replace(/&amp;/g, '&'));
      return u ? '<a href="' + esc(u) + '"' + (C.zdroj === 'aplikacia' || /^https?:/.test(u) ? ' target="_blank" rel="noopener"' : '') + '>' + txt + '</a>' : txt;
    });
    t = t.replace(/\*\*([^*]{1,200})\*\*/g, '<strong>$1</strong>');
    t = t.replace(/(^|[\s(])(info@realitnyasistent\.eu)/g, '$1<a href="mailto:$2">$2</a>');
    return t;
  }
  function formatuj(text) {
    var riadky = String(text).split('\n'), out = [], zoznam = [];
    function zavri() { if (zoznam.length) { out.push('<ul>' + zoznam.join('') + '</ul>'); zoznam = []; } }
    riadky.forEach(function (r) {
      var m = r.match(/^\s*(?:[-•*]|\d+[.)])\s+(.*)$/);
      if (m) { zoznam.push('<li>' + inline(m[1]) + '</li>'); return; }
      zavri();
      if (r.trim()) out.push('<p>' + inline(r) + '</p>');
    });
    zavri();
    return out.join('');
  }

  // ---------- DOM ----------
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  var btn = document.createElement('button');
  btn.id = 'rac-btn'; btn.type = 'button'; btn.setAttribute('aria-label', 'Otvoriť chat – máte otázku?'); btn.innerHTML = IK.chat;
  document.body.appendChild(btn);

  var tip = null;
  try {
    if (C.zdroj === 'web' && !sessionStorage.getItem('ra_chat_tip')) {
      setTimeout(function () {
        if (panel || !document.body.contains(btn)) return;
        tip = document.createElement('div'); tip.id = 'rac-tip'; tip.innerHTML = 'Máte otázku? <b>Napíšte nám</b>';
        tip.onclick = otvor; document.body.appendChild(tip);
        setTimeout(function () { if (tip) { tip.remove(); tip = null; } }, 9000);
        try { sessionStorage.setItem('ra_chat_tip', '1'); } catch (e) { /* nič */ }
      }, 6000);
    }
  } catch (e) { /* nič */ }

  var panel = null, zoznam, vstup, posli, bezi = false, scrollY0 = 0;
  function vytvor() {
    panel = document.createElement('div');
    panel.id = 'rac'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Chat s pomocníkom Realitného asistenta');
    panel.innerHTML =
      '<div class="rac-h"><div class="rac-av">' + IK.dom + '</div><div class="rac-t"><b>Pomocník</b><span>Odpovedá automaticky, hneď</span></div>' +
      '<button class="rac-x" type="button" aria-label="Zavrieť chat">' + IK.x + '</button></div>' +
      '<div class="rac-m" aria-live="polite"></div>' +
      '<div class="rac-f"><div class="rac-in"><textarea rows="1" maxlength="1000" placeholder="Napíšte otázku…" aria-label="Vaša otázka"></textarea>' +
      '<button class="rac-go" type="button" aria-label="Odoslať" disabled>' + IK.send + '</button></div>' +
      '<div class="rac-pozn">Odpovedá automatický pomocník, môže sa pomýliť. · <a href="' + esc(C.sukromie) + '" target="_blank" rel="noopener">Ochrana údajov</a></div></div>';
    document.body.appendChild(panel);
    zoznam = panel.querySelector('.rac-m'); vstup = panel.querySelector('textarea'); posli = panel.querySelector('.rac-go');
    panel.querySelector('.rac-x').onclick = zavri;
    vstup.addEventListener('input', function () { posli.disabled = !vstup.value.trim() || bezi; vstup.style.height = 'auto'; vstup.style.height = Math.min(vstup.scrollHeight, 110) + 'px'; });
    vstup.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); odosli(); } });
    posli.onclick = odosli;
    panel.addEventListener('keydown', function (e) { if (e.key === 'Escape') zavri(); });
    vykresli();
  }

  function bublina(m, i) {
    var d = document.createElement('div'); d.className = 'rac-s ' + (m.r === 'u' ? 'u' : 'a');
    var b = document.createElement('div'); b.className = 'rac-b';
    if (m.r === 'u') b.textContent = m.t; else b.innerHTML = formatuj(m.t);
    d.appendChild(b); zoznam.appendChild(d);
    if (m.r === 'a' && m.ak && m.ak.length) {
      var ak = document.createElement('div'); ak.className = 'rac-ak';
      m.ak.forEach(function (a) {
        if (a === 'objednat') {
          var x;
          if (typeof C.objednat === 'function') { x = document.createElement('button'); x.type = 'button'; x.onclick = function () { C.objednat(); zavri(); }; }
          else { x = document.createElement('a'); x.href = C.objednat; }
          x.className = 'rac-ab p'; x.textContent = 'Objednať online →'; ak.appendChild(x);
        }
        if (a === 'kontakt') {
          var k = document.createElement('button'); k.type = 'button'; k.className = 'rac-ab' + (m.ak.indexOf('objednat') < 0 ? ' p' : '');
          k.textContent = 'Spojiť sa s nami'; k.onclick = ukazKontakt; ak.appendChild(k);
        }
      });
      zoznam.appendChild(ak);
    }
  }
  function vykresli() {
    zoznam.innerHTML = '';
    bublina({ r: 'a', t: UVOD });
    if (!spravy.length) {
      var ch = document.createElement('div'); ch.className = 'rac-ak rac-rychle';
      RYCHLE.forEach(function (q) {
        var b = document.createElement('button'); b.type = 'button'; b.className = 'rac-chip'; b.textContent = q;
        b.onclick = function () { ch.remove(); odosli(q); };
        ch.appendChild(b);
      });
      zoznam.appendChild(ch);
    }
    spravy.forEach(bublina);
    dole();
  }
  function dole() { requestAnimationFrame(function () { zoznam.scrollTop = zoznam.scrollHeight; }); }

  function odosli(text) {
    var t = (typeof text === 'string' ? text : vstup.value).trim();
    if (!t || bezi) return;
    var ch = zoznam.querySelector('.rac-rychle'); if (ch) ch.remove();
    if (typeof text !== 'string') { vstup.value = ''; vstup.style.height = 'auto'; }
    spravy.push({ r: 'u', t: t }); uloz(); bublina({ r: 'u', t: t });
    bezi = true; posli.disabled = true;
    var pis = document.createElement('div'); pis.className = 'rac-s a'; pis.innerHTML = '<div class="rac-b"><span class="rac-dots"><i></i><i></i><i></i></span></div>';
    zoznam.appendChild(pis); dole();
    var ctrl = window.AbortController ? new AbortController() : null;
    var casovac = setTimeout(function () { if (ctrl) ctrl.abort(); }, 60000);
    fetch(C.api + '/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctrl ? ctrl.signal : undefined,
      body: JSON.stringify({ spravy: spravy.slice(-12).map(function (m) { return { r: m.r, t: m.t }; }), zid: zid(), zdroj: C.zdroj, stranka: (location.pathname + location.hash).slice(0, 120) })
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (!j || !j.text) throw new Error('x');
      var m = { r: 'a', t: j.text, ak: j.akcie || [] };
      spravy.push(m); uloz(); pis.remove(); bublina(m);
    }).catch(function () {
      pis.remove();
      var m = { r: 'a', t: 'Prepáčte, spojenie sa nepodarilo. Skúste to znova alebo nám napíšte na info@realitnyasistent.eu.', ak: [] };
      bublina(m);
    }).then(function () {
      clearTimeout(casovac); bezi = false; posli.disabled = !vstup.value.trim(); dole();
      if (window.matchMedia('(min-width:601px)').matches) vstup.focus();
    });
  }

  function ukazKontakt() {
    if (zoznam.querySelector('.rac-k')) { zoznam.querySelector('.rac-k input').focus(); return; }
    var posl = ''; for (var i = spravy.length - 1; i >= 0; i--) { if (spravy[i].r === 'u' && !/(človek|operátor|kontakt|zavola)/i.test(spravy[i].t)) { posl = spravy[i].t; break; } }
    var f = document.createElement('form'); f.className = 'rac-k'; f.noValidate = true;
    f.innerHTML = '<b>Napíšte nám priamo</b><p>Odpovieme vám e-mailom spravidla do 1 pracovného dňa.</p>' +
      '<input name="meno" autocomplete="name" placeholder="Meno" maxlength="100">' +
      '<input name="email" type="email" autocomplete="email" inputmode="email" placeholder="E-mail *" maxlength="150" required>' +
      '<input name="telefon" type="tel" autocomplete="tel" placeholder="Telefón (nepovinné)" maxlength="40">' +
      '<textarea name="sprava" rows="3" maxlength="2000" placeholder="S čím vám máme pomôcť? *"></textarea>' +
      '<input class="rac-hp" name="web" tabindex="-1" autocomplete="off" aria-hidden="true">' +
      '<div class="rac-ch" hidden></div><button class="rac-ab p" type="submit">Odoslať</button>';
    f.sprava.value = posl;
    f.onsubmit = function (e) {
      e.preventDefault();
      var ch = f.querySelector('.rac-ch'), b = f.querySelector('button');
      var d = { meno: f.meno.value.trim(), email: f.email.value.trim(), telefon: f.telefon.value.trim(), sprava: f.sprava.value.trim(), web: f.web.value, zid: zid(), zdroj: C.zdroj, prepis: spravy.slice(-8).map(function (m) { return { r: m.r, t: m.t }; }) };
      if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(d.email)) { ch.textContent = 'Zadajte, prosím, platný e-mail.'; ch.hidden = false; f.email.focus(); return; }
      if (d.sprava.length < 3) { ch.textContent = 'Napíšte, prosím, s čím vám máme pomôcť.'; ch.hidden = false; f.sprava.focus(); return; }
      ch.hidden = true; b.disabled = true; b.textContent = 'Odosielam…';
      fetch(C.api + '/chat/kontakt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) })
        .then(function (r) { return r.json(); }).then(function (j) {
          if (!j.ok) throw new Error(j.chyba || 'x');
          f.remove();
          var m = { r: 'a', t: 'Ďakujeme, správu máme. Ozveme sa vám na **' + d.email + '** spravidla do 1 pracovného dňa.' };
          spravy.push(m); uloz(); bublina(m); dole();
        }).catch(function (er) {
          ch.textContent = er.message && er.message !== 'x' ? er.message : 'Správu sa nepodarilo odoslať. Napíšte nám na info@realitnyasistent.eu.';
          ch.hidden = false; b.disabled = false; b.textContent = 'Odoslať';
        });
    };
    zoznam.appendChild(f); dole();
    setTimeout(function () { (f.meno.value ? f.email : f.meno).focus(); }, 50);
  }

  function mobil() { return window.matchMedia('(max-width:600px)').matches; }
  function otvor() {
    if (tip) { tip.remove(); tip = null; }
    if (!panel) vytvor(); else panel.hidden = false;
    btn.classList.add('rac-skry'); btn.setAttribute('aria-expanded', 'true');
    if (mobil()) { scrollY0 = window.scrollY; document.documentElement.style.overflow = 'hidden'; }
    else vstup.focus();
    dole();
  }
  function zavri() {
    if (!panel) return;
    panel.hidden = true; btn.classList.remove('rac-skry'); btn.setAttribute('aria-expanded', 'false');
    document.documentElement.style.overflow = '';
    if (mobil()) window.scrollTo(0, scrollY0);
    btn.focus({ preventScroll: true });
  }
  btn.onclick = otvor;
  window.raChatOtvor = otvor;
  if (C.otvorene || location.hash === '#chat') otvor();
})();
