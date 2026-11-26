# TACK · Optimering af fysik og rendering

- **Udgangspunkt** `97841c6fe0a3`, kilde `412cd1d76a9b201651b5470606bf131c89436638`. Siden analysen var der tilføjet måleværktøj og rapportfiler i arbejdsområdet. Det byggede spil var fra samme revision.
- **Testet build** `37be7ac83c33`, produktionsbygget lokalt fra arbejdsområdet. Den lokale frontend kører på [localhost:4211](http://localhost:4211/).
- **Mål i prøverne** Ca. 60 FPS og ca. 1 simuleret sekund pr. realtidssekund på Mac17,2 med Apple M5. Ca. 30 FPS, ca. samme simulationshastighed og ingen voksende simulationsgæld ved 4× CPU-drosling og portræt på samme maskine.
- **Målegrænser** Chrome 158 headless, ANGLE Metal på M5, 32 GiB RAM. Desktop brugte 1.120 × 700 CSS-pixels og DPR 1,5. Portrætprofilen brugte 390 × 664 CSS-pixels, DPR 3 og simuleret touch med samme GPU. En fysisk lavkapacitetstelefon er uden for måleserien.

## Ændringer

| Område | Ændring | Kontrol |
|---|---|---|
| Foilfysik | Forbered bølgeparametre én gang pr. deltrin. Genbrug helt ens prøvepunkter mellem de to foilkraftberegninger. Nye prøvepunkter evalueres, når en arm flyttes. Rorets hele vingeflade genbruger sin neddykning ved kraftberegningen. Retningslængden genbruges, hvor den lokale udbredelsesgradient er nul. | Sammenlign hele bådtilstanden og kraftdiagnosen efter hvert trin. Fast trin på 60 Hz og 240 Hz for foilernes deltrin. |
| Animation | Overfør skalare værdier til interpolation frem for at kopiere og gennemløbe de fulde kraftregnskaber. Genbrug vingeprofilens fælles geometri og vinkler pr. række. | Prøver af rig, vægtplacering, neddykning og bølgekontakt. |
| Tegnekald | Instancing for beslag på veste, sæder og søgelænderets stivere. Kompatible faste delgeometrier samles, og kropsdele og rig bevæger sig individuelt. Grupperede instanser har beregnet cullinggrænse og frigives, når båden fjernes. | Optælling af hoved-, spejl- og skyggepassager pr. identificeret billede. |
| Vand | Begræns regnarbejde, hvor regnnormalens vægt er præcis nul. Beregn fjernfarven, hvor den blandes ind. Spring panoramaprojektion og opslag over, når deres vægt er nul. | Høj ved fast billedbuffer. Billeder fra samme fysiske tilstand. |
| Auto | Brug målte CPU-andeler for fysik og scene samt periodiske GPU-tidsmålinger. Ved CPU-pres reduceres kosmetisk arbejde i to trin. Det ændrer bl.a. frekvensen af søgning efter omgivende skum og afstand til detaljeret medspillervisning. Opløsningen reduceres ved målt GPU-pres. | Lang telefonprofil med log over grafikniveau og CPU-detaljetrin. Browserprøve med særskilt CPU- og GPU-belastning. |
| Detaljeafstand og indlæsning | Auto vælger tidligere enklere eller skjulte kosmetiske kystdetaljer og bruger eksisterende hysterese og kassering af inventar. Øsilhuetter, pejlemærker og fysisk geografi bruger de samme data. Bådvælgerens miniaturebilleder indlæses ved brug. | Mål billedtid, ressourceantal og bådskift særskilt. |

Ændringerne ligger i [fysikken](../../assets/simulation/physics.js), [foilmodellen](../../assets/simulation/foils.js), [renderer og spilløkke](../../index.html), [flådens detaljeniveau](../../assets/fleet.js) og [bølgeskum](../../assets/breaking-foam.js).

## Sejlads og fysikparitet

Samme 1/60 s inputafspilning gav eksakt lighed for hele tilstanden inklusive kraft- og momentdiagnosen efter **7.200 trin**. Der blev kørt 15 scenarier med alle fem både på åbent vand, i større dønning og tæt ved kyst. Der indgik ror, skøde, vægtflytning på begge akser og vejrskift. Registrerede hændelser omfatter stagvending med Laser, grundkontakt med kølbåd, foilstart og touchdown med AC75, skift mellem acceleration og foiling med AC72 samt laserkæntring. Sammenligningskravet var eksakt lighed fra starten. [Afspiller](../../scripts/verify-render-physics.cjs) · [Starttilstande, input og hændelser](optimering-data/fysikparitet.json)

`npm test` bestod 64 tests, og `npm run check:simulation` bestod typekontrollen. De 43 valgte Chrome-tests bestod på produktionsbuildet og den tilsvarende lokale kilde. De dækker blandt andet direkte ror og skøde, Auto, gendannelse af WebGL, bølgekontakt, kølvand, besætningsbevægelse og vindpile i læ. Fire testfejl kunne også genskabes med baseline. To stillevandsprøver arvede standardværdierne for bølgehøjde og chop, og to vindprøver brugte koordinater fra før spillets komprimering af kortet. Testene anvender nu de aktive vejrindstillinger og kortets koordinatkonvertering. [Grafikprøver](../../tests/render-quality.test.js) · [Vandkontaktprøver](../../tests/water-effects.test.js) · [Vind- og besætningsprøver](../../tests/wave-crew-experience.test.js)

## Før og efter

### Foilkatamaran · Lav, 4× CPU, portræt

| Prøve | FPS | Interval p95 ms | Sim./realtid | Gæld start → slut ms | CPU pr. trin ms | CPU pr. sim. s ms | Oversprungne tegninger |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Før · fuld | 20,6 | 66,7 | 1,031 | 1 017 → 82 | 11,81 | 709 | 378 |
| Efter · fuld | 43,6 | 33,4 | 1,019 | 566 → 15 | 9,68 | 581 | 32 |
| Før · let | 27,4 | 50,1 | 1,028 | 867 → 15 | – | – | 121 |
| Efter · let | 42,7 | 33,4 | 1,018 | 550 → 15 | – | – | 31 |
| Efter · Auto, 15 s | 43,4 | 33,4 | 1,032 | 483 → 16 | 9,59 | 576 | 25 |
| Slutbuild · fuld | 39,0 | 33,4 | 1,018 | 567 → 15 | 9,94 | 596 | 30 |
| Før · gentaget fuld | 22,8 | 66,7 | 1,028 | 900 → 65 | 11,49 | 689 | 270 |

| Prøve | Hovedtråd p95 ms | Scene p95 ms | Bådanimation p95 ms | Interpolation p95 ms | GPU hovedpassage p95 ms | GPU gyldige | GPU uden resultat | GPU forkastede |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Før · gentaget fuld | 35,8 | 10,1 | 3,4 | 1,7 | 1,43 | 342 | 341 | 0 |
| Slutbuild · fuld | 31,3 | 9,2 | 3,0 | 0,7 | 1,27 | 585 | 584 | 0 |

Opløsningen var 288 × 491. GPU-kolonnen uden resultat tæller de billeder, hvor der bevidst blev sprunget en timer over. Fysiktid omfatter input, snapshots og faste trin på hovedtråden. Rækkerne mærket Efter i den øverste tabel kommer fra `0a9dfb63f365` med samme foilberegninger, billedoptimeringer og Auto. Den lette test målte 27,4 → 42,7 FPS med mindre måleoverhead. Den første serie kørte baseline først. Den gentagne fulde prøve kørte slutbuildet først. De gemte starttilstande, vejr og input var eksakt ens i de to gentagne prøver. Efter fem sekunder var gælden ca. 383 ms i baseline og 16 ms i slutbuildet. Efter 20 sekunder var den ca. 82 og 16 ms. Der blev kasseret 0 ms aktiv solotid i disse målevinduer. 39,0 FPS er gennemsnittet over 30 sekunder. P95-billedintervallet på 33,4 ms viser, at nogle billeder stadig tog længere tid.

På den lette katamaranprøve svarede roret efter **59,4, 34,1, 35,0 ms** før og **44,0, 20,8, 17,5 ms** efter i tre tastetryk pr. version. Slutbuildet målte **43,2, 30,5, 30,6 ms** med den fulde instrumentering. Billedfrekvensen begrænser målingens tidsopløsning. Auto tegnede alle 651 billeder på Lav (288 × 491), mens CPU-detaljetrinnet nåede trin 2.

V8-profilerne fra AC72 har fortsat `addBand` og `analyticWaveAt` som de dyreste funktioner fra spillet. `copyTree` var en af de største poster ved baseline. Efter ændringen var `samplePath` den næste større post efter skrogets vandlast. Profilerne viser, hvor hovedtråden bruger tid. Gevinsten pr. fysiktrin er målt direkte over de længere afspilninger.

### Desktop · GPU og flåde

| Build · Laser på Høj | FPS | GPU p50 ms | GPU p95 ms | Gyldige | Uden måling | Forkastede |
| --- | --- | --- | --- | --- | --- | --- |
| 97841c6fe0a3 | 60,0 | 5,54 | 6,36 | 900 | 900 | 0 |
| 33dd62a8d5e7 | 60,0 | 5,81 | 6,29 | 900 | 900 | 0 |
| 0a9dfb63f365 | 60,0 | 5,05 | 6,25 | 900 | 900 | 0 |
| 37be7ac83c33 | 60,0 | 4,98 | 6,26 | 900 | 900 | 0 |

Vandtesten holdt 1.649 × 1.030 pixels, samme båd, sejlinput, vejr og kamera. P95 faldt fra 6,36 til 6,26 ms for hovedpassagen inklusive skygger. Medianen varierede mellem kørslerne. Den særskilte spejlpassage målte 0,60 → 0,61 ms p95. Den samlede GPU-gevinst af det ændrede billede er lille på M5. Billederne viser bevarede bølgefronter, spejling og vandkontakt.

| Frossen scene på Høj | Reference p50 før → efter | Enkelt vandmateriale | Uden vandets regnoptik | Klip ved 1,5 km |
| --- | --- | --- | --- | --- |
| Havn | 4,39 → 4,85 | 1,35 → 1,69 | 4,76 → 4,15 | 4,61 → 4,02 |
| Laser på åbent vand | 3,56 → 3,43 | 1,12 → 0,96 | 3,40 → 3,31 | 3,20 → 3,00 |
| Katamaran i regn | 5,27 → 5,89 | 2,27 → 2,23 | 5,03 → 5,72 | 4,88 → 5,00 |

Varianterne måler hele passagen i ms ved samme kamera og bølgefase. Hver celle bruger 14 gyldige målinger efter fire opvarmninger pr. variant. Det enkle materiale gav den største forskel, men fjerner både bølgeforskydning og optik. I fryseprøverne steg referencetiden i havnen og regnscenen. Det viser, at den lille gevinst i den længere Laser-prøve er sceneafhængig. Sammen med den oprindelige analyse taler klippeprøverne for at bevare det lange udsyn og regulere de aktive smådetaljer særskilt. [Måleserier før](optimering-data/before-layers.json.gz) · [Måleserier efter](optimering-data/release-layers.json.gz)

| Synlige både | Tegnekald p50 før → efter | CPU hovedafsendelse p95 ms | GPU hovedpassage p95 ms |
| --- | --- | --- | --- |
| 1 | 188 → 182 | 1,00 → 1,00 | 6,28 → 6,32 |
| 2 | 407 → 384 | 1,60 → 1,60 | 6,88 → 6,74 |
| 6 | 1332 → 1193 | 3,90 → 3,60 | 7,84 → 6,55 |

I det optalte efterbillede med seks både var der 1019 kald i alt. Heraf var 315 til besætningerne i hovedpassagen. Optællingen udelukkende for det billede omfatter et fremtvunget spejlrender. De levende p50-tal i tabellen varierer med culling, kamera og spejlfrekvens.

### Indlæsning og første bådskift

| Båd | Før CPU maks. ms | Med batching CPU maks. ms | Slutbuild CPU maks. ms | Med forberedelse CPU maks. ms | Særskilt forberedelse ms |
| --- | --- | --- | --- | --- | --- |
| Racer 32 | 93,0 | 99,2 | 47,1 | 39,3 | 156,9 |
| Turbåd 43 | 86,8 | 96,5 | 62,2 | 36,7 | 214,7 |
| Foilmonohull | 91,9 | 89,6 | 24,9 | 38,7 | 37,6 |
| Foilkatamaran | 101,4 | 107,7 | 64,2 | 50,4 | 126,1 |

Forberedelse af den valgte båds materialer og teksturer reducerede selve tegnespidsen. I flere overgange var den samlede forberedelsesventetid længere end den oprindelige spids. Derfor er den eksperimentelle forberedelse kun tilgængelig i profileringsværktøjet. Slutbuildet holder den afgående båds materialer til efter den nye båds første billede. Det lader kompatible shaderprogrammer genbruges, og frigivelsen går til browserens ledige tid. Chrome-tracen viser WebGL-arbejde og ventetid på kommandobufferen. Drivertracen nedbryder kun en del af overgangens samlede tid. [Chrome-trace](optimering-data/switch-trace.json.gz) · [Khronos om parallel shaderkompilering](https://registry.khronos.org/webgl/extensions/KHR_parallel_shader_compile/) · [Three.js r160 renderer](https://github.com/mrdoob/three.js/blob/r160/src/renderers/WebGLRenderer.js)

Indlæste ressourcekroppe til første sejlads faldt fra 2,038 til 1,862 MB eksklusive HTML. Startknappen var klar efter 701 ms før og 705 ms i slutbuildet. I samme prøver tog første sejlads efter klik 235 og 230 ms.

| Skifteserie | Racer 32 | Turbåd 43 | Foilmono | Foilkat |
| --- | --- | --- | --- | --- |
| 1 | 220 / 31 | 272 / 31 | 260 / 35 | 293 / 40 |
| 2 | 222 / 33 | 274 / 32 | 260 / 35 | 293 / 40 |
| 3 | 222 / 33 | 274 / 32 | 260 / 35 | 293 / 40 |

Cellerne viser WebGL-geometrier og teksturer efter hver båd. Visuelle bygninger og træsektorer opbygges også under prøven. JS-heap varierede mellem 29 og 79 MB i slutbuildets tre runder. Ressourceoptællingen måler antal objekter. Fysisk VRAM-forbrug kræver en særskilt måling.

### Faktisk multiplayer

To browserkontekster oprettede og deltog med rigtig lobbykode. WebSocket-serveren kørte med browserautoritet. Værten sejlede Laser og gæsten foilkatamaran. Der blev brugt Lav med lokal hardwareacceleration og naturlige tastetryk.

| Build | Rolle | Båd | FPS | Sim./realtid | Workertrin p95 ms | Ventende input p95 | Snapshots ind kB/s | Forskel til autoritet p95 ms | Kasseret workertid ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Før | Vært | laser | 60,0 | 1,003 | 4,8 | 7 | 528,8 | 50,0 | – |
| Før | Gæst | ac72 | 59,4 | 1,004 | – | 7 | 527,7 | 50,0 | – |
| Efter | Vært | laser | 59,8 | 1,004 | 4,4 | 7 | 530,3 | 66,7 | 0,0 |
| Efter | Gæst | ac72 | 59,6 | 1,004 | – | 6 | 529,1 | 50,0 | – |

Forskellen til autoritet er klientens forudsagte simulationstid minus tidstemplet i sidste modtagne tilstand. Den viser fremrykning i simulationen. Netværksrejsetiden blev ikke målt med synkroniserede ure. Den droslede soloprøve kom over målet med fysikken på hovedtråden. Multiplayer bruger fortsat sin eksisterende worker. En ekstra solo-worker er ikke afprøvet. En sammenligning på fysisk svag hardware vil vise, om omkostningen ved flere snapshots og mere kommunikation er berettiget.

### Visuel kontrol ved samme sejltilstand

| Scene | Før | Efter |
| --- | --- | --- |
| Stille vand og cockpitkamera | [Billede](optimering-data/billeder/foer/stille-vand.jpg) | [Billede](optimering-data/billeder/efter/stille-vand.jpg) |
| Kort sø og kæntring | [Billede](optimering-data/billeder/foer/chop.jpg) | [Billede](optimering-data/billeder/efter/chop.jpg) |
| Turbåd i dønning og modlys | [Billede](optimering-data/billeder/foer/doenning.jpg) | [Billede](optimering-data/billeder/efter/doenning.jpg) |
| Laser ved kyst | [Billede](optimering-data/billeder/foer/havn.jpg) | [Billede](optimering-data/billeder/efter/havn.jpg) |
| Laser under krængning | [Billede](optimering-data/billeder/foer/laser.jpg) | [Billede](optimering-data/billeder/efter/laser.jpg) |
| Foilkatamaran i regn | [Billede](optimering-data/billeder/foer/katamaran-regn.jpg) | [Billede](optimering-data/billeder/efter/katamaran-regn.jpg) |

Parrene er taget efter 180 fysiktrin fra samme sejltilstand og med kameraet nulstillet til samme vinkel i `97841c6fe0a3` og `37be7ac83c33`. Den korte billedprøve nulstiller kølvandshistorikken. Figur, sejlplacering, vindpile, bølgeform og vandlinje er synlige. CPU-tilpasningen kan fjerne små kystdetaljer tidligere og nedsætte opdateringen af fjern animation.

## Reproducerbare optagelser

Hver profil starter en frisk browserkontekst. De 30 sekunders prøver kører i den almindelige spilløkke med starttilstand, vedvarende vind, skift i ror, skøde og vægt efter simulationstid. De korte flådeprøver, styringsprøver og første bådskift er mærket særskilt. Simuleret tid lidt over 1,0 skyldes afvikling af gæld fra opstart. Rækkerne i downloadet indeholder alder på simulationen, gæld og rammeintervaller pr. callback. CPU-profilerne er fra separate 3,5-sekunders vinduer i den nævnte scene efter hovedmålingen.

GPU-målingerne bruger asynkrone timerforespørgsler. Hovedpassagen inkluderer skygger, når de er slået til. Spejlpassagen er målt særskilt. Den lette prøve tæller billeder og tid uden scopes om delsystemer og uden timerforespørgsler til passagerne. Inputprøven bruger spillets tastaturbehandling og aflæser første målte ændring i fysisk rorvinkel ved næste browsercallback. Skærmens egen forsinkelse måles separat på fysisk udstyr.

| Måling | Baseline | Efter |
| --- | --- | --- |
| Katamaran, fuld tidsserie | [30 s](optimering-data/before-cat-repeat.json.gz) | [30 s](optimering-data/release-cat.json.gz) |
| Katamaran, første fulde tidsserie og separat CPU-profil | [30 s](optimering-data/cat-before-1.json.gz) | [30 s](optimering-data/final-cat-a.json.gz) |
| Katamaran med let instrumentering | [30 s](optimering-data/baseline-cat-b.json.gz) | [30 s](optimering-data/final-cat-b.json.gz) |
| Katamaran med Auto | — | [15 s](optimering-data/final-auto.json.gz) |
| Vand på Høj | [30 s](optimering-data/water-before-1.json.gz) | [30 s](optimering-data/release-water.json.gz) |
| Flåde, passager og lagoptælling | [1 / 2 / 6](optimering-data/fleet-before.json.gz) | [1 / 2 / 6](optimering-data/release-fleet.json.gz) |
| Bådskift og ressourcer | [Før](optimering-data/before-switch.json.gz) | [Tre skifterunder](optimering-data/release-switch.json.gz) |
| Multiplayer via WebSocket | [Vært og gæst](optimering-data/live-before.json.gz) | [Vært og gæst](optimering-data/live-release.json.gz) |

### Kommandoer

Brug den bevarede baseline af `97841c6fe0a3` på 4207 og det opdaterede produktionsbuild på 4211. Serveren startes med `FRONTEND_DIR` pegende på det tilsvarende `dist`.

```sh
tack_before=$(mktemp -d /tmp/tack-performance-before.XXXXXX)
git archive 412cd1d76a9b201651b5470606bf131c89436638 index.html assets server | tar -x -C "$tack_before"
node "$tack_before/server/build.js"
FRONTEND_DIR="$tack_before/dist" FRONTEND_PORT=4207 node "$tack_before/server/static.js"
```

```sh
tack_output=$(mktemp -d /tmp/tack-performance.XXXXXX)
TACK_BUILD_DIR="$tack_output/dist" npm run build
FRONTEND_DIR="$tack_output/dist" FRONTEND_PORT=4211 node server/static.js
```

```sh
TACK_AUDIT_STAGES=katamaran TACK_AUDIT_MS=30000 TACK_AUDIT_REPLAY=1 TACK_AUDIT_RAW=1 TACK_AUDIT_LAYERS=0 TACK_AUDIT_CPU=1 TACK_AUDIT_INPUT=1 node scripts/render-audit.cjs http://localhost:4211/ /tmp/ac72.json low 4 mobile
TACK_AUDIT_STAGES=laser TACK_AUDIT_MS=30000 TACK_AUDIT_REPLAY=1 TACK_AUDIT_RAW=1 TACK_AUDIT_LAYERS=0 node scripts/render-audit.cjs http://localhost:4211/ /tmp/vand.json high
node scripts/verify-render-physics.cjs /sti/til/baseline/dist/assets /tmp/fysikparitet.json
```

`TACK_AUDIT_LIGHT=1` vælger let måling. `TACK_AUDIT_IMAGES` peger på en eksisterende mappe. Udelad `TACK_AUDIT_LAYERS=0` for at måle frosne grafikvarianter i de understøttede scener. `TACK_AUDIT_SWITCH=1` måler bådskift. `TACK_AUDIT_WARM=1` prøver særskilt forberedelse af den valgte båd. `TACK_AUDIT_TRACE` angiver stien til Chrome-tracen. Den faktiske tospillerprøve køres med `TACK_LIVE_AUTHORITY=browser PORT=3001 node server/index.js` og `node scripts/profile-live-render.cjs http://localhost:4211/ /tmp/live.json`.
