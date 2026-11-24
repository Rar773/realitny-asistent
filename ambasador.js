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
    if (!form.meno.value.trim() || !form.email.checkValidity() || !form.email.value || !form.telefon.value.trim()) return chyba('Vyplňte meno, e-mail a telefón.');
    if (!form.ako.value.trim()) return chyba('Napíšte nám, ako by ste naše služby odporúčali.'), form.ako.focus();
    if (!form.suhlas.checked) return chyba('Potvrďte súhlas s podmienkami programu.');
    const b = $('aOdoslat'); b.disabled = true; b.textContent = 'Odosielame…';
    try {
      const fd = new FormData(form); fd.set('zid', zid);
      const r = await fetch(API, { method: 'POST', body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) throw new Error(j.chyba || 'Prihlášku sa nepodarilo odoslať.');
      form.hidden = true; const h = $('aHotovo'); h.hidden = false; h.focus(); h.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (err) {
      chyba((err.message && !/fetch/i.test(err.message) ? err.message : 'Prihlášku sa nepodarilo odoslať. Skúste to znova.') + (/info@/.test(err.message || '') ? '' : ' Prípadne nám napíšte na info@realitnyasistent.eu.'));
      b.disabled = false; b.textContent = 'Odoslať prihlášku';
    }
  });
})();
