# Styring og spilbarhed i TACK

## Version og afprøvning

Afprøvet 21. november 2026 på [localhost:4173](http://localhost:4173/). `node server/static.js` serverer `dist/` fra projektmappen `Sejlads`. Git-udgangspunktet er `3f65b7f` med lokale ændringer. Det serverede HTML-build er `ebbc1040028c`, verificeret i HTTP-headeren og i **Detaljer → Model**. Serveren bruger `Cache-Control: no-store`. Projektet registrerer ingen service worker.

Browseren var Chrome 157.0.8103.79 ved 1280 × 800 og én enhedspixel pr. CSS-pixel. Grafikindstillingen var Auto, som valgte Høj under de målte forløb. Jeg brugte friske browserkontekster og en midlertidig kopi af de eksisterende spilindstillinger. Kopien indlæste Svær, 10,5 m/s fra 179°, 1,50 m indstillet bølgehøjde, 35 % chop og ingen pust.

## Årsager og rettelser

- **Ror og skøde.** Før rettelsen lagde tast ned kun tasten i sættet med holdte taster. Tast op fjernede den straks igen. Når de to hændelser faldt mellem fysiktrin, modtog browseren begge, mens spillet fortsat brugte neutralt ror og skøde 35,0 %. Efter rettelsen medtages trykket ved det næste fysiktrin og forbruges én gang. Et kort tryk på pil op flytter skødet fra 35,00 % til 35,83 %. Korte bevægelser på touchroret bruger samme princip. Pause, menuer og fokustab rydder ventende input.
- **Fokus.** De ældre revisioner kunne efterlade fokus på kortets valg eller skødets skyder efter musebrug. Dermed betjente pilene DOM-kontrollen. Den eksisterende lokale fokusrettelse returnerer fokus til sejladsen efter musebrug. En skyder, der er valgt med tastaturet, beholder sin egen tastaturbetjening.
- **Startkurs ved Faaborg.** `a680af3`, `d40fabc` og `3f65b7f` startede med 153° i den kopierede sydlige vind. Det placerede stævnen cirka 26° fra vindretningen. Efter samme inputforløb var den fremadrettede fart gennem vandet cirka −0,5 m/s. Det lokale vindvalg af startkurs placerede i stedet båden omkring 251°. Det nye build starter fra nul med den valgte kurs. Forsigtig trimning og modstyring gav 0,74 m/s fremad i et kort forløb med de kopierede indstillinger. Hårdere trim og en efterfølgende manøvre i samme vejr kæntrede jollen på Svær.
- **Dybde og plads til at dreje.** Racer 32 gik på grund ved cirka 0,6–1,3 m vand ved det gamle startsted, under almindelige drej ved 10 m/s. Foilmonohullen kunne også ramme grunden på vej ud. Racer 32, Turbåd 43 og foilbådene starter nu 145 simulerede meter længere ude fra Faaborg ved cirka 14,3 m vand. Laserjollen starter ved cirka 3,6 m i havneindløbet. Almindelig solo Fri sejlads starter uden tilført fart og uden flytning under forløbet. Genstart sætter roret og vægtkommandoerne tilbage til standard.
- **Racer 32.** To sejlere på hver 80 kg indgår i rendering, masse og inertier. Riggen på 55 m² og skroglængden på 9,75 m blev bevaret fra den eksisterende arbejdsversion. Den ændrede besætningsfordeling er en selvstændig rettelse.

## Kontrolkæde og sammenligning

De tre Git-revisioner blev kørt i separate, detached worktrees. I roligt vand ved cirka 5,5 m/s gav et holdt tryk mod styrbord på Laserjollen på Svær cirka +18° kursændring i `a680af3` med den daværende styrehjælp og cirka +11° i `d40fabc` efter overgangen til direkte ror. Modstyring gav negativ drejehastighed i begge revisioner. Ved de efterfølgende lokale øjebliksbilleder efter ændret sideværts modstand, Racer-rig og styrerespons drejede jollen cirka 11–13° mod styrbord, og modstyringen vendte drejehastigheden. I loggen for den aktuelle Svær er det ekstra styremoment nul. Det afgrænser årsagerne til inputvejen og de dokumenterede startforhold.

Det tidligere `tack-playable.cjs` åbnede spillet og brugte synlige kontroller og holdte taster. Det viste, at de fem både kunne startes og betjenes i almindelig vind. Det dækkede hovedsagelig standardindstillingerne og længere tryk og kunne derfor overse tab af korte tryk, det kopierede vejr og flere manøvrer. Den nye prøve logger de seneste 50 input- og fokushændelser og 400 billedintervaller. Den aflæser blandt andet rorvinkel og målvinkel, neddykning, lokal vandstrøm, fremad- og sidefart, krængning og de vigtigste drejemomenter. Styringen og fysikken kører fortsat med trin på 1/60 s.

Ved en særskilt kraftprøve i stille vand bremsede den delvist neddykkede Laser sidebevægelsen på begge sider. Efter ét sekund var den vandrette bevægelsesenergi under 30 % af startværdien, og sidefarten var under 0,85 m/s. Det tidligere sejlforløb for Laser halede skødet helt ind og kæntrede jollen, før testen målte drejningen. Testen bruger nu realistiske tryklængder og moderat trim og kræver, at jollen holder sig oprejst med modsat retningsrespons.

I en sammenligning med rigtig browsertid over 400 billedintervaller var median, 95-percentil og maksimum henholdsvis 16,7, 16,8 og 33,4 ms før og 16,7, 16,8 og 16,8 ms efter. Det var samme båd, startområde, vejr, opløsning og grafikniveau. Startfarten og den efterfølgende bådbane var forskellige. Det korte forløb efterprøver respons og viser ikke langtidsydelse på langsommere maskiner.

## Sejlads gennem brugerfladen

Alle nedenstående forløb begyndte med **Fri sejlads** og brugte menuvalg, tastetryk og almindelige spillerkontroller. Programmet aflæste tilstand og instrumenter undervejs.

| Båd | Forhold og observeret resultat |
|---|---|
| Laserjolle | Ved lokal vind cirka 5,5 m/s, fladt vand, både Let og Svær holdt jollen fremadfarten og vendte drejningen ved modstyring. Ved 8,5 m/s gennemførte begge niveauer to stagvendinger og en bomning i to separate forløb. På Let flyttede besætningen sig selv til den nye luvside. På Svær blev vægten styret med 1, 2, 3, Q og E. Z og X blev afprøvet under det separate kontrolforløb. |
| Racer 32 | Ved lokal vind 10,0 m/s drejede og modstyrede båden på Let og Svær. Den sluttede med 5,4 og 4,8 m/s fremad gennem vandet. |
| Turbåd 43 | Ved lokal vind 9,0 m/s og fart etableret drejede den fra 69° til 76° og tilbage til 69° ved modstyring på Svær. Den sluttede med 3,0 m/s fremad. |
| Foil-monohull | 5,5 m/s lokal vind ved skrogsejlads. Ved 14,0 m/s, i foiling, gav 0,24 s mod styrbord og 0,48 s modsat cirka +4,1 og −1,9°/s i drejehastighed. |
| Foil-katamaran | 5,5 m/s lokal vind under acceleration frem mod løft. Ved 14,0 m/s, i foiling, gav samme tryk cirka +3,3 og −2,6°/s. |

Ved de langsomme foilforløb omkring 3 m/s ændrede rormomenterne sig straks i den forventede retning. Drejehastighederne ændrede sig mindre, og katamaranen fortsatte kortvarigt med at dreje bagbord, mens styrbordror bremsede drejningen.

Kort og trim blev betjent med almindelige klik efterfulgt af styring. Pause holdt fysiktiden fast. Genoptagelse, genstart og bådskift blev prøvet, mens en styretast var nede. I et rigtigt Chrome-vindue skiftede jeg fane i både Fri sejlads og solo Kapsejlads med styrbordstasten holdt nede. Fysiktiden stod stille i den skjulte fane. Fri sejlads fortsatte automatisk med neutralt ror. Kapsejlads ventede på **Fortsæt** og fortsatte derefter med neutralt ror.

Multiplayer blev prøvet mellem to browsere og en lokal WebSocket-tjeneste. Gæstens to sejlere og deres vægtplacering blev vist på værtens bådvisning. Værten fortsatte simulationen med gæstens lokale menu åben, og gæsten kunne styre efter lukning.

## Gentag forløbene

Kør fra projektmappen, mens buildet kører på 4173. `CHROME_PATH` kan pege på en anden Chrome-installation.

```sh
node scripts/playability-check.cjs laser-start
node scripts/playability-check.cjs laser-tacks
node scripts/playability-check.cjs laser-gybe
node scripts/playability-check.cjs racer
node scripts/playability-check.cjs cruiser
node scripts/playability-check.cjs mono-hull
node scripts/playability-check.cjs cat-hull
node scripts/playability-check.cjs mono-flight
node scripts/playability-check.cjs cat-flight
node scripts/playability-check.cjs controls
node scripts/playability-check.cjs focus
node scripts/playability-check.cjs focus-race
```

Udskriften indeholder det faktiske inputforløb og målingerne som JSON. Til gentagelse af den korte tabte tast bruges browserprøven `a tap between physics frames gives one input step without sticking` i `tests/browser.test.js`. Kopierede vejrindstillinger kan prøves med en privat JSON-fil med spillets localStorage-nøgler, eksempelvis `node scripts/playability-check.cjs '{"saved":"/tmp/tack-settings.json","useSaved":true,"modes":["hard"]}'`. Både fixture-prøverne og gennemgangen af sejladsen tager udgangspunkt i spillets eksisterende fysiske model.
