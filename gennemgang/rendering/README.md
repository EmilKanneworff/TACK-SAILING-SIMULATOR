# TACK · Renderings- og ydelsesanalyse

[Opfølgning med optimeringer og før/efter-målinger](optimering.md)

**Spillet har to forskellige flaskehalse.** På Høj bruger vandets shader mest GPU-tid i de målte scener. Ved mange både stiger antallet af tegnekald, især til besætninger, rig og skygger. På en langsommere CPU er den tungeste belastning til gengæld foilkatamaranens fysik og dens vandprøver. På de langsomste foilforløb er fysikken fortsat flaskehalsen på Lav.

Målt på spilrevision `412cd1d76a9b201651b5470606bf131c89436638`, lokalt produktionsbuild `97841c6fe0a3`. [Måledata](maalinger.json) · [Profilværktøj](../../scripts/render-audit.cjs)

## Hvad sker der i et billede?

1. Spillets hovedtråd læser input og afvikler de fysiktrin, der er nået på spillets ur. Fysikken har et fast trin på 1/60 s. Foilmodellen deler det op i fire trin ved 240 Hz. Skrog, foils og ror bruger prøver af vandhøjde og vandbevægelse. Hvis der ophobes mindst 70 ms uafviklet simulation, kan løkken springe en tegning over for at give fysikken plads. [Spilløkke](../../index.html#L5472) · [Foilkræfter og deltrin](../../assets/simulation/foils.js#L596)
2. Spillet interpolerer bådens tilstand og opdaterer kamera, rig, sejl, besætning, skrogkontakt, kølvand, skum, vejr og terrændetaljer. Både med bløde sejl får opdateret sejlgeometri og normaler. Katamaranen former begge vingeprofiler og fokken. Medspillernes visuelle tilstand opdateres efter afstand og grafiktrin. [Sceneopdatering](../../index.html#L4236) · [Katamaranens vinge](../../index.html#L2926) · [Medspillere](../../assets/fleet.js#L165)
3. På Høj og Mellem kan en delt spejlpassage tegne bådenes udvalgte skrog og sejl til en lille tekstur. På Høj tegnes der desuden et skyggekort på 1024 × 1024 til det retningsbestemte lys. Hovedpassagen tegner derefter himmel, kyst, både, vand og overfladeeffekter. Vandets shader kombinerer bølgehældning, dybde, vindkrusninger, dæmpning ved kyst, bådenes spejling og himlens refleksion. [Bådspejling](../../assets/hull-water.js#L434) · [Skyggekort](../../index.html#L1488) · [Vandshader](../../index.html#L1554)
4. Søkortet tegnes i sit eget 2D-canvas med højst ca. 18 opdateringer/s på desktop og 11/s ved touch. Den løbende betjening opdateres pr. callback, mens den almindelige instrumentopdatering kører cirka hver 65 ms. Lillekort og instrumenter indgår derfor i CPU-profilen ved siden af 3D-scenen. [Søkort](../../index.html#L906) · [Opdateringsfrekvenser](../../index.html#L5565)

## Kort over belastningen

| Område | Arbejde og belastning | Hvad grafiktrinnene ændrer |
|---|---|---|
| Vandflade | Et stort net følger bådens område. GPU’en beregner bølger i verdenskoordinater og farve for de dækkede pixels. Den nære shader har bølge- og refleksionsdata, kystdybde, vind, krusninger og vandmasker ved skroget. Det fjerne vand bruger allerede en flad ydre ring og en kortere shader. | Færre netsegmenter, kortere afstand til de dyre optiske beregninger og en mindre billedbuffer. Spillerens fysiske vandfelt bruger de samme trin. |
| Skygge og spejling | Skygger sender skrog, rig og især mange besætningsdele gennem en ekstra passage. Spejlet bruger én fælles tekstur. Det tegner udvalgte dele af bådene, når kameraet er lavt nok, op til ca. 20 gange/s på Høj. | Høj har skygger og spejl. Mellem har et mindre spejl med ca. 11 opdateringer/s. Lav og Minimum fjerner begge passager. Himlens refleksion i vandet er en del af hovedshaderen. |
| Skrog, rig og sejl | Mange små dele med individuelle tegnekald. Høj opløsning på sejl og vinger giver både flere GPU-trekanter og arbejde med at deformere nettene på CPU’en. Uigennemsigtige skrog og rig bidrager i flere passager. | Foilmonohullens sejl og katamaranens fok får et grovere net på Lav/Minimum. Katamaranens to vingeelementer beholder deres net. |
| Besætninger | Hoved, vest, riggede lemmer, hænder og sko bruger delte grundmodeller med flere separate meshes. Animerede målinger og tegnekald vokser med antallet af synlige sejlere. Mange besætningsmeshes kaster skygger på Høj. | Besætningsmotion kan forenkles. Fjernere medspillere bruger silhuetter. Geometrien for de nærmeste besætninger bidrager stadig på Lav. |
| Kyst, havne og træer | Kystfliser tæt på, sammenlagte regioner på afstand, terrænmaterialer, havne, træer og andre instanser. Kameraets bevægelse styrer, hvad der vises. Ved bevægelse mindst 8 m gennemgås afstanden igen. Der opbygges højst én træsektor og to sæt havnedetaljer pr. opdatering. | Detaljerne skifter tidligere til simplere former. Kameraets ydre klippegrænse er 8 km på alle grafiktrin. |
| Vandlinje og kølvand | Skrogets visuelle vådmaske bruger et gitter på 19 × 11 punkter. Lokale stævn- og hækeffekter, vandlinjeskum, kølvandshistorik og enkelte nære modspillere bruger vandprøver og opdaterer geometri på CPU’en. | Lav bevarer spillerens nære kontakt. Minimum forenkler spray og fjerner fjernkølvand. |
| Atmosfære, regn og skum | Himmelkuppel og panoramateksturer bruges også i refleksioner. Regn bruger både linjer i scenen og krusninger i vandshaderen. Det omgivende bølgeskum søger periodisk efter egnede bølgetoppe. | Mindre regn, kortere optisk rækkevidde og færre omgivelseseffekter. Minimum fjerner de tegnede regnlinjer. |
| Vindpile, banemærker og 2D | Instancerede vindpile, banemærker, kortets kystlinjer/ikoner, instrumenter og browserens komposition. | Der er særskilt opdateringsfrekvens for kortet. GPU-timeren dækker WebGL og hovedtrådens profil inkluderer kort og instrumenter. Browserens komposition ligger uden for WebGL-målingen. |

## Målemetode

- Mac17,2 med Apple M5, 10 logiske CPU-kerner og 32 GiB RAM, macOS 26.3, Chrome 158.0.8127.37 og Three.js r160. Chrome kørte headless med ANGLE Metal på M5. Desktop brugte et vindue på 1.120 × 700 CSS-pixels og DPR 1,5. Telefonprofilen brugte 390 × 664, DPR 3 og simuleret touch. CPU-drosling via Chrome var 4×, mens GPU’en fortsat var M5.
- Reproducerbare startpositioner, vind, sø og kamera. Derefter kørte almindelig Fri sejlads med aktive fysiktrin. Målingen startede efter 1,1 sekund til stabilisering. Den fulgte typisk 3,2 sekunders kørsel. Udsnit med én, to og seks både bruger Laserjollen som egen båd og forskellige nærplacerede modeller som medspillere. Medspillerne kom fra snapshots i samme browser. Den offentlige gratisversion har plads til to spillere. Værtens simuleringsworker, netværk og en ekstra klients GPU er adskilte belastninger. [Multiplayeropsætning](../multiplayer/README.md)
- CPU-tid er målt omkring delene af den eksisterende spilløkke. Et fast fysiktrin kan forekomme flere gange pr. callback. Scopet for 3D-scenen inkluderer dens understadier og WebGL-afsendelse. Procentilerne beskriver hver sin fordeling. CPU og GPU arbejder delvist parallelt. FPS er faktisk afsendte billeder, og simuleret tid pr. realtid afslører, om spillet også udvikler sig i den forventede hastighed.
- GPU-tid kommer fra asynkrone WebGL2-timerforespørgsler. De måler den markerede passage på GPU’en. Resultater kasseres, hvis browseren melder en afbrudt eller ugyldig tidsmåling. Tegnekald, trekanter, linjer og partikler tælles for hvert lag og hver passage. Hovedpassagens tid inkluderer skyggekort, når det er aktivt. Spejlpassagen måles separat. [Khronos timerforespørgsler](https://registry.khronos.org/webgl/extensions/EXT_disjoint_timer_query_webgl2/) · [Three.js-renderingstællere](https://threejs.org/docs/pages/WebGLRenderer)
- Til lagprøven fryses båd, bølgefase og kamera, hvorefter én komponent ændres ad gangen. GPU’en får fire opvarmningsprøver og 14 målinger pr. variant. Når et lag skjules, kan et andet dække flere pixels. Forskellene viser ændringen i hele passagen for hver variant.
- RAM-tallene er øjebliksbilleder af V8-heap, WebGL-geometrier, teksturer og shaderprogrammer. De kan svinge med garbage collection og dækker kun dele af browserens forbrug. Ingen direkte måling af VRAM, batteri, temperatur eller ydelse på en fysisk telefon.

## Målinger

### Desktop · fem både og tre grafiktrin

Alle tider i ms er p95. Typisk antal tegnekald er p50 blandt tegnede billeder. Høj tegner i 1.649 × 1.030 pixels. Lav tegner i 789 × 493, ca. 77 % færre pixels. Benchmarkscenerne for Racer, Turbåd og begge foilbåde ligger på åbent vand, hvor andet ikke står angivet.

| Scene | CPU pr. callback Høj / Lav | Fysik Høj / Lav | 3D-scene Høj / Lav | GPU hovedpassage Høj / Lav | Tegnekald Høj / Lav |
|---|---|---|---|---|---|
| Laser · Faaborg Havn | 6,5 / 5,4 | 2,3 / 2,1 | 4,0 / 2,9 | 6,5 / 1,9 | 239 / 199 |
| Laser · åbent vand | 5,3 / 4,5 | 1,8 / 1,7 | 3,3 / 2,5 | 6,2 / 1,8 | 153 / 119 |
| Racer 32 | 5,5 / 4,5 | 1,5 / 1,4 | 4,0 / 3,0 | 6,1 / 1,8 | 263 / 183 |
| Turbåd 43 | 6,3 / 4,9 | 1,5 / 1,4 | 4,4 / 3,4 | 6,2 / 1,9 | 400 / 307 |
| Foilmonohull | 13,8 / 10,3 | 6,3 / 5,6 | 6,7 / 4,3 | 6,6 / 1,9 | 465 / 294 |
| Foilkatamaran | 14,1 / 13,4 | 8,3 / 8,1 | 7,0 / 5,3 | 6,1 / 1,8 | 609 / 399 |
| Turbåd 43 · kyst | 7,1 / 4,3 | 1,8 / 0,8 | 5,0 / 3,4 | 5,6 / 1,8 | 436 / 337 |

Mellem bruger et mellemstort billede på 1317 × 823 pixels. Overblikket placerer kameraet højere, mens førsteperson lægger det ved besætningens øje.

| Scene på Mellem | FPS | CPU p95 ms | GPU p95 ms | Tegnekald p50 | Spejlpassager i målevinduet |
|---|---|---|---|---|---|
| Laser · Faaborg Havn | 60,2 | 3,0 | 4,2 | 204 | 32 |
| Laser · åbent vand | 60,0 | 2,4 | 4,2 | 153 | 32 |
| Foilkatamaran | 59,9 | 6,6 | 3,9 | 400 | 32 |
| Laser · overblik | 59,9 | 4,3 | 4,4 | 119 | 32 |
| Laser · førsteperson | 60,1 | 2,4 | 3,6 | 98 | 32 |

Kapsejladsens standardstart med Laser på Høj målte 6,1 ms GPU p95 og 3,1 ms CPU p95. Banemærker og linjer udgjorde 40 tegnekald og 3 236 trekanter i det talte hovedbillede.

### Én, to og seks synlige både

Kamera og startforhold er ens. Antallet er verificeret ved tegnekaldene fra hver medspillers båd. GPU-tallet er hovedpassagens p95. Tegnekald er p50 over hele det levende målevindue.

| Scene | Grafik | Både | CPU p95 ms | Medspilleranimation p95 ms | WebGL-afsendelse p95 ms | GPU p95 ms | Tegnekald p50 |
|---|---|---|---|---|---|---|---|
| Laser · én båd | Høj | 1 | 5,1 | 0,0 | 1,7 | 6,3 | 185 |
| Laser · én båd | Lav | 1 | 4,7 | 0,0 | 1,5 | 1,8 | 152 |
| Laser og Racer 32 | Høj | 2 | 7,7 | 0,5 | 3,1 | 6,8 | 401 |
| Laser og Racer 32 | Lav | 2 | 6,2 | 0,6 | 2,4 | 2,1 | 293 |
| Seks synlige både | Høj | 6 | 18,9 | 5,2 | 9,9 | 7,3 | 1 328 |
| Seks synlige både | Lav | 6 | 11,7 | 1,7 | 8,3 | 3,3 | 1 060 |

Detaljer for ét optalt billede med seks både på Høj. Spejlpassagen er udløst til optællingen. Linjer og punkter ligger i JSON-filen, da de ikke tæller som trekanter. Et tegnekald kan omfatte flere instanser.

| Lag | Hovedpassage kald / trekanter | Skygger kald / trekanter | Spejl kald / trekanter |
|---|---|---|---|
| Vand | 1 / 41 328 | 0 / 0 | 0 / 0 |
| Himmel | 1 / 840 | 0 / 0 | 0 / 0 |
| Spillerens skrog og rig | 87 / 12 402 | 16 / 6 352 | 2 / 4 486 |
| Medspilleres skrog og rig | 230 / 88 054 | 37 / 57 008 | 7 / 63 180 |
| Spillerens sejl | 2 / 2 240 | 1 / 1 120 | 2 / 2 240 |
| Medspilleres sejl | 21 / 19 364 | 11 / 18 244 | 12 / 19 364 |
| Spillerens besætning | 20 / 4 219 | 17 / 4 195 | 0 / 0 |
| Medspilleres besætninger | 267 / 67 725 | 102 / 27 777 | 0 / 0 |
| Kølvand | 2 / 1 120 | 0 / 0 | 0 / 0 |
| Vandlinjeskum | 1 / 10 | 0 / 0 | 0 / 0 |
| Vindpile | 1 / 72 | 0 / 0 | 0 / 0 |
| Bølgeskum | 1 / 6 | 0 / 0 | 0 / 0 |
| Vejrpartikler | 1 / 0 | 0 / 0 | 0 / 0 |
| Sprøjt | 1 / 0 | 0 / 0 | 0 / 0 |

I havnen står terræn, kystinventar og træer for 83 af 205 kald i den optalte hovedpassage på Høj. Med seks både bruger alle besætninger tilsammen 287 kald i hovedpassagen og 119 i skyggepassagen. Spiller og medspillere bruger tilsammen 317 kald til skrog og rig i hovedpassagen. Ved seks både måltes WebGL-afsendelsen til 9,9 ms p95 mod 1,7 ms for én båd. Søkortet tog 0,3 ms p95 pr. opdatering i samme seksbådsprøve, og de almindelige enbådsprøver gav 0,4 ms p95 til den lokale vådmaske i havnen. Med seks både kom målingen af vådmasken op på 1,2 ms p95 med det ekstra nære skrog.

### GPU · vand, skygger, spejl og horisont

De første fire GPU-kolonner viser medianen af et fastfrosset hovedbillede. Den enkle vandshader bevarer nettes indeksbuffer og fjerner bl.a. bølgeforskydning, detaljelys, transparens og refleksioner. Skyggetiden er målt direkte i skyggepassagen. Spejltiden er fra den løbende sejlads og vises kun for billeder med spejlopdatering.

| Scene | Grafik | Normal ms | Enkel vandshader ms | Skjul vand ms | 1,5 km klippegrænse ms | Skyggepassage ms | Spejl ms |
|---|---|---|---|---|---|---|---|
| Laser · Faaborg Havn | Høj | 4,82 | 1,62 | 1,80 | 4,48 | 0,34 | 0,48 |
| Laser · åbent vand | Høj | 4,78 | 1,43 | 1,51 | 4,03 | 0,22 | 0,42 |
| Seks synlige både | Høj | 5,24 | 2,31 | 1,93 | 5,23 | 0,37 | 0,56 |
| Turbåd 43 · kyst | Høj | 3,42 | 2,02 | 2,04 | 2,89 | 0,29 | 0,52 |
| Laser · Faaborg Havn | Lav | 1,91 | 0,65 | 0,64 | 1,70 | – | – |
| Laser · åbent vand | Lav | 1,79 | 0,58 | 0,55 | 1,65 | – | – |
| Seks synlige både | Lav | 2,72 | 1,66 | 1,63 | 2,56 | – | – |
| Turbåd 43 · kyst | Lav | 1,72 | 0,92 | 0,88 | 1,59 | – | – |
| Foilkatamaran · regn | Høj | 4,82 | 2,22 | 2,27 | 3,76 | 0,35 | 0,39 |

At forenkle vandshaderen frigjorde 1,4–3,3 ms i de viste prøver på Høj. Selve vandnettet bruger 41 328 trekanter på Høj og 21 024 på Lav. Det sendes i ét tegnekald. Størrelsen af GPU-gevinsten ved at skifte materiale med samme indeksbuffer peger på shaderarbejdet som det største grafiske enkeltområde.

Klippeprøven fra 8 til 1,5 km gav små og sceneafhængige ændringer. Den målte kameraklipning med de eksisterende terrænobjekter i hukommelsen. En test af kortere aktiv terrænafstand og streaming ville måle en særskilt CPU- og hukommelseseffekt. At skjule alt land gjorde det samlede billede dyrere i flere scener. Her kan flere pixels blive udfyldt af vandet. De separate prøver for himmel, regn, skum, vindpile og besætning ligger i måledata.

I regnprøven sænkede frakobling af vandets regndetaljer p95 fra 6,12 til 5,78 ms. Ved skjulte regnlinjer og vejrpartikler var det 6,10 ms. Forskellene i de 14 prøver er mindre end for hele vandshaderen. Regnprøven blev gentaget fra en frisk browserkontekst efter en fejl i måleværktøjets pauseur.

### Simuleret telefon · langsommere CPU

Oversigten bruger portræt og 4× CPU-drosling. GPU’en er den samme som på desktop. 0,87 i simuleret tid betyder, at der afvikles ca. 0,87 sekunders sejlads pr. sekund på uret. Tider er p95.

| Scene | Grafik | FPS | Simuleret tid / realtid | CPU ms | Fysik ms | GPU ms | Uafviklet simulation, s |
|---|---|---|---|---|---|---|---|
| Laser · Faaborg Havn | Lav | 59,4 | 1,00 | 17,0 | 8,0 | 1,1 | 0,02 |
| Laser · åbent vand | Lav | 60,0 | 1,00 | 12,0 | 4,4 | 1,3 | 0,02 |
| Foilmonohull | Lav | 36,7 | 1,02 | 32,7 | 21,7 | 1,5 | 0,07 |
| Foilkatamaran | Lav | 18,1 | 0,87 | 38,6 | 28,3 | 3,4 | 1,32 |
| Seks synlige både | Lav | 43,5 | 1,00 | 31,9 | 8,4 | 2,9 | 0,02 |
| Laser · Faaborg Havn | Minimum | 59,7 | 1,00 | 14,1 | 5,4 | 0,9 | 0,02 |
| Foilmonohull | Minimum | 37,9 | 1,01 | 32,5 | 20,9 | 1,2 | 0,05 |
| Foilkatamaran | Minimum | 19,2 | 0,90 | 37,7 | 27,0 | 1,0 | 0,90 |
| Foilkatamaran | Auto | 18,5 | 0,97 | 37,6 | 25,5 | 1,0 | 1,43 |

På telefonprofilens katamaran på Lav tog fysik gennemsnitligt 19,0 ms af 25,6 ms hovedtråd pr. callback. GPU-medianen var 1,17 ms. Minimum sænkede GPU’ens p95 til 1,03 ms, og p95 for tiden mellem tegnede billeder var 66,7 ms. V8-profilen for katamaranen viser især bølgeberegningerne `addBand` og `analyticWaveAt`, derefter skrog-/foilkræfter, dybde- og læopslag samt kopiering af tilstand. I den simulerede seksscene bruger browseren derimod mere hovedtrådstid på scenen og WebGL-afsendelse end på lokal fysik. Det gør foils og flåder til to forskellige typer optimeringsarbejde.

Auto tegnede 222 billeder på `minimum` i det længere målevindue.

### Korte stop, indlæsning og hukommelse

Separat kontrol med den oprindelige profiler fandt stop ved første bådskift, fx 243 ms CPU ved Turbåd 43 og 165 ms ved AC75 på Høj. De dyreste dele lå inden i rendererens afsendelse. Selve modelbygningen lå omkring 8–9 ms i disse korte overgangsvinduer. De langsomme enkelte billeder kan derfor mærkes, selv når spillet efterfølgende når ca. 60 FPS.

Ekstra kontrol af individuelle WebGL-kald i første overgang. Hver kolonne viser maksimum for sit eget scope pr. callback.

| Båd | CPU ms | Byg båd ms | Hovedafsendelse ms | Programforespørgsel ms | Link af shaderprogram ms | Tekstur-upload ms | Buffer-upload ms |
|---|---|---|---|---|---|---|---|
| Racer 32 | 97,0 | 6,6 | 68,9 | 0,7 | 0,0 | 2,3 | 0,1 |
| Turbåd 43 | 86,3 | 6,1 | 65,2 | 0,8 | 0,0 | 2,5 | 0,1 |
| Foilmonohull | 89,0 | 7,0 | 64,9 | 0,8 | 0,1 | 2,1 | 0,2 |
| Foilkatamaran | 111,1 | 6,8 | 72,9 | 0,7 | 0,0 | 1,3 | 0,9 |

Programoprettelse og tekstur-upload kan ses i de første billeder. De synkrone tider for de målte individuelle WebGL-kald forklarer kun en mindre del af afsendelsestoppene. En særskilt browser- og drivertrace er nødvendig for at fordele resten sikkert mellem programforberedelse, driverarbejde og scenegennemgang.

Den kolde lokale indlæsning registrerede 2,04 MB i ressourcekroppene frem til første sejlads ud over HTML-dokumentet. I desktopmålingerne gik ca. 0,71–1,69 s fra navigation til aktiv startknap. Det inkluderer allerede lokalt arbejde med øhavsdata, teksturer og første båd. De største enkeltressourcer er her opgjort som leverede kilobyte efter eventuel HTTP-komprimering.

| Ressource | kB |
|---|---|
| `archipelago-fields.bin` | 1 019,4 |
| `surface-textures.js` | 297,9 |
| `three-r160.min.js` | 168,4 |
| `sky-daylight.js` | 105,5 |
| `archipelago-relief.js` | 65,6 |
| `model-yacht.webp` | 42,6 |

| Scene på Høj | JS-heap MB | WebGL-geometrier | Teksturer | Shaderprogrammer |
|---|---|---|---|---|
| Laser · Faaborg Havn | 39 | 225 | 26 | 54 |
| Foilkatamaran | 49 | 369 | 40 | 35 |
| Laser · én båd | 56 | 227 | 28 | 38 |
| Laser og Racer 32 | 48 | 357 | 40 | 43 |
| Seks synlige både | 56 | 1076 | 87 | 51 |

Geometrier og teksturer tæller ressourcer, som browseren har registreret. Byteforbrug og synlige ressourcer kræver hver deres optælling. Måledata indeholder desuden DOM, layout og stilberegning.

## Prioritering ud fra målingerne

1. **Sænk GPU-prisen på det viste vand først.** Billedbuffer og den nære vandshader er de stærkeste kandidater. Sammenlign forenkling af dybdeopslag, teksturlæsning og regn/optik ved samme opløsning. Bevar bølgegeometri og kontakt tæt på båden ved visuel kontrol.

2. **Fjern overflødigt CPU-arbejde i foilernes vandprøver.** Undersøg genbrug af dybde-, læ- og bølgebåndsdata inden for samme deltrin, og mål om den samme numeriske beregning kan bruge færre allokeringer. Afspil de eksisterende sejladsforløb for at kontrollere fysisk ækvivalens.

3. **Skær ned på tegnekald fra nærliggende medspillere.** Saml rig- og besætningsdele efter materiale, brug grovere besætningsnet tidligere, og mål disse sammen med skygger på medspillere. Katamaranens vingemesh er et særligt sted at måle gevinst ved mindre geometri på Lav.

4. **Profiler og fordel dyrt opstartsarbejde.** Hold øje med første shaderprogram, forberedelse af land og assetdekodning. Indlæs billeder til bådvalg, når der er brug for dem. Mål skiftets værste billedtid og den kolde opstart igen hver for sig.

5. **Brug kortere detaljeafstand målrettet.** Det er mest relevant nær komplekse havne og for mange både. Den målte kameraklipning langt ude havde en mindre gevinst end vandshaderen. Kort og instrumenter var mindre målte udgiftsposter, så deres opdatering har lavere prioritet.

## Gentag målingen

Start fra den ønskede kildekoderevision. Brug en ren browserkontekst og samme indstillinger til én sammenligning.

```sh
TACK_BUILD_DIR=/tmp/tack-profiler-dist npm run build
FRONTEND_DIR=/tmp/tack-profiler-dist FRONTEND_PORT=4207 node server/static.js
```

I en anden terminal

```sh
TACK_AUDIT_CPU=1 node scripts/render-audit.cjs http://localhost:4207/ /tmp/tack-high.json high
TACK_AUDIT_CPU=1 node scripts/render-audit.cjs http://localhost:4207/ /tmp/tack-low.json low
TACK_AUDIT_LAYERS=0 TACK_AUDIT_CPU=1 node scripts/render-audit.cjs http://localhost:4207/ /tmp/tack-mobile.json low 4 mobile
```

`TACK_AUDIT_STAGES` vælger et kommaadskilt udsnit af scenerne. `TACK_AUDIT_MS` ændrer målevinduet. `TACK_AUDIT_SWITCH=1` profilerer WebGL-kald ved bådskift. `TACK_AUDIT_RACE=1` profilerer standardbanen fra kapsejladsens start. `CHROME_PATH` vælger Chrome-binæren på et andet system. Profilværktøjet ændrer testfanens HTML-svar for at tilføje målepunkterne. Selve spilfilerne og produktionsbuildet er uændrede.
