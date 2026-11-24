(() => {
  const API = 'https://ra-objednavky.rarex731.workers.dev';
  const $ = (i) => document.getElementById(i);
  const [id, t] = (location.hash.slice(1) || '').split('.');
  let Z = null;
  const ukaz = (i, a = true) => $(i).classList.toggle('hide', !a);
  async function post(p, b) {
    try { const r = await fetch(API + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }); return await r.json(); }
    catch (e) { return { ok: false, chyba: 'Spojenie zlyhalo. Skontrolujte internet a skúste to znova.' }; }
  }
  function chyba(text) { $('zNadpis').textContent = 'Zmluvu sa nepodarilo otvoriť'; $('zLead').textContent = ''; $('zChybaT').textContent = text; ukaz('zChyba'); }
  function stiahni(html) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    a.download = ((Z && Z.nazov) || 'zmluva').replace(/[\\/:*?"<>|]+/g, '_') + '.html';
    document.body.appendChild(a); a.click(); a.remove();
  }
  function msg(text, ok) { const m = $('zMsg'); m.textContent = text; m.className = 'msg ' + (ok ? 'ok' : 'er'); }
  function hotovo(kedy, html) {
    $('zNadpis').textContent = 'Ďakujeme, zmluva je potvrdená';
    $('zLead').textContent = Z.nazov || '';
    $('zHotovoT').textContent = 'Potvrdené ' + kedy + (Z.potvrdil ? ' · ' + Z.potvrdil : '') + '. ' + (Z.treba_kod ? 'Kópiu zmluvy sme vám poslali e-mailom.' : 'Kópiu si stiahnite tlačidlom nižšie.');
    if (html) { Z.html = html; $('zDok').srcdoc = html; }
    ukaz('zForm', false); ukaz('zHotovo');
  }
  async function start() {
    if (!id || !t) return chyba('Odkaz na zmluvu je neúplný. Otvorte ho, prosím, znova z e-mailu alebo správy od makléra.');
    Z = await post('/z/nacitaj', { id, t });
    if (!Z.ok) return chyba(Z.chyba || 'Odkaz je neplatný.');
    $('zNadpis').textContent = Z.nazov || 'Zmluva o sprostredkovaní';
    $('zLead').textContent = (Z.makler ? Z.makler + ' vám posiela zmluvu na potvrdenie.' : 'Váš maklér vám posiela zmluvu na potvrdenie.') + ' Prečítajte si ju a potvrďte online.';
    $('zMaklerK').textContent = Z.makler ? ' (' + Z.makler + (Z.makler_tel ? ', ' + Z.makler_tel : '') + ')' : '';
    $('zDok').srcdoc = Z.html;
    ukaz('zKarta');
    if (Z.stav === 'potvrdena') return hotovo(Z.potvrdena);
    if (Z.klient) $('zMeno').value = Z.klient;
    if (Z.treba_kod) { ukaz('zKodW'); $('zKodInfo').textContent = 'Kód pošleme na ' + Z.email + '.'; }
    ukaz('zForm');
  }
  $('zStiahni').onclick = (e) => { e.preventDefault(); if (Z && Z.html) stiahni(Z.html); };
  $('zStiahni2').onclick = () => { if (Z && Z.html) stiahni(Z.html); };
  $('zPosliKod').onclick = async () => {
    const b = $('zPosliKod'); b.disabled = true;
    const r = await post('/z/kod', { id, t });
    b.disabled = false;
    if (r.ok) { $('zKodInfo').textContent = 'Kód sme poslali na ' + Z.email + '. Pozrite aj priečinok Spam.'; $('zKod').focus(); b.textContent = 'Poslať znova'; }
    else msg(r.chyba || 'Kód sa nepodarilo poslať.');
  };
  $('zPotvrd').onclick = async () => {
    if (!$('zSuhlas').checked) return msg('Zaškrtnite, že ste si zmluvu prečítali a súhlasíte s ňou.');
    const meno = $('zMeno').value.trim();
    if (meno.length < 4 || !/\s/.test(meno)) return msg('Napíšte svoje meno a priezvisko.');
    if (Z.treba_kod && $('zKod').value.replace(/\D/g, '').length !== 6) return msg('Zadajte 6-miestny kód z e-mailu. Ak ste ho ešte nedostali, kliknite na Poslať kód.');
    const b = $('zPotvrd'); b.disabled = true; b.textContent = 'Potvrdzujeme…';
    const r = await post('/z/potvrd', { id, t, meno, kod: $('zKod').value, suhlas: true });
    b.disabled = false; b.textContent = 'Potvrdiť zmluvu';
    if (!r.ok) return msg(r.chyba || 'Potvrdenie sa nepodarilo.');
    Z.potvrdil = meno; hotovo(r.potvrdena, r.html);
  };
  start();
})();
