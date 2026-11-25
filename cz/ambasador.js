// Prihláška do ambasádorského programu
(() => {
  const API = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? 'http://localhost:8787/ambasador' : 'https://ra-objednavky.rarex731.workers.dev/ambasador';
  const form = document.getElementById('amb');
  if (!form) return;
  const $ = (id) => document.getElementById(id);
  let zid = '';
  try { zid = localStorage.getItem('ra_zid') || ''; if (!zid) { zid = crypto.randomUUID(); localStorage.setItem('ra_zid', zid); } } catch { /* nič */ }
  const chyba = (t) => { $('aChyba').textContent = t || ''; $('aChyba').hidden = !t; };
  form.addEventListener('submit', async (e) => {
    e.preventDefault(); chyba('');
    if (!form.meno.value.trim() || !form.email.checkValidity() || !form.email.value || !form.telefon.value.trim()) return chyba('Vyplňte jméno, e-mail a telefon.');
    if (!form.ako.value.trim()) return chyba('Napište nám, jak byste naše služby doporučovali.'), form.ako.focus();
    if (!form.suhlas.checked) return chyba('Potvrďte souhlas s podmínkami programu.');
    const b = $('aOdoslat'); b.disabled = true; b.textContent = 'Odesíláme…';
    try {
      const fd = new FormData(form); fd.set('zid', zid); fd.set('jazyk', 'cs');
      const r = await fetch(API + '?jazyk=cs', { method: 'POST', body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) throw new Error(j.chyba || 'Přihlášku se nepodařilo odeslat.');
      form.hidden = true; const h = $('aHotovo'); h.hidden = false; h.focus(); h.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (err) {
      chyba((err.message && !/fetch/i.test(err.message) ? err.message : 'Přihlášku se nepodařilo odeslat. Zkuste to znovu.') + (/info@/.test(err.message || '') ? '' : ' Případně nám napište na info@realitnyasistent.eu.'));
      b.disabled = false; b.textContent = 'Odeslat přihlášku';
    }
  });
})();
