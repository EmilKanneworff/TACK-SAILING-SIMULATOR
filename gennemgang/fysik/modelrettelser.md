# TACK · Rettelser efter modelauditten

Spil den efterprøvede version på [localhost:4196](http://localhost:4196/). HTTP-header og browserens revisionsmærke viser build `49db10bed342`. Førversionen er auditbuild `55afe8661449`. Begge builds stammer fra den lokale arbejdsmappe på `f51d22035e0eb1dbd27249273f97c630e0217e39` med de lokale ændringer til øhavsfelter, indlæsning, mobil og AC72. Derfor identificerer build-ID'erne koden mere præcist end Git-revisionen alene. Målingerne og de effektive bådprofiler ligger i [modelrettelser.json](modelrettelser.json). Den historiske audit er rettet dér, hvor MASS-03 beskrev en anden bevægelsesregel end koden. [Modelaudit](modelaudit.md)

## Betjening og styring

- **Svær.** Vindfilteret blev fjernet både fra klientens `setCrewSide` og fysikkens `manualCrewTarget`. Q og E og spillets touchknapper vælger nu bagbord og styrbord. 1–3 vælger stilling, også midt i vindøjet. En isoleret prøve ved ±45° til vinden viser, at førversionen afviste læsidevalget på begge halser. Efterversionen ændrer målet i første trin, mens den fysiske side først flytter sig nogle få tusindedele. Fravær af et nyt input bevarer sidemål og stillingsmål. Let kan stadig vælge luv og afbalancere automatisk. Redning har fortsat sin egen, midlertidige styring.
- **Laser i browseren.** I førversionen valgte 2 selv side ved vindøjet. Den oprindelige korte reproduktion nåede omtrent 29° og 23° på de nye halser inden for målevinduet. Med den nye kode blev 2 først kontrolleret alene, hvorefter Q eller E blev trykket ved ca. 3–4° til vinden. Begge stagvendinger sluttede oprejst ved ca. 58° på den nye hals efter stabilisering med position 2. Besætningens mål, fysiske side, figur og tyngdepunkt stemte overens. Besætningens tyngdepunkt lå ca. 0,247 m fra midterlinjen på begge sider i slutprøven. Før og efter bruger forskellige sidekommandoer, og efterprøven tillader mere tid til at fuldføre vendingen. Tallene siger derfor ikke, at selve vendingen er blevet hurtigere.
- **Foilkatamaran i browseren.** Skærmbilledet giver kurs, fart, vind og trim. Startsted, bomstilling, sø og tidligere bevægelse er tilnærmet. Med 091°, 5,8 knob, 9,7 m/s fra 270° og 67,4 % trim gav seks sekunders styrbord omtrent **120°** og ca. **2,53 kN** sejltræk. Bagbord gav **84°** og ca. **1,49 kN**. Rorene stod ved ca. +21,2° og −20,8°. Samtidig slæk og bagbord gav **59°**, 0 % trim og ca. **6,40 kN** sejltræk. Alle tre forløb var uden grundkontakt og kæntring.
- **Modvirkende momenter.** I bagbordprøven ved 84° var det samlede rorbidrag ca. −10,4 kNm om tyngdepunktet. De øvrige foils bidrog ca. +13,9 kNm, og riggen ca. −4,35 kNm. Båden kunne dreje begge veje, men den langsomme drejning på samme bomside blev mindre end i førversionen. Ved indgang fra 091° var den ca. 13° før og ca. 7° efter. Positivt moment er bagbord. De øvrige foils hjælper derfor den bestilte drejning i dette øjeblik, mens ror og rig modvirker den. Øjebliksbilledet kan alene ikke afgøre, hvordan foilernes sidekraft ændrer indløbet til roret. Den faste rorprøve i [opfølgningen](styringsproever.md) undersøger strømningen særskilt. Sammenligningen viser en svagere manøvre, som stadig kræver kalibrering.
- **Laser i 16,8 m/s.** To reb, 51,9 % skøde, 7,6 knob, 28° krængning og fuldt ror. Den indledende drejning efter 1,15 s faldt fra ca. 6,6° til ca. 3,8°. Omkring 1,25 s var kun ca. 0,02 m² af rorbladets 0,105 m² effektivt vådt i den belastede prøve. Drejningen tiltog ved slæk, og fortsat fuldt ror førte til kæntring på begge halser. Vinkelgrænserne i de to belastede rorprøver er sænket, mens prøven fortsat kræver rorbevægelse, vandkontakt, drejning og uafhængigt skøde. Dette er en målt begrænsning ved ekstrem belastning.

Åbn debug med backtick og læs `SAILING_GAME.steeringDiagnostics`. `step` angiver tidspunkt, modtaget og effektivt input, mål og faktisk vinkel, fysisk rorvandring, bladareal, aksial og tværgående strømning, angrebsvinkel, stall, ventilation, momenter om det fælles tyngdepunkt og ændring i lodret vinkelhastighed. Positivt yaw-moment drejer mod bagbord. Nettotallet inkluderer medbevægende vand for Laseren. Efterfølgende redning og netværkets positionskorrektion logges særskilt. Automatisk foiltrim regulerer flapper og arme. [Fysik](../../assets/simulation/physics.js) · [Foilfysik](../../assets/simulation/foils.js)

## Foilkraft og massebevægelse

`foilElement` projicerer den relative vandhastighed i planet mellem korde og normal. Det samme plan leverer angrebsvinkel, dynamisk tryk, løft og profilmodstand. Ren strøm langs spændvidden giver nul kraft i den polar. Modstand langs spændvidden og kavitation er endnu ikke modelleret. `foilFlapTarget` vender den samme kraftberegning, inklusive modstandens lodrette bidrag. Ved flere mulige løsninger vælges grenen nærmest den aktuelle flap. Hvis kraften ligger uden for flapvandringen, logges mætning. Begge foilregulatorer bruger den samme inversion til deres kapacitetskontroller.

| Indløb i m/s, korde / spænd / normal | Flap før → efter | Lodret kraft før → efter |
|---|---:|---:|
| +3 / 0 / 0 | +2,157° → +2,157° | +1.000 → +1.000 N |
| −3 / 0 / 0 | +18° → −2,157° | −5.240 → +1.000 N |
| −3 / 0 / +0,000001 | +18° → −2,157° | −5.240 → +1.000 N |
| −3 / 0 / −0,000001 | −10° → −2,157° | +4.069 → +1.000 N |
| +3 / +6 / 0 | +0,428° → +2,157° | +1.000 → +1.000 N |
| −3 / +6 / +0,3 | +18° → −7,869° | −17.451 → +1.000 N |
| 0 / +6 / 0 | +4,605° → 0° | 0 → 0 N, mættet |

Hver række anmoder om +1.000 N på en vandret AC72-flade på 1 m², fuldt neddykket og uden ventilation. Kræfterne er evalueret ved målflappen. De dynamiske prøver logger både faktisk flap, mål, kraft og løft. Når et mål på +30 kN forsøges ved +3 m/s, kan fladen højst levere +5,24 kN i testen. Ved 12 m/s vind og 9 m/s indgangsfart løftede begge foilbåde, drejede på rorinput og fik skrogkontakt igen efter slæk og aftagende vind. Maksimal frihøjde før/efter var 0,70/0,74 m for monohullen og 0,91/0,92 m for katamaranen. Forsøgene fra nul fart i datasættet bruger en separat vind på 16 m/s.

`integrateMass` flytter drivkraft og momenter til det aktuelle tyngdepunkt. Laserens symmetriske vandblok for tværbevægelse og drejning transporteres nu som lineær impuls og impulsmoment, mens bådens akser drejer. Under den isolerede prøve med fast neddykning og ingen ydre kræfter faldt maksimal energifejl over otte sekunder fra **465 J til 0,018 J** ved 60 Hz og til **0,0042 J** ved 120 Hz. Ændringen i rummets samlede impulsmoment faldt fra ca. 3.550 til under 2 × 10⁻¹¹ kg·m²/s. Den medbevægende vandmasse bruges kun i Laserens inerti og ændrer hverken skrogets vægt eller opdrift. Den lokale bølgeacceleration og skrog-, sværd- og rormodstand har fortsat egne led. Når de våde arealer ændrer sig, beregnes blokken på ny pr. trin. Energitesten dækker fast geometri og fast middelstrøm. [Fossens marine bevægelsesmodel](https://www.fossen.biz/html/marineCraftModel.html)

Besætning, foilarme og bom bidrager med det relative impulsmoment. Den interne bomreaktion indgår gennem denne transport, mens sejlets ydre moment optræder én gang. I scenarier uden ydre moment faldt restimpulsmomentet fra ca. 26,5, 7.863 og 4,8 kg·m²/s for henholdsvis Laserbesætning, AC75-arm og Laserbom til under 3 × 10⁻¹¹. Skrogets modreaktion nåede henholdsvis ca. 7,3, 4,6 og 1,3°/s. Armens hydrodynamiske kraft bruger stadig dens hastighed gennem vandet, mens kroppen flyttes med sin fysiske ledgeometri. Prøverne omfatter én bevægelse ad gangen og dokumenterer bevarelse i den isolerede model.

I de fem vægtprøver på fladt vand lå den fulde forskydning mellem frem og agter ved ca. 0,86, 1,27, 1,70, 1,10 og 1,00 m for besætningens tyngdepunkt i bådens rækkefølge. Den fysiske vægt flyttede gradvist, og det bestilte sidemål bestod, da input gik tilbage til neutral. Den aftagende hældningsreaktion på de tunge både har en anden størrelsesorden end jollens. Data indeholder position, krængning og pitch over manøvren.

## Sejl og sø

- **Skøde.** Ved via spillets konvertering at gå fra 88 % til 0 % gik intern vandring fra 0,97504 til 0. Mekanisk grænse ved 0 % var 86°. I Laser-prøverne sluttede den faktiske bom ved 32,6°, 64,2° og 86° efter fem sekunder fra henholdsvis 46°, 90° og 176° stævn i forhold til nordenvind. Fremkraften var ca. −5,4, −2,9 og +28,6 N under de tre forhold. Slæk giver altså både en bom, der følger den relative vind, og fremdrift, når sejlet stadig står mod vinden agterfra.
- **Reb og ekstra forsejl.** Browseren kontrollerede fysisk areal og rendergeometri på alle fem både. På Turbåd 43 ændrede to reb storsejlet fra 48 til 26,88 m² og sænkede trykpunktet i prøven fra 7,80 til 5,25 m. Den valgte mindre fok gik fra 32 til 18,56 m². Storsejl, fok og ekstra forsejl følges særskilt gennem deres kraft og krængningsmoment. Code 0, gennaker og spiler målte henholdsvis 90, 105 og 115 m² ved fuld hejs og deres egne kurser. Den faste katamaranvinge beholder sit areal og reducerer flapvirkning og fokareal i hårdvindsindstillingen. Projektionen på sejlplanet er bevaret.
- **Bølger.** `waveHeight` styrer den signifikante højde af det lange system ved åben reference. `chop` styrer kort sø og gør samtidig de lange bølger kortere, stejlere og mere retningsspredte. Et gemt `waves`-felt kunne tidligere vælge den ældre model, selv når begge nye felter var til stede. De moderne felter vinder nu ved indlæsning, i fysik og grafik og i den normaliserede lobbytilstand. Numeriske `waves`-prøver kan stadig køres ved at angive udelukkende den ældre værdi.
- **Tegnet vand.** Ved samme tidspunkt var største CPU/GPU-forskel ved de valgte punkter 1,14 cm. Ved skroget gav det tegnede lav- og højopløselige net højst ca. 3,2 og 1,3 mm afvigelse i den særskilte lokale prøve. En enkelt 2,5 m bølge havde 1,25 m amplitude. Forskellig bølgehøjde ved stævn og agterende gav målbar stampning. Pause viser straks bådens frosne tilstand. To browserklienter brugte samme bølgefrø, udvikling og faser i en fælles lobby. Værten så også gæstens to sidevalg, valgte stilling og rebning til 26,88 m². Særskilte browserprøver viste gæstens gennaker og spiler hos værten samt nedtagning og genåbning af fokken.

Målt over 180 sekunder ved 5 m/s vind fra vest. Tallene er lokal Hs i meter. Feltet ved det brede farvand er stadig dæmpet af spillets læ og frie vandstrækning. Referencen uden læ viser den fulde målindstilling.

| Bølger / chop | Åben reference | Bredt farvand, 17,5 m dybt | Ved kysten, 8,5 m dybt |
|---|---:|---:|---:|
| 0 m / 0 % | 0,000 | 0,000 | 0,000 |
| 0 m / 100 % | 0,402 | 0,115 | 0,019 |
| 2,5 m / 0 % | 2,485 | 0,953 | 0,457 |
| 2,5 m / 100 % | 2,570 | 1,038 | 0,483 |

Med den gamle `waves: 0.85` samtidig gav førversionen ca. 0,113 m i alle fire kombinationer ved det brede farvand. Efterversionen giver tabellens fire forskellige resultater med og uden den gamle værdi. Én browserprøve nåede anvendt 2,49 m og fuldt chop ca. 1,8 simulerede sekunder efter ændringen.

## Designgrundlag og kalibrering

27 gentagne sejladsprøver pr. revision bruger effektiv profil, samme start, ror-/trimprogram og simuleret tid. Fysikken bestemmer fart, krængning og kurs undervejs. Stabilitetskriteriet kræver to på hinanden følgende vinduer på otte sekunder, lave variationer og evne til at holde kursen. Halvvind ved 7 m/s på fladt vand er det sammenlignelige stabile punkt for samtlige fem profiler. Position 3 påvirker balancen gennem kroppens placering, tyngdepunkt og inerti.

| Båd | Fart gennem vand før → efter | Krængning efter | Afdrift efter | Designgrundlag |
|---|---:|---:|---:|---|
| Laserjolle | 8,35 → 8,32 kn | −2,0° | 0,5° | ILCA 7, 4,23 m, 143 kg inklusive sejler, 7,06 m² |
| Racer 32 | 8,91 → 8,91 kn | 9,2° | 1,0° | Fiktiv sportskølbåd, 9,75 m, 2,2 t, 55 m², tre i besætningen |
| Turbåd 43 | 5,87 → 5,87 kn | 9,4° | 1,8° | Fiktiv 13,10 m turbåd, 9,6 t, 80 m² |
| Foilmonohull | 12,65 → 12,43 kn | 0,6° | 0,4° | AC75-inspireret, modelskrog 20,7 m, 6,9 t, 230 m² |
| Foilkatamaran | 17,25 → 17,27 kn | 0,0° | 1,9° | AC72-inspireret, 22 m, 6,9 t, 260 m² |

I de korte rorpar startede alle både ved 0,8 m/s på halvvind. En gren holdt ror neutralt, mens den anden gav 45 % analogt ror fra sekund 4 til 5 og derefter neutraliserede. Data gemmer fart, kurs, rormoment og forskellen til den upåvirkede gren på begge halser. Ved afsluttet rortryk var forskellen i fart højst ca. 0,03 knob i den viste halvvindsretning efter rettelsen. Kursbidraget ved sekund 8 spændte fra ca. 1,2° for Laser og Turbåd til 3,4° for Racer. Laseren kæntrede allerede omkring det første rortryk i førforløbet på den viste hals. Der var fortsat store forskelle i fart og krængning mellem bådene efter fire sekunders acceleration.

- **Laser.** På kurs 50° til sand vind gav efterprøven 5,12 og 5,49 kn ved henholdsvis 9 og 12 kn vind. Målekurverne gengivet af Day giver ca. 5,2 og 5,6 kn med ca. 0,1–0,2 kn aflæsningsusikkerhed og sparsom information om last og sø. Afdrift og manøvredynamik er utilstrækkeligt dækket af de to punkter. Ved 7 m/s på 50° kæntrede jollen i både før- og efterprøven med det faste kontrolprogram. På næsten mod-, tværs- og medsø målte efterprøven 5,75, 8,34 og 6,91 kn. Den målte NTNU-serie er en relevant separat manøvrereference med andre indgangshastigheder og andre vindforhold. [Day, figur 4–5](https://pure.strath.ac.uk/ws/portalfiles/portal/64217569/Day_OE_2017_Performance_prediction_for_sailing_dinghies.pdf) · [NTNU, tabeller 1–2](https://www.mdpi.com/2076-3417/15/15/8629)
- **Racer 32.** ORC's Melges 32 er et design- og beregningsgrundlag. Spillets last, sejlplan og tre personer i trapez afviger fra klassebåden. [ORC, Melges 32](https://data.orc.org/public/od/2022/melg32.od.html?nav=1)
- **Turbåd 43.** Oceanis 43 giver en størrelsesreference på 13,10 × 4,12 m og 8,875 t tørvægt. Hallberg-Rassy 43 Mk II viser et tungere alternativ med 12,7 t deplacement og 95,1 m² arbejdssejl. TACKs vægt er inklusive besætning og kan derfor ikke sammenlignes direkte med tørvægten. [Bénéteau, Oceanis 43](https://www.beneteau.com/en-us/oceanis-2005-2014/oceanis-43) · [Hallberg-Rassy, 43 Mk II](https://www.hallberg-rassy.com/fileadmin/data/yachts/hallberg-rassy_43_mk_ii/downloads/HR43MkIITeknBesk.pdf)
- **Foilbådene.** Klasse- og teammaterialet begrunder cantarme på monohullen og stiv vinge på katamaranen. Det publicerede teknologimateriale rummer ingen tilsvarende måleserie for denne rigs flyvehøjde, lavfartsror, takeoff eller touchdown. Disse punkter er fortsat spilkalibrering. [Luna Rossa, AC75](https://lunarossa-challenge.americascup.com/en/news/785_THE-DESIGN-AND-CONSTRUCTION-OF-THE-AC75) · [Emirates Team New Zealand, AC72](https://emirates-team-new-zealand.americascup.com/en/news/378_THE-UNTOLD-STORY-OF-THE-BIRTH-OF-FOILING-IN-THE-AMERICA-S-CUP.html)

De største åbne spørgsmål er Laserens begrænsede rorgreb i meget hård vind, AC72'ens langsomme drejning på samme bomside og manglende målinger af de fire større bådes fulde kraftbalance. Mætning af flapvandringen er målt i de isolerede prøver og logges under manøvrer. Den automatiske lastfordeler optimerer fortsat for en forenklet hydrodynamik. Desuden kræver planing, sejl i sø og tværstrøm separate feltmålinger, før de kan kaldes kalibreret på virkelige både.

## Gentag prøverne

61 automatiske Node-tests og TypeScript-kontrollen består. Browserprøverne omfatter begge Laser-halse, touch, 0 % skøde, rebning på alle fem både, foilmanøvrer, GPU-vand og to lokale klienter.

```sh
npm test
npm run check:simulation
node scripts/model-corrections.cjs . forces
node scripts/model-corrections.cjs . waves
node scripts/model-corrections.cjs . weights
node scripts/model-corrections.cjs . helm
node scripts/model-corrections.cjs .
node scripts/model-corrections.cjs . calibration
TACK_URL=http://localhost:4196/ TACK_TRACE=1 npx playwright test tests/difficulty.test.js --workers=1
TACK_URL=http://localhost:4196/ npx playwright test tests/waves.test.js tests/waves-network.test.js tests/sail-state.test.js tests/trim.test.js tests/foil-respons.test.js --workers=1
TACK_URL=http://localhost:4196/ npx playwright test tests/turbaad-sejl.test.js tests/spinnaker-network.test.js --workers=1
```

Som første argument kan scriptet få et førcheckout. Den lokale, arkiverede førkilde ligger i `/tmp/tack-model-fix/baseline`. JSON-rapporten gemmer før- og efterdata uafhængigt af den midlertidige mappe. De korte vindøjeprøver og tastetimingen ligger i Playwright-testen. Testene bruger eksisterende ror, skøde og valgene 1–3, Q/E. Simulatoren bruger trin på 1/60 s. Browserindsættelse bruges til at genskabe den omtrentlige starttilstand, hvorefter kun input og testvejr ændres.
