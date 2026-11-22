# Skøde og bom i TACK

## Opfølgning på indhaling

Build `7a3e175e9b60` sænker indhalingshastigheden mod 100 % på den viste skala. Den tidligere styring holdt linehastigheden næsten konstant under indhaling. Kurven mellem line og procent fik derfor procenttallet til at løbe hurtigere, jo længere ind skødet kom.

| Laserjolle, 60 Hz | 0–50 % før → efter | 50–100 % før → efter |
| --- | ---: | ---: |
| Holdt ↑ | 1,45 → 1,47 s | 0,55 → 2,45 s |
| Skyder fra 0 direkte til 100 | 2,70 → 1,47 s | 1,02 → 2,45 s |

Tabellen måler den faktisk anvendte indstilling i Fri sejlads i stille vand. Skyderen viser spillerens ønskede procent med det samme. Den modellerede line følger med over den målte tid. Hovedskødets nye tempo gælder tastatur og skyder. Fokkens tastaturbetjening bruger også det finere tempo opdelt efter procent. Prøven kan gentages med tilstanden `haul` i `scripts/sheet-trials.cjs`. Rådata fra build `05c4636e0c1c` og `7a3e175e9b60` ligger under `haulBefore` og `haulAfter` i målesættet.

## Den første skødeændring

Den opdaterede version kan åbnes på [localhost:4173](http://localhost:4173/). Førmålingen er fra build `a461cf3c0689`. Eftermålingen er fra `cd32b97c55e2`. I [klippet](skode.mp4) sejler Laserjollen på halvvind, mens skyderen flyttes fra 50 til 0 og tilbage til 88 %. Det er spillets almindelige Følge-kamera.

## Hvad der gjorde skødet trægt

Den gamle skyder flyttede et beregnet stop, som begrænsede bomudslaget. På kryds var skødet allerede slapt omkring 50 %, fordi bommen havde nået en vinkel tæt på den tilsyneladende vind. Derfor blev der næsten ingen forskel i bomvinklen ved mere udslæk. Det er forventet adfærd, og den ses i begge builds. Under indhaling kunne stoppet til gengæld flytte bommen ind på ét trin, mens dens registrerede vinkelhastighed blev sat til nul. Den del af belastningen manglede også i skødets moment. Endelig havde bådene forskellig udslækshastighed, og foilbådene gik uden om den fælles funktion for skøderaten.

## Hvad der er ændret

- Skyderen viser spillerens ønskede indstilling fra **Helt slækket** til **Helt indhalet**. Den faktiske indstilling følger med en begrænset hastighed. På Laserjollen dækker 0–50 % nu 72,5 % af skødets samlede vinkelområde. Før dækkede det 68 %. Racer 32, Turbåd 43 og foilmonohullen har hver deres kurve og udslækshastighed. Katamaranens vingetrim er lineært og bruger fortsat sin egen flap og rotation.
- Slap line giver nul skødemoment. Ved indhaling, når linen tager fat, begrænser den bommens vinkelhastighed og kan trække den ind. Vinden kan frit flytte bommen ud inden for riggens mekaniske stop. Skødet har op til 5° eftergivelighed ved stopvinklen inden for riggens yderste grænse. Bommens vinkel og hastighed er de samme størrelser, som går ind i sejlberegningen. Udslæk tilføjer ingen kraft til båden.
- På Laserjollen begrænser den eksisterende, faste kickerindstilling, hvor meget skødning ændrer sejlets twist. På Turbåd 43 kan fokken og det valgte ekstra sejl fortsat trimmes hver for sig på Svær. Code 0, gennaker og spiler bruger deres egne modeller for fyldning og kollaps. [ILCA om kicker i hård vind](https://ilcasailing.org/lasers-in-strong-wind/), [UK Sailmakers om storsejlstrim](https://www.uksailmakers.com/encyclopedia/mainsail-trim/), [North Sails om tilsyneladende vind under acceleration](https://www.northsails.com/en-us/blogs/north-sails-blog/puff-response-upwind-northu-bill-gladstone).
- **Skøde slapt** kommer fra linens beregnede belastning. **Sejl luffer** og **Sejl trækker** kommer fra sejlets beregnede tilstand. Telemetrien kan åbnes og lukkes over søkortet. Den fulde måling kan læses som `SAILING_GAME.sheetDiagnostics` i browseren. Fysikkens, gemte bådtilstandes og netværkets skødeværdier bruger stadig den samme skala fra 0 til 1. Vejr og personlige indstillinger gemmer ingen skødeprocent.

## Fri sejlads på Svær

Prøverne startede på åbent, fladt vand uden pust og kystlæ, med samme startposition, kurs, hastighed og vægtfordeling på hvert build. Et virkeligt `input`-event fra skyderen satte 100 → 75 → 50 → 25 → 0 → 25 → 50 → 75 → 100 %, med 1,6 s ved hvert mål. Kurs, fart og krængning udviklede sig frit under hvert gennemløb. Fysiktrinnet er 1/60 s. Tallene i tabellen er sidste måling på trinnet under udslæk. Kraften gælder storsejlets fremadrettede komponent.

| Kurs og vind | Build | 100 % | 75 % | 50 % | 25 % | 0 % |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Kryds · 3,5 m/s | Før | 12,0° / 36,6 N | 21,1° / 27,4 N | 32,3° / -4,5 N | 31,9° / -4,5 N | 33,1° / -4,7 N |
| Kryds · 3,5 m/s | Efter | 12,0° / 36,4 N | 18,4° / 31,1 N | 30,0° / 1,1 N | 31,9° / -4,7 N | 32,5° / -4,8 N |
| Halvvind · 3,5 m/s | Før | 12,0° / 16,8 N | 21,1° / 23,0 N | 37,3° / 48,6 N | 56,1° / 1,3 N | 58,1° / -2,6 N |
| Halvvind · 3,5 m/s | Efter | 12,0° / 17,0 N | 18,4° / 21,7 N | 33,7° / 48,1 N | 54,3° / 8,0 N | 58,4° / -2,7 N |
| Læns · 4,5 m/s | Før | 9,8° / 5,1 N | 19,4° / 11,0 N | 36,2° / 21,1 N | 59,3° / 30,7 N | 86,0° / 33,5 N |
| Læns · 4,5 m/s | Efter | 9,8° / 5,3 N | 16,6° / 9,5 N | 32,6° / 19,1 N | 56,7° / 30,1 N | 86,0° / 34,0 N |

På halvvind nåede bommen fra 33,7° til 58,4° ved 50 → 0 %. Storsejlets krængende moment faldt fra 127,6 til 1,6 Nm. Farten aftog fra 2,36 til 2,06 m/s. Ved 50 % trak sejlet mere fremad end ved 100 %. På kryds fulgte bommen vindvinklen og flyttede sig kun 2,6° yderligere i samme del af skyderen. På læns trak det helt slækkede sejl stadig med 34 N.

Ved 0 → 25 % på halvvind gik der 1,23 s, før linen igen bar last. Begge builds havde en reel periode med slap line. I den nye model stiger kraften efter lineoptagningen, og bommens vinkelhastighed følger begrænsningen. En prøve uden vind viser, at linen trækker ind på begge halser og giver nul udadrettet skødemoment.

I fire gennemløb med piletaster skiftede bommen side under stagvending og bomning på begge halser. Besætningen blev på sin gamle side indtil et tryk på 2. Jollen kom gennem de fire manøvrer uden kæntring.

Racer 32, Turbåd 43 og begge foilbåde gennemførte alle ni skydertrin. Begge foilbåde blev prøvet i vandet og i etableret foiling, indledt ved 11 m/s. På foilmonohullen var den lokale tilsyneladende vind ved storsejlet omkring 73° fra stævnen ved 0 %, mens den sande vind kom fra 126°. Den holdt foiling ved fuldt udslæk i den korte prøve.

På Turbåd 43 holdt storskødet samme værdi under alle forsejlsprøver. Tabellen viser forsejlets fremadrettede kraft i N gennem indhaling, fuldt udslæk og genindhaling. De ekstra sejl blev oppe under udslæk. Efter nedtagning kom standardfokken på 32 m² tilbage.

| Forsejl | Før udslæk | 0 % | Efter indhaling |
| --- | ---: | ---: | ---: |
| Fok | 902 | 81 | 770 |
| Code 0 | 1119 | -141 | 923 |
| Gennaker | 1049 | 38 | 835 |
| Spiler | 1453 | 271 | 1200 |

## Svartid med én og seks både

Med renderkald ved både 30, 60 og 120 Hz tog fuldt udslæk med ↓ holdt nede fra 100 til 0 % 0,63 s mod 0,87 s før. De to lavere billedfrekvenser brugte grafikniveau Lav. 120 Hz brugte Høj. Målingen er taget fra første sample under tastetrykket. Bommens og sejlets sluttilstand efter 2 s var identisk inden for hvert build.

Ved normal browsertakt blev de samme tastetryk målt på Apple M5 med 32 GB RAM, Chrome 157.0.8103.79 i headless tilstand, 1120 × 700 og grafikniveau Lav. Seks både kørte i samme værtssimulation. Procesmålingen med 3× CPU-neddrosling bruger Chromes værktøj og måler uden netværksforsinkelse. Synlig respons måles ved over 2° ændring af den faktisk tegnede bomvinkel.

| Belastning | Første fysisk ændring, før → efter | Bommen flyttet, før → efter | 0 %, før → efter | Største efterslæb efter |
| --- | ---: | ---: | ---: | ---: |
| Én båd | 7 → 12 ms | 55 → 61 ms | 871 → 628 ms | 16,6 ms |
| Seks både | 15 → 14 ms | 80 → 99 ms | 880 → 646 ms | 16,6 ms |
| Seks både · 3× CPU-neddrosling | 27 → 20 ms | 83 → 116 ms | 884 → 668 ms | 16,6 ms |

Fuld udslækning var hurtigere i alle tre kørselstyper. Tidspunktet for den første synlige bombevægelse varierede. Seks både brugte lidt længere tid før den synlige vinkelændring. Der ophobedes højst omtrent ét fysiktrin i disse korte prøver.

## Optagelse, data og begrænsninger

[Råt målesæt som JSON komprimeret med gzip](målinger.json.gz) indeholder forløb fra begge builds, inputtidspunkter, målinger med forskellige billedfrekvenser, vendinger og bomninger, Turbåd 43’s sejl samt målingerne med én og seks både. Rådata indeholder også tilsyneladende vind, bomvinkel og -hastighed, fart, krængning og efterslæb. Linens belastning er et anslået reaktionsmoment i Nm ved bommen. Førmålingen kan kun estimere fjederens del. Eftermålingen medregner også reaktionen ved skødestoppet. En omregning til linekraft i newton kræver en kalibreret model for talje og skødets momentarm.

Prøverne kan gentages med `node scripts/sheet-trials.cjs http://localhost:4173/ /tmp/tack-skode sweep`. De øvrige tilstande er `haul`, `turns`, `cruiser`, `live` og `video`. Det oprindelige build blev målt fra en kopi af `dist`. Testene kontrollerer spillets respons og fortegn i den målte model. Kalibrering af skødemoment, bomudslag og twist kræver tilsvarende målinger om bord på de virkelige bådtyper.

`npm test` bestod 41 af 41 prøver, og `npm run check:simulation` bestod. 35 af 36 Playwright-prøver bestod i sejl-, skøde-, foil- og brugerfladesættet. Katamaranens hårdvindsprøve målte 32,19 m/s ved en testgrænse på 32 m/s. En direkte gentagelse ved 20 m/s vind målte samme topfart i begge builds.
