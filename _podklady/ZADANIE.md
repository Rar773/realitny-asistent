# REALITNÝ ASISTENT — ZADANIE PRE CLAUDE

## Cieľ
Redizajnuj web **realitnyasistent.eu** tak, aby vizuálne a používateľsky pôsobil ako prirodzené pokračovanie existujúcej desktopovej aplikácie Realitný asistent. Nejde o všeobecnú realitnú kanceláriu ani o generickú technologickú agentúru. Je to súbor praktických služieb pre realitných maklérov a realitné kancelárie na Slovensku.

**Hlavný prísľub značky:** Menej času pri inzerátoch. Viac času na klientov.

Cieľ webu:
- jasne vysvetliť tri služby,
- dostať návštevníka k objednaniu videa, aplikácie alebo webu,
- prezentovať presné ceny a jednorazové balíky,
- ukázať, že web a desktopová aplikácia patria do jednej značky.

Kontakt: **info@realitnyasistent.eu**

## Súbory v tomto balíku
1. `01-koncept-A-cisty-SaaS.png` — hlavný odporúčaný smer: čistý SaaS web s výraznou fialovou a ukážkou aplikácie.
2. `02-koncept-B-kompletna-identita.png` — alternatívny smer a širší prehľad webu, mobilu, UI a vizuálnej identity.
3. `03-referencia-skutocnej-aplikacie.png` — výrez skutočnej aplikácie z dodanej nahrávky. **Toto je zdroj pravdy pre vizuálny štýl aplikácie.**

Obrázky konceptov sú vizuálne referencie, nie presné zdroje textov ani finálne špecifikácie. Pri rozpore sa riaď údajmi a cenami v tomto dokumente a skutočnou aplikáciou.

---

# 1. Vizuálny smer a dizajnový systém

## Odporúčanie
Použi **Koncept A ako základ**. Z Konceptu B si môžeš požičať layoutové nápady, napríklad výraznejšie ukážky webových šablón, konfigurátor a mobilný náhľad. Zachovaj však jednu konzistentnú vizuálnu identitu.

## Čo už existuje v aplikácii
Z dodanej nahrávky je viditeľné:
- svetlé rozhranie,
- biely ľavý bočný panel,
- veľmi svetlé sivomodré pozadie pracovnej plochy,
- biele obsahové karty,
- fialová farba značky a ikon,
- jemné svetlofialové zvýraznenie aktívnej položky,
- čistá typografia, tenké okraje a mierne tiene.

Web má tento vizuálny jazyk rozšíriť, nie vytvoriť úplne inú značku.

## Navrhované farebné tokeny
Použi ich ako počiatočný návrh a pred dokončením ich porovnaj s reálnymi farbami aplikácie v referenčnom obrázku alebo existujúcich CSS premenných:
- Primárna fialová: `#7728E6`
- Tmavšia fialová: `#5B20B5`
- Svetlá fialová / aktívne pozadie: `#F1EAFE`
- Veľmi svetlé pozadie: `#F4F5F9`
- Biela karta: `#FFFFFF`
- Hlavný text: `#202436`
- Sekundárny text: `#667085`
- Ohraničenie: `#E6E8EF`
- Úspech: `#23865B`
- Upozornenie: `#D99A2B`

## Typografia a komponenty
- Použi Inter alebo existujúci font projektu; alternatívne Manrope pre nadpisy.
- Zaoblenie kariet približne 14–18 px; tlačidlá približne 10–12 px.
- Jemné tiene, tenké okraje, veľa voľného priestoru.
- Ikony jednotného štýlu, ideálne rovnaká knižnica ako v aplikácii.
- Tlačidlá, polia, badge, karty, tabuľky a navigácia majú mať rovnaké pravidlá naprieč webom.
- Používaj fialovú účelne: primárne CTA, aktívne stavy, odkazy a dôležité zvýraznenia. Nie všetko má byť fialové.

## Čomu sa vyhnúť
- tmavému neónovému dizajnu,
- tyrkysovým a zlatým farebným témam,
- 3D robotom a generickým „AI“ ilustráciám,
- agresívnym gradientom a svietiacim okrajom,
- falošným číslam, vymysleným referenciám, hodnoteniam a logám klientov.

Fotografie nehnuteľností môžu byť kvalitné a emotívne, ale rozhranie, karty a ovládacie prvky musia vizuálne ladiť so skutočnou desktopovou aplikáciou.

---

# 2. Pravidlá komunikácie značky

Tieto pravidlá sú povinné pre všetok text viditeľný klientom:
- **Nepoužívaj slovo „AI“ ani výraz „umelá inteligencia“.** Ani v nadpisoch, SEO texte, tlačidlách alebo metadátach určených na zobrazenie používateľovi.
- Hovor v množnom čísle: „Pripravíme vám“, „Postaráme sa“, „Vytvoríme vám“, „Pomôžeme vám“.
- Jazyk: prirodzená slovenčina, profesionálna, zrozumiteľná a konkrétna.
- Vyhýbaj sa prehnaným sľubom a neovereným tvrdeniam.
- Neuvádzaj skúšobnú verziu zdarma ani 14-dňovú bezplatnú skúšku — nie je to potvrdená ponuka.
- Nepredstieraj, že pripravované funkcie už fungujú.

Odporúčané hlavné posolstvo:
**Menej času pri inzerátoch. Viac času na klientov.**

Podnadpis:
„Pripravíme vám profesionálne videá z fotografií, uľahčíme správu inzerátov a vytvoríme web, ktorý predstaví vaše nehnuteľnosti.“

---

# 3. Obsah a ponuka — presné fakty

## Služba 1: Videá z fotiek inzerátu
Z fotografií, ktoré už maklér má v inzeráte, pripravíme video. Netreba nič natáčať ani objednávať kameramana.

### Štandard — 29 €
- plynulé video s hudbou,
- popisky miestností a údajov (napr. „Terasa 54 m²“),
- logo realitnej kancelárie,
- záverečná karta s kontaktom makléra.

### Prémiové — 89 €
- video má pôsobiť ako prehliadka natáčaná priamo na mieste,
- pohyb kamery a plynulý priechod fotografiami,
- logické poradie pri dome: záhrada → kuchyňa/obývačka → kúpeľňa → spálne → WC → garáž,
- dĺžka 40–60 sekúnd podľa počtu fotografií.

Každé video dodávame v dvoch formátoch:
- na šírku pre inzeráty, web a YouTube,
- na výšku 9:16 pre Instagram, Facebook a TikTok.

Dodanie: **do 24 hodín**. Objednávka stačí cez odkaz na inzerát z Nehnuteľnosti.sk, Bazoša alebo vlastného webu.

Množstevné balíky:
- 10 štandardných videí + 2 zadarmo,
- 10 prémiových videí + 3 zadarmo.

Na webe zachovaj sekciu **„Prečo video k inzerátu“** so šiestimi dôvodmi. Ak už existuje pôvodný text tejto sekcie, zachovaj ho a neprepisuj bez kontroly. Ak text chýba, priprav šesť stručných návrhov na schválenie, nie vymyslené štatistiky.

## Služba 2: Realitný asistent — desktopová aplikácia
Aplikácia beží na počítači makléra na pozadí a pomáha spravovať inzeráty a každodennú prácu.

Dostupnosť:
- Windows aplikácia,
- Mac verzia je pripravená na testovanie; neprezentuj ju ako všeobecne dostupnú finálnu verziu.

Funkcie:
- **Bazoš cez oficiálne API:** pridávanie a úprava inzerátov, presun existujúcich inzerátov, obnovenie zmazaného inzerátu zo zálohy jedným klikom, upozornenie pred koncom platnosti.
- **Nehnuteľnosti.sk** vrátane TopReality a Reality.sk: prihlásenie v aplikácii, načítanie inzerátov makléra a pozícia inzerátu vo výsledkoch vyhľadávania.
- **Kontrola inzerátu:** pravopis, cena a pôdorys.
- **Sledovanie konkurencie:** upozornenie pri podobnej nehnuteľnosti, ktorá je o nastavené percento lacnejšia alebo drahšia; funkciu možno vypnúť alebo zapnúť.
- **Dopyty:** zber z e-mailu, zoskupenie podľa inzerátu a odpovedanie priamo z aplikácie.
- **Klienti a obhliadky:** prehľad kontaktov a plánovaných obhliadok.
- **Štatistiky:** výkon inzerátov.
- **Upozornenia:** priamo v počítači, cez Telegram `@RealitnyAsistent_bot` a e-mailom pri dôležitých udalostiach.
- **Prevádzka:** zálohy inzerátov, automatické aktualizácie, spustenie po zapnutí počítača a ikona pri systémových hodinách.

Obrazovky aplikácie podľa existujúceho produktu:
Prehľad, Upozornenia, Inzeráty, Nový inzerát, Štatistiky, Dopyty, Klienti, Obhliadky, Prepojenia, Nastavenia, Návod, Odporučte kolegu, Pomoc a Záznam činnosti.

Ceny:
- Bazoš: **19 € mesačne**,
- všetky portály: **29 € mesačne**,
- všetky portály pri ročnej platbe: **290 € ročne**.

Nepridávaj neoverené funkcie ani inú cenu. Aplikáciu prezentuj cez reálne screenshoty alebo vizuál odvodený od priloženej referencie — nie cez úplne iný dashboard.

## Služba 3: Weby pre maklérov
Hotové webové stránky na kľúč: návrh, texty a nastavenie pre Google.

- **Vizitka: 500 €**
- **Web s ponukou nehnuteľností: 700 €**
- **Web na mieru:** cena podľa dohody.

Správa webu: **120 € ročne**, zahŕňa zabezpečenie, zálohy a 12 malých úprav ročne.
- ďalšia malá úprava: 10 €,
- väčšie práce: 25 €/hod.,
- expresné spracovanie: príplatok 10 €.

Doménu a hosting si klient platí priamo poskytovateľovi.

Zľava: **20 % na web** pri ročnom predplatnom asistenta „Všetky portály“.

Na stránke ponechaj:
- interaktívny konfigurátor s orientačnou cenou,
- svetlú ukážku webu „Jana Kováčová“,
- tmavú ukážku webu „dunaj.reality“.

Pripravovaná funkcia: inzeráty a videá sa budú z aplikácie automaticky prenášať na web makléra. Označ ju len ako **Pripravujeme**.

## Jednorazové balíky
Vytvor jasné porovnanie troch balíkov. Všetky ceny sú jednorazové:

| Balík | Cena | Obsah | Úspora |
|---|---:|---|---:|
| Štart | 790 € | Vizitka + Bazoš asistent na rok + 5 štandardných videí + správa webu | 17 % |
| Profi | 990 € | Web s ponukou + Všetky portály na rok + 12 štandardných videí + správa webu | 21 % |
| Premium | 1 390 € | Všetko z balíka Profi + 13 prémiových videí | 25 % |

Nesprávaj balíky ako mesačné predplatné. Na každej karte jasne označ „jednorazová platba“.

## Odporučte kolegu
Maklér odporučí kolegu. Keď kolega zaplatí a uplynie 14-dňová lehota na vrátenie peňazí, obaja získajú odmenu vo forme videí alebo mesiacov asistenta — nikdy nie v hotovosti.

Pri kúpe balíka:
- nový zákazník dostane 1 štandardné video navyše,
- odporúčateľ dostane 1 prémiové video + 3 mesiace asistenta.

## Pripravujeme
Tieto položky jasne označ ako pripravované, nie ako dostupné:
- zákaznícke účty: registrácia, platby kartou cez Stripe, história platieb a odmeny,
- objednanie videa cez odkaz na inzerát v zákazníckom účte,
- objednanie a zaplatenie videa priamo v aplikácii,
- chat s podporou na webe,
- mobilná aplikácia,
- podpísaná Mac verzia,
- firemná verzia pre kancelárie s prehľadom pre vedúceho,
- automatický prenos inzerátov a videí z aplikácie na web makléra.

---

# 4. Odporúčaná štruktúra webu

Najprv skontroluj existujúce stránky a routy v projekte. Zachovaj existujúce URL, ktoré už fungujú, a neodstraňuj existujúci obsah bez dôvodu.

Navrhovaná navigácia:
- Domov
- Služby
- Aplikácia
- Weby pre maklérov
- Balíky
- Odporučte kolegu
- Kontakt

Odporúčaná domovská stránka:
1. Header s logom, navigáciou a CTA.
2. Hero s hlavným posolstvom a vizuálom aplikácie na notebooku.
3. Tri služby v troch jasných kartách s cenou „od“ a CTA.
4. Detailnejšia sekcia desktopovej aplikácie s reálnym screenshotom.
5. Sekcia „Prečo video k inzerátu“ so šiestimi dôvodmi.
6. Sekcia webov pre maklérov s konfigurátorom a dvoma ukážkami webov.
7. Porovnanie jednorazových balíkov Štart / Profi / Premium.
8. Sekcia odporúčania kolegu.
9. FAQ s praktickými otázkami.
10. Záverečné CTA a pätička s kontaktom `info@realitnyasistent.eu`.

Detailné podstránky alebo sekcie:
- Videá z fotiek inzerátu
- Realitný asistent — aplikácia
- Weby pre maklérov + konfigurátor
- Balíky
- Odporučte kolegu
- Kontakt

---

# 5. UX a technické pokyny

1. **Pred úpravami preskúmaj celý existujúci projekt:** framework, routovanie, komponenty, CSS, fonty, existujúce obrázky, formuláre a API.
2. Najskôr stručne zhrň, čo v projekte existuje a ktoré súbory plánuješ meniť. Potom implementuj.
3. Neprepisuj projekt od nuly, ak to nie je nevyhnutné.
4. Zachovaj funkčnosť existujúcej aplikácie, prihlasovania, backendu, dát a integrácií. Webový redizajn nesmie rozbiť desktopovú aplikáciu.
5. Použi existujúci stack a knižnice. Nové závislosti pridávaj len vtedy, keď sú naozaj potrebné.
6. Vytvor opakovane použiteľné komponenty a spoločné dizajnové tokeny.
7. Web musí byť plne responzívny: desktop, tablet aj mobil.
8. Na mobile používaj jednoduché menu, čitateľné ceny a karty, ktoré sa skladajú pod seba.
9. Dbaj na prístupnosť, kontrast, ovládanie klávesnicou a viditeľné focus stavy.
10. Všetky tlačidlá a odkazy musia mať skutočnú akciu. Ak zatiaľ neexistuje objednávkový alebo platobný systém, vytvor bezpečný kontaktný/objednávkový krok podľa existujúcich možností; nevymýšľaj dokončenú platbu.
11. Použi optimalizované obrázky a nespomaľuj načítanie veľkými dekoratívnymi animáciami.
12. Priprav SEO titulky, popisy a sémantické nadpisy v slovenčine — bez zakázaného slovníka.
13. Nezobrazuj vymyslené referencie, hodnotenia, počty používateľov, mieru rastu ani iné metriky.
14. Nepoužívaj generické fotografie ľudí ako falošné referencie klientov.
15. Pripravované funkcie zobraz samostatne s označením „Pripravujeme“.

## Akceptačné kritériá
- Návštevník do 5 sekúnd pochopí, že ide o služby pre realitných maklérov.
- Tri služby sú jasne odlíšené a majú presné ceny.
- Balíky sú správne, sú jednorazové a obsahujú uvedené položky.
- Web vizuálne ladí s priloženou referenciou desktopovej aplikácie.
- Klientsky text nepoužíva zakázaný slovník a komunikuje v množnom čísle.
- Všetky CTA, odkazy, formuláre a konfigurátor fungujú alebo majú pravdivo označený stav.
- Stránka funguje na mobile aj desktope.

## Výstup, ktorý očakávam
Implementuj redizajn v existujúcom projekte. Na konci uveď:
- ktoré stránky a komponenty si vytvoril/upravil,
- ktoré funkcie sú plne funkčné,
- ktoré čakajú na backend alebo obsah,
- ako spustiť projekt a otestovať ho,
- aké texty alebo podklady ešte potrebuješ odo mňa.

**Kľúčové rozhodnutie:** Koncept A je hlavný smer. Koncept B je doplnková vizuálna referencia. Skutočná aplikácia v súbore `03-referencia-skutocnej-aplikacie.png` má prednosť pred ilustratívnymi dashboardmi na koncepčných obrázkoch.
