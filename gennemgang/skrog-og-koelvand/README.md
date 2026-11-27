# Laserjollens greb i vandet

Testet i Fri sejlads på Svær. Det lokale før-build er `a445477ce395`, og efter-buildet er `c078a411d0ad`. Begge bygger på Git-revision `7ad0eccd2d5a` med lokale ændringer. Port 5173 viste oprindelig et ældre build, `2b9ec67f058c`. Efter opdateringen viste spillet og HTTP-svaret begge `c078a411d0ad`. [Spil på localhost](http://localhost:5173/)

I de fire referenceoptagelser er især sejlerens støtte mod båden og skummet langs det belastede skrog læselige. Optagelserne gav et visuelt sammenligningsgrundlag. De angiver ingen tryk, rorkræfter eller præcise spillerinput.

## Hvad er ændret i spillet?

Laserens planingstryk blev beregnet på to steder langs midterlinjen. Den krængede bund kunne derfor få løft, selv om beregningen overså den sideværts kraft fra vandet på den belastede skrogside. Nu har jollen tre trykpunkter på tværs ved hver af de to stationer. Hvert punkt bruger bundens lokale hældning, neddykningen og hastigheden i forhold til vandet, inklusive rotationen. Resultatet giver både kraft og moment. Racer 32 bruger den samme beregning med sin egen skrogform. Turbåden og foilbådene bruger deres egne modeller for støtte. [Bundtryk og kraftregnskab](../../assets/simulation/physics.js) · [Bådprofiler](../../assets/simulation/boats.js)

Skummet arvede tidligere vandets øjeblikkelige bølgehastighed og kunne fortsætte sidelæns i hele sin levetid. Nu transporterer middelstrømmen skummet, mens bølgebevægelsen giver et begrænset udsving omkring sporet. Det er en tilnærmelse med den dominerende periode. Bølgerne langs skrogsiderne dannes ved skæringen mellem den våde skrogsektion og overfladen. På katamaranen behandles de to skrog særskilt. Sporene bliver tilbage i verden gennem svinget. [Kontakt og lokale bølger](../../assets/hull-water.js) · [Skum og sprøjt](../../index.html) · [Vandprøver](../../tests/water-effects.test.js)

## Målinger i den almindelige sejladsvisning

Hver prøve begyndte med fastsat kurs, fart, vejr og bølgefase. Derefter sejlede jollen med spillets egne kræfter. Ror og besætning blev betjent gennem browserens tastatur og skødet gennem den almindelige skyder. Styresekvensen til bølgepassagen og stagvendingerne blev først indspillet på efter-buildet og derefter gentaget på begge builds. Det gør prøven til en sammenligning ved ens input, hvor hver version kan have sin egen optimale manøvre. Fart er gennem vandet. Minimum er målt fra 2,33 sekunder inde i hvert forløb.

| Måling | Før | Efter |
|---|---:|---:|
| Bølgepassage med målkurs 110°, slutkurs efter 11,93 s | 77,75° | 106,66° |
| Samme passage, laveste fart | 6,56 knob | 7,81 knob |
| Samme passage, slutfart | 9,42 knob | 9,06 knob |
| Stagvending med vægtskift til styrbord, laveste fart → slutfart | 3,91 → 5,72 knob | 3,91 → 5,72 knob |
| Stagvending med vægtskift til bagbord, laveste fart → slutfart | 3,62 → 5,72 knob | 3,62 → 5,72 knob |

**Slør gennem bølgen.** Vind 9,5 m/s fra nord, 0,85 m bølger fra 300°, 25 % chop og ingen vindpust eller kystlæ. Jollen begyndte på kurs 110° med 5,6 m/s, 12° krængning og 52 % skøde. Skødet blev slækket til 28 % ved start og halet til 42 % efter tre sekunder. Tidligt modror og slæk holdt efter-buildet tættere på den ønskede kurs. [Se før og efter ved siden af hinanden](boelgepassage.mp4) · [Input og målinger](boelgepassage.json.gz)

**Sen reaktion.** Med samme starttilstand blev roret først lagt efter to sekunder og sejlet først slækket efter 4,5 sekunder. Begge versioner skar op og kæntrede. I efter-buildet var alle fire prøvepunkter på rorbladet fri af vandet ved 3,02 sekunder og 53° krængning. Kæntring blev registreret ved 8,43 sekunder. Det forklarer, hvorfor et sent rortryk alene havde ringe virkning i netop denne situation. [Kontaktpunkter og kræfter gennem opskæringen](opskaering.json.gz)

**Stagvendinger.** I 8,5 m/s fra nord med 0,35 m bølger og 16 % chop gennemførte jollen begge vendinger med ét manuelt sideskift, uden grundkontakt eller kæntring. Farten efter 16,93 sekunder og farttabet gennem vendingerne var praktisk taget ens før og efter. Forskellen ses især, når den krængede jolle planer med sideværts vandstrøm. [Klip med vægtskift til styrbord](til-styrbord.mp4) · [Klip med vægtskift til bagbord](til-bagbord.mp4) · [Målinger til styrbord](til-styrbord.json.gz) · [Målinger til bagbord](til-bagbord.json.gz)

## Kontrol af kræfter og ydelse

I den isolerede prøve med 20° krængning, 6 m/s fremad og 0,55 m/s sideværts gik planingens sidekraft fra 0 til −251 N. Løftet gik fra 982 til 943 N og rullemomentet fra +38 til −123 Nm. Den samlede effekt fra bundtrykket var −265 W før og −266 W efter i vandets lokale referencesystem. Den spejlede prøve kontrollerer fortegn på den anden hals. [Regressionstest for bundtrykket](../../tests/simulation.test.js)

Browserprøverne dækker også kølvand ved stilstand og nedslag, surf på for- og bagsiden af en bølge, ror og sværd, Racerens trapez, Turbådens sejl og begge foilbådes respons. Racerens eksisterende trapezprøve manglede et manuelt valg af luvside i starttilstanden. Prøven angiver nu siden udtrykkeligt og kontrollerer den mod vinden. Grænserne for fart og krængning er uændrede. [Racerprøven](../../tests/racer27.test.js)

Alle 70 simulation- og servertests samt typekontrollen bestod. Af de 45 udvalgte browserprøver bestod 44 ved den afsluttende samlede kørsel. I multiplayerprøven for to selvstændige ror ændrede den observerende båds egen kurs sig mere end prøvens tolerance. Prøven bestod ved tre efterfølgende enkeltkørsler. Årsagen til variationen er fortsat uafklaret. [Prøven for uafhængig styring](../../tests/fleet.test.js)

I optagelserne gav Lav og Høj grafik identiske serier for position, fart, rotation, sejl og vandkontakt. Med én Laser på Apple M5 i Chrome 158.0.8127.37 ved 1280 × 800 var medianen mellem tegnede billeder 16,6–16,7 ms på begge builds. På Høj var P95 17,7 og 18,3 ms før samt 18,1 og 17,5 ms efter. På Lav var P95 18,1 og 17,5 ms før samt 18,0 og 18,1 ms efter. Hvert gennemløb målte fire sekunder efter opvarmning. Mobil og en flåde på seks både kræver særskilte ydelsesmålinger. [Rå billedtider, renderopløsning og inputrespons](billedtid.json)

De målte kræfter og sejladsforløb viser modellens respons. Kalibrering af planingstryk, opskæring og rorgreb i bølger kræver sammenlignelige målinger fra en rigtig ILCA. Den tidligere gennemgang beskriver også de bådspecifikke modeller og besætningens bevægelse. [Tidligere målinger](../vaegt-og-styring/README.md)

## Gentag forsøgene

Kør følgende fra projektmappen med før-buildet på port 5191 og efter-buildet på port 5173. Kommandoerne skriver til en ny prøvemappe og kan også køres med `TACK_CHECK_ONLY=1` for kun at gemme de fysiske data.

```sh
TACK_LASER_TRIAL=reach node scripts/laser-session.cjs http://localhost:5191/ http://localhost:5173/ /tmp/tack-vandproeve
TACK_LASER_TRIAL=broach TACK_CHECK_ONLY=1 node scripts/laser-session.cjs http://localhost:5191/ http://localhost:5173/ /tmp/tack-vandproeve
TACK_LASER_TRIAL=water node scripts/laser-session.cjs http://localhost:5191/ http://localhost:5173/ /tmp/tack-vandproeve
node scripts/laser-session.cjs http://localhost:5191/ http://localhost:5173/ /tmp/tack-vandproeve --timing
```
