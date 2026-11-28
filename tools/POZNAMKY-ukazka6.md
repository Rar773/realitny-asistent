# ukazka6 (Rezidencia Javorová)
Pri každej zmene js/projekt.js alebo styl.css zvýš číslo ?v= v index.html, byt.html a karta.html (inak prehliadače držia starú verziu až 10 minút).
Ceny a stavy: server /projekt/ukazka-javorova.json (účet rarex731@gmail.com), záloha v projekt.json.

## 28. 11. večer – animácie (inšpirácia: reels „10 animations for real estate agents“ a „house builds itself as you scroll“)
- Lokalita: schematická mapa (projekt.json → lokalita.mapa: ulice, park, cyklotrasa, budovy, body s trasou alebo smerom, l = posun popisu). Trasy sa kreslia pri zobrazení, klik v zozname zvýrazní trasu. Na mobile bez popisov.
- Priebeh výstavby: „Dom rastie“ – sticky scéna 300vh, img/budova-vykres(-800).webp je výkres z budova.webp (hrany cez PIL), sivá stavba a farebná fasáda rastú po podlažiach podľa fasada.podlazia; etapy z aplikácie, „Tu sme teraz“ = etapa prebieha. Pozor: trieda .akt je obsadená (indikátor aktualizácie) – aktívna etapa má .zv.
- Výber bytu: prepínač Fotka domu / Rozložený dom (CSS 3D, doska() v projekt.js).
- Detail bytu: pôdorys sa nakreslí ako výkres (kresliPodorys, pathLength=100).
- reel.html (noindex, nelinkovaný): 1080×1920, všetko CSS animácie s pevným časom → window.seek(s), nahrávanie po snímkach /tmp/gen6/reel.mjs + ffmpeg. Výstup javorova-reel.mp4.
- Cache: ?v=20261128d.
- Premium: prelety video/prelet-1.mp4 (budova → 3D podlažie) a prelet-2.mp4 (podlažie → obývačka) z Higgsfield MAGI-2 (2 bezplatné generácie, 28. 11.). Hrajú len prvý raz v návšteve, nie pri odkaze s #hash, nie pri reduced motion; Preskočiť/Esc/klik ich preskočí; ak sa video nespustí do 4 s, ide sa bez neho. Originály 1080p: InzertnyBot\docs\javorova-higgsfield\.
- 28. 11. (druhý účet Higgsfield, 2 bezplatné MAGI-2): video/uvod.mp4 = prelet dronom z leteckého pohľadu k domu, hrá raz nad úvodnou fotkou (len ≥861 px, nie pri šetrení dát/reduced motion) a končí na tej istej fotke; video/prelet-3.mp4 = podlažie → spálňa v Premium. Originály: InzertnyBot\docs\javorova-higgsfield\prelet-3/4-*.mp4.
- Oprava: skrytá scéna (.scena.skryta) musí mať pointer-events:none aj pre deti, inak .fb.akt chytala kliky po návrate na budovu.
