# Bådfysik: definitioner og kontrol

Koordinater for komponenter er relativt til skrogoprindelsen: x fremad, y opad og z mod bådens højre side. Positions-, hastigheds- og masseværdier bruger meter, sekunder og kilogram. Modellen er en spilsimulation, ikke en målt VPP eller certificeret stabilitetsberegning. `SailingBoats.CONFIGS` i `index.html` er kilden til nedenstående værdier. Hver [bådprofil](baadprofiler.json) indeholder også geometri, massernes angrebspunkter, lasttilstand, rig, undervandsdele og spilparametre. Vandlinjelængde, våd skrogflade, dybgang, opdrift og tyngdepunkt er udtrukket fra spillets hviletilstand. Se også [vindlæ, Laser-vendinger og fart før og efter](../haandtering/README.md).

| Båd | Længde × bredde m | Skrog kg | Rig kg | Udstyr kg | Ballast kg | Foilarme kg | Besætning kg | Samlet kg | Arbejdssejl m² |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Laserjolle | 4,23 × 1,37 | 56 | 10 | 2 | 0 | 0 | 75 | 143 | 7,06 |
| Racer 32 | 9,75 × 3,10 | 1.100 | 190 | 250 | 900 | 0 | 160 | 2.600 | 62 |
| Turbåd 43 | 13,1 × 4,05 | 5.200 | 400 | 900 | 2.800 | 0 | 300 | 9.600 | 80 |
| Foilmonohull | 20,7 × 5 | 2.890 | 500 | 260 | 0 | 2.530 | 720 | 6.900 | 230 |
| Foilkatamaran | 22 × 14 | 3.260 | 900 | 1.150 | 0 | 600 | 990 | 6.900 | 260 |

Laserjollens 7,06 m² svarer til ILCA 7. De nominelle 58 kg med beslag er repræsenteret som 56 kg skrog plus 2 kg beslag. Spillets 10 kg løs rig og udstyr samt sejlerens 75 kg er estimater. Klassen angiver en vandlinje på 3,81 m. Den bruges som reference for Froude-tallet. Spillets beregnede vandlinje i den viste lasttilstand er 3,58 m. [ILCA-håndbogen](https://ilcasailing.org/laserinternational/wp-content/uploads/2025/02/HANDBOOK-2025.pdf)

Racer 32 er et fiktivt design. Dimensioner, vægte, køl, 38 m² storsejl og 24 m² fok er spilestimater, ikke en målt båd. To personer à 80 kg indgår én gang i den samlede masse; deres animerede led bestemmer de fysiske massepunkter. Turbåden er også fiktiv og ikke en Hallberg-Rassy 43. Som sammenligningsgrundlag beskriver [producentens specifikation](https://www.hallberg-rassy.com/fileadmin/data/yachts/hallberg-rassy_43_mk_ii/downloads/HR43MkIITeknBesk.pdf) en anden og tungere 43 Mk II. Foilernes mål er inspireret af klasserne, mens massefordeling, profiler og automatisk styring er spilkalibreringer; begge synlige sejlflader på monohullen udgør tilsammen ét storsejl.

Opdrift beregnes fra neddykkede skrogceller og den samme bølgeflade, der bruges i spillet. Ballastens masse tælles én gang og dens estimerede volumen giver separat opdrift. Katamaranen beregner to adskilte skrog. Alle fem både bruger 1.025 kg/m³ som spillets fælles vanddensitet. Besætningens segmenter giver tyngdemoment og bidrag til inertien; flytning ændrer ikke den samlede masse. Flere massepunkter findes også i foilbådenes model.

Skrog, sværd, køl, ror og foils bruger vandets lokale bevægelse relativt til de enkelte punkter på båden. Punktets hastighed medtager translation og rotation. Sejlene bruger tilsvarende lokal luftstrøm, med bommens egen rotation for storsejlets sektioner. Instrumentet adskiller fart gennem vandet fra fart over grunden. Koefficienter, dæmpning, skrogmodstand og styrehjælp er spilparametre. Systemet bruger reducerede rotationer omkring skrogoprindelsen og diagonale inertier, ikke en fuld seks-frihedsgradsmodel med bevægeligt tyngdepunkt og krydsinerti. Inertier indeholder geometriske estimater. Øhavet er komprimeret geografisk uden at ændre SI-enhederne. Den viste vanddybde er spillets beregnede terræn og ikke et søkort.

`node scripts/physics-calibration.cjs` beregner 45 sekunders forløb for fem vindstyrker og fire valgte kurser. Resultaterne er kortvarige simuleringer med kursholdning, ikke validerede polarer eller en garanti for ligevægt. Begyndelsestrim er 35 % for de tre konventionelle både og 6 % for foilbådene; der anvendes arbejdssejl og intet ekstra forsejl. Trim er ikke optimeret for hver kurs. `tests/physics-consistency.test.js` kontrollerer besætningsmasse og inertibidrag. Yderligere sejlads- og bølgetest beskrives i projektets README.

Det separate kraftintegrerede forløb i `sejlforlob.json` anvender 8 m/s vind, vindpust og bølger, ror til begge sider og en efterfølgende ændring af besætningsposition. Under dette forløb kæntrer Laserjollen. Forløbet kalder fysikopdateringen direkte og udløser ikke spillets brugerfladefunktion for opretning; det dokumenterer derfor ikke, at jollen er sejlklar efter kæntring. Opretning kontrolleres separat i `tests/waves.test.js`.

## Modellens afgrænsning

* Jollen har en reduceret, eksperimentel planingskraft: dynamisk tryk, en anslået våd planflade, trim og et gradvist indslag mellem Froude-tal 0,50 og 0,85 giver lodret løft med tilhørende modstand. Løftet begrænses til 70 % af bådens vægt og aftager, når skrogets fortrængning forsvinder. Den er ikke kalibreret mod tankforsøg eller en VPP. [MIT beskriver sammenhængen mellem tryk, trim og våd skrogflade](https://web.mit.edu/flowlab/NewmanBook/Tuck.pdf).
* De konventionelle bådes inertier er anslåede diagonale skroginertier med massepunkter. Kraftmoment, oversættelse og rotation er ikke en fuld integrator om det flyttende tyngdepunkt. Ror- og kølkræfter er reducerede flademodeller; der er ikke et fuldt fordelingsintegral over hver flade.
* Racer 32 har nu to rorpunkter med hver sin lokale strømning og nedsænkning. Det angivne rorareal er samlet for begge; hvert ror bruger halvdelen. Profiler og fordelinger er fortsat spilestimater.
* Kalibreringstabellen dækker korte forløb ved én valgt trimindstilling pr. båd. Afprøvning med målte polarer, fuld stabilitetskurve eller systematiske variationer af rig, last og søforhold ligger uden for prøvernes dækning. Alle fem bådtyper gennemførte stagvending og bomning ved 5,5 m/s med ror- og triminput. Se [forløbsdata](../aflevering/forloeb.json).

I matrixen før planing og to rorpunkter (`kalibrering-for-planing.json`) gav ingen af de 100 punkter ikke-endelige tilstande, registreret kæntring eller kursafvigelse over 20° ved forløbets afslutning. Eksempel ved 6 m/s vind og 90° ønsket kurs er gennemsnitsfarten i de sidste 10 sekunder: Laser 2,34 m/s, Racer 32 2,93 m/s, Turbåd 43 2,80 m/s, foilmonohull 2,40 m/s og foilkatamaran 2,52 m/s. Dette er én valgt trimindstilling og ét kort forløb; tallene dokumenterer ikke ligevægtsfart eller generel rangordning af bådene.

Læmodellen vælger det største beregnede vindlæ fra de landstykker, som ligger i indfaldsretningen. En nærliggende lav ø skjuler derfor ikke virkningen af højere land længere op mod vinden. Bølgelæ følger fortsat den nærmeste blokering.

Efter de to ror og planingstilnærmelsen er `kalibrering.json` genskabt: alle 100 forløb sluttede med endelige tilstande, uden registreret kæntring eller kursafvigelse over 20°. Maksimalt planingsløft opgøres per båd og vindvinkel i rådataene. Resultaterne før planing ligger i `kalibrering-for-planing.json`. De opdaterede fartmålinger med særskilt trim per kurs ligger i [sejladsgennemgangen](../haandtering/README.md).

## Foilmonohull i hård vind

På halvvind og slør kunne modellen med et forholdsvis tæt skøde udvikle mere krængende moment, end skrog og foils kunne holde imod under accelerationen. I de kontrollerede førprøver ved 20 m/s og 0,75–1,15 m signifikant bølgehøjde kæntrede den inden for cirka 1–3 sekunder med 55 % trim. Bommen kunne ved start også ligge på den forkerte side på den ene hals.

Foilmonohullen bruger gradvist et mindre sejlplan ved lokal middelvind over 13 m/s ved riggen. Ved 18,5 m/s bruger den 58 % af storsejlets og 56 % af fokkens fulde areal. Det sænker sejltrykket og dets angrebspunkt, og de synlige sejl følger samme skalering. I hård vind kan besætningen også lette skødet midlertidigt ved lav fart på åbne kurser eller ved stigende krængning. Spilleren vælger stadig kurs og trim. De valgte arealer og automatiseringen er spilkalibrering. [America’s Cup om samspillet mellem sejltrim, krængning og foilstyring](https://www.americascup.com/news/4388_INSIDE-THE-AC75-HOW-THE-DOUBLE-SKINNED-MAINSAIL-REALLY-WORKS)

Foilstyringen medregner både den lokale bølgehøjdes ændring over tid og den ændring, der opstår, når skroget bevæger sig hen over en bølgeside. Styringen ændrer flappernes vinkel. Fart og højde kommer fortsat fra de integrerede luft- og vandkræfter. [America’s Cup om flapkontrol og flyvehøjde](https://www.americascup.com/news/4409_INSIDE-THE-AC75-THE-LATEST-TRENDS-IN-FOIL-DESIGN)

## Foilkatamaran i hård vind

Ved høj fart følger flapperne middelhøjden over flere bølgefaser, samtidig med at de reagerer direkte på bådens lodrette bevægelse. Når sværd eller rorfoils nærmer sig overfladen, sænker styringen gradvist den ønskede flyvehøjde og flytter løftet til de flader, der stadig er i vandet. Vingen åbner, flader ud og tvister mere ved høj lokal vind og høj relativ vind. Spilleren beholder sit valgte trim.

I et 30-sekunders forsøg fra stilstand i åbent vand med 20 m/s vind, 1,50 m signifikant bølgehøjde og 80 % trim faldt den største højde for det laveste skrog fra 2,78 til 1,19 m over den lokale bølgeflade. Det maksimale stamp faldt fra 27,3° til 4,8°. I den nye model lettede båden efter 4,4 sekunder og sluttede på foils efter kortvarig bølgekontakt undervejs. Højde og stamp er registreret ved hvert 60 Hz-fysiktrin.
