# TACK · Styring, vandkontakt og stagvendinger

[Spil build **cc17aeecc481** på localhost:4201](http://localhost:4201/). Førversionen er [49db10bed342 på localhost:4196](http://localhost:4196/). Begge stammer fra arbejdsgrenen `main` ved `f51d22035e0eb1dbd27249273f97c630e0217e39` med lokale ændringer. HTTP-headeren og spillets revisionsmærke identificerer hver build. [Starttilstande, spillerinput, effektive bådprofiler og målinger](styringsproever-data.json.gz)

## Konkrete rettelser

- **Laserens ror.** Beregningen brugte før en tilnærmet våd andel af hver strimmel og beregnede kraften ved hele strimlens midte. Midten kunne ligge tørt. `laserRudderContact` klipper nu det afrundede blad ved den lokale vandoverflades tangentplan for hver af fire strimler. Kraften beregnes med vandhastigheden ved den våde dels arealmidtpunkt. Fysikken og den tegnede kontur bruger samme bladprofil. Midtplanet har 0,1107 m² geometrisk areal. Nominelt areal på 0,105 m² bruges stadig til at skalere hydrodynamiske kræfter proportionalt med den våde andel. Stall og ventilation dæmper strømningen særskilt. [Bådgeometri](../../assets/simulation/boats.js) · [Vandkontakt og bladkræfter](../../assets/simulation/physics.js)
- **Laserens besætning.** Prognosen for bommens bane kunne før give et øjeblikkeligt skift i dukningen. Desuden kunne den næsten lodrette underarm skifte albuegren i ledmodellen. Ved en passage steg albuepunktets forskydning til ca. 0,59 m på ét trin. Dukkebevægelsen har nu begrænset hastighed og acceleration. Albuen beholder sin bøjeretning, når hånden passerer linjen gennem skulderen. Grafik, segmentmasser og tyngdepunkt følger samme bevægelse. På Svær bevarer 1–3 og Q/E de valgte mål. [Besætningens led og geometriske mål](../../assets/simulation/boats.js) · [Bevægelse og masse](../../assets/simulation/physics.js)
- **Foilror.** Den vandrette flade ved roret havde hidtil samme korderetning ved alle rorudslag. `foilPose` drejer nu fladens korde og spændvidde sammen med det lodrette blad på begge foilbåde. Den fælles position bruges også i grafikken. Sektionernes lokale vandhastighed indgår i både flapberegningen og kraften. [Foilmodellen](../../assets/simulation/foils.js)
- **Testresultater.** `runCompleted` angiver, om tidsforløbet blev kørt, `maneuverSucceeded` angiver, om manøvren bestod, og `steadyReached` angiver, om et stabilitetskriterium blev målt og opfyldt. `failureReason` giver årsagen. `null` i et felt betyder, at kriteriet ligger uden for den konkrete prøve. [Eksisterende sejladsprøver](../../scripts/sea-trials.cjs) · [Før/efter-prøver](../../scripts/steering-trials.cjs)

Ingen ændringer af bådenes masse, antal besætningsmedlemmer, nominelle sejl- eller rorarealer, ballast, rigsætning, vanddybde, bølgespektrum eller regulatorens grænser.

## Den langsomme bagbordsdrejning på AC72

Skærmbilledet blev genskabt med kurs 091°, 5,8 knob, 9,7 m/s fra 270°, 67,4 % trim og fuld vingekraft. Kortposition `(575, −1190)`, en bom ved udslagsgrænsen og fladt vand er rekonstruktionsvalg. Der er også en spejlet prøve fra 089°. Positive momenter om det aktuelle tyngdepunkt drejer stævnen mod bagbord.

Efter seks sekunders bagbordsinput fra 091° var kursen 84,37° før og 84,47° efter. I førmålingen ydede de øvrige foils +13,85 kNm, rorene −10,39 kNm og riggen −4,35 kNm. De øvrige foils bidrog altså til den bestilte drejning i dette øjeblik. Rorene var omkring −20,8°, men skroget drev 23,8° sideværts i forhold til kursen. De tilsvarende momenter efter rettelsen var +13,89, −10,43 og −4,33 kNm.

På det samme frosne øjebliksbillede blev rorene sat til −12°, −5°, 0°, +5° og +12°, samt den faktiske vinkel på −20,8°. Ved 0° var den lokale tværstrøm ca. 1,57 m/s ved begge ror, og stall var 0,89–0,93. Rorene gav −20,54 kNm. Ved −12° aftog stall, men indløbet ramte stadig modsat den tilsigtede side af rorbladene, og momentet var −27,95 kNm. Ved −20,8° var angrebsvinklen ca. −4° og stall nul. Neddykket areal var ca. 0,222 m² pr. lodret blad, og ventilation var nul. Portfoilen bad samtidig om mere løft, end flappen kunne levere ved sin grænse på +18°.

Da kun den sideværts translationshastighed blev fjernet i en særskilt beregning, skiftede rormomentet ved −20,8° til **+24,77 kNm**. Fjernelse af kun bådens drejehastighed gav **−7,70 kNm**. Det isolerer afdriftens store betydning for rorenes indløb. Frysningen afgør ikke, hvor meget den enkelte foil har skabt afdriften. De registrerede sidekræfter, angrebspunkter og regulatorens flapper kan sammenholdes del for del i datasættet. I reproduktionen er fortsat langsom drejning fra én af de to kombinationer af bomside og rorretning et åbent problem.

## Laserens ror i vind og bølger

Debugvisningen åbnes med backtick eller med debugknappen under instrumenterne. Den hvide kontur følger rorbladet, orange viser strimlernes midtpunkter, cyan viser vandets højde ved dem, og grønt viser de punkter, hvor bladet får kraft. Browserprøven kontrollerer, at konturen falder sammen med den tegnede rorgeometri. [Browserbillede af ror og vandlinje](laser-ror-vandlinje.png)

Ved fast skroghøjde 0,17 m, stævn +4° og fysisk ror +18° målte den geometriske neddykning 0,0701 m² ved −35°, 0,0747 m² ved 0° og 0,0764 m² ved +35° krængning. Spejles ror og krængning samtidig, er arealet ens på begge sider. De viste arealer følger også stævn og skroghøjde.

I den gentagne ekstremprøve med to reb, 16,8 m/s, 7,6 knob, ca. 28° indgangskrængning og fuldt ror var rod og spids beregnet direkte fra rorbladets placering. Ved 1,25 s på den ene hals ændredes krængningen fra −34,90° til −34,34°. Bladet målte 0,0188 m² geometrisk vådt, svarende til 0,0178 m² af det nominelle areal, mod før 0,0179 m². Stall var fuldt udviklet, og ventilationstilstanden var ca. 0,74. Rorets bagbordsmoment ved dette tidspunkt var ca. +140 Nm, det samlede ydre moment +244 Nm og det bogførte bidrag fra medbevægende vand −109 Nm. I den tilsvarende bølgeprøve var det geometrisk våde areal ca. 0,0265 m². Vedvarende fuldt ror gennem ekstremprøven gav stadig kæntring på begge halser.

Den tidligere audit havde ved samme tid mindre vådt areal og en anden drejning. I dens højreprøve ændrede rormomentet om skrogets referencepunkt sig fra ca. −82 til −154 Nm efter de forrige rettelser. I den nyere bogføring bidrog vandets transport samtidig ca. +127 Nm om tyngdepunktet ved dette tidspunkt. Areal alene forudsiger derfor ikke kursændringen. Korrekt neddykning, stall, ventilation, riggens og sværdets moment og den medbevægende vandmasse kan nu aflæses adskilt. [Tidligere målinger](modelrettelser.json)

## Manøvrer og kriterier

En stagvending skal passere vindøjet inden for ±10° og derefter holde den nye halse i målzonen ±10° med opvinds-VMG over nul og mindst 80 % af den gennemsnitlige fart gennem vandet i de sidste to sekunder før vendingen. Alt skal holde sammenhængende i mindst to sekunder. Grundkontakt, kæntring eller redning afbryder prøven. Grænserne er lagt fast før rettelserne. De ens relative grænser tillader kortvarig vandkontakt for en foilbåd og kræver genvundet fart, hvis båden gik ind i vendingen på foils. Det tidligere program har 28 s efter rorkommandoen. Det særskilte spillerprogram har 30 s. Sejladserne bruger Svær, faste vind- og bølgefrø og normalt 1/60 s fysiktrin.

| Båd og program | Resultat før → efter | Tid i vindøjet, efter | Laveste fart, efter | Genvundet fart, efter | Maks. krængning, efter |
|---|---|---:|---:|---:|---:|
| Laser, 7,5 m/s, tidligt ror og slæk i vindøjet | 2/2 → 2/2 | 0,48 s | 2,19–2,20 m/s | 7,55–7,58 s | 29,0° |
| Racer 32, 7 m/s, ror og slæk | 2/2 → 2/2 | 1,42 s | ca. 2,14 m/s | 14,10 s | 22,8° |
| Turbåd 43, 7 m/s, ror og slæk | 2/2 → 2/2 | 3,28 s | ca. 1,95 m/s | 28,67 s | 18,9° |
| AC72, 13 m/s, 60° indgang og mål, 70 % → 55 % → 70 % trim | 2/2 → 2/2 | ca. 3,1 s | ca. 4,83 m/s | 22,18–22,20 s | 4,3° |
| AC75, 12 m/s, hovedprøve med 57° mål | 0/2 → 0/2 | ca. 15 s | 0,38–0,41 m/s | — | ca. 7,7° |

Genvundet fart måles fra rorkommandoen til afslutningen af de to sekunder i målzonen. I AC72-prøven består både genafspilning af de fastlåste førinput og den særskilt genkørte styring. Den oprindelige AC72-prøve ved 7 m/s forlader stadig ikke vindøjet på den nye halse. AC75 når under samme oprindelige program ikke vindøjet. I et særskilt AC75-forsøg med 46° målkurs og midlertidigt fald af mod 75° kommer båden igennem vindøjet, men slutter ved ca. 3,0–3,4 m/s. Indgangsfarten var ca. 9,1 m/s. I den passage falder sejltrækket fra ca. 12,2 kN til ca. 0,6 kN i løbet af de første tre sekunder af vendingen. Den ene hovedflap er allerede mættet, mens båden fortsat har fart. Dernæst genoptager skroget vandkontakt, og begge hovedflapper er mættede, mens fart og sejltræk stadig er lave. Forsøg fra højere fart gav enten tab af fart efter vandkontakt eller kæntring. Målingerne placerer det største farttab omkring tab af fremdrift og genoptaget vandkontakt. De fastlægger endnu ikke en specifik fejl i AC75-regulatoren.

Det tidligere fastlåste Laser-input ved 7 m/s gik begge veje fra at bestå til at miste næsten al fart efter vindøjet. Det nyere program og de manuelle browserprøver med 1–3 og Q/E lykkes begge veje. Den konkrete regression med det tidligere program er bevaret i data. Det tidligere program for Turbåd 43 når målkursen, men genvinder for lidt fart.

Med ror sat neutralt i 32 s bestod Racer 32 og Turbåd 43 kurs- og stabilitetskriterierne på begge halser. Laserens gennemsnitlige kursfejl i slutvinduet var 7,47° mod en grænse på 7°. AC75 og AC72 viste større bådtypeafhængig drejning, ca. 20,3° og 35,3° i slutvinduet. Rortrinene testede ±24 % og ±60 % i to sekunder efter en ens indgang for hver båd og sammenlignede med en neutral prøve. Vægt og trim blev holdt faste i hvert par. Slæk blev prøvet separat. Ror og vægt blev gentaget i 0,35 m bølger og 18 % chop.

I **Fri sejlads** blev de almindelige piletaster, skødet, Q/E og 1–3 prøvet i bølger på alle fem både fra spillelige positioner. Alle ti korte styrbords-/bagbordsløb gav både det modtagne rorinput, faktisk bladudslag, kursændring i samme retning og uafhængigt slæk. På Laser ændrede kursen sig ca. 22,8–23,5° på et sekund, på Racer 32 ca. 6,8–6,9°, på Turbåd 43 ca. 3,1–3,2° og på foilbådene ca. 2,3–3,3°. De fulde AC72-vendinger er reproducerede med simulerede spillerinput i fysikharnessen. De særskilte browsertests passerede rorstyring, slæk og sejlads i stærk vind på begge foilbåde. En test af AC75-afgang fra tre forskellige startfaser i sø kræver dog to starter med etableret foilstatus. En matchet kontrol gav 0/3 i førbuildet og 1/3 i efterbuildet, så den prøve er fortsat åben. I alt bestod 64 Node-prøver og 23 af 24 målrettede browserprøver på Chrome 158.0.8127.37, samt alle 10 praktiske rorforløb i Fri sejlads.

## Vægt og ændret vandkontakt

Samme faste side, stilling, skøde og ror blev holdt gennem et forløb med midterstilling, fuldt frem ved 2 s og fuldt agter ved 6,5 s. Tabellen viser målt forskydning mellem de to yderpunkter på fladt vand. Positiv stampning betyder stævnen op. Måledata viser også rorareal og fart.

| Båd | Besætningens tyngdepunkt, vandring | Hele bådens tyngdepunkt, vandring | Stævn fremme → agter |
|---|---:|---:|---:|
| Laser | 0,86 m | 0,45 m | −0,77° → +0,65° |
| Racer 32 | 1,27 m | 0,14 m | −1,22° → −0,92° |
| Turbåd 43 | 1,70 m | 0,05 m | −1,38° → −1,27° |
| AC75 | 1,10 m | 0,11 m | −0,02° → +0,72° |
| AC72 | 1,00 m | 0,14 m | +0,13° → +0,65° |

Laserens effektive våde rorareal ændrede sig fra ca. 0,058 til 0,067 m² mellem yderpunkterne, og farten fra 3,36 til 3,27 m/s. Der var ingen redning eller kæntring i de isolerede vægtforløb. De målte tal gælder den aktuelle bådlast og netop disse forhold. I bølger kan den øjeblikkelige stampning have en anden størrelse og retning.

I den særskilte bølgeprøve på Laser (0,72 m og 23 % chop, vindstille, fast besætningsvalg) blev den største ændring i skrogets referencepunkts hastighed pr. trin målt efter initialisering:

| Frekvens | Før | Efter | Maks. ændring af drejehastighed før → efter |
|---:|---:|---:|---:|
| 60 Hz | 0,450 m/s | 0,053 m/s | 1,05 → 0,43°/s |
| 120 Hz | 0,887 m/s | 0,032 m/s | 1,78 → 0,23°/s |

Den modellerede medbevægende tværmasse ændrede sig fortsat fra ca. 81 til 142 kg gennem prøveforløbet. De store spring kom fra ledgeometrien og dens bidrag til besætningens relative impuls. Den tidligere bevaringsprøve opgør båd og den idealiserede, medbevægende vandblok ved fast neddykning uden ydre kræfter. Ved varierende vandkontakt er den modellerede vandblok et åbent delsystem. Bølgefeltet kan udføre arbejde, hydrodynamisk modstand fjerner energi, og aktuatorer kan udføre internt arbejde. De dynamiske prøver giver derfor hastighed, momenter og ændring i vandblokken pr. trin. Energilukning for aktivt arbejde og variabel neddykning kræver en særskilt model af vandets udveksling med omgivelserne. [Tidligere isolerede impuls- og energiprøver](modelrettelser.md)

## Bølger i det spillelige øhav

Med vestenvind på 5 m/s, samme frø og 180 s beregnet overflade pr. kombination blev signifikant lokal bølgehøjde estimeret som fire gange standardafvigelsen. Den valgte meterværdi for lange bølger er en åben reference, og chop måles her både alene og sammen med de lange bølger. [NOAA/NDBC om signifikant bølgehøjde](https://www.ndbc.noaa.gov/faq/wavecalc.shtml)

| Sted | Dybde | 0 m / 0 % | 2,5 m / 0 % | 0 m / 100 % | 2,5 m / 100 % |
|---|---:|---:|---:|---:|---:|
| Syd for Lyø, (−775, −2400) | 30,0 m | 0,00 m | 2,54 m | 0,40 m | 2,54 m |
| Læ ved Faaborg, (0, 0) | 8,50 m | 0,00 m | 0,47 m | 0,02 m | 0,49 m |
| Øst for Svelmø, (1400, −1580) | 17,48 m | 0,00 m | 0,95 m | 0,12 m | 1,02 m |

Ved Faaborg er der ca. 9 m fri vandstrækning fra vest og en beregnet chopfaktor på 0,049. Samme koordinat med læ slået fra gav ca. 0,40 m med 100 % chop. Ved den målte dybde er det især den korte vandstrækning, der dæmper chop. Det er en eksplicit kalibrering i `combinedField`. Om dæmpningen er troværdig for alle retninger i det komprimerede øhav er en kalibreringsopgave. Den tidligere prøve kaldet *bredt farvand* lå 41 m fra Svelmø og havde stadig kun ca. 233 m opvinds vandstrækning, så syd for Lyø bruges nu som åben reference. Fysik og shader gav højst 1,14 cm forskel i GPU-prøven. Den tegnede geometri ved skroget afveg højst 3,17 mm på Lav og 1,28 mm på Høj. Bølge- og chopvalg beholdt forrang for en medsendt legacyværdi. Udviklerværktøjets `SAILING_GAME.measureSeaAtBoat()` viser både valgt reference, aktiv profil, dybde, fristrækning og estimeret lokal højde. [Kystdæmpning](../../assets/shelter.js) · [Bølgefelt](../../assets/simulation/physics.js)

## Gentag prøverne

Kør fra projektmappen. Arkivet har de fulde indgangstilstande med fysik og vejr, de tidsbestemte input, Git-status ved start, før- og efterdata, de frosne AC72-øjebliksbilleder og de særskilte programmer. Rækkerne over tid er et udsnit af afspilningen. `definition.initial.time` kan være over nul, når en båd er kørt ind i ligevægt før et inputtrin.

```sh
npm run check:simulation
npm test
node scripts/steering-trials.cjs . /tmp/styringsproever.json.gz gennemgang/fysik/styringsproever-data.json.gz
node scripts/steering-trials.cjs . /tmp/stagvendinger.json.gz --maneuvers gennemgang/fysik/styringsproever-data.json.gz gennemgang/fysik/styringsproever-data.json.gz
node scripts/steering-browser.cjs http://localhost:4201/ /tmp/tack-browser.json
TACK_URL=http://localhost:4201/ npx playwright test tests/difficulty.test.js tests/foil-respons.test.js --workers=1
```

De matematiske tests, browserbetjeningen og sammenligningen med rigtige fartøjer er forskellige prøver. Manøvretiderne er målt i TACK. Fysiske sejladsdata med samtidig kurs, ror, rigtrim og afdrift mangler især for foilbådene. ILCA's vejledning understøtter praktisk brug af slæk, vægt og fart gennem vandet som kvalitative kontrolpunkter for Laser. [ILCA om sejlads på kryds](https://ilcasailing.org/upwind-in-lasers/)
