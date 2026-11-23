# TACK · Bådfysik og sejlprøver

Åbn [TACK på localhost](http://localhost:4173/) og vælg **Fri sejlads**. På **Svær** flytter pilene roret. Brug **1–3** til vægten på tværs og **Z/X** til vægten langs båden. På Turbåd 43 kan du vælge storsejl, fok eller ekstra forsejl under **Detaljer**. Samme trimskyder og piletaster styrer det valgte sejl. Her kan du også vælge reb og mindre fok. På **Let** koordinerer trimskyderen sejlene, og besætningen flytter sig automatisk.

Se [simulationens grænseflade, drejeprøver og ydelsesmålinger](simulation.md) for den selvstændige solver og motorvurderingen.

[Gennemgangen af styring og sejl til build d3ad41af49c9](styring.md) indeholder de aktuelle før/efter-forløb, browserbilleder og afgrænsninger for kalibreringen.

[Laserjollens sejltryk, krængning og vægtplacering](laser-balance.md) viser før- og eftermålinger for position 1–3, samt hvordan skrogmodstand og sejltryk nu beregnes ved krængning.

## Fysiske bådprofiler

[Bådprofilerne](baadprofiler.json) er eksporteret fra den konfiguration, som browseren kører. De indeholder skrogsektioner, masser og positioner for komponenter, tyngdepunkt, inertier om tyngdepunktet i hvile, opdrift, våd skrogflade, vandlinje, appendager og rig. Vandlinjelængden i tabellen er beregnet ved opretstående ligevægt med besætningen inde.

| Båd | Længde × bredde / vandlinje, m | Skrog + rig + udstyr, kg | Ballast / foilarme, kg | Besætning, kg | Sejlklar, kg | Arbejdssejl, m² |
|---|---:|---:|---:|---:|---:|---:|
| Laserjolle | 4,23 × 1,37 / 3,58 | 56 + 10 + 2 | 0 / 0 | 1 × 75 | 143 | 7,06 |
| Racer 32 | 9,75 × 3,10 / 8,78 | 880 + 150 + 170 | 760 / 0 | 3 × 80 | 2.200 | 35 + 20 |
| Turbåd 43 | 13,10 × 4,05 / 12,26 | 5.200 + 400 + 900 | 2.800 / 0 | 4 × 75 | 9.600 | 48 + 32 |
| Foilmonohull | 20,70 × 5,00 / 16,25 | 2.890 + 500 + 260 | 0 / 2.530 | 8 × 90 | 6.900 | 165 + 65 |
| Foilkatamaran | 22,00 × 14,00 / 20,24 | 3.260 + 900 + 1.150 | 0 / 600 | 11 × 90 | 6.900 | 205 + 55 |

- **Laserjolle.** ILCA 7 danner grundlag for mål og rig. De nominelle 58 kg med beslag er repræsenteret som 56 kg skrog og 2 kg beslag. De øvrige 10 kg om bord og sejlerens 75 kg er anslået. Vandlinjen i klassens specifikation er ca. 3,81 m, og denne referenceværdi bruges i Froude-tallet. Det uballasterede sværd er 0,245 m² og roret 0,075 m². [ILCA-regler](https://ilcasailing.org/ilca-class-rules/) · [ILCA-håndbog](https://ilcasailing.org/laserinternational/wp-content/uploads/2025/02/HANDBOOK-2025.pdf)
- **Racer 32.** Fiktiv performancebåd med tre sejlere i trapez og to ror på hver 0,31 m². Skrog, rig, udstyr og ballast vejer samlet 1.960 kg. Melges 32 har lignende mål. Dens ORC-certifikat anfører 1.714 kg deplacement som selvstændig målepost og 472–629 kg besætning. Racerens modstand, kølareal, trapez og massefordeling er spilparametre. [ORC Melges 32](https://data.orc.org/public/od/2022/melg32.od.html?nav=1)
- **Turbåd 43.** Fiktiv cruisingbåd. En Hallberg-Rassy 43 Mk II er 13,57 m med 12,7 t oplyst deplacement, 4,5 t blykøl og 95,1 m² med arbejdsfok. Spillets lettere reference har 9,6 t inklusive besætning, 2,8 t ballast og 80 m² arbejdssejl. Bjærgede sejl forbliver om bord i den samlede udstyrslast. [Hallberg-Rassy 43 Mk II](https://www.hallberg-rassy.com/fileadmin/data/yachts/hallberg-rassy_43_mk_ii/downloads/HR43MkIITeknBesk.pdf)
- **Foilbådene.** Form, massefordeling, undervandsarealer og styreflader er spiltilpasninger. Monohullens to synlige lag udgør ét storsejl. Katamaranen har to adskilte skrog, en strukturel vingeflap, to foils og to ror. Vingens dele deler det samme areal på 205 m², og fokken har 55 m².

## Kræfter og styring

Komponenter bruger lokale skrogkoordinater med x fremad, y op og z mod styrbord. Alle fysiske beregninger bruger SI-enheder, og fart konverteres til knob i visningen. Sejl og appendager bruger relativ luft- eller vandstrøm ved deres kraftpunkt. Punkthastigheden indeholder translation samt rulning, stampning og drejning. Storsejlets sektioner medtager også bommens bevægelse. Fart gennem vandet refererer til middelstrømmen, mens undervandsdelene også mærker bølgeorbitalerne.

Opdriften summeres over neddykkede volumenceller og fordeles efter skrogform og vandlinje. Ballastens massepunkt indgår i tyngdepunktet. Ballastens fortrængte volumen bidrager til opdrift. Besætningens aktuelle led eller arbejdspladser bruges til både animation og vægtberegning. Besætningerne kan flytte sig 55 cm hver vej på foilmonohullen og 50 cm på foilkatamaranen. Kræfter og momenter opgøres ved skrogoprindelsen og flyttes til det aktuelle tyngdepunkt før integrationen. Rotationen bruger inertitensoren med produkter af inerti og parallelaksekorrektion. Skrogets pose bruges derefter til kontakt, grafik og netværk. Individuelle leds relative impulsmomenter og en fuld hydrodynamisk inertimatrix kræver fortsat særskilt modellering. [MIT om hydrostatik](https://ocw.mit.edu/courses/2-019-design-of-ocean-systems-spring-2011/f0cc4e483a7d4b78760f9b0908f51c44_MIT2_019S11_HydStr1.pdf) · [Fossens fartøjsmodel](https://www.fossen.biz/html/marineCraftModel.html)

Den konventionelle modstandsmodel skelner mellem skindfriktion, skrogets bølgemodstand, trykmodstand ved afdrift, appendagernes profil- og løftinducerede modstand og planing. Ror og køl/sværd integreres i vanddybden. Racerens ror har hver sin strøm og neddykning. På begge niveauer bevæges roret med begrænset hastighed, og rorets kræfter afhænger af vandstrøm og neddykning. På Let flytter besætningen vægten automatisk, mens ror og skøde følger spillerens input. Sejlplan og foilernes højde- og flapstyring håndteres særskilt. Åbn udviklervisningen med tasten til venstre for **1** (`Backquote`) for at se kræfter i N og momenter i Nm fra sejl, skrog, appendager, opdrift, vægt, bølger og hjælp.

Foilbådenes rorudslag stiger gradvist, når skroget løfter sig. Det maksimale rorudslag før fartbegrænsning er 9° på vandet og 14° i flyvning for monohullen. Katamaranen bruger 7° og 13°. På Let øges det tilgængelige rorudslag ved lav fart med skroget i vandet, så spilleren får mere ror til at afslutte vendingen. Ved 12 m/s vind og fart gennem vandet omkring 28–31 knob gav ét sekund med fuld styrbord på Svær cirka 9,0° mod 4,4° før for monohullen og 7,5° mod 3,0° før for katamaranen. Vinklerne er målt i forhold til et forløb uden rorinput fra samme udgangspunkt i hver version. Delvist ror, modtryk og slip er også afprøvet på Let og Svær med 16 m/s vind og korte bølger.

Turbåd 43 får separat areal, trim, trykcenter, fyldning og kraft pr. sejl. Ét reb skalerer storsejlet til 37,44 m², to reb til 27,84 m². Lille fok bruger 18,56 m². Code 0, gennaker og spiler bruger nominelt 90, 105 og 115 m². Ved sejlskift ændres de aktive arealer gennem en gradvis sætning eller bjærgning. På Svær bliver et valgt ekstra sejl siddende og kan miste trykket ved en kursændring. Koordinater, polarkoefficienter, tredelingen af det bløde storsejl og ét repræsentativt kraftpunkt på forsejl og foilrigge er modellerede. [NASA om løft og koefficienter](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/lift-equation/)

CPU og GPU deler bølgefelt, tid, dybde og kystlæ. Lange bølger anvender dybdeafhængig dispersion. Bølgefrontens udbredelse er adskilt fra vandets lokale partikelhastighed. Den vandrette bølgepåvirkning kommer fra accelerationen af det fortrængte vand. Laser og Racer bruger lokal dynamisk skrogstøtte, som ændrer våd flade og egen bølgemodstand ved planing. Foilbådenes højderegulering virker gennem begrænsede flap- og armbevægelser. Bølger kan fortsætte ind i læ og dæmpes gennem det samme vind- og fetchgrundlag. Vanddybden er en spilmodel. Kystudsnittet omkring Faaborg bruger lokale meter som beskrevet i [projektets kortgennemgang](../../README.md#det-sydfynske-øhav-omkring-faaborg). [MIT om bølgeudbredelse og vandbevægelser](https://web.mit.edu/fluids-modules/www/potential_flows/LecturesHTML/lec19/n6.html) · [Læprøver](../lae/README.md)

Den almindelige version har automatisk opretning med en tidsfrist på 4,45 sekunder i det aktive spil. [Fysikprøven uden opretningshjælp](http://localhost:4173/?fysik=uden-opretning) lader båden fortsætte under de fysiske kræfter. Her kan **R** starte forfra. Det gør det muligt at undersøge forskellen mellem selvopretning i en ballastkølbåd og en vedvarende kæntring i en jolle eller katamaran.

## Målinger før og efter

[Førdata](kalibrering-foer.json) kommer fra commit `a680af3`, frontend `38f101955462`, konfiguration `b73365fd6de0e5af`. [Efterdata](kalibrering.json) kommer fra fysikbuildet `9e8258064c13`, konfiguration `c59895f3c9f34ef5`. Begge har 154 forløb, heraf 120 kombinationer af båd, 4/7/9 m/s, fire kurser og begge halser med standardrig. Prøverne starter uden strøm, pust, læ og bølger, medmindre forløbet omhandler en af dem. Trim og besætningsvalg er tilpasset båd og kurs. Styrepiloten bruger begrænset rorinput. Førudgaven gav stadig et hjælpemoment i samme kontroltilstand, og det fremgår af datafelterne. Måleforløbene ændrer kun kontrolinput eller testvejret efter start.

To på hinanden følgende otte sekunders vinduer skal have under 0,12 m/s forskel i gennemsnitsfart og under 2° i gennemsnitlig krængning og afdrift. Det sidste vindue skal desuden have under 0,18 m/s fartvariation målt som standardafvigelse, 2,5° krængningsvariation, 3° afdriftsvariation og 2°/s variation i drejning. Middeldrejningen skal være under 0,8°/s, og den resterende middelkursfejl under 7°. Rådata rummer middel, standardafvigelse, faktisk rorvinkel, separate fartreferencer, sejlareal, kræfter, last og status. Tidssteppet er 1/60 s, og længste grundprøve varer 180 simulerede sekunder. Af de 120 grundprøver opfyldte 96 kriterierne. 22 nåede tidsgrænsen, og to Laser-prøver kæntrede. Alle 154 forløb bestod kontrollen af endelige positioner, vinkler og hastigheder.

| Halvvind ved 7 m/s | Før, knob | Efter, knob | Efterstatus |
|---|---:|---:|---|
| Laserjolle | 8,36 | 8,27 | Stabil |
| Racer 32 | 12,52 | 10,68 | Stabil |
| Turbåd 43 | 6,43 | 7,85 | Stabil |
| Foilmonohull | 11,94 | 12,82 | Stabil |
| Foilkatamaran | 16,48 | 18,28 | Tidsgrænse. Middelkursen afveg 10° |

### Laserjolle

**Aflæst figur fra fuldskalamålinger.** På 50° kurs angiver Binns-kurverne i Day figur 4–5 ca. 5,2 knob ved 9 knobs vind og ca. 5,6 knob ved 12 knobs vind. Spillet gav før 5,13 og 5,56 knob og efter 5,25 og 5,64 knob med samme trim i før- og efterprøven. Aflæsningsusikkerheden er ca. 0,1–0,2 knob. Referencekurvernes sø-, måle- og lastforhold er kun delvis beskrevet. Aflæsningen bruges til disse to krydspunkter. Halvvind og planing kræver yderligere fuldskalamålinger. [Day, figur 4–5](https://pure.strath.ac.uk/ws/portalfiles/portal/64217569/Day_OE_2017_Performance_prediction_for_sailing_dinghies.pdf)

| Stagvending på Svær | Indgang, knob | Minimum, knob | Tid til vindøjet | Tid fra start til 80 % af indgangsfart |
|---|---:|---:|---:|---:|
| 8 m/s, begge halser | 6,20 | 3,75 | 2,50 s | 9,00 s |
| 9 m/s, begge halser | 6,72–6,73 | 3,90 | 2,25 s | 8,75 s |

Ved indhaling efter vending kunne det bagerste knæ springe omkring en halv meter på ét fysiktrin, når foden passerede næsten lodret under hoften. Tyngdepunktet fulgte med og gav et kort ryk i fart, skrogkræfter og relativ vind. Under krydsningen beregnes knæets bøjeretning nu ud fra benets placering. I prøven ved 7,9 m/s fra syd, position 2 og indhaling til 88 % faldt det største trin i sejlets krængningsmoment fra ca. 335 til 33 Nm på vej ud af en vending mod 46° til vinden. Jollen byggede fart fra ca. 4,2 til 5,9 knob og holdt sig oprejst på begge halser. En separat prøve mod 12° til vinden viste det forventede farttab uden det tidligere lastspring.

Roret kom op på ca. 19–20°. Bommen passerede ca. 2,5 sekunder efter rorinput, og den mindste samplede afstand fra sejlerens hoved til bommen var ca. 0,22 m. Besætningens indgang i båden, dukning, passage og eventuelle udgang til fuldt hæng er kontrolleret med begge halser i `tests/manoeuvres.test.js`. Med samme testinput og en halvering af tidssteppet gennemførte jollen stadig. Den målte NTNU-serie havde 12 stagvendinger i 9,2 ± 0,75 m/s. Deres indgangsfart over grunden var 2,1–2,7 m/s, og 80 % af farten blev genopnået efter 6,5–8,7 s. Spilprøven har højere indgangsfart, roligt vand og konstant vind. Manøvretiden er derfor foreløbigt kalibreret. [NTNU, tabel 1–2](https://www.mdpi.com/2076-3417/15/15/8629)

- **Halvvind fra stilstand ved 9 m/s.** Fast trim og fuldt hæng fra begyndelsen gav kæntring på begge halser. I kontrolforløbet startede besætningen inde med 30 % trim og ventede med 61 % trim og fuldt hæng, til farten oversteg 2,6 m/s. Begge halser sluttede omkring 9,42 knob, med højst 12,43° målt krængning og omtrent 6° vedvarende kursafvigelse for det anvendte rorprogram. Førmodellen med styrehjælp sluttede på 9,71 knob.
- **Pust.** Vinden voksede fra 8 til 12 m/s over 0,5 s, lå på 12 m/s i 3 s og faldt over 0,5 s. Skødet blev slækket efter 1,25 s fra pustets begyndelse, og besætningen flyttede ind, da pustet sluttede. Jollen holdt sig oprejst og sluttede på 8,36 knob. Samme prøve uden de to reaktioner kæntrede 20,82 s inde i forløbet.
- **Sø og surf.** Ved 7 m/s og 0,50 m målbølge var den afsluttende vinduesmiddelværdi 6,09 knob i næsten modsø, 8,26 i tværsø og 7,10 i medsø. I den isolerede bølgefaseprøve fra samme indgangsfart var farten efter to sekunder 11,79 knob på forsiden, 7,42 på fladt vand og 5,35 med bagfasen som start. Forsiden gav ca. 65 N vandret bølgebidrag ved det punkt. Farten over grunden var henholdsvis 11,31, 7,42 og 5,46 knob efter de samme to sekunder. Bagfaseprøven mistede yderligere fart og sluttede på 3,86 knob over grunden. Kontrollen på fladt vand kæntrede efter 4,20 s, så sammenligningen af fase er taget inden da. `tests/surf.test.js` kontrollerer også aftagende fart efter passage i et længere forløb.

### Racer 32 og Turbåd 43

Ved 10 m/s fra syd, fladt vand og 65 % skøde blev position 1 og 3 valgt fra samme starttilstand på halvvind. Efter seks sekunder havde Turbåd 43 henholdsvis 20,6° og 17,5° krængning. Besætningens samlede tyngdepunkt flytter sig fra 0,12 m til 1,76 m fra centerlinjen, når de fire personer går fra cockpittet til sidedækket. Samme prøve med Racer 32 gav 32,0° og 24,6° krængning samt 11,36 og 12,35 knob. Målingerne brugte samme styreprogram, som korrigerede mod den oprindelige kurs.

Racerens planingsløft fordeles nu på den lokale, våde del af bunden. I en isoleret prøve med 57° krængning og 10 m/s fart gav den neddykkede side ca. 4,2 kN støtte og 2,2 kNm mod krængningen, med samme størrelse på begge halser. Prøven brugte 2° positiv trimvinkel i fladt vand. [Forsøgsstudie om trykfordeling ved asymmetrisk planing](https://www.sciencedirect.com/science/article/pii/S0141118719305395)

Et særskilt Racer-forløb startede ved kurs 127°, 19,44 knob, 57° krængning, 2° positiv trimvinkel og 12,8 m/s fra syd. Med 88 % skøde og samme styreprogram målte vi 49,9° krængning i position 1 mod 44,6° i position 3 efter seks sekunder.

Racer 32’s tre sejlere vejer 80 kg hver. Båden fortrænger 78 liter ekstra ved stilstand og ligger 6,7 mm dybere med den tredje sejler. I fuldt trapez står sejlerne med strakte ben mod rælingen og hænger lavere over vandet. Bådens samlede tyngdepunkt ligger ca. 26 cm til luv for centerlinjen ved vandret skrog. Besætningen giver her 5,71 kNm modvægt mod tidligere 5,39 kNm med samme besætning og en kortere trapezstilling.

På kurs 138° med 12,1 m/s fra syd, fladt vand og 88 % skøde sammenlignede vi to forløb fra samme starttilstand på Svær. Efter fem sekunder havde båden i trapez 35,3° krængning og 9,85 knob mod 39,6° og 9,48 knob på kanten. Begge forløb brugte samme skøde og målkurs. Storsejlets top vrider sig mere under stort sejltryk.

På halvvind ved 10 m/s målte vi de sidste otte sekunder af et 29 sekunders forløb på Svær med 58 % skøde, fladt vand og styreinput til den samme målkurs. Med tre sejlere faldt krængningen fra 26,5° på kanten til 20,7° i trapez, og fart gennem vandet steg fra 11,84 til 12,53 knob. Den tidligere model med to i trapez målte 25,6° og 12,18 knob under samme forhold. Sejlplanen er sænket og reduceret fra 62 til 55 m². Hurtigere slæk på Svær gør det muligt at tage trykket af, og de to længere rorblade drejer om hver deres akse. [North Sails om sejltrim på Melges 32](https://www.northsails.com/en-us/blogs/north-sails-blog/melges-32-tuning-guide)

Med korte bølger, bølgehøjde sat til 0,50 m og vindstød gennemførte Raceren en stagvending fra 55° på begge halser på Svær. Besætningen blev flyttet ind foran vendingen og ud i trapez igen bagefter. De ældre sammenligningstal i kalibreringsfilerne blev målt med den daværende rig og besætning.

Turbåd 43 ved 8 m/s accelererede fra 4,47 knob til 4,89 knob efter 2 s og 6,97 knob efter 11,75 s i håndteringsprøven. Efter ét reb og lille fok faldt krængningen fra ca. 11,8° til 7,0°. Storsejl og fok gik fra 48/32 m² til 37,44/18,56 m². Båden gennemførte også en stagvending ved 6 m/s. Ved 7 m/s blev Code 0, gennaker og spiler målt til henholdsvis 7,84, 7,41 og 6,58 knob på deres valgte kurser 90°, 125° og 162°. Areal og reaktion på trim er kontrolleret pr. sejl i browseren. De tre farttal er fra forskellige kurser.

### Foiling og kæntring

| Forløb fra stilstand ved 16 m/s | Løft før → efter | Fart ved løft efter | Frihøjde 12–23 s efter | Landing før → efter | Fart ved landing → ved 65 s efter |
|---|---:|---:|---:|---:|---:|
| Foilmonohull | 5,00 → 7,00 s | 22,07 knob | 0,60–0,80 m | 46,25 → 51,00 s | 12,89 → 4,20 knob |
| Foilkatamaran | 3,50 → 3,25 s | 19,41 knob | 0,50–0,83 m | 58,50 → 60,00 s | 8,22 → 5,19 knob |

Løft i tabellen er første registrerede tilstand `foiling`. Landingen er første registrerede kontakt med mindst 15 % vådt skrog efter vindfaldet. Piloten beder om en kursændring på 18° mellem 24 og 36 s. Ved 36 s slækkes sejlet, og vinden falder med 4 m/s pr. sekund til nul. De rapporterede flyvehøjder og kræfter kommer fra simulationsdata. Flere stærkvindsforløb med 16–20 m/s og bølger er kontrolleret særskilt. Flere stationære foilkurser nåede stadig tidsgrænsen, hovedsageligt med for stor middelkursfejl. Direkte ror i let vind og foilbådenes stationære ydelse kræver fortsat kalibrering.

I prøverne uden hjælp stillede de to kølbåde sig op igen efter den startkrængning, som hver prøve brugte. Laserjollen endte omkring 180°, og katamaranen omkring 102°. Monohullen kom næsten op igen, men spillets registrerede kæntringstilstand var stadig aktiv. Den assisterede browserprøve gav spillerkontrollen tilbage efter 3,12–4,42 s for alle fem både.

## Genskab målingerne

Fra projektroden med spillet kørende på [localhost:4173](http://localhost:4173/):

```sh
npm run build
FRI_VIND_URL=http://localhost:4173/ npm run measure:profiles
npm run measure:physics
npm run measure:physics -- --boat=laser --kind=tack --out=/tmp/tack-vending.json
npm run measure:physics -- --boat=laser --kind=beam-managed --out=/tmp/tack-halvvind.json
npm run measure:physics -- --boat=laser --kind=surf --out=/tmp/tack-surf.json
npm run measure:physics -- --boat=ac75 --kind=foil --out=/tmp/tack-foil-mono.json
npm run measure:physics -- --boat=ac72 --kind=foil --out=/tmp/tack-foil-kat.json
npm run test:physics
npm run test:turbaad
npm run test:foil-respons
npm run test:surf
```

Gentag førmålingen med `git archive a680af3 index.html assets` udpakket i en særskilt mappe. Brug `--url=file:///stien/til/udpakningen/index.html --revision=38f101955462 --out=/tmp/tack-foer.json` med det aktuelle måleprogram. Testerne bruger Chrome via Playwright. `CHROME_PATH` kan bruges til at vælge browser.

De automatiske kontroller omfatter konstant besætningsmasse, massepunkt og animation, lukkede kraft- og momentregnskaber, ror uden ekstra moment på begge niveauer, større vådt appendageareal, rorvirkning ved bakning og strøm omkring en stationær båd, drift i stille vand, vindretning og pile på alle fire verdenshjørner, fast simulationstrin ved 30/60/120 renderinger pr. sekund, CPU/GPU-bølger, kystlæ og manøvrer. To separate liveklienter kontrollerer autoritativt skøde, rebning, lille fok, ekstra sejl og fjernbådens viste rig og besætning. Revisionen vises under **Detaljer → Model** og i HTTP-headeren `X-Fri-Vind-Revision`. De forskellige forhold mellem belastning, krængning og fart kan aflæses i [efterdataene](kalibrering.json).


## Laserjollens sidegreb ved stor krængning

De tidligere modstandspunkter kunne alle ligge over vand, mens den lave skrogside fortsat var neddykket. Laserjollen beregner nu sideværts modstand ud fra det neddykkede sideareal ved tre skrogsektioner. Kraften modvirker den lokale sidefart og giver et moment om båden. Modstandskoefficienten 0,82 er en spiltilnærmelse. Ror og sværd bruger deres egen neddykning. [MIT om tværstrømsmodstand](https://ocw.mit.edu/courses/2-154-maneuvering-and-control-of-surface-and-underwater-vehicles-13-49-fall-2004/2609f8b1bdebe4566891080afe007f51_1349_notes.pdf#page=55)

I den aktuelle prøve med 35° startkrængning og 2,70 m/s sidefart i stille vand faldt sidefarten til cirka 1,00 m/s efter ét sekund. Under en særskilt krænget manøvre på begge halser gav roret igen styremoment, da det kom tilbage i vandet. Gentag prøverne med `npm run test:physics`.

## Laserjollens reaktion fra lav fart

Vandets træghed under sidebevægelse og drejning beregnes nu ud fra tre neddykkede skrogsektioner og den del af sværd og ror, der er under vand. Skrogsektionerne bruger et tilnærmet elliptisk tværsnit. Bladene bruger en tynd plade med begrænset spænd. Leddene kombineres om bådens aktuelle tyngdepunkt i en fælles beregning af side- og drejeacceleration. Vandets medbevægelige masse ændrer accelerationen. Opdriften afhænger fortsat af det fortrængte volumen. [MIT om medbevægelig vandmasse](https://ocw.mit.edu/courses/2-016-hydrodynamics-13-012-fall-2005/6124a1fd14e811d9ea753f85e0dfc8d0_2005reading6.pdf)

I en isoleret prøve fra stilstand, fladt vand og 8,5 m/s kom vinden ind 153° fra stævnen. Med 35 % trim og neutralt ror drejede jollen cirka 69° før og 62° efter rettelsen i de første to sekunder. Den højeste drejehastighed faldt fra cirka 50 til 45°/s. Vinden kan fortsat dreje jollen med ladet sejl og lidt vandstrøm om roret.

Længde på 4,23 m, bredde på 1,37 m og 7,06 m² sejl følger ILCA 7’s hovedmål. Skrogsektioner, våd flade, bladprofil og trykkoefficienter er tilnærmelser. Prøven sammenligner to versioner af spilsimulationen. En kalibrering af drejningen mod målinger på en fysisk ILCA mangler. [ILCA’s håndbog](https://ilcasailing.org/laserinternational/wp-content/uploads/2025/02/HANDBOOK-2025.pdf) · [ILCA’s måletegninger](https://ilcasailing.org/rules-and-technical/measurement-diagrams/)

## Styring og opstart

Se [gennemgangen af spilbarhed](spilbarhed.md) for fejlårsager, browserforløb og kommandoer til at gentage dem.

Se [efterprøvningen i Fri sejlads](efterproevning.md) for den nye før/efter-måling af Laserjollen, grundkontakt ved Faaborg og Bjørnø samt kontrol af sejlhjælpen på Turbåd 43.
