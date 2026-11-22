# Bølger og Chop i TACK

Testet på [localhost:4173](http://localhost:4173/) med build `3bc3080b4406` fra den lokale arbejdsmappe med `32c26b9` som grundrevision. Førmålingen bruger build `7ff40a671e84`. Optagelserne er lavet i Chrome 157 på Apple M5 ved 960 × 600 CSS-pixel.

## Hvad der blev rettet

- `SailingSettings.normalize` og HTML-skyderen begrænsede Bølger til 1,5 m. Desuden gangede den tidligere `waveProfileFor` dønningen med `1 − chop^1,5`, så den forsvandt ved 100 %. På åbent vand kunne den gamle build tegne dønning ved 0 % Chop. Tæt ved land blev højden yderligere reduceret af lokal opbygning af dønning, en ekstra faktor for fri vandstrækning og et vindstyret amplitudefilter.
- Chop styrede allerede fysiske komponenter og overfladens visuelle krusning. Skyderen blandede dønning over i kort sø. Den korte sø kunne godt dannes alene, men blev dæmpet to gange for fri vandstrækning. Det fælles læfelt beregner nu den dæmpning én gang.
- Bølger angiver dønningens signifikante højde på åbent vand. Chop tilføjer seks kortere komponenter med perioder på ca. 1,1–1,7 s og større retningsspredning. Ved 5 m/s svarer 100 % til cirka 0,40 m signifikant kort sø på åbent vand. Vindstyrken ændrer den korte sø gradvist over en tidsskala på 6 s. Ved maksimumindstillingen har dønningens dominerende komponent en periode på cirka 5,15 s.
- Dønningens indfaldsretning og øernes afskærmning bestemmer, hvor meget dønning når frem. Kort sø opbygges over fri vandstrækning i vindretningen. Den eksisterende dybdemodel tilpasser bølgelængde, fase og højde med den lineære dispersionsrelation `ω² = gk tanh(kh)` og to repræsentative fasefelter nær kysten. Den begrænser også den samlede højde på lavt vand. Modellen er en tilnærmelse og simulerer ingen egentlige brydende bølger. [NOAA om kystbølger](https://oceanservice.noaa.gov/education/tutorial_currents/03coastal1.html)
- Skrog, ror, sværd, køl og foils prøver vandet i verdenskoordinater. Shaderen bruger samme komponenter, seed, kystdata og simulationstid til at flytte vandnettets punkter og beregne hældningen. Nettet flytter med båden, mens faserne beregnes i verden. Højdefeltet forskyder overfladen lodret. Sprøjt og skum bruger fortsat vandkontakt, og de fineste optiske krusninger påvirker kun lyset. I multiplayer bruger værtens båd og de andre både den samme søtilstand, også under overgangen.

En regelmæssig bølge med 2,50 m fra dal til top har 1,25 m amplitude. For det uregelmæssige felt er den viste højde det spektrale mål `Hs = 4 × standardafvigelsen`. De enkelte toppe og dale varierer. [NDBC om signifikant bølgehøjde](https://www.ndbc.noaa.gov/faq/wavecalc.shtml)

## De fire grundprøver

[Før og efter side om side](foer-efter.mp4). Før er til venstre. Rækkefølgen er 0 m / 0 %, 2,5 m / 0 %, 0 m / 100 % og 2,5 m / 100 %, med cirka fem sekunder pr. prøve. Kameraet viser vandet lavt og derefter fra fast sidevinkel. Grønne punkter viser fysikkens vandhøjde over et net på 5 × 5. Orange punkter viser vandprøver ved skroget i den nye build.

Målepunktet syd for Lyø var `x = −1500, y = −1800` i verdenskortet, med 27,84 m dybde og mindst 6,5 km fri vandstrækning i modellen. Vinden var 8 m/s fra vest, uden vindstød, med seed `2647`. Hver række bruger 1.800 punkter over 144 s simulationstid.

| Valgt på skyderne | Før, anvendt på skyderne | Før, målt Hs | Efter, målt dønning og kort sø | Efter, målt samlet Hs | Efter, laveste og højeste punkt |
|---|---|---:|---:|---:|---:|
| 0 m / 0 % | 0 m / 0 % | 0,00 m | 0,00 m + 0,00 m | 0,00 m | 0,00 til 0,00 m |
| 2,5 m / 0 % | 1,5 m / 0 % | 1,39 m | 2,62 m + 0,00 m | 2,62 m | −1,43 til +1,43 m |
| 0 m / 100 % | 0 m / 100 % | 0,25 m | 0,00 m + 0,44 m | 0,44 m | −0,27 til +0,30 m |
| 2,5 m / 100 % | 1,5 m / 100 % | 0,25 m | 2,62 m + 0,44 m | 2,66 m | −1,47 til +1,54 m |

Ved 2,5 m brugte modellen den normaliserede værdi 2,50 m på åbent vand. Den målte dønning lå på 2,62 m i de korte vinduer og 2,49 m over yderligere 900 s. 50 % og 100 % Chop gav henholdsvis 0,22 m og 0,44 m kort sø i den længere måling. Dønningens højde var også 2,49 m ved 0 m/s vind. I de fire korte vinduer passerede hhv. 0, 28, 91 og 29 opadgående nulkrydsninger ved målepunktet. Et 160 m langt snit langs bølgeretningen viste fire dønninger med højder mellem −1,31 og +1,33 m på samme tidspunkt.

Den oplevede flade sø kunne genskabes ved kortets nulpunkt. Der gav den gamle maksimale indstilling og 0 % Chop kun 0,012 m Hs. I den nye build gav 2,5 m og 100 % Chop samme sted samlet 0,46 m Hs. Den frie strækning mod vest var kun 9,30 m. Syd for Bjørnø gav nordlig vind og nordlig dønning 0,82 m samlet Hs. Da dønningen kom fra vest, steg den samlede højde samme sted til 2,50 m, mens den lokale vind blev ved 7,48 m/s. Det er modelmålinger i spillets komprimerede øhav.

## Kontrol i browseren

- Prøven skiftede indstillingerne i vejrpanelet under Fri sejlads og nåede 2,45 m og fuld Chop efter 4,7 s simulationstid. Under manuel pause vises den valgte værdi med det samme og den anvendte værdi fastholdes indtil genoptagelse. Begge skydere bevarer deres værdier efter genindlæsning. Racepanelets pause er også afprøvet.
- Shader og fysik blev sammenlignet over eksponeret og lavt vand, også ved retningsskift. Ved Turbåd 43 brugte prøven de faktiske netafstande omkring 6 m fra båden. Største afvigelse i målepunkterne var ca. 1,0 mm på Lav og 0,3 mm på Høj. Fysikken har samme felt på begge grafiktrin. Skærmtesten omfattede bølgegeometri tæt ved skroget. Fjerne detaljer forenkles stadig.
- I en kontrolleret medsøprøve med 1,35 m dønning og 0 % Chop gav forsiden af en enkelt bølge 76 N i udbredelsesretningen. Efter 0,75 s var Laserjollens fart i bølgeretningen 5,36 m/s mod 5,05 m/s på fladt vand. På bagsiden var kraften −206 N, og farten var 4,37 m/s mod 5,12 m/s på fladt vand efter 2 s. Båden bevægede sig efter kræfterne efter start. Prøven viser acceleration og bremsning på en enkelt bølge. Vedvarende surf og præcis kalibrering mod rigtige både kræver feltdata.
- To faktiske browserklienter i en lokal lobby modtog 2,5 m og 100 % Chop. Under overgangen brugte begge både på værten samme tid, amplitude, ændringshastighed og profil. Klienterne beregnede ens højde, hældning og vandhastighed for samme synkroniserede position og tidspunkt. Multiplayertesten brugte lokal WebSocket-server.

### Sejlads på Lav grafik

[Laserjolle og Turbåd 43 fra følgekameraet](sejlads.mp4). Første del viser 0,70 m dønning og 0 % Chop. Anden del viser 0 m og 100 % Chop. Sejladsen blev initialiseret på målepunktet, og derefter blev ror og skøde betjent med spillets taster. Bådposition og krængning kom fra simulationen. Tabellen angiver spændet mellem højeste og laveste værdi i de korte forløb på cirka seks sekunder.

| Båd | Dønning, lodret bevægelse / stampning | Kort sø, lodret bevægelse / stampning |
|---|---:|---:|
| Laserjolle | 0,51 m / 3,4° | 0,39 m / 13,1° |
| Racer 32 | 0,49 m / 3,4° | 0,14 m / 2,4° |
| Turbåd 43 | 0,50 m / 3,2° | 0,05 m / 2,2° |
| AC75 | 0,63 m / 2,0° | 0,19 m / 1,1° |
| AC72 | 0,47 m / 1,2° | 0,26 m / 1,2° |

Alle fem reagerede på rorinput, uden grundkontakt eller kæntring i disse forløb. Laserjollen blev også sejlet med 2,5 m og 100 % på Lav og bevægede sig 1,19 m lodret gennem forløbet. De korte foilprøver begyndte med skrogkontakt. Foilunderstøttelse og landinger blev derudover dækket af den særskilte bølgetest.

### Ydelse og testresultat

På Apple M5 med Chrome, Lav grafik og 828 × 518 renderpixel var medianen for tiden mellem tegnede billeder 16,7 ms før og efter, både med én båd på åbent vand og med seks både i værtens scene. Ved seks både var P95 for billedintervallet 16,8 ms før og 16,7 ms efter. P95 for GPU-målingen steg fra 2,48 til 4,45 ms i samme korte prøve. Ydelsesmålingen bruger 0,38 m og 42 % Chop og gælder den testede maskine og scene. Den dokumenterer ikke ydelsen på alle enheder.

`npm test` bestod 41 prøver. Typekontrollen og 47 browserprøver for vand, bådrespons, vejr og netværk bestod. To yderligere vindpilprøver ved Dyreborg fejlede også på før-builden. Den ene registrerede ingen forventet forskel i vind ved de valgte rutepunkter. Den anden fandt ingen af de langsomme pile ved det udpegede kystpunkt. Bølgelæet er afprøvet separat med numeriske prøver og en sammenligning af grafik og fysik.

### Gentag optagelser og prøver

```sh
npm run build
FRONTEND_DIR=dist FRONTEND_PORT=4173 npm run dev
# Kør derefter i en anden terminal
node scripts/sea-settings-review.cjs http://localhost:4173/ /tmp/tack-boelger clips
node scripts/sea-settings-review.cjs http://localhost:4173/ /tmp/tack-sejlads sail
TACK_URL=http://localhost:4173/ npx playwright test tests/waves.test.js tests/wave-calibration.test.js tests/surf.test.js tests/waves-network.test.js --workers=1
node scripts/render-performance.cjs http://localhost:4173/ /tmp/tack-ydelse low
```

Åbn spillet med `?vandproever` for at vise vandprøverne. `SAILING_GAME.seaDiagnostics` i udviklerværktøjerne viser valgt og anvendt søtilstand, simulationstid, dybde, afskærmning og den aktuelle bølgehøjde ved båden. [Crest om vandprøver](https://docs.crest.waveharmonic.com/Manual/Advanced/Queries.html)
