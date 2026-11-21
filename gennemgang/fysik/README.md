# TACK · Bådfysik og sejlprøver

Åbn [TACK på localhost](http://localhost:4173/) og vælg **Fri sejlads**. På **Svær** flytter pilene roret. Brug **1–3** til vægten på tværs og **Z/X** til vægten langs båden. På Turbåd 43 kan du vælge storsejl, fok eller ekstra forsejl under **Detaljer**. Samme trimskyder og piletaster styrer det valgte sejl. Her kan du også vælge reb og mindre fok. På **Let** koordinerer trimskyderen sejlene, og besætningen flytter sig automatisk.

## Fysiske bådprofiler

[Bådprofilerne](baadprofiler.json) er eksporteret fra den konfiguration, som browseren kører. De indeholder skrogsektioner, masser og positioner for komponenter, tyngdepunkt, inertier om tyngdepunktet i hvile, opdrift, våd skrogflade, vandlinje, appendager og rig. Vandlinjelængden i tabellen er beregnet ved opretstående ligevægt med besætningen inde.

| Båd | Længde × bredde / vandlinje, m | Skrog + rig + udstyr, kg | Ballast / foilarme, kg | Besætning, kg | Sejlklar, kg | Arbejdssejl, m² |
|---|---:|---:|---:|---:|---:|---:|
| Laserjolle | 4,23 × 1,37 / 3,58 | 56 + 10 + 2 | 0 / 0 | 1 × 75 | 143 | 7,06 |
| Racer 32 | 9,75 × 3,10 / 8,76 | 880 + 150 + 170 | 760 / 0 | 2 × 80 | 2.120 | 38 + 24 |
| Turbåd 43 | 13,10 × 4,05 / 12,26 | 5.200 + 400 + 900 | 2.800 / 0 | 4 × 75 | 9.600 | 48 + 32 |
| Foilmonohull | 20,70 × 5,00 / 16,25 | 2.890 + 500 + 260 | 0 / 2.530 | 8 × 90 | 6.900 | 165 + 65 |
| Foilkatamaran | 22,00 × 14,00 / 20,24 | 3.260 + 900 + 1.150 | 0 / 600 | 11 × 90 | 6.900 | 205 + 55 |

- **Laserjolle.** ILCA 7 danner grundlag for mål og rig. De nominelle 58 kg med beslag er repræsenteret som 56 kg skrog og 2 kg beslag. De øvrige 10 kg om bord og sejlerens 75 kg er anslået. Vandlinjen i klassens specifikation er ca. 3,81 m, og denne referenceværdi bruges i Froude-tallet. Det uballasterede sværd er 0,245 m² og roret 0,075 m². [ILCA-regler](https://ilcasailing.org/ilca-class-rules/) · [ILCA-håndbog](https://ilcasailing.org/laserinternational/wp-content/uploads/2025/02/HANDBOOK-2025.pdf)
- **Racer 32.** Fiktiv performancebåd med trapez og to ror på hver 0,28 m². De historiske 2.600 kg omfattede 1.100 kg skrog, 190 kg rig, 250 kg udstyr, 900 kg ballast og 160 kg besætning. De 2.200 kg i førmålingen var samme hardware på 1.960 kg med tre sejlere. Med to sejlere og samme hardware inklusive ballast er den sejlklare masse nu 2.120 kg. Melges 32 har lignende mål, men ORC-certifikatet anfører 1.714 kg deplacement som selvstændig målepost og 472–629 kg besætning. J/99 er også sammenlignelig i længden og er væsentligt tungere. Modstand, kølareal, trapez og massefordeling er spilparametre. [ORC Melges 32](https://data.orc.org/public/od/2022/melg32.od.html?nav=1) · [J/99 specifikation](https://jboats.com/spectables/j99_spec.html)
- **Turbåd 43.** Fiktiv cruisingbåd. En Hallberg-Rassy 43 Mk II er 13,57 m med 12,7 t oplyst deplacement, 4,5 t blykøl og 95,1 m² med arbejdsfok. Spillets lettere reference har 9,6 t inklusive besætning, 2,8 t ballast og 80 m² arbejdssejl. Bjærgede sejl forbliver om bord i den samlede udstyrslast. [Hallberg-Rassy 43 Mk II](https://www.hallberg-rassy.com/fileadmin/data/yachts/hallberg-rassy_43_mk_ii/downloads/HR43MkIITeknBesk.pdf)
- **Foilbådene.** Form, massefordeling, undervandsarealer og styreflader er spiltilpasninger. Monohullens to synlige lag udgør ét storsejl. Katamaranen har to adskilte skrog, en strukturel vingeflap, to foils og to ror. Vingens dele deler det samme areal på 205 m², og fokken har 55 m².

## Kræfter og styring

Komponenter bruger lokale skrogkoordinater med x fremad, y op og z mod styrbord. Alle fysiske beregninger bruger SI-enheder, og fart konverteres til knob i visningen. Sejl og appendager bruger relativ luft- eller vandstrøm ved deres kraftpunkt. Punkthastigheden indeholder translation samt rulning, stampning og drejning. Storsejlets sektioner medtager også bommens bevægelse. Fart gennem vandet refererer til middelstrømmen, mens undervandsdelene også mærker bølgeorbitalerne.

Opdriften summeres over neddykkede volumenceller og fordeles efter skrogform og vandlinje. Ballastens vægt indgår gennem dens massepunkt. Dens fortrængte volumen bidrager til opdrift. Besætningens aktuelle led eller arbejdspladser bruges til både bevægelse og vægtberegning. På foilbådene kan besætningen flytte sig 15 cm frem eller tilbage inden for arbejdspladserne. Begge bevægelser er afprøvet for fysisk trim og synlig position. Kræfter og momenter opgøres ved skrogoprindelsen, transformeres til det aktuelle tyngdepunkt til integration og transformeres tilbage til skrogets tilstand til kontakt, rendering og netværk. Modellen bruger diagonale inertier med parallelaksekorrektion. Produkter af inerti, fuldt vinkelmoment fra individuelle led og en koblet matrix for hydrodynamisk medbevæget masse er endnu åbne modelbegrænsninger. [MIT om hydrostatik](https://ocw.mit.edu/courses/2-019-design-of-ocean-systems-spring-2011/f0cc4e483a7d4b78760f9b0908f51c44_MIT2_019S11_HydStr1.pdf)

Den konventionelle modstandsmodel skelner mellem skindfriktion, skrogets bølgemodstand, trykmodstand ved afdrift, appendagernes profil- og løftinducerede modstand og planing. Ror og køl/sværd integreres i vanddybden. Racerens ror har hver sin strøm og neddykning. På Svær bevæges roret med begrænset hastighed, og rorets egne kræfter drejer båden. Rorvirkningen afhænger af det neddykkede areal og strømmen, også når strømmen vender. Let har et særskilt hjælpemoment. Åbn udviklervisningen med tasten til venstre for **1** (`Backquote`) for at se kræfter i N og momenter i Nm fra sejl, skrog, appendager, opdrift, vægt, bølger og hjælp.

Turbåd 43 får separat areal, trim, trykcenter, fyldning og kraft pr. sejl. Ét reb skalerer storsejlet til 37,44 m², to reb til 27,84 m². Lille fok bruger 18,56 m². Code 0, gennaker og spiler bruger nominelt 90, 105 og 115 m². Ved sejlskift ændres de aktive arealer gennem en gradvis sætning eller bjærgning. På Svær bliver et valgt ekstra sejl siddende og kan miste trykket ved en kursændring. Koordinater, polarkoefficienter, tredelingen af det bløde storsejl og ét repræsentativt kraftpunkt på forsejl og foilrigge er modellerede. [NASA om løft og koefficienter](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/lift-equation/)

CPU og GPU deler bølgefelt, tid, dybde og kystlæ. Lange bølger anvender dybdeafhængig dispersion. Bølgefrontens udbredelse er adskilt fra vandets lokale partikelhastighed. Den vandrette bølgepåvirkning kommer fra accelerationen af det fortrængte vand. Laser og Racer bruger lokal dynamisk skrogstøtte, som ændrer våd flade og egen bølgemodstand ved planing. Foilbådenes højderegulering virker gennem begrænsede flap- og armbevægelser. Bølger kan fortsætte ind i læ og dæmpes gennem det samme vind- og fetchgrundlag. Vanddybden er en spilmodel. Kystudsnittet omkring Faaborg bruger lokale meter som beskrevet i [projektets kortgennemgang](../../README.md#det-sydfynske-øhav-omkring-faaborg). [MIT om bølgeudbredelse og vandbevægelser](https://web.mit.edu/fluids-modules/www/potential_flows/LecturesHTML/lec19/n6.html) · [Læprøver](../lae/README.md)

Den almindelige version har automatisk opretning med en tidsfrist på 4,45 sekunder i det aktive spil. [Fysikprøven uden opretningshjælp](http://localhost:4173/?fysik=uden-opretning) lader båden fortsætte under de fysiske kræfter. Her kan **R** starte forfra. Det gør det muligt at undersøge forskellen mellem selvopretning i en ballastkølbåd og en vedvarende kæntring i en jolle eller katamaran.

## Målinger før og efter

[Førdata](kalibrering-foer.json) kommer fra commit `a680af3`, frontend `38f101955462`, konfiguration `b73365fd6de0e5af`. [Efterdata](kalibrering.json) kommer fra den kørende frontend `9e8258064c13`, konfiguration `c59895f3c9f34ef5`. Begge har 154 forløb, heraf 120 kombinationer af båd, 4/7/9 m/s, fire kurser og begge halser med standardrig. Prøverne starter uden strøm, pust, læ og bølger, medmindre forløbet omhandler en af dem. Trim og besætningsvalg er tilpasset båd og kurs. Styrepiloten bruger begrænset rorinput. Førudgaven gav stadig et hjælpemoment i samme kontroltilstand, og det fremgår af datafelterne. Måleforløbene ændrer kun kontrolinput eller testvejret efter start.

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

Roret kom op på ca. 19–20°. Bommen passerede ca. 2,5 sekunder efter rorinput, og den mindste samplede afstand fra sejlerens hoved til bommen var ca. 0,22 m. Besætningens indgang i båden, dukning, passage og eventuelle udgang til fuldt hæng er kontrolleret med begge halser i `tests/manoeuvres.test.js`. Med samme testinput og en halvering af tidssteppet gennemførte jollen stadig. Den målte NTNU-serie havde 12 stagvendinger i 9,2 ± 0,75 m/s. Deres indgangsfart over grunden var 2,1–2,7 m/s, og 80 % af farten blev genopnået efter 6,5–8,7 s. Spilprøven har højere indgangsfart, roligt vand og konstant vind. Manøvretiden er derfor foreløbigt kalibreret. [NTNU, tabel 1–2](https://www.mdpi.com/2076-3417/15/15/8629)

- **Halvvind fra stilstand ved 9 m/s.** Fast trim og fuldt hæng fra begyndelsen gav kæntring på begge halser. I kontrolforløbet startede besætningen inde med 30 % trim og ventede med 61 % trim og fuldt hæng, til farten oversteg 2,6 m/s. Begge halser sluttede omkring 9,42 knob, med højst 12,43° målt krængning og omtrent 6° vedvarende kursafvigelse for det anvendte rorprogram. Førmodellen med styrehjælp sluttede på 9,71 knob.
- **Pust.** Vinden voksede fra 8 til 12 m/s over 0,5 s, lå på 12 m/s i 3 s og faldt over 0,5 s. Skødet blev slækket efter 1,25 s fra pustets begyndelse, og besætningen flyttede ind, da pustet sluttede. Jollen holdt sig oprejst og sluttede på 8,36 knob. Samme prøve uden de to reaktioner kæntrede 20,82 s inde i forløbet.
- **Sø og surf.** Ved 7 m/s og 0,50 m målbølge var den afsluttende vinduesmiddelværdi 6,09 knob i næsten modsø, 8,26 i tværsø og 7,10 i medsø. I den isolerede bølgefaseprøve fra samme indgangsfart var farten efter to sekunder 11,79 knob på forsiden, 7,42 på fladt vand og 5,35 med bagfasen som start. Forsiden gav ca. 65 N vandret bølgebidrag ved det punkt. Farten over grunden var henholdsvis 11,31, 7,42 og 5,46 knob efter de samme to sekunder. Bagfaseprøven mistede yderligere fart og sluttede på 3,86 knob over grunden. Kontrollen på fladt vand kæntrede efter 4,20 s, så sammenligningen af fase er taget inden da. `tests/surf.test.js` kontrollerer også aftagende fart efter passage i et længere forløb.

### Racer 32 og Turbåd 43

Ved 8 m/s på halvvind gav Racerens skift fra position 2 til position 3 et besætningsmoment på ca. 2,62 kNm mod ca. 0,64 kNm lige før skiftet. Mellem 11,75 og 30 s faldt krængningen fra 28,82° til 26,25°, og farten steg fra 10,66 til 11,15 knob. En parvis prøve fra samme startlast med fast position 2 eller 3 bekræfter bedre fart og mindre krængning i trapez. Den stabile fartfordel over Laserjollen var 2,41 knob på halvvind ved 7 m/s. For samme kurs ved 14 knobs vind forudsiger Melges 32-certifikatet 9,43 knob. Det er en **VPP-forudsigelse**, og spilbåden er stadig ca. 1,25 knob hurtigere i denne sammenligning med forskellig last, rig og rorbelastning. [ORC Melges 32](https://data.orc.org/public/od/2022/melg32.od.html?nav=1) · [ORC om VPP](https://orc.org/organization/velocity-prediction-program-vpp)

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

De automatiske kontroller omfatter konstant besætningsmasse, massepunkt og animation, lukkede kraft- og momentregnskaber, ror uden ekstra moment på Svær, større vådt appendageareal, rorvirkning ved bakning og strøm omkring en stationær båd, drift i stille vand, vindretning og pile på alle fire verdenshjørner, fast simulationstrin ved 30/60/120 renderinger pr. sekund, CPU/GPU-bølger, kystlæ og manøvrer. To separate liveklienter kontrollerer autoritativt skøde, rebning, lille fok, ekstra sejl og fjernbådens viste rig og besætning. Revisionen vises under **Detaljer → Model** og i HTTP-headeren `X-Fri-Vind-Revision`. De forskellige forhold mellem belastning, krængning og fart kan aflæses i [efterdataene](kalibrering.json).
