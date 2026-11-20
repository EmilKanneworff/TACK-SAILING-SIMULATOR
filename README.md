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

Åbn [TACK på localhost](http://localhost:5173/). Vælg **Fri sejlads** eller **Kapsejlads** for at gå i gang. Brug venstre og højre pil til ror, op og ned til trim samt 1–3 til besætningen. Kamera og kortstørrelse skifter ét trin pr. tryk. Grafik, kort, kamera og vindpile er personlige valg. Lobbyen bruger en sekscifret kode og accepterer op til seks spillere. Værten vælger fælles vejr og bane.

Byg og afprøv produktionsfrontenden med samme lokale live-tjeneste.

```sh
npm run build
FRONTEND_DIR=dist FRONTEND_PORT=4173 npm run dev   # http://localhost:4173
```

Lokal produktion bruger port 3001, når `VITE_REALTIME_URL` er tom. Til en offentlig statisk build sættes buildvariablen til den separate live-tjenestes `wss://`-adresse. `vercel.json` peger på `dist/`. Live-tjenesten kører med `npm run realtime` og læser `PORT`. Lobbyerne ligger i én proces i hukommelsen og går tabt ved genstart. Den aktuelle leverance er afprøvet lokalt.

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

- Frontenden tegner øhavet, riggen og vandet i Three.js. Kort, 3D og passagekontrol bruger det samme banemodelobjekt.
- Værtens browser kører den fælles fysik med et fast tidsskridt på 1/60 sekund. Den beregner gæsternes både, kollisioner, redninger og resultater. Bådkontakt bruger en forenklet ellipsemodel.
- Live-tjenesten håndterer lobbyer, tilladelser og videresendelse af styreinput og snapshots. Gæster genafspiller input, som endnu ikke er bekræftet, og udglatter positionen i visningen. Et værtsstop sætter den fælles sejlads på pause, mens klienterne venter på genforbindelse.
- Lokal kontrol har gennemført et helt seksbådsløb og verificeret fælles resultater. Separate prøver kontrollerer individuelle styreinput, andre rigtyper, kort afbrydelse, genforbindelse og 150 ms rundtur. Se [resultater og testbetingelser](gennemgang/aflevering/README.md).

## Billeder

De tidligere, bevarede præsentationsbilleder i `assets/` er genereret med OpenAI’s indbyggede billedværktøj til dette projekt, ikke hentet fra fotoarkiver. Fælles prompt: fotorealistisk sejlbåd set skråt fra siden på skandinavisk blåt vand, fuld båd og rig, dagslys, ingen tekst eller logo. De fem motiver var henholdsvis: lille Laser-lignende jolle med ét sejl; hurtig 5,25 m sportsjolle med ét square-top storsejl og uden fok; 40-fods tursejlbåd med kahyt, storsejl og fok; AC75-inspireret monohull med foil-arme; AC72-inspireret katamaran med to skrog og foils. Disse ældre billeder er illustrationer, ikke dokumentation for bestemte virkelige både. Bådvælgeren bruger nu i stedet `model-*.webp`, der er gengivet fra spillets egne modeller.

## Kapsejladsbaner

Version 12 af banemodellen har Op/ned og Trekant i kort og lang udgave. Modellens mærker, linjer og sekvens bruges af kort, 3D-scene og passageregistrering. Banen lægges efter vindretningen ved opsætning og flyttes ikke ved senere vindskift. Geometrien og rutevalgene bygger på [Dansk Sejlunions kapsejladsbaner](https://dansksejlunion.dk/kapsejlads/information-om-maerkebaade/kapsejladsbanen) og opgavebeskrivelsen. Banestørrelser er spilkalibrering.

Alle fire standardruter er gennemsejlet med fysisk ror og trim. Separate geometriprøver dækker blandt andet rundingsside, gatevalg, tyvstart, genstart ved redning og hurtige linjepassager. Kort Trekant er derudover gennemført med seks tilsluttede browserklienter og fælles resultat. En sent tilsluttet gæst ser den aktive bane som tilskuer og deltager fra næste start.

Åbn **Kapsejlads** og vælg **Baneeditor** i baneopsætningen. Indstil referencevinden. Vælg **Læg udkast** for et forslag, eller **Byg selv** for at placere start, mærker og mål på et tomt søkort. Redigér derefter rækkefølgen og rundingssiderne. Stedernes position er fast under sejlads, også efter vejrskift. **Tilpas til aktuel vind** ændrer placeringen eksplicit med mulighed for at fortryde. Baner gemmes i browserens eget bibliotek og kan eksporteres og importeres som JSON. En gæst kan redigere sine egne baner. Værten vælger den fælles bane, og de andre klienter modtager modellen, når løbet startes.

## Det Sydfynske Øhav omkring Faaborg

Det lokale kortudsnit bruger nordvendte meter på begge akser. Afstanden i lige linje fra Faaborgs færgeleje er 3,08 km til Bjørnø Bro, 6,96 km til Lyø Havn og 6,11 km til Avernakø Havn. Kortets målestok og bådenes bevægelse bruger de samme koordinater.

Kystlinjer, veje og stednavne er udtrukket og forenklet fra OpenStreetMap. Terrænhøjden er interpoleret fra Copernicus GLO-30. Det samme terræn bruges af landkontakt, kystlæ og 3D-scenen, mens bølgefeltet også bruger vandstrækningen op mod vinden. Havbunden er en beregnet spilmodel, og havnenes bygningsdetaljer er stiliserede. [Datakilder og licenser](ASSETS.md)

Kystprofilerne fra spillets tidligere komprimerede kort er bevaret i de historiske målinger. Se den aktuelle [læprøve ved Dyreborg](http://localhost:4173/?proeve=lae) og [vindkortet](http://localhost:4173/assets/vindkort.html).


## Bølger

Se [vandgennemgangen](gennemgang/vand/README.md) for før/efter-lag, kontrolpunkter og sejlads i mod-, tværs- og medsø.

Standardhavet bruger sammenhængende bølgefronter på 22,5–34 m ved standardperioden med en fysisk bølge på 9,4 m og vindbølger på 4–7,9 m ovenpå. Ved 8,5–20 m/s og standardindstillingen for kort sø bærer hovedfamilien ca. 90 % af den beregnede højdevarians. Komponenterne ligger inden for ±5° af hovedretningen. Bølgerne følger grundvinden i den almindelige vejrmenu. En særskilt dønningretning findes i det interne testmiljø. Vandshaderen og bådfysikken bruger samme felt og dybvandsrelationen `sqrt(g * |k|)`. Mindre krusninger bruger en filtreret hældningstekstur til lys og refleksioner.

Vejrmenuen tillader op til **20 m/s** grundvind. **Bølgehøjde** vælger en signifikant bølgehøjde fra **0 til 1,50 m** på åbent vand i trin på **0,05 m**. Den lokale vindsø vokser med vindstyrken og den frie vandstrækning. Bølgeformen blandes over 1,8 simulationsekunder, og bølgehøjden følger med en tidskonstant på 1,25 sekunder. Ændringer i lokal vind kan stadig påvirke krusninger hurtigt, mens vindsøens bidrag tilpasser sig med en tidskonstant på seks sekunder. Kystens læ og lavvand påvirker højden lokalt. [US Army Corps of Engineers om vindbølger og fri vandstrækning](https://usace.contentdm.oclc.org/digital/api/collection/p266001coll1/id/2320/download)

[Bølgeprøven med Turbåd 43](http://localhost:5173/?proeve=boelger) åbner cockpittet i bølger fra vest. [Bølgeprøven med Laserjolle](http://localhost:5173/?proeve=boelger&baad=laser) åbner sidekameraet ved 6,2 m/s og 0,82 m bølgehøjde på åbent vand.

Hver neddykket volumencelle får ud over lodret opdrift en begrænset vandret kraft `-0,35 * opdrift * overfladehældning`. Det er en reduceret spiltilnærmelse til indfaldende bølgetryk, ikke en valideret hydrodynamisk model. Ror, sværd og foils bruger en dybdeaftagende lokal partikelhastighed; foilbådens skrogmodstand bruger også lokal strømning. Ingen fartbonus knyttes direkte til skrogets pitch. Stævnspray bruger den lokale vandkontakt og den relative lodrette bevægelse. Seks både anvender samme båduafhængige koefficienter og fælles værtstid. `waveComponent` er en intern testmulighed til at isolere én regelmæssig komponent; den findes ikke som spilindstilling.

De tidligere målinger og klip i `gennemgang/` viser den forrige bølgekalibrering i mod- og medsø, med og uden foils. De aktuelle browsertests kontrollerer tæt vindsø, bølgedæmpning ved land, bådrespons, fælles vejr i multiplayer og samme bølgehøjder i CPU og GPU.

## Trim og besætning

[Sejladsgennemgangen](gennemgang/haandtering/README.md) viser vindlæ ved Faaborg, Laserjollens stagvending med tastatur og den målte fartforskel til Racer 32.

Tastaturet flytter skødeindstillingen over 0–100 % på cirka to sekunder i hver retning; bommens bevægelse og sejlkraften afhænger fortsat af vind og båd. `gennemgang/trim-malinger.json` indeholder tidligere browsermålinger fra før Racer 32-revisionen og beskriver ikke den aktuelle båd 2. Den assisterede position 2 flytter vægten gradvist gennem båden ved sideskift; position 3 holder den tidligere side, indtil spilleren vælger position 2. Totalmassen er konstant. En browserkontrol med påtvunget kæntring målte automatisk opretning på højst 4,4 aktive sekunder for de fem både i de testede forhold.

Gæstens kontrolpakker bærer hvert sit sekvensnummer og den faktiske type af trim- og rorinput. Efter genforbindelse venter gæsten på et autoritativt snapshot. Snapshots kvitterer for seneste behandlede input, hvorefter nyere input genafspilles. Dette er en forenklet klientforudsigelse; længere forløb med varierende forsinkelse og pakketab mangler stadig systematisk måling.

## Sejlmodel

Vindfeltets vektorer beskriver luftens bevægelse **mod** en retning i verdenskoordinater; vindinstrumentet viser, hvor vinden kommer **fra**. Et sejlpunkt bruger luftens lokale hastighed minus punktets hastighed. Punktets hastighed indeholder bådens translation, rulning, pitch, yaw og for storsejlets angrebspunkter bommens bevægelse. Position og translation refererer til modellens skrogoprindelse; det svarer til en tyngdepunktsbeskrivelse, når tyngdepunktets rotationsbevægelse medregnes i dens hastighed. Det er en forenklet model: de bløde jollers kraftintegral bruger de vandrette komponenter og medtager ikke fuld 3D-strømning rundt om sejlet.

De bløde storsejl integreres over tre højdesektioner; hver får sin egen relative vind, angrebsvinkel, effektive dybde og belastning. Et separat forsejl tælles én gang. Lift- og dragkoefficienterne, stallovergangen, skødets maksimale fem graders elastiske overtræk og dæmpningen er spilparametre, ikke vindtunnelmålinger. Sektionsarealerne summerer til modellens referenceareal. Det stive katamaransejl beregnes som ét vingeareal med flap og separat fok, mens monohullens to synlige sejlduge tilsammen er ét hovedsejl. Foilriggene bruger ét repræsentativt angrebspunkt pr. sejl; der er ikke implementeret et fuldt sektionsintegral for dem.

`state.rig` opdateres ved hvert fysiktrin og indeholder side, glidende sideskift, bug, twist og fyldning. Den samme tilstand påvirker både kræfter og de store ændringer i mesh. Telltales på jollen anvender den nærmeste aerodynamiske sektion; små vibrationer beregnes visuelt af simulationstiden og giver ikke ekstra kræfter. Besætningsside er separat. Skødeindstillingen ændrer en vinkelgrænse; når bommen strækker skødet, kan linen kun trække indad. Rigdata indgår i de autoritative snapshots, og andre både interpoleres visuelt mellem snapshots. Animationen følger simulationstid og står stille ved pause.

Modellen bruger samme lokale vindfelt i pust og på vandet, men er ikke en målt CFD- eller vindprofilmodel. Code 0 og spiler bruger ét repræsentativt angrebspunkt og en kalibreret blanding af løft og tryk. Se [NASA om relativ hastighed](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/velocity-effects/), [NASA om stall og modstand](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/inclination-effects-on-drag/), [North Sails om bomnedhal og twist](https://www.northsails.com/en-us/blogs/north-sails-blog/albacore-tuning-guide) og [UK Sailmakers om Code Zero](https://www.uksailmakers.com/racing/spinnakers/code-zero/). `tests/sail-state.test.js` kontrollerer blandt andet vindstille, relativ vind, kvadratisk kraft, spejling, sideskift og pause. `npm run test:six-rigs` anvender seks separate browserklienter og den lokale WebSocket-tjeneste til at kontrollere rigtilstande; den tester ikke et fuldt løb eller længere forsinkelse. Optagelser kan genskabes med `node scripts/record-sails.cjs`.

## Bådene og spileren

Bådlisten består af Laserjolle (4,23 m), Racer 32 (9,75 m), Turbåd 43 (13,1 m), foilmonohull og foilkatamaran. De gamle interne identiteter `dinghy` og `yacht` er bevaret i live-protokollen af hensyn til kompatibilitet. Racer 32 er en fiktiv 9,75 m kølbåd. Sejlklar masse er 2.600 kg inklusive 900 kg ballast og to besætningsmedlemmer på hver 80 kg. Position 3 flytter de to personer ud i trapez; deres led og masse indgår i tyngdepunkt og inertiberegning. Turbådens model vejer 9.600 kg inklusive fire besætningsmedlemmer på tilsammen 300 kg og har separat ballast og inerti. Besætningens fire positioner indgår i tyngdepunktet og følger den samme animation hos alle spillere. Billederne `assets/model-*.webp` er optaget fra spillets egne 3D-modeller.

Turbåden har knapper ved trimmet til **Code 0** og spiler. De bruges én ad gangen; ved skift bjærges det første sejl gradvist, før det næste sættes. Code 0 er et fladere forsejl på 90 m² til slør i let til moderat vind; spileren er 115 m² og har et større trykbidrag på dyb læns. Arealer og koefficienter er spilkalibrering, ikke målte polardata. På en egnet kurs sættes sejlet med ét tryk. Ellers står valget i kø, og fokken forbliver ude. Sætning og bjærgning tager fire simulationsekunder, og fokken rulles gradvist ind under sætningen. Besætningen bjærger det ekstra sejl efter fire sekunder for tæt på vinden. Tærsklen er 48° relativ vind for Code 0 og 70° for spiler. Code 0 bjærges også efter vedvarende relativ vind over 14 m/s. Sejlet sættes igen, når vinden tillader det, hvis spilleren stadig har det valgt. `gennaker` accepteres fortsat som et ældre netværksinput og bruger Code 0-modellen. Den hvide Code 0 sættes på læsiden efter den relative vind; ved et sideskift flytter sejlet sig gradvist, og tæt på direkte læns fastholdes den seneste side, indtil vindens side er tydelig.

Katamaranen har et opdelt stift vingeprofil med flap og en separat, blød fok. Vinge og fok tæller tilsammen 260 m² i kraftmodellen; flap og profil er dele af vingens areal og giver ikke et ekstra areal. Vingens flap, twist og fokkens vinkel skifter gradvist. Seksbrowserkontrollen bruger den rigtige live-tjeneste; bådkontakt er også kontrolleret med to rigtige klienter. Det fulde seksbådsløb brugte seks Laserjoller, mens den særskilte rigprøve omfattede alle fem bådtyper.

## Visuel kontrol og ydelse

Bådenes geometri og animationer bygges i `index.html`. `gennemgang/modelkontrol/sammenlign.html` sammenstiller den aktuelle model med de valgte referencebilleder, herunder et manuelt justerbart overlay. Referencerne er kun til kontrol og er ikke spillets assets. `node scripts/boat-presentations.cjs` genskaber alle fem bådvælgerbilleder fra spillets scene, mens spillet kører lokalt på port 5173.

`node scripts/visual-qa.cjs` måler en otte sekunders scene med standardkamera, 1280 × 720 og høj grafik. Med `QA_VIDEO=1` optages også et forløb med besætningsskift og styreinput. Browsersti kan angives med `CHROME_PATH`. Måling, sammenligningsbilleder, optagelse og konkrete resterende afvigelser findes i `gennemgang/visuel-2026-11-19/`.

### Følsom foiling og trapez

Foilbådenes styrerespons øges gradvist, når skroget er fri af vandet: første tastetryk giver større rorønske, den tilladte drejehastighed øges, og den begrænsede styrehjælp reagerer hurtigere. Overgangen afhænger af faktisk vandkontakt og frihøjde; den ændrer hverken vindfelt eller bådens masse. Dette er spilkalibrering, ikke dokumenterede tal for en bestemt America's Cup-båd. `tests/foil-respons.test.js` sammenligner før og efter fra samme fysisk beregnede flyvetilstand.

Racer 32 bruger to personer à 80 kg og en samlet sejlklar masse på 2.600 kg. I position 3 flyttes personerne gradvist ud med fødder ved bådsiden og synlige liner til masten. Den samlede masse ændres ikke, når de flytter sig. Båden er et fiktivt spildesign; værdierne er ikke klassedata. Position 3 bliver på sin side under en vending, indtil spilleren vælger position 2.

### Vægt og kamera

Alle tre besætningsvalg flytter faktisk masse og ændrer tyngdepunkt og rullemoment. Mindre bevægelser i hoved, arme og ben er visuelle og ændrer ikke den fysiske massefordeling. På turbåden flytter de fire personer sig gradvist fra cockpit mod luv. På foilbådene flytter besætningen sig inden for arbejdspladserne, så hvert valg giver en særskilt modvægt. Størrelsen af virkningen afhænger af bådens og besætningens masse. Kamera skiftes trinvis med knappen i menuen til højre eller med C. Kortets størrelsesknap skifter mellem tre størrelser; valget er lokalt og pauser ikke multiplayer. Vejr og personlige indstillinger vises hver for sig.


Fysikkens aktuelle definitioner, kilder, kalibrering og kendte begrænsninger beskrives i [fysikoversigten](gennemgang/fysik/README.md).

## Læ bag øer og kyst

Spillet beregner et lokalt læfelt ud fra de samme håndtegnede kystpolygoner som landkontakten. For et punkt på vandet følges en linje mod den retning, vinden eller bølgerne kommer fra; land på den linje reducerer påvirkningen på læsiden. Effekten er størst nær land og aftager gradvist ud over vandet. Vindlæets styrke tager desuden højde for øernes forenklede højder; højere land bag en lav ø kan fortsat give det stærkeste læ. Vindens lokale styrke bruges til instrumenter, vindspor, vandets små lyskrusninger og sejlenes kraftpunkter; læet bliver mindre højere over vandet. Bølgemodellen beregner særskilt læ for dønning og vindbølger efter deres respektive indfaldsretninger. Den lokale dæmpning indgår i bølgehøjde, hældning, vandoverfladens hastighed og vandets partikelbevægelse. Vandets shader bruger de samme felter som bådfysikken.

Dette er en deterministisk spiltilnærmelse, ikke en meteorologisk eller kysthydraulisk beregning. Feltet beregnes på et 96 × 96 gitter, retninger afrundes til hele grader, og bølger i læ dæmpes uden at forsvinde helt. Det sidste er en forenklet repræsentation af, at bølger kan brede sig omkring en hindring; modellen simulerer ikke egentlig diffraktion, refleksion eller detaljeret turbulens. Uden for feltets dækningsområde bruges åbent vand. Øernes og kystens placeringer er fortsat komprimerede spildata. Fænomenet bølgediffraktion er blandt andet beskrevet i [US Army Corps of Engineers' kystordliste](https://www.publications.usace.army.mil/Portals/76/Publications/EngineerManuals/EM_1110-2-1100_App_A.pdf?ver=2014-03-10-140035-443).

`npx playwright test tests/shelter.test.js --workers=1` kontrollerer læ bag Bjørnø, vindens aftagende læ med højde, forskellige vind- og dønningretninger samt sammenhæng mellem den beregnede bølge og GPU-vandoverfladen.
