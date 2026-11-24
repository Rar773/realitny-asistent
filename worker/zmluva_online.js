// Realitný asistent – online potvrdenie zmluvy o sprostredkovaní klientom
// Aplikácia (app.py) pošle hotovú zmluvu (HTML z nášho vzoru) a zoznam podpisujúcich.
// Každý podpisujúci dostane vlastný odkaz https://realitnyasistent.eu/zmluva.html#ID.TOKEN
// Klient si zmluvu prečíta, napíše meno (a ak máme e-mail, zadá kód z e-mailu) a potvrdí.
// Token a kľúč makléra ukladáme len ako odtlačok. Nepotvrdené zmluvy mažeme po 60 dňoch, potvrdené po 13 mesiacoch.

const WEB = 'https://realitnyasistent.eu';
const MAX_HTML = 250000;
const LIMIT_SKUPIN_IP_DEN = 40;
const KOD_PLATI_MIN = 15;

const nahodne = (n) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join('');
const teraz = () => new Date().toISOString();
const emailOk = (e) => /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,}$/i.test(String(e || '').trim());
const maska = (e) => { const [a, d] = String(e).split('@'); return (a.length <= 2 ? a[0] + '*' : a.slice(0, 2) + '***') + '@' + d; };
async function sha256(t) { const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)); return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join(''); }
const kratko = (s, n) => String(s || '').trim().slice(0, n);
const datumSk = (iso) => { if (!iso) return ''; const d = new Date(iso); return d.toLocaleString('sk-SK', { timeZone: 'Europe/Bratislava', day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }); };

async function posliMail(env, h, to, predmet, html, prilohy) {
  if (!env.RESEND_KEY || !emailOk(to)) return false;
  const text = html.replace(/<a [^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/g, '$2: $1').replace(/<[^>]+>/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n\n').trim();
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'Realitný asistent <info@realitnyasistent.eu>', to: [to], subject: predmet, html, text, ...(prilohy ? { attachments: prilohy } : {}) }),
  }).catch(() => null);
  return !!(r && r.ok);
}
const b64 = (t) => { const b = new TextEncoder().encode(t); let s = ''; for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode(...b.subarray(i, i + 8192)); return btoa(s); };

// zmluva + záznam o potvrdení (pre klienta e-mailom a pre makléra do aplikácie)
function doklad(r, zaznamy) {
  const riadky = zaznamy.map((z) => `<tr><td>${z.potvrdil_meno ? esc(z.potvrdil_meno) : esc(z.klient_meno || '')}</td><td>${z.potvrdena ? datumSk(z.potvrdena) : 'nepotvrdené'}</td><td>${z.potvrdene_kodom ? 'kód z e-mailu ' + esc(maska(z.klient_email)) : 'meno napísané klientom'}</td><td>${esc(z.potvrdil_ip || '')}</td></tr>`).join('');
  const zaznam = `<div style="break-before:page;font:10.5pt/1.45 Calibri,Arial,sans-serif;max-width:170mm;margin:0 auto">
<h2 style="font-size:12.5pt">Záznam o elektronickom potvrdení zmluvy</h2>
<p>Zmluva: ${esc(r.nazov || '')}<br>Odoslal: ${esc(r.makler_meno || '')}, dňa ${datumSk(r.vytvorena)}<br>Odtlačok obsahu zmluvy (SHA-256): <span style="font-family:monospace;font-size:8.5pt">${r.obsah_hash}</span></p>
<table style="width:100%;border-collapse:collapse" border="1" cellpadding="5"><tr><th align="left">Potvrdil</th><th align="left">Kedy</th><th align="left">Overenie</th><th align="left">IP adresa</th></tr>${riadky}</table>
<p style="font-size:9pt;color:#555">Záznam vyhotovil Realitný asistent (realitnyasistent.eu). Klient pred potvrdením zaškrtol: „Prečítal(a) som si zmluvu vrátane poučenia o práve na odstúpenie a súhlasím s jej uzavretím.“</p></div>`;
  return r.html.replace(/<\/body>/i, zaznam + '</body>');
}
function esc(t) { return String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

async function overApp(req, origin, json) {
  if (origin || req.headers.get('X-Zdroj') !== 'aplikacia') return json({ ok: false }, 403, origin);
  return null;
}
async function zoSkupiny(env, h, skupina, kluc) {
  if (!/^[a-z0-9]{8,20}$/.test(String(skupina || '')) || !kluc) return [];
  const rr = (await env.DB.prepare('SELECT * FROM zmluvy_online WHERE skupina = ? ORDER BY id').bind(skupina).all()).results || [];
  const kh = await h.hmac(env, 'zmo-kluc:' + kluc);
  return rr.filter((r) => r.kluc_h === kh);
}
async function nacitajKlient(env, h, id, t) {
  if (!/^[a-z0-9]{8,20}$/.test(String(id || '')) || !t) return null;
  const r = await env.DB.prepare('SELECT * FROM zmluvy_online WHERE id = ?').bind(id).first();
  if (!r || r.token_h !== await h.hmac(env, 'zmo-token:' + t)) return null;
  return r;
}

export async function zmluvaOnline(req, env, h, cesta) {
  const { json, origin } = h;

  // ---------------- z aplikácie ----------------
  if (cesta.startsWith('/zmluva-online/')) {
    const zle = await overApp(req, origin, json);
    if (zle) return zle;
    const t = await req.text();
    if (t.length > MAX_HTML + 20000) return json({ ok: false, chyba: 'Zmluva je príliš dlhá.' }, 413, origin);
    let d; try { d = JSON.parse(t); } catch { return json({ ok: false, chyba: 'Chybné údaje.' }, 400, origin); }

    if (cesta === '/zmluva-online/nova') {
      const html = String(d.html || '');
      const pod = (d.podpisujuci || []).filter((p) => kratko(p.meno, 120)).slice(0, 6);
      if (html.length < 500 || !/<html/i.test(html)) return json({ ok: false, chyba: 'Chýba text zmluvy.' }, 400, origin);
      if (!pod.length) return json({ ok: false, chyba: 'Chýba vlastník, ktorý má zmluvu potvrdiť.' }, 400, origin);
      const ip = await h.ipHash(env, req);
      const den = new Date(Date.now() - 864e5).toISOString();
      const n = await env.DB.prepare('SELECT COUNT(DISTINCT skupina) n FROM zmluvy_online WHERE ip_h = ? AND vytvorena > ?').bind(ip, den).first();
      if (n && n.n >= LIMIT_SKUPIN_IP_DEN) return json({ ok: false, chyba: 'Dnes ste už poslali veľa zmlúv. Skúste to zajtra.' }, 429, origin);
      const skupina = nahodne(12), kluc = nahodne(24), kh = await h.hmac(env, 'zmo-kluc:' + kluc);
      const obsah = await sha256(html), cas = teraz();
      const m = d.makler || {};
      const odkazy = [];
      for (const p of pod) {
        const id = nahodne(12), token = nahodne(20);
        const em = emailOk(p.email) ? String(p.email).trim().toLowerCase() : '';
        await env.DB.prepare(`INSERT INTO zmluvy_online (id, skupina, token_h, kluc_h, nazov, html, obsah_hash, makler_meno, makler_email, makler_tel, klient_meno, klient_email, stav, vytvorena, ip_h)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?, 'caka', ?, ?)`).bind(id, skupina, await h.hmac(env, 'zmo-token:' + token), kh, kratko(d.nazov, 160), html, obsah,
          kratko(m.meno, 160), emailOk(m.email) ? String(m.email).trim() : '', kratko(m.telefon, 40), kratko(p.meno, 120), em, cas, ip).run();
        const odkaz = `${WEB}/zmluva.html#${id}.${token}`;
        let poslany = false;
        if (em && d.poslat_email !== false) {
          poslany = await posliMail(env, h, em, `Zmluva na potvrdenie – ${kratko(m.meno, 80) || 'váš maklér'}`, h.emailHtml('Zmluva na potvrdenie',
            [`Dobrý deň${p.meno ? ', ' + esc(p.meno) : ''},`, `${esc(m.meno || 'Váš maklér')} vám posiela na potvrdenie <b>${esc(d.nazov || 'zmluvu o sprostredkovaní')}</b>.`,
              'Zmluvu si pozriete a potvrdíte online kliknutím na tlačidlo nižšie – nikam nemusíte chodiť. Pri potvrdení vám pošleme jednorazový kód na tento e-mail.',
              `Otázky ku zmluve smerujte priamo na makléra${m.telefon ? ' (tel. ' + esc(m.telefon) + ')' : ''}${emailOk(m.email) ? ' – ' + esc(m.email) : ''}.`], 'Pozrieť a potvrdiť zmluvu', odkaz));
        }
        odkazy.push({ meno: kratko(p.meno, 120), email: em, odkaz, email_poslany: poslany });
      }
      return json({ ok: true, skupina, kluc, odkazy }, 200, origin);
    }

    if (cesta === '/zmluva-online/stav') {
      const out = [];
      for (const p of (d.polozky || []).slice(0, 40)) {
        const rr = await zoSkupiny(env, h, p.skupina, p.kluc);
        out.push({ skupina: p.skupina, existuje: rr.length > 0, podpisujuci: rr.map((r) => ({ meno: r.klient_meno, stav: r.stav, otvorena: r.otvorena, potvrdena: r.potvrdena, potvrdil_meno: r.potvrdil_meno })) });
      }
      return json({ ok: true, polozky: out }, 200, origin);
    }

    if (cesta === '/zmluva-online/doklad') {
      const rr = await zoSkupiny(env, h, d.skupina, d.kluc);
      if (!rr.length) return json({ ok: false, chyba: 'Zmluva sa nenašla (mohla byť už vymazaná).' }, 404, origin);
      return json({ ok: true, html: doklad(rr[0], rr), vsetci: rr.every((r) => r.stav === 'potvrdena') }, 200, origin);
    }

    if (cesta === '/zmluva-online/zrus') {
      const rr = await zoSkupiny(env, h, d.skupina, d.kluc);
      for (const r of rr) await env.DB.prepare("DELETE FROM zmluvy_online WHERE id = ? AND stav != 'potvrdena'").bind(r.id).run();
      return json({ ok: true }, 200, origin);
    }
    return json({ ok: false }, 404, origin);
  }

  // ---------------- stránka pre klienta (realitnyasistent.eu/zmluva.html) ----------------
  if (origin && origin !== WEB && origin !== 'https://www.realitnyasistent.eu' && !/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) return json({ ok: false }, 403, origin);
  let d; try { d = await req.json(); } catch { return json({ ok: false }, 400, origin); }
  const r = await nacitajKlient(env, h, d.id, d.t);
  if (!r) return json({ ok: false, chyba: 'Odkaz na zmluvu je neplatný alebo zmluva bola zrušená. Kontaktujte, prosím, svojho makléra.' }, 404, origin);
  const trebaKod = !!(env.RESEND_KEY && r.klient_email);

  if (cesta === '/z/nacitaj') {
    if (!r.otvorena) await env.DB.prepare('UPDATE zmluvy_online SET otvorena = ? WHERE id = ?').bind(teraz(), r.id).run();
    return json({ ok: true, nazov: r.nazov, html: r.html, stav: r.stav, makler: r.makler_meno, makler_tel: r.makler_tel, makler_email: r.makler_email,
      klient: r.klient_meno, treba_kod: trebaKod, email: trebaKod ? maska(r.klient_email) : '', potvrdena: r.potvrdena ? datumSk(r.potvrdena) : '', potvrdil: r.potvrdil_meno || '' }, 200, origin);
  }
  if (r.stav === 'potvrdena') return json({ ok: false, chyba: 'Zmluva už je potvrdená.' }, 409, origin);

  if (cesta === '/z/kod') {
    if (!trebaKod) return json({ ok: false, chyba: 'Kód nie je potrebný.' }, 400, origin);
    if (r.kod_cas && Date.now() - Date.parse(r.kod_cas) < 60e3) return json({ ok: false, chyba: 'Kód sme práve poslali. Nový si môžete vyžiadať o minútu.' }, 429, origin);
    if ((r.kod_pokusy || 0) >= 25) return json({ ok: false, chyba: 'Príliš veľa pokusov. Kontaktujte svojho makléra.' }, 429, origin);
    const kod = String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000));
    await env.DB.prepare('UPDATE zmluvy_online SET kod_h = ?, kod_cas = ?, kod_pokusy = COALESCE(kod_pokusy,0) + 5 WHERE id = ?').bind(await h.hmac(env, 'zmo-kod:' + r.id + ':' + kod), teraz(), r.id).run();
    const ok = await posliMail(env, h, r.klient_email, `Kód na potvrdenie zmluvy: ${kod}`, h.emailHtml('Kód na potvrdenie zmluvy',
      [`Váš kód na potvrdenie zmluvy <b>${esc(r.nazov || '')}</b> je:`, `<span style="font-size:28px;font-weight:800;letter-spacing:.15em">${kod}</span>`, `Kód platí ${KOD_PLATI_MIN} minút. Ak ste o kód nežiadali, e-mail ignorujte.`]));
    if (!ok) return json({ ok: false, chyba: 'Kód sa nepodarilo poslať. Skúste to o chvíľu znova.' }, 502, origin);
    return json({ ok: true }, 200, origin);
  }

  if (cesta === '/z/potvrd') {
    const meno = kratko(d.meno, 120);
    if (!d.suhlas) return json({ ok: false, chyba: 'Potvrďte, že ste si zmluvu prečítali a súhlasíte s ňou.' }, 400, origin);
    if (meno.length < 4 || !/\s/.test(meno)) return json({ ok: false, chyba: 'Napíšte svoje meno a priezvisko.' }, 400, origin);
    if (trebaKod) {
      if (!r.kod_h || !r.kod_cas || Date.now() - Date.parse(r.kod_cas) > KOD_PLATI_MIN * 60e3) return json({ ok: false, chyba: 'Najprv si vyžiadajte kód (alebo kód vypršal – vyžiadajte si nový).' }, 400, origin);
      await env.DB.prepare('UPDATE zmluvy_online SET kod_pokusy = COALESCE(kod_pokusy,0) + 1 WHERE id = ?').bind(r.id).run();
      if ((r.kod_pokusy || 0) >= 25 || r.kod_h !== await h.hmac(env, 'zmo-kod:' + r.id + ':' + String(d.kod || '').replace(/\D/g, ''))) return json({ ok: false, chyba: 'Kód nesedí. Skontrolujte ho v e-maile.' }, 400, origin);
    }
    const cas = teraz();
    const ip = req.headers.get('CF-Connecting-IP') || '';
    await env.DB.prepare("UPDATE zmluvy_online SET stav = 'potvrdena', potvrdena = ?, potvrdil_meno = ?, potvrdil_ip = ?, potvrdil_ua = ?, potvrdene_kodom = ?, kod_h = NULL WHERE id = ? AND stav = 'caka'")
      .bind(cas, meno, ip, kratko(req.headers.get('User-Agent'), 300), trebaKod ? 1 : 0, r.id).run();
    const rr = (await env.DB.prepare('SELECT * FROM zmluvy_online WHERE skupina = ? ORDER BY id').bind(r.skupina).all()).results || [];
    const dok = doklad(r, rr);
    // kópia zmluvy klientovi (trvalý nosič) a správa maklérovi
    if (r.klient_email) await posliMail(env, h, r.klient_email, `Potvrdená zmluva – ${r.nazov || 'zmluva o sprostredkovaní'}`, h.emailHtml('Ďakujeme, zmluva je potvrdená',
      [`Dobrý deň, ${esc(meno)},`, `zmluvu <b>${esc(r.nazov || '')}</b> ste potvrdili ${datumSk(cas)}. Kópiu zmluvy vrátane poučenia o práve na odstúpenie a formulára nájdete v prílohe.`,
        `Otázky ku zmluve smerujte na makléra${r.makler_meno ? ' ' + esc(r.makler_meno) : ''}${r.makler_tel ? ', tel. ' + esc(r.makler_tel) : ''}.`]),
      [{ filename: 'zmluva.html', content: b64(dok) }]);
    if (r.makler_email) await posliMail(env, h, r.makler_email, `✓ ${meno} potvrdil(a) zmluvu`, h.emailHtml('Klient potvrdil zmluvu',
      [`<b>${esc(meno)}</b> potvrdil(a) zmluvu <b>${esc(r.nazov || '')}</b> dňa ${datumSk(cas)}.`, rr.every((x) => x.stav === 'potvrdena') ? 'Zmluvu už potvrdili všetci vlastníci.' : `Ešte čaká: ${rr.filter((x) => x.stav !== 'potvrdena').map((x) => esc(x.klient_meno)).join(', ')}.`,
        'Zmluvu so záznamom o potvrdení nájdete v prílohe aj v aplikácii v časti Zmluvy.']), [{ filename: 'zmluva-potvrdena.html', content: b64(dok) }]);
    return json({ ok: true, potvrdena: datumSk(cas), html: dok }, 200, origin);
  }
  return json({ ok: false }, 404, origin);
}

export async function zmluvyOnlineUdrzba(env) {
  await env.DB.prepare("DELETE FROM zmluvy_online WHERE stav != 'potvrdena' AND vytvorena < ?").bind(new Date(Date.now() - 60 * 864e5).toISOString()).run();
  await env.DB.prepare('DELETE FROM zmluvy_online WHERE vytvorena < ?').bind(new Date(Date.now() - 400 * 864e5).toISOString()).run();
}
