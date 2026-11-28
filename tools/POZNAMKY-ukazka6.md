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
- 28. 11. (druhý účet Higgsfield, 2 bezplatné MAGI-2): video/uvod.mp4 = prelet dronom z leteckého pohľadu k domu, hrá raz nad úvodnou fotkou (aj na mobile; nie pri reduced motion) a končí na tej istej fotke; video/prelet-3.mp4 = podlažie → spálňa v Premium. Originály: InzertnyBot\docs\javorova-higgsfield\prelet-3/4-*.mp4.
- Oprava: skrytá scéna (.scena.skryta) musí mať pointer-events:none aj pre deti, inak .fb.akt chytala kliky po návrate na budovu.
- Vstup do izby v Premium: žiadne generické video (prelety do izieb leteli do iného bytu/cez výťah). Teraz: zvýraznenie kliknutej izby → kamera priblíži presne jej obrys na 3D podlaží → prelínanie do vizualizácie s jemným priblížením. Esc ide späť s oddialením. Videá prelet-2/3 zmazané z webu (originály na PC).
- Videá sa sťahujú hneď po načítaní (vlastný <video> pre každé), prehrajú sa až po canplaythrough (inak „Načítavame prelet…“, max 6 s, potom bez videa).
- Byt v Premium ako v Pri parku: okolie bytu stmavené (.tma s dierou pre byt a balkón), izby s vizualizáciou majú špendlík s názvom (stála veľkosť cez --inv = 1/priblíženie), hover na mape aj v zozname zvýrazní izbu. Pozor na špecifickosť: .byt-on .fb.akt>polygon (nie polygon), inak prebije zvýraznenie izieb.

## Kódovanie videí (od 28.11.)
- Prelety a vlety: plné 1920 px + jemné doostrenie, bez zvuku. Marian chce ostrý obraz, dáta návštevníkov neriešime.
  `ffmpeg -i ORIG.mp4 -an -vf "scale=1920:-2:flags=lanczos,unsharp=5:5:0.5:5:5:0" -c:v libx264 -crf 22 -preset slow -tune film -pix_fmt yuv420p -movflags +faststart OUT.mp4`
  (izby crf 22, budova prelet-1 crf 24). Staré 1024 px / crf 27 bolo rozmazané.
- Vlety do izieb: MAGI-2 na webe Higgsfield (účet 2, plán Lite), Frames start = výrez z vlety_vyrez, koniec = fotka izby, 4–5 s, zvuk Off, 16:9, 1080p. Hotové: 3-0.
- Prelety poschodí (28.11.): video/poschodie-1..6.mp4, MAGI-2 4–5 s. Štart = celá šírka budova.webp 16:9 okolo poschodia s teplým zvýraznením (poschodia_vyrez v projekt.json), koniec = 1-koniec-podlazie.jpg (podlazie-3d na tmavom). Prompt: zvýraznené N. poschodie sa vysunie z budovy, budova zmizne do tmavomodrého pozadia, kamera do izometrie, poschodie sa zmení na 3D model. Zábery: vetva GitHub `zabery` (do Higgsfieldu cez <img crossOrigin> + canvas → File → input).
- Nefungovalo: Kling 3.0 s tesným výrezom a modrým zvýraznením (modré pásy, žiadne vysunutie). Kľúč: širší záber s okrajmi budovy a teplé svetlé zvýraznenie ako v Pri parku.
- Kamera pred videom ide na výrez v režime cover (ako object-fit:cover videa), po videu sa 3D poschodie plynulo oddiali z celého záberu.
