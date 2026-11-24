// Realitný asistent – príjem objednávok (web aj aplikácia)
// Objednávku a fotky posiela do Telegramu (TG_TOKEN, TG_CHAT sú tajné premenné vo Workeri).

const POVOLENE = ['https://realitnyasistent.eu', 'https://www.realitnyasistent.eu', 'http://localhost:8765', 'http://127.0.0.1:8765'];
const MAX_FOTIEK = 10;
const MAX_FOTKA = 15 * 1024 * 1024; // 15 MB na fotku
const STYLY = { moderny: 'Moderný', skandinavsky: 'Škandinávsky', klasicky: 'Klasický' };
const VIDEA = { standard: ['Video Štandard', 29], premiove: ['Video Prémiové', 89] };

// Cenník virtuálneho zariadenia: 1 fotka 9 €, do 5 fotiek 29 €, do 10 fotiek 49 €
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
  } else if (VIDEA[sluzba]) {
    v = VIDEA[sluzba][1];
  }
  return { zariadenie: z, video: v, spolu: z + v };
}

const eur = (x) => (Number.isInteger(x) ? x : x.toFixed(2)).toString().replace('.', ',') + ' €';
const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const kratko = (s, n = 500) => String(s ?? '').trim().slice(0, n);

function cors(origin) {
  const h = { 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-Zdroj', 'Access-Control-Max-Age': '86400', 'Vary': 'Origin' };
  if (POVOLENE.includes(origin)) h['Access-Control-Allow-Origin'] = origin;
  return h;
}
function odpoved(data, status, origin) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors(origin) } });
}

async function tg(env, metoda, body) {
  const r = await fetch(`https://api.telegram.org/bot${env.TG_TOKEN}/${metoda}`, { method: 'POST', body });
  const j = await r.json().catch(() => ({}));
  if (!j.ok) throw new Error(`Telegram ${metoda}: ${j.description || r.status}`);
  return j;
}

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
    if (req.method === 'GET' && url.pathname === '/') return odpoved({ ok: true, sluzba: 'objednavky' }, 200, origin);
    if (req.method !== 'POST' || url.pathname !== '/objednavka') return odpoved({ ok: false, chyba: 'Nenájdené' }, 404, origin);
    // z prehliadača prijímame len z nášho webu; aplikácia posiela bez Origin
    if (origin && !POVOLENE.includes(origin)) return odpoved({ ok: false, chyba: 'Nepovolený pôvod' }, 403, origin);

    let f;
    try { f = await req.formData(); } catch { return odpoved({ ok: false, chyba: 'Neplatné údaje formulára' }, 400, origin); }
    if (kratko(f.get('web'))) return odpoved({ ok: true, cislo: 'OK' }, 200, origin); // honeypot – roboti

    const sluzba = kratko(f.get('sluzba'), 20);
    const meno = kratko(f.get('meno'), 120), email = kratko(f.get('email'), 160), telefon = kratko(f.get('telefon'), 40);
    const inzerat = kratko(f.get('inzerat'), 600), poznamka = kratko(f.get('poznamka'), 2000), kod = kratko(f.get('kod'), 40);
    const styl = STYLY[f.get('styl')] ? f.get('styl') : 'moderny';
    const sVideom = f.get('s_videom') === 'ano', video = kratko(f.get('video'), 20), novy = f.get('novy') === 'ano';
    const zdroj = req.headers.get('X-Zdroj') === 'aplikacia' ? 'aplikácia' : 'web';

    if (!['zariadenie', 'standard', 'premiove'].includes(sluzba)) return odpoved({ ok: false, chyba: 'Vyberte službu.' }, 400, origin);
    if (!meno || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return odpoved({ ok: false, chyba: 'Vyplňte meno a platný e-mail.' }, 400, origin);
    if (f.get('suhlas') !== 'ano') return odpoved({ ok: false, chyba: 'Potvrďte súhlas s obchodnými podmienkami.' }, 400, origin);
    if (inzerat && !/^https?:\/\//i.test(inzerat)) return odpoved({ ok: false, chyba: 'Odkaz na inzerát musí začínať https://' }, 400, origin);

    const fotky = f.getAll('fotky').filter((x) => x && typeof x === 'object' && x.size > 0);
    const miestnosti = f.getAll('miestnost').map((x) => kratko(x, 40));
    if (fotky.length > MAX_FOTIEK) return odpoved({ ok: false, chyba: `Najviac ${MAX_FOTIEK} fotiek v jednej objednávke.` }, 400, origin);
    for (const x of fotky) {
      if (x.size > MAX_FOTKA) return odpoved({ ok: false, chyba: `Fotka ${x.name} je väčšia ako 15 MB.` }, 400, origin);
      if (x.type && !x.type.startsWith('image/')) return odpoved({ ok: false, chyba: `Súbor ${x.name} nie je fotka.` }, 400, origin);
    }
    let pocet = fotky.length;
    if (sluzba === 'zariadenie' && !pocet) pocet = Math.min(MAX_FOTIEK, Math.max(0, parseInt(f.get('pocet') || '0', 10) || 0));
    if (sluzba === 'zariadenie' && !pocet) return odpoved({ ok: false, chyba: 'Nahrajte fotky alebo uveďte počet fotiek z inzerátu.' }, 400, origin);
    if (sluzba === 'zariadenie' && !fotky.length && !inzerat) return odpoved({ ok: false, chyba: 'Nahrajte fotky alebo vložte odkaz na inzerát.' }, 400, origin);
    if (sluzba !== 'zariadenie' && !inzerat && !fotky.length) return odpoved({ ok: false, chyba: 'Vložte odkaz na inzerát alebo nahrajte fotky.' }, 400, origin);

    const c = vypocitaj({ sluzba, pocet, sVideom, video, novy });
    const d = new Date();
    const cislo = `RA-${d.toISOString().slice(2, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    const riadky = [
      `🆕 <b>Nová objednávka ${cislo}</b> (${zdroj})`,
      '',
      sluzba === 'zariadenie'
        ? `🛋 <b>Virtuálne zariadenie</b>: ${pocet} ${pocet === 1 ? 'fotka' : pocet < 5 ? 'fotky' : 'fotiek'}, štýl <b>${STYLY[styl]}</b>`
        : `🎬 <b>${VIDEA[sluzba][0]}</b>`,
      sluzba === 'zariadenie' && sVideom && VIDEA[video] ? `🎬 + ${VIDEA[video][0]} k tej istej nehnuteľnosti (−50 % na zariadenie)` : null,
      novy ? '🎁 Nový klient – žiada prvé 3 fotky zadarmo (over!)' : null,
      kod ? `🤝 Odporúčací kód: <b>${esc(kod)}</b>` : null,
      `💶 Orientačne: <b>${eur(c.spolu)}</b>`,
      '',
      `👤 ${esc(meno)}`,
      `✉️ ${esc(email)}`,
      telefon ? `📞 ${esc(telefon)}` : null,
      inzerat ? `🔗 ${esc(inzerat)}` : null,
      poznamka ? `\n📝 ${esc(poznamka)}` : null,
      fotky.length ? `\n📷 Fotky (${fotky.length}) posielam v ďalšej správe.` : null,
    ].filter((r) => r !== null);

    if (env.TEST_REZIM === '1') {
      return odpoved({ ok: true, cislo, cena: c.spolu, test: { sprava: riadky.join('\n'), fotky: fotky.map((x, i) => `${x.name} (${Math.round(x.size / 1024)} kB) – ${miestnosti[i] || ''}`) } }, 200, origin);
    }
    try {
      const m = new FormData();
      m.append('chat_id', env.TG_CHAT);
      m.append('parse_mode', 'HTML');
      m.append('disable_web_page_preview', 'true');
      m.append('text', riadky.join('\n').slice(0, 4000));
      await tg(env, 'sendMessage', m);

      if (fotky.length) {
        const g = new FormData();
        g.append('chat_id', env.TG_CHAT);
        const media = fotky.map((x, i) => {
          const nazov = `${cislo}_${String(i + 1).padStart(2, '0')}_${(miestnosti[i] || 'fotka').replace(/[^\p{L}\p{N}]+/gu, '-')}.jpg`;
          g.append(`f${i}`, x, nazov);
          return { type: 'document', media: `attach://f${i}`, caption: `${i + 1}. ${miestnosti[i] || ''}`.trim() };
        });
        g.append('media', JSON.stringify(media));
        await tg(env, 'sendMediaGroup', g);
      }
    } catch (e) {
      console.log('chyba', e.message);
      return odpoved({ ok: false, chyba: 'Objednávku sa nepodarilo odoslať. Skúste to znova alebo nám napíšte na info@realitnyasistent.eu.' }, 502, origin);
    }
    return odpoved({ ok: true, cislo, cena: c.spolu }, 200, origin);
  },
};
