# Pokyny pre AI asistentov (ChatGPT, Codex, Claude) – web realitnyasistent.eu

Toto repo je **živý web** https://realitnyasistent.eu (GitHub Pages, doména v súbore `CNAME`).
Všetko, čo sa dostane do vetvy `main`, je do 1–2 minút verejne na webe.

## 1. Ako pracovať – POVINNÉ

1. **Nikdy nepíš priamo do `main`.** Vytvor si vlastnú vetvu, napr. `chatgpt/redizajn-uvod`.
2. Zmeny odovzdaj ako **Pull Request do `main`** s krátkym popisom v slovenčine: čo si zmenil a prečo.
3. PR nespájaj (nemerguj) sám. Kontrolu a zverejnenie robí Claude / Marian.
4. Pred odovzdaním spusti kontrolu: `python tools/kontrola.py` (musí skončiť „OK“).
5. Ak zmeníš `styles.css` alebo `main.js`, zvýš verziu v odkazoch vo **všetkých** `.html` súboroch
   (`styles.css?v=...` a `main.js?v=...`), inak návštevníci uvidia starú verziu z vyrovnávacej pamäte.

## 2. Čo je v repe

Čisté statické HTML + jeden CSS + jeden JS. Žiadny framework, žiadny build, žiadny backend.
HTML súbory sú zdrojom pravdy – uprav ich priamo.

| Súbor | Obsah |
|---|---|
| `index.html` | Hlavná stránka: úvod, 3 služby, aplikácia, prečo video, weby, balíky, odporúčanie, pripravujeme, FAQ, kontakt |
| `videa.html` | Videá z fotiek inzerátu: ukážky, cenník, balíky videí, postup, prečo video, FAQ |
| `asistent.html` | Aplikácia Realitný asistent: výber verzie, funkcie, ukážky obrazoviek, cenník (mesačne/ročne), FAQ |
| `weby.html` | Weby pre maklérov: ukážky, cenník, **konfigurátor** (formulár `#konf`), FAQ |
| `odporucanie.html` | Program Odporučte kolegu |
| `podmienky.html`, `sukromie.html` | Obchodné podmienky, ochrana osobných údajov (text meniť len so súhlasom Mariana) |
| `404.html` | Chybová stránka (používa absolútne cesty `/…`) |
| `styles.css` | Celý dizajn. Farby a rozmery v `:root` na začiatku. Neskoršie bloky prepisujú skoršie (blok „Koncept A“ na konci určuje súčasný vzhľad). |
| `main.js` | Menu, rozbaľovacie Služby, striedanie obrazoviek v notebooku, záložky ukážok, prepínač mesačne/ročne, konfigurátor webu, výber verzie asistenta |
| `img/` | Snímky aplikácie (`app_*.jpg/.webp`), `og.jpg` na zdieľanie |
| `media/` | Ukážkové videá a ich náhľady |
| `ukazka/`, `ukazka2/` | Dva ukážkové weby pre maklérov (samostatný dizajn – nemeniť podľa hlavného webu) |
| `_podklady/` | **Zadanie a návrhy** – `ZADANIE.md`, koncepty `01`–`04` a referencia aplikácie `03` |
| `tools/kontrola.py` | Automatická kontrola pred odovzdaním |

### Funkcie, ktoré sa nesmú rozbiť (JS ich hľadá podľa id/tried)
- Konfigurátor webu: `#konf`, `input[name=typ][data-c]`, `#wAsist`, `#wCena`, `#wPozn`, `#wAsR`, `#wZlR`, `#wZl`, sekcia `#navrh`, funkcie `wStav()` a `wOdoslat()` (posiela na info@realitnyasistent.eu).
- Ukážky aplikácie: `.shots .tabs button[data-i]`, `#shotImg`, `#shotWebp`, `#shotCap`.
- Cenník asistenta: `.obd button[data-o]`, prvky s `data-m` / `data-r` v `#cennik`.
- Výber verzie v úvode asistenta: `#pick`, `#pickGo`.
- Menu: `.mnav`, `#menu`, `.dd`.
- Každá stránka má sekciu `id="kontakt"` (naň vedie tlačidlo „Objednať službu“).

## 3. Dizajn

Riaď sa `_podklady/ZADANIE.md` a obrázkami v `_podklady/` (koncept A je hlavný smer, `04` sú podstránky).

- Primárna fialová `#7728E6`, tmavšia `#5B20B5`, svetlá `#F1EAFE`, pozadie `#F4F5F9`, text `#202436`, sekundárny text `#667085`, okraje `#E6E8EF`.
- Písma: Inter (text), Manrope (nadpisy) – načítané z Google Fonts v `<head>`.
- Karty: biele, zaoblenie 16–18 px, tenký okraj, jemný tieň. Tlačidlá zaoblenie ~11 px.
- Ikony: tenké čiarové SVG (štýl Lucide) priamo v HTML.
- Obrázky aplikácie musia byť **skutočné snímky** z `img/app_*` – nekresli vymyslené dashboardy.
- Web musí fungovať na mobile (390 px), tablete aj počítači. Na mobile karty pod sebou.

## 4. Pravidlá textov – POVINNÉ

- **Nikdy nepoužívaj slovo „AI“ ani „umelá inteligencia“** (ani v nadpisoch, meta popisoch, alt textoch).
- Píš v **množnom čísle**: „pripravíme vám“, „postaráme sa“ – nikdy „pripravím“.
- Prirodzená, vecná slovenčina. Žiadne prehnané sľuby, žiadne vymyslené čísla, hodnotenia, referencie ani logá klientov.
- Neponúkaj skúšobnú verziu zdarma.
- Pripravované funkcie vždy označ štítkom **Pripravujeme** (trieda `soon`).
- Kontakt je vždy `info@realitnyasistent.eu`.

## 5. Ceny – nemeniť bez súhlasu Mariana

| Služba | Cena |
|---|---|
| Video Štandard | 29 € |
| Video Prémiové | 89 € (40–60 s podľa počtu fotiek) |
| Balík videí | 10 + 2 Štandard za 290 €, 10 + 3 Prémiové za 890 € |
| Asistent Bazoš | 19 € / mesiac (ročne 190 €) |
| Asistent Všetky portály | 29 € / mesiac, ročne 290 € |
| Web Vizitka | 500 € |
| Web s ponukou nehnuteľností | 700 € |
| Web na mieru | dohodou |
| Správa webu | 120 € / rok (12 malých úprav), ďalšia úprava 10 €, väčšie práce 25 €/h, expres +10 € |
| Zľava na web | 20 % pri ročnom asistentovi Všetky portály |
| Virtuálne zariadenie fotiek | 1 fotka 5 €, celý inzerát (do 10 fotiek, jeden štýl) 19 €; Reels pred → po +10 €, k celému inzerátu (4–10 fotiek) +5 € = spolu 24 €; s videom k tej istej nehnuteľnosti −50 % na zariadenie; nový klient prvé 3 fotky zadarmo (= −15 €, raz); dodanie do 24 h, 1 oprava v cene |
| Balík Štart | 790 € jednorazovo (úspora 17 %) |
| Balík Profi | 990 € jednorazovo (úspora 21 %), obsahuje aj 3 virtuálne zariadené fotky |
| Balík Premium | 1 390 € jednorazovo (úspora 25 %), obsahuje aj 10 virtuálne zariadených fotiek |

Ceny sú konečné – prevádzkovateľ nie je platcom DPH. Balíky sú vždy **jednorazová platba**.

Virtuálne zariadené fotky sú **vždy označené** „Virtuálne zariadené“ – túto vetu na webe ani v podmienkach neodstraňuj. Mení sa len nábytok a dekorácie, nikdy steny, okná, dvere, podlahy či výhľad.


## 5a. Odporúčací program – platné pravidlá (nemeniť bez súhlasu Mariana)

Ak sa `_podklady/ZADANIE.md` s týmto líši, **platí táto časť**. Texty na `odporucanie.html`,
v `index.html` (sekcia `#odporucanie`) a v `podmienky.html` (časť 8) musia ostať v tomto znení obsahu:

| Keď kolega… | Odporúčajúci dostane | Kolega |
|---|---|---|
| objedná prvé video | 1 video Štandard zadarmo | −10 % |
| kúpi balík videí | 1 video Prémiové zadarmo | −10 % |
| objedná virtuálne zariadenie fotiek | 3 fotky virtuálne zariadené zadarmo | −10 % |
| predplatí asistenta mesačne | 1 mesiac asistenta zadarmo | −10 % na 1. mesiac |
| predplatí asistenta na rok | 3 mesiace asistenta zadarmo | −10 % na ročnú platbu |
| kúpi balík Štart, Profi alebo Premium | 1 video Prémiové + 3 mesiace asistenta | 1 video Štandard navyše (namiesto −10 %) |

- Odmena sa pripíše 14 dní po platbe kolegu, ak neodstúpi od zmluvy.
- Odmeny sú služby (videá, mesiace asistenta, fotky) – o peniazoch na webe nepíš (peňažné odmeny budú len v schválenom ambasádorskom programe), neprenosné, aktivovať do 12 mesiacov, najviac 12 mesiacov asistenta zadarmo za rok.
- Kód nemožno použiť na vlastné objednávky; pri zneužití môžeme odmenu odobrať.
- Položka „Odporučte kolegu“ musí ostať v hlavnom menu aj v pätičke.

## 5b. Ambasádorský program – platné pravidlá (nemeniť bez súhlasu Mariana)

- Stránka `ambasador.html`, podmienky `podmienky.html#ambasador` (časť 8a). Prihlášky spracúva server `worker/objednavky.js` (`/ambasador`), schvaľuje Marian.
- Štandard: ambasádor **15 %** z ceny zaplatenej klientom, počas **12 mesiacov** od prvej objednávky s kódom; klient **−10 %** na prvú objednávku.
- Bonus: **50 nových platiacich klientov** → web s ponukou nehnuteľností + 12 mesiacov asistenta Všetky portály zadarmo.
- Výplata mesačne, provízia 14 dní po platbe, minimum 50 €. Individuálne podmienky nastavuje Marian v prehľade.

## 5c. Chat s pomocníkom (chat.js + worker/chat.js)
- Okno chatu je `chat.js` (načíta ho `main.js` na všetkých stránkach). Rovnaký kód je vložený aj v aplikácii (`ui/index.html`, nastavenie `window.RA_CHAT`).
- Odpovede pripravuje Worker `/chat` (OpenAI). Všetky fakty, ktoré pomocník smie povedať, sú v `worker/chat.js` v konštantách `ZNALOSTI` a `NAVOD_APP`.
- **Pri každej zmene cien, služieb, podmienok alebo funkcií aplikácie uprav aj `ZNALOSTI` vo `worker/chat.js`** a nasaď Worker (`npx.cmd wrangler deploy` v priečinku worker). Inak bude chat hovoriť staré ceny.
- Kontakt z chatu (`/chat/kontakt`) chodí Marianovi na Telegram. Prehľad rozhovorov: `/admin/chaty`. Rozhovory sa mažú po 90 dňoch.
- Limity proti zneužitiu: 30 správ za hodinu na IP/zariadenie, 800 správ za deň spolu (premenná `CHAT_DEN_LIMIT`).

## 6. Kontrola

```
python tools/kontrola.py
```
Skontroluje: zakázané slová, 1. osobu jednotného čísla, odkazy a kotvy na stránkach, chýbajúce súbory,
prítomnosť povinných id pre JS, e-mailovú adresu a zhodu verzie CSS/JS na všetkých stránkach.
