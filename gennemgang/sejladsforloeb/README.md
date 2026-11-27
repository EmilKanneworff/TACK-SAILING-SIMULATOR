# TACK · Besætning, sejl og vandkontakt under manøvrer

[Spil lokalt](http://localhost:5177/) · build `c012e6cfbe29`. Før-målingen er den faktisk kørende lokale version `1ee6b006d9a9`, baseret på Git `7ad0ecc` med de daværende lokale ændringer. Browseren kontrollerer, at **Om spillet → Version** matcher serverens versionsnummer.

## Fejl fundet og rettet

- På **Svær** kunne et tryk på 1–3 lægge et skjult sidevalg i kø i 2,5 sekunder. Vinden og rorbevægelsen kunne derefter flytte sejleren, selv om spilleren havde valgt side. 1–3 vælger nu stilling, Q vælger bagbord, E vælger styrbord, og Z/X flytter vægten agter/frem. Mobilmenuen viser sidevalget og har de samme særskilte kontroller. På **Let** skifter besætningen selv.
- Automatisk opretning nulstillede det manuelle sidevalg og længdetrimmet. Sejleren går fortsat i sikkerhedsstilling under opretning og bevæger sig tilbage mod spillerens valgte stilling, side og længdetrim, når kontrollen vender tilbage. Racer 32’s trapezliner frigøres visuelt under kæntring og opretning.
- Turbåd 43’s fok kunne bukke mod den side, storsejlet stod til, selv når fokkens beregnede vinkel havde det modsatte fortegn. Fokkens synlige bug følger nu dens egen vinkel. Dug, sejlkant, skøder og uldtråde forsvinder, når fokken rulles helt ind. Forstaget bliver synligt. Den delte fokrutine bruges også af Racer 32.

## Laserjollen i Fri sejlads

Begge halser er optaget på Svær med Følg-kamera, 8,5 m/s fra nord, 0,35 m dønning, 16 % chop og uden pust, kystlæ eller hjælp i vindøjet. Starten er sat med kurs 49° fra vinden, ca. 5,8 knob og 73 % skøde. Resten bruger tastatur og den almindelige skyder. Browseren genafspiller samme gemte input med fast fysiktrin på 1/60 s. Eksempelvis sættes 56 % skøde og position 1 ved 1,50 s, efterfulgt af ror ved 2,33 s. Position 2 vælges tæt ved vindøjet. Side vælges særskilt med E eller Q ca. 0,25–0,33 s senere. På den nye hals sættes 68 %, slækkes kort til 46 % og hales ind igen.

| Vægtskift mod | Før · start → laveste → slut | Efter · start → laveste → slut |
|---|---:|---:|
| Styrbord | 5,58 → 3,18 → 5,22 kn | 5,58 → 3,54 → 5,52 kn |
| Bagbord | 5,63 → 3,02 → 5,04 kn | 5,63 → 3,33 → 5,48 kn |

Før skiftede sejleren side inden Q/E i begge forsøg. Efter blev siden bevaret frem til kommandoen. Vægten gik gennem cockpittet, bommen skiftede side, og kølvandet blev tilbage langs svinget. Begge vendinger lykkedes uden kæntring eller grundkontakt. Ved slæk efter vendingen til styrbord åbnede bommen fra ca. 22° til 34°, og fremadkraften ved de viste målepunkter faldt fra ca. 41 N til omkring 0 N. Efter indhaling var den tilbage ved ca. 39 N. Roret nåede ca. 26° under manøvren. Kamera, rendering og position er aflæst ved 12 billeder/s. Den lavere og højere grafikindstilling gav de samme målte positioner, hastigheder, vinkler, sejlkræfter, besætningspositioner og vandkontaktpunkter.

[Video til styrbord](til-styrbord.mp4) · [Video til bagbord](til-bagbord.mp4) · [Data og input, styrbord](til-styrbord.json.gz) · [Data og input, bagbord](til-bagbord.json.gz)

## Øvrige både og åbent vand

### Racer 32

Prøverne starter med 3 m/s, kurs 152°, vind fra øst, fladt vand og besætningen ude i trapez. Et måleprogram styrer med samme rorinterface i alle kørsler. Tallene er middelværdier over de sidste tre af 18 sekunder.

| Vind | Skøde | Fart gennem vand | Krængning | Afdrift |
|---|---:|---:|---:|---:|
| 10 m/s | 72 % | 7,93 kn | 44° | 6,5° |
| 17 m/s | 72 % | 7,28 kn | 63° | 14,8° |
| 17 m/s | 95,8 % | 5,61 kn | 73° | 15,1° |

Raceren kom højst op på 8,30 knob i disse prøver. Den store afdrift og krængning ved 17 m/s viser, at stærkvindsbalancen stadig kræver kalibrering. En særskilt browserprøve gennemførte kryds og stagvending ved 10 m/s med manuel vægtflytning.

### Turbåd 43

I den filmede prøve blev storsejl og fok trimmet separat ved 8 m/s. To reb reducerede storsejlet fra 48 til 26,88 m². Da gennakeren var helt oppe, gav den ca. 1,55 kN fremad fra 105 m² i det viste målepunkt, mens den ind­rullede fok gav 0 N og var skjult. Et kort højretryk gav ca. 14° faktisk rorvinkel, og båden ændrede kurs omkring 4–5° frem til slutningen af klippet. Skift mellem fok, spiler, Code 0 og gennaker er også dækket af browserprøver. [Video før og efter](yacht-foer-efter.mp4) · [Sejl, kræfter og ror](yacht.json.gz)

### Foilbåde

Den tidligere rapporterede lænssituation med AC72 blev sat til kurs 091°, 5,8 knob, 9,7 m/s fra vest, 67,4 % vingetrim og Svær. Kontrollen virker i begge retninger i browseren. I det numeriske forløb med seks sekunders fastholdt ror nåede båden kurs 084,5° til bagbord og 119,7° til styrbord med cirka 21° faktisk rorudslag. Begge rorblade beholdt 0,222 m² vådt areal pr. blad. Ved fuldt bagbordsror modarbejdede hovedfoils og rig dele af rormomentet. Omkring fire sekunder var bidragene henholdsvis +14,4 og −4,0 kNm, mens rorbidraget var −12,6 kNm. Det forklarer den lille samlede drejning på denne side. Stævnen og vindretningen kan læses fra det oprindelige skærmbillede. Positionen er estimeret ud fra kortet, og bølgerne er sat til nul under reproduktionen.

Foilmonohullen blev prøvet i både fladt vand og bølger. Browserprøver dækkede rorudslag i vand og i foilflyvning for begge modeller. Den automatiske foilregulering er fortsat en forenkling af de virkelige både.

### Længdetrim og bølger

Ved samme stilling og side blev vægten flyttet agter og frem på stille vand i alle fem modeller. I Laserjollen flyttede besætningens fysiske tyngdepunkt sig 43 cm hver vej og gav 1,61° forskel i stævnens hældning mellem yderpunkterne. Turbåd 43’s fire personer flyttede deres fælles tyngdepunkt længere, men den tungere båd ændrede kun hældningen 0,11°. Data for hver båd og deres effektive profiler findes i [flådemålingerne](flaade.json.gz).

Ved 12 m/s og samme punkt, seed og dybde gav 120 sekunders overfladeprøver en signifikant højde på **0,00 m** for roligt vand, **2,38 m** for lange bølger alene, **0,50 m** for chop alene og **2,50 m** for begge. Signifikant højde her er fire gange overfladens standardafvigelse. Laserjollen, Turbåd 43 og foilmonohullen blev kørt i alle fire felter. For Turbåd 43 steg målt maksimal stampning fra 2,28° på fladt vand til 5,22° med lange bølger og 10,19° med begge komponenter. Laserjollen kæntrede i de to prøver med 100 % chop, 12 m/s og fast trim og vægt uden korrigerende input. En særskilt prøve med almindeligt tastatur i medsø bygger fart ved slæk og styring. [Lineær bølgeteori, MIT](https://web.mit.edu/fluids-modules/www/potential_flows/LecturesHTML/lec19/node5.html)

## Reproduktion og kalibrering

For at genskabe før-versionen kan du kopiere den testede arbejdsmappe, anvende [før-versionens patch](foer-build.patch) med `patch -p1` i kopien og starte den med `node server/static.js`. Patchen er efterprøvet mod versionsnummer `1ee6b006d9a9`.

```sh
TACK_LASER_TRIAL=manual-side node scripts/laser-session.cjs FØR_URL EFTER_URL gennemgang/sejladsforloeb
TACK_REVIEW_BOAT=yacht TACK_REVIEW_CONTROLS=current node scripts/sail-experience-review.cjs FØR_URL EFTER_URL gennemgang/sejladsforloeb
node scripts/fleet-review.cjs FØR_MAPPE EFTER_MAPPE gennemgang/sejladsforloeb/flaade.json.gz
```

67 Node-tests, typekontrollen og 53 målrettede browsertests bestod. Én eksisterende test af Laserjollens drejning blev opdateret til at medregne bommens reaktionsmoment i sin uafhængige beregning. Det manglede i den forventede værdi og gav samme testfejl før og efter.

Billedforløbene er optaget på Apple M5 i Chrome 158. Laserjollen blev optaget i 1280 × 800 og Turbåd 43 i 1120 × 720. Flådeprøverne giver samme numeriske resultater før og efter ved identiske simuleringsinput. Ændringerne under Laserjollens filmede vending opstår, fordi den samme tast nu giver den tilsigtede vægtkommando. De simulerede farttal beskriver de valgte forsøg. TACKs kraftkurver, Racer 32’s stærkvindsbalance og AC72’s asymmetriske respons på direkte læns kræver fortsat sammenligning med relevante virkelige målinger. Referenceklippene bruges til at bedømme bevægelsesforløbet. [Stentecs modelnoter](https://www.sailsimulator.com/en/game-info/boatset) · [ORC om fartpolarer](https://orc.org/organization/velocity-prediction-program-vpp) · [Fossens marine model](https://www.fossen.biz/html/marineCraftModel.html)
