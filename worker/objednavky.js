// Realitný asistent – objednávky (web aj aplikácia)
// Objednávka → databáza (D1) → Telegram (Marian) → prehľad /admin → stránka stavu pre zákazníka /stav
// Platba kartou cez Stripe sa zapne sama, keď sú nastavené STRIPE_KEY a STRIPE_WEBHOOK_SECRET.

import { chatOdpoved, chatKontakt, chatSuhrn, chatUdrzba, chatAdmin } from './chat.js';

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
export const REELS_CENA = 10;
// 1 fotka 5 €, celý inzerát (do 10 fotiek) 19 €
export function cenaZariadenia(n) {
  if (n <= 0) return 0;
  return Math.min(5 * n, 19);
}
export function vypocitaj({ sluzba, pocet, sVideom, video, novy, reels }) {
  let z = 0, v = 0, r = 0;
  if (sluzba === 'zariadenie') {
    z = cenaZariadenia(pocet);
    if (novy) z = Math.max(0, z - cenaZariadenia(Math.min(pocet, 3))); // prvé 3 fotky zadarmo
    if (sVideom && VIDEA[video]) { z = z / 2; v = VIDEA[video][1]; }
    if (reels) r = REELS_CENA;
  } else if (VIDEA[sluzba]) v = VIDEA[sluzba][1];
  return { zariadenie: z, video: v, reels: r, spolu: z + v + r };
}

// ---------- pomocné ----------
const eur = (x) => (Number.isInteger(+x) ? String(+x) : (+x).toFixed(2).replace('.', ',')) + ' €';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const kratko = (s, n = 500) => String(s ?? '').trim().slice(0, n);
const teraz = () => new Date().toISOString();
const cas = (iso) => { try { return new Date(iso).toLocaleString('sk-SK', { timeZone: 'Europe/Bratislava', day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return iso; } };
const nahodne = (n = 24) => { const a = new Uint8Array(n); crypto.getRandomValues(a); return [...a].map((b) => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join(''); };
const popisSluzby = (o) => o.sluzba === 'zariadenie'
  ? `Virtuálne zariadenie · ${o.pocet} ${o.pocet == 1 ? 'fotka' : o.pocet < 5 ? 'fotky' : 'fotiek'} · ${STYLY[o.styl] || ''}${o.reels ? ' + Reels pred/po' : ''}${o.s_videom && VIDEA[o.video] ? ' + ' + VIDEA[o.video][0] : ''}`
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
async function tgSubory(env, subory, popisy, prefix, _tichy) {
  // pošle do Telegramu (max 10 naraz) a vráti file_id – Telegram slúži aj ako úložisko fotiek
  const ids = [];
  for (let z = 0; z < subory.length; z += 10) {
    const g = new FormData();
    g.append('chat_id', env.TG_CHAT);
    g.append('disable_notification', 'true');
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
      d.append('disable_notification', 'true');
      d.append('document', kus[0], g.get('f0').name);
      d.append('disable_content_type_detection', 'true');
      d.append('caption', media[0].caption);
      const r = await tg(env, 'sendDocument', d);
      const dk = r.document || r.video || r.animation;
      ids.push({ id: dk.file_id, nazov: dk.file_name || g.get('f0').name, popis: popisy[z] || '' });
    } else {
      g.append('media', JSON.stringify(media));
      const r = await tg(env, 'sendMediaGroup', g);
      r.forEach((m, i) => { const dk = m.document || m.video || m.photo?.[0]; ids.push({ id: dk.file_id, nazov: dk.file_name || g.get('f' + i).name, popis: popisy[z + i] || '' }); });
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

// ---------- ochrana zľavy pre nových klientov ----------
function normEmail(e) {
  let [m, d] = String(e || '').trim().toLowerCase().split('@');
  if (!m || !d) return '';
  m = m.split('+')[0];
  if (d === 'gmail.com' || d === 'googlemail.com') { m = m.replace(/\./g, ''); d = 'gmail.com'; }
  return `${m}@${d}`;
}
function normTelefon(t) {
  const c = String(t || '').replace(/\D/g, '');
  return c.length >= 9 ? c.slice(-9) : '';
}
async function ipHash(env, req) {
  const ip = req.headers.get('CF-Connecting-IP') || '';
  return ip ? hmac(env, 'ip:' + ip) : '';
}
const bezDiakritiky = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z ]/g, ' ').split(/\s+/).filter((x) => x.length > 1).sort().join(' ');
async function hashSuboru(x) {
  const d = await crypto.subtle.digest('SHA-256', await x.arrayBuffer());
  return [...new Uint8Array(d)].slice(0, 16).map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function telefonyZInzeratu(url) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36' }, signal: AbortSignal.timeout(6000) });
    if (!r.ok) return [];
    const t = (await r.text()).slice(0, 800000);
    return [...new Set((t.match(/(?:\+421|00421|\b0)\s?9\d{2}[\s\/-]?\d{3}[\s\/-]?\d{3}\b/g) || []).map(normTelefon).filter(Boolean))].slice(0, 5);
  } catch { return []; }
}
const POPIS_STOPY = { email: 'na tento e-mail', tel: 'na toto telefónne číslo', ip: 'z tohto pripojenia', zid: 'z tohto zariadenia', foto: 's týmito fotkami', inz_tel: 'pre makléra s týmto inzerátom', meno: 'na toto meno' };
// stopy = [[druh, hodnota], ...] – vráti null = nový klient, inak dôvod
async function uzBolKlientom(env, stopy) {
  const st = stopy.filter(([, h]) => h);
  if (!st.length) return null;
  const polrok = new Date(Date.now() - 182 * 864e5).toISOString();
  const podm = st.map(() => "(s.druh = ? AND s.hodnota = ? AND (s.druh != 'ip' OR s.vytvorene > ?))").join(' OR ');
  const par = st.flatMap(([d, h]) => [d === 'inz_tel' ? 'tel' : d, h, polrok]);
  // telefón z inzerátu porovnáme s telefónmi zákazníkov aj s telefónmi z ich inzerátov
  const extra = st.filter(([d]) => d === 'inz_tel' || d === 'tel').map(() => "(s.druh IN ('tel','inz_tel') AND s.hodnota = ?)").join(' OR ');
  const parExtra = st.filter(([d]) => d === 'inz_tel' || d === 'tel').map(([, h]) => h);
  const r = await env.DB.prepare(`SELECT s.druh FROM stopy s JOIN objednavky o ON o.cislo = s.cislo
    WHERE o.stav != 'zrusena' AND (${podm}${extra ? ' OR ' + extra : ''}) LIMIT 1`).bind(...par, ...parExtra).first();
  return r ? (POPIS_STOPY[r.druh] || 'z vašich údajov') : null;
}
async function ulozStopy(env, cislo, stopy) {
  const t = teraz();
  const st = stopy.filter(([, h]) => h);
  if (st.length) await env.DB.batch(st.map(([d, h]) => env.DB.prepare('INSERT INTO stopy (cislo, druh, hodnota, vytvorene) VALUES (?, ?, ?, ?)').bind(cislo, d, h, t)));
}
async function overNovehoKlienta(req, env, origin) {
  let d = {};
  try { d = await req.json(); } catch { /* prázdne */ }
  const emailN = normEmail(d.email), telN = normTelefon(d.telefon);
  if (!emailN) return json({ ok: true, novy: null }, 200, origin);
  const zid = String(d.zid || '').slice(0, 80);
  const dovod = await uzBolKlientom(env, [['email', emailN], ['tel', telN], ['ip', await ipHash(env, req)], ['zid', zid ? await hmac(env, 'z:' + zid) : ''], ['meno', bezDiakritiky(d.meno)]]);
  return json({ ok: true, novy: !dovod, sprava: dovod ? `Zľavu pre nových klientov už nemôžeme uplatniť – ${dovod} sme už objednávku prijali. Ak ste u nás ešte neobjednávali, napíšte nám na info@realitnyasistent.eu a overíme to.` : '' }, 200, origin);
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
  const sVideom = f.get('s_videom') === 'ano', video = VIDEA[f.get('video')] ? f.get('video') : 'standard', novy = f.get('novy') === 'ano', reels = f.get('reels') === 'ano';
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

  const emailN = normEmail(email), telN = normTelefon(telefon), ipH = await ipHash(env, req);
  const zid = kratko(f.get('zid'), 80);
  const fotoHashe = [];
  for (const x of fotky) fotoHashe.push(await hashSuboru(x));
  const inzTel = novy && inzerat ? await telefonyZInzeratu(inzerat) : [];
  const stopy = [['email', emailN], ['tel', telN], ['ip', ipH], ['zid', zid ? await hmac(env, 'z:' + zid) : ''], ['meno', bezDiakritiky(meno)],
    ...fotoHashe.map((h) => ['foto', h]), ...inzTel.map((t) => ['inz_tel', t])];
  let novyOk = false, novyDovod = null;
  if (sluzba === 'zariadenie' && novy) {
    if (!telN) return json({ ok: false, chyba: 'Pre zľavu pre nových klientov vyplňte telefónne číslo.' }, 400, origin);
    if (kod) novyDovod = 'spolu s odporúčacím kódom (zľavy sa nespájajú)';
    else novyDovod = await uzBolKlientom(env, stopy);
    novyOk = !novyDovod;
  }
  let amb = null, ambKod = null, ambZlava = false;
  if (jeAmbKod(kod)) {
    amb = await ambasadorPodlaKodu(env, kod);
    if (!amb) return json({ ok: false, chyba: 'Tento kód ambasádora nepoznáme. Skontrolujte ho alebo pole nechajte prázdne.' }, 400, origin);
    if (amb.email_n === emailN || (telN && amb.telefon_n === telN) || (amb.zid_h && stopy.some(([d, h]) => d === 'zid' && h === amb.zid_h))) return json({ ok: false, chyba: 'Vlastný kód ambasádora nie je možné použiť na vlastnú objednávku.' }, 400, origin);
    ambKod = amb.kod;
    ambZlava = !(await uzBolKlientom(env, stopy.filter(([d]) => ['email', 'tel', 'zid'].includes(d))));
  } else if (!kod) {
    ambKod = await ambasadorKlienta(env, emailN, telN);
  }
  const c = vypocitaj({ sluzba, pocet, sVideom, video, novy: novyOk, reels });
  if (ambZlava) c.spolu = Math.round(c.spolu * (1 - pctZlava(amb)) * 100) / 100;
  const d = new Date();
  const o = {
    cislo: `RA-${d.toISOString().slice(2, 10).replace(/-/g, '')}-${nahodne(4).toUpperCase()}`,
    vytvorene: teraz(), zdroj, sluzba, pocet: sluzba === 'zariadenie' ? pocet : 0, styl: sluzba === 'zariadenie' ? styl : null,
    s_videom: sluzba === 'zariadenie' && sVideom ? 1 : 0, video: sluzba === 'zariadenie' && sVideom ? video : null, novy: novyOk ? 1 : 0, reels: sluzba === 'zariadenie' && reels ? 1 : 0,
    kod: ambKod || kod, meno, email, telefon, inzerat, poznamka, cena: c.spolu, token: nahodne(24),
  };
  const platbaKartou = !!(env.STRIPE_KEY && env.STRIPE_WEBHOOK_SECRET && o.cena > 0 && (!o.kod || jeAmbKod(o.kod)));
  o.stav = platbaKartou ? 'caka_platbu' : 'nova';

  await env.DB.prepare(`INSERT INTO objednavky (cislo, vytvorene, aktualizovane, zdroj, sluzba, pocet, styl, s_videom, video, novy, kod, meno, email, telefon, inzerat, poznamka, cena, stav, token, email_n, telefon_n, ip_h, novy_ok, reels)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(o.cislo, o.vytvorene, o.vytvorene, o.zdroj, o.sluzba, o.pocet, o.styl, o.s_videom, o.video, o.novy, o.kod, o.meno, o.email, o.telefon, o.inzerat, o.poznamka, o.cena, o.stav, o.token, emailN, telN, ipH, novyOk ? 1 : 0, o.reels).run();
  await zapisHistoriu(env, o.cislo, `Objednávka prijatá (${zdroj})`);
  await ulozStopy(env, o.cislo, stopy);
  if (ambKod) await zapisProviziu(env, ambKod, o);

  const riadky = [
    `🆕 <b>Nová objednávka ${o.cislo}</b> (${zdroj})`, '',
    sluzba === 'zariadenie' ? `🛋 <b>${esc(popisSluzby(o))}</b>` : `🎬 <b>${esc(popisSluzby(o))}</b>`,
    novyOk ? '🎁 Nový klient – overený, prvé 3 fotky zadarmo' : null,
    novyDovod ? `🚫 Žiadal zľavu pre nových klientov – zamietnutá (${novyDovod.startsWith('spolu') ? novyDovod : novyDovod + ' už bola objednávka'})` : null,
    ambKod ? `🤝 Ambasádor: <b>${esc(ambKod)}</b>${ambZlava ? ` (klient −${Math.round(pctZlava(amb) * 100)} %)` : ''}` : (kod ? `🤝 Odporúčací kód: <b>${esc(kod)}</b> (−10 % vo faktúre)` : null),
    `💶 <b>${eur(o.cena)}</b> · ${platbaKartou ? 'čaká na platbu kartou' : 'platba faktúrou'}`, '',
    `👤 ${esc(meno)}`, `✉️ ${esc(email)}`,
    telefon ? `📞 ${esc(telefon)}` : null,
    inzerat ? `🔗 ${esc(inzerat)}` : null,
    poznamka ? `\n📝 ${esc(poznamka)}` : null,
    sluzba === 'zariadenie' && env.OPENAI_KEY ? '\n🪄 Fotky pripravím automaticky – uvidíš ich vo večernom súhrne.' : null,
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
  return json({ ok: true, cislo: o.cislo, cena: o.cena, stav_url: stavUrl(base, o), platba_url, novy_zamietnuty: !!novyDovod }, 200, origin);
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

// ---------- automatické zariadenie (OpenAI) ----------
const MIESTNOST_EN = { 'Obývačka': 'living room', 'Spálňa': 'bedroom', 'Kuchyňa': 'kitchen', 'Jedáleň': 'dining room', 'Detská izba': "children's room", 'Pracovňa': 'home office', 'Kúpeľňa': 'bathroom' };
const STYL_EN = {
  moderny: 'modern style with clean lines, light grey and beige tones, a comfortable sofa or bed, simple wooden accents',
  skandinavsky: 'warm Scandinavian style with light wood, linen textiles, green plants and soft neutral colours',
  klasicky: 'classic timeless style with warm tones, elegant traditional furniture and soft lighting',
};
function promptZariadenia(o, foto, pokyn) {
  const bezDia = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const izba = Object.entries(MIESTNOST_EN).find(([k]) => bezDia(k) === bezDia(foto.popis))?.[1] || 'room';
  return [
    `Virtually stage this empty ${izba} for a real estate listing.`,
    'Keep the room exactly as it is: the same walls, ceiling, floor, windows, doors, radiators, sockets and light switches, the same camera angle, perspective, framing and zoom, pixel-aligned with the original photo. Do not change the architecture, do not add or remove windows or doors, do not crop.',
    `Add realistic furniture and decor suitable for a ${izba} in a ${STYL_EN[o.styl] || STYL_EN.moderny}.`,
    'Lighting fixtures are decor, not architecture: replace every bare light bulb, socket or exposed electrical cable hanging from the ceiling (or sticking out of a wall where a lamp belongs) with a finished, stylish ceiling light or pendant lamp that matches the style, mounted at the same spot. Nothing unfinished may remain visible on the ceiling.',
    'Natural soft daylight, realistic shadows and reflections on the floor. Photorealistic high-end real estate photography. No people. Do not add any new text, watermark or logo.',
    'If the original photo has a watermark or agency logo, keep it exactly as it is: the same position, size, shape, letters, colour and transparency, sharp and undistorted, drawn on top of everything (furniture must not cover it). Do not remove, move, redraw or blur it.',
    pokyn ? `Additional instructions from the client: ${pokyn}` : '',
    o.poznamka ? `Client note: ${o.poznamka}` : '',
  ].filter(Boolean).join('\n');
}
async function zariadFotku(env, o, i, pokyn) {
  const foto = o.fotky[i];
  if (!foto) return json({ ok: false, chyba: 'Fotka neexistuje.' }, 400);
  const f = await fetch(`https://api.telegram.org/bot${env.TG_TOKEN}/getFile?file_id=${encodeURIComponent(foto.id)}`).then((r) => r.json());
  if (!f.ok) return json({ ok: false, chyba: 'Fotku sa nepodarilo načítať z úložiska.' }, 502);
  const obr = await fetch(`https://api.telegram.org/file/bot${env.TG_TOKEN}/${f.result.file_path}`).then((r) => r.blob());
  const fd = new FormData();
  fd.append('model', env.OPENAI_MODEL || 'gpt-image-2.5-sunburst');
  fd.append('image', new File([obr], 'foto.jpg', { type: obr.type && obr.type.startsWith('image/') ? obr.type : 'image/jpeg' }));
  fd.append('prompt', promptZariadenia(o, foto, pokyn));
  fd.append('size', 'auto');
  fd.append('quality', env.OPENAI_QUALITY || 'high');
  fd.append('output_format', 'jpeg');
  const r = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { Authorization: `Bearer ${env.OPENAI_KEY}` }, body: fd });
  await zapisHistoriu(env, o.cislo, r.ok ? `Automatické zariadenie fotky ${i + 1} (${foto.popis || ''})${pokyn ? ' s pokynom' : ''}` : `OpenAI chyba pri fotke ${i + 1}: ${r.status}`);
  // odpoveď (base64 obrázok) posielame priamo do prehliadača – Worker ju nerozbaľuje
  return new Response(r.body, { status: r.status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
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
  <div class="row" style="margin-top:10px"><a class="btn" href="/admin/schvalenie">✅ Schvaľovanie</a><a class="btn sec" href="/admin/ambasadori">🤝 Ambasádori</a><a class="btn sec" href="/admin/chaty">💬 Chat</a><form method="post" action="/admin/spusti" style="margin:0"><button class="btn sec">🪄 Spustiť výrobu teraz</button></form><form method="post" action="/admin/suhrn" style="margin:0"><button class="btn sec">🌙 Poslať súhrn teraz</button></form></div>
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
    ${o.novy ? '<dt>Nový klient</dt><dd>🎁 overený automaticky – prvé 3 fotky zadarmo</dd>' : ''}
    ${o.kod ? `<dt>Odporúčací kód</dt><dd>${esc(o.kod)} (−10 % vo faktúre)</dd>` : ''}
    <dt>Zákazník</dt><dd>${esc(o.meno)}</dd>
    <dt>E-mail</dt><dd><a href="mailto:${esc(o.email)}">${esc(o.email)}</a></dd>
    ${o.telefon ? `<dt>Telefón</dt><dd><a href="tel:${esc(o.telefon)}">${esc(o.telefon)}</a></dd>` : ''}
    ${o.inzerat ? `<dt>Inzerát</dt><dd><a href="${esc(o.inzerat)}" target="_blank" rel="noopener">${esc(o.inzerat)}</a></dd>` : ''}
    ${o.poznamka ? `<dt>Poznámka</dt><dd style="white-space:pre-wrap">${esc(o.poznamka)}</dd>` : ''}
    <dt>Pre zákazníka</dt><dd><a href="${su}" target="_blank" rel="noopener">stránka so stavom objednávky</a></dd>
  </dl></div>
  <div class="card"><h2>Fotky od zákazníka (${o.fotky.length})</h2>${await galeria(env, base, o.fotky)}</div>
  ${o.sluzba === 'zariadenie' && env.OPENAI_KEY && o.fotky.length ? `<div class="card" id="gen"><h2>🪄 Automatické zariadenie</h2>
    <p class="mut" style="margin-top:0">Štýl: <b>${esc(STYLY[o.styl] || '')}</b>. Každú fotku vygenerujeme, ty ju skontroluješ a schváliš. Schválená fotka dostane označenie „Virtuálne zariadené“ a uloží sa do Hotových výsledkov.</p>
    <button class="btn" onclick="genVsetky()">🪄 Zariadiť všetky fotky</button>
    <div id="genZoz" style="margin-top:14px">${(await Promise.all(o.fotky.map(async (x, i) => `<div class="genr" data-i="${i}" style="border-top:1px solid #EEF0F5;padding:12px 0">
      <b>${i + 1}. ${esc(x.popis || 'Fotka')}</b>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:8px"><img src="${await fotoUrl(env, base, x.id)}" style="width:100%;border-radius:10px;aspect-ratio:4/3;object-fit:cover" alt="pred"><div class="gout" style="border:2px dashed #E6E8EF;border-radius:10px;display:grid;place-items:center;aspect-ratio:4/3;color:#667085;font-size:13px;overflow:hidden">ešte nevygenerované</div></div>
      <div class="row" style="margin-top:8px"><input type="text" class="gpok" placeholder="Pokyn navyše (nepovinné), napr. sedačka do L" style="flex:1;min-width:200px"><button class="btn sec sm" onclick="gen(${i})">Vygenerovať</button><button class="btn sm gok" onclick="genOk(${i})" disabled>✅ Schváliť</button></div>
    </div>`))).join('')}</div>
  </div>
  <script>
  const GEN={};
  async function gen(i){const r=document.querySelector('.genr[data-i="'+i+'"]');const out=r.querySelector('.gout');out.innerHTML='⏳ generujem… (30–90 s)';r.querySelector('.gok').disabled=true;
    try{const res=await fetch('/admin/o/${o.cislo}/zariadit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({i,pokyn:r.querySelector('.gpok').value})});
      const j=await res.json();if(!res.ok||!j.data||!j.data[0]){throw new Error((j.error&&j.error.message)||j.chyba||('chyba '+res.status))}
      const blob=await oznac('data:image/jpeg;base64,'+j.data[0].b64_json);GEN[i]=blob;out.innerHTML='';const im=new Image();im.src=URL.createObjectURL(blob);im.style.cssText='width:100%;height:100%;object-fit:contain;background:#F4F5F9;cursor:zoom-in';im.onclick=()=>window.open(im.src);out.appendChild(im);out.style.borderStyle='solid';r.querySelector('.gok').disabled=false;r.querySelector('.btn.sec').textContent='🔁 Znova'}
    catch(e){out.textContent='⚠️ '+e.message}}
  function oznac(src){return new Promise((ok,zle)=>{const im=new Image();im.onload=()=>{const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const x=c.getContext('2d');x.drawImage(im,0,0);
    const fs=Math.round(im.width*0.022),pad=Math.round(fs*0.6),t='Virtuálne zariadené';x.font='600 '+fs+'px Inter,Arial,sans-serif';const w=x.measureText(t).width+pad*2,h=fs+pad*1.6,mx=Math.round(im.width*0.02),y=im.height-h-mx;
    x.fillStyle='rgba(32,36,54,.72)';x.beginPath();x.roundRect?x.roundRect(mx,y,w,h,h/2):x.rect(mx,y,w,h);x.fill();x.fillStyle='#fff';x.textBaseline='middle';x.fillText(t,mx+pad,y+h/2);c.toBlob(b=>b?ok(b):zle(new Error('obrázok')), 'image/jpeg',.92)};im.onerror=()=>zle(new Error('obrázok sa nenačítal'));im.src=src})}
  async function genOk(i){const r=document.querySelector('.genr[data-i="'+i+'"]');const b=r.querySelector('.gok');if(!GEN[i])return;b.disabled=true;b.textContent='Ukladám…';
    const fd=new FormData();fd.append('subory',new File([GEN[i]],'zariadene_'+(i+1)+'_'+(r.querySelector('b').textContent.replace(/^\\d+\\.\\s*/,'')||'fotka')+'.jpg',{type:'image/jpeg'}));
    const res=await fetch('/admin/o/${o.cislo}/vysledky',{method:'POST',body:fd});b.textContent=res.ok?'✓ Schválené':'⚠️ Chyba, skús znova';if(!res.ok)b.disabled=false}
  async function genVsetky(){for(const r of document.querySelectorAll('.genr')){if(!GEN[r.dataset.i])await gen(+r.dataset.i)}}
  </script>` : ''}
  ${o.reels ? await kartaReels(env, base, o) : ''}
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
      await potvrdProviziu(env, cislo);
      sprava = 'Označené ako zaplatené.';
    }
    const s = f.get('stav');
    if (s && STAVY[s]) {
      await env.DB.prepare('UPDATE objednavky SET stav = ?, aktualizovane = ? WHERE cislo = ?').bind(s, teraz(), cislo).run();
      await zapisHistoriu(env, cislo, `Stav: ${STAVY[s][0]}`);
      if (s === 'zrusena') await env.DB.prepare("UPDATE provizie SET stav = 'zrusene' WHERE cislo = ? AND stav != 'vyplatena'").bind(cislo).run();
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
      await potvrdProviziu(env, cislo);
      o.zaplatene = 1;
      await posliEmail(env, o, 'potvrdenie', new URL(req.url).origin).catch(() => {});
      await tgSprava(env, `💳 <b>Zaplatené: ${cislo}</b>\n${esc(popisSluzby(o))} · ${eur(e.data.object.amount_total / 100)}\n👤 ${esc(o.meno)}`).catch(() => {});
    }
  }
  return new Response('ok');
}

// ================= AUTOMATICKÁ VÝROBA + VEČERNÉ SCHVAĽOVANIE =================
const BASE_URL = 'https://ra-objednavky.rarex731.workers.dev';
const MAX_POKUSOV = 2; // koľkokrát skúsiť znova, keď kontrola nájde problém

// --- stiahnutie fotiek z inzerátu (keď zákazník poslal len odkaz) ---
function obrazkyZInzeratu(htmlText, url) {
  const najdene = new Set();
  const pridaj = (u) => {
    if (!u) return;
    u = u.replace(/&amp;/g, '&').trim();
    if (u.startsWith('//')) u = 'https:' + u;
    if (!/^https?:\/\//i.test(u)) { try { u = new URL(u, url).href; } catch { return; } }
    if (/logo|icon|avatar|sprite|banner|placeholder|thumb_?s|\.svg|\.gif/i.test(u)) return;
    najdene.add(u);
  };
  for (const m of htmlText.matchAll(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/gi)) pridaj(m[1]);
  for (const m of htmlText.matchAll(/https?:\/\/[^"'\s<>()]+?\.(?:jpe?g|webp)(?:\?[^"'\s<>()]*)?/gi)) pridaj(m[0]);
  return [...najdene];
}
async function stiahniFotkyZInzeratu(env, o) {
  const r = await fetch(o.inzerat, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36', 'Accept-Language': 'sk' } });
  if (!r.ok) throw new Error(`inzerát odpovedal ${r.status}`);
  const kandidati = obrazkyZInzeratu(await r.text(), o.inzerat).slice(0, 40);
  const subory = [];
  for (const u of kandidati) {
    if (subory.length >= Math.max(1, o.pocet || 5)) break;
    try {
      const f = await fetch(u);
      if (!f.ok) continue;
      const b = await f.blob();
      if (b.size < 40000 || !(b.type || '').startsWith('image/')) continue; // malé obrázky = ikonky
      subory.push(new File([b], `inzerat_${subory.length + 1}.jpg`, { type: b.type }));
    } catch { /* ďalší */ }
  }
  if (!subory.length) throw new Error('v inzeráte sa nenašli fotky');
  const ids = await tgSubory(env, subory, subory.map(() => 'Fotka z inzerátu'), o.cislo, true);
  await env.DB.prepare('UPDATE objednavky SET fotky = ? WHERE cislo = ?').bind(JSON.stringify(ids), o.cislo).run();
  await zapisHistoriu(env, o.cislo, `Stiahnuté fotky z inzerátu: ${ids.length}`);
  o.fotky = ids;
}

// --- vygenerovanie jednej fotky (bez rozbaľovania base64 vo Workeri) ---
async function generuj(env, o, i, pokyn) {
  const foto = o.fotky[i];
  const f = await fetch(`https://api.telegram.org/bot${env.TG_TOKEN}/getFile?file_id=${encodeURIComponent(foto.id)}`).then((r) => r.json());
  if (!f.ok) throw new Error('fotku sa nepodarilo načítať');
  const obr = await fetch(`https://api.telegram.org/file/bot${env.TG_TOKEN}/${f.result.file_path}`).then((r) => r.blob());
  const fd = new FormData();
  fd.append('model', env.OPENAI_MODEL || 'gpt-image-2.5-sunburst');
  fd.append('image', new File([obr], 'foto.jpg', { type: obr.type && obr.type.startsWith('image/') ? obr.type : 'image/jpeg' }));
  fd.append('prompt', promptZariadenia(o, foto, pokyn));
  fd.append('size', 'auto');
  fd.append('quality', env.OPENAI_QUALITY || 'high');
  fd.append('output_format', 'jpeg');
  const r = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { Authorization: `Bearer ${env.OPENAI_KEY}` }, body: fd });
  const t = await r.text();
  if (!r.ok) throw new Error('OpenAI ' + r.status + ': ' + t.slice(0, 200));
  const k = t.indexOf('"b64_json"');
  const z = t.indexOf('"', t.indexOf(':', k) + 1) + 1;
  const b64 = t.slice(z, t.indexOf('"', z));
  if (k < 0 || b64.length < 1000) throw new Error('OpenAI nevrátilo obrázok');
  return b64;
}

// --- automatická kontrola výsledku (porovnanie s originálom) ---
async function skontroluj(env, o, i, b64) {
  const orig = await fotoUrl(env, BASE_URL, o.fotky[i].id);
  const zadanie = `Si prísny kontrolór kvality realitných fotiek. Prvý obrázok je originál prázdnej miestnosti, druhý je jej virtuálne zariadenie (štýl: ${STYLY[o.styl] || 'moderný'}).
Skontroluj:
1. Architektúra je rovnaká: steny, strop, podlaha, okná, dvere, radiátory, výhľad z okna, uhol a výrez záberu. Žiadne pridané ani zmiznuté okná či dvere.
2. Nábytok je realistický, správnej veľkosti a mierky, nestojí v dverách ani pred oknom tak, že by blokoval prechod, nič nepláva vo vzduchu, nič nie je zdeformované ani rozmazané.
3. Na obrázku nie sú ľudia a nepribudli žiadne nové texty ani logá. Ak má originál vodoznak alebo logo realitky, musí byť na zariadenej fotke zachované na rovnakom mieste, celé, čitateľné a nepokrivené (pokrivené, rozmazané alebo chýbajúce logo = ok false).
4. Nábytok zodpovedá miestnosti (${o.fotky[i].popis || 'miestnosť'}).
5. Na strope ani na stenách nevisí holá žiarovka ani trčiaci elektrický kábel – musia byť nahradené hotovým svietidlom.
Odpovedz IBA ako JSON: {"ok": true alebo false, "dovod": "krátko po slovensky, čo je zlé (alebo prázdny reťazec)"}. Drobné rozdiely v osvetlení nevadia.`;
  const r = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.OPENAI_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: env.QA_MODEL || 'gpt-6.1-terra', input: [{ role: 'user', content: [
      { type: 'input_text', text: zadanie },
      { type: 'input_image', image_url: orig },
      { type: 'input_image', image_url: 'data:image/jpeg;base64,' + b64 },
    ] }] }),
  });
  const t = await r.text();
  if (!r.ok) return { ok: null, dovod: 'kontrola nedostupná (' + r.status + ')' };
  const m = t.match(/\{\s*\\?"ok\\?"\s*:\s*(true|false)\s*,\s*\\?"dovod\\?"\s*:\s*\\?"((?:[^"\\]|\\.)*?)\\?"\s*\}/);
  if (!m) return { ok: null, dovod: 'kontrola nevrátila výsledok' };
  let dovod = m[2];
  try { dovod = JSON.parse('"' + dovod.replace(/\\\\/g, '\\') + '"'); } catch { /* nechaj tak */ }
  return { ok: m[1] === 'true', dovod };
}

// --- čo ešte treba vyrobiť ---
async function stavFotiek(env, o) {
  const { results } = await env.DB.prepare('SELECT id, i, stav, qa, pokyn FROM vystupy WHERE cislo = ? ORDER BY id').bind(o.cislo).all();
  return o.fotky.map((_, i) => {
    const z = results.filter((v) => v.i === i);
    let kolo = [];
    for (const v of z) { if (v.stav === 'zamietnute') kolo = [v]; else kolo.push(v); }
    const posl = z[z.length - 1];
    const pokusy = kolo.filter((v) => v.stav !== 'zamietnute').length;
    const pokyn = kolo[0] && kolo[0].stav === 'zamietnute' ? kolo[0].pokyn : '';
    let treba = false;
    if (!posl) treba = true;
    else if (posl.stav === 'zamietnute') treba = true;
    else if (posl.stav === 'problem' && pokusy <= MAX_POKUSOV) treba = true;
    else if (posl.stav === 'chyba' && pokusy < 3) treba = true;
    const hotovy = posl && ['ok', 'problem', 'schvalene'].includes(posl.stav) && !treba;
    return { i, treba, hotovy, posl, pokyn, pokusy };
  });
}

async function spracujFrontu(env) {
  if (!env.OPENAI_KEY) return;
  const { results } = await env.DB.prepare(`SELECT cislo FROM objednavky WHERE sluzba = 'zariadenie' AND stav IN ('nova','zaplatena','vo_vyrobe')
    AND (vyroba IS NULL OR vyroba IN ('caka','hotova')) ORDER BY vytvorene LIMIT 10`).all();
  let rozpocet = 3; // max. počet generovaní za jeden beh
  for (const { cislo } of results) {
    if (rozpocet <= 0) break;
    const o = await nacitaj(env, cislo);
    if (!o) continue;
    try {
      if (!o.fotky.length) {
        if (!o.inzerat) continue;
        await stiahniFotkyZInzeratu(env, o);
      }
      const st = await stavFotiek(env, o);
      for (const s of st) {
        if (!s.treba || rozpocet <= 0) continue;
        rozpocet--;
        let b64, qa, stav;
        try {
          b64 = await generuj(env, o, s.i, s.pokyn);
          qa = await skontroluj(env, o, s.i, b64);
          stav = qa.ok === false ? 'problem' : 'ok';
        } catch (e) {
          stav = 'chyba'; qa = { ok: false, dovod: e.message.slice(0, 300) };
        }
        await env.DB.prepare('INSERT INTO vystupy (cislo, i, stav, b64, qa, pokyn, vytvorene) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .bind(cislo, s.i, stav, b64 || null, JSON.stringify(qa), s.pokyn || null, teraz()).run();
        await zapisHistoriu(env, cislo, `Výroba fotky ${s.i + 1}: ${stav === 'ok' ? 'kontrola OK' : stav === 'problem' ? 'kontrola našla problém – ' + qa.dovod : 'chyba – ' + qa.dovod}`);
      }
      const po = await stavFotiek(env, o);
      const hotovo = po.every((s) => s.hotovy);
      const nova = hotovo ? 'hotova' : 'caka';
      if (nova !== o.vyroba || o.stav !== 'vo_vyrobe') {
        await env.DB.prepare("UPDATE objednavky SET vyroba = ?, stav = 'vo_vyrobe', aktualizovane = ? WHERE cislo = ?").bind(nova, teraz(), cislo).run();
      }
    } catch (e) {
      await env.DB.prepare("UPDATE objednavky SET vyroba = 'chyba_fotky', aktualizovane = ? WHERE cislo = ?").bind(teraz(), cislo).run();
      await zapisHistoriu(env, cislo, 'Automatická výroba zastavená: ' + e.message);
      await tgSprava(env, `⚠️ <b>${cislo}</b>: ${esc(e.message)}.\nNahraj fotky ručne v objednávke.`, [[{ text: '📋 Otvoriť objednávku', url: `${BASE_URL}/admin/o/${cislo}?s=${await hmac(env, 'o:' + cislo)}` }]]).catch(() => {});
    }
  }
}

// --- večerný súhrn a pripomienka ---
async function prehladNaSchvalenie(env) {
  const z = await env.DB.prepare(`SELECT cislo, sluzba, pocet, styl, s_videom, video, meno, cena, vyroba, stav FROM objednavky
    WHERE stav IN ('nova','zaplatena','vo_vyrobe') ORDER BY vytvorene`).all();
  const zar = z.results.filter((o) => o.sluzba === 'zariadenie');
  const hotove = zar.filter((o) => o.vyroba === 'hotova');
  const rozrobene = zar.filter((o) => o.vyroba !== 'hotova');
  const videa = z.results.filter((o) => o.sluzba !== 'zariadenie' || o.s_videom);
  const { n } = await env.DB.prepare(`SELECT COUNT(*) n FROM vystupy v JOIN objednavky o ON o.cislo = v.cislo
    WHERE o.vyroba = 'hotova' AND o.stav = 'vo_vyrobe' AND v.stav IN ('ok','problem') AND v.id = (SELECT MAX(id) FROM vystupy w WHERE w.cislo = v.cislo AND w.i = v.i)`).first();
  const { p } = await env.DB.prepare(`SELECT COUNT(*) p FROM vystupy v JOIN objednavky o ON o.cislo = v.cislo
    WHERE o.vyroba = 'hotova' AND o.stav = 'vo_vyrobe' AND v.stav = 'problem' AND v.id = (SELECT MAX(id) FROM vystupy w WHERE w.cislo = v.cislo AND w.i = v.i)`).first();
  return { hotove, rozrobene, videa, fotiek: n, problemov: p };
}
async function vecernySuhrn(env, pripomienka) {
  const s = await prehladNaSchvalenie(env);
  const chatR = pripomienka ? '' : await chatSuhrn(env).catch(() => '');
  if (!s.hotove.length && !s.videa.length) {
    if (!pripomienka) {
      const t = [s.rozrobene.length ? `🌙 Dnes ešte nič na schválenie – ${s.rozrobene.length} ${s.rozrobene.length === 1 ? 'objednávka sa' : 'objednávky sa'} ešte vyrába.` : '', chatR].filter(Boolean).join('\n');
      if (t) await tgSprava(env, t).catch(() => {});
    }
    return;
  }
  const odkaz = `${BASE_URL}/admin/schvalenie?s=${await hmac(env, 'schvalenie')}`;
  const r = [pripomienka ? '⏰ <b>Pripomienka: čaká na tvoje schválenie</b>' : '🌙 <b>Večerný súhrn</b>', ''];
  if (s.hotove.length) r.push(`🛋 Na schválenie: <b>${s.hotove.length}</b> ${s.hotove.length === 1 ? 'objednávka' : 'objednávky'}, <b>${s.fotiek}</b> fotiek${s.problemov ? ` (⚠️ ${s.problemov} na kontrolu)` : ''}`);
  if (s.rozrobene.length) r.push(`⏳ Ešte sa vyrába: ${s.rozrobene.length}`);
  if (s.videa.length) r.push(`🎬 Čaká na tvoje video: ${s.videa.length} (${s.videa.map((o) => o.cislo).join(', ')})`);
  if (chatR) r.push(chatR);
  await tgSprava(env, r.join('\n'), s.hotove.length ? [[{ text: '✅ Otvoriť schvaľovanie', url: odkaz }]] : null);
}

// --- Reels pred → po (vyrába sa v prehliadači pri schvaľovaní) ---
const REELS_JS = `async function vyrobReels(pary,stav){
  var nac=function(src){return new Promise(function(ok,zle){var im=new Image();im.crossOrigin='anonymous';im.onload=function(){ok(im)};im.onerror=function(){zle(new Error('obrázok sa nenačítal'))};im.src=(src instanceof Blob)?URL.createObjectURL(src):src})};
  var ims=[];for(var q=0;q<pary.length;q++){if(stav)stav('Načítavam fotky '+(q+1)+'/'+pary.length+'…');ims.push([await nac(pary[q].pred),await nac(pary[q].po)])}
  if(!ims.length)throw new Error('žiadne páry fotiek');
  var W=1080,H=1920,c=document.createElement('canvas');c.width=W;c.height=H;var x=c.getContext('2d');
  var typy=['video/mp4;codecs=avc1.42E01E','video/mp4;codecs=avc1','video/mp4','video/webm;codecs=vp9','video/webm'];
  var typ=window.MediaRecorder?typy.find(function(t){return MediaRecorder.isTypeSupported(t)}):null;
  if(!typ)throw new Error('tento prehliadač nevie nahrávať video – skús Chrome alebo Safari');
  var str=c.captureStream(30),rec=new MediaRecorder(str,{mimeType:typ,videoBitsPerSecond:3500000}),kusy=[];
  rec.ondataavailable=function(e){if(e.data&&e.data.size)kusy.push(e.data)};
  var T=3.4,spolu=T*ims.length+0.3;
  function pill(t,px,py,bg,zarovnaj){x.font='700 46px Inter,Arial,sans-serif';var w=x.measureText(t).width+56,h=78,X=zarovnaj==='r'?px-w:px;x.fillStyle=bg;x.beginPath();x.roundRect?x.roundRect(X,py,w,h,39):x.rect(X,py,w,h);x.fill();x.fillStyle='#fff';x.textBaseline='middle';x.fillText(t,X+28,py+h/2+2)}
  function obraz(im,u){var k=H/im.height,iw=im.width*k;if(iw<W){k=W/im.width;iw=W}var ih=im.height*k,rozsah=iw-W,pos=rozsah*(0.22+0.56*Math.min(1,u/T));x.drawImage(im,-pos,(H-ih)/2,iw,ih)}
  function kresli(t){var i=Math.min(ims.length-1,Math.floor(t/T)),u=t-i*T,a=ims[i][0],b=ims[i][1];
    x.fillStyle='#111';x.fillRect(0,0,W,H);obraz(a,u);
    var p=Math.max(0,Math.min(1,(u-0.8)/1.4)),e=p<.5?2*p*p:1-Math.pow(-2*p+2,2)/2,lx=W*e;
    if(lx>0){x.save();x.beginPath();x.rect(0,0,lx,H);x.clip();obraz(b,u);x.restore()}
    if(p>0&&p<1){x.fillStyle='#fff';x.shadowColor='rgba(0,0,0,.35)';x.shadowBlur=18;x.fillRect(lx-4,0,8,H);x.shadowBlur=0}
    if(p<1)pill('Pred',W-60,120,'rgba(32,36,54,.78)','r');
    if(p>0)pill('Po',60,120,'#7728E6','l');
    if(p>0){x.font='600 34px Inter,Arial,sans-serif';var tt='Virtuálne zariadené',w=x.measureText(tt).width+44;x.fillStyle='rgba(32,36,54,.72)';x.beginPath();x.roundRect?x.roundRect((W-w)/2,128,w,62,31):x.rect((W-w)/2,128,w,62);x.fill();x.fillStyle='#fff';x.textBaseline='middle';x.fillText(tt,(W-w)/2+22,159)}
    var f=Math.min(1,u/0.25);if(f<1){x.fillStyle='rgba(0,0,0,'+(1-f)+')';x.fillRect(0,0,W,H)}}
  kresli(0);rec.start(250);var t0=performance.now();
  await new Promise(function(ok){function krok(){var t=(performance.now()-t0)/1000;if(t>=spolu){kresli(spolu-0.31);ok();return}kresli(Math.min(t,spolu-0.31));if(stav)stav('Nahrávam Reels… '+Math.round(t/spolu*100)+' %');requestAnimationFrame(krok)}requestAnimationFrame(krok)});
  await new Promise(function(ok){rec.onstop=ok;rec.stop()});str.getTracks().forEach(function(tr){tr.stop()});
  var cist=typ.split(';')[0];return new File([new Blob(kusy,{type:cist})],'reels_pred_po.'+(cist.indexOf('mp4')>=0?'mp4':'webm'),{type:cist});
}
async function nahrajReels(cislo,pary,stav){var f=await vyrobReels(pary,stav);if(stav)stav('Ukladám Reels ('+Math.round(f.size/1e6*10)/10+' MB)…');var fd=new FormData();fd.append('subory',f);fd.append('dodat','1');var r=await fetch('/admin/o/'+cislo+'/vysledky',{method:'POST',body:fd});if(!r.ok)throw new Error('uloženie zlyhalo ('+r.status+')');return f}
`;
async function paryReels(env, base, o) {
  const hotove = o.vysledky.filter((v) => /\.(jpe?g|png|webp)$/i.test(v.nazov || '') && /zariaden/i.test(v.nazov || ''));
  const podlaI = {}, bez = [];
  for (const v of hotove) { const m = (v.nazov || '').match(/zariadene_(\d+)_/); if (m) podlaI[+m[1] - 1] = v; else bez.push(v); }
  const pary = [];
  for (let i = 0; i < o.fotky.length; i++) {
    const v = podlaI[i] || bez.shift();
    pary.push({ i, pred: await fotoUrl(env, base, o.fotky[i].id), po: v ? await fotoUrl(env, base, v.id) : null });
  }
  return { pary };
}
async function kartaReels(env, base, o) {
  const data = await paryReels(env, base, o);
  const ma = o.vysledky.some((v) => /reels/i.test(v.nazov || ''));
  const n = data.pary.filter((x) => x.po).length;
  return `<div class="card"><h2>🎬 Reels pred → po</h2>
    <p class="mut" style="margin-top:0">${ma ? 'Reels už je medzi výsledkami. Môžeš ho vyrobiť znova.' : 'Zákazník objednal Reels.'} Pripravených párov fotiek: <b>${n}</b> z ${data.pary.length}. Počas výroby nechaj stránku otvorenú.</p>
    <button class="btn" id="rBtn" ${n ? '' : 'disabled'} onclick="spustiReels()">🎬 Vyrobiť Reels a dodať</button> <span id="rStav" class="mut"></span>
    <script>const RD=${JSON.stringify(data).replace(/</g, '\\u003c')};${REELS_JS}
    async function spustiReels(){const b=document.getElementById('rBtn'),s=document.getElementById('rStav');b.disabled=true;
      try{await nahrajReels('${o.cislo}',RD.pary.filter(x=>x.po),t=>s.textContent=t);s.textContent='✓ Hotovo';setTimeout(()=>location.href='/admin/o/${o.cislo}?m='+encodeURIComponent('Reels je nahraté a objednávka dodaná.'),600)}
      catch(e){s.textContent='⚠️ '+e.message;b.disabled=false}}</script></div>`;
}

// --- stránka na schválenie všetkého naraz ---
async function stranaSchvalenia(env, base) {
  const s = await prehladNaSchvalenie(env);
  const bloky = [], reelsData = {};
  for (const oz of s.hotove) {
    const o = await nacitaj(env, oz.cislo);
    const st = await stavFotiek(env, o);
    const riadky = await Promise.all(st.map(async (x) => {
      if (!x.posl || !['ok', 'problem'].includes(x.posl.stav)) return '';
      const qa = JSON.parse(x.posl.qa || '{}');
      return `<div class="sch ${x.posl.stav === 'problem' ? 'prob' : ''}" data-id="${x.posl.id}" data-i="${x.i}" data-cislo="${o.cislo}" data-nazov="${esc((o.fotky[x.i].popis || 'fotka').replace(/[^\p{L}\p{N}]+/gu, '-'))}">
        <div class="pp"><img src="${await fotoUrl(env, base, o.fotky[x.i].id)}" alt="pred" loading="lazy"><img class="po" data-v="${x.posl.id}" alt="po"></div>
        <div class="row" style="margin-top:6px"><label style="display:flex;gap:6px;align-items:center;font-weight:600"><input type="checkbox" class="ok" ${x.posl.stav === 'problem' ? '' : 'checked'}> ${x.i + 1}. ${esc(o.fotky[x.i].popis || 'Fotka')}</label>
        ${x.posl.stav === 'problem' ? `<span class="pill" style="background:#B54708">⚠️ ${esc(qa.dovod || 'skontroluj')}</span>` : '<span class="pill" style="background:#12B76A">kontrola OK</span>'}</div>
        <input type="text" class="pokyn" placeholder="Ak neschvaľuješ: čo zmeniť (napr. sedačka do L, bez TV)">
      </div>`;
    }));
    if (o.reels) reelsData[o.cislo] = await paryReels(env, base, o);
    bloky.push(`<div class="card"><div class="row" style="justify-content:space-between"><h2 style="margin:0">${o.cislo}${o.reels ? ' <span class="pill" style="background:#7728E6">+ Reels</span>' : ''}</h2><a href="/admin/o/${o.cislo}" class="mut">detail</a></div>
      <p class="mut" style="margin:4px 0 10px">${esc(o.meno)} · ${esc(popisSluzby(o))} · ${eur(o.cena)}${o.zaplatene ? ' ✓ zaplatené' : ''}</p>${riadky.join('')}</div>`);
  }
  const obsah = `<h1>Schvaľovanie</h1><p class="mut">Zaškrtnuté fotky sa uložia s označením „Virtuálne zariadené“ a objednávky sa zákazníkom odošlú. Odškrtnuté fotky s pokynom sa vyrobia znova.</p>
  ${s.videa.length ? `<div class="warn">🎬 Čaká na tvoje video: ${s.videa.map((o) => `<a href="/admin/o/${o.cislo}">${o.cislo}</a>`).join(', ')}</div>` : ''}
  ${bloky.join('') || '<div class="card">Momentálne nie je nič na schválenie.</div>'}
  ${bloky.length ? `<div class="card" style="position:sticky;bottom:10px;box-shadow:0 10px 30px rgba(0,0,0,.12)"><button class="btn" id="vsetko" onclick="schvalVsetko()" style="width:100%;justify-content:center;font-size:16px;padding:14px">✅ Schváliť a odoslať zákazníkom</button><div id="prieb" class="mut" style="margin-top:8px;text-align:center"></div></div>` : ''}
  <style>.sch{border-top:1px solid #EEF0F5;padding:12px 0}.sch.prob{background:#FFFAEB;margin:0 -18px;padding:12px 18px}.pp{display:grid;grid-template-columns:1fr 1fr;gap:8px}.pp img{width:100%;aspect-ratio:3/2;object-fit:cover;border-radius:10px;background:#F4F5F9;cursor:zoom-in}.sch .pokyn{margin-top:8px}</style>
  <script>
  const REELS=${JSON.stringify(reelsData).replace(/</g, '\\u003c')};
  ${REELS_JS}
  document.querySelectorAll('img.po').forEach(async im=>{const t=await fetch('/admin/v/'+im.dataset.v).then(r=>r.text());im.src='data:image/jpeg;base64,'+t});
  document.querySelectorAll('.pp img').forEach(im=>im.onclick=()=>{const w=window.open();w.document.write('<img src="'+im.src+'" style="max-width:100%">')});
  function oznac(src){return new Promise((ok,zle)=>{const im=new Image();im.onload=()=>{const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const x=c.getContext('2d');x.drawImage(im,0,0);
    const fs=Math.round(im.width*0.022),pad=Math.round(fs*0.6),t='Virtuálne zariadené';x.font='600 '+fs+'px Inter,Arial,sans-serif';const w=x.measureText(t).width+pad*2,h=fs+pad*1.6,mx=Math.round(im.width*0.02),y=im.height-h-mx;
    x.fillStyle='rgba(32,36,54,.72)';x.beginPath();x.roundRect?x.roundRect(mx,y,w,h,h/2):x.rect(mx,y,w,h);x.fill();x.fillStyle='#fff';x.textBaseline='middle';x.fillText(t,mx+pad,y+h/2);c.toBlob(b=>b?ok(b):zle(new Error('obrázok')),'image/jpeg',.92)};im.onerror=()=>zle(new Error('obrázok sa nenačítal'));im.src=src})}
  async function schvalVsetko(){const b=document.getElementById('vsetko'),p=document.getElementById('prieb');b.disabled=true;
    const objednavky={};document.querySelectorAll('.sch').forEach(d=>{(objednavky[d.dataset.cislo]=objednavky[d.dataset.cislo]||[]).push(d)});
    let hotovo=0,chyby=0,reelsOk=0;for(const [cislo,fotky] of Object.entries(objednavky)){
      const ok=fotky.filter(d=>d.querySelector('.ok').checked),nie=fotky.filter(d=>!d.querySelector('.ok').checked);
      for(const d of nie){await fetch('/admin/v/'+d.dataset.id+'/zamietni',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pokyn:d.querySelector('.pokyn').value})})}
      for(let k=0;k<ok.length;k++){const d=ok[k];p.textContent='Ukladám '+cislo+' – fotka '+(k+1)+' z '+ok.length+'…';
        try{const im=d.querySelector('img.po');const blob=await oznac(im.src);const fd=new FormData();fd.append('subory',new File([blob],'zariadene_'+(+d.dataset.i+1)+'_'+d.dataset.nazov+'.jpg',{type:'image/jpeg'}));
          if(REELS[cislo])(REELS[cislo].nove=REELS[cislo].nove||{})[d.dataset.i]=blob;
          if(k===ok.length-1&&!nie.length&&!REELS[cislo])fd.append('dodat','1');
          const r=await fetch('/admin/o/'+cislo+'/vysledky',{method:'POST',body:fd});if(!r.ok)throw 0;
          await fetch('/admin/v/'+d.dataset.id+'/schval',{method:'POST'});d.style.opacity=.4;hotovo++}catch(e){chyby++;d.style.outline='2px solid #B42318'}}
      const R=REELS[cislo];
      if(R&&!nie.length&&ok.length){try{const pary=R.pary.map(x=>({pred:x.pred,po:(R.nove&&R.nove[x.i])||x.po})).filter(x=>x.po);
          await nahrajReels(cislo,pary,t=>p.textContent=cislo+': '+t);reelsOk++}catch(e){chyby++;p.textContent='';alert('Reels pre '+cislo+' sa nepodarilo vyrobiť ('+e.message+'). Fotky sú uložené – v detaile objednávky klikni Vyrobiť Reels.')}}
    }
    p.textContent='Hotovo: '+hotovo+' fotiek schválených'+(reelsOk?', '+reelsOk+'× Reels':'')+(chyby?', '+chyby+' chýb – skús znova':'')+'. Neschválené sa vyrobia znova.';b.textContent='✓ Odoslané';if(chyby)b.disabled=false}
  </script>`;
  return stranka('Schvaľovanie – Realitný asistent', obsah, true);
}

async function vystupAkcia(env, id, akcia, req) {
  const v = await env.DB.prepare('SELECT id, cislo, i FROM vystupy WHERE id = ?').bind(id).first();
  if (!v) return json({ ok: false }, 404);
  if (akcia === 'schval') {
    await env.DB.prepare("UPDATE vystupy SET stav = 'schvalene', b64 = NULL WHERE id = ?").bind(id).run();
  } else if (akcia === 'zamietni') {
    const d = await req.json().catch(() => ({}));
    await env.DB.prepare("UPDATE vystupy SET stav = 'zamietnute', pokyn = ? WHERE id = ?").bind(kratko(d.pokyn, 500) || null, id).run();
    await env.DB.prepare("UPDATE objednavky SET vyroba = 'caka' WHERE cislo = ?").bind(v.cislo).run();
    await zapisHistoriu(env, v.cislo, `Fotka ${v.i + 1} vrátená do výroby${d.pokyn ? ': ' + kratko(d.pokyn, 200) : ''}`);
  }
  return json({ ok: true }, 200);
}

// ================= AMBASÁDORSKÝ PROGRAM =================
const AMB = { provizia: 0.15, zlava: 0.10, dni: 365, minVyplata: 50, lehota: 14, bonusKlientov: 50 };
const pctProv = (a) => (a && a.provizia_pct != null ? a.provizia_pct / 100 : AMB.provizia);
const pctZlava = (a) => (a && a.zlava_pct != null ? a.zlava_pct / 100 : AMB.zlava);
const jeAmbKod = (k) => /^AMB-[A-Z0-9]{3,20}$/.test(String(k || '').toUpperCase());

async function ambasadorPodlaKodu(env, kod) {
  if (!jeAmbKod(kod)) return null;
  return env.DB.prepare("SELECT * FROM ambasadori WHERE kod = ? AND stav = 'schvaleny'").bind(String(kod).toUpperCase()).first();
}
// klient patrí ambasádorovi 12 mesiacov od prvej objednávky s jeho kódom
async function ambasadorKlienta(env, emailN, telN) {
  const od = new Date(Date.now() - AMB.dni * 864e5).toISOString();
  const r = await env.DB.prepare(`SELECT kod FROM objednavky WHERE kod LIKE 'AMB-%' AND stav != 'zrusena' AND vytvorene > ?
    AND (email_n = ? OR (? != '' AND telefon_n = ?)) ORDER BY vytvorene LIMIT 1`).bind(od, emailN, telN || '', telN || '').first();
  return r ? r.kod : null;
}
async function zapisProviziu(env, kod, o) {
  if (!kod || !(o.cena > 0)) return;
  const uz = await env.DB.prepare('SELECT 1 FROM provizie WHERE cislo = ?').bind(o.cislo).first();
  if (uz) return;
  const am = await env.DB.prepare('SELECT provizia_pct FROM ambasadori WHERE kod = ?').bind(kod).first();
  await env.DB.prepare('INSERT INTO provizie (kod, cislo, suma, provizia, stav, vytvorene) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(kod, o.cislo, o.cena, Math.round(o.cena * pctProv(am) * 100) / 100, 'caka', teraz()).run();
}
async function potvrdProviziu(env, cislo) {
  const splatne = new Date(Date.now() + AMB.lehota * 864e5).toISOString();
  await env.DB.prepare("UPDATE provizie SET stav = 'potvrdena', splatne = ? WHERE cislo = ? AND stav = 'caka'").bind(splatne, cislo).run();
  const p = await env.DB.prepare('SELECT kod FROM provizie WHERE cislo = ?').bind(cislo).first();
  if (!p) return;
  const a = await env.DB.prepare('SELECT id, meno, bonus FROM ambasadori WHERE kod = ?').bind(p.kod).first();
  const n = await pocetKlientov(env, p.kod);
  if (a && !a.bonus && n >= AMB.bonusKlientov) {
    await env.DB.prepare('UPDATE ambasadori SET bonus = ? WHERE id = ?').bind(teraz(), a.id).run();
    await tgSprava(env, `🏆 <b>${esc(a.meno)}</b> (${p.kod}) priviedol ${n} platiacich klientov!\nNárok na bonus: web s ponukou nehnuteľností + 12 mesiacov asistenta Všetky portály zadarmo.`,
      [[{ text: '👀 Otvoriť ambasádora', url: `${BASE_URL}/admin/ambasadori/${a.id}?s=${await hmac(env, 'amb:' + a.id)}` }]]).catch(() => {});
  }
}
async function pocetKlientov(env, kod) {
  const r = await env.DB.prepare(`SELECT COUNT(DISTINCT COALESCE(NULLIF(o.email_n,''), o.cislo)) n FROM provizie p JOIN objednavky o ON o.cislo = p.cislo
    WHERE p.kod = ? AND p.stav IN ('potvrdena','vyplatena')`).bind(kod).first();
  return r ? r.n : 0;
}

// --- registrácia ---
async function novyAmbasador(req, env, origin) {
  let f;
  try { f = await req.formData(); } catch { return json({ ok: false, chyba: 'Neplatné údaje formulára' }, 400, origin); }
  if (kratko(f.get('web'))) return json({ ok: true }, 200, origin);
  const g = (k, n = 300) => kratko(f.get(k), n);
  const a = {
    meno: g('meno', 120), email: g('email', 160), telefon: g('telefon', 40), pozicia: g('pozicia', 60), kancelaria: g('kancelaria', 160),
    mesto: g('mesto', 120), roky: g('roky', 30), predane: g('predane', 30), profil: g('profil', 500), siet: g('siet', 40), kontakty: g('kontakty', 1000),
    instagram: g('instagram', 200), facebook: g('facebook', 200), linkedin: g('linkedin', 200), tiktok: g('tiktok', 200), youtube: g('youtube', 200),
    sledovatelia: g('sledovatelia', 40), ako: g('ako', 2000), skusenosti: g('skusenosti', 2000), fakturacia: g('fakturacia', 40),
  };
  if (!a.meno || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(a.email) || !normTelefon(a.telefon)) return json({ ok: false, chyba: 'Vyplňte meno, e-mail a telefón.' }, 400, origin);
  if (!a.ako) return json({ ok: false, chyba: 'Napíšte nám, ako by ste naše služby odporúčali.' }, 400, origin);
  if (f.get('suhlas') !== 'ano') return json({ ok: false, chyba: 'Potvrďte súhlas s podmienkami programu.' }, 400, origin);
  const emailN = normEmail(a.email);
  const uz = await env.DB.prepare('SELECT stav FROM ambasadori WHERE email_n = ?').bind(emailN).first();
  if (uz) return json({ ok: false, chyba: uz.stav === 'schvaleny' ? 'Na tento e-mail už ambasádorský účet máte.' : 'Vašu prihlášku už máme, ozveme sa vám.' }, 400, origin);
  const zid = g('zid', 80);
  const r = await env.DB.prepare(`INSERT INTO ambasadori (vytvorene, stav, meno, email, email_n, telefon, telefon_n, pozicia, kancelaria, mesto, roky, predane, profil, siet, kontakty,
      instagram, facebook, linkedin, tiktok, youtube, sledovatelia, ako, skusenosti, fakturacia, ip_h, zid_h)
      VALUES (?, 'nova', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(teraz(), a.meno, a.email, emailN, a.telefon, normTelefon(a.telefon), a.pozicia, a.kancelaria, a.mesto, a.roky, a.predane, a.profil, a.siet, a.kontakty,
      a.instagram, a.facebook, a.linkedin, a.tiktok, a.youtube, a.sledovatelia, a.ako, a.skusenosti, a.fakturacia, await ipHash(env, req), zid ? await hmac(env, 'z:' + zid) : '').run();
  const id = r.meta.last_row_id;
  const siete = ['instagram', 'facebook', 'linkedin', 'tiktok', 'youtube'].filter((k) => a[k]).join(', ');
  await tgSprava(env, [`🤝 <b>Nová prihláška ambasádora</b>`, '', `👤 ${esc(a.meno)} · ${esc(a.pozicia || '')}`, a.kancelaria ? `🏢 ${esc(a.kancelaria)}${a.mesto ? ' · ' + esc(a.mesto) : ''}` : null,
    `👥 Maklérov vo svojej sieti: <b>${esc(a.siet || '?')}</b>`, siete ? `📱 ${esc(siete)} · sledovatelia: ${esc(a.sledovatelia || '?')}` : null,
    a.predane ? `🏠 Predané za 12 mes.: ${esc(a.predane)}` : null, '', `💬 ${esc(a.ako.slice(0, 400))}`].filter((x) => x !== null).join('\n'),
    [[{ text: '👀 Posúdiť prihlášku', url: `${BASE_URL}/admin/ambasadori/${id}?s=${await hmac(env, 'amb:' + id)}` }]]).catch(() => {});
  return json({ ok: true }, 200, origin);
}

// --- admin ---
function vyrobKod(meno) {
  const pr = String(meno || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z ]/g, '').trim().split(/\s+/).pop() || 'PARTNER';
  return `AMB-${pr.slice(0, 12)}${Math.floor(10 + Math.random() * 90)}`;
}
async function adminAmbasadori(env) {
  const { results } = await env.DB.prepare(`SELECT a.*, (SELECT COUNT(*) FROM provizie p WHERE p.kod = a.kod AND p.stav != 'zrusene') n,
      (SELECT COALESCE(SUM(provizia),0) FROM provizie p WHERE p.kod = a.kod AND p.stav = 'potvrdena') k_vyplate,
      (SELECT COALESCE(SUM(provizia),0) FROM provizie p WHERE p.kod = a.kod AND p.stav = 'vyplatena') vyplatene
    FROM ambasadori a ORDER BY CASE a.stav WHEN 'nova' THEN 0 WHEN 'schvaleny' THEN 1 ELSE 2 END, a.vytvorene DESC`).all();
  const pill = { nova: ['Nová prihláška', '#B54708'], schvaleny: ['Schválený', '#12B76A'], zamietnuty: ['Zamietnutý', '#B42318'] };
  const riadky = results.map((a) => `<tr class="kl" onclick="location='/admin/ambasadori/${a.id}'"><td><b>${esc(a.meno)}</b><div class="mut" style="font-size:12.5px">${esc(a.kancelaria || '')}</div></td>
    <td class="hm">${esc(a.siet || '')}</td><td>${esc(a.kod || '–')}</td><td>${a.n || 0} obj.<div class="mut" style="font-size:12.5px">k výplate ${eur(a.k_vyplate)}</div></td>
    <td><span class="pill" style="background:${(pill[a.stav] || ['', '#667085'])[1]}">${(pill[a.stav] || [a.stav])[0]}</span></td></tr>`).join('');
  return stranka('Ambasádori', `<p><a href="/admin">← Objednávky</a></p><h1>Ambasádori</h1>
    <p class="mut">Štandard: provízia ${AMB.provizia * 100} % počas ${AMB.dni / 30 | 0} mesiacov · klient −${AMB.zlava * 100} % · výplata po ${AMB.lehota} dňoch, min. ${AMB.minVyplata} € · bonus za ${AMB.bonusKlientov} klientov: web s ponukou + rok asistenta. Peniaze posielaš ty – systém len počíta.</p>
    <div class="card" style="padding:6px 10px"><table><thead><tr><th>Meno</th><th class="hm">Sieť maklérov</th><th>Kód</th><th>Provízie</th><th>Stav</th></tr></thead>
    <tbody>${riadky || '<tr><td colspan="5" class="mut" style="padding:20px">Zatiaľ žiadne prihlášky.</td></tr>'}</tbody></table></div>`, true);
}
async function adminAmbasador(env, id, sprava) {
  const a = await env.DB.prepare('SELECT * FROM ambasadori WHERE id = ?').bind(id).first();
  if (!a) return html(stranka('Nenájdené', '<h1>Prihláška neexistuje</h1>', true), 404);
  const { results: prov } = await env.DB.prepare('SELECT * FROM provizie WHERE kod = ? ORDER BY vytvorene DESC LIMIT 200').bind(a.kod || '-').all();
  const sum = (s) => prov.filter((p) => p.stav === s).reduce((x, p) => x + p.provizia, 0);
  const odkaz = a.kod ? `${WEB}/?amb=${a.kod}` : '';
  const telo = a.stav === 'schvaleny'
    ? `Dobrý deň${a.meno ? ', ' + a.meno.split(' ')[0] : ''},\n\nvítame vás medzi ambasádormi Realitného asistenta.\n\nVáš kód: ${a.kod}\nVáš odkaz: ${odkaz}\n\nKolegovia, ktorí objednajú cez váš odkaz alebo s vaším kódom, majú zľavu ${Math.round(pctZlava(a) * 100)} % na prvú objednávku. Vy dostanete ${Math.round(pctProv(a) * 100)} % z každej ich zaplatenej objednávky počas ${AMB.dni / 30 | 0} mesiacov. Keď k nám privediete ${AMB.bonusKlientov} platiacich klientov, dostanete navyše web s ponukou nehnuteľností a rok Realitného asistenta zadarmo. Prehľad a výplatu vám posielame raz mesačne.\n\nS pozdravom\nRealitný asistent\ninfo@realitnyasistent.eu`
    : `Dobrý deň${a.meno ? ', ' + a.meno.split(' ')[0] : ''},\n\nďakujeme za prihlášku do ambasádorského programu. Momentálne ju nemôžeme prijať. Ak sa niečo zmení, radi sa vám ozveme.\n\nS pozdravom\nRealitný asistent`;
  const mailto = `mailto:${encodeURIComponent(a.email)}?subject=${encodeURIComponent('Ambasádorský program Realitného asistenta')}&body=${encodeURIComponent(telo)}`;
  const r = (t, v, link) => v ? `<dt>${t}</dt><dd>${link ? `<a href="${esc(/^https?:/.test(v) ? v : 'https://' + v)}" target="_blank" rel="noopener">${esc(v)}</a>` : esc(v)}</dd>` : '';
  return html(stranka(`${a.meno} – ambasádor`, `<p><a href="/admin/ambasadori">← Ambasádori</a></p>${sprava ? `<div class="ok-box">${esc(sprava)}</div>` : ''}
    <h1>${esc(a.meno)}</h1><p class="mut" style="margin:0">Prihláška ${cas(a.vytvorene)}${a.kod ? ' · kód <b>' + a.kod + '</b>' : ''}</p>
    <div class="card"><h2>Rozhodnutie</h2><form method="post" action="/admin/ambasadori/${a.id}/stav" class="row">
      ${a.stav !== 'schvaleny' ? '<button class="btn" name="stav" value="schvaleny">✅ Schváliť a vytvoriť kód</button>' : ''}
      ${a.stav !== 'zamietnuty' ? '<button class="btn red sm" name="stav" value="zamietnuty">Zamietnuť</button>' : ''}
    </form>${a.kod ? `<p style="margin-bottom:0">Odkaz ambasádora: <a href="${odkaz}" target="_blank">${odkaz}</a></p>` : ''}
    <p style="margin-bottom:0"><a class="btn sec sm" href="${mailto}">✉️ Koncept e-mailu: ${a.stav === 'schvaleny' ? 'privítanie s kódom' : 'zamietnutie'}</a></p></div>
    <div class="card"><h2>Dosah</h2><dl>${r('Pozícia', a.pozicia)}${r('Kancelária', a.kancelaria)}${r('Mesto / región', a.mesto)}${r('Maklérov v sieti', a.siet)}${r('Kontakty / komunity', a.kontakty)}
      ${r('Instagram', a.instagram, 1)}${r('Facebook', a.facebook, 1)}${r('LinkedIn', a.linkedin, 1)}${r('TikTok', a.tiktok, 1)}${r('YouTube', a.youtube, 1)}${r('Sledovatelia spolu', a.sledovatelia)}</dl></div>
    <div class="card"><h2>Skúsenosti</h2><dl>${r('V realitách', a.roky)}${r('Predané za 12 mes.', a.predane)}${r('Profil / overenie', a.profil, 1)}${r('Fakturácia', a.fakturacia)}</dl>
      <h3 style="margin:14px 0 4px;font-size:15px">Ako by nás odporúčal</h3><p style="white-space:pre-wrap;margin:0">${esc(a.ako)}</p>
      ${a.skusenosti ? `<h3 style="margin:14px 0 4px;font-size:15px">Skúsenosti, poznámka</h3><p style="white-space:pre-wrap;margin:0">${esc(a.skusenosti)}</p>` : ''}
      <dl style="margin-top:12px"><dt>Kontakt</dt><dd><a href="mailto:${esc(a.email)}">${esc(a.email)}</a> · <a href="tel:${esc(a.telefon)}">${esc(a.telefon)}</a></dd></dl></div>
    <div class="card"><h2>Podmienky ambasádora</h2>
      <p style="margin-top:0">Klientov s províziou: <b>${a.kod ? await pocetKlientov(env, a.kod) : 0} / ${AMB.bonusKlientov}</b>${a.bonus ? ' · 🏆 bonus splnený ' + cas(a.bonus).split(' ')[0] : ''}</p>
      <form method="post" action="/admin/ambasadori/${a.id}/podmienky" class="row">
        <label>Provízia % <input type="text" name="provizia_pct" value="${a.provizia_pct ?? ''}" placeholder="${AMB.provizia * 100}" style="width:80px"></label>
        <label>Zľava klienta % <input type="text" name="zlava_pct" value="${a.zlava_pct ?? ''}" placeholder="${AMB.zlava * 100}" style="width:80px"></label>
        <button class="btn sec sm">Uložiť individuálne podmienky</button></form>
      <p class="mut" style="font-size:13px;margin-bottom:0">Prázdne = štandard (${AMB.provizia * 100} % / ${AMB.zlava * 100} %). Zmena platí pre nové objednávky.</p></div>
    ${a.kod ? `<div class="card"><h2>Provízie</h2><p>Čaká na platbu klienta: <b>${eur(sum('caka'))}</b> · Potvrdené: <b>${eur(sum('potvrdena'))}</b> · Vyplatené: <b>${eur(sum('vyplatena'))}</b></p>
      <table><thead><tr><th>Objednávka</th><th>Suma</th><th>Provízia</th><th>Stav</th></tr></thead><tbody>${prov.map((p) => `<tr><td><a href="/admin/o/${p.cislo}">${p.cislo}</a><div class="mut" style="font-size:12.5px">${cas(p.vytvorene)}</div></td><td>${eur(p.suma)}</td><td>${eur(p.provizia)}</td><td>${esc(p.stav)}${p.splatne && p.stav === 'potvrdena' ? '<div class="mut" style="font-size:12.5px">od ' + cas(p.splatne).split(' ')[0] + '</div>' : ''}</td></tr>`).join('') || '<tr><td colspan="4" class="mut">Zatiaľ nič.</td></tr>'}</tbody></table>
      ${sum('potvrdena') >= AMB.minVyplata ? `<form method="post" action="/admin/ambasadori/${a.id}/vyplatene" style="margin-top:12px"><button class="btn sec sm">💶 Označiť potvrdené provízie ako vyplatené (${eur(sum('potvrdena'))})</button></form>` : `<p class="mut" style="font-size:13px">Výplata od ${AMB.minVyplata} € potvrdených provízií.</p>`}</div>` : ''}
    <div class="card"><h2>Interná poznámka</h2><form method="post" action="/admin/ambasadori/${a.id}/poznamka"><textarea name="interna" rows="3">${esc(a.interna || '')}</textarea><button class="btn sec sm" style="margin-top:8px">Uložiť</button></form></div>`, true));
}
async function adminAmbAkcia(req, env, id, akcia) {
  const a = await env.DB.prepare('SELECT * FROM ambasadori WHERE id = ?').bind(id).first();
  if (!a) return html('Nenájdené', 404);
  const f = await req.formData();
  let m = '';
  if (akcia === 'stav') {
    const s = f.get('stav');
    if (s === 'schvaleny') {
      let kod = a.kod;
      for (let k = 0; !kod && k < 5; k++) { const n = vyrobKod(a.meno); if (!(await env.DB.prepare('SELECT 1 FROM ambasadori WHERE kod = ?').bind(n).first())) kod = n; }
      await env.DB.prepare("UPDATE ambasadori SET stav = 'schvaleny', kod = ?, schvalene = ? WHERE id = ?").bind(kod, teraz(), id).run();
      m = `Schválené. Kód ${kod}. Pošli ambasádorovi privítací e-mail (koncept nižšie).`;
    } else if (s === 'zamietnuty') {
      await env.DB.prepare("UPDATE ambasadori SET stav = 'zamietnuty' WHERE id = ?").bind(id).run();
      m = 'Prihláška zamietnutá.';
    }
  } else if (akcia === 'poznamka') {
    await env.DB.prepare('UPDATE ambasadori SET interna = ? WHERE id = ?').bind(kratko(f.get('interna'), 4000), id).run();
    m = 'Poznámka uložená.';
  } else if (akcia === 'podmienky') {
    const cislo = (v) => { const x = parseFloat(String(v || '').replace(',', '.')); return Number.isFinite(x) && x >= 0 && x <= 60 ? x : null; };
    await env.DB.prepare('UPDATE ambasadori SET provizia_pct = ?, zlava_pct = ? WHERE id = ?').bind(cislo(f.get('provizia_pct')), cislo(f.get('zlava_pct')), id).run();
    m = 'Individuálne podmienky uložené.';
  } else if (akcia === 'vyplatene') {
    await env.DB.prepare("UPDATE provizie SET stav = 'vyplatena' WHERE kod = ? AND stav = 'potvrdena'").bind(a.kod).run();
    m = 'Provízie označené ako vyplatené.';
  }
  return presmeruj(`/admin/ambasadori/${id}?m=${encodeURIComponent(m)}`);
}

export default {
  async scheduled(event, env) {
    try {
      if (event.cron === '0 18 * * *') { await vecernySuhrn(env, false); await chatUdrzba(env).catch((e) => console.log('chat udrzba', e.message)); }
      else if (event.cron === '0 20 * * *') await vecernySuhrn(env, true);
      else await spracujFrontu(env);
    } catch (e) { console.log('cron chyba', e.stack || e.message); }
  },
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
      if (req.method === 'POST' && cesta === '/ambasador') {
        if (origin && !POVOLENE.includes(origin)) return json({ ok: false }, 403, origin);
        return await novyAmbasador(req, env, origin);
      }
      let ma = cesta.match(/^\/admin\/ambasadori\/(\d+)$/);
      if (ma && req.method === 'GET' && url.searchParams.get('s') && env.ADMIN_KEY && rovnake(url.searchParams.get('s'), await hmac(env, 'amb:' + ma[1]))) {
        return presmeruj(`/admin/ambasadori/${ma[1]}`, adminCookie(env));
      }
      if (req.method === 'POST' && cesta === '/novy-klient') {
        if (origin && !POVOLENE.includes(origin)) return json({ ok: false }, 403, origin);
        return await overNovehoKlienta(req, env, origin);
      }
      if (req.method === 'POST' && (cesta === '/chat' || cesta === '/chat/kontakt')) {
        if (origin && !POVOLENE.includes(origin)) return json({ ok: false }, 403, origin);
        const h = { json, origin, ipHash, tgSprava };
        return cesta === '/chat' ? await chatOdpoved(req, env, h) : await chatKontakt(req, env, h);
      }

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

      if (cesta === '/admin/schvalenie' && url.searchParams.get('s') && env.ADMIN_KEY && rovnake(url.searchParams.get('s'), await hmac(env, 'schvalenie'))) {
        return presmeruj('/admin/schvalenie', adminCookie(env));
      }
      if (cesta === '/admin' || cesta.startsWith('/admin/')) {
        m = cesta.match(/^\/admin\/o\/(RA-[\w-]+)(?:\/(stav|poznamka|vysledky|zariadit))?$/);
        const cislo = m && m[1];
        const ok = await jeAdmin(req, env, url, cislo);
        if (!ok) return html(stranka('Prístup zamietnutý', '<h1>Prístup zamietnutý</h1><p class="mut">Otvor prehľad cez svoj odkaz s kľúčom.</p>', true), 403);
        if (ok === 'nastav') { const u = new URL(url); u.searchParams.delete('k'); return presmeruj(u.pathname + u.search, adminCookie(env)); }
        if (ok === 'jedna' && req.method === 'POST') return html('Pre zmeny otvor prehľad cez svoj odkaz s kľúčom.', 403);
        if (req.method === 'GET' && cesta === '/admin') return html(await adminZoznam(env, url));
        if (m && !m[2] && req.method === 'GET') return await adminDetail(env, base, cislo, url.searchParams.get('m'));
        if (ok !== true && ok !== 'nastav') return html('Pre túto akciu otvor prehľad cez svoj odkaz s kľúčom.', 403);
        if (req.method === 'GET' && cesta === '/admin/schvalenie') return html(await stranaSchvalenia(env, base));
        if (req.method === 'GET' && cesta === '/admin/ambasadori') return html(await adminAmbasadori(env));
        if (req.method === 'GET' && cesta === '/admin/chaty') return html(await chatAdmin(env, stranka));
        let am;
        if (req.method === 'GET' && (am = cesta.match(/^\/admin\/ambasadori\/(\d+)$/))) return await adminAmbasador(env, +am[1], url.searchParams.get('m'));
        if (req.method === 'POST' && (am = cesta.match(/^\/admin\/ambasadori\/(\d+)\/(stav|poznamka|vyplatene|podmienky)$/))) return await adminAmbAkcia(req, env, +am[1], am[2]);
        let v;
        if (req.method === 'GET' && (v = cesta.match(/^\/admin\/v\/(\d+)$/))) {
          const r = await env.DB.prepare('SELECT b64 FROM vystupy WHERE id = ?').bind(+v[1]).first();
          return new Response(r && r.b64 ? r.b64 : '', { status: r && r.b64 ? 200 : 404, headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'private, max-age=3600' } });
        }
        if (req.method === 'POST' && (v = cesta.match(/^\/admin\/v\/(\d+)\/(schval|zamietni)$/))) return await vystupAkcia(env, +v[1], v[2], req);
        if (req.method === 'POST' && cesta === '/admin/spusti') { await spracujFrontu(env); return presmeruj('/admin?m=vyroba'); }
        if (req.method === 'POST' && cesta === '/admin/suhrn') { await vecernySuhrn(env, false); return presmeruj('/admin?m=suhrn'); }
        if (m && m[2] === 'zariadit' && req.method === 'POST') {
          if (!env.OPENAI_KEY) return json({ ok: false, chyba: 'Chýba OPENAI_KEY.' }, 400);
          const o = await nacitaj(env, cislo);
          if (!o) return json({ ok: false, chyba: 'Objednávka neexistuje.' }, 404);
          const d = await req.json().catch(() => ({}));
          return await zariadFotku(env, o, +d.i || 0, kratko(d.pokyn, 500));
        }
        if (m && m[2] && req.method === 'POST') return await adminAkcia(req, env, base, cislo, m[2]);
      }
      return json({ ok: false, chyba: 'Nenájdené' }, 404, origin);
    } catch (e) {
      console.log('chyba', e.stack || e.message);
      return json({ ok: false, chyba: 'Nastala chyba. Skúste to znova alebo nám napíšte na info@realitnyasistent.eu.' }, 500, origin);
    }
  },
};
