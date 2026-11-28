# -*- coding: utf-8 -*-
"""Kontrola webu pred odovzdaním zmien.  Spustenie z koreňa repa:  python tools/kontrola.py"""
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
os.chdir(ROOT)
pages = {p.relative_to(ROOT).as_posix(): p.read_text(encoding='utf-8') for p in list(ROOT.glob('*.html')) + list((ROOT / 'cz').glob('*.html'))}
chyby = []

def text(s):
    s = re.sub(r'<script.*?</script>|<style.*?</style>', ' ', s, flags=re.S)
    return re.sub(r'<[^>]+>', ' ', s)

# 1) zakázané slová (aj v meta a alt)
for f, s in pages.items():
    viditelne = text(s) + ' ' + ' '.join(re.findall(r'(?:content|alt|title|aria-label)="([^"]*)"', s))
    for vzor, popis in [(r'\bAI\b', 'slovo „AI“'), (r'umel[áéúo]\w* inteligenci', 'umelá inteligencia'),
                        (r'skúšobn\w+ verzi\w* zadarmo|zadarmo na skúšku|bezplatn\w+ skúšk', 'skúšobná verzia zadarmo')]:
        for m in re.finditer(vzor, viditelne, re.I):
            chyby.append(f'{f}: zakázané – {popis} („{viditelne[max(0, m.start()-30):m.end()+30].strip()}“)')
    # 1. osoba jednotného čísla
    for m in re.finditer(r'\b(pošlem|pripravím|spravím|postarám|vytvorím|pomôžem|ozvem)\b', text(s), re.I):
        chyby.append(f'{f}: použi množné číslo namiesto „{m.group(0)}“')

# 2) odkazy, súbory a kotvy
ids = {f: set(re.findall(r'\bid="([^"]+)"', s)) for f, s in pages.items()}
for f, s in pages.items():
    if f.endswith('404.html'):
        continue
    zlozka = os.path.dirname(f)
    for h in re.findall(r'(?:href|src|poster)="([^"]+)"', s) + [x.split()[0] for x in re.findall(r'srcset="([^"]+)"', s)]:
        if h.startswith(('http', 'mailto:', 'tel:', 'data:')):
            continue
        path, _, anc = h.partition('#')
        path = path.split('?')[0]
        if path:
            path = os.path.normpath(os.path.join(zlozka, path)).replace(os.sep, '/')
            p = ROOT / path
            if path.endswith('/') or path in ('.', '..') or (ROOT / path).is_dir():
                p = p / 'index.html'
                path = (path.rstrip('/') + '/index.html').lstrip('./') if path not in ('.',) else 'index.html'
            elif not p.exists() and (ROOT / (path + '.html')).exists():
                path += '.html'  # odkaz bez .html (Cloudflare Pages)
                p = ROOT / path
            if not p.exists():
                chyby.append(f'{f}: chýba súbor {h}')
                continue
        cieľ = path or f
        if anc and cieľ.endswith('.html') and cieľ in ids and anc not in ids[cieľ]:
            chyby.append(f'{f}: kotva #{anc} neexistuje v {cieľ}')

# 3) e-maily – len info@realitnyasistent.eu
for f, s in list(pages.items()) + [('main.js', (ROOT / 'main.js').read_text(encoding='utf-8'))]:
    for e in set(re.findall(r'[\w.+-]+@[\w-]+\.[\w.]+', s)):
        if e != 'info@realitnyasistent.eu' and not e.endswith('@email.sk'):
            chyby.append(f'{f}: neznámy e-mail {e}')

# 4) povinné prvky pre JavaScript
povinne = {
    'weby.html': ['konf', 'wAsist', 'wCena', 'wPozn', 'wAsR', 'wZlR', 'wZl', 'navrh'],
    'asistent.html': ['shotImg', 'shotWebp', 'shotCap', 'cennik', 'pick', 'pickGo'],
    'index.html': ['kontakt'],  # rozcestník Som maklér / Som developer
}
for f, zoznam in povinne.items():
    for i in zoznam:
        if f in ids and i not in ids[f]:
            chyby.append(f'{f}: chýba id="{i}" (potrebné pre JavaScript)')
for f in pages:
    if not f.endswith('404.html') and 'kontakt' not in ids[f]:
        chyby.append(f'{f}: chýba sekcia id="kontakt"')

# 5) rovnaká verzia CSS a JS na všetkých stránkach
verzie = {f: (re.findall(r'styles\.css\?v=([\w.-]+)', s), re.findall(r'main\.js\?v=([\w.-]+)', s)) for f, s in pages.items()}
vsetky = {v for c, j in verzie.values() for v in c + j}
if len(vsetky) > 1:
    chyby.append(f'rôzne verzie styles.css/main.js na stránkach: {sorted(vsetky)} – zjednoť ich')

# 6) kľúčové ceny musia na webe ostať
spolu = ' '.join(text(s) for f, s in pages.items() if not f.startswith('cz/')).replace('\xa0', ' ')
for c in ['29 €', '89 €', '19 €', '290 €', '500 €', '700 €', '120 €', '790 €', '990 €', '1 390 €']:
    if c not in spolu:
        chyby.append(f'na webe chýba cena {c}')

if chyby:
    print('NÁJDENÉ PROBLÉMY:')
    for c in chyby:
        print(' -', c)
    sys.exit(1)
print('OK – kontrola prešla (%d stránok).' % len(pages))
