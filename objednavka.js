// Objednávkový formulár – virtuálne zariadenie a videá
(() => {
  const API = /^(localhost|127\.0\.0\.1)$/.test(location.hostname)
    ? 'http://localhost:8787/objednavka'
    : 'https://ra-objednavky.rarex731.workers.dev/objednavka';
  const MAX = 10;
  const MIESTNOSTI = ['Obývačka', 'Spálňa', 'Kuchyňa', 'Jedáleň', 'Detská izba', 'Pracovňa', 'Kúpeľňa', 'Iná'];
  const $ = (id) => document.getElementById(id);
  const form = $('obj');
  if (!form) return;

  let fotky = []; // {subor, nahlad, miestnost}

  const cenaZar = (n) => { if (n <= 0) return 0; let c = 9 * n; if (n <= 5) c = Math.min(c, 29); return Math.min(c, 49); };
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
      const novy = $('oNovy').checked;
      let z = cenaZar(novy ? Math.max(0, n - 3) : n);
      r.push([`Virtuálne zariadenie · ${n} ${n === 1 ? 'fotka' : n > 1 && n < 5 ? 'fotky' : 'fotiek'}`, eur(cenaZar(n))]);
      if (novy && n) r.push(['Nový klient · 3 fotky zadarmo', '−' + eur(cenaZar(n) - z)]);
      if ($('oSVideom').checked) {
        const prem = val('video') === 'premiove';
        r.push(['Zľava 50 % s videom', '−' + eur(z / 2)]);
        z = z / 2;
        r.push([prem ? 'Video Prémiové' : 'Video Štandard', eur(prem ? 89 : 29)]);
        spolu += prem ? 89 : 29;
      }
      spolu += z;
    } else {
      const prem = sluzba === 'premiove';
      r.push([prem ? 'Video Prémiové' : 'Video Štandard', eur(prem ? 89 : 29)]);
      spolu = prem ? 89 : 29;
    }
    $('oSuhrn').innerHTML = r.map(([a, b]) => `<div><span>${a}</span><span>${b}</span></div>`).join('');
    $('oCena').textContent = eur(spolu);
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
  form.addEventListener('change', prepocitaj);
  form.addEventListener('input', (e) => { if (e.target.id === 'oPocet') prepocitaj(); });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    chyba('');
    const sluzba = val('sluzba');
    const inz = form.inzerat.value.trim();
    if (!form.meno.value.trim()) return chyba('Vyplňte meno.'), form.meno.focus();
    if (!form.email.checkValidity() || !form.email.value) return chyba('Vyplňte platný e-mail.'), form.email.focus();
    if (inz && !/^https?:\/\//i.test(inz)) return chyba('Odkaz na inzerát musí začínať https://'), form.inzerat.focus();
    if (!fotky.length && !inz) return chyba('Nahrajte fotky alebo vložte odkaz na inzerát.');
    if (!form.suhlas.checked) return chyba('Potvrďte súhlas s obchodnými podmienkami.');

    const btn = $('oOdoslat');
    btn.disabled = true;
    btn.textContent = fotky.length ? 'Pripravujeme fotky…' : 'Odosielame…';
    try {
      const fd = new FormData(form);
      fd.delete('fotky');
      if (sluzba !== 'zariadenie') { ['styl', 's_videom', 'video', 'novy', 'pocet'].forEach((k) => fd.delete(k)); }
      if (fotky.length) fd.delete('pocet');
      for (const f of fotky) { fd.append('fotky', await zmensi(f.subor)); fd.append('miestnost', f.miestnost); }
      btn.textContent = 'Odosielame…';
      const r = await fetch(API, { method: 'POST', body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) throw new Error(j.chyba || 'Objednávku sa nepodarilo odoslať.');
      $('oCislo').textContent = j.cislo;
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

  // predvoľba služby z odkazu, napr. objednavka.html?sluzba=standard
  const q = new URLSearchParams(location.search).get('sluzba');
  const opt = q && form.querySelector(`[name="sluzba"][value="${q}"]`);
  if (opt) opt.checked = true;
  prepocitaj();
})();
