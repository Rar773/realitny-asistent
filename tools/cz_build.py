# -*- coding: utf-8 -*-
"""POZOR – ZASTARANÉ (28. 11. 2026): slovníky nie sú aktuálne, české stránky sa upravujú ručne. Nespúšťať – prepíše cz/ a odkazy na SK stránkach.
Česká verzia webu: zo slovenských stránok a slovníkov tools/cz/*.json vyrobí priečinok cz/.
Spustenie z koreňa repa:  python tools/cz_build.py   (pred tools/kontrola.py)
- texty a popisy (alt, title, aria-label, placeholder, meta) sa prekladajú podľa slovníka stránky + spoločného slovníka,
- ceny v eurách sa menia na Kč podľa tabuľky CENY,
- odkazy na obrázky, štýly a skripty dostanú ../, odkazy medzi preloženými stránkami ostávajú v cz/,
- chýbajúci preklad = chyba (stránka sa nevyrobí s polovicou slovenčiny)."""
import json
import sys as _s
if "--naozaj" not in _s.argv:
    raise SystemExit("cz_build.py je zastaraný – české stránky sa upravujú ručne (spusti s --naozaj len ak si aktualizoval slovníky).")
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SL = ROOT / 'tools' / 'cz'
OUT = ROOT / 'cz'
WEB = 'https://realitnyasistent.eu'
ATTR = ('alt', 'title', 'aria-label', 'placeholder', 'content', 'data-m', 'data-r', 'data-s', 'data-c', 'value')

STRANKY = json.loads((SL / 'stranky.json').read_text(encoding='utf-8'))  # {"index.html": "index.json", ...}
SPOL = json.loads((SL / 'spolocne.json').read_text(encoding='utf-8'))
CENY = [tuple(x) for x in json.loads((SL / 'ceny.json').read_text(encoding='utf-8'))]
JS = json.loads((SL / 'js.json').read_text(encoding='utf-8'))  # {"main.js": {"sk": "cz", ...}, ...}


def norm(s):
    return s.replace('&nbsp;', ' ')


class P(HTMLParser):
    def __init__(s):
        super().__init__(convert_charrefs=False)
        s.out = []
        s.skip = 0

    def handle_starttag(s, t, a):
        if t in ('script', 'style'):
            s.skip += 1
        d = dict(a)
        for k in ATTR:
            v = d.get(k)
            if v and re.search(r'[A-Za-zÁ-ž]{2}', v):
                if k == 'content' and d.get('name') not in ('description', 'twitter:title', 'twitter:description') and d.get('property') not in ('og:title', 'og:description'):
                    continue
                if k == 'value' and t != 'button':
                    continue
                s.out.append(v)

    def handle_endtag(s, t):
        if t in ('script', 'style'):
            s.skip -= 1

    def handle_data(s, d):
        if s.skip:
            return
        t = d.strip()
        if t and re.search(r'[A-Za-zÁ-ž]', t):
            s.out.append(t)


def retazce(text):
    p = P()
    p.feed(text)
    return list(dict.fromkeys(p.out))


def cena(t):
    for a, b in CENY:
        if t.strip() == a:
            return t.replace(a, b)
    return None


def preloz_html(text, D, chyby, f):
    casti = re.split(r'(<script\b.*?</script>|<style\b.*?</style>)', text, flags=re.S | re.I)
    for i in range(0, len(casti), 2):
        c = casti[i]

        def uzol(m):
            t = m.group(1)
            s = t.strip()
            if not s:
                return m.group(0)
            if s in D:
                return '>' + t.replace(s, D[s]) + '<'
            c2 = cena(s)
            if c2 is not None:
                return '>' + t.replace(s, c2) + '<'
            if re.search(r'[A-Za-zÁ-ž]', s):
                chyby.append(f'{f}: chýba preklad textu: {s[:90]}')
            return m.group(0)
        ulozene = []

        def atr(m):
            k, v = m.group(1), m.group(2)
            if v in D:
                v = D[v]
            else:
                c2 = cena(v)
                if c2 is not None:
                    v = c2
                elif '<' in v and re.search(r'[A-Za-zÁ-ž]', v):
                    chyby.append(f'{f}: chýba preklad atribútu {k}: {v[:90]}')
            ulozene.append(f'{k}="{v}"')
            return f'\x00{len(ulozene) - 1}\x00'
        # atribúty najprv (môžu obsahovať HTML, napr. data-m="19 € <small>…</small>"), potom textové uzly
        c = re.sub(r'\b(' + '|'.join(ATTR) + r')="([^"]*)"', atr, c)
        c = re.sub(r'>([^<]+)<', uzol, c)
        c = re.sub(r'\x00(\d+)\x00', lambda m: ulozene[int(m.group(1))], c)
        casti[i] = c
    return ''.join(casti)


def cesty(text, cz_stranky):
    def oprav(u):
        if u.startswith(('http', 'mailto:', 'tel:', 'data:', '#', '/', '../')) or u == '':
            return u
        cesta = u.split('#')[0].split('?')[0]
        if cesta in cz_stranky:
            return u
        return '../' + u

    text = re.sub(r'\b(href|src|poster|action)="([^"]*)"', lambda m: f'{m.group(1)}="{oprav(m.group(2))}"', text)
    text = re.sub(r'\bsrcset="([^"]*)"', lambda m: 'srcset="' + ', '.join(
        ' '.join([oprav(p.strip().split(' ')[0])] + p.strip().split(' ')[1:]) for p in m.group(1).split(',')) + '"', text)
    text = re.sub(r"url\((['\"]?)(?!data:|http|/|\.\./)([^)'\"]+)\1\)", lambda m: f"url({m.group(1)}../{m.group(2)}{m.group(1)})", text)
    return text


def jazyk(text, f):
    text = text.replace('<html lang="sk">', '<html lang="cs">').replace('content="sk_SK"', 'content="cs_CZ"')
    sk_url = f'{WEB}/{"" if f == "index.html" else f}'
    cz_url = f'{WEB}/cz/{"" if f == "index.html" else f}'
    text = re.sub(r'<link rel="canonical" href="[^"]*">', f'<link rel="canonical" href="{cz_url}">', text)
    text = re.sub(r'(<meta property="og:url" content=")[^"]*(")', r'\g<1>' + cz_url + r'\2', text)
    alt = f'<link rel="alternate" hreflang="sk" href="{sk_url}">\n<link rel="alternate" hreflang="cs" href="{cz_url}">\n'
    if 'hreflang="cs"' not in text:
        text = text.replace('</head>', alt + '</head>', 1)
    # prepínač jazyka: na českej stránke odkaz na slovenskú
    text = re.sub(r'<a class="jazyk"[^>]*>CZ</a>', f'<a class="jazyk" href="../{"" if f == "index.html" else f}" hreflang="sk" lang="sk" title="Slovenská verzia">SK</a>', text)
    return text


def sk_odkazy(cz_stranky):
    """Slovenské stránky: tlačidlo CZ vedľa Objednať službu (na preloženú stránku, inak na českú titulku)."""
    for p in ROOT.glob('*.html'):
        t = p.read_text(encoding='utf-8')
        ciel = 'cz/' + ('' if p.name == 'index.html' else p.name) if p.name in cz_stranky else 'cz/'
        a = f'<a class="jazyk" href="{ciel}" hreflang="cs" lang="cs" title="Česká verze">CZ</a>'
        n = re.sub(r'<a class="jazyk"[^>]*>CZ</a>', a, t)
        if n == t and 'class="jazyk"' not in t:
            n = t.replace('<div class="nav-cta">', '<div class="nav-cta">' + a, 1)
        if n != t:
            p.write_text(n, encoding='utf-8', newline='\n')


def js_subor(nazov, chyby):
    src = (ROOT / nazov).read_text(encoding='utf-8')
    for a, b in JS.get(nazov, {}).items():
        if a not in src:
            chyby.append(f'{nazov}: v slovníku je text, ktorý už v skripte nie je: {a[:70]}')
        src = src.replace(a, b)
    return src


def main():
    chyby = []
    OUT.mkdir(exist_ok=True)
    cz_stranky = set(STRANKY)
    sk_odkazy(cz_stranky)
    for f, slovnik in STRANKY.items():
        D = dict(SPOL)
        D.update(json.loads((SL / slovnik).read_text(encoding='utf-8')))
        t = norm((ROOT / f).read_text(encoding='utf-8'))
        t = preloz_html(t, D, chyby, f)
        t = t.replace('https://www.soi.sk', 'https://www.coi.cz')  # dozor pre českých spotrebiteľov
        t = cesty(t, cz_stranky)
        for js in JS:
            t = t.replace(f'src="../{js}', f'src="{js}')
        t = jazyk(t, f)
        (OUT / f).write_text(t, encoding='utf-8', newline='\n')
    for js in JS:
        (OUT / js).write_text(js_subor(js, chyby), encoding='utf-8', newline='\n')
    if chyby:
        print('ČESKÁ VERZIA – CHYBY:')
        for c in chyby[:80]:
            print(' -', c)
        print(f'spolu {len(chyby)}')
        sys.exit(1)
    print(f'OK – česká verzia: {len(STRANKY)} stránok')


if __name__ == '__main__':
    main()
