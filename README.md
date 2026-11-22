# TACK · Sailing Simulator

Sejlspil med fem bådtyper, fri sejlads og kapsejlads i Det Sydfynske Øhav omkring Faaborg. `index.html` er udviklingsudgaven og indlæser blandt andet himmel, besætningsrig og øhav fra `assets/`. `index (11).html` er den uændrede baseline fra den tidligere gennemgang. Three.js med MIT-licens og den oprindelige dokumentation er indlejret i HTML-filen.

Se [den nye vejrmenu](gennemgang/vejrmenu/README.md) for før/efter og layoutmålinger. Se [afleveringen](gennemgang/aflevering/README.md) for de seneste prøvesejladser, seksbådsløbet, bådprofiler, klip og ydelsesmålinger.

Se [grafikgennemgangen](gennemgang/grafik/README.md) for besætning, materialer, vandkontakt og før/efter-klip. Kilder og licenser står i [ASSETS.md](ASSETS.md).

Se [vindgennemgangen](gennemgang/lae/README.md) for vindkort, kalibrering og prøvesejlads ud af læ.

## Kør lokalt

Kræver Node.js og npm. Start frontend og live-tjeneste i hver sin terminal.

```sh
npm ci
npm run dev         # http://localhost:5173
npm run realtime    # WebSocket på port 3001
```

Åbn [TACK på localhost](http://localhost:5173/). Vælg **Fri sejlads** eller **Kapsejlads** for at gå i gang. Brug venstre og højre pil til ror, op og ned til trim samt 1–3 til besætningen. Kameraet skifter ét trin pr. tryk. Førsteperson viser udsigten fra rorsmandens øjenhøjde. Før musen over kortet eller tryk på det på touchskærme for at vise kortværktøjerne. Træk i kortets nederste venstre hjørne for at ændre størrelsen. Grafik, kort, kamera og vindpile er personlige valg. Lobbyen bruger en sekscifret kode. Den offentlige gratisversion har to pladser, og den lokale serversimulation kan køre med seks. Værten vælger fælles vejr og bane.

Byg og afprøv produktionsfrontenden med samme lokale live-tjeneste.

```sh
npm run build
FRONTEND_DIR=dist FRONTEND_PORT=4173 npm run dev   # http://localhost:4173
```

Uden en offentlig adresse bruger en lokal HTTP-side WebSocket på samme værtsnavn og port 3001.

### Offentlig multiplayer

[Vercel-frontend](https://tack-sailing-simulator.vercel.app/) bygger `dist/` med `npm run build`. Fejlen om en manglende live-adresse kommer fra `assets/lobby.js`, når `dist/assets/config.js` har en tom `FRI_VIND_REALTIME_URL`. Buildet læser **`VITE_REALTIME_URL`** for historisk kompatibilitet med projektets deployment. Projektet bygger med Node og bruger ikke Vite.

1. Opret en Render Web Service fra GitHub med `render.yaml` eller de samme felter manuelt. Kør én instans i Frankfurt med `npm ci --omit=dev` og `npm run realtime`. Serveren lytter på `0.0.0.0` og Render-porten `PORT`. Render afslutter TLS for WebSocket-adressen.
2. Sæt `TACK_LIVE_AUTHORITY=browser` i Render-miljøet eller i tjenestens startkommando for at bruge gratisversionen. Kontrollér `https://<server>/health` og gennemfør en rigtig WebSocket-oprettelse med `node scripts/smoke-live.cjs wss://<server> https://tack-sailing-simulator.vercel.app`. Svaret viser serverbuild, protokol og verdensversion. Smoke-prøven opretter og lukker en lobby.
3. Sæt `VITE_REALTIME_URL=wss://<server>` i Vercel **Production** og **Preview**. Byg og deploy på ny. `dist/assets/config.js` i den byggede version skal indeholde adressen. Brug spillets **Sejl sammen** fra den publicerede adresse til den afsluttende prøve.

`render.yaml` vælger én gratis instans og to spillerpladser. En gratis instans kan gå i dvale efter inaktivitet, og næste opstart kan tage omkring et minut. [Render om WebSocket og TLS](https://render.com/docs/websocket) · [Render om Free-instansers dvale](https://render.com/docs/free) · [Vercel om miljøvariabler](https://vercel.com/docs/environment-variables)

`TACK_WEB_ORIGINS` kan afgrænse forbindelser til en kommasepareret liste af de godkendte frontendadresser. Med en tom liste kan Production og genererede Preview-adresser forbinde. `TACK_TRUST_PROXY=1` er til brug bag hostingmiljøets proxy. Serveren logger lobby- og spiller-id’er, oprettelse, tilslutning, afbrydelse, fejl og værtskift. Genforbindelsesnøgler behandles gennem WebSocket-forbindelsen og browserens sessionslager.

### Test

```sh
npm test                            # enheds- og WebSocket-prøver
npm run test:browser                # brugerflade, miljø, sejl og multiplayer
npm run test:physics                # kræfter, massepunkter og manøvrer
npm run test:physical-courses       # alle fire standardbaner med ror og trim
FRI_VIND_TEST_FRONTEND=dist npm run test:physical-fleet
npm run test:six-rigs               # seks klienter med blandede rigs
```

Browserprøverne bruger Playwright og Chrome. Standardkørslen bruger én testarbejder, så lokale flerklientprøver ikke konkurrerer om maskinen. Angiv `CHROME_PATH` for en anden Chrome-installation. Optagelser i afleveringen kan genskabes med `node scripts/review-manoeuvres.cjs` og kræver også ffmpeg.

## Simulation og live-tjeneste

- Den offentlige gratisversion bruger én Render-proces til lobbykoder, invitationer, adgang, genforbindelse, fælles indstillinger og videresendelse via WSS. Værtens browser beregner bådene, fælles vand og vind, kollisioner, startlinje, mærker og målgang i en Web Worker. Render samler den fælles resultatliste fra værtens rapporter. Hold værtens fane åben under sejladsen. Værtens browser er en del af fysikkens tillidsmodel.
- `TACK_LIVE_AUTHORITY=server` er standard lokalt og lader Node køre samme `RoomSimulation` til seks spillere. Begge driftstilstande bruger de samme bådprofiler, kræfter og faste trin på 1/60 sekund. Én instans bør vælges efter målt kapacitet, hvis den skal beregne fysikken for flere aktive både.
- Gratisversionen sender tilstandsopdateringer op til ca. 15 gange i sekundet. Node-simulationen sender op til ca. 20. Egen båd forudsiges lokalt og rettes efter kvitterede input. Andre både udglattes mellem modtagne tilstande. Forældede positionsopdateringer springes over ved sendekø.
- Én proces ejer lobbyerne i hukommelsen. En plads er reserveret i 30 sekunder under genforbindelse. Fri sejlads tillader nye deltagere, når der er plads. Kapsejlads låser nye pladser fra nedtællingen, til værten vender tilbage til lobbyen.
- Ved et kort udfald kan værten genforbinde fra den samme fane og fortsætte med sin worker. Ved lukning, genindlæsning uden en aktiv worker eller overdragelse af værtsrollen går gratisversionen tilbage til lobbyen med de tilbageværende spillere. Værtsrollen går til den først tilsluttede forbundne spiller. Genstart af Render afslutter de midlertidige lobbyer.
- `npm run test:physical-fleet` afprøver serverens fysiske sejlads fra start til mål på begge banetyper og kører en særskilt seksbrowserprøve for fælles bane og starttid. `tests/lobby.test.js` afprøver invitation, sejlads og genforbindelse. `tests/latency.test.js` afprøver styringen med 150 ms rundtur.

## Billeder

De tidligere, bevarede præsentationsbilleder i `assets/` er genereret med OpenAI’s indbyggede billedværktøj til dette projekt, ikke hentet fra fotoarkiver. Fælles prompt: fotorealistisk sejlbåd set skråt fra siden på skandinavisk blåt vand, fuld båd og rig, dagslys, ingen tekst eller logo. De fem motiver var henholdsvis: lille Laser-lignende jolle med ét sejl; hurtig 5,25 m sportsjolle med ét square-top storsejl og uden fok; 40-fods tursejlbåd med kahyt, storsejl og fok; AC75-inspireret monohull med foil-arme; AC72-inspireret katamaran med to skrog og foils. Disse ældre billeder er illustrationer, ikke dokumentation for bestemte virkelige både. Bådvælgeren bruger nu i stedet `model-*.webp`, der er gengivet fra spillets egne modeller.

## Kapsejladsbaner

Version 12 af banemodellen har Op/ned og Trekant i kort og lang udgave. Modellens mærker, linjer og sekvens bruges af kort, 3D-scene og passageregistrering. Banen lægges efter vindretningen ved opsætning og flyttes ikke ved senere vindskift. Geometrien og rutevalgene bygger på [Dansk Sejlunions kapsejladsbaner](https://dansksejlunion.dk/kapsejlads/information-om-maerkebaade/kapsejladsbanen) og opgavebeskrivelsen. Banestørrelser er spilkalibrering.

Alle fire standardruter er gennemsejlet med fysisk ror og trim. Separate geometriprøver dækker blandt andet rundingsside, gatevalg, tyvstart, genstart ved redning og hurtige linjepassager. Kort Trekant er derudover gennemført med seks tilsluttede browserklienter og fælles resultat. Nye spillere venter med at deltage, til værten har åbnet lobbyen igen.

Åbn **Kapsejlads** og vælg **Baneeditor** i baneopsætningen. Indstil referencevinden. Vælg **Læg udkast** for et forslag, eller **Byg selv** for at placere start, mærker og mål på et tomt søkort. Redigér derefter rækkefølgen og rundingssiderne. Stedernes position er fast under sejlads, også efter vejrskift. **Tilpas til aktuel vind** ændrer placeringen eksplicit med mulighed for at fortryde. Baner gemmes i browserens eget bibliotek og kan eksporteres og importeres som JSON. En gæst kan redigere sine egne baner. Værten vælger den fælles bane, og de andre klienter modtager modellen, når løbet startes.

## Det Sydfynske Øhav omkring Faaborg

Spillets udgave af øhavet bruger en fjerdedel af de geografiske afstande. Fra Faaborgs færgeleje er der i lige linje cirka 770 m til Bjørnø Bro, 1.740 m til Lyø Havn og 1.527 m til Avernakø Havn. Søkortets målestok viser afstandene i spillet og bruger de samme koordinater som bådene, kysterne og havnene. Standardbanernes ben følger samme skala, og startlinjen afpasses efter bådenes længde. Gemte baner fra det tidligere kort omregnes, når de åbnes.

Kystlinjer, veje og stednavne er udtrukket og forenklet fra OpenStreetMap. Terrænhøjden er interpoleret fra Copernicus GLO-30. Det samme terræn bruges af landkontakt, kystlæ og 3D-scenen, mens bølgefeltet også bruger vandstrækningen op mod vinden. Havbunden er en beregnet spilmodel, og havnenes bygningsdetaljer er stiliserede. [Datakilder og licenser](ASSETS.md)

Kystprofilerne fra spillets tidligere komprimerede kort er bevaret i de historiske målinger. Se den aktuelle [læprøve ved Dyreborg](http://localhost:4173/?proeve=lae) og [vindkortet](http://localhost:4173/assets/vindkort.html).


## Bølger

Se [vandgennemgangen](gennemgang/vand/README.md) for før/efter-lag, kontrolpunkter og sejlads i mod-, tværs- og medsø.

**Chop** blander to typer sø. Ved 0 % er der lange, bløde dønninger, som kan give båden fart på forsiden og bremse den på bagsiden. Ved 100 % dominerer korte, krydsende vindbølger med bølgelængder på ca. 2–5 m. Vindbølgerne møder skroget hyppigere. **Bølger** bestemmer dønningens højde ved 0 % Chop på åbent vand. Grundvinden kan indstilles til 20 m/s. Vind og kystlæ påvirker den korte sø, og dønningens påvirkning aftager, efterhånden som Chop skrues op. [NOAA om forskellen på vindbølger og dønning](https://www.ndbc.noaa.gov/waveobs.shtml)

Vandshaderen og bådfysikken deler bølgefelterne og dybdekortet. Spillet beregner kortere bølgelængder over lavere bund med `ω² = gk tanh(kh)` og lægger faseændringen langs indfaldsretningen. Højden kan stige på vej over en banke, før meget lavt vand dæmper bølgerne. Fronterne bruger en repræsentativ periode for hver bølgefamilie. [WMO om bølger i lavt vand](https://www.imgw.pl/sites/default/files/2021-06/guidetowave-analysisandforecasting.pdf)

[Bølgeprøven med Turbåd 43](http://localhost:4173/?proeve=boelger) åbner cockpittet i bølger fra vest. [Bølgeprøven med Laserjolle](http://localhost:4173/?proeve=boelger&baad=laser) åbner sidekameraet ved 6,2 m/s og en målhøjde på 0,82 m på åbent vand.

Hver neddykket volumencelle får ud over lodret opdrift en vandret bølgekraft beregnet ud fra det fortrængte vands masse og bølgens lokale partikelacceleration. Bølgens forside kan drive skroget fremad, og bagsiden kan bremse det. Laserjollen og Racer 32 beregner planingsløft ud fra den lokale vandstrøm langs den våde skrogbund. Når planingsløftet bærer en del af vægten, falder skrogets egen bølgemodstand. Fartloggen viser fart relativt til middelstrømmen, mens ror, sværd og foils bruger den øjeblikkelige lokale vandbevægelse. `waveComponent` er en intern testmulighed til at isolere én regelmæssig komponent. [Forsøg med bølgekraft og surf](https://www.jstage.jst.go.jp/article/jjasnaoe1968/1982/152/1982_152_192/_article/-char/en)

De tidligere målinger og klip i `gennemgang/` viser den forrige bølgekalibrering i mod- og medsø, med og uden foils. De aktuelle browsertests kontrollerer tæt vindsø, bølgedæmpning ved land, bådrespons, fælles vejr i multiplayer og samme bølgehøjder i CPU og GPU.

## Trim og besætning

På både med storsejl ændrer en bevægelse på skyderens slække halvdel, 0–50 %, bommens frie vandring mere end på den stramme halvdel. Ved 0 % er skødet sluppet helt, så vinden kan føre sejlet ud, så langt riggen tillader. På læns kan sejlet stadig trække.

[Sejladsgennemgangen](gennemgang/haandtering/README.md) viser vindlæ ved Faaborg, Laserjollens stagvending med tastatur og den målte fartforskel til Racer 32.

Hastigheden falder gradvist under indhaling, så små tryk på ↑ giver finere justeringer tæt på 100 %. På Laserjollen tog 0–50 % cirka 1,47 sekunder og 50–100 % cirka 2,45 sekunder. Fra helt indhalet til helt slækket tager det nu cirka 1,23 sekunder med ↓. Procenten falder jævnt, og skødet giver mere line pr. procent under 50 %. Bommens bevægelse og sejlkraften afhænger af vind og båd. Se [skødegennemgangen](gennemgang/skode/README.md) for målinger og optagelse.

Den assisterede position 2 flytter vægten gradvist gennem båden ved sideskift; position 3 holder den tidligere side, indtil spilleren vælger position 2. Totalmassen er konstant. En browserkontrol med påtvunget kæntring målte automatisk opretning på højst 4,4 aktive sekunder for de fem både i de testede forhold.

Gæstens kontrolpakker bærer hvert sit sekvensnummer og den faktiske type af trim- og rorinput. Efter genforbindelse venter gæsten på et autoritativt snapshot. Snapshots kvitterer for seneste behandlede input, hvorefter nyere input genafspilles. Dette er en forenklet klientforudsigelse; længere forløb med varierende forsinkelse og pakketab mangler stadig systematisk måling.

## Sejlmodel

Vindfeltets vektorer beskriver luftens bevægelse **mod** en retning i verdenskoordinater; vindinstrumentet viser, hvor vinden kommer **fra**. Et sejlpunkt bruger luftens lokale hastighed minus punktets hastighed. Punktets hastighed indeholder bådens translation, rulning, pitch, yaw og for storsejlets angrebspunkter bommens bevægelse. Skrogets position bruges til vandkontakt og grafik. Fysikken integrerer translation og rotation om det aktuelle tyngdepunkt og omregner tilbage til skrogets bevægelse. Det er en forenklet model: de bløde jollers kraftintegral bruger de vandrette komponenter og medtager ikke fuld 3D-strømning rundt om sejlet.

De bløde storsejl integreres over tre højdesektioner; hver får sin egen relative vind, angrebsvinkel, effektive dybde og belastning. Et separat forsejl tælles én gang. Lift- og dragkoefficienterne, stallovergangen, skødets maksimale fem graders elastiske overtræk og dæmpningen er spilparametre, ikke vindtunnelmålinger. Sektionsarealerne summerer til modellens referenceareal. Det stive katamaransejl beregnes som ét vingeareal med flap og separat fok, mens monohullens to synlige sejlduge tilsammen er ét hovedsejl. Foilriggene bruger ét repræsentativt angrebspunkt pr. sejl; der er ikke implementeret et fuldt sektionsintegral for dem.

`state.rig` opdateres ved hvert fysiktrin og indeholder side, glidende sideskift, bug, twist og fyldning. Den samme tilstand påvirker både kræfter og de store ændringer i mesh. Telltales på jollen anvender den nærmeste aerodynamiske sektion; små vibrationer beregnes visuelt af simulationstiden og giver ikke ekstra kræfter. Besætningsside er separat. Skødeindstillingen ændrer en vinkelgrænse; når bommen strækker skødet, kan linen kun trække indad. Rigdata indgår i de autoritative snapshots, og andre både interpoleres visuelt mellem snapshots. Animationen følger simulationstid og står stille ved pause.

På **Svær** kan et vindskift på læns slå en udslækket bom over. Skødet fanger bommen, og ændringen i bommens bevægelse påvirker bådens drejning. Vindpust og sejlets angrebsvinkel bestemmer, hvor meget den bløde dug blafrer. Den samme bevægelse påvirker sejlkræfter, grafik og lyd. Katamaranens vinge er stiv, mens fokken kan blafre. [RYA om kurser og ustabilitet på læns](https://www.rya.org.uk/training/do-you-know-your-points-of-sail/) · [North Sails om blafrende sejl og rorbalance](https://www.northsails.com/en-us/blogs/north-sails-blog/steering-upwind)

Modellen bruger samme lokale vindfelt i pust og på vandet, men er ikke en målt CFD- eller vindprofilmodel. Code 0 og spiler bruger ét repræsentativt angrebspunkt og en kalibreret blanding af løft og tryk. Se [NASA om relativ hastighed](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/velocity-effects/), [NASA om stall og modstand](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/inclination-effects-on-drag/), [North Sails om bomnedhal og twist](https://www.northsails.com/en-us/blogs/north-sails-blog/albacore-tuning-guide) og [UK Sailmakers om Code Zero](https://www.uksailmakers.com/racing/spinnakers/code-zero/). `tests/sail-state.test.js` kontrollerer blandt andet vindstille, relativ vind, kvadratisk kraft, spejling, sideskift og pause. `npm run test:six-rigs` anvender seks separate browserklienter og den lokale WebSocket-tjeneste til at kontrollere rigtilstande; den tester ikke et fuldt løb eller længere forsinkelse. Optagelser kan genskabes med `node scripts/record-sails.cjs`.

## Bådene og spileren

Bådlisten består af Laserjolle (4,23 m), Racer 32 (9,75 m), Turbåd 43 (13,1 m), foilmonohull og foilkatamaran. De gamle interne identiteter `dinghy` og `yacht` er bevaret i live-protokollen af hensyn til kompatibilitet. Racer 32 er en fiktiv 9,75 m kølbåd. Sejlklar masse er 2.200 kg inklusive 760 kg ballast og tre besætningsmedlemmer på hver 80 kg. Position 3 flytter besætningen ud i trapez. Deres led og masse indgår i tyngdepunkt og inerti. Turbådens model vejer 9.600 kg inklusive fire besætningsmedlemmer på tilsammen 300 kg og har separat ballast og inerti. Besætningens fire positioner indgår i tyngdepunktet og følger den samme animation hos alle spillere. Billederne `assets/model-*.webp` er optaget fra spillets egne 3D-modeller.

Turbåd 43 har tre ekstra forsejl. **Code 0** er et fladt sejl på 90 m² til skæring og halvvind i let vind. Den hvide **gennaker** på 105 m² har en rundere facon til slør. **Spiler** på 115 m² sættes med spilerbom til dybt slør og læns. Hvert sejl har sit eget arbejdsområde i den relative vind. Arealer og grænser er spilkalibrering. [UK Sailmakers om Code 0 og asymmetriske sejl](https://www.uksailmakers.com/2025/04/11/code-zero-reaching-spinnaker/) · [North Sails om gennaker og symmetrisk spiler](https://www.northsails.com/blogs/north-sails-blog/selecting-the-right-downwind-sails-for-your-multihull)

Vælg ét ekstra sejl ved trimmet. Ved skift tages det første ned, før det næste sættes. Hver sætning eller bjærgning tager fire simulationssekunder, og fokken rulles ind, mens det ekstra sejl sættes. På **Svær** bliver det valgte sejl oppe ved kursændringer. Dugen blafrer og giver modstand, når den mister vinden. Fald af for at fylde sejlet igen, eller tryk på det valgte sejl for at tage det ned. På **Let** venter besætningen på en egnet kurs, bjærger sejlet efter fire sekunder uden for dets arbejdsområde og sætter det igen, når forholdene passer. Under **Detaljer** kan du rebe storsejlet og vælge lille fok. På **Svær** vælger du her også, hvilket sejl trimskyderen og piletasterne regulerer.

Katamaranen har et opdelt stift vingeprofil med flap og en separat, blød fok. Vinge og fok tæller tilsammen 260 m² i kraftmodellen; flap og profil er dele af vingens areal og giver ikke et ekstra areal. Vingens flap, twist og fokkens vinkel skifter gradvist. Seksbrowserkontrollen bruger den rigtige live-tjeneste; bådkontakt er også kontrolleret med to rigtige klienter. Det fulde seksbådsløb brugte seks Laserjoller, mens den særskilte rigprøve omfattede alle fem bådtyper.

## Visuel kontrol og ydelse

**Grafikkvalitet** står på **Auto** som standard. Spillet sænker 3D-opløsning og detaljeafstand efter vedvarende lav billedhastighed og hæver dem gradvist igen. Skyderen kan også sættes på **Lav**, **Mellem** eller **Høj**. Alle niveauer bruger samme vejrsigt, kystkonturer og synsafstand til andre både. Se [ydelsesmålingen](gennemgang/ydelse/README.md) for målinger, reproduktion og billeder.

Bådenes geometri og animationer bygges i `index.html`. `gennemgang/modelkontrol/sammenlign.html` sammenstiller den aktuelle model med de valgte referencebilleder, herunder et manuelt justerbart overlay. Referencerne er kun til kontrol og er ikke spillets assets. `node scripts/boat-presentations.cjs` genskaber alle fem bådvælgerbilleder fra spillets scene, mens spillet kører lokalt på port 5173.

`node scripts/visual-qa.cjs` måler en otte sekunders scene med standardkamera, 1280 × 720 og høj grafik. Med `QA_VIDEO=1` optages også et forløb med besætningsskift og styreinput. Browsersti kan angives med `CHROME_PATH`. Måling, sammenligningsbilleder, optagelse og konkrete resterende afvigelser findes i `gennemgang/visuel-2026-11-19/`.

### Følsom foiling og trapez

Et kort tryk på en piletast giver et lille rorudslag. Et længere tryk drejer mere. Foilbådene får større rorudslag og reagerer hurtigere, når de løfter skroget fri af vandet. På begge niveauer styrer du ror og skøde. Når du slipper styrepilen, går roret tilbage mod midten. På **Let** flytter besætningen vægten automatisk. Du kan slå sejlbakning i vindøjet til under **Sejlhjælp**.

I hård vind kan båden skære op, miste fart eller kæntre. Slæk med **↓**. På foilmonohullen kan du også vælge mindre storsejl og fok under **Detaljer → Reb sejlene**.

På Racer 32 læner besætningen sig ud i trapez i position 3. Se [fysikgennemgangen](gennemgang/fysik/README.md) for fart, krængning og måleforhold.

### Vægt og kamera

Alle tre besætningsvalg flytter faktisk masse og ændrer tyngdepunkt og rullemoment. Mindre bevægelser i hoved, arme og ben er visuelle og ændrer ikke den fysiske massefordeling. På turbåden flytter de fire personer sig gradvist fra cockpit mod luv. På foilbådene flytter besætningen sig inden for arbejdspladserne, så hvert valg giver en særskilt modvægt. Størrelsen af virkningen afhænger af bådens og besætningens masse. Kamera skiftes trinvis med knappen i menuen til højre eller med C. Kortets størrelse gemmes lokalt og kan ændres med hjørnehåndtaget under multiplayer. Vejr og personlige indstillinger vises hver for sig.

På **Svær** vælger du vægtpositionen med **1–3**. Trykket placerer besætningen mod den lokale vind i forhold til stævnen. Tryk **2** i vindøjet under en stagvending for at flytte besætningen til den nye side. Ved vind lige for eller agter samt vindstille kan du vælge side med **Q/E** eller de tilsvarende touchknapper. **Z/X** flytter vægten langs båden. Samme indstilling findes som skyder under **Detaljer**. På foilbådene er bevægelsen begrænset til 15 cm frem eller tilbage inden for arbejdspladsen. **↓** slipper skødet hurtigt. Brug **1** til at få vægten ind, hvis jollen er på vej over mod den side, du hænger på. Roret bruger vandstrømmen langs den del af bladet, der er neddykket.


Fysikkens aktuelle definitioner, kilder, kalibrering og kendte begrænsninger beskrives i [fysikoversigten](gennemgang/fysik/README.md).

## Læ bag øer og kyst

Spillet beregner et lokalt læfelt ud fra de samme håndtegnede kystpolygoner som landkontakten. For et punkt på vandet følges en linje mod den retning, vinden eller bølgerne kommer fra; land på den linje reducerer påvirkningen på læsiden. Effekten er størst nær land og aftager gradvist ud over vandet. Vindlæets styrke tager desuden højde for øernes forenklede højder; højere land bag en lav ø kan fortsat give det stærkeste læ. Vindens lokale styrke bruges til instrumenter, vindspor, vandets små lyskrusninger og sejlenes kraftpunkter; læet bliver mindre højere over vandet. Bølgemodellen beregner særskilt læ for dønning og vindbølger efter deres respektive indfaldsretninger. Den lokale dæmpning indgår i bølgehøjde, hældning, vandoverfladens hastighed og vandets partikelbevægelse. Vandets shader bruger de samme felter som bådfysikken.

Dette er en deterministisk spiltilnærmelse, ikke en meteorologisk eller kysthydraulisk beregning. Feltet beregnes på et 96 × 96 gitter, retninger afrundes til hele grader, og bølger i læ dæmpes uden at forsvinde helt. Det sidste er en forenklet repræsentation af, at bølger kan brede sig omkring en hindring; modellen simulerer ikke egentlig diffraktion, refleksion eller detaljeret turbulens. Uden for feltets dækningsområde bruges åbent vand. Øernes og kystens placeringer er fortsat komprimerede spildata. Fænomenet bølgediffraktion er blandt andet beskrevet i [US Army Corps of Engineers' kystordliste](https://www.publications.usace.army.mil/Portals/76/Publications/EngineerManuals/EM_1110-2-1100_App_A.pdf?ver=2014-03-10-140035-443).

`npx playwright test tests/shelter.test.js --workers=1` kontrollerer læ bag Bjørnø, vindens aftagende læ med højde, forskellige vind- og dønningretninger samt sammenhæng mellem den beregnede bølge og GPU-vandoverfladen.
