// Realitný asistent – objednávky (web aj aplikácia)
// Objednávka → databáza (D1) → Telegram (Marian) → prehľad /admin → stránka stavu pre zákazníka /stav
// Platba kartou cez Stripe sa zapne sama, keď sú nastavené STRIPE_KEY a STRIPE_WEBHOOK_SECRET.

const WEB = 'https://realitnyasistent.eu';
const POVOLENE = [WEB, 'https://www.realitnyasistent.eu', 'http://localhost:8765', 'http://127.0.0.1:8765'];
const MAX_FOTIEK = 10;
const MAX_FOTKA = 15 * 1024 * 1024;
const STYLY = { moderny: 'Moderný', skandinavsky: 'Škandinávsky', klasicky: 'Klasický' };
const VIDEA = { standard: ['Video Štandard', 29], premiove: ['Video Prémiové', 89] };
const STAVY = {
  nova: ['Prijatá', '#667085'],
  caka_platbu: ['Čaká na platbu', '#B54708'],
  zaplatena: ['Zaplatená', '#7728E6'],
  vo_vyrobe: ['Vo výrobe', '#7728E6'],
  dodana: ['Dodaná', '#12B76A'],
  zrusena: ['Zrušená', '#B42318'],
};

// ---------- ceny ----------
export function cenaZariadenia(n) {
  if (n <= 0) return 0;
  let c = 9 * n;
  if (n <= 5) c = Math.min(c, 29);
  return Math.min(c, 49);
}
export function vypocitaj({ sluzba, pocet, sVideom, video, novy }) {
  let z = 0, v = 0;
  if (sluzba === 'zariadenie') {
    z = cenaZariadenia(novy ? Math.max(0, pocet - 3) : pocet);
    if (sVideom && VIDEA[video]) { z = z / 2; v = VIDEA[video][1]; }
  } else if (VIDEA[sluzba]) v = VIDEA[sluzba][1];
  return { zariadenie: z, video: v, spolu: z + v };
}

// ---------- pomocné ----------
const eur = (x) => (Number.isInteger(+x) ? String(+x) : (+x).toFixed(2).replace('.', ',')) + ' €';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const kratko = (s, n = 500) => String(s ?? '').trim().slice(0, n);
const teraz = () => new Date().toISOString();
const cas = (iso) => { try { return new Date(iso).toLocaleString('sk-SK', { timeZone: 'Europe/Bratislava', day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return iso; } };
const nahodne = (n = 24) => { const a = new Uint8Array(n); crypto.getRandomValues(a); return [...a].map((b) => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join(''); };
const popisSluzby = (o) => o.sluzba === 'zariadenie'
  ? `Virtuálne zariadenie · ${o.pocet} ${o.pocet == 1 ? 'fotka' : o.pocet < 5 ? 'fotky' : 'fotiek'} · ${STYLY[o.styl] || ''}${o.s_videom && VIDEA[o.video] ? ' + ' + VIDEA[o.video][0] : ''}`
  : (VIDEA[o.sluzba] || ['Služba'])[0];

async function hmac(env, text) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.ADMIN_KEY || 'x'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const s = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(text));
  return [...new Uint8Array(s)].slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('');
}
function rovnake(a, b) { if (!a || !b || a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; }

function cors(origin) {
  const h = { 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-Zdroj', 'Access-Control-Max-Age': '86400', 'Vary': 'Origin' };
  if (POVOLENE.includes(origin)) h['Access-Control-Allow-Origin'] = origin;
  return h;
}
const json = (data, status, origin) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors(origin) } });
const html = (body, status = 200, extra = {}) => new Response(body, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex', 'Referrer-Policy': 'no-referrer', ...extra } });
const presmeruj = (url, extra = {}) => new Response(null, { status: 303, headers: { Location: url, ...extra } });

async function tg(env, metoda, body) {
  const r = await fetch(`https://api.telegram.org/bot${env.TG_TOKEN}/${metoda}`, { method: 'POST', body });
  const j = await r.json().catch(() => ({}));
  if (!j.ok) throw new Error(`Telegram ${metoda}: ${j.description || r.status}`);
  return j.result;
}
async function tgSprava(env, text, tlacidla) {
  const m = new FormData();
  m.append('chat_id', env.TG_CHAT);
  m.append('parse_mode', 'HTML');
  m.append('disable_web_page_preview', 'true');
  m.append('text', text.slice(0, 4000));
  if (tlacidla) m.append('reply_markup', JSON.stringify({ inline_keyboard: tlacidla }));
  return tg(env, 'sendMessage', m);
}
async function tgSubory(env, subory, popisy, prefix) {
  // pošle do Telegramu (max 10 naraz) a vráti file_id – Telegram slúži aj ako úložisko fotiek
  const ids = [];
  for (let z = 0; z < subory.length; z += 10) {
    const g = new FormData();
    g.append('chat_id', env.TG_CHAT);
    const kus = subory.slice(z, z + 10);
    const media = kus.map((x, i) => {
      const k = z + i;
      const nazov = `${prefix}_${String(k + 1).padStart(2, '0')}_${(popisy[k] || 'subor').replace(/[^\p{L}\p{N}]+/gu, '-')}${/\.\w{2,4}$/.test(x.name || '') ? x.name.match(/\.\w{2,4}$/)[0] : '.jpg'}`;
      g.append(`f${i}`, x, nazov);
      return { type: 'document', media: `attach://f${i}`, caption: `${k + 1}. ${popisy[k] || ''}`.trim() };
    });
    if (media.length === 1) {
      const d = new FormData();
      d.append('chat_id', env.TG_CHAT);
      d.append('document', kus[0], g.get('f0').name);
      d.append('caption', media[0].caption);
      const r = await tg(env, 'sendDocument', d);
      ids.push({ id: r.document.file_id, nazov: r.document.file_name, popis: popisy[z] || '' });
    } else {
      g.append('media', JSON.stringify(media));
      const r = await tg(env, 'sendMediaGroup', g);
      r.forEach((m, i) => ids.push({ id: m.document.file_id, nazov: m.document.file_name, popis: popisy[z + i] || '' }));
    }
  }
  return ids;
}
async function zapisHistoriu(env, cislo, udalost) {
  await env.DB.prepare('INSERT INTO historia (cislo, cas, udalost) VALUES (?, ?, ?)').bind(cislo, teraz(), udalost).run();
}
async function nacitaj(env, cislo) {
  const o = await env.DB.prepare('SELECT * FROM objednavky WHERE cislo = ?').bind(cislo).first();
  if (o) { o.fotky = JSON.parse(o.fotky || '[]'); o.vysledky = JSON.parse(o.vysledky || '[]'); }
  return o;
}
const stavUrl = (base, o) => `${base}/stav/${o.cislo}?t=${o.token}`;

// ---------- e-maily zákazníkom (Resend) ----------
function emailHtml(nadpis, odseky, tlacidlo, odkaz) {
  return `<!doctype html><html lang="sk"><body style="margin:0;background:#F4F5F9;font-family:Arial,Helvetica,sans-serif;color:#202436">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F5F9;padding:24px 12px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:16px;border:1px solid #E6E8EF">
<tr><td style="padding:22px 26px 6px;font-weight:800;font-size:17px;color:#7728E6">Realitný <span style="color:#202436">asistent</span></td></tr>
<tr><td style="padding:8px 26px 4px"><h1 style="font-size:21px;margin:0 0 10px;color:#202436">${esc(nadpis)}</h1>
${odseky.map((o) => `<p style="font-size:15px;line-height:1.55;margin:0 0 12px">${o}</p>`).join('')}
${tlacidlo ? `<p style="margin:18px 0 22px"><a href="${odkaz}" style="display:inline-block;background:#7728E6;color:#fff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:10px">${esc(tlacidlo)}</a></p>` : ''}
</td></tr>
<tr><td style="padding:14px 26px 22px;border-top:1px solid #EEF0F5;font-size:13px;color:#667085">Realitný asistent · <a href="mailto:info@realitnyasistent.eu" style="color:#7728E6">info@realitnyasistent.eu</a> · <a href="${WEB}" style="color:#7728E6">realitnyasistent.eu</a><br>Na tento e-mail môžete priamo odpovedať.</td></tr>
</table></td></tr></table></body></html>`;
}
async function posliEmail(env, o, druh, base) {
  if (!env.RESEND_KEY || !o.email) return false;
  const uz = await env.DB.prepare('SELECT 1 FROM historia WHERE cislo = ? AND udalost = ?').bind(o.cislo, `E-mail odoslaný: ${druh}`).first();
  if (uz) return false;
  const su = stavUrl(base, o);
  let predmet, html, text;
  if (druh === 'potvrdenie') {
    predmet = `Potvrdenie objednávky ${o.cislo}`;
    const p = [`Dobrý deň${o.meno ? ', ' + esc(o.meno.split(' ')[0]) : ''},`,
      `ďakujeme za objednávku <b>${o.cislo}</b>: ${esc(popisSluzby(o))}, cena <b>${eur(o.cena)}</b>.`,
      o.zaplatene ? 'Platbu sme prijali, ďakujeme.' : 'Faktúru vám pošleme e-mailom.',
      'Hotové fotky alebo video vám pripravíme spravidla do 24 hodín. Keď budú hotové, pošleme vám e-mail a stiahnete si ich na stránke objednávky.'];
    html = emailHtml('Ďakujeme za objednávku', p, 'Stav objednávky', su);
  } else {
    predmet = `Objednávka ${o.cislo} je hotová`;
    const p = [`Dobrý deň${o.meno ? ', ' + esc(o.meno.split(' ')[0]) : ''},`,
      `vaša objednávka <b>${o.cislo}</b> (${esc(popisSluzby(o))}) je hotová. Výsledky si stiahnete kliknutím na tlačidlo nižšie.`,
      o.sluzba === 'zariadenie' ? 'Virtuálne zariadené fotky prosím v inzeráte označte ako virtuálne zariadené, aby kupujúci vedel, že nábytok nie je súčasťou predaja.' : null,
      'Ak budete chcieť niečo upraviť, stačí odpovedať na tento e-mail. Prajeme úspešný predaj.'].filter(Boolean);
    html = emailHtml('Vaša objednávka je hotová', p, 'Stiahnuť výsledky', su);
  }
  text = html.replace(/<a [^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/g, '$2: $1').replace(/<[^>]+>/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n\n').trim();
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'Realitný asistent <info@realitnyasistent.eu>', to: [o.email], reply_to: 'info@realitnyasistent.eu', subject: predmet, html, text }),
  });
  if (!r.ok) {
    const chyba = await r.text().catch(() => '');
    await zapisHistoriu(env, o.cislo, `E-mail (${druh}) sa nepodarilo odoslať: ${chyba.slice(0, 200)}`);
    await tgSprava(env, `⚠️ ${o.cislo}: e-mail „${druh}“ sa nepodarilo odoslať zákazníkovi – pošli ho ručne z prehľadu.`).catch(() => {});
    return false;
  }
  await zapisHistoriu(env, o.cislo, `E-mail odoslaný: ${druh}`);
  return true;
}

// ---------- Stripe ----------
async function stripeCheckout(env, base, o) {
  const p = new URLSearchParams();
  p.set('mode', 'payment');
  p.set('locale', 'sk');
  p.set('customer_email', o.email);
  p.set('success_url', `${stavUrl(base, o)}&zaplatene=1`);
  p.set('cancel_url', `${stavUrl(base, o)}&zrusene=1`);
  p.set('line_items[0][quantity]', '1');
  p.set('line_items[0][price_data][currency]', 'eur');
  p.set('line_items[0][price_data][unit_amount]', String(Math.round(o.cena * 100)));
  p.set('line_items[0][price_data][product_data][name]', `${popisSluzby(o)} (${o.cislo})`);
  p.set('metadata[cislo]', o.cislo);
  p.set('payment_intent_data[metadata][cislo]', o.cislo);
  p.set('invoice_creation[enabled]', 'true');
  const r = await fetch('https://api.stripe.com/v1/checkout/sessions', { method: 'POST', headers: { Authorization: `Bearer ${env.STRIPE_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: p });
  const j = await r.json();
  if (!r.ok) throw new Error('Stripe: ' + (j.error && j.error.message));
  return j;
}
async function stripeOverPodpis(env, telo, hlavicka) {
  const casti = Object.fromEntries((hlavicka || '').split(',').map((x) => x.split('=')));
  if (!casti.t || !casti.v1) return false;
  if (Math.abs(Date.now() / 1000 - +casti.t) > 600) return false;
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.STRIPE_WEBHOOK_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const s = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(`${casti.t}.${telo}`));
  const hex = [...new Uint8Array(s)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return (hlavicka.match(/v1=([0-9a-f]+)/g) || []).some((v) => rovnake(v.slice(3), hex));
}

// ---------- nová objednávka ----------
async function novaObjednavka(req, env, origin, base) {
  let f;
  try { f = await req.formData(); } catch { return json({ ok: false, chyba: 'Neplatné údaje formulára' }, 400, origin); }
  if (kratko(f.get('web'))) return json({ ok: true, cislo: 'OK' }, 200, origin);

  const sluzba = kratko(f.get('sluzba'), 20);
  const meno = kratko(f.get('meno'), 120), email = kratko(f.get('email'), 160), telefon = kratko(f.get('telefon'), 40);
  const inzerat = kratko(f.get('inzerat'), 600), poznamka = kratko(f.get('poznamka'), 2000), kod = kratko(f.get('kod'), 40);
  const styl = STYLY[f.get('styl')] ? f.get('styl') : 'moderny';
  const sVideom = f.get('s_videom') === 'ano', video = VIDEA[f.get('video')] ? f.get('video') : 'standard', novy = f.get('novy') === 'ano';
  const zdroj = req.headers.get('X-Zdroj') === 'aplikacia' ? 'aplikácia' : 'web';

  if (!['zariadenie', 'standard', 'premiove'].includes(sluzba)) return json({ ok: false, chyba: 'Vyberte službu.' }, 400, origin);
  if (!meno || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ ok: false, chyba: 'Vyplňte meno a platný e-mail.' }, 400, origin);
  if (f.get('suhlas') !== 'ano') return json({ ok: false, chyba: 'Potvrďte súhlas s obchodnými podmienkami.' }, 400, origin);
  if (inzerat && !/^https?:\/\//i.test(inzerat)) return json({ ok: false, chyba: 'Odkaz na inzerát musí začínať https://' }, 400, origin);

  const fotky = f.getAll('fotky').filter((x) => x && typeof x === 'object' && x.size > 0);
  const miestnosti = f.getAll('miestnost').map((x) => kratko(x, 40));
  if (fotky.length > MAX_FOTIEK) return json({ ok: false, chyba: `Najviac ${MAX_FOTIEK} fotiek v jednej objednávke.` }, 400, origin);
  for (const x of fotky) {
    if (x.size > MAX_FOTKA) return json({ ok: false, chyba: `Fotka ${x.name} je väčšia ako 15 MB.` }, 400, origin);
    if (x.type && !x.type.startsWith('image/')) return json({ ok: false, chyba: `Súbor ${x.name} nie je fotka.` }, 400, origin);
  }
  let pocet = fotky.length;
  if (sluzba === 'zariadenie' && !pocet) pocet = Math.min(MAX_FOTIEK, Math.max(0, parseInt(f.get('pocet') || '0', 10) || 0));
  if (sluzba === 'zariadenie' && !pocet) return json({ ok: false, chyba: 'Nahrajte fotky alebo uveďte počet fotiek z inzerátu.' }, 400, origin);
  if (!fotky.length && !inzerat) return json({ ok: false, chyba: 'Vložte odkaz na inzerát alebo nahrajte fotky.' }, 400, origin);

  const c = vypocitaj({ sluzba, pocet, sVideom, video, novy });
  const d = new Date();
  const o = {
    cislo: `RA-${d.toISOString().slice(2, 10).replace(/-/g, '')}-${nahodne(4).toUpperCase()}`,
    vytvorene: teraz(), zdroj, sluzba, pocet: sluzba === 'zariadenie' ? pocet : 0, styl: sluzba === 'zariadenie' ? styl : null,
    s_videom: sluzba === 'zariadenie' && sVideom ? 1 : 0, video: sluzba === 'zariadenie' && sVideom ? video : null, novy: sluzba === 'zariadenie' && novy ? 1 : 0,
    kod, meno, email, telefon, inzerat, poznamka, cena: c.spolu, token: nahodne(24),
  };
  const platbaKartou = !!(env.STRIPE_KEY && env.STRIPE_WEBHOOK_SECRET && o.cena > 0 && !o.novy && !o.kod);
  o.stav = platbaKartou ? 'caka_platbu' : 'nova';

  await env.DB.prepare(`INSERT INTO objednavky (cislo, vytvorene, aktualizovane, zdroj, sluzba, pocet, styl, s_videom, video, novy, kod, meno, email, telefon, inzerat, poznamka, cena, stav, token)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(o.cislo, o.vytvorene, o.vytvorene, o.zdroj, o.sluzba, o.pocet, o.styl, o.s_videom, o.video, o.novy, o.kod, o.meno, o.email, o.telefon, o.inzerat, o.poznamka, o.cena, o.stav, o.token).run();
  await zapisHistoriu(env, o.cislo, `Objednávka prijatá (${zdroj})`);

  const riadky = [
    `🆕 <b>Nová objednávka ${o.cislo}</b> (${zdroj})`, '',
    sluzba === 'zariadenie' ? `🛋 <b>${esc(popisSluzby(o))}</b>` : `🎬 <b>${esc(popisSluzby(o))}</b>`,
    o.novy ? '🎁 Nový klient – žiada prvé 3 fotky zadarmo (over!)' : null,
    kod ? `🤝 Odporúčací kód: <b>${esc(kod)}</b>` : null,
    `💶 <b>${eur(o.cena)}</b> · ${platbaKartou ? 'čaká na platbu kartou' : 'platba faktúrou'}`, '',
    `👤 ${esc(meno)}`, `✉️ ${esc(email)}`,
    telefon ? `📞 ${esc(telefon)}` : null,
    inzerat ? `🔗 ${esc(inzerat)}` : null,
    poznamka ? `\n📝 ${esc(poznamka)}` : null,
  ].filter((r) => r !== null);
  const odkaz = `${base}/admin/o/${o.cislo}?s=${await hmac(env, 'o:' + o.cislo)}`;

  let platba_url = null;
  try {
    await tgSprava(env, riadky.join('\n'), [[{ text: '📋 Otvoriť objednávku', url: odkaz }]]);
    if (fotky.length) {
      const ids = await tgSubory(env, fotky, miestnosti, o.cislo);
      await env.DB.prepare('UPDATE objednavky SET fotky = ? WHERE cislo = ?').bind(JSON.stringify(ids), o.cislo).run();
    }
    if (platbaKartou) {
      const s = await stripeCheckout(env, base, o);
      platba_url = s.url;
      await env.DB.prepare('UPDATE objednavky SET platba = ? WHERE cislo = ?').bind(s.id, o.cislo).run();
    }
  } catch (e) {
    console.log('chyba', e.message);
    await zapisHistoriu(env, o.cislo, 'Chyba pri spracovaní: ' + e.message).catch(() => {});
    if (/Telegram/.test(e.message)) return json({ ok: false, chyba: 'Objednávku sa nepodarilo odoslať. Skúste to znova alebo nám napíšte na info@realitnyasistent.eu.' }, 502, origin);
    if (platbaKartou && !platba_url) { // Stripe zlyhal – objednávka ostáva, zaplatí faktúrou
      o.stav = 'nova';
      await env.DB.prepare("UPDATE objednavky SET stav = 'nova' WHERE cislo = ?").bind(o.cislo).run();
      await tgSprava(env, `⚠️ ${o.cislo}: platobnú bránu sa nepodarilo otvoriť – vybav faktúrou.`).catch(() => {});
    }
  }
  if (o.stav === 'nova') await posliEmail(env, o, 'potvrdenie', base).catch((e) => console.log('email', e.message));
  return json({ ok: true, cislo: o.cislo, cena: o.cena, stav_url: stavUrl(base, o), platba_url }, 200, origin);
}

// ---------- vzhľad stránok ----------
const LOGO = '<svg viewBox="0 0 48 44" width="34" height="31" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 21 24 4l20 17"/><path d="M9 17v23h30V17"/><rect x="18.5" y="22" width="11" height="10" rx="1" stroke-width="3"/></svg>';
function stranka(titul, obsah, admin = false) {
  return `<!doctype html><html lang="sk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(titul)}</title>
<link rel="icon" href="${WEB}/ikona.png">
<style>
*{box-sizing:border-box}body{margin:0;font:15px/1.5 Inter,system-ui,-apple-system,Segoe UI,sans-serif;background:#F4F5F9;color:#202436}
a{color:#7728E6}.top{background:#fff;border-bottom:1px solid #E6E8EF;padding:12px 18px;display:flex;align-items:center;gap:10px;position:sticky;top:0;z-index:5}
.top .lg{color:#7728E6;display:flex;align-items:center;gap:8px;text-decoration:none;font-weight:800;font-size:15px;line-height:1.05}.top .lg span{color:#202436}
.top .sp{flex:1}.wrap{max-width:${admin ? 1100 : 720}px;margin:0 auto;padding:22px 16px 60px}
h1{font-size:24px;margin:0 0 6px}h2{font-size:18px;margin:0 0 12px}.mut{color:#667085}
.card{background:#fff;border:1px solid #E6E8EF;border-radius:16px;padding:18px;margin-top:16px}
.pill{display:inline-block;padding:3px 10px;border-radius:999px;font-size:12.5px;font-weight:700;color:#fff;white-space:nowrap}
.btn{display:inline-flex;align-items:center;gap:6px;border:0;border-radius:10px;padding:10px 16px;font:600 14px inherit;font-family:inherit;background:linear-gradient(135deg,#8B3DF0,#6A22D8);color:#fff;cursor:pointer;text-decoration:none}
.btn.sec{background:#fff;color:#7728E6;border:1.5px solid #CDB8F7}.btn.red{background:#fff;color:#B42318;border:1.5px solid #F5C2C0}.btn.sm{padding:6px 11px;font-size:13px}
table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:10px 8px;border-bottom:1px solid #EEF0F5;vertical-align:top;font-size:14px}th{color:#667085;font-weight:600;font-size:12.5px}
tr.kl{cursor:pointer}tr.kl:hover td{background:#FBF8FF}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}.grid a{display:block;border:1px solid #E6E8EF;border-radius:10px;overflow:hidden;text-decoration:none;color:#202436;background:#fff}
.grid img{display:block;width:100%;aspect-ratio:4/3;object-fit:cover;background:#F4F5F9}.grid span{display:block;padding:6px 8px;font-size:12.5px}
dl{display:grid;grid-template-columns:140px 1fr;gap:6px 12px;margin:0}dt{color:#667085}dd{margin:0;word-break:break-word}
.row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.filt a{padding:6px 12px;border-radius:999px;background:#fff;border:1px solid #E6E8EF;text-decoration:none;color:#202436;font-size:13.5px}.filt a.on{background:#7728E6;color:#fff;border-color:#7728E6}
textarea,input[type=text],input[type=email]{width:100%;font:inherit;border:1.5px solid #E6E8EF;border-radius:10px;padding:10px 12px}
.krok{display:flex;gap:12px;align-items:flex-start;padding:10px 0}.krok i{flex:none;width:28px;height:28px;border-radius:50%;display:grid;place-items:center;font-style:normal;font-weight:800;font-size:13px;background:#EEF0F5;color:#667085}
.krok.ok i{background:#7728E6;color:#fff}.krok b{display:block}.ok-box{background:#ECFDF3;border:1px solid #ABEFC6;color:#067647;border-radius:12px;padding:12px 14px;margin-top:14px}
.warn{background:#FFFAEB;border:1px solid #FEDF89;color:#93370D;border-radius:12px;padding:12px 14px;margin-top:14px}
.hist div{font-size:13.5px;padding:5px 0;border-bottom:1px dashed #E6E8EF}.hist small{color:#667085;margin-right:8px}
@media(max-width:640px){dl{grid-template-columns:1fr}dt{margin-top:6px}.hm{display:none}}
</style></head><body><div class="top"><a class="lg" href="${admin ? '/admin' : WEB}">${LOGO}<b>Realitný<br><span>asistent</span></b></a><div class="sp"></div>${admin ? '<span class="mut" style="font-size:13px">Prehľad objednávok</span>' : ''}</div><div class="wrap">${obsah}</div></body></html>`;
}
const pillStav = (s) => { const [t, f] = STAVY[s] || [s, '#667085']; return `<span class="pill" style="background:${f}">${esc(t)}</span>`; };
async function fotoUrl(env, base, id) { return `${base}/f/${encodeURIComponent(id)}?s=${await hmac(env, 'f:' + id)}`; }
async function galeria(env, base, zoznam) {
  if (!zoznam.length) return '<p class="mut">Žiadne súbory.</p>';
  const p = await Promise.all(zoznam.map(async (x) => {
    const u = await fotoUrl(env, base, x.id);
    const obr = /\.(jpe?g|png|webp|gif)$/i.test(x.nazov || '.jpg');
    return `<a href="${u}" target="_blank" rel="noopener">${obr ? `<img src="${u}" alt="" loading="lazy">` : '<div style="aspect-ratio:4/3;display:grid;place-items:center;background:#F6F0FF;font-size:30px">🎬</div>'}<span>${esc(x.popis || x.nazov || '')}</span></a>`;
  }));
  return `<div class="grid">${p.join('')}</div>`;
}

// ---------- admin ----------
async function jeAdmin(req, env, url, cislo) {
  if (!env.ADMIN_KEY) return false;
  const cookie = (req.headers.get('Cookie') || '').match(/ra_admin=([^;]+)/);
  if (cookie && rovnake(cookie[1], env.ADMIN_KEY)) return true;
  const k = url.searchParams.get('k');
  if (k && rovnake(k, env.ADMIN_KEY)) return 'nastav';
  const s = url.searchParams.get('s');
  if (cislo && s && rovnake(s, await hmac(env, 'o:' + cislo))) return 'jedna';
  return false;
}
const adminCookie = (env) => ({ 'Set-Cookie': `ra_admin=${env.ADMIN_KEY}; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax` });

async function adminZoznam(env, url) {
  const f = url.searchParams.get('stav') || 'otvorene';
  let q = 'SELECT cislo, vytvorene, zdroj, sluzba, pocet, styl, s_videom, video, meno, email, cena, stav, zaplatene FROM objednavky';
  if (f === 'otvorene') q += " WHERE stav NOT IN ('dodana','zrusena')";
  else if (STAVY[f]) q += ' WHERE stav = ?';
  q += ' ORDER BY vytvorene DESC LIMIT 200';
  const st = env.DB.prepare(q);
  const { results } = STAVY[f] ? await st.bind(f).all() : await st.all();
  const sum = await env.DB.prepare("SELECT COUNT(*) n, COALESCE(SUM(CASE WHEN zaplatene=1 THEN cena ELSE 0 END),0) z FROM objednavky WHERE stav != 'zrusena' AND vytvorene >= ?").bind(new Date(Date.now() - 30 * 864e5).toISOString()).first();
  const filt = [['otvorene', 'Otvorené'], ...Object.entries(STAVY).map(([k, v]) => [k, v[0]]), ['vsetky', 'Všetky']]
    .map(([k, t]) => `<a href="/admin?stav=${k}" class="${k === f ? 'on' : ''}">${t}</a>`).join('');
  const riadky = results.map((o) => `<tr class="kl" onclick="location='/admin/o/${o.cislo}'"><td><b>${o.cislo}</b><div class="mut" style="font-size:12.5px">${cas(o.vytvorene)} · ${esc(o.zdroj)}</div></td><td>${esc(o.meno)}<div class="mut hm" style="font-size:12.5px">${esc(o.email)}</div></td><td class="hm">${esc(popisSluzby(o))}</td><td>${eur(o.cena)}${o.zaplatene ? ' ✓' : ''}</td><td>${pillStav(o.stav)}</td></tr>`).join('');
  return stranka('Objednávky – Realitný asistent', `<h1>Objednávky</h1><p class="mut">Za posledných 30 dní: ${sum.n} objednávok · zaplatené ${eur(sum.z)}</p>
  <div class="row filt" style="margin-top:12px">${filt}</div>
  <div class="card" style="padding:6px 10px"><table><thead><tr><th>Číslo</th><th>Zákazník</th><th class="hm">Služba</th><th>Cena</th><th>Stav</th></tr></thead><tbody>${riadky || '<tr><td colspan="5" class="mut" style="padding:20px">Žiadne objednávky.</td></tr>'}</tbody></table></div>`, true);
}

async function adminDetail(env, base, cislo, sprava) {
  const o = await nacitaj(env, cislo);
  if (!o) return html(stranka('Nenájdené', '<h1>Objednávka neexistuje</h1><p><a href="/admin">Späť na zoznam</a></p>', true), 404);
  const { results: hist } = await env.DB.prepare('SELECT cas, udalost FROM historia WHERE cislo = ? ORDER BY id DESC LIMIT 50').bind(cislo).all();
  const su = stavUrl(base, o);
  const predmet = `Objednávka ${o.cislo} – ${o.stav === 'dodana' ? 'hotovo' : 'potvrdenie'}`;
  const telo = o.stav === 'dodana'
    ? `Dobrý deň,\n\nvaša objednávka ${o.cislo} (${popisSluzby(o)}) je hotová. Výsledky si stiahnete tu:\n${su}\n\nVirtuálne zariadené fotky prosím v inzeráte označte ako virtuálne zariadené.\n\nĎakujeme a prajeme úspešný predaj.\nRealitný asistent\ninfo@realitnyasistent.eu`
    : `Dobrý deň,\n\nďakujeme za objednávku ${o.cislo} (${popisSluzby(o)}, ${eur(o.cena)}). Pracujeme na nej a hotové ju dostanete spravidla do 24 hodín. Stav objednávky sledujete tu:\n${su}\n\nFaktúru posielame v prílohe.\n\nS pozdravom\nRealitný asistent\ninfo@realitnyasistent.eu`;
  const mailto = `mailto:${encodeURIComponent(o.email)}?subject=${encodeURIComponent(predmet)}&body=${encodeURIComponent(telo)}`;
  const tl = (stav, text, trieda = 'sec') => o.stav === stav ? '' : `<button class="btn ${trieda} sm" name="stav" value="${stav}">${text}</button>`;
  return html(stranka(`${o.cislo} – objednávka`, `<p><a href="/admin">← Všetky objednávky</a></p>
  ${sprava ? `<div class="ok-box">${esc(sprava)}</div>` : ''}
  <div class="row" style="justify-content:space-between"><h1>${o.cislo}</h1>${pillStav(o.stav)}</div>
  <p class="mut" style="margin:0">${cas(o.vytvorene)} · cez ${esc(o.zdroj)}</p>
  <div class="card"><h2>Zmeniť stav</h2><form method="post" action="/admin/o/${o.cislo}/stav" class="row">
    ${tl('vo_vyrobe', '🛠 Vo výrobe', '')}${tl('dodana', '📦 Dodaná', '')}${o.zaplatene ? '' : '<button class="btn sec sm" name="zaplatene" value="1">💶 Označiť ako zaplatenú</button>'}${tl('nova', 'Vrátiť na Prijatá')}${tl('zrusena', 'Zrušiť', 'red')}
  </form></div>
  <div class="card"><h2>Objednávka</h2><dl>
    <dt>Služba</dt><dd><b>${esc(popisSluzby(o))}</b></dd>
    <dt>Cena</dt><dd><b>${eur(o.cena)}</b> · ${o.zaplatene ? '✓ zaplatené' : 'nezaplatené'}${o.platba ? ' · Stripe' : ''}</dd>
    ${o.novy ? '<dt>Nový klient</dt><dd>🎁 žiada prvé 3 fotky zadarmo – over, či je naozaj nový</dd>' : ''}
    ${o.kod ? `<dt>Odporúčací kód</dt><dd>${esc(o.kod)} (−10 % vo faktúre)</dd>` : ''}
    <dt>Zákazník</dt><dd>${esc(o.meno)}</dd>
    <dt>E-mail</dt><dd><a href="mailto:${esc(o.email)}">${esc(o.email)}</a></dd>
    ${o.telefon ? `<dt>Telefón</dt><dd><a href="tel:${esc(o.telefon)}">${esc(o.telefon)}</a></dd>` : ''}
    ${o.inzerat ? `<dt>Inzerát</dt><dd><a href="${esc(o.inzerat)}" target="_blank" rel="noopener">${esc(o.inzerat)}</a></dd>` : ''}
    ${o.poznamka ? `<dt>Poznámka</dt><dd style="white-space:pre-wrap">${esc(o.poznamka)}</dd>` : ''}
    <dt>Pre zákazníka</dt><dd><a href="${su}" target="_blank" rel="noopener">stránka so stavom objednávky</a></dd>
  </dl></div>
  <div class="card"><h2>Fotky od zákazníka (${o.fotky.length})</h2>${await galeria(env, base, o.fotky)}</div>
  <div class="card"><h2>Hotové výsledky (${o.vysledky.length})</h2>${await galeria(env, base, o.vysledky)}
    <form method="post" action="/admin/o/${o.cislo}/vysledky" enctype="multipart/form-data" style="margin-top:14px">
      <input type="file" name="subory" multiple accept="image/*,video/*" required>
      <label style="display:flex;gap:8px;align-items:center;margin:10px 0"><input type="checkbox" name="dodat" value="1" checked> po nahratí označiť ako Dodaná</label>
      <button class="btn">Nahrať výsledky</button>
      <p class="mut" style="font-size:13px">Zákazník si ich stiahne na svojej stránke so stavom objednávky. Fotky sa uložia aj do Telegramu.</p>
    </form></div>
  <div class="card"><h2>E-mail zákazníkovi</h2>${env.RESEND_KEY ? '<p class="mut" style="margin-top:0">Potvrdenie a e-mail „hotovo“ odchádzajú zákazníkovi automaticky (pozri Históriu). Tento koncept použi len pri potrebe.</p>' : '<p class="mut" style="margin-top:0">Pripravený koncept – otvorí sa v tvojom e-maile, odošleš ho ty. (Automatické e-maily sa zapnú po nastavení Resend.)</p>'}
    <a class="btn sec" href="${mailto}">✉️ Otvoriť koncept: ${o.stav === 'dodana' ? 'hotovo' : 'potvrdenie'}</a>
    <details style="margin-top:10px"><summary class="mut">Zobraziť text</summary><pre style="white-space:pre-wrap;font:inherit;background:#F4F5F9;padding:12px;border-radius:10px">${esc(telo)}</pre></details></div>
  <div class="card"><h2>Interná poznámka</h2><form method="post" action="/admin/o/${o.cislo}/poznamka"><textarea name="interna" rows="3">${esc(o.interna || '')}</textarea><button class="btn sec sm" style="margin-top:8px">Uložiť</button></form></div>
  <div class="card hist"><h2>História</h2>${hist.map((h) => `<div><small>${cas(h.cas)}</small>${esc(h.udalost)}</div>`).join('')}</div>`, true));
}

async function adminAkcia(req, env, base, cislo, akcia) {
  const o = await nacitaj(env, cislo);
  if (!o) return html('Nenájdené', 404);
  const f = await req.formData();
  let sprava = '';
  if (akcia === 'stav') {
    if (f.get('zaplatene') === '1') {
      await env.DB.prepare("UPDATE objednavky SET zaplatene = 1, stav = CASE WHEN stav IN ('nova','caka_platbu') THEN 'zaplatena' ELSE stav END, aktualizovane = ? WHERE cislo = ?").bind(teraz(), cislo).run();
      await zapisHistoriu(env, cislo, 'Označená ako zaplatená (ručne)');
      sprava = 'Označené ako zaplatené.';
    }
    const s = f.get('stav');
    if (s && STAVY[s]) {
      await env.DB.prepare('UPDATE objednavky SET stav = ?, aktualizovane = ? WHERE cislo = ?').bind(s, teraz(), cislo).run();
      await zapisHistoriu(env, cislo, `Stav: ${STAVY[s][0]}`);
      sprava = `Stav zmenený na: ${STAVY[s][0]}.`;
    }
  } else if (akcia === 'poznamka') {
    await env.DB.prepare('UPDATE objednavky SET interna = ?, aktualizovane = ? WHERE cislo = ?').bind(kratko(f.get('interna'), 4000), teraz(), cislo).run();
    sprava = 'Poznámka uložená.';
  } else if (akcia === 'vysledky') {
    const subory = f.getAll('subory').filter((x) => x && typeof x === 'object' && x.size > 0);
    if (subory.length) {
      const ids = await tgSubory(env, subory, subory.map((x) => x.name.replace(/\.\w+$/, '')), `${cislo}_hotove`);
      const vsetky = [...o.vysledky, ...ids];
      const dodat = f.get('dodat') === '1';
      await env.DB.prepare(`UPDATE objednavky SET vysledky = ?, ${dodat ? "stav = 'dodana', " : ''}aktualizovane = ? WHERE cislo = ?`).bind(JSON.stringify(vsetky), teraz(), cislo).run();
      await zapisHistoriu(env, cislo, `Nahraté výsledky: ${ids.length}${dodat ? ' · Dodaná' : ''}`);
      sprava = `Nahraté ${ids.length} ${ids.length === 1 ? 'súbor' : 'súbory'}.${dodat ? ' Objednávka je Dodaná – pošli zákazníkovi e-mail (koncept nižšie).' : ''}`;
    }
  }
  const po = await nacitaj(env, cislo);
  if (po && po.stav === 'dodana' && po.vysledky.length) {
    if (await posliEmail(env, po, 'hotovo', base).catch(() => false)) sprava += ' Zákazníkovi sme poslali e-mail s výsledkami.';
  }
  return presmeruj(`/admin/o/${cislo}?m=${encodeURIComponent(sprava)}`);
}

// ---------- stránka pre zákazníka ----------
async function stavZakaznika(env, base, cislo, url) {
  const o = await nacitaj(env, cislo);
  if (!o || !rovnake(url.searchParams.get('t') || '', o.token)) return html(stranka('Objednávka nenájdená', '<h1>Objednávka nenájdená</h1><p class="mut">Skontrolujte odkaz alebo nám napíšte na <a href="mailto:info@realitnyasistent.eu">info@realitnyasistent.eu</a>.</p>'), 404);
  const poradie = ['nova', 'zaplatena', 'vo_vyrobe', 'dodana'];
  const ix = Math.max(0, poradie.indexOf(o.stav));
  const kroky = [['Objednávka prijatá', 'Máme všetko, čo potrebujeme.'], ['Potvrdená', 'Objednávku sme potvrdili.'], ['Vo výrobe', 'Pracujeme na nej.'], ['Hotovo', 'Výsledky si stiahnete nižšie.']]
    .map(([t, p], i) => `<div class="krok ${i <= ix ? 'ok' : ''}"><i>${i + 1}</i><div><b>${t}</b><span class="mut">${p}</span></div></div>`).join('');
  let hore = '';
  if (url.searchParams.get('zaplatene')) hore = '<div class="ok-box">Ďakujeme, platba prebehla. Potvrdenie a faktúru vám pošleme e-mailom.</div>';
  if (url.searchParams.get('zrusene') && !o.zaplatene) hore = '<div class="warn">Platba nebola dokončená. Objednávku máme uloženú – zaplatiť môžete znova nižšie, alebo nám napíšte.</div>';
  const zaplatit = o.stav === 'caka_platbu' && o.platba ? `<a class="btn" href="${base}/zaplatit/${o.cislo}?t=${o.token}" style="margin-top:12px">💳 Zaplatiť ${eur(o.cena)}</a>` : '';
  return html(stranka(`Objednávka ${o.cislo}`, `${hore}<h1>Objednávka ${o.cislo}</h1><p class="mut" style="margin:0">${esc(popisSluzby(o))} · ${eur(o.cena)}</p>
  <div class="card">${o.stav === 'zrusena' ? '<p><b>Objednávka bola zrušená.</b> Ak ide o omyl, napíšte nám.</p>' : o.stav === 'caka_platbu' ? `<p><b>Čaká na platbu.</b> Na objednávke začneme pracovať hneď po zaplatení.</p>${zaplatit}` : kroky}</div>
  ${o.vysledky.length ? `<div class="card"><h2>Na stiahnutie</h2>${await galeria(env, base, o.vysledky)}<p class="mut" style="font-size:13px;margin-bottom:0">Virtuálne zariadené fotky prosím v inzeráte označte ako virtuálne zariadené.</p></div>` : ''}
  <p class="mut" style="margin-top:22px">Otázky? Napíšte nám na <a href="mailto:info@realitnyasistent.eu?subject=${encodeURIComponent('Objednávka ' + o.cislo)}">info@realitnyasistent.eu</a> a uveďte číslo objednávky.</p>`));
}

// ---------- súbory z Telegramu ----------
async function subor(env, id, url) {
  if (!rovnake(url.searchParams.get('s') || '', await hmac(env, 'f:' + id))) return new Response('Nepovolené', { status: 403 });
  const f = await fetch(`https://api.telegram.org/bot${env.TG_TOKEN}/getFile?file_id=${encodeURIComponent(id)}`).then((r) => r.json());
  if (!f.ok) return new Response('Súbor sa nenašiel', { status: 404 });
  const r = await fetch(`https://api.telegram.org/file/bot${env.TG_TOKEN}/${f.result.file_path}`);
  const nazov = f.result.file_path.split('/').pop();
  return new Response(r.body, { headers: { 'Content-Type': r.headers.get('Content-Type') || 'application/octet-stream', 'Cache-Control': 'private, max-age=86400', 'Content-Disposition': `inline; filename="${nazov}"` } });
}

// ---------- Stripe webhook ----------
async function stripeWebhook(req, env) {
  const telo = await req.text();
  if (!env.STRIPE_WEBHOOK_SECRET || !(await stripeOverPodpis(env, telo, req.headers.get('Stripe-Signature')))) return new Response('zly podpis', { status: 400 });
  const e = JSON.parse(telo);
  if (e.type === 'checkout.session.completed' && e.data.object.payment_status === 'paid') {
    const cislo = e.data.object.metadata && e.data.object.metadata.cislo;
    const o = cislo && (await nacitaj(env, cislo));
    if (o && !o.zaplatene) {
      await env.DB.prepare("UPDATE objednavky SET zaplatene = 1, stav = 'zaplatena', aktualizovane = ? WHERE cislo = ?").bind(teraz(), cislo).run();
      await zapisHistoriu(env, cislo, `Zaplatené kartou (${eur(e.data.object.amount_total / 100)})`);
      o.zaplatene = 1;
      await posliEmail(env, o, 'potvrdenie', new URL(req.url).origin).catch(() => {});
      await tgSprava(env, `💳 <b>Zaplatené: ${cislo}</b>\n${esc(popisSluzby(o))} · ${eur(e.data.object.amount_total / 100)}\n👤 ${esc(o.meno)}`).catch(() => {});
    }
  }
  return new Response('ok');
}

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    const url = new URL(req.url);
    const base = url.origin;
    const cesta = url.pathname;
    try {
      if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
      if (req.method === 'GET' && cesta === '/') return json({ ok: true, sluzba: 'objednavky' }, 200, origin);

      if (req.method === 'POST' && cesta === '/objednavka') {
        if (origin && !POVOLENE.includes(origin)) return json({ ok: false, chyba: 'Nepovolený pôvod' }, 403, origin);
        return await novaObjednavka(req, env, origin, base);
      }
      if (req.method === 'POST' && cesta === '/stripe') return await stripeWebhook(req, env);

      let m;
      if (req.method === 'GET' && (m = cesta.match(/^\/f\/(.+)$/))) return await subor(env, decodeURIComponent(m[1]), url);
      if (req.method === 'GET' && (m = cesta.match(/^\/stav\/(RA-[\w-]+)$/))) return await stavZakaznika(env, base, m[1], url);
      if (req.method === 'GET' && (m = cesta.match(/^\/zaplatit\/(RA-[\w-]+)$/))) {
        const o = await nacitaj(env, m[1]);
        if (!o || !rovnake(url.searchParams.get('t') || '', o.token) || o.zaplatene || !env.STRIPE_KEY) return presmeruj(WEB);
        const s = await stripeCheckout(env, base, o);
        await env.DB.prepare('UPDATE objednavky SET platba = ? WHERE cislo = ?').bind(s.id, o.cislo).run();
        return presmeruj(s.url);
      }

      if (cesta === '/admin' || cesta.startsWith('/admin/')) {
        m = cesta.match(/^\/admin\/o\/(RA-[\w-]+)(?:\/(stav|poznamka|vysledky))?$/);
        const cislo = m && m[1];
        const ok = await jeAdmin(req, env, url, cislo);
        if (!ok) return html(stranka('Prístup zamietnutý', '<h1>Prístup zamietnutý</h1><p class="mut">Otvor prehľad cez svoj odkaz s kľúčom.</p>', true), 403);
        if (ok === 'nastav') { const u = new URL(url); u.searchParams.delete('k'); return presmeruj(u.pathname + u.search, adminCookie(env)); }
        if (ok === 'jedna' && req.method === 'POST') return html('Pre zmeny otvor prehľad cez svoj odkaz s kľúčom.', 403);
        if (req.method === 'GET' && cesta === '/admin') return html(await adminZoznam(env, url));
        if (m && !m[2] && req.method === 'GET') return await adminDetail(env, base, cislo, url.searchParams.get('m'));
        if (m && m[2] && req.method === 'POST') return await adminAkcia(req, env, base, cislo, m[2]);
      }
      return json({ ok: false, chyba: 'Nenájdené' }, 404, origin);
    } catch (e) {
      console.log('chyba', e.stack || e.message);
      return json({ ok: false, chyba: 'Nastala chyba. Skúste to znova alebo nám napíšte na info@realitnyasistent.eu.' }, 500, origin);
    }
  },
};
