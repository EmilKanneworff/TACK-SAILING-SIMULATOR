# Slutkontrol af ydelse og mobilbetjening i TACK

Målt 25. november 2026 på Apple M5 med 32 GiB RAM, Chrome 158.0.8127.37 og ANGLE Metal. Produktionsbuild `d28234900d94` er førversionen fra begyndelsen af optimeringen. Slutbuildet er `55afe8661449`. De blev serveret fra separate, uændrede buildmapper under målingen. [Lokal udgave](http://localhost:4173/) · [Samme netværk](http://192.168.0.78:4173/)

## Opstart

Median af tre kørsler med hver cachetilstand. Mobilviewport 390 × 664 CSS-pixel, DPR 3, vandflade på 288 × 491, Lav grafik og 4× CPU-drosling. Netværket var begrænset til 10 Mbit/s og 80 ms forsinkelse. Starten brugte Laserjollen, følgekamera, 5 m/s vind fra nord, 0,35 m bølger og 35 % chop. [Rå opstartsmålinger](opstart.json)

| Tid fra navigation | Tom cache, før → efter | Varm cache, før → efter |
|---|---:|---:|
| Første synlige indhold | 0,26 → 0,25 s | 0,22 → 0,18 s |
| Første tegnede 3D-scene | 6,13 → 3,27 s | 5,43 → 1,37 s |
| Første billede under sejlads | 6,67 → 3,74 s | 5,95 → 1,76 s |
| Ror og skøde ændrer faktisk bådtilstanden | **6,86 → 3,92 s** | **6,15 → 1,91 s** |
| Stabil billedrytme under sejlads | 7,26 → 4,28 s | 6,48 → 2,29 s |

Startknappen blev aktiv efter 5,86 → 3,00 s med tom cache og 5,23 → 1,16 s med varm cache. Prøven trykker på start, når knappen kan betjenes. Stabil billedrytme betyder 30 tegnede billedintervaller, højst ét over 33,5 ms, ingen over 50 ms og under 40 ms ophobet simulationstid. Den længste CPU-opgave faldt i median fra 4,76 til 1,05 s med tom cache.

Geografien overføres som et gzip-komprimeret binært raster på ca. 1,02 MB. Browseren henter det parallelt med den resterende spilkode. Efter netværkssvaret tog download og udpakning frem til rådata ca. 1,20 s med tom cache og 52 ms med varm cache. Rekonstruktion af gitrene tog yderligere ca. 47 og 49 ms. Hele opstartsmålet inkluderer indlæsning og parsing af JavaScript, udpakning, kopiering, 3D-initialisering og det første input. Overførsel ved første besøg steg fra 1,18 til 2,21 MB. Ved genbesøg faldt den fra 12.000 til 300 byte under disse forhold. [W3C User Timing](https://www.w3.org/TR/user-timing/)

## Billedrytme

Korte prøver på samme Mac og Chrome med Lav grafik, 4× CPU-drosling, 1120 × 700 CSS-pixel, DPR 1,5 og WebGL-flade på 789 × 493 pixel. Samme starttilstand, vejr og kamera i de parrede prøver. Normal sejlads blev målt i cirka 6,5 sekunder pr. passage. Et hak er et interval på over 100 ms mellem to faktisk tegnede billeder. [Førmålinger](billeder-foer.json) · [Eftermålinger](billeder-efter.json)

| Scenarie | Median / p95 før | Median / p95 efter | Største interval før → efter | Hak før → efter |
|---|---:|---:|---:|---:|
| Laser ved havnen | 16,7 / 16,8 ms | 16,7 / 16,8 ms | 50,0 → 50,0 ms | 0 → 0 |
| Turbåd 43 ved kysten | 16,7 / 16,8 ms | 16,7 / 16,7 ms | 16,8 → 16,8 ms | 0 → 0 |
| Laser under samme opretning | 16,7 / 83,3 ms | 16,7 / 16,8 ms | **266,8 → 66,7 ms** | **3 → 0** |
| AC75 i 17 m/s og 0,60 m bølger | 16,7 / 33,4 ms | 16,7 / 33,4 ms | 66,6 → 66,7 ms | 0 → 0 |
| Seks tegnede både | 16,7 / 16,8 ms | 16,7 / 16,8 ms | 50,1 → 50,0 ms | 0 → 0 |

Første konstruktion og tegning af Turbåd 43 gav et interval på 250 → 217 ms. For AC75 var det 233 → 200 ms. Der var fortsat ét hak på over 100 ms ved hvert første bådskift. De er enkeltmålinger. Opretningen sluttede efter ca. 4,41 s i begge builds. Den ophobede simulationstid ved afslutningen af de almindelige passager lå omkring 16 ms. Ved første AC75-skift blev der kortvarigt målt ca. 200 ms i begge builds. Ved løbende AC75-sejlads brugte de faste fysiktrin 8,4 → 9,0 ms i median, scenearbejdet 7,7 → 7,4 ms, og GPU-arbejdet ca. 1,9 ms i begge builds. Det er fortsat et CPU-tungt forløb ved 4× drosling.

Den tidligere grafikoptimering er med i slutbuildet. Den bygger den valgte båd først, genbruger minikortets baggrund og dele af sejlgeometrien samt skalerer terræn og udsyn efter belastningen. Seksbådsprøven måler spillerens simulation og fem tegnede medspillerøjebliksbilleder.

## Ti minutters sejlads

Slutbuildet gennemførte **600,42 sekunder** med samme build-ID ved begyndelse og afslutning og nul browserfejl. De fem bådtyper blev skiftet gennem 21 passager i én browsersession. Kontrolforløbene brugte almindelige tastetryk. Hver passage startede fra en fastsat position ved kysten eller på åbent vand. [Log fra langtesten](langtest.jsonl)

Der var **8 hak over 100 ms** i målevinduerne. Det længste interval var 124,8 ms. Medianerne pr. passage spændte fra 16,6 til 55,6 ms, og p95 fra 18,2 til 68,7 ms. Billedrytmen var langsomst på foilkatamaranen med 15 m/s vind og 0,65–0,80 m bølger. Den maksimale ophobede simulationstid ved et målepunkt var 2,66 s. De fleste passager sluttede med under 40 ms ophobning. Maksimum var 424 aktive geometrier og 38 teksturer.

Den samme kystpassage med foilkatamaranen blev gentaget med samme 4× drosling, vejr og startpunkt på det umiddelbart foregående build, `4586930972bf`. Billedintervallernes p95 var 65,6 ms på den version og 64,0 ms på slutbuildet. Ophobet simulationstid ved slutningen af de to passager var henholdsvis 0,60 s og 1,75 s. Den forskel er en enkelt sammenligning. Langtesten viser, at denne bådtype stadig kan miste simulationstid i forhold til væguret under kraftig CPU-drosling. [Kort kontrol på det foregående build](katamaran-foer.jsonl)

## Gitre, bølger og fysik

Produktionsbuildet genbruger dybdegitteret og de statiske terræninput til vindberegningen. Dybden bruger fortsat de samme to 8-bit kanaler med 16-bit præcision, svarende til ca. 0,73 mm pr. trin over det eksisterende spænd på 48 m. Terrænhøjde og terrændækning for vind bevarer deres Float32-bit, og landklassen bevarer sine 8-bit. Akserne er øst og nord. Vandstanden er fortsat modellens nulreference. Dybdegitteret måler 914 × 639 felter, og vindens terrængitter måler 885 × 665. Jeg sammenlignede disse arrays byte for byte med den tidligere generator, inklusive det tidligere terræns afstandsberegning. Prøver i kyst-, lavvands- og offshoreområder, mellem gitterpunkter og ved gitterets grænser gav identiske værdier. [Gitterstørrelser og grænser](gitre.json) Hovedtråd og multiplayerens vært læser begge de versionsbestemte gitre. Vindretning, lokalt læ, pust og bølger beregnes fortsat ved sejlads.

`equilibriumHeave` og foilbådenes tilsvarende søgning flytter kun båden lodret under 38 eller 40 kandidater. `bodyPoint` viser, at kun verdenspunktets z ændrer sig. `waterForHeaveSearch` lever kun i denne synkrone søgning, så tid, vejrprofil, dæmpning og filtrering er faste. Den genbruger højde, hældning og fasebidrag for hvert vandret punkt. `resolveHeaveWater` beregner igen bølgepartiklernes hastighed og acceleration ved den aktuelle dybde. Skrogets neddykning, volumen, opdrift, centre, kræfter og momenter kom fra en ny evaluering for hver kandidat. Den fyldige kontrol med dæmpning blev også gentaget ved den fundne vandlinje. [Crest om vandprøver](https://docs.crest.waveharmonic.com/Manual/Advanced/Queries.html)

I den målrettede Laserprøve under kraftig krængning og en overgang mellem to søtilstande faldt antallet af fulde bølgeforberedelser fra 35.302 til 929. Den målte CPU-tid for de sammenlignelige kandidatberegninger faldt fra 34,45 til 9,59 ms. Tallene er fra ét gennemløb uden CPU-drosling. Alle fem både indgik i prøven. Det er kontrol af den eksisterende model under optimering. [Målinger for de enkelte ligevægtssøgninger](opretning.json)

HTML genvalideres. HTML, JavaScript, CSS, worker og binære data ligger sammen i den indholdsbaserede udgivelse. Den lokale server svarer med 404 for manglende assets. Produktionsspillet viser en indlæsningsfejl, hvis det versionsbestemte raster mangler eller ikke kan læses. [Lokale netværkssvar](netvaerk.json) · [Vercels cachevejledning](https://vercel.com/docs/caching/cache-control-headers)

## Mobilbetjening og browserkontrol

Chrome med telefonemulering sendte to samtidige kontakter gennem DevTools-protokollen. Prøven bekræftede både styrekommandoen og den faktiske skødebevægelse, uafhængig frigivelse, fastholdt ror ved bevægelse hen over den modsatte knap og nulstilling ved annullering og tab af fokus. Prøven af fortsat slæk gav først timeout, fordi skødet havde nået 0 %. Den gentagne prøve halede først til mindst 25 % gennem den almindelige knap og bestod i begge orienteringer. Playwrights almindelige trykemulering blev brugt til de enkeltstående WebKit-kontroller. [Playwrights touchreference](https://playwright.dev/docs/api/class-touchscreen)

WebKit 27.2 bestod ved 320 × 568, 667 × 320 og 844 × 390. En særskilt Chrome-prøve ved 390 × 664 og 844 × 390 kontrollerede, at kontrollerne er inden for rammen uden vandret sidescroll. Manuelle besætningsvalg på Svær og automatisk balance på Let blev prøvet. Touchresponstiden til det tegnede knapsvar var 61,3 ms i median og 75,6 ms ved p95 over 48 berøringer i Chrome med 4× CPU-drosling. [Stående](portraet.jpg) · [Liggende](liggende.jpg) · [Betjeningsvideo](mobilbetjening.mp4) · [Responstider](touchrespons.json)

Alle 58 Node-prøver bestod, og TypeScript-kontrollen var ren. Seks optagede inputforløb matchede det foregående build. En særskilt sammenligning fulgte 4.800 faste trin med de fem både på Let og Svær, inklusive kystlæ og et vejrskift. Position, fart, rotation, ror, trim, besætning, kræfter og kontakt gav identiske værdier for de sammenlignede tilstande.

De 28 browserprøver i selve produktionsbuildet bestod. De dækkede blandt andet surf, vandkontakt, foilernes løft og landing, vindpile på Lav, faste fysiktrin ved forskellige grafikniveauer og gendannelse efter tab af WebGL-context. Derudover bestod tre mobilprøver og tre målrettede Let/Svær-prøver. To lokale multiplayerklienter spillede på buildet med autoritet i værtens browser. Begge tabeller blev genbrugt i den versionsbestemte worker, og gæstens rorændring blev registreret hos værten.

Telefonprøverne er gennemført i browseremulering. En fysisk telefon var ikke tilgængelig. Mobil GPU, hukommelse og varmebegrænsning er derfor fortsat ubekræftet. Produktionsindlæsningen kræver en browser med understøttelse af `DecompressionStream`. Netværkskontrollen gjaldt den lokale produktionsserver.

## Gentag målingerne

Byg i en ny mappe med `TACK_BUILD_DIR`. Den gemte førversion blev serveret på 5179, og slutbuildet på 4180, med `FRONTEND_DIR` og `FRONTEND_PORT`. Det identiske slutbuild er aktivt på 4173.

```sh
node scripts/sailing-startup.cjs http://localhost:5179/ http://localhost:4180/ /tmp/tack-opstart.json
TACK_PERF_STAGES=havn,kyst,opretning,foil,seks TACK_PERF_MS=6500 node scripts/render-performance.cjs http://localhost:4180/ /tmp/tack-billeder low 4
node scripts/sailing-soak.cjs http://localhost:4180/
node scripts/phone-sailing.cjs http://localhost:4180/ /tmp/tack-telefon
```
