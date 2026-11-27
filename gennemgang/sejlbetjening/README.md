# TACK · Sejlbetjening, vandkontakt og besætning

[Prøv det byggede spil](http://localhost:5177/) · build `5f3d1fe6a505`. Optagelserne bruger kildeversion `919c6440ddf4` på [localhost:5174](http://localhost:5174/). Begge bygger på arbejdsrevision `7ad0ecc`. Før-optagelserne bruger en kopi af arbejdsfilernes tilstand umiddelbart før denne opgave, `4bb8027a16b5`.

## Reference og sejlplan

| Klip | Aflæst fra optagelsen |
|---|---|
| 12.34.42 · 00:04–00:06 og 00:08–00:14 | Den gule bøje passeres. Sejleren kommer ind, krydser cockpittet og sætter sig ud på den nye side. Fartvisningen falder under manøvren og stiger igen. |
| 12.35.44 · 00:02–00:08 | Ved ca. 3,6–4,4 knob ligger de tynde kølspor tæt ved skroget. |
| 12.36.02 · 00:04–00:10 | Sejleren samler kroppen tæt ved bommen. Det foregående kølspor bliver liggende gennem svinget. |
| 12.37.19 · 00:14–00:28 | Vinkelskiftet gør det lettere at se, at kølsporet følger ruten. |
| 12.39.31 · ca. 00:00–00:18 og 00:36–00:50 | Små silhuetter identificerer sejl og liner. De forskellige både har hver deres rig og vandkontakt. |

Tiderne er omtrentlige og aflæst fra udtrukne videobilleder. Vind ved sejlet, skødelængde, vinkelhastighed og kraftregnskab kan ikke aflæses fra klippene. TACKs egne sejlikoner og effekter er lavet i spillets design. [Sail Simulator · både](https://www.sailsimulator.com/en/game-info/boten)

| TACK | Spillets længde og grundsejlplan | Reference |
|---|---|---|
| Laserjolle | 4,23 m, ét storsejl på 7,06 m² | ILCA angiver 4,23 m og 7,06 m² for ILCA 7. ILCA 6 og 4 er særskilte rigge på 5,76 og 4,70 m². Spillets reb er et TACK-valg. [ILCA-håndbog, s. 13](https://ilcasailing.org/laserinternational/wp-content/uploads/2025/02/HANDBOOK-2025.pdf) |
| Racer 32 | 9,75 m, 35 + 20 m², tre personer | Fiktiv. Melges 32 på 9,7 m med 41,3 + 23,6 m² er et størrelseseksempel. [Melges](https://melges.com/pages/melges-32) |
| Turbåd 43 | 13,1 m, 48 + 32 m², tre ekstra forsejl | Fiktiv. Bavaria Cruiser 41 på 12,33 m og 82 m² er et størrelseseksempel. [Bavaria](https://www.bavariayachts.com/fileadmin/media/global/service/downloads/brochures/sailingyachts/bavaria-service-downloads-brochures-sy-cruiserline-de-en-new.pdf) |
| Foilmonohull | 20,7 m, 165 + 65 m² | Inspireret af AC75 og dens dobbelte storsejl. Spillets modelparametre er ikke en bestemt kapsejladsbåds målte værdier. [America’s Cup · teknik](https://ac36.americascup.com/the-technology) |
| Foilkatamaran | 22 m, vinge på 205 m² og fok på 55 m² | AC72 havde en stiv vinge og to skrog med foils. [America’s Cup · historik](https://ac36.americascup.com/en/history) |

## Gennemførte ændringer

- **Sejlbetjening.** Vælg sejl ved skødeprocenten. Den ene skødeskyder og de eksisterende taster styrer det valgte sejl. På mobil er skyder og holdknapper tilgængelige sammen med roret. Rebning, manuelle skøder, hejs og nedtagning er særskilte handlinger. Turbåd 43 har Code 0, gennaker og spiler. Fokstørrelse ligger under rigdetaljer. Foilkatamaranen viser vingetrim og fok med særskilt regulering af vingekraft.
- **Sejltilstand.** Aktivt areal og sejlets form afspejler samme tilstand i kræfter, 3D, ikoner og liveklienter. Ved rebning flyttes de sektionspunkter, hvor vinden påvirker sejlet. Fokken kan trimmes uafhængigt på Racer 32 og begge foilbåde, og følger eksisterende trim, indtil spilleren bruger dens egen line. Skødeprocenten styrer lineudslaget med et endeligt tempo. Ved fuldt slæk kan den lokale vind fortsat belaste sejlet. Sejlene får hver sin blafretilstand ud fra belastning og luffen.
- **Besætning.** Laserjollens sejler samler vægten, støtter sig og dukker under overgangen, før personen flytter sig ud igen. Animation og tyngdepunkt bruger de samme led og massepunkter. På Svær fastholdes spillerens valgte side og position. Turbådens besætning reagerer på den line, den enkelte betjener.
- **Vandkontakt.** Agterhjørnernes spor følger de våde kontaktpunkter og kan blive asymmetriske ved krængning. Et fartkølvand kræver mindst 0,34 m/s bevægelse relativt til det lokale vand. Lodrette bølgeslag kan stadig give sprøjt ved stilstand. Tidligere spor spredes og aftager, og neddykkede foils kan efterlade spor, mens skroget er fri. Høj og Lav grafik bruger samme fysiske vandfelt, med selvstændige Bølger og Chop.

## Før og efter i browseren

**Laserjollen på Svær** · Følg-kamera, samme udgangspunkt og spillerkommandoer, 7,5 m/s fra nord uden pust eller læ, 0,35 m bølger og 16 % Chop. Ror, trim og vægtvalg afspilles gennem de almindelige kontroller ved samme videobilleder. Fysiktrinnet er 1/60 s. Rundingsmærket blev oprettet til forsøget. Afstanden ved passagen var ca. 2,5 m i begge forløb. Klippet viser sejladsen med instrumenter frem til 00:06 og derefter med frit udsyn. [Laserjolle · før/efter](laser-foer-efter.mp4) · [Målelog](laser.json.gz)

| Tid og fase | Fart før → efter | Sidefart før → efter | Krængning før → efter | Faktisk ror før → efter | Skødevalg og vægt |
|---|---:|---:|---:|---:|---|
| Ca. 2,3 s, start på drejning | 7,19 → 7,17 kn | 0,04 → 0,15 m/s | 20,1 → 20,2° | −8,1 → −6,5° | 63 % bestilt, fra 3 mod 1 |
| Ca. 3,8 s, over centerlinjen | 5,16 → 4,95 kn | −0,02 → 0,24 m/s | 26,2 → 25,8° | −24,8 → −25,1° | 63 %, spiller vælger styrbord og 2. Fysisk grad på 1–3-skalaen 1,80 → 1,20 |
| 5,0 s, laveste fart i vendingen | 3,94 → 3,95 kn | 0,11 → 0,12 m/s | 27,5 → 27,9° | −3,4 → −1,7° | 65 % bestilt, position 2 styrbord |
| 11 s, bygger fart igen | 5,02 → 4,97 kn | −0,08 → −0,07 m/s | −5,8 → −5,2° | 0 → 0° | 65 %, position 2 styrbord |

Ved ca. 5,5 s er rorvinklen +24,6°. Ca. 39 % af rorbladet er neddykket, og strømmen langs bladet er 2,36 m/s. Loggen viser rormoment −171 Nm, sejlmoment +49 Nm, skrog −17 Nm, sværd +32 Nm samt 0 Nm fra hjælp. Det viser, hvorfor kursen stadig kan dreje den anden vej kortvarigt, mens rormomentet bremser den eksisterende rotation. Der blev ikke fundet en inputlås i dette forløb. Den mindre ændring i sejladsen følger sejlerens ændrede massebevægelse. Begge forløb gennemførtes uden grundkontakt eller kæntring.

**Turbåd 43 på Svær** · 8 m/s fra nord, 0,18 m bølger og 10 % Chop. Storsejl 35 %, fok 22 %, bestil to reb, sæt gennaker og trim den til 46 %. Storsejlet går fra 48 til 26,88 m² og luffens skala fra 1,00 til 0,56. Under hejs viser grafikken delvist hejst gennaker, her ca. 31 m², mens fokkens aktive areal er ca. 23 m². Fuldt hejst er gennakeren 105 m², fokken 0 m², og forløbet slutter ved 6,15 knob i begge versioner. Fremdriften fra storsejl og gennaker var henholdsvis 497 N og 1.554 N i det sidste målepunkt efter ændringen. To lokale liveklienter viste samme gennaker, fok og rebning. [Turbåd 43 · før/efter](yacht-foer-efter.mp4) · [Målelog](yacht.json.gz)

**Øvrige både.** Racer 32 og begge foilbåde blev afprøvet med uafhængig fok i browseren. Fuldt slæk gav ændret fokvinkel med storsejlets trim og fokkens areal bevaret. Begge foilbåde er testet for afsæt i hård vind, rorrespons under fri flyvning og genoptaget skrogspor ved landing, samtidig med at vedhængenes spor kan fortsætte i luften. De to landingstests bruger vindfald og slæk i et kontrolleret browserforløb. De er beregningsprøver med faktiske kontaktprøver fra rendereren.

## Billedtid og begrænsninger

Apple M5 (Mac17,2), 32 GiB RAM, Chrome 158.0.8127.37 headless, Høj grafik, 1.120 × 720 pixels, DPR 1, Følg-kamera og én båd pr. scene. To målevinduer på fem sekunder pr. båd og version, med rækkefølgen før, efter, efter, før. Billedintervallet er tiden mellem renderkald og omfatter scheduling. CPU-tiden i renderkaldet er målt særskilt. Den måling angiver submission på CPU'en og kan ikke bruges som GPU-tid.

| Båd | Median billedinterval før → efter | P95 billedinterval før → efter | P95 CPU-renderkald før → efter |
|---|---:|---:|---:|
| Laserjolle | 16,7 → 16,7 ms | 17,0–17,6 → 17,5–17,6 ms | 0,9–1,2 → 0,9 ms |
| Turbåd 43 | 16,7 → 16,6–16,7 ms | 17,6 → 17,5–17,7 ms | 1,1–1,2 → 1,1–1,2 ms |

Prøven viser omtrent samme billedtid. Den dækker én båd med sejloversigten lukket under normal sejlads. [Rå billedtider og miljø](billedtid.json)

Alle fem bådtyper indgår i de deterministiske replays. De fire øvrige forløb er identiske med deres arkiverede tilstand, når den nye fokbetjening ikke bruges. De to Laser-replays bruger den nye sideskiftbevægelse. 66 Node-tests og simulations-typekontrollen består. Den målrettede browserserie bestod 75 prøver. De efterfølgende kontroller af layout, trim og begge foilbådes landing bestod også. Samtidig ror og skøde er afprøvet med emuleret touch i desktop-Chrome. Fart, linebelastning og vandkontakt kræver fortsat kalibrering mod målte data fra virkelige både.

Kør optagelserne med `node scripts/sail-experience-review.cjs FØR_URL EFTER_URL`. Samme kommando med `--timing` måler billedtid. Videoerne kræver FFmpeg.
