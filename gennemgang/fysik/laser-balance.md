# Laserjollens sejltryk, krængning og vægtplacering

## Fund og rettelser

Førmålingen genskabte ikke en generel fordel ved position 1. Ved 8,5 m/s, 52° til vinden og 78 % skøde vandt position 3 allerede på fart og VMG. Med mere slæk kunne fuldt hæng til gengæld give kæntring mod luv, fordi sejlet ikke kunne bære vægten ude. Der var tre fejl i forløbet, som ændrede effekten af krængning og kunne få jollen til at føles nervøs.

- **Sejlprofilen blev målt i et vandret plan.** Før blev både angrebsvinkel og kraftretning beregnet vandret. En generel `cos²(krængning)` skalerede trykket, mens momentarmen i forvejen fulgte det roterende skrog. Kontrollen viste ingen ekstra korrektion af sejlarealet eller en anden, skjult 3D-projektion. Efter rettelsen projicerer `aero` den lokale, relative luftstrøm ind i hvert sejlstribs plan vinkelret på masten og roterer kraften tilbage. Fremadrettet, sideværts og lodret kraft får moment fra det faktiske angrebspunkt. Striptrykket og bommens moment følger samme kræfter. Laserens fysiske sejlareal er fortsat 7,06 m². Specialmodellen er afgrænset til Laserens storsejl.
- **Skrogmodstand kunne falde brat under krængning.** De to faste punkter i en skrogsektion kunne begge komme fri af vandet, selv om læsiden stadig var våd. I den isolerede prøve ved 2,4 m/s faldt modstanden fra 14,0 N ved 30° til 4,1 N ved 45°. Nu klipper `wettedGirth` den faktiske skrogprofil mod det lokale vandplan. `hullResistance` bruger det våde omfang og fordeler kræfterne ved dets tyngdepunkt. Den separate empiriske krængningsfaktor udgår for dette skrog. Ved 30° og 45° måles nu 9,3 og 8,1 N. Ved 0° er den oprindelige reference bevaret på 14,5 N.
- **Besætningen blev trukket for hurtigt ind.** Position 3 til 1 kunne med den gamle bevægelsesgrænse give en kraftig modbevægelse af skroget. Springet i skrogets lokale fart forplantede sig til den relative vind og sejlets kræfter. Kun den indadgående Laser-aktuator er ændret. Maksimal hastighed, acceleration og responstid er ændret fra 13 / 175 / 0,058 til 4,8 / 38,4 / 0,095 i positionstrin/s, positionstrin/s² og sekunder. Samme skiftscript ved 8,5 m/s og 45 % skøde gav 1,058 → 0,076 m/s i maksimalt farttrin og 327 → 101 N i maksimalt trin i sejltrækket efter opstart.

Der er hverken ændret masse, ballast, sejlareal eller polar for at skabe en fordel ved en bestemt position. Den totale masse er 143 kg, heraf 75 kg sejler. Vægtens tværgående afstand til midterlinjen er 0,043 / 0,247 / 0,635 m i position 1 / 2 / 3. Højderne er 0,498 / 0,476 / 0,445 m fra skrogets reference. Positionen langskibs var den samme i målingerne. Den tværgående forskel på 0,592 m giver omkring 436 Nm i ekstra tyngdemoment ved vandret båd. Det stemmer med regnetjekket 294 Nm for 0,40 m. De faktiske kropspunkter giver både tyngdepunkt og inertibidrag.

## Den aktive vej gennem Fri sejlads

| Del | Funktioner i brug |
|---|---|
| Spillerens ror, trim, side og position | `index.html` bruger `input` og `fixedStep`. `SailingSimulation.stepBoat` fra `assets/simulation/runtime.js` sender inputs til `SailPhysics.step`. Vejrindstillinger føres ind via `SailingSettings.advanceWind`. |
| Lokal og relativ luft | `windForState` viser vinden ved båden. `sailAirAt` bruger vinden ved strippen og trækker punktets bevægelse fra, inklusive rulning, stampning, drejning og bevægelse om masten. `aero` projicerer vind i profilplanet og bruger `sailCoefficients`. Vinklerne i solver er radianer. |
| Last, vægt og vandkontakt | `updateCrew` og `SailingBoats.crewPoseAt` flytter segmenterne. `hydrostatics` summerer neddykket volumen og massernes tyngde. `hullResistance`, `appendageBlade`, `planingLoad` og terrænkontakt leverer vandkræfterne. Skroget bruger punkterne fra samme skrogform som grafikken. |
| Momentregnskab | `forceMoment` beregner momentet ved kraftens angrebspunkt. `integrateMass` flytter det samlede moment fra skrogreferencen til systemets tyngdepunkt, svarende til `(angrebspunkt − tyngdepunkt) × kraft`. I dette regnskab optræder besætningens masse én gang. Laserens sværd har ingen ballast. Kølbådene har ballast som særskilte masser. Foilbådene bruger `FoilingPhysics.step` med kræfter fra skrog, arme, foilflader og ror ved deres egne angrebspunkter. |
| Kontrol og grafik | `manualCrewTarget` på Svær holder målet, når input er neutralt. `automaticCrewTarget` på Let er en særskilt styrefunktion. Den valgfri hjælp i vindøjet aktiveres kun på Let. Under automatisk opretning kan den fysiske besætning midlertidigt få en sikkerhedsstilling, mens brugerens mål er gemt. Interpolation og `SailingCrewMotion.pose` læser den fælles besætningsgeometri. |
| Diagnose | Tryk <kbd>&#96;</kbd> i spillet for debugvisningen. Den viser mål og faktisk position, relativ og lokal vind ved sejlet, kræfter, momenter om tyngdepunktet, skrog- og appendagemodstand, afdrift og fart. `instruments` beregner VMG mod vinden som projektion af den faktiske hastighed relativt til vandet på retningen mod vinden. Det inkluderer afdrift. |

Projektionen er beslægtet med ORC's vindtrekant ved krængning, ligning 7.2–7.3. TACK bruger et lokalt, bevægeligt sejlprofilplan og beholder spillets koefficienter. Day adskiller besætningens oprettende arm og modstandens afhængighed af våd overflade. ILCA beskriver, hvordan skøde, hængning og afdrift påvirker VMG, og hvordan en anden krængning kan fungere på læns. [ORC VPP 2026, §7.1](https://orc.org/uploads/files/Rules-Regulations/2026/ORC-VPP-Documentation-2026.pdf#page=82) · [Day, §§2.2, 3–4](https://pure.strath.ac.uk/ws/portalfiles/portal/64217569/Day_OE_2017_Performance_prediction_for_sailing_dinghies.pdf) · [ILCA om kryds](https://ilcasailing.org/upwind-in-lasers/) · [ILCA om læns](https://ilcasailing.org/downwind-in-lasers/) · [Fossens kraft- og momentregnskab](https://www.fossen.biz/html/marineCraftModel.html)

## Fast krængning og målt balance

Begge halser, 0°, 10°, 20°, 30° og 45°, samme 7,06 m² sejl, 8,5 m/s vind og 2,4 m/s bådfart. Eksempel fra halvvind med 48° bom.

| Krængning | Relativ vind i profil, før → efter | Fremadkraft, før → efter | Lodret kraft efter |
|---:|---:|---:|---:|
| 0° | 8,83 → 8,83 m/s | 280 → 280 N | 0 N |
| 10° | 8,83 → 8,71 m/s | 271 → 274 N | −29 N |
| 20° | 8,83 → 8,34 m/s | 247 → 258 N | −53 N |
| 30° | 8,83 → 7,74 m/s | 210 → 231 N | −68 N |
| 45° | 8,83 → 6,47 m/s | 140 → 168 N | −74 N |

Sidekraft samt krængnings- og drejemomenter spejler fortegn ved spejlet vind og krængning. Fremadkraft og lodret kraft spejler størrelsen. Opdrift og tyngde giver ca. 93 Nm tilbage mod vandret ved en afvigelse på ±3° i stille vand. I en sejlende, stabil prøve ved 8,5 m/s og 78 % skøde gav en engangsforstyrrelse på ±3° fra 2,98° slutkrængning på 2,96° og 3,00° efter otte sekunder. Ingen andre tilstande blev sat i forløbet.

## Fart og VMG før og efter

Åbent vand, Svær, konstant last og samme begrænsede rorprogram. Driveren anvender kun ror og skøde. 44 sekunders forløb med to vinduer på otte sekunder til at kontrollere stabilitet. Tabellen viser gennemsnit i sidste vindue. Kursmålet er ens mellem positioner. Kursen i vandet afhænger også af ror, afdrift og balance.

| Vind og kursmål | Skøde | Position 1, før → efter | Position 2, før → efter | Position 3, før → efter |
|---|---:|---:|---:|---:|
| 2,5 m/s, kryds ved 52° | 72 % | 2,51 → 2,47 kn | 2,55 → 2,50 kn | Kæntret → kæntret mod luv |
| 2,5 m/s, halvvind | 57 % | 4,02 → 3,97 kn | 4,05 → 4,01 kn | Kæntret → kæntret mod luv |
| 8,5 m/s, kryds ved 52° | 78 % | 6,23 → 6,14 kn | 6,92 → 7,13 kn | 7,50 → 7,47 kn |
| 8,5 m/s, halvvind | 55 % | Kæntret → 7,63 kn | 8,33 → 8,79 kn | 9,09 → 9,16 kn |
| 8,5 m/s, dyb læns ved 165° | 18 % | 7,89 → 7,91 kn | 7,90 → 7,97 kn | Kæntret → kæntret mod luv |

**Samme trim på kryds.** Ved 8,5 m/s og 78 % skøde gik position 1 / 2 / 3 fra 4,10 / 4,33 / 4,47 til 3,89 / 4,43 / 4,47 kn i VMG. Den nye krængning var hhv. 28,1° / 16,3° / 3,0°. I position 3 kunne sejlet holde omtrent 397 Nm krængende moment om tyngdepunktet. I position 1 holdt det omtrent 178 Nm. Den ekstra modvægt gjorde det muligt at holde en bedre sejlprofil mod vinden og optage større sidekraft med sværd og skrog.

**Trim valgt for hver position.** På kryds ved 8,5 m/s gav de bedste stabile trim i det afprøvede udvalg 78 / 78 / 86 % med VMG 3,89 / 4,43 / 5,00 kn. På halvvind gav 45 / 55 / 64 % fart 7,81 / 8,79 / 9,77 kn. Ved 2,5 m/s gav position 1 og 2 ca. 2,18 kn i bedst målt VMG med 84 % skøde. Position 1 havde mindst krængning og let mindre afdrift her. På dyb læns var position 2 marginalt hurtigere end 1. Det begrænsede ekstra sejltryk på dyb læns bar ikke fuldt hæng. Tallene er de bedste i den afprøvede trimgitterprøve.

**Sejlads under skiftende last.** Et pust fra 7,5 til 11,5 m/s med fastholdt position 2 og 55 % skøde kæntrede før. Efter rettelsen gennemførte den, med omkring 43° krængning ved den loggede top. Den parallelle prøve med slæk til 43 % og et midlertidigt vægtskift til 3 gennemførte med ca. 25° ved den loggede top. Kæntring ved fejltrim er fortsat mulig. Eksempelvis kæntrede position 1 på halvvind ved 64 % skøde, og position 3 kæntrede mod luv ved 33 % skøde. Med 0,38 m bølgeindstilling kunne position 3 holde halvvind ved 55 % skøde i prøvens 28 sekunder. I de 12 spejlede sammenlignelige, stabile par afveg middelhastigheden med højst 0,00013 kn og krængningen med højst 0,0013°.

## Revision og efterprøvning

- Førbuild `c9f17e1e8ae0`. Efterbuild `ad4daa20fa39`. Git-udgangspunktet var `3f65b7f` med lokale ændringer. Chrome 157.0.8103.79. Værktøjet sammenligner revisionsheaderen med HTML-stemplet. [Rå førmåling](laser-balance-foer.json) · [Rå eftermåling](laser-balance-efter.json)
- `node scripts/laser-balance.cjs OUTPUT.json URL` gentager gitter, kraftprøver, vægtskift, lastforstyrrelser og bølger i den serverede model. Førbuildet blev kopieret før rettelsen og kan køres lokalt fra `/tmp/tack-balance-before.XtuKXn`. Efterbuildet kører på [localhost:4173](http://localhost:4173/).
- Tastaturprøver i almindelig Fri sejlads kontrollerer at fysisk og synlig position følges, at position og side holdes, og at spillerens slæk sænker sejltræk. Der er prøver for vendinger begge veje, med fladt vand og bølger. Overgangen til position 1 når inden for 0,5 s omtrent position 1,2 i manøvreprøven. Ved fuldt hæng ved 7,9–8 m/s gav enkelte tidligere trimvalg 60–69° krængning til luv allerede i tilløbet. Manøvreprøverne anvender nu 75–76 % skøde i tilløbet og kontrollerer indgangsbalancen, før de måler selve vendingen.
- Den tidligere rapporterede drejning uden ror er afprøvet særskilt. Ved startkurs 153° ender jollen efter to sekunder på 91,40° mod tidligere ca. 91,46°. Den drejning kræver stadig kalibrering. [Rotationsdata](laser-rotation.json)
- 37 automatiske Node-prøver og TypeScript-kontrollen bestod. 35 browserprøver bestod for Fri sejlads med tastatur, styring, drift, bølger og kraftregnskabet for alle fem både. Fem supplerende browserprøver bestod for Racer 32 i trapez og vending ved 10 m/s, Turbåd 43 med alle tre forsejl og begge foilbåde i stærk vind.

Den stabile fart og VMG i disse forløb dokumenterer spilmodellen. Sejlets koefficienter og lastfordeling, skrogets restmodstand, rulledæmpning, samspillet mellem sværd og ror samt besætningens bevægelseshastighed kræver fortsat målinger på en fysisk ILCA. Den trestribede sejlmodel og de tre målte skrogsektioner er spiltilnærmelser. En fuld kalibrering ville kræve en sammenligning med hastighedspolaren for en fysisk båd under tilsvarende forhold.
