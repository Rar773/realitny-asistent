(() => {
  const API = 'https://ra-objednavky.rarex731.workers.dev';
  const $ = (i) => document.getElementById(i);
  const [id, t] = (location.hash.slice(1) || '').split('.');
  let Z = null;
  const ukaz = (i, a = true) => $(i).classList.toggle('hide', !a);
  async function post(p, b) {
    try { const r = await fetch(API + p + '?jazyk=cs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }); return await r.json(); }
    catch (e) { return { ok: false, chyba: 'Spojení selhalo. Zkontrolujte internet a zkuste to znovu.' }; }
  }
  function chyba(text) { $('zNadpis').textContent = 'Smlouvu se nepodařilo otevřít'; $('zLead').textContent = ''; $('zChybaT').textContent = text; ukaz('zChyba'); }
  function stiahni(html) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    a.download = ((Z && Z.nazov) || 'zmluva').replace(/[\\/:*?"<>|]+/g, '_') + '.html';
    document.body.appendChild(a); a.click(); a.remove();
  }
  function msg(text, ok) { const m = $('zMsg'); m.textContent = text; m.className = 'msg ' + (ok ? 'ok' : 'er'); }
  function hotovo(kedy, html) {
    $('zNadpis').textContent = 'Děkujeme, smlouva je potvrzená';
    $('zLead').textContent = Z.nazov || '';
    $('zHotovoT').textContent = 'Potvrzeno ' + kedy + (Z.potvrdil ? ' · ' + Z.potvrdil : '') + '. ' + (Z.treba_kod ? 'Kopii smlouvy jsme vám poslali e-mailem.' : 'Kopii si stáhněte tlačítkem níže.');
    if (html) { Z.html = html; $('zDok').srcdoc = html; }
    ukaz('zForm', false); ukaz('zHotovo');
  }
  async function start() {
    if (!id || !t) return chyba('Odkaz na smlouvu je neúplný. Otevřete ho prosím znovu z e-mailu nebo zprávy od makléře.');
    Z = await post('/z/nacitaj', { id, t });
    if (!Z.ok) return chyba(Z.chyba || 'Odkaz je neplatný.');
    $('zNadpis').textContent = Z.nazov || 'Smlouva o zprostředkování';
    $('zLead').textContent = (Z.makler ? Z.makler + ' vám posílá smlouvu k potvrzení.' : 'Váš makléř vám posílá smlouvu k potvrzení.') + ' Přečtěte si ji a potvrďte online.';
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
    if (r.ok) { $('zKodInfo').textContent = 'Kód jsme poslali na ' + Z.email + '. Podívejte se i do složky Spam.'; $('zKod').focus(); b.textContent = 'Poslat znovu'; }
    else msg(r.chyba || 'Kód se nepodařilo poslat.');
  };
  $('zPotvrd').onclick = async () => {
    if (!$('zSuhlas').checked) return msg('Zaškrtněte, že jste si smlouvu přečetli a souhlasíte s ní.');
    const meno = $('zMeno').value.trim();
    if (meno.length < 4 || !/\s/.test(meno)) return msg('Napište své jméno a příjmení.');
    if (Z.treba_kod && $('zKod').value.replace(/\D/g, '').length !== 6) return msg('Zadejte 6místný kód z e-mailu. Pokud jste ho ještě nedostali, klikněte na Poslat kód.');
    const b = $('zPotvrd'); b.disabled = true; b.textContent = 'Potvrzujeme…';
    const r = await post('/z/potvrd', { id, t, meno, kod: $('zKod').value, suhlas: true });
    b.disabled = false; b.textContent = 'Potvrdit smlouvu';
    if (!r.ok) return msg(r.chyba || 'Potvrdenie sa nepodarilo.');
    Z.potvrdil = meno; hotovo(r.potvrdena, r.html);
  };
  start();
})();
