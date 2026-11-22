# Efterprøvning af Laserjollen, kystdybde og sejlhjælp

Byg `8d90e5c65143` blev afprøvet i Chrome 157.0.8103.79 på [localhost:4173](http://localhost:4173/). Testværktøjet matchede HTTP-headeren med revisionen i spillets HTML. Git-udgangspunktet var `3f65b7f` med lokale ændringer. `c9f17e1e8ae0` er førbuildet for Laserens balance, `ad4daa20fa39` er førbuildet for det smalle lavvandsbælte, og `e4b73f838c03` er førbuildet for denne rundes ændringer til grundkontakt og sejlhjælp.

## Laser på Svær i Fri sejlads

I browseren blev båden startet gennem Fri sejlads. Vind og starttilstand blev sat én gang pr. prøve. Tastatur og skødeskyder styrede resten, inklusive de korte rorinput til at holde krydskurs. Alle sammenligninger brugte samme last, vægten langskibs i neutral og vind fra 000° på fladt, åbent vand. Besætningsmålet og den faktiske side blev holdt manuelt. Der var ingen aktiv hjælp til at dreje jollen ud af vindøjet. Gennemsnit er fra de sidste otte sekunder. Vi sammenlignede med de foregående otte og krævede under 0,22 kn forskel i middelfart, under 3° forskel i middelkrængning, fartspredning under 0,35 kn, kursafvigelse under 8°, kursspredning under 3° og ingen kæntring.

| Vind, kursmål og skøde | Position | Fart før → efter, kn | VMG efter, kn | Stævn / bevægelse efter | Afdrift / krængning efter |
|---|---:|---:|---:|---:|---:|
| 8,5 m/s, kryds 52°, 78 % | 1 | 5,99 → 6,13 | 4,01 | 48,1° / 49,2° | 1,1° / 23,2° |
| Samme | 2 | 6,87 → 6,97 | 4,44 | 49,4° / 50,4° | 1,0° / 12,4° |
| Samme | 3 | 7,59 → 7,49 | 4,47 | 52,2° / 53,3° | 1,2° / 3,2° |
| 8,5 m/s, kryds 52°, 86 % | 3 | 7,51 → 7,80 | 5,09 | 47,5° / 49,3° | 1,7° / 22,4° |
| 2,5 m/s, kryds 52°, 56 % | 1 | 1,13 → 1,11 | 0,65 | 53,5° / 54,3° | 0,8° / −0,7° |
| Samme | 2 | 1,04 → 1,00 | 0,60 | 52,1° / 52,8° | 0,7° / −7,5° |
| Samme | 3 | Kæntrede begge gange | | | |

**Den højeste stabile fart i position 1 under frisk vind kunne ikke genskabes.** Det gjaldt også før rettelsen. På halvvind ved 8,5 m/s med meget slæk (33 %) fik position 1 og 2 henholdsvis 5,74 og 5,86 kn efter rettelsen, mens position 3 kæntrede til luv. Ved det løse letvindstrim havde position 1 mindst luvkrængning og holdt bedst fart. Det tidligere trimgitter viste omtrent samme optimale VMG for position 1 og 2 ved 84 % skøde i let vind. Gitterets bedste stabile krydstrim ved 8,5 m/s var 78 / 78 / 86 %, så den individuelt trimmede gentagelse bruger 78 % for position 1 og 2. Bommen stod i gennemsnit på 29,4° ved 78 % og 23,1° ved 86 %. Mere modvægt gør det muligt at hale ind og bære mere sejltryk. Sejladsen blev ikke kalibreret efter en ønsket rækkefølge.

### Vægtskift og vending

Ved 8,5 m/s på halvvind og 45 % skøde var fysiktrinnet 1/60 s i begge builds. Varigheden er fra tastetrykket til den faktiske position første gang er inden for 0,05 positionstrin af målet. Spidser er målt over de samme 2,1 sekunder efter hvert tryk. Hastigheden ved skrogets referencepunkt kan ændre sig, når besætning og skrog bevæger sig mod hinanden. Hastigheden ved det samlede tyngdepunkt inkluderer rotation og tyngdepunktets bevægelse inde i båden.

| Vægtskift | Tid før → efter | Største trin i fart ved skrog | Største trin i fart ved tyngdepunkt | Maks. acceleration ved tyngdepunkt |
|---|---:|---:|---:|---:|
| 3 → 1 | 0,38 → 0,70 s | 1,081 → 0,077 m/s | 0,154 → 0,059 m/s | 21,45 → 7,89 m/s² |
| 1 → 3 | 0,77 → 0,77 s | 0,037 → 0,038 m/s | 0,019 → 0,019 m/s | 5,53 → 5,54 m/s² |

Ved indflytning sprang farten ved skroget i førprøven fra 4,06 til 5,43 m/s på 0,08 s. Allerede dér var position 1 valgt, mens sejleren fysisk var ved position 2,3. Efter rettelsen gik farten fra 4,13 til 4,38 m/s over 0,27 s. Den tidligere måling på 1,06 → 0,08 m/s i ét trin kan dermed genfindes med spillets almindelige taster. Udglatningen ligger i besætningens fysiske indflytning. Instrumentet bruger i begge builds separat et tidsfilter på 0,9 s og opdaterer teksten højst fire gange pr. sekund. De to browservendinger på Svær ved 7,5 m/s bestod med tasterne 3 → 1 → 2, inklusive korrekt sidevalg i vindøjet. Uden nyt input blev valgt side bevaret, og en fuldt udhængt sejler på den forkerte side kunne stadig kæntre.

### Kurs og drejemomenter

Begge halser blev afspillet i den kørende fysik med samme fart ved start, samme vind og samme spejlede input. Under stabil sejlads ved 8,5 m/s ændrede kursen sig 0,11° på seks sekunder med neutralt ror. Et rorudslag på op til 4,29° gav op til 3,32° kursændring, og efter neutralisering var kursen igen inden for 0,12° af startkursen i den prøve. Et pust fra 8,5 til 10,5 m/s gav op til 2,65° drejning og 13,4° krængning. Slæk fra ca. 86 til 78 % under belastning sænkede fremadkraften fra ca. 85 N til 9–12 N i løbet af prøven. Med position 3 fastholdt flyttede balancen mod luv. Ved det større slæk fra 78 til 52 % nåede luvkrængningen ca. 70°.

Fra stilstand på dybt slør, med 35 % skøde og neutralt ror, blev drejningen på 61,6° på to sekunder genskabt på begge halser. I første fysiktrin gav sejlet ca. 135 Nm om skrogets referencepunkt. Skrog, sværd og ror gav da 0 Nm. Om tyngdepunktet var det ydre moment ca. 140 Nm, og nettomomentet efter det koblede vandbidrag var 117 Nm. Under stabil krydssejlads gav sejl, skrog, sværd og ror ca. +45,4 / −2,3 / +7,4 / −51,5 Nm om skrogets referencepunkt på den ene halse. Det gav −0,8 Nm netto om tyngdepunktet efter vandbidraget. På den anden halse vendte fortegnene. Diagnosen viser nu de tre størrelser om tyngdepunktet. Vandets medaccelererede masse bidrager til træghed, og bådens statiske vægt er uændret. Prøverne gav ingen påvist fortegns- eller momentarmsfejl. Størrelsen af drejningen fra stilstand står stadig åben for kalibrering.

### Sammenholdt med målte Laser-data

Den tidligere måling på 5,00 kn VMG ved 8,5 m/s brugte 86 % skøde. Den gav 7,83 kn gennem vandet, ca. 50,3° faktisk bevægelsesvinkel til vinden, 1,89° afdrift og 25,7° krængning. Gennemsnittet er fra de sidste otte af 44 sekunder. Den nye browsergentagelse med samme trim og korte tastaturudslag gav 5,09 kn VMG ved en bevægelsesvinkel ca. 1° tættere på vinden. [Oprindelig kraftprøve](laser-balance.md)

Ved 9 og 12 kn vind sammenlignede jeg TACKs stabile krydsfart med Binns' målte Laser-serier, gengivet i figur 4 og 5 hos Day. Ved 9 kn vind sejlede TACK 5,47 kn ved 52,0° stævnretning til vinden mod ca. 5,4 kn i figuren. Ved 12 kn vind sejlede TACK 5,85 kn ved 51,5° mod ca. 5,7–5,8 kn i figuren. De to TACK-forløb havde henholdsvis 0,87° og 0,84° afdrift. Aflæsningen fra figurerne er omtrentlig. Serien dækker ikke 8,5 m/s (16,5 kn), opstart fra stilstand, besætningens bevægelse eller drejning. Præcis kalibrering kræver sammenlignelige målinger af last, trim, krængning, afdrift og moment ved lav fart. [Day, Performance Prediction for Sailing Dinghies, afsnit 6.1](https://pure.strath.ac.uk/ws/portalfiles/portal/64217569/Day_OE_2017_Performance_prediction_for_sailing_dinghies.pdf)

## Kyst og sejlhjælp

- Ved Faaborg fandt førbuildet ingen grundkontakt for AC75 ved 7 m og AC72 ved 8,8 m offshore i de faste prøveopstillinger. Bagbords foilspids trængte henholdsvis 1,44 m og 2,50 m ned gennem den beregnede bund. Nu undersøges midte, knæk og spidser med bådens aktuelle krængning, stampning og foilbevægelse. Det dybeste kontaktpunkt på hver foil bruges, så flere målepunkter ikke forøger fjederkraften. Diagnosen viser båddel, position og lokal bundhøjde. Ved 10 m i prøvesnittet var AC72's sænkede foil i kontakt. Med løftede foiler var der fri passage for begge foilbåde.
- Det smalle bælte er bevaret. I Faaborg-snittet var bunddybden 3,27 → 7,86 m ved 5 m og 5,65 → 10,58 m ved 10 m efter den tidligere dybdeændring. I de dynamiske prøver passerede AC72 parallelt ved Faaborg uden kontakt (mindst 11,77 m fra kysten målt på bådens referencepunkt). En tættere bane ramte et fremspring med styrbords skrog. Laserjollen sejlede skråt ind og ud ved begge kyster uden kontakt. Tættere drejning ved Faaborg og indsejling mod stranden ved Bjørnø gav skrogkontakt. AC75 passerede Bjørnø med 12° indledende krængning i bølger uden kontakt.
- Bølgefeltet og GPU'ens vandoverflade bruger samme opdaterede dybdegitter. Ved 10 m fra kysten læste bølgerne ca. 10,46–10,48 m mod kollisionens 10,58 m. Det ca. 5 m brede gitter udglatter strandens profil, især i de første meter. I de to kystsnit varierede prøveoverfladen højst 1,16 cm mellem naboprøver med 25 cm afstand. GPU-prøven bestod ved fire punkter tæt ved kysten med tolerancerne 1,5 cm for overfladen og 0,11 m for gitterdybden. De testede passager bekræfter spillets komprimerede dybdemodel, som fortsat er beregnet for spillets geometri.
- Turbåd 43 blev afprøvet gennem knapperne med spiler, Code 0 og gennaker. Når et aktivt ekstrasejl blafrer på Svær, viser hjælpen nu den præcise knaptekst og forklarer, at fokken vender tilbage automatisk. Efter nedtagning i browseren blev fokkens fulde areal på 32 m² genaktiveret for alle tre. Der blev også prøvet skift fra spiler til Code 0 og fra Code 0 til gennaker, hvor beskeden navngav det sejl, der blev taget ned først.

## Gentag prøverne

- [Rå browserdata før](efterproevning-foer.json), [rå browserdata efter](efterproevning-sejlads.json) og [kystpassager og dybde før og efter](efterproevning-kyst.json) indeholder de enkelte målinger.
- Kør `node scripts/tack-follow-up.cjs /tmp/tack-efter.json http://localhost:4173/`. Det sidste argument kan være `player`, `shift`, `yaw` eller `coast` for en delprøve. De tre historiske builds blev serveret fra snapshots i `/tmp` med deres egne HTTP-revisionsstempler.
- 37 Node-prøver, simulationens TypeScript-kontrol og de målrettede browserprøver for manuelt vægtskift, begge vendinger, kyst, vandshader og sejlhjælp bestod.
