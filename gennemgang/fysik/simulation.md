# TACKs selvstændige simulation

## Udgangspunkt og kørende build

Git-udgangspunktet er `3f65b7f` med de lokale ændringer fra de forrige sejladsopgaver. Browserbuild `012471a606a4` er referencen fra før udtrækningen. Udtrækningen matchede alle seks referenceforløb før ændringen i bølgernes påvirkning. Build `5f1e60cd58d9` blev målt og er tilgængeligt på [localhost:4173](http://localhost:4173/). Buildnummeret står også i **Detaljer → Model**.

## Ejerskab og grænseflade

| Ansvar | Kode og data |
|---|---|
| Input, pause og indstillinger | `index.html` ejer tastetryk, touch, skødemål, besætningskommando, pause og læsning fra localStorage. Det oversætter brugerens handlinger til `ControlInput`. Renderloopet planlægger de faste fysiktrin og leverer tiden til kapsejlads og opretning. |
| Let, Svær og besætning | `physics.js` vælger mellem `automaticCrewTarget` og `manualCrewTarget`. `crewPose` og `crewSide` er mål, hvor `crewPoseBlend` og `crewSideBlend` er de aktuelle fysiske positioner. På Svær gemmes spillerens vægt- og sidekommando i inputlaget. En kæntring sætter en midlertidig sikker fysisk position under opretning, hvorefter samme spillerkommando igen styrer besætningen. Bådskift og en ny soloopstart har fortsat deres almindelige startposition. |
| Sejl, opdrift og modstand | `physics.js` ejer sejlstriber, bom, skrogopdrift, vandkontakt, planing, sværd, køl og ror. `foils.js` ejer foilløft og de to store bådes kraft- og reguleringsmodel. Begge bruger de samme vind-, bølge- og kystfelter. |
| Masse og bevægelse | `boats.js` beskriver skrog, rig og besætningsled. Skrog- og foilmodellerne udleder kræfter, tyngdepunkt og inertier. `integrateMass` avancerer position og rotation. `recovery.js` ejer den eksplicitte sikkerhedsbevægelse under opretning, og `collisions.js` ejer kontaktkorrektion mellem både. |
| Solo, multiplayer og replay | `runtime.js` har `createBoat(profile, initial, field)`, `stepBoat(state, control, field, dt, options)` og `stepFleetBoat(...)`. Tilstandens tid er i sekunder. Med `diagnostics` returnerer trinnet kraft- og momentregnskabet som del af `state.forces`. Værten integrerer fjernbådene og opløser kollisioner i simulationen. Gæsten kan genafspille lokale kommandoer efter et autoritativt snapshot. |
| Animation og visning | `index.html` interpolerer til en visning, og `fleet.js` interpolerer fjernbåde. Kamera, visuel netværksudglatning, rig og besætningsanimation bruger de viste værdier. En browserprøve tegner alle fem både fra dybfrosne kopier og sammenligner den fysiske position før og efter. |

Før flytningen kendte numerik, terræn, vejr og opretning hinanden gennem browserens globale objekter. De eksisterende klassiske scripts publicerer stadig de kompatible navne i browseren. Node-indgangen installerer samme modeller i en privat afhængighedskontekst uden DOM, localStorage, WebGL eller globale modelobjekter. Node kan levere egne `wind`- og `water`-samplere. Terræn, vind- og bølgefelter kører som standard fra projektets lokale data. De fysiske sekundtrin og den monotone tid til en opretning er separate. Den sædvanlige kystvind bevarer sidste færdige retning, mens browseren forbereder nye felter. Sammenligningerne af solverne bruger fast vejr eller den samme inddata for hvert trin.

Enhederne er meter, sekunder, kilogram og radianer. Meteorologiske vindretninger leveres i grader. De detaljerede modeller er fortsat JavaScript. Grænsefladen typekontrolleres med JSDoc og `types.d.ts`. Det eksisterende build kopierer modulerne sammen med de øvrige assets.

## Laserjollens rotation

Forløbet med den rapporterede drejning starter ved kurs 153°, 8,5 m/s fra nord, vand uden bølger, neutralt ror, 35 % skøde og besætningen i position 2 på bagbord. Starthastigheden er nul. Loggen følger kurs, ror, bom, krængning, pitch, neddykning, besætningsmål, faktisk position og sejl-, sværd-, ror-, skrog-, dæmpnings- og bølgemomenter. [Start- og momentdata](laser-rotation.json)

| Forsøg | Målt resultat |
|---|---|
| Fri drejning uden ydre vind eller bølger | Med 31,51°/s som start faldt drejehastigheden til 11,89°/s efter to sekunder, med aftagende hastighed ved alle loggede punkter. |
| Kendt moment på 20 Nm | 0,10011 rad/s² for den tørre masse og inerti, 0,08309 rad/s² med neddykkede sektioners beregnede vandinerti. Sidstnævnte matcher det koblede regnestykke. |
| Vind fra agterlig retning, neutralt ror | Kurs 91,46° efter to sekunder ved 1/60 s. Ved 1/120 s ender kursen 91,82°. Det giver 61,54° drejning i den normale tidsopløsning. |
| Ensartet sideacceleration i vandet på 0,800 m/s² | Bådens tyngdepunkt accelererede med 0,505 m/s² før og 0,800 m/s² efter rettelsen ved første trin. Bådens masse er 143 kg, og både vægt og opdrift er cirka 1.402,83 N i prøven. |

Vandets medbevægelige masse var koblet til bådens acceleration uden at medtage den lokale vandaccelerations bidrag. I accelererende vand kunne det bremse en båd, som burde følge det omgivende vand. Den separate ændring fører vandaccelerationen fra de våde skrogsektioner, sværdet og roret ind i den eksisterende kobling mellem sidebevægelse og drejning. Bølgefeltets kraft på det fortrængte volumen er fortsat sit eget bidrag. Lavere drejeacceleration i vand kommer fra inerti. Aftagende fri rotation kommer fra dæmpning og vandmodstand. Statisk opdrift beregnes stadig af fortrængningen. [MITs gennemgang af bølgetryk og added mass](https://www.ocw.mit.edu/courses/2-019-design-of-ocean-systems-spring-2011/0a8db4679928bbf62bc46addbc709432_MIT2_019S11_SK1.pdf)

Fladvandsforløbet giver samme resultater før og efter bølgerettelsen. I første trin yder sejlet 147 Nm, mens vandets modmomenter starter ved nul. Efter 0,5 s er sejlet oppe på 223 Nm, og det neutrale, delvist neddykkede ror modvirker drejningen med 59 Nm. Efter 2 s er skrog og ror de største modmomenter, og båden krænger ca. 20°. En differens på ca. 0,35° mellem 60 og 120 trin pr. sekund forklarer kun en lille del af de 62°. Drejningen i fladt vand er fortsat en kalibreringsopgave. Der foreligger ingen tilsvarende måling på en fysisk ILCA. Skrogsektioner, trykkoefficienter, kystdybde, foils og planing forbliver spiltilnærmelser.

## Ydelse i spillet med én og seks både

Apple M5 med 32 GB RAM, macOS 26.3, Chrome 157.0.8103.79, WebGL via Metal på Apple M5. Fast **Høj** grafik, 1280 × 800 ved DPR 1 og standardkamera. To gentagelser pr. størrelse ved Faaborg i samme lokale sessionstype med indstillet 8 m/s fra nord, 0,45 m bølger, 22 % pust og 25 % chop. Den ene browser tegner scenen og er autoritativ vært. Fem lette WebSocket-klienter styrer deres egne aktive både i seksbådsforløbet. Værten tegner alle seks, inklusive Laser, Racer 32, Turbåd 43 og begge foilmodeller. Otte korte rorinput pr. forløb. CPU-sampling i Chrome, indrammede JavaScript-målinger og billedintervaller fra requestAnimationFrame er målt separat. JavaScript-tiden til renderindsendelse måler arbejdet på CPU’en. Billedintervallerne viser de huller, spilleren kan mærke. [Chrome DevTools](https://developer.chrome.com/docs/devtools/performance/reference)

| Måling | Én båd | Seks både |
|---|---:|---:|
| Vind og vand inde i simulationen, CPU-ms pr. billede | 0,53–0,56 | 9,21–9,56 |
| Solverens øvrige arbejde, CPU-ms pr. billede | 0,47–0,50 | 2,22–2,23 |
| Pose og animation, CPU-ms pr. billede | 0,08–0,09 | 1,07–1,11 |
| Renderindsendelse og scene, CPU-ms pr. billede | 1,07–1,12 | 2,08–2,20 |
| Netværk og flåde uden solver, CPU-ms pr. billede | 0,01 | 0,24–0,26 |
| Billedinterval, median / 95-percentil | 16,7 / 16,8 ms | 16,7 / 16,8 ms |
| Længste målte billedinterval | 50 ms i begge | 100–133 ms |
| Tast til fysisk input, median | 7,5–7,8 ms | 12,4–13,6 ms |
| Tast til synligt ror, median / 95-percentil | 9,3–9,4 / 19–20 ms | 26,6–28,9 / 91–114 ms |

Værtens lokale simulation fulgte med uret i begge profiler. Ved seks både fik en gæst sit input bekræftet i værtens næste snapshot efter median 70–72 ms over loopback. Medianen af de modtagne snapshots var cirka 188 kB JSON. Dette omfatter den eksisterende snapshotkadence og er en måling på den lokale maskine. De længere hak under seks både falder sammen med langt mere regnearbejde på hovedtråden. Prøven måler én renderende vært og isolerer dens belastning fra de øvrige klienters GPU’er. [Rå målinger](simulation-profil.json)

## Afprøvning af en worker

I en særskilt prøve sejler seks både i den almindelige WebGL-scene med samme maskine og grafikindstillinger. Her afspilles de andre bådes input lokalt, så kunstig netværksforsinkelse holdes ude af sammenligningen. Enten hovedtråden eller workeren ejer hvert fysiktrin og alle kollisioner. Begge løsninger bruger de samme profiler, kræfter og terrændata. Workeren returnerer alle seks tilstande via `postMessage` med højst én aktiv forespørgsel ad gangen. To kørsler pr. variant. Den korte kontrol med de samme tidssteg og input i begge varianter gav nul forskel i de målte fysiske positioner og rotationer. [Web Workers](https://html.spec.whatwg.org/multipage/workers.html)

| Måling med seks både | Hovedtråd | Worker |
|---|---:|---:|
| Arbejde på hovedtråden pr. billede, 95-percentil | 16,9–19,8 ms | 6,5–7,1 ms |
| Billedinterval, 95-percentil | 16,7–16,8 ms | 16,7 ms |
| Tast til synligt ror, median | 27,0–28,1 ms | 56,7–67,0 ms |
| Tast til synligt ror, 95-percentil | 36,4–37,4 ms | 72,0–88,0 ms |
| Initialisering til første beregnede bådtilstand | 162–169 ms | 901–920 ms |
| Hele sidens indlæsning før forsøget | 2,40–2,54 s | 2,36–2,42 s |
| Tid fra indsendt beregningspakke til svar, median | Beregnes direkte | 22,4–22,6 ms |
| Resttid efter fradrag af workerens måling, 95-percentil | Beregnes direkte | 3,6–3,7 ms |

Tilstandene i begge varianter ville fylde ca. 183 kB som JSON. Workerkanalen bruger struktureret kloning. Resttiden indeholder kloning, kø og aflevering. Første tilstand måles efter den almindelige sideindlæsning og omfatter workerens egne modul- og feltinitialisering. Den viser prisen ved at flytte netop denne afgrænsning. [Rå målinger](simulation-profil.json)

**Anbefaling.** Behold den udtrukne JavaScript-simulation i spillet. Den målte worker frigjorde CPU-tid på hovedtråden, men gav omkring dobbelt inputforsinkelse og en langsommere første tilstand. Den er bevaret som måleværktøj. Testene af tidssteg og kendte momenter peger på modellering og kalibrering som forklaring på den rapporterede Laser-drejning. Vind- og vandopslag dominerer tidsforbruget med seks både. Det er det målte område for videre ydelsesarbejde. En generel rigid-body-motor ville stadig have brug for sejl, vandfelter og de neddykkede deles kræfter. Målingerne giver heller ingen konkret gevinst for en WebAssembly-port, som først ville skulle afgrænses og afprøves særskilt.

## Kendt reproducerbar fejl og kommandoer

I den automatiserede fulde kapsejlads `tests/physical-fleet.test.js` nåede ingen af de seks pilotstyrede både mål inden for forløbets 1.560 sekunder. Samme fejl kunne genskabes i browserbuild `012471a606a4` fra før udtrækningen. Prøven af den normale live-flåde ovenfor omfatter seks aktive både, rendering og inputkvitteringer.

Kør fra projektets rod. Profilværktøjerne bruger den almindelige lokale side på port 4173, med mulighed for `TACK_URL` og `CHROME_PATH`.

```sh
npm run check:simulation
npm run test:simulation
node scripts/simulation-replay.cjs
node scripts/laser-rotation.cjs
npm run build
npm run dev
```

Kør målingerne i en separat terminal med serveren i gang.

```sh
TACK_PROFILE_ROUNDS=2 node scripts/profile-simulation.cjs
TACK_WORKER_ROUNDS=2 node scripts/profile-simulation-worker.cjs
```

[De gemte kontrolinput](../../tests/fixtures/simulation-inputs.json), [referencen fra før udtrækningen](../../tests/fixtures/simulation-reference.json) og [den særskilte ændring af bølgeforløbet](../../tests/fixtures/simulation-relative-water.json) gør det muligt at gentage sammenligningen uden browser. Kommandoen `node scripts/simulation-replay.cjs --legacy STI_TIL_FØR_BUILD` kører også direkte mod den gamle kode, hvis browserbuildet er tilgængeligt.

De to foilforløb har særskilte forventede værdier efter ændringen til manuelt skøde, vingetrim og rebning. Racer 32’s forløb er opdateret efter tilføjelsen af en tredje sejler. [Foilforløb med manuelt trim](../../tests/fixtures/simulation-manual-trim.json) · [Racer 32 med tre sejlere](../../tests/fixtures/simulation-racer-crew.json)

Laserjollens to forløb har særskilte resultater efter rettelsen af benbevægelsen under vægtskift. De nye værdier dækker numerisk gentagelse af de samme kontroller. [Laserjollen efter rettelsen af vægtskiftet](../../tests/fixtures/simulation-laser-crossing.json)

Vægtpositionerne bruger nu den lokale sande vinds vinkel til stævnen. På Svær vælges siden ved en spillerkommando, og position 2 kan vælge den nye side i vindøjet. På Let følger besætningen automatisk luvsiden. [Laserforløb med valg ud fra vindvinkel](../../tests/fixtures/simulation-windward-crew.json)

Turbåd 43 har fået en yderstilling på sidedækket. Racer 32 fordeler planingsløftet på de våde dele af bunden, også under krængning. [Kølbådsforløb med de opdaterede modeller](../../tests/fixtures/simulation-yacht-balance.json)

Et fysiktrin uden browser kan køres sådan fra projektets rod.

```js
const { createSimulation } = require('./assets/simulation/node');
const simulation = createSimulation();
const field = { speed: 8.5, direction: 0, gusts: 0, waveHeight: 0.4 };
const boat = simulation.createBoat('laser', { x: 0, y: -12000 }, field);
const control = { steer: 0.25, trim: 0, crewPose: 2, crew: -1, difficulty: 'hard' };
const diagnostics = simulation.stepBoat(boat, control, field, simulation.fixedDt, { diagnostics: true });
console.log(boat.time, boat.theta, diagnostics.ledger);
```
