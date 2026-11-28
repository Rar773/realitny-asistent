// Objednávkový formulár – virtuálne zariadenie a videá
(() => {
  const API = /^(localhost|127\.0\.0\.1)$/.test(location.hostname)
    ? 'http://localhost:8787/objednavka'
    : 'https://ra-objednavky.rarex731.workers.dev/objednavka';
  const MAX = 10;
  const MIESTNOSTI = ['Obývačka', 'Obývačka s kuchyňou', 'Spálňa', 'Kuchyňa', 'Jedáleň', 'Detská izba', 'Pracovňa', 'Kúpeľňa', 'Iná'];
  const $ = (id) => document.getElementById(id);
  const form = $('obj');
  if (!form) return;
  // odmena za odporúčanie: objednavka.html?odmena=ID&sluzba=standard|zariadenie[&pocet=3] – len prihlásený majiteľ, cena 0
  const ODM = (() => { try { const q = new URLSearchParams(location.search); const id = q.get('odmena') || ''; if (!/^[a-f0-9]{8,40}$/.test(id)) return null;
    return { id, sluzba: q.get('sluzba') === 'zariadenie' ? 'zariadenie' : 'standard', max: Math.min(10, Math.max(1, parseInt(q.get('pocet') || '3', 10) || 3)), tok: localStorage.getItem('ra_ucet') || '' }; } catch (e) { return null; } })();

  let fotky = []; // {subor, nahlad, miestnost}
  // trvalé id prehliadača (ochrana zľavy pre nových klientov)
  let ZID = '';
  try { ZID = localStorage.getItem('ra_zid') || ''; if (!ZID) { ZID = crypto.randomUUID(); localStorage.setItem('ra_zid', ZID); } } catch { ZID = ''; }
  if (!ZID) { const m = document.cookie.match(/ra_zid=([^;]+)/); ZID = m ? m[1] : (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2)); }
  document.cookie = 'ra_zid=' + ZID + '; max-age=63072000; path=/; SameSite=Lax; Secure';

  const cenaZar = (n) => (n <= 0 ? 0 : Math.min(5 * n, 19)); // 1 fotka 5 €, celý inzerát (do 10 fotiek) 19 €
  const eur = (x) => (Number.isInteger(x) ? String(x) : x.toFixed(2).replace('.', ',')) + ' €';
  const val = (n) => (form.querySelector(`[name="${n}"]:checked`) || {}).value;

  function pocet() { return fotky.length || (parseInt($('oPocet').value, 10) || 0); }

  function prepocitaj() {
    const sluzba = val('sluzba');
    const zar = sluzba === 'zariadenie';
    document.querySelectorAll('.ozar').forEach((el) => { el.hidden = !zar || (el.id === 'oPocetWrap' && fotky.length > 0); });
    $('oKrokKontakt').textContent = zar ? '4' : '3';
    $('oVidWrap').hidden = !$('oSVideom').checked;
    if (zar && !fotky.length) $('oPocetWrap').hidden = false;

    const r = [];
    let spolu = 0;
    if (zar) {
      const n = Math.min(MAX, pocet());
      const predpl = $('oPredpl').checked;
      if (predpl) $('oNovy').checked = false;
      const novy = $('oNovy').checked;
      let z = predpl ? 0 : novy ? Math.max(0, cenaZar(n) - cenaZar(Math.min(n, 1))) : cenaZar(n);
      r.push([`Virtuálne zariadenie · ${n} ${n === 1 ? 'fotka' : n > 1 && n < 5 ? 'fotky' : 'fotiek'}${n >= 4 ? ' (celý inzerát)' : ''}`, eur(cenaZar(n))]);
      if (predpl && n) r.push(['Inzerát z predplatného Všetky portály', '−' + eur(cenaZar(n))]);
      if (novy && n) r.push(['Nový klient · 1 fotka zadarmo', '−' + eur(cenaZar(n) - z)]);
      if ($('oSVideom').checked) {
        const prem = val('video') === 'premiove';
        r.push(['Zľava 50 % s videom', '−' + eur(z / 2)]);
        z = z / 2;
        r.push([prem ? 'Video Prémiové' : 'Video Štandard', eur(prem ? 89 : 29)]);
        spolu += prem ? 89 : 29;
      }
      spolu += z;
      if ($('oReels').checked) { const rc = n >= 4 ? 5 : 10; r.push([n >= 4 ? 'Reels pred → po (zvýhodnené k inzerátu)' : 'Reels pred → po', eur(rc)]); spolu += rc; }
    } else {
      const prem = sluzba === 'premiove';
      r.push([prem ? 'Video Prémiové' : 'Video Štandard', eur(prem ? 89 : 29)]);
      spolu = prem ? 89 : 29;
    }
    $('oSuhrn').innerHTML = r.map(([a, b]) => `<div><span>${a}</span><span>${b}</span></div>`).join('');
    $('oCena').textContent = eur(spolu);
    if (ODM) { $('oSuhrn').insertAdjacentHTML('beforeend', `<div><span>Odmena za odporúčanie</span><span>−${eur(spolu)}</span></div>`); $('oCena').textContent = '0 €'; }
  }

  function vykresli() {
    const ul = $('oZoznam');
    ul.innerHTML = '';
    fotky.forEach((f, i) => {
      const li = document.createElement('li');
      li.innerHTML = `<img src="${f.nahlad}" alt="Fotka ${i + 1}"><select aria-label="Miestnosť na fotke ${i + 1}">${MIESTNOSTI.map((m) => `<option${m === f.miestnost ? ' selected' : ''}>${m}</option>`).join('')}</select><button type="button" aria-label="Odstrániť fotku ${i + 1}">×</button>`;
      li.querySelector('select').addEventListener('change', (e) => { f.miestnost = e.target.value; });
      li.querySelector('button').addEventListener('click', () => { URL.revokeObjectURL(f.nahlad); fotky.splice(i, 1); vykresli(); });
      ul.appendChild(li);
    });
    $('oDrop').classList.toggle('plne', fotky.length >= MAX);
    prepocitaj();
  }

  function pridaj(zoznam) {
    const nove = [...zoznam].filter((s) => s.type.startsWith('image/') || /\.(jpe?g|png|webp|heic|heif)$/i.test(s.name));
    const volne = MAX - fotky.length;
    if (nove.length > volne) chyba(`V jednej objednávke môže byť najviac ${MAX} fotiek.`);
    nove.slice(0, volne).forEach((s) => {
      fotky.push({ subor: s, nahlad: URL.createObjectURL(s), miestnost: MIESTNOSTI[0] });
    });
    vykresli();
  }

  // zmenšenie fotky v prehliadači (max 2560 px, JPEG) – rýchlejšie odoslanie
  async function zmensi(s) {
    try {
      const bmp = await createImageBitmap(s);
      const k = Math.min(1, 2560 / Math.max(bmp.width, bmp.height));
      if (k === 1 && s.size < 4e6 && s.type === 'image/jpeg') return s;
      const c = document.createElement('canvas');
      c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      const b = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.9));
      return b ? new File([b], s.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : s;
    } catch { return s; }
  }

  function chyba(t) { const e = $('oChyba'); e.textContent = t; e.hidden = !t; }

  $('oFotky').addEventListener('change', (e) => { pridaj(e.target.files); e.target.value = ''; });
  const drop = $('oDrop');
  ['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('nad'); }));
  ['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, () => drop.classList.remove('nad')));
  drop.addEventListener('drop', (e) => { e.preventDefault(); pridaj(e.dataTransfer.files); });
  // overenie nároku na zľavu pre nových klientov
  const NOVY_API = API.replace(/\/objednavka$/, '/novy-klient');
  let overTimer;
  async function overNovy() {
    const info = $('oNovyInfo');
    if (!$('oNovy').checked) { info.hidden = true; return; }
    if (!form.telefon.value.trim()) { info.textContent = 'Pre zľavu pre nových klientov vyplňte aj telefón.'; info.hidden = false; return; }
    if (!form.email.value.includes('@')) { info.hidden = true; return; }
    try {
      const r = await fetch(NOVY_API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: form.email.value, telefon: form.telefon.value, meno: form.meno.value, zid: ZID, fp: FP }) }).then((x) => x.json());
      if (r.novy === false) { $('oNovy').checked = false; info.textContent = r.sprava; info.hidden = false; prepocitaj(); }
      else info.hidden = true;
    } catch { info.hidden = true; }
  }
  ['email', 'telefon', 'meno'].forEach((n) => form[n].addEventListener('input', () => { clearTimeout(overTimer); overTimer = setTimeout(overNovy, 700); }));
  $('oNovy').addEventListener('change', () => { if ($('oNovy').checked) $('oPredpl').checked = false; overNovy(); });
  form.addEventListener('change', prepocitaj);
  form.addEventListener('input', (e) => { if (e.target.id === 'oPocet') prepocitaj(); });


  // odtlačok zariadenia (ochrana zliav)
  let FP = '';
  (async () => {
    try {
      const c = document.createElement('canvas'); c.width = 240; c.height = 60; const x = c.getContext('2d');
      x.textBaseline = 'top'; x.font = '16px Arial'; x.fillStyle = '#f60'; x.fillRect(100, 1, 62, 20); x.fillStyle = '#069'; x.fillText('Realitný asistent ✓ 1.0', 2, 15); x.fillStyle = 'rgba(102,204,0,.7)'; x.fillText('Realitný asistent ✓ 1.0', 4, 17);
      const d = [navigator.userAgent, navigator.language, (navigator.languages || []).join(','), Intl.DateTimeFormat().resolvedOptions().timeZone, screen.width + 'x' + screen.height + 'x' + screen.colorDepth, navigator.hardwareConcurrency, navigator.deviceMemory, navigator.platform, navigator.maxTouchPoints, c.toDataURL()].join('|');
      const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(d));
      FP = [...new Uint8Array(h)].slice(0, 16).map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch { FP = ''; }
  })();
  // podobnosť fotiek (dHash 8x8)
  async function dHash(s) {
    try {
      const b = await createImageBitmap(s); const c = document.createElement('canvas'); c.width = 9; c.height = 8;
      const x = c.getContext('2d'); x.drawImage(b, 0, 0, 9, 8); const d = x.getImageData(0, 0, 9, 8).data; let h = '';
      for (let y = 0; y < 8; y++) { let n = 0; for (let i = 0; i < 8; i++) { const p = (y * 9 + i) * 4, q = p + 4; const a = d[p] * 0.3 + d[p + 1] * 0.59 + d[p + 2] * 0.11, z = d[q] * 0.3 + d[q + 1] * 0.59 + d[q + 2] * 0.11; n = (n << 1) | (a > z ? 1 : 0); } h += n.toString(16).padStart(2, '0'); }
      return h;
    } catch { return ''; }
  }
  // „nie som robot“ – len pri objednávkach zadarmo
  const TS_KLUC = '0x4AAAAAAGQzRVHjw4Z2OR71';
  let tsToken = '', tsId = null, tsNac = null;
  const zadarmo = () => val('sluzba') === 'zariadenie' && ($('oNovy').checked || $('oPredpl').checked);
  function nacitajTs() {
    if (!tsNac) tsNac = new Promise((ok, zle) => { const sc = document.createElement('script'); sc.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; sc.async = true; sc.onload = ok; sc.onerror = zle; document.head.appendChild(sc); });
    return tsNac;
  }
  async function robot() {
    const box = $('oTs');
    if (!zadarmo()) { box.hidden = true; return; }
    box.hidden = false;
    if (tsId !== null) return;
    tsId = -1;
    try { await nacitajTs(); tsId = window.turnstile.render(box, { sitekey: TS_KLUC, language: 'sk', callback: (t) => { tsToken = t; chyba(''); }, 'expired-callback': () => { tsToken = ''; }, 'error-callback': () => { tsToken = ''; } }); }
    catch { box.textContent = 'Overenie sa nepodarilo načítať. Obnovte stránku.'; tsId = null; }
  }
  function resetRobot() { tsToken = ''; try { if (tsId !== null && tsId !== -1 && window.turnstile) window.turnstile.reset(tsId); } catch { /* nič */ } }
  form.addEventListener('change', robot);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    chyba('');
    const sluzba = val('sluzba');
    const inz = form.inzerat.value.trim();
    if (!form.meno.value.trim()) return chyba('Vyplňte meno.'), form.meno.focus();
    if (!form.email.checkValidity() || !form.email.value) return chyba('Vyplňte platný e-mail.'), form.email.focus();
    if (inz && !/^https?:\/\//i.test(inz)) return chyba('Odkaz na inzerát musí začínať https://'), form.inzerat.focus();
    if (!fotky.length && !inz) return chyba('Nahrajte fotky alebo vložte odkaz na inzerát.');
    if ($('oNovy').checked && sluzba === 'zariadenie' && !form.telefon.value.trim()) return chyba('Pre zľavu pre nových klientov vyplňte telefónne číslo.'), form.telefon.focus();
    if (form.kod.value.trim() && $('oNovy').checked) { $('oNovy').checked = false; prepocitaj(); }
    if (ODM && ODM.sluzba === 'zariadenie' && pocet() > ODM.max) return chyba('Odmena platí najviac na {n} fotky.'.replace('{n}', ODM.max));
    if (!form.suhlas.checked) return chyba('Potvrďte súhlas s obchodnými podmienkami.');
    if (zadarmo() && !tsToken) { robot(); return chyba('Potvrďte, prosím, že nie ste robot (políčko nad tlačidlom).'); }

    const btn = $('oOdoslat');
    btn.disabled = true;
    btn.textContent = fotky.length ? 'Pripravujeme fotky…' : 'Odosielame…';
    try {
      const fd = new FormData(form);
      fd.delete('fotky');
      fd.set('zid', ZID);
      if (FP) fd.set('fp', FP);
      if (zadarmo()) fd.set('ts', tsToken);
      if (sluzba !== 'zariadenie') { ['styl', 's_videom', 'video', 'novy', 'pocet', 'reels', 'predplatne'].forEach((k) => fd.delete(k)); }
      if (fotky.length) fd.delete('pocet');
      for (const f of fotky) { const ph = await dHash(f.subor); if (ph) fd.append('ph', ph); fd.append('fotky', await zmensi(f.subor)); fd.append('miestnost', f.miestnost); }
      btn.textContent = 'Odosielame…';
      const hl = {};
      if (ODM) { fd.set('odmena', ODM.id); fd.delete('kod'); ['novy', 'predplatne', 's_videom', 'reels'].forEach((k) => fd.delete(k)); if (ODM.tok) hl.Authorization = 'Bearer ' + ODM.tok; }
      const r = await fetch(API, { method: 'POST', body: fd, headers: hl });
      const j = await r.json().catch(() => ({}));
      resetRobot();
      if (!r.ok || !j.ok) throw new Error(j.chyba || 'Objednávku sa nepodarilo odoslať.');
      if (j.platba_url) { btn.textContent = 'Presmerúvame na platbu…'; location.href = j.platba_url; return; }
      $('oCislo').textContent = j.cislo;
      if (j.novy_zamietnuty) $('oCislo').insertAdjacentHTML('afterend', '<br><small>Zľavu pre nových klientov sme neuplatnili – už ste u nás objednávali. Cena: ' + String(j.cena).replace('.', ',') + ' €</small>');
      if (j.predplatne_zamietnute) $('oCislo').insertAdjacentHTML('afterend', '<br><small>Inzerát z predplatného ste tento mesiac už využili, cenu sme vypočítali podľa cenníka: ' + String(j.cena).replace('.', ',') + ' €</small>');
      if (j.stav_url) $('oStavLink').href = j.stav_url; else $('oStavLink').hidden = true;
      form.hidden = true;
      const h = $('oHotovo'); h.hidden = false; h.focus();
      h.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (err) {
      const t = err && err.message && !/fetch/i.test(err.message) ? err.message : 'Objednávku sa nepodarilo odoslať. Skontrolujte pripojenie a skúste to znova.';
      chyba(/info@/.test(t) ? t : t + ' Prípadne nám napíšte na info@realitnyasistent.eu.');
      btn.disabled = false;
      btn.textContent = 'Odoslať objednávku';
    }
  });

  // kód ambasádora z odkazu
  try { const a = JSON.parse(localStorage.getItem('ra_amb') || 'null'); if (a && Date.now() - a.t < 60 * 864e5 && !form.kod.value) form.kod.value = a.k; } catch { /* nič */ }
  // predvoľba služby z odkazu, napr. objednavka.html?sluzba=standard
  const q = new URLSearchParams(location.search).get('sluzba');
  const opt = q && form.querySelector(`[name="sluzba"][value="${q}"]`);
  if (opt) opt.checked = true;
  if (ODM) {
    const radio = form.querySelector(`input[name=sluzba][value=${ODM.sluzba}]`); if (radio) radio.checked = true;
    form.querySelectorAll('input[name=sluzba]').forEach((x) => { if (x !== radio) x.closest('label').hidden = true; });
    ['oNovy', 'oPredpl', 'oSVideom', 'oReels'].forEach((id) => { const el = $(id); if (el) { el.checked = false; const l = el.closest('label'); if (l) l.hidden = true; } });
    const kod = form.querySelector('[name=kod]'); if (kod) { kod.value = ''; const l = kod.closest('label'); if (l) l.hidden = true; }
    if (ODM.sluzba === 'zariadenie' && form.pocet) { form.pocet.value = ODM.max; form.pocet.max = ODM.max; }
    const b = document.createElement('p'); b.className = 'odm-ban';
    b.innerHTML = ODM.tok ? '<b>Odmena za odporúčanie</b> – túto objednávku máte zadarmo.' : 'Na použitie odmeny sa najprv prihláste v <a class="link" href="ucet#odmeny">Môj účet</a>.';
    form.prepend(b);
  }
  prepocitaj();
})();
