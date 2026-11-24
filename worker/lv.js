// Realitný asistent – čítanie listu vlastníctva (LV) pre zmluvy o sprostredkovaní
// POST /lv  telo: {"typ":"pdf|jpg|png|webp","b64":"..."}  (posiela aplikácia cez app.py)
// Obsah LV sa neukladá – zapisuje sa len čas a skrátený odtlačok IP kvôli limitom.

const LIMIT_IP_DEN = 40;
const LIMIT_DEN = 600;
const MAX_DLZKA = 5e6; // aplikácia fotky zmenší, PDF z katastra má do 1 MB

const ZADANIE = `Toto je výpis z listu vlastníctva (LV) zo slovenského katastra nehnuteľností – PDF výpis z katastra (ZBGIS / ESKN) alebo fotka papierového výpisu.
Vytiahni z neho údaje a vráť IBA platný JSON (bez komentárov a bez markdownu) presne v tomto tvare:
{
 "okres": "", "obec": "", "katastralne_uzemie": "", "cislo_lv": "", "datum_vypisu": "",
 "parcely": [{"register": "C alebo E", "cislo": "", "vymera_m2": "", "druh": ""}],
 "stavby": [{"supisne_cislo": "", "parcela": "", "druh": "", "popis": ""}],
 "byty": [{"cislo_bytu": "", "vchod": "", "poschodie": "", "dom_supisne_cislo": "", "podiel_spolocne": ""}],
 "vlastnici": [{"meno": "", "rodne_priezvisko": "", "datum_narodenia": "", "adresa": "", "podiel": "", "ico": ""}],
 "tarchy": [""],
 "poznamky": ""
}
Pravidlá:
- Údaje prepisuj presne tak, ako sú vo výpise (diakritika, čísla parciel, podiely ako zlomok, napr. 1/2). Nič nevymýšľaj. Čo vo výpise nie je, nechaj prázdne alebo prázdny zoznam.
- Časť A (majetková podstata) = parcely a stavby. Časť B = vlastníci a ich spoluvlastnícke podiely, pri bytoch aj číslo bytu, vchod, poschodie a podiel na spoločných častiach. Časť C = ťarchy (záložné práva, vecné bremená, predkupné práva, exekúcie) – každú ťarchu ako jednu stručnú vetu. Ak je v časti C „Bez zápisu“, vráť prázdny zoznam.
- "meno" = titul, meno a priezvisko vlastníka (napr. "Ing. Ján Novák"), pri firme obchodné meno. "datum_narodenia" vo formáte DD.MM.RRRR.
- "rodne_priezvisko" vyplň len vtedy, ak sa líši od súčasného priezviska.
- Pri stavbách daj do "druh" slovný názov (napr. "Rodinný dom"), nie číselný kód.
- Rodné čísla nevypisuj.
- Ak dokument nie je list vlastníctva, vráť {"chyba": "nie je LV"}.`;

async function pocet(env, sql, ...a) { const r = await env.DB.prepare(sql).bind(...a).first(); return r ? r.n : 0; }

export async function citajLV(req, env, h) {
  const { json, origin, ipHash } = h;
  if (!env.OPENAI_KEY) return json({ ok: false, chyba: 'Čítanie listu vlastníctva je dočasne nedostupné.' }, 503, origin);
  const t = await req.text();
  if (t.length > MAX_DLZKA) return json({ ok: false, chyba: 'Súbor je príliš veľký. Nahrajte PDF z katastra alebo menšiu fotku.' }, 413, origin);
  // telo: {"typ":"pdf|jpg","subory":[{"b64":"..."},...]} – najviac 4 strany (fotky papierového LV)
  const typ = (/"typ"\s*:\s*"(pdf|jpg|jpeg|png|webp)"/i.exec(t.slice(0, 200)) || [])[1];
  const casti = [];
  let i = 0;
  while (casti.length < 4 && (i = t.indexOf('"b64":"', i)) >= 0) {
    const k = t.indexOf('"', i + 7);
    if (k < 0) break;
    casti.push(t.slice(i + 7, k));
    i = k + 1;
  }
  if (!typ || !casti.length) return json({ ok: false, chyba: 'Nahrajte list vlastníctva ako PDF alebo fotku.' }, 400, origin);
  for (const b64 of casti) {
    if (b64.length < 200 || !/^[A-Za-z0-9+/=]+$/.test(b64.slice(0, 64) + b64.slice(-64))) return json({ ok: false, chyba: 'Súbor sa nepodarilo načítať.' }, 400, origin);
  }

  const ip = await ipHash(env, req);
  const den = new Date(Date.now() - 864e5).toISOString();
  if ((ip && await pocet(env, 'SELECT COUNT(*) n FROM lv_log WHERE ip_h = ? AND cas > ?', ip, den) >= LIMIT_IP_DEN)
    || await pocet(env, 'SELECT COUNT(*) n FROM lv_log WHERE cas > ?', den) >= LIMIT_DEN) {
    return json({ ok: false, chyba: 'Dnes ste dosiahli limit načítaných listov vlastníctva. Skúste to zajtra alebo údaje vyplňte ručne.' }, 429, origin);
  }
  await env.DB.prepare('INSERT INTO lv_log (cas, ip_h) VALUES (?, ?)').bind(new Date().toISOString(), ip).run();

  const t2 = typ.toLowerCase() === 'jpg' ? 'jpeg' : typ.toLowerCase();
  const subory = casti.map((_, n) => (t2 === 'pdf'
    ? { type: 'input_file', filename: `list_vlastnictva_${n + 1}.pdf`, file_data: `data:application/pdf;base64,@@S${n}@@` }
    : { type: 'input_image', image_url: `data:image/${t2};base64,@@S${n}@@`, detail: 'high' }));
  // telo skladáme bez JSON.stringify veľkého base64 (šetrí čas procesora)
  const kostra = JSON.stringify({ model: env.LV_MODEL || env.QA_MODEL || 'gpt-6.1-terra', store: false, max_output_tokens: 4000,
    input: [{ role: 'user', content: [{ type: 'input_text', text: ZADANIE + (casti.length > 1 ? `\nDokument má ${casti.length} strany – spoj údaje zo všetkých.` : '') }, ...subory] }] });
  let telo = kostra;
  casti.forEach((b64, n) => { const [x, y] = telo.split(`@@S${n}@@`); telo = x + b64 + y; });
  const r = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.OPENAI_KEY}`, 'Content-Type': 'application/json' },
    body: telo,
    signal: AbortSignal.timeout(90000),
  });
  if (!r.ok) { console.log('lv openai', r.status, (await r.text()).slice(0, 300)); return json({ ok: false, chyba: 'List vlastníctva sa nepodarilo prečítať. Skúste to znova alebo údaje vyplňte ručne.' }, 502, origin); }
  const j = await r.json();
  const text = (j.output || []).filter((o) => o.type === 'message').flatMap((o) => o.content || []).filter((c) => c.type === 'output_text').map((c) => c.text).join('\n');
  const m = text.match(/\{[\s\S]*\}/);
  let d = null;
  try { d = m ? JSON.parse(m[0]) : null; } catch { d = null; }
  if (!d) return json({ ok: false, chyba: 'Z dokumentu sa nepodarilo vyčítať údaje. Skúste ostrejšiu fotku alebo PDF z katastra.' }, 422, origin);
  if (d.chyba) return json({ ok: false, chyba: 'Nahraný dokument nevyzerá ako list vlastníctva.' }, 422, origin);
  return json({ ok: true, lv: d }, 200, origin);
}
