// Spoločný kód ukážkového webu projektu: načítanie dát, formáty, pôdorys a poloha bytu.
// Dáta (ceny a stavy) prichádzajú z aplikácie Realitný asistent ako projekt.json.

export const STAV = {
  volny: { t: 'Voľný', c: 'volny' },
  rezervovany: { t: 'Rezervovaný', c: 'rez' },
  predany: { t: 'Predaný', c: 'pred' },
};

const nf = new Intl.NumberFormat('sk-SK', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('sk-SK', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat('sk-SK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const eur = (n) => nf.format(n).replace(/\s/g, ' ') + ' €';
export const m2 = (n) => nf1.format(n) + ' m²';
export const dlzka = (n) => nf2.format(n);
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function datum(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return d.toLocaleDateString('sk-SK', { day: 'numeric', month: 'numeric', year: 'numeric' }) +
    ' o ' + d.toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' });
}

export async function nacitaj() {
  const r = await fetch('projekt.json', { cache: 'no-store' });
  if (!r.ok) throw new Error('projekt.json ' + r.status);
  const d = await r.json();
  d.byty.forEach((b) => { b.t = d.typy[b.typ]; b.izby = b.t.izby; });
  return d;
}

export const izbyText = (n) => n + '-izbový';
export const podlazieText = (p) => p + '. podlažie';
export const vonkText = (b) => (b.vonkajsia_druh === 'terasa' ? 'Terasa' : 'Balkón');

// ---------- Pôdorys bytu (SVG) ----------
// detail: veľký výkres s rozmermi; inak malý náhľad do dlaždice.
export function podorys(typ, { detail = false, druh = 'balkón', id = '' } = {}) {
  const S = 40; // 1 m = 40 jednotiek
  const [W, H] = typ.rozmer;
  const [bx, by, bw, bh] = typ.balkon;
  const pl = detail ? 64 : 8, pt = detail ? 64 : 8, pr = detail ? 16 : 8, pb = detail ? 12 : 8;
  const vw = W * S + pl + pr;
  const vh = Math.max(H, by + bh) * S + pt + pb;
  const X = (m) => pl + m * S;
  const Y = (m) => pt + m * S;
  const hid = 'h' + (id || typ.nazov).replace(/[^a-z0-9]/gi, '');
  let s = `<svg class="plan${detail ? ' plan-d' : ''}" viewBox="0 0 ${vw} ${vh}" role="img" aria-label="Pôdorys bytu, ${esc(typ.nazov)}, ${nf1.format(typ.plocha)} m²">`;
  s += `<defs><pattern id="${hid}" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="10" class="hatch"/></pattern></defs>`;
  // balkón / terasa
  s += `<rect x="${X(bx)}" y="${Y(by)}" width="${bw * S}" height="${bh * S}" fill="url(#${hid})" class="balk"/>`;
  // miestnosti
  for (const [n, x, y, w, h] of typ.miestnosti) {
    const mokra = /Kúpe|WC/.test(n);
    s += `<rect x="${X(x)}" y="${Y(y)}" width="${w * S}" height="${h * S}" class="room${mokra ? ' wet' : ''}"/>`;
  }
  // vonkajší obrys
  s += `<rect x="${X(0)}" y="${Y(0)}" width="${W * S}" height="${H * S}" class="obrys"/>`;
  // okná na fasáde (obytné miestnosti pri vonkajšej stene)
  const ok = typ.okna || [];
  for (const [n, x, y, w, h] of typ.miestnosti) {
    if (/Predsie|Šatník|Komora|WC|Kúpe/.test(n)) continue;
    const okno = (vod, d) => {
      const l = Math.min(d * 0.55, 2.4) * S, t = 10;
      return vod ? `<rect x="${vod.x - l / 2}" y="${vod.y - t / 2}" width="${l}" height="${t}" class="okno"/><line x1="${vod.x - l / 2}" y1="${vod.y}" x2="${vod.x + l / 2}" y2="${vod.y}" class="okno"/>`
        : '';
    };
    const oknoV = (cx, cy, d) => {
      const l = Math.min(d * 0.55, 2.4) * S, t = 10;
      return `<rect x="${cx - t / 2}" y="${cy - l / 2}" width="${t}" height="${l}" class="okno"/><line x1="${cx}" y1="${cy - l / 2}" x2="${cx}" y2="${cy + l / 2}" class="okno"/>`;
    };
    if (ok.includes('dole') && Math.abs(y + h - H) < 0.01) s += okno({ x: X(x + w / 2), y: Y(H) }, w);
    if (ok.includes('vlavo') && x === 0) s += oknoV(X(0), Y(y + h / 2), h);
    if (ok.includes('vpravo') && Math.abs(x + w - W) < 0.01) s += oknoV(X(W), Y(y + h / 2), h);
  }
  if (detail) {
    for (const [n, x, y, w, h] of typ.miestnosti) {
      const cx = X(x + w / 2), cy = Y(y + h / 2);
      const maly = w * h < 7;
      const lines = maly ? [n] : n.split(' s ').length > 1 ? [n.split(' s ')[0], 's ' + n.split(' s ')[1]] : [n];
      const fs = maly ? 11 : 13;
      let ty = cy - (lines.length - 1) * (fs * 0.6) - (maly ? 4 : 8);
      for (const l of lines) { s += `<text x="${cx}" y="${ty}" class="rn" font-size="${fs}">${esc(l)}</text>`; ty += fs * 1.2; }
      s += `<text x="${cx}" y="${ty + 2}" class="ra" font-size="${maly ? 11 : 13}">${nf1.format(w * h)} m²</text>`;
      if (!maly) s += `<text x="${cx}" y="${ty + 18}" class="rd" font-size="11">${dlzka(w)} × ${dlzka(h)}</text>`;
    }
    s += `<text x="${X(bx + bw / 2)}" y="${Y(by + bh / 2) + 4}" class="rn bl" font-size="12">${esc(druh[0].toUpperCase() + druh.slice(1))}</text>`;
    // kóty: šírka hore, hĺbka vľavo
    const ky = Y(0) - 34, kx = X(0) - 34;
    s += kota(X(0), ky, X(W), ky, dlzka(W) + ' m', false);
    s += kota(kx, Y(0), kx, Y(H), dlzka(H) + ' m', true);
    // reťazová kóta miestností v hornom páse
    const zlomy = [...new Set(typ.miestnosti.filter((m) => m[2] === 0).flatMap((m) => [m[1], m[1] + m[3]]))].sort((a, b) => a - b);
    const ky2 = Y(0) - 14;
    s += `<line x1="${X(0)}" y1="${ky2}" x2="${X(W)}" y2="${ky2}" class="k1"/>`;
    for (let i = 0; i < zlomy.length; i++) {
      s += `<line x1="${X(zlomy[i])}" y1="${ky2 - 4}" x2="${X(zlomy[i])}" y2="${ky2 + 4}" class="k1"/>`;
      if (i) {
        const d = zlomy[i] - zlomy[i - 1];
        if (d * S > 34) s += `<text x="${X((zlomy[i] + zlomy[i - 1]) / 2)}" y="${ky2 - 4}" class="kt2">${dlzka(d)}</text>`;
      }
    }
  }
  return s + '</svg>';
}

function kota(x1, y1, x2, y2, t, zvisla) {
  let s = `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="k"/>`;
  const tick = (x, y) => `<line x1="${x - 5}" y1="${y + 5}" x2="${x + 5}" y2="${y - 5}" class="k"/>`;
  s += tick(x1, y1) + tick(x2, y2);
  if (zvisla) {
    const cy = (y1 + y2) / 2;
    s += `<text x="${x1 - 8}" y="${cy}" class="kt" transform="rotate(-90 ${x1 - 8} ${cy})">${t}</text>`;
  } else {
    s += `<text x="${(x1 + x2) / 2}" y="${y1 - 8}" class="kt">${t}</text>`;
  }
  return s;
}

// ---------- Poloha bytu na podlaží (schéma) ----------
// Pozície 1–3 sú na severnej strane, 4–5 na južnej, medzi nimi chodba a schodisko s výťahom.
const POLOHA = {
  1: [0, 0, 10.6, 7.6], 2: [10.6, 0, 6.2, 7.6], 3: [19.8, 0, 8.4, 7.6],
  5: [0, 9.4, 14, 8.0], 4: [21, 9.4, 7.2, 8.0],
};
export function poloha(byt, byty = []) {
  const S = 9, p = 16;
  const W = 28.2, H = 17.4;
  const X = (m) => p + m * S, Y = (m) => p + 18 + m * S;
  let s = `<svg class="poloha" viewBox="0 0 ${W * S + p * 2 + 40} ${H * S + p * 2 + 18}" role="img" aria-label="Poloha bytu ${esc(byt.id)} na ${byt.podlazie}. podlaží">`;
  s += `<rect x="${X(0)}" y="${Y(0)}" width="${W * S}" height="${H * S}" class="pl-dom"/>`;
  s += `<rect x="${X(16.8)}" y="${Y(0)}" width="${3 * S}" height="${7.6 * S}" class="pl-jadro"/>`;
  s += `<rect x="${X(14)}" y="${Y(9.4)}" width="${7 * S}" height="${8 * S}" class="pl-jadro"/>`;
  s += `<text x="${X(17.5)}" y="${Y(13.6)}" class="pl-t">schodisko</text>`;
  for (const [poz, [x, y, w, h]] of Object.entries(POLOHA)) {
    const b = byty.find((q) => q.podlazie === byt.podlazie && q.pozicia === +poz);
    const ja = +poz === byt.pozicia;
    s += `<rect x="${X(x) + 1.5}" y="${Y(y) + 1.5}" width="${w * S - 3}" height="${h * S - 3}" rx="3" class="pl-b${ja ? ' ja' : ''}"/>`;
    if (b) s += `<text x="${X(x + w / 2)}" y="${Y(y + h / 2) + 4}" class="pl-t${ja ? ' ja' : ''}">${esc(b.id)}</text>`;
  }
  // sever
  const sx = X(W) + 24, sy = Y(0) + 4;
  s += `<g class="pl-s" aria-hidden="true"><path d="M${sx} ${sy - 12} l7 18 -7 -5 -7 5z"/><text x="${sx}" y="${sy + 24}" class="pl-t">S</text></g>`;
  return s + '</svg>';
}

export function zostav(htmlSel, html) {
  const el = typeof htmlSel === 'string' ? document.querySelector(htmlSel) : htmlSel;
  if (el) el.innerHTML = html;
  return el;
}
