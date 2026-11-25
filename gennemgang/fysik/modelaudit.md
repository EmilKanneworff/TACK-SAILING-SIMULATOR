# TACKs sejladsmodel

Teknisk gennemgang, 25. november 2026. Gren **main**, commit **f51d22035e0eb1dbd27249273f97c630e0217e39**, lokalt produktionsbuild **55afe8661449**. De lokale ændringer ved auditstart indgår i buildet og skal med, hvis modellen skal reproduceres.


Historisk audit for buildet nedenfor. [Efterprøvning og senere rettelser](modelrettelser.md) dokumenterer ændringerne i den aktive model.

## Konklusion

Alle fem både har dynamisk frem- og sidebevægelse, heave, krængning, stampning og drejning. De tre konventionelle både og de to foilbåde bruger forskellige kraftmodeller og samme integrator omkring det aktuelle samlede tyngdepunkt. Besætningen ændrer fysisk massefordeling. Laserjollens medbevægelige vandmasse indgår særskilt i sideacceleration og drejning. Foilbådenes flapper og højde- og orienteringsregulering er automatiske også på Svær.

Der er ingen direkte kurslås, fast fartgrænse eller automatisk slæk i den almindelige sejladsmodel. Et stort rorudslag kan give lille nettodrejning, når blade er delvist tørre eller stallede, og når rig, skrog og foilkræfter virker mod rormomentet. Redning, start, netværkskorrektion og bådkollision kan skrive direkte til bevægelsestilstanden.

Der er begrænset ekstern validering. Historiske Laser-krydspunkter ligger tæt på aflæst referencefart og dækker få stabile forhold. En reproduktion af katamaranens lænsscenarie viste forbedring i et tidligere produktionsbuild. De to snævre Laser-vendinger i vindøjet har været kendte fejl i browserprøven. Rapporten nedenfor angiver resultaternes versioner og det omfang, de dækker.

[Maskinlæsbare profiler, regler og ordrette kodeuddrag](modelaudit.json). Filen er en del af afleveringen og kan læses som almindelig tekst. Kodevejene og linjenumrene refererer til de gennemgåede kilder. Relevante uddrag findes i leverancen.

## Revisions- og datagrundlag

- Chrome **158.0.8127.37** åbnede det lokale build på **http://localhost:4173/**. HTTP-revisionen, HTML-metadata og en uafhængig genberegning af build-ID gav **55afe8661449**. Serveret HTML matchede efter den forventede buildtransformation. De versionsbundne assets matchede kildefilerne med undtagelse af den buildgenererede konfiguration. Rasterpakke og loader blev genskabt med samme indhold, og browseren brugte begge indlæste gitre. I Fri sejlads flyttede et almindeligt højre-tastetryk Laserens faktiske ror over 0,05 rad. Browseren meldte ingen fejl i den korte kontrol. Den offentlige frontend og tjeneste blev ikke versionskontrolleret i denne audit.
- Relevante lokale ændringer omfattede bådprofiler, konventionel fysik, foilfysik, bund, vind, arbejdstråd for multiplayer, lobby, HTML, billedoptimering, pakkegenerator og statisk server. Den lokale Three.js r160 og bake-fields-generatoren var allerede nye filer ved start. Den fulde status og checksum for relevante assets følger med JSON.
- Verden har version **faaborg-quarter-1**. Eksporteret dybdegitter **914 × 639**, omkring 5 m i spillet, domæne øst −2125 til 2437,5 m og nord −2687,5 til 500 m. Dybden bruger to byte i RGBA8 over −8…40 m, ca. 0,000732 m pr. trin. Vindens statiske terrængitter er **885 × 665**, celler 6,25 m, start (−2606,25, −3168,75) m, med landklasse i Uint8 og relief/dække i Float32. Det retningsafhængige læ beregnes under kørsel. SHA-256 for den gengivne rasterpakke er `be07076a9997a631c40d5bbdb3493fc5b7aa429c832391db7a632367081314ab`.
- Kystens vandrette mål er kvartskala. Bundprofilen omregner modelleret kystafstand til referenceafstand og lægger en lokal uddybning til. De lokale felter evalueres i de komprimerede verdenskoordinater. Det forkorter fri vandstrækning og påvirker vindlæ og bølgeopbygning. Bådlængder, højder, bølgehøjder og fysiktrin bruger simulationens egne meter og sekunder uden kvartskalering. Terrænrelief og havbund er modellerede størrelser.

## Sådan går ét trin

| Lag | Konventionel båd | Foilbåd |
|---|---|---|
| Input og vind | Browserens `fixedStep` omsætter input og UI-mål. `runtime.stepBoat` opdaterer effektiv grundvind og kan fastholde seneste retning, indtil det nye vindgitter er klar. | Samme indgang. Ét ordinært 60 Hz-trin omfatter fire foilsubtrin. |
| Tid og aktuatorer | `SailPhysics.step` øger tid og opdaterer sø, skøde og ror. Rorreglen kan læse forrige bladflow. `updateRig` læser forrige sejllast. Reb og Turbådens ekstra sejl opdateres. | `FoilingPhysics.advance` opdaterer tid, sø, skøde og ror. Besætningens mål vurderes typisk med sejldata fra sidste subtrin. Vingens fok kan dreje mod forrige lokale AWA. Dernæst reb og rig. |
| Sejl, vand og vægt | Første `aero` giver last til bommen og vind til besætningen. Efter bom og vægt genberegnes sejlkræfter. Sværd/køl og ror anvender tidligere ventilation, men opdaterede lokale strømme. Opdrift, modstand, eventuel planing og bundkontakt beregnes. | Første `aero`, fysisk bom og ny aero. `massProperties`, `hullLoads`, første `foilLoads` med ventilation. Flapper og arme flyttes. CG/inerti og foilkræfter beregnes igen på ny geometri. Skroglasterne bevares fra før aktuatorændringen, og gravitationens momenter korrigeres til ny CG. |
| Bevægelse | Summer F og M inklusive eventuelle redningskræfter. `integrateMass` opdaterer bevægelse. Opdater cockpit, kæntring, diagnose og eventuel redningsprojektion. `refresh` genberegner vind og sejl ved ny pose. | Samme integrator. Opdater cockpit, kæntring, recovery, bæreandel og flyvestatus. `refresh` læser ny pose. |
| Flåde og grafik | Flåden forbereder fælles vind, sø og ur først. Bådkollision og banefaser følger efter alle både. Browseren tegner en interpoleret kopi. | Samme, med flere subtrin pr. båd. |

De centrale kilder er boats.js for parametre, settings.js og index.html for input og vejr, wind-field.js, shelter.js, water-depth.js og terrain.js for felterne. physics.js ejer de konventionelle kræfter og integrationen, foils.js foilkræfter og regulator, recovery.js opretningen og course.js kapsejladsens tilstand. runtime.js, live-room.js, live-worker.js, fleet.js, lobby.js og server/index.js forbinder simulation med transport og UI. index.html, crew-motion.js og hull-water.js tegner den fysiske tilstand og lokale vandeffekter. Fulde kildestier står ved reglerne.

### Koordinater og notation

Verden er højrehånds **øst, nord, op**. State.x og state.y ligger vandret, og heave er verdenshøjden af skrogets referencepunkt O. Bådens højrehånds lokale akser er **x frem, y op, z styrbord**. Rendererens xyz er **øst, op, minus nord**. Positiv theta og omega drejer mod bagbord, og theta=0 peger øst. Positiv heel sænker styrbord. Positiv pitch hæver stævnen. Styrbordskommando og positivt rorudslag er aktuatorfortegn. Kompas og solverens yaw vokser i hver sin retning.

Meter, sekunder, kilogram, newton og newtonmeter bruges i fysikken. Radianer = grader × π/180. Kompaskurs fra nord med uret er wrap360(90−theta/DEG). Vind fra bearing d giver flow −U×(sin(d),cos(d)). Bevægelsesretning bruger atan2(v_øst,v_nord) og er separat fra stævnen. Knob = m/s × 1,9438444924. HUD viser fart relativ til middelstrøm med 0,9 s filter og mindst 250 ms mellem tekstopdateringer. Afdrift og vind-VMG trækker også orbitalstrøm ved referencepunktet fra. Mærke-VMG er over grunden. Notationen smooth(a,b,x) er den klemte kubiske interpolation t²(3−2t) med t=clamp((x−a)/(b−a),0,1).

## De fem effektive bådprofiler

| ID | Spilnavn | L (m) | B (m) | Angivet LWL (m) | LWL brugt i modstand (m) | Skrogdybde (m) | Statisk dybgang (m) | Celler × skrog | Sejlklar kg |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `laser` | Laserjolle | 4,23 | 1,37 | 3,81 | 3,81 | 0,39 | 0,95 | 900 × 1 | 143 |
| `dinghy` | Racer 32 | 9,75 | 3,1 | — | 8,87 | 1,05 | 1,68 | 560 × 1 | 2200 |
| `yacht` | Turbåd 43 | 13,1 | 4,05 | — | 11,92 | 1,75 | 2,07 | 560 × 1 | 9600 |
| `ac75` | Foilmonohull | 20,7 | 5 | — | — | 2,1 | 3,21 | 1000 × 1 | 6900 |
| `ac72` | Foilkatamaran | 22 | 14 | — | — | 2 | 3,57 | 800 × 2 | 6900 |

Dybgang er beregnet på fladt vand med neutral fore/aft, pose 1, opret båd og initialiserede appendager. Det er forskellen fra uforstyrret vandspejl til laveste beregnede kontaktpunkt. Den ændrer sig med skrogpose og foils. En tankestreg markerer manglende eller ikke relevant værdi. Racerens og Turbådens LWL indgår som 0,91 × L i den konventionelle modstandsmodel. Foilmodstanden har egne koefficienter. Ac72 har to skrog med hver 1,70 m fysisk bredde og centerlinjer ved z = ±6,15 m.

| ID | Skrog / rig / udstyr (kg) | Ballast (kg) | Pr. arm kg (to) | Besætning | CG x/y/z (m) | I_G roll/pitch/yaw (kg·m²) | Personvandring ±m | CG vandring agter→frem (cm) | CG z ved pos. 1/2/3 i bagbord (cm) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `laser` | 56 / 10 / 2 | 0 | 0 | 1 × 75 | -0,1917 / 0,3542 / -0,1292 | 88,9 / 269,7 / 206,4 | 0,43 | 45,1 | -1,8 / -12,9 / -33 |
| `dinghy` | 880 / 150 / 170 | 760 | 0 | 3 × 80 | -0,1744 / -0,0863 / -0,1035 | 7280,4 / 24143,8 / 19026,5 | 0,6338 | 13,8 | -1,3 / -10,3 / -26,5 |
| `yacht` | 5200 / 400 / 900 | 2800 | 0 | 4 × 75 | -0,0309 / -0,0436 / -0,0245 | 32788,1 / 108382,4 / 80166,8 | 0,8515 | 5,3 | -0,4 / -2,4 / -5,5 |
| `ac75` | 2890 / 500 / 260 | 0 | 1265 | 8 × 90 | -0,2204 / 0,6019 / -0,0188 | 92069,3 / 187804,2 / 161140,7 | 0,55 | 11,5 | 0 / -1,9 / -3,8 |
| `ac72` | 3260 / 900 / 1150 | 0 | 300 | 11 × 90 | -0,4278 / 2,381 / -0,025 | 323295,6 / 308739,7 / 358720 | 0,5 | 14,3 | 0 / -2,5 / -5 |

CG og I_G er fra position 2 på bagbord, neutral fore/aft og initialiserede armsæt. De øvrige diagonaler og produkter af inerti, begge sider, besætningens prøvepunkter og faste massepunkter står i JSON. Racerens ballast sidder ved (0,10; −1,65; 0) m, Turbådens ved (0,25; −1,88; 0) m. Laseren har intet særskilt ballastmassepunkt.

| ID | Mast x/top, bom y/længde, luff (m) | Hovedsejl fuldt/1 reb/2 reb (m²) | Fok fuld rig/1/2 reb (m²) | Code 0/Gennaker/Spiler (m²) | Bomgrænser (°) | Lift slope, CLmax, CD0, Cind, Cplate |
| --- | --- | --- | --- | --- | --- | --- |
| `laser` | 1,02 / 6,18 / 0,98 / 2,73 / 5,15 | 7,06 / 5,93 / 4,8 | — / — / — | — / — / — | 7–86 | 5,25 / 1,22 / 0,038 / 0,13 / 1,26 |
| `dinghy` | 1,2 / 13,6 / 1,3 / 4,72 / 12,1 | 35 / 27,3 / 19,6 | 20 / 20 / 20 | — / — / — | 4–83 | 5,25 / 1,3 / 0,038 / 0,13 / 1,26 |
| `yacht` | 1,5 / 18,2 / 2 / 5,7 / 16 | 48 / 37,44 / 26,88 | 32 / 32 / 32 | 90 / 105 / 115 | 5–83 | 5,25 / 1,3 / 0,026 / 0,1 / 1,26 |
| `ac75` | 3 / 26,5 / 1,35 / 12,86 / 25 | 165 / 130,35 / 95,7 | 65 / 50,7 / 36,4 | — / — / — | 1–82 | 5,6 / 1,45 / 0,016 / 0,065 / 1,2 |
| `ac72` | 2,2 / 40 / 1,8 / 8,52 / 38,2 | 205 / 205 / 205 | 55 / 42,9 / 30,8 | — / — / — | 0,7–84 | 7,2 / 1,5 / 0,012 / 0,045 / 1,12 |

Fok og storsejl bruger samme aktuelle polarstruktur med forskellige trykcentre, trim, luff og geometrisk areal. Vingen beholder 205 m² ved reb. Tabellens fald gælder fokken, mens vingens koefficienter og flaps reduceres. Ved særskilt ind­rulning kan Turbådens fok nå 18,56 m² på grundriggen. Et aktivt ekstrasejl ruller fokkens effektive bredde ind i takt med hejset. Trykcentre og vingens chordstationer samt øvrige koefficienter er i JSON.

| ID | Del | Geometri fra aktuel profil | Vandringsgrænse |
| --- | --- | --- | --- |
| `laser` | Sværd | 0,245 m², chord 0,3 m, root -0,14 / tip -1,02, x=0,05, z=0 m | Fast |
| `laser` | Ror | 0,105 m², chord 0,205 m, root 0,145 / tip -0,415, x=-1,95, z=0 m | 28° nom. |
| `dinghy` | Køl | 1,95 m², chord 1,18 m, root -0,4 / tip -1,8, x=0,1, z=0 m | Fast |
| `dinghy` | Ror | 0,31 m², chord 0,44 m, root 0,58 / tip -1,32, x=-4,24, z=-0,9 m · 0,31 m², chord 0,44 m, root 0,58 / tip -1,32, x=-4,24, z=0,9 m | 28° nom. |
| `yacht` | Køl | 2,9 m², chord 1,65 m, root -0,5 / tip -2,15, x=0,25, z=0 m | Fast |
| `yacht` | Ror | 0,82 m², chord 0,62 m, root -0,48 / tip -1,933, x=-5,25, z=0 m | 26° nom. |
| `ac75` | port | Vinge 2 m² / span 4,5 m, lodret blad 0,95 m², center (0,55, -2,55, -4,6) m | Flap -10° til 17° |
| `ac75` | starboard | Vinge 2 m² / span 4,5 m, lodret blad 0,95 m², center (0,55, -2,55, 4,6) m | Flap -10° til 17° |
| `ac75` | rudder | Vinge 0,85 m² / span 2,8 m, lodret blad 0,82 m², center (-9, -2,45, 0) m | Flap -12° til 15° |
| `ac72` | port | Vinge 2,4 m² / span 3,2 m, lodret blad 0,72 m², center (0,8, -3,2, -6,15) m | Flap -10° til 18° |
| `ac72` | starboard | Vinge 2,4 m² / span 3,2 m, lodret blad 0,72 m², center (0,8, -3,2, 6,15) m | Flap -10° til 18° |
| `ac72` | rudderPort | Vinge 0,45 m² / span 1,75 m, lodret blad 0,37 m², center (-9,5, -3, -6,15) m | Flap -12° til 17° |
| `ac72` | rudderStarboard | Vinge 0,45 m² / span 1,75 m, lodret blad 0,37 m², center (-9,5, -3, 6,15) m | Flap -12° til 17° |

Rorene deler aktuator på hver båd. Racerens blade og katamaranens ror har separate våde prøveflader og egne momenter. Vingens rorbetegnelse refererer til en bageste støtteflade sammen med et separat lodret rorblad. Foilers rorvinkel har forskellige grænser efter fart og skrogkontakt. Den faktiske beregning står i RUDDER-02. Ror, køl og foils har fysiske prøvepunkter beskrevet i RUDDER-01/03 og FOIL-01/02, og appendagernes korrekte neddykning afhænger af hele skrogets pose og lokale bølger.

### Tabeller for bølgekomponenter

| Bånd | λ₀ m | λ ved managed-reference m | A₀ m | Fase rad | Basisvinkel fra dominans (°) | Managed lang gain |
| --- | --- | --- | --- | --- | --- | --- |
| Lang | 27 | 27 | 0,161 | 0,2 | 0 | 1,32 |
| Lang | 34 | 37 | 0,098 | 2,1 | 3,2 | 0,68 |
| Lang | 22,5 | 25 | 0,07 | 4,7 | -4,2 | 0,62 |
| Lang | 9,4 | 20 | 0,075 | 3,4 | 0,8 | 0,55 |
| Kort | 7,9 | 7,9 | 0,052 | 1,1 | 3,5 | 1 |
| Kort | 5,6 | 5,6 | 0,025 | 3,9 | -5 | 1 |
| Kort | 4 | 4 | 0,01 | 5,1 | 2 | 1 |
| Kort, managed | 5,1 | 5,1 | 0,022 | 2,8 | 8,8 | 1 |
| Kort, managed | 3,3 | 3,3 | 0,016 | 0,6 | -10,4 | 1 |
| Kort, managed | 4,25 | 4,25 | 0,014 | 5,9 | -2,2 | 1 |

| Chop | Dominerende lang λ i m | Lang periode i s | Formfaktor | Nominel kort Hs i m |
| --- | --- | --- | --- | --- |
| 0 % | 58,26 | 6,11 | 0,235 | 0 |
| 50 % | 36,39 | 4,83 | 0,501 | 0,2 |
| 100 % | 21,91 | 3,74 | 0,571 | 0,4 |

Kontrolværdier fra den aktuelle profil i stationært åbent vand ved 2,50 m dønning og 5 m/s grundvind. Ingen kyst- eller bundfaktorer.


Referencetabellen viser grundkomponenterne før løbende periode-, chop-, læ- og dybdekorrektion. Et enkelt sinusled har H top–dal = 2A. Meterværdien i hovedindstillingen er Hs for en gruppe lange komponenter, normaliseret som fire standardafvigelser i det lineære referencespektrum.


ILCA7-mål er baggrund for Laserens længde, bredde og storsejl. De **56 kg** er den interne skrogkomponent med særskilt rig og udstyr. Volumenform, massefordeling, dæmpning og sejlpolar er valgt til spillet. Racer 32 er en fiktiv båd med Melges-inspiration. Turbåd 43 har en generisk turbådsprofil. Foilbådene bruger klassernes proportioner som referencer og egne masser, kontrol- og kraftkoefficienter. Fysiske prøver bruger profilskrog, forenklede rigcentre og blad-/foilflader. Grafik har desuden et formet cockpit, synlig rig og besætning, folietværsnit og dækdetaljer. Disse visuelle elementer udvider ikke mængden af kollisionsprøver. [ILCA, målediagrammer](https://ilcasailing.org/rules-and-technical/measurement-diagrams/)

### Vægt frem og agter

Samme besætning og last bevares under skift. Artikulerede masseled følger en accelerationsbegrænset bevægelse, mens foilbåde bruger glidende stationer. Tyngde virker lodret i verden. Et nyt tyngdepunkt ændrer momentarmene til opdriften, rorene og sejlene, og trækket fra andre retninger kan derfor kobles mellem flere akser. I statisk ligevægt vil vægt frem typisk sænke stævnen, mens ændret vådområde, træghed og øvrige kræfter kan give en anden øjeblikkelig respons i sø. Rorets dybde ændres, når agterenden flyttes vertikalt. Foilregulatoren føjer også et bidrag på højst ±0,85° til det ønskede pitchsetpunkt på baggrund af vægtforskydningen.

Fysik og grafik bruger samme besætningsgrundlag. Grafikken kan glatte kropsholdninger og tilføje særskilt bevægelse. Besætningsmassen medregnes gennem tyngde og tensor én gang. Diagnosen kan vise den del af tyngdemomentet, som besætningen står for. Ekstra opdrift fra delvist neddykket krop, rig eller ballast kan ændre rettemomentet.

## Register over direkte tilstandsændringer og hjælp

| Regel | Direkte effekt | Omfang og spillerinput |
|---|---|---|
| DYN-02 | Position, orientering og seks hastigheder fra kraftintegrationen. | Ordinær sejlads. |
| INPUT-01/02, MASS-03, AID-01 | Ror- og skødemål, valgt pose, side og fore/aft omsættes via aktuatorer. Let styrer vægt og centrerer fore/aft fysisk. | Svær bevarer valgt mål til ny kommando under normal sejlads. |
| RUDDER-02, SAIL-02/03/05/06 | Faktisk rorvinkel, sheet, bom/rate, reb, side og vingeflap/fokvinkel. Vingen har mekanisk projektion af bomvinkel og rate ved det hårde stop. | Alle både, egne aktuatorgrænser. Ror og skødemål er spillerens, også på Let. |
| AID-02 | Ekstra moment om bommens egen akse. | Frivillig Let-hjælp, af som standard. Virker derefter gennem sejlkræfter. |
| SAIL-07 | Valgt sejl, hejsegrad, fylde og luff. | Let kan afvise hejs og tage ned. På Svær kan fylden falde, mens sejlet forbliver valgt og hejst. |
| FOIL-03/04 | Flap, arm og relaterede mål samt fordeling af løft mellem foils. | Begge sværhedsgrader, virker gennem beregnet vandkraft. |
| AID-03/04/05 | Kæntringsflag, ror mod neutral, aflastning og hjælpekraft. Fallback skriver x/y, heave, fart, orientering, rates, besætning, rig og foils som en kurve eller frisk starttilstand. | Kan tilsidesætte alle kommandoer. Safe-location kan direkte flytte båden. |
| AID-06 | Reset, bådskift, valgt start, prøvestart og kapsejlads. Initialiserer ny pose og statisk heave, evt. startfart. | Afslutning sætter raceflag og solo-pause. Flåden kan skifte til resultatfase. |
| HULL-07/08 | Bund bruger kontaktkræfter. Bådoverlap i flåden løses med direkte vandret impuls og separation. | Bådkollision i multiplayer og bund i begge tilstande. |
| NET-01/02 | Autoritativ tilstand, neutraliseret input ved timeout, korrektion og replay. | Kan erstatte en tidligere lokal forudsigelse. |
| SEA-05 og VIS-01/02 | Heavesøgning bruger midlertidig heave og gendanner den efter søgning. Rendering ændrer kopier, mesh og kamera. Debug-visningen eksponerer referencer, som testkode kan skrive til. | Ligevægtsresultat anvendes på de start-/redningsveje, der vælger det. |

## Modelkatalog

Formlerne nedenfor er kodeafledte. JSON-filen angiver for hver regel input, parametre, aktivering, begrænsninger, output, cadence, uddrag, implementationsstatus, modeltype, testgrundlag og usikkerhed.

### Koordinater og instrumenter

**UNIT-01 · Akser, vinkler og projektion.** f=(cos θ,sin θ), r=(sin θ,−cos θ). oy=cos(heel)*p.y−sin(heel)*p.z, side=sin(heel)*p.y+cos(heel)*p.z, along=cos(pitch)*p.x−sin(pitch)*oy, up=sin(pitch)*p.x+cos(pitch)*oy. Verdenspunkt = O + f*along + r*side + op*up. DEG=π/180. En kompasgrad stiger med uret; θ stiger mod uret. Alle både, også ved prøver til land og sejl. *Aktiv · fysisk model · eksisterende test*. physics.js:320.

**UNIT-02 · Instrumenter og relativ fart.** heading=wrap360(90−θ/DEG), course=wrap360(atan2(v_E,v_N)/DEG). Log=1.9438444924*norm(v−middelstrøm). Leeway=atan2(v_rel·r,v_rel·f); VMG mod vind=−v_rel·vindvektor/TWS. v_rel trækker også orbitalvand ved dybde max(0,−heave) fra. Mærke-VMG projekterer grundfart mod mærket. Kurs/afdrift skjules under .03 m/s, vind-VMG under .01 m/s. Logvisning τ=.9 s og mindst .25 s mellem nedskrivninger. Statusmålinger og HUD. *Aktiv · spiltilpasning · eksisterende test*. physics.js:1435, index.html:5750.

### Fysisk geometri

**PROFILE-01 · Skrogprofil og defaults.** make spreder COMMON før v. x_station = x_normaliseret*LOA. Halvbredde=w_normaliseret*(hullBeam eller beam)/2. Bunden er deckY−(hullDepth−rocker*(x/(.52L))²)*(.58+.42*min(1,w/(.25B)))*(1−clamp(abs(z)/w,0,1)^chinePower). Eksakte effektive profiler og stationer i bådprofiler. Ukendt ID falder tilbage til laser. Fælles skroggeometri med særlige cockpit- og kat-offsets. *Aktiv · empirisk tilnærmelse · antagelse*. boats.js:14, boats.js:238.

### Masse, tyngde og besætning

**MASS-01 · Masse og vægt.** m=sum(m_i); CG=sum(m_i*p_i)/m. F_g=(0,0,−9.81m) i verden. Lokalt RᵀF_g. M_g ved O = r_CG×F_g. Segmentmomenter vises særskilt. De summeres allerede ind via CG. Faste punkter og nominelle masser i bådprofiler. Tipflotation kun hvor ballastVolume findes. Foil massScale kan påvirke modelkørsler. Konventionelle bådes fysiske besætning fra crewJoints, foilbåde fra crewStations og de to arm-CG. *Aktiv · fysisk model · eksisterende test*. boats.js:41, physics.js:825, foils.js:53.

**MASS-02 · Inerti og produkter.** I_O=I_intrinsic+Σm((p·p)I−ppᵀ). I_G=I_O−m((CG·CG)I−CG CGᵀ). Integratoren behandler spin og moment med alle seks tensorled. Profiler, segmenter og armpositioner. Analytisk tensorinvers med numerisk fallback. Forskellen mellem skrog og samlet CG følger den aktuelle position. *Aktiv · empirisk tilnærmelse · eksisterende test*. boats.js:41, physics.js:592, physics.js:621, physics.js:1386, foils.js:53.

**MASS-03 · Besætningens bevægelsesprofil.** Kritisk dæmpet fjeder med ω=1/max(.04,response) og a=clamp(ω²(target−x)−2ωv,−amax,amax). Hastighed og næste position opdateres med grænserne vist i uddraget. Målet sættes eksakt, når både afstand og fart er under henholdsvis 10⁻⁵ og 10⁻⁴. Blends for kropsled benytter femtegradspolynomium 6u⁵−15u⁴+10u³ og kontaktpunkter. Fore/aft 2.5/s, 10/s² og τ=.18; Let pose 9,80,.07 og side 6,45,.075. Konventionelle Svær værdier i profilen. Svær manuelle mål, Let afbalancerer. Neddykket/kæntret bevægelse styres også af crewSwim. *Aktiv · spiltilpasning · eksisterende test*. physics.js:718, physics.js:782, boats.js:273.

### Kontroller

**INPUT-01 · Spillerinput til fysik.** Tastatur, tryk og touch samles pr. fast trin. Drejning normaliseres −1…1. Triminput ændrer et mål i fysisk skødevandring; 1/2/3 udsteder pose plus en sidekommando. Z/X bygger et fastholdt fore/aft-mål, også ved korte tryk. Z/X flytter målet ±.9/s, eller .5 ved et kort tryk. Fokus, pause og aktivt modalpanel kontrolleres af browseren. Ved resume og reset ryddes input. *Aktiv · spiltilpasning · eksisterende test*. index.html:5370, physics.js:740.

**INPUT-02 · Manuel placering og vending.** Vindens side beregnes fra sand vind relativt til stævn. Ved 1/2/3 eller gyldig sidekommando vælges luv. I den korte zone mod vinden bruges tackCrewSide med gemt indgangsside og ror. Fravær af kommando bevarer valgt mål og side. Vindsidens dødbånd 5°. Sidehukommelse registreres nærmere end 90° mod vinden. Svær. En ren kursændring ændrer vindsidehukommelse, ikke det valgte sidemål. *Aktiv · spiltilpasning · eksisterende test*. physics.js:725.

### Hjælp, kæntring og start

**AID-01 · Automatisk besætningsbalance.** Limit = g*sum(m_i*z_i) for fuldt hæng til styrbord. Pred=wrap(heel)+.32*heelRate. Demand=−(.82*M_sail/max(1,limit)+3.7*Pred). For valgt luv er Extend=1+2*clamp(demand*side,0,1)^.57. Pose er 1 gennem vindøjet, højst 1.25 under kontrolleret sideskift, ellers Extend. Hurtige Let-aktuatorer i MASS-03, den fulde formel i uddrag. Automatik kun Let under normal sejlads. *Aktiv · spiltilpasning · eksisterende test*. physics.js:756.

**AID-02 · Hjælp ved tab af fart i vindøjet.** Gate=produkt af glidekurver for lav fart og små TWA. Level ændres højst dt/.65. τ_boom=level*clamp(I_b*(20*(target−boom)−4*boomRate),±1.2*m). ironsSpeed, ironsAngle og ironsBackAngle pr. profil. Styringsinput >.08, vind >.6 m/s, momentet sættes til nul ved >30° TWA. Let, ironsHelp aktivt, ikke kæntret eller i redning. Standard false. *Aktiv · spiltilpasning · eksisterende test*. physics.js:1208, physics.js:1222, settings.js:48.

**AID-03 · Kæntring og cockpitvand.** Capsize hvis abs(wrap(heel))>profile threshold. Foil desuden abs(pitch)>65°. Floodmål=smooth(.025,−.065,coaming) konventionelt eller smooth(.03,−.10,coaming) foil. Førsteordens τ fill/drain pr. profil, derefter mindre luftbåret volumen. capsizeAngle og fill/drain pr. profil. Standard capsize 74°. Andre overrides i tabellen. Alle, begge sværhedsgrader. Cap flag låser status før aktiv opretning. Rig, regulator og crew reagerer. *Aktiv · spiltilpasning · eksisterende test*. physics.js:1413, foils.js:482, recovery.js:152.

**AID-04 · Automatisk redning med kraft.** Ved kæntring/ordre oprettes plan med ca. 75° TWA. Sheet op til .02, recoveryAeroScale glider til .02. Roll/pitch/yaw hjælp = clamp(I*a_PD−fysisk moment,cap), plus drag −m*min(1.05,7/speed)*v. Efter 1.8 s og inden for roll35°/pitch25° PD på rodfundet heave. Unload .25 s, load-reduktion .15 s. Fysisk slut tidligst efter 3 s og .10 s hold. Se CONFIG for præcise P/D/caps. Automatisk med autoRecovery ikke false, og rullemoment før fallback. Presser spillermål for sejl, vægt og arm ned efter egne mål. *Aktiv · spiltilpasning · eksisterende test*. recovery.js:14, recovery.js:68, recovery.js:152.

**AID-05 · Redning med direkte fallback og ligevægt.** Efter 3.50 s bruger projectFallback Hermite(x0,v0,x1,0,u) over pose, rates, boom. Valideret sted kan direkte erstatte x/y og sætte vx/vy=0. finish Object.assign(s,fresh) efter 4.40 s eller 4.45 s deadline/4.50 watchdog med antaget safe start, CG og ny statisk ligevægt, 0 fart. Ved stabil slut før fallback løses også frisk tilstand. Ni sikkerhedsprøver i et 3×3 mønster, dybde≥max(2,profildybde proxy)+1.2 m. Spiral 96×24. 38 halveringer for konventionelle både og 40 for foilbåde. Begge sværhedsgrader. I normal sejlads er solverheave fri. Fallback kan tilsidesætte både integrator og spillerinput. *Aktiv · spiltilpasning · eksisterende test*. recovery.js:31, recovery.js:110, physics.js:906, foils.js:388.

**AID-06 · Startsted, start og kapsejlads.** Reset opretter ny state, startmarkering eller spawn justerer lokation og trim. Kursløb søger startsetback 24 m, kan begynde bevægelse før skud, og lader fase følge ur/position. Solo finish pauser simulation. Flådens løbsresultat er metadata. Fallback Faaborg i Fri sejlads, courseScale pr. båd og autoritativ største profil i flåde. Prøvetilstandene windTrial/waveTrial kan sætte fart/trim på start. Opstart, bådskift, genstart, debug fixture. Udskifter state. *Aktiv · spiltilpasning · eksisterende test*. index.html:4637, index.html:4718, index.html:4822, runtime.js:78, live-room.js:98.

**AID-07 · Inaktive parametre og fravær af direkte kursregulator.** rollRestoring og autoBalanceGain er nulværdier i COMMON uden fundet aktiv læsning. ironsYawAcceleration og ironsMaxYawRate læses heller ikke af den aktive hjælp. YawAssist=0 i kraftledger. En naturlig kraftligevægt kan give fast kurs og lille netto rorvirkning. Ingen regel for direkte fastholdt kurs, fartminimum, topfart, afdriftsbegrænsning eller tvungen neutral trim i normal integration. Normal sejlads. Regler for inputaktuator, frivilligt bakket bom og redning er særskilte. *Ikke implementeret · spiltilpasning · antagelse*. boats.js:31, physics.js:621, physics.js:1395, foils.js:473.

### Vind og læ

**WIND-01 · Valgt og anvendt vejr.** normalize afgrænser, migrate oversætter legacy waves, advanceWind flytter værdier eksponentielt og drejer ad korteste vej. stepBoat udsætter effektiv retning hvis lookup ikke er bygget endnu. Rummet forbereder fælles vind/sea før fleetsejlads. Vind 0–20, standard 5 m/s/0°, pust .20, τ 1.05 s, holdt vinkel ved uforberedt gitter. Sædvanlig solo, fast replay kan have waitForWind:false. Krops- og feltmiljø adskilt. *Aktiv · spiltilpasning · eksisterende test*. settings.js:8, settings.js:83, runtime.js:33.

**WIND-02 · Terræn, læ og genopbygning.** I retningsgitter udledes h=.9*relief, mål=min(.78,(.06+.67*(1−e^(−h/13))+.29*cover+.08*clamp(slope/.24,0,1))*(1−e^(−breadth/44))*(1−e^(−fetch/55))). Wake-længde=12+(h+6*cover)*(6.2+2.2*cover). Sideinterpolation og afstandsrelaksation følger sweep, se uddrag. Eksponering i højde z: 1−(1−E_raster)*exp(−max(0,z−2)/heightScale). 6.25 m, 5° interpolation, højde 2 m ref, heightScale 5–40, memory 155, kant 140. Raster følger spillerverdens kompakte x/y. Kun inde i gitter og med shelter. Retninger caches og processeres i bidder ved hovedtrådsforberedelse med budget 2,5 ms pr. opgave. *Aktiv · empirisk tilnærmelse · eksisterende test*. wind-field.js:12, wind-field.js:100, wind-field.js:207.

**WIND-03 · Pust og lokalt vindskift.** along=x sin d+y cos d+.84 U t, across=x cos d−y sin d; G=sum af tre sinusled +1.05*turb*sin(.097along−.056across+phase). U_loc=max(0,U*E*(1+gusts*clamp(G,±1))). Retning plus gusts*(7 sin(…)+21 turb sin(…)) grader. Flow=−U_loc*(sin,cos). Tre faktortabeller og faseteknik i uddrag. Default seed 2647. Nul gusts giver ingen sinusgange. Feltet har ingen støjreset pr. billede. *Aktiv · empirisk tilnærmelse · eksisterende test*. wind-field.js:281, physics.js:320.

### Vandfeltet

**SEA-01 · Bølgevalg og betydning.** Med endelig waveHeight og chop og uden numerisk waves: scale=H/(4√(ΣA_long²/2)). Amplituder i kortbånd styres selvstændigt af chop*0.40/SHORT_HEIGHT_UNIT. q=chop−.35. Lang periode skaleres 1−q*(q<0?.53:.42). Den lange form bruger .48+q*(q<0?.70:.14). Kort periodemultiplikator .77*(1−.13q). H 0–2.5. Windsea faktor .45..1.40, opbygning 6 s. Lang højde τ=profilens seaTimeConstant. Profilmix 1.8 s. Faser i tabellen. 0 % chop fjerner kortbånd, forkorter/forlænger også langbånd. 0 m med positiv chop kan give bølger. Legacy waves vinder hvis indsat numerisk ved siden af H. *Aktiv · empirisk tilnærmelse · eksisterende test*. physics.js:24, settings.js:8, index.html:4950.

**SEA-02 · Analytisk bølgefelt.** q=k*(x*dirX+y*dirY+phasePath)−ωt+phase. η=a sin q−bend*k*a² cos 2q. Hældning differentierer både fase og amplitudefelt. Vandets horizontale v≈aω sin q * (unit local dir) * dybdefaktor, a_h≈−aω² cos q * samme. Vandets lodrette fart bruger cosled og harmonik. Overgange differentieres. 10 komponenter, 4 lange/6 korte. Legacy 4+3. ω0=√(9.82k0). Lang spredning .28*profilens spread. Kort 5.1×. Ingen horisontal meshforskydning. Interpolerer gammel/ny profil i bådens simulationstid. Fysikkens højde er eta i verdenspunkt. *Aktiv · fysisk model · eksisterende test*. physics.js:140, water-depth.js:47.

**SEA-03 · Fetch, bølgelæ og lavvand.** Kyststråler center/±9°. s=1−.82*max(0,e^(−f/355)−e^(−1450/355))/(1−e^(−1450/355)). chop=.89*g(f)+.055*(g(f_left)+g(f_right)), g=.012+.988*clamp(f/1250,0,1)^.67. Tyndt vand: smooth(d/limit)*min(1.55,1/√groupRatio), fælles breaker fra √(H_long²+H_short²)/(.68d), onset .6. Fasefelt akkumulerer afstand*(k_local/k_deep−1) opstrøms, standser i land. Raster 461×461, retning 1°. Fetch begrænset 6500 m. Bundamplitudefaktorens overgang er 2.4 m for dønning og 1.4 m for chop. Fase 10° og .25 s kvantisering, 0…1024 m lagret. Kun dækket område og shelter aktivt. Lang dønning bruger swell. Legacy lokalt skabt langbånd har ekstra fetch. Kortbånd følger vindretning. *Aktiv · empirisk tilnærmelse · eksisterende test*. shelter.js:8, water-depth.js:30, physics.js:170.

**SEA-04 · Dybde og middelstrøm.** Geometrisk afstand d til kyst; D=d/.25. Offshore D*.115 til D=100, derefter 30−18.5*exp(−(D−100)*.115/18.5). Lokalt tillæg 6*smooth(d/6)*(1−smooth((d−9)/27)) for d<36 m. Vandhastighed = s.waterX/Y + orbitalv. Middelvandstand 0. Dybdeteksturen interpolerer 16-bit værdier over −8…40 m. Middelstrøm starter som 0. Tilstandsfelt og testhook findes. Bundkontakt bruger præcis kystprøve. Bølger bruger depth grid. Både skaleres fysisk i m, ingen kvartskalering af båd eller tid. *Aktiv · spiltilpasning · eksisterende test*. terrain.js:17, terrain.js:40, water-depth.js:8, physics.js:329, physics.js:1281.

**SEA-05 · Cache under heavesøgning.** waterForHeaveSearch cacher efter præcist vandret x/y, inden for én synkron søgning med låst env, tid og pose. Højde genbruges. Ved forskellig dybde genberegner resolveHeaveWater den dybdeafhængige orbitalfaktor fra gemte termer. Injiceret vand genprøves for andre dybder. Nøglepar og genbrugsbetingelser fremgår af uddraget. Bruges af rodfinding for ligevægt, almindelige force-samples forbliver uden denne søgecache. *Aktiv · numerisk stabilisering · eksisterende test*. physics.js:293, physics.js:884, foils.js:388.

### Sejl og vinge

**SAIL-01 · Relativ luft ved riggen.** V_air,p=V_true(xp,yp,zp,t)−(V_O+ω×R p+V_boom). V_boom indeholder boomRate*afstanden til mast og fortegnet fra local p. Vind prøves i trykpunktets aktuelle verdenshøjde, og læaftagning med højden begynder over 2 m. Den rapporterede AWA er skrogets centrumvind uden bidraget fra bevægelse ved sejlets trykpunkt. Punkt pr. sejlstrimmel eller trykcentrum. Pust og højdeafhængigt læ er lokale. Boomrotation medregnet for storsejl/vinge, separate fokprøver uden boomrotation. *Aktiv · fysisk model · eksisterende test*. physics.js:321, physics.js:519, physics.js:956, foils.js:98.

**SAIL-02 · Skødeprocent, vandring og moment.** Fysisk sheet=t+k*t*(1−t), hvor t er vist trim i 0…1. Inverse 2*sheet/(1+k+√((1+k)²−4k*sheet)). Målrate i vist trim blandes fra .58 ind/.82 ud til .20 i begge retninger, smooth(.35,.50,t), kombineret med profilens skøde-/satsbegrænsning. Stop L=boomMax+(boomMin−boomMax)*sheet. τ_sheet=−sign(b)*I_b*(120 max(0,abs(b)−L)+15*outward*d). Per-båd sheetCurve, sheetRate, releaseRate i profiler. controlRate .35–2. Wing lineær. 0 % giver største tilladte vandring. Normal UI sender sheetTarget. Legacy relativ trim uden target bruger anden rate direkte. *Aktiv · spiltilpasning · eksisterende test*. physics.js:1105, index.html:5370.

**SAIL-03 · Bom/vinge, læns og bomning.** Integrér trykmoment, dæmpning, skødemoment og eventuel maneuvrehjælp om mast. Bommens ønskede gyroretning i læns følger fortegn af AWA med hysterese, føder trykstyret gybeTarget. Laser bruger desuden strimlernes fysiske mastmoment i sin beregning. Boomreaktion mod skrog kun i aktiv svingtilstand. ±5.5 rad/s, vandring begrænset af min(boomMax,stop+5°). Læns starter omkring 120° AWA og undgår helt agterind fra en profilmargin. Kodeuddrag viser branches. Let og Svær dynamisk. Lively ved Svær og sejlads, rigide vinger får særvej ved skødestop. *Aktiv · empirisk tilnærmelse · eksisterende test*. physics.js:1221.

**SAIL-04 · Kraft på konventionelt storsejl og fok.** Projicér relativ vind på plan normalt til mast. α=atan2(lokal 2D kryds og prik mod chord). fold=.5 atan2(sin(2α),cos(2α)). Stall=smooth(stallStart,stallEnd,abs(fold)); Cl=shape*[(1−stall)*Clmax*tanh(slope*fold/Clmax)+stall*separation*sin(2α)]. Sep=.90+(.5*plate−.90)*aft. Cd=profile+induced*Cl²+plate*sin²α*stall. q=.5ρ_air*V_proj²*A*expo. Løft vinkelret i plan, drag langs plan, tilbage til verden. M=(r×F) projiceret på Eulerakser. 3 hovedstrimler vægt/højde (5/9,7/45),(3/9,13/27),(1/9,7/9). Fok ét centrum. aft=smooth(.42,.88,flowForward/speed)*smooth(.9,2,speed), trykarm reduceres i læns. Kraft reduceres via eksponering mod vand og redningsskalering. Ingen ekstra global cos(heel). *Aktiv · empirisk tilnærmelse · eksisterende test*. physics.js:922, physics.js:951.

**SAIL-05 · Luff, fylde og sejlform.** Tidligere luff og load giver fill=(1−luff)*smooth(.08,1.4,AWS). Camber_mål=c.camber*(.88+.12*(1−sheet))/(1+.20*load). Twist fra profil, skøde og evt. tryktwist Racer. Flutter fra løs dug/stall/pust/gybe, separat for fok. En del af sinusudsving indgår direkte i α. τ camber/twist .7 s. Fill .45 s, jib .40 s. Flutter .12/.22 s voksende, .36 s aftagende, fase 7.5+.52 min(21,AWS). Svær mere livlig. Vinge har ingen cloth flutter. Fok kan stadig bevæge sig. Capsize/redning dæmper flutter. *Aktiv · empirisk tilnærmelse · antagelse*. physics.js:530, physics.js:967, foils.js:98.

**SAIL-06 · Rebning, fok og vingekraft.** Laser k=1−.16*n ændrer kun chord, Racer/Turbåd k=1−.22*n ændrer luff; A=A0*k. Turbådens fok A=A0*(1−.42*headsail)*(1−extraHoist), CP nærmer tack med √(1−.42*headsail). AC75 A=A0*mix(1,heavyAir,r), skalering af luff/chord/arme med √. AC72 vinge 205 m² fast, Cl skaleres mix(1,.68,r), induceret Cd bruger skaleret Cl og flap peak mix(1,.22,r). Fok A ændres med .56 ved fuld reduktion. Konventionel .55 trin/s, headsail .48/s. Foil r .28/s. Vingeflap højst 11°, 38°/s. Jib feather ved løs vinge, max 30°/s. Racer fokken er modelmæssigt uændret ved reb. Rigtig rig for hver båd. Yacht kan have manuelt foktrim på Svær, Let kobler det til bommen. Redning begrænser tryk. *Aktiv · empirisk tilnærmelse · eksisterende test*. boats.js:368, physics.js:934, physics.js:951, foils.js:90, foils.js:444.

**SAIL-07 · Code 0, gennaker, spiler.** A=A0*hoist. Fill mål=hoist*angleSupport*trim*shadow*settled*smooth(.5,3,V). Trim=retainedTension*clamp(1−1.25*abs(sheet−reference),0,1). Shadow=1−loss*smooth(shadowAngle,178°,AWA). Lift og drag fra fill samt flagdæmpning .21*q*smooth(.42,.94,luff). Sejl kræfter summeres med main og fok. Asymmetrisk side=−sign(AWA), spiler har modsat strategi ved 100–165°. Profiler for Code 0/gennaker/spiler i JSON. 4 s hejs/nedtagning. Unsafe 4 s på Let før nedtagning; τ fill 1.05/.42 s, side 1.5 s, luff .27 s. Yacht kun. På Let ude ved valgt vind/kurs. På Svær følger det valget også ved kollaps eller overbelastning. Ned først ved sejlski forhold til *Aktiv · empirisk tilnærmelse · eksisterende test*. boats.js:375, physics.js:925, physics.js:1008, physics.js:1296.

**SAIL-08 · Aerodynamik på foilbåde.** For hvert sejl ét effektivt trykcentrum, projiceret luft u=u_air−span*(u_air·span), α fra kryds/prik mod chord, rigid wing flap offset .28*flap. Cl polar som i uddrag, separeret .92 sin(2α). L vinkelret på tværstrøm og mast. Drag langs fuld lokal luft. Exposition smooth(−.1,.5,luftafstand). Alt fra profil. Vingens faste planform og geometriske tablestationer. Ingen ekstra cos(heel). AC75/AC72. Summér main+jib om deres punkter, recoveryAeroScale multiplicerer tryk. *Aktiv · empirisk tilnærmelse · eksisterende test*. foils.js:90.

### Vandkontakt og modstand

**HULL-01 · Opdrift, vandlinje og rettemoment.** Cellefyld=clamp(.5+(η−heave−up)/projectedSpan,0,1) gange (1−cockpitWet) for luftceller. Fb=ρg*vol*fyld, Momenter Fb*(∂up/∂heel,∂up/∂pitch). CoB som volumen­vægtet centrum, separat for skrog/komplet konventionel med rig, krop og ballastvolumen. Flyt tyngdepunktet via MASS-01. 9.81, 1025. ProjectedSpan mindst .008 m konventionelt og .025 m foils. Kvadratur og cockpit pr. båd i data. To kat-skrog separat, ingen bærende platform. Floating mast/crew kun ved dynamisk vandkontakt, kølvolumen hvis profil har den. *Aktiv · fysisk model · eksisterende test*. physics.js:699, physics.js:802, foils.js:128.

**HULL-02 · Lodret dæmpning, vandtryk og slag.** Dæmpning −C*motionDamping*vol/(mass/ρ)*v_rel_z pr. volumencelle. Dynamisk vandtryk horisontalt ρ*vol*a_orbital. Konventionelle slag ved 3 stævnpunkter: share*min(.26mg,.5ρBL*.038*max(0,closing−.42)²*entry), vandhældning giver kraft mod stigning. Foilskrog bruger lokal nedslagshastighed −vz+∂η/∂t+∇η·v, patches og overfladenormal. Konventionel f_d i [−.95Fb,3Fb], foil [−.85Fb,3Fb]; 18×8 slam patches pr. foilskrog, motionDamping .35…2. Ved neddykning. Konventionelle slag slås fra når capsize flag aktivt. Foil kontaktstyrke 0…1 og kraftrampe mod overfladen. *Aktiv · empirisk tilnærmelse · antagelse*. physics.js:343, physics.js:802, foils.js:128.

**HULL-03 · Surge- og bølgemodstand.** Konventionelt F_skin=−(C1*u+C2*u*abs(u))*wet*(1+rigWet*factor), F_wave=−Cw_eff*u*abs(u)^3*wet*rigFactor. Cw_eff=(1−planingSupport)^2*(1+Cheel sin²heel)*(Cw*(.68+.32*smooth(.12,.44,Fn))+evt. rise.extra*smooth(...)). Foiler har sammenhængende u, u*abs(u), u*abs(u)^3 fordelt over skrog, ganget med wetFraction^.8*(1+1.5 sin²heel). Vandlinje LWL_ref eller .91 L konventionelt. Effektive C pr. båd. Foil fordelinger over skrogoffsets. Begge sejlretninger. Aftager med våd kontakt. Ingen direkte topfart eller speedbonus. *Aktiv · empirisk tilnærmelse · eksisterende test*. physics.js:361, physics.js:459, foils.js:159.

**HULL-04 · Tværstrøm og rotationsdæmpning.** vanddybde linæriseret langs spant efter ∇η og pose. Draft=max(d_i)−max(0,min(d_i)); F_r=−(.5ρ C_cross*draft*length*abs(v_r)+C_linear*share*wet)*v_r*rigFactor. Konventionel passiv roll/pitch −(C+wetRig*C_rig)*rate*damping og yaw −(C1*ω+C2*ω*abs(ω)+rig)*damping. Foil dæmpning og lateral drag falder med wetFraction^.8. wet=clamp(draft/(.28 hullDepth),0,1). Længde- og dæmpningskoefficienter pr. profil. Konventionel inddeling pr. spant, foiler pr. skrog. *Aktiv · empirisk tilnærmelse · antagelse*. physics.js:421, physics.js:1381, foils.js:164.

**HULL-05 · Medbevæget masse i Laser.** Pr. skrogsnit A_s=.5ρπ*draft²*length, pr. blad ρπ*(chord/2)²*wetSpan²/(wetSpan+chord/2)*normal². Sum m, m*x, m*x² og m*a_incident. Integrator eliminerer sway fra det koblede 2×2-problem og anvender en yaw-impuls langs verdens lodrette akse. Kun laser opretter waterInertia. De andre bådes koefficienter kan omfatte empirisk dæmpning, ingen sådan ekstra stiv-systemmasse aktiv. Aktiv ved vådt område. Bruger m_sway i acceleration/rotation og incident acceleration, ingen hydrostatik, planing eller vægtændring. *Aktiv · empirisk tilnærmelse · eksisterende test*. physics.js:413, physics.js:1097, physics.js:650, physics.js:1365.

**HULL-06 · Planing, surf og farttab.** Planing L=.5ρ U²*A*share*C*clamp(.035+pitch−atan2(v_rel,z,U),0,.12)*wet*alignment*smooth(.50,.85,Fn). Drag=.045 L, surge=−Drag−L*v_rel,z/U. Fremdrift/modstand i sø følger incident vandtryk, lokale vandhastigheder, planing og stød. Ingen betingelse blot på faldende η(t). Laser max .70mg, Racer .52mg. Stationer −.26L/.54 og −.04L/.46; Racer sideandele .28/.44/.28. Area fraction .12/.13. Planing kun laser/racer og positiv U med Fn>.50. Ingen direkte surfboost på øvrige både. *Aktiv · empirisk tilnærmelse · eksisterende test*. physics.js:459, physics.js:1379.

**HULL-07 · Bundkontakt.** Ved δ=bed−p_z>0, n=normaliseret(−∂bed/∂x,−∂bed/∂y,1); Fn=clamp(kδ−c_d*(v·n),0,18m_p g), k=m_p g/.045 og c_d=2*.82√(k m_p). F_t=−min(.62Fn/abs(vt),20m_p)*vt. Skrog ni punkter pr. skrog, konventionelle bladspidser, ét dybeste punkt pr. foilgren, reach og tidligt exit i kode. Kun hvis geometrisk penetration, også med krængning/løft ved aktuelt armudslag. *Aktiv · spiltilpasning · eksisterende test*. terrain.js:73, foils.js:39.

**HULL-08 · Båd mod båd.** 2D støtteelipse med a=.48L,b=.47B. Ved overlap efter .02 m tolerance korrigeres position efter inverse masser. Impulse j med restitution .08, kun ved lukkehastighed. Samlet positionskorrektion min(.5, .6*max(0,overlap−.02)) m, båden i recovery udelades, højdeforskel større end max(2,sum hullDepth) udelades. Autoritativ flåde. Ingen sådan solo-bådkollision. *Aktiv · spiltilpasning · eksisterende test*. collisions.js:1, runtime.js:72.

### Ror, køl og sværd

**RUDDER-01 · Konventionelle undervandsblade.** 4 strimler fra root til tip, statisk taper. Vådt areal=stripArea*clamp(.5+depth/max(.036,stripHeight*abs(surfaceSpan)),0,1). U,V projiceres på bådens lokale plan, α fra relativ flow og chord. Fold symmetrisk, stall=smooth(14°,29°,abs(α_fold)); C_L blend af attached tanh og .85*sin(2α), C_D profile+induced*C_L²+separeret sin². F løft sidevinkelret på flow, drag imod. Vent e^(−dt/τ) med τ .09/.37 fra maksimal shallow*stall*speedgate. Taper .78 board/.82 ror. Ved stor angrebsvinkel bevares tryksidefaktor 1−.25*vent på ror, sug 1−.82*vent. C_D, cL og stall fra uddrag/profil. Ved faktisk kontakt og speed>1e−8. Der er ingen fast rorkraft ved stilstand uden strøm. Fold ved revers og signeret strøm, ikke kursklemme. *Aktiv · empirisk tilnærmelse · eksisterende test*. physics.js:1038, boats.js:241.

**RUDDER-02 · Rorkommando, følsomhed og returløb.** Digital gain=1−(1−fraction)*exp(−held/growth). Analog sign*abs(steer)^(1.25−.37 flight). Available=travel*(min+(1−min)/(1+(flow/ref)^2)). Target=helmFlowSign*available*clamp(demand*sensitivity,±1). Faktisk vinkel slew til target, centrerer mod 0 ved slip. Flow sign skifter først ved passeret tærskel i .25 s. sensitivity .35…1.8, rate .35…2. Foil travel blander vand-/flyvemax, ekstra lavfartsudslag fades 3.8…8.5 m/s. Specifikke værdier i profiler. Let bruger lokal flow til begrænsning, Svær middelstrømsjusteret bådfart frem. Flight fraction bruger seneste vand­kontakt. Capsize/recovery særregler. *Aktiv · spiltilpasning · eksisterende test*. physics.js:1159, physics.js:1352, foils.js:459.

**RUDDER-03 · Racerens to ror og kraftsummering.** Hvert ror får totalArea/2 og side ±.90. Blade prøves hver for sig. Momenter, forward/side/vertical, drag og power summeres. Øvrige måltal er aritmetiske gennemsnit af delene. Racer samlet .62 m², .31 m² pr. blad, fælles rorvinkel og geometri fra profilen. Øvrige konventionelle har et ror. Racer alle tilstande med våde ror. Ved én del er gennemsnittet lig den enkelte værdi. *Aktiv · empirisk tilnærmelse · eksisterende test*. physics.js:1163, physics.js:1367, boats.js:104.

### Foilbåde

**FOIL-01 · Foil- og rorgeometri.** AC75 roterer sidearmens drop/outreach om hængsel, AC72 løfter armen langs lokal y med lineær retraction gennem dimensionløs arm. Hængsel, vingecenter, normal, chord og span vektor fra foilPose. Aft ror har egne vandrette elevatorer og lodrette yaw-blade. Tabel pr. båd i configuration, statisk FoilPose og kontaktpunkter. To armsæt og 1×/2× ror. Ground beregner prøver langs arm/vinge med jointVelocity. Flyvekraft bruger aktuelt hængsel, y, rake/incidence. *Aktiv · empirisk tilnærmelse · antagelse*. foils.js:22, boats.js:148.

**FOIL-02 · 3D foilkraft og ventilation.** v=V+ω×r+v_joint−v_water. α=incidence+flap−atan2(v·normal,v·chord). Symmetrisk tanh polar med .82sin(2α) separated; CL og CD i uddrag. Liftbasis ud fra normal projekteret vinkelret på v, vendt med signeret chordflow. Glat styrke når abs(vhat·chord)<.03. q=.5ρAv²*wet. L=q CL*(1−ventLoss*vent)*efficiency; D=q(Cd+.035vent). 5 vådprøver over hver flade og 5 segmenter pr. strut, 2 halvvinger pr. hovedfoil og hel vinge pr. ror. Rudder yaw fra lodrette blades + vingens momenter. Kraft når elementet er vådt og flow er endeligt. Vent stiger med laveste dybde, last og cant. Strut vent kobling standard .70. *Aktiv · empirisk tilnærmelse · eksisterende test*. foils.js:24, foils.js:63, foils.js:194.

**FOIL-03 · Automatisk højdestyring og momenter.** Pre-FF lavpas τ≈.30 kat/.45 mono for eksterne øjeblikke (undtager wing lift). Target Vz=clamp(Kh*(H−clear),−descent,climb). Az=clamp(Kv*(Vz−dclear/dt),±2.6). Vertikalt ønske mg + m az − buoy − aeroVert. Roll/pitch request I*PD−filtreret moment. Bankmål proportional med −atan2(U*ω,g), crew fore/aft flytter pitchmål via tilpasset tyngdemoment/I/Kp. H=profil flightHeight, cap crewPitchTrim ±.85°, climbPitch ±.8°, bankrate og flight settings i profiler og uddrag. Kat særlig filtreret vandreference og reserve mod ventilation. Automatisk på begge sværhedsgrader. Ingen autopilotkurs. Mindre bank og pitchkorrektion ved vandkontakt via release. *Aktiv · spiltilpasning · eksisterende test*. foils.js:240.

**FOIL-04 · Allokering, armbytte og aktuatorer.** Kat bruger vægtet minimumsnorm fra kolonner [1,roll, pitch] for hver flades enhedsløft, Gram-matrix og wet/area/vent-vægt. AC75 vælger leeward via hysterese. Overlappet to flader blandes med enkel-foil/styring, nøgletal i uddrag. Inverter vedhæftet polar med atanh og lokal q, normal og flow vinkel til flap. Slew af de fysiske aktuatorer. Kats begge hovedfoils mål deployment=1; AC75 styret hysterese, overlap og rater pr. profil. Servo mål alpha, min/max flap og position afhænger af foilgren. Kører begge sværhedsgrader. Redning og capsized aflaster flaps. *Aktiv · spiltilpasning · eksisterende test*. foils.js:238, foils.js:300.

**FOIL-05 · Status, start, løft og landing.** foiling hvis wet<.015, clearance>.08 og lift/weight>.55. LowLift ved clearance>.08, wet<.12 og lift/weight<.65 eller heaveV<−.5. Touchdown prioriteres ved slamSeverity>.20. Takeoff ved support>.30 og wet<.70. Flyvekraft beregnes kontinuerligt i andre statusser. Profilhøjde, wet-drag og ror-rejse i egne regler. Label f.status er resultat. Clearance/wet areal indgår desuden i næste rorregel, slag og foilregulator arbejder direkte på målte variabler. *Aktiv · spiltilpasning · eksisterende test*. foils.js:409, foils.js:473, physics.js:1182.

### Samling af kræfter og bevægelse

**DYN-01 · Kraft- og momentregnskab.** Konventionel F_world= f*(F_sail+F_board+F_rudder+F_hull+F_planing) + r*(sidekomponenter) + wave/ground/rescue og z fra tyngde, hydro, sejl, appendages og planing. Moment om O=Σ(r_p×F_p)+dæmpning+boom+rescue, med Eulerakser til roll/pitch/yaw. På foil summeres hullLoads (tyngde med), aero, foilLoads, airHull og ground/rescue. Re-evaluerer G efter armmotion. Solver får vektor i ENU, moment efter konfigurationsregel. Foil luftmodstand .5ρ_air*norm(v)*v*area*CD. Konventionelle har sejl-/rigkræfter, ingen tilsvarende airHullLoads. Hvert trin, både Let og Svær. Kun recovery tilføjer ekstern hjælp til bådens pose. *Aktiv · fysisk model · eksisterende test*. physics.js:573, physics.js:1379, foils.js:83, foils.js:237, foils.js:473.

**DYN-02 · 6 frihedsgrader om bevægeligt CG.** V_G=V_O+ω×r_old+R*CGdot_old. V_G'=V_G+dt*F/m (+ Laserens korrektion for medbevæget vand). M_G=M_O−r_new×F. Roll moment har pitch-projektion af yaw, som fjernes før 3D torque. H_body=I_old*ω_old + dt*M_body, transformér til verden. Rodrigues orienterer fra ny ω, H fastholdes ved ny orientering og ω' udledes af I_new. G'=G+dt*V_G'; O'=G'−r_new; V_O'=V_G'−ω'×r_new−R'CGdot_new. Et semi-implicit fast trin med analytisk I-invers og begrænsning ved Euler-singularitet. Fuld formel og numeriske værn i uddrag. Alle 6 akser er løste dynamisk i normal sejlads. Start/recovery/Kollision/net udgør særveje. *Aktiv · fysisk model · eksisterende test*. physics.js:577.

**DYN-03 · Fast simulationstrin og kø ved forsinkelse.** Browser akkumulerer rå sekunder og kalder fixedStep(1/60). Op til 16 ad gangen eller cirka 13 ms budget, rest bevares ved aktiv sejlads. Foil n=ceil(dt/(1/240)−1e−9), sub=dt/n. World tid/sea avanceres inden nye kræfter. Render får kopi ved alpha=clamp(debt/dt,0,1). 1/60 standard, 1/240 for foil ved 60 Hz, P/F clamp dt 0… .05. 48 ms tegnegab under debt≥.07, 280 ms menu cadence. Solo standser simulationstid ved pause, skjult fane og utilgængelig grafik. Aktiv multiplayer sim fortsætter autoritativt. Recovery får realtidsupdate uafhængigt. *Aktiv · numerisk stabilisering · eksisterende test*. index.html:5432, physics.js:1352, foils.js:459, foils.js:498.

### Multiplayer

**NET-01 · Autoritet, ur og transport.** Solo ejer state i hovedtråd. Browser-authority: WebSocket-server validerer og videresender control/seq/world, værtens Worker afvikler flåden og sender snapshots. Server-authority afvikler samme RoomModel direkte i Node. Room fælles tid, vind og sea først, per player step, resolve contacts og racecheck til sidst. Browser mode maks 2, server mode 6. Input ældre end 700 ms → neutral(control). Worker kø max200 ms, burstloft i uddrag, snapshots efter mindst 65 ms. render.yaml vælger browser. Værtens worker kræver aktiv dri forhold til Room resync og suspend styrer vejret, input og tidsgrænser. Offentlig version ikke opmålt. *Aktiv · spiltilpasning · eksisterende test*. render.yaml:1, index.js:12, index.js:225, index.js:292, index.js:404, live-worker.js:39, live-room.js:150.

**NET-02 · Klientforudsigelse og korrektion.** Klienten forudberegner egen båd i hovedtråd. Indgående state kan erstatte lokal state. Kvitteret control droppes og resterende trin afspilles. Kort visuelt offset fader e^(−dt/.20) for små korrektioner. Andre både præsenteres fra deres netværksøjebliksbilleder med glatning. Snapshot packBoat, inputopsamling og præcis grænse for visual offset i uddrag. Manglende frame/roster håndteres i lobby. Under multiplayer og aktiv fase. Efter reconnect kan spring gå direkte igennem. *Aktiv · spiltilpasning · eksisterende test*. fleet.js:1, fleet.js:149, index.html:5472, index.html:6075, live-room.js:203.

### Visning og billedkadence

**VIS-01 · Tegnet båd, synlig besætning og rig.** Interpolate kopierer state, vinkler over korteste rute hvor angivet, pose world (x,heave,−north), heading rotation.y=theta, hull Euler ZXY(heel,0,pitch). Sejl læser boom/rig/reef og tilføjer duk-, pose- og stofvariation. Kamera læser samme interpolation og begrænses mindst .45/.55 m over vand i relevante views. Lokale grafikgrænser og kamerainstillinger i koden. Absolutte skroglængder fra profil. Altid i render, fjerne modeller kan simplificeres. Solver kontakt mod prøveformer og punkter. *Kun visuel · spiltilpasning · eksisterende test*. index.html:2927, index.html:3164, index.html:3464, index.html:4138, index.html:5432.

**VIS-02 · Visuelt vand, skum, spray og renderkvalitet.** GLSL bygges fra fælles WAVE_COMPONENTS og får samme seed, simulationstid, seaState og rasterteksturer. En afstands- og waveSpacing-afhængig dæmpning begrænser geometri ved LOD-overgange. Shader beregner også normalslope. Hull mask, wakes, spray, reflections og optiske bølger lægges til visuelt. Kontakt- og sprayseeds bruger fysikkens vandprøver. Profiler for Lav/Minimum/Høj styrer pixelbudget, skum, horisont, draw og vandoptik. Samme solver og felt ved alle kvaliteter. Kun browsertegning. Kystshader differentierer samples numerisk; CPU-samplegradienter bilineære. *Kun visuel · spiltilpasning · eksisterende test*. index.html:1559, index.html:2420, index.html:4176, hull-water.js:1.

**VIS-03 · Vejrpræsentation og optisk overflade.** Vejr normaliseres og mappes til farver/lys. Atmosfærens egne eksponentielle tidskonstanter bruger state.atmosphere. Visuel krusning følger chop med τ=1.5 s på managed sø. Drift flytter shaderens chopteksturer i vindretning med .12+.016*speed pr. sekund i UV. Farve 8 s, lys 5 s, regn 2.8 s, tåge 6.5 s og skydække 7 s. Havets fysiske vægt og vind forbliver i deres separate felter. Grafik. Atmosfæren opdateres efter det fysiske trin. Normal kortdæmpning og optisk regn behandles separat i shader. *Kun visuel · spiltilpasning · antagelse*. weather.js:34, index.html:4252, runtime.js:25.

## Kendte problemer

### P-01 · Foilkatamaranen virker låst på læns

Rapporteret ca. 091°, 5,8 kn, 9,7 m/s fra vest og 67,4 % vingetrim. Et spejlet drejeudslag gav væsentligt mindre respons i den historiske browser.

Kontrolleret start omkring x=575, y=−1190 i kompakte meter, ca. 25 m dybde, ingen pust eller bølger, pose 3. Holdt venstre/højre i 6 s. Førbuild d22a46cf20bb endte 90,46°/112,11°. Build 4586930972bf endte 77,77°/120,35°. Ved højreinput ændredes slutbom +24,14°→−31,77°, sejlfremdrift −1052→+2517 N, ror +10,54°→+21,19°, rormoment +4,41→+11,34 kN·m og samlet yaw om skrogoprindelse +8,44→+3,94 kN·m. Ved venstreinput −10,34°→−20,84° ror, samlet yaw +0,50→+1,03 kN·m på sluttrinnet. Slutmomenter kan ligge modsat den akkumulerede drejning. Den aktuelle Node-prøve for samme modeltilfælde bestod.

Præcis oprindelig bølgefase, trimkommandoer, faktisk foil/crewtilstand og tidsmærket kraftledger mangler. Reproduceret tilstand er en tilnærmelse på baggrund af skærmbilledet. Aktuel offentlig version ukendt. Relevante regler er INPUT-01, RUDDER-02, FOIL-02, SAIL-03, SAIL-08, DYN-01, DYN-02.

### P-02 · Laser på Svær når ikke ud af vindøjet som forventet

Den aktuelle browserprøve ved 7,5 m/s fra nord når 29,29°/22,61° på ny halse mod målet ≥36°. Skiftet i valgt side og pose 2 var allerede bestået i begge prøver. Opt-in-hjælp er fra på Svær.

Fri sejlads med fastsat start ved (0,−1475), spejlede 49°, 3 m/s, .35 m bølger, ingen pust/læ; sim-setup sheet .73 fysisk og UI-mål 73 %. Pose 3 i 2,2 s, ind i 1 og hold ror mod vinden. Tryk 2 omkring 0–4° fra vindøjet og behold ror i højst 28×90 ms. Begge eksisterende prøver fejlede også i den tidligere baseline, 28,80°/24,93°. Et særskilt inputforløb ved 8,5 m/s gennemførte 229°→130°→230° i historisk browser.

Denne prøve logger side, krængningsflag og kurs. Der mangler synkroniseret fart, lokal rorvinkel og strøm, afdrift, reel boomvinkel, nettomoment og vind-/bølgefase gennem det fejlende vindøje for at adskille inputvalg fra tab af fremdrift/greb. Relevante regler er INPUT-02, MASS-03, RUDDER-01, RUDDER-02, SAIL-02, SAIL-04, AID-02, DYN-02.

### P-03 · Skødet vises i 0 %, men sejlet leverer stadig kraft

Nul procent er mindst lineindhaling eller frigivet vinge. Bommen bruger sin vinkel og mekaniske stop, og dragriggen kan stadig få positiv fremdrift i dyb medvind. Fysisk vinge kan rotere langsommere end den viste procent. Vingens profilmodstand er fortsat beregnet ved løs vinge og kan bidrage til fremdrift i medvind.

Historisk browserscript på kryds, halvvind og læns målte omkring 41°, 70° og 86° bomvandring efter slæk. Ved 4 m/s kunne Laserens drive i dyb medvind gå fra ca. 0,3 N til 36 N ved slæk. Aktuel Node-pakke afprøver absolut mål, frigivelse og genopbygning af wing drive.

Den rapporterede skærmperiode mangler faktisk vinkel, lokal AWA ved hvert sejl, resttryk over tid og eventuel netværkskorrektion. Det er uafklaret, om et andet forløb giver unormalt lang ventetid eller for stort resttryk. Relevante regler er INPUT-01, SAIL-01, SAIL-02, SAIL-03, SAIL-05, SAIL-06, SAIL-08, VIS-01, NET-02.

### P-04 · Overdreven fart og sideværts glid

Racer 32 blev rapporteret omkring 40 kn ved ca. 17 m/s og stor krængning. Der er også tidligere Laser-sideglid omkring tab af neddykning. HUD bruger logfart, så høj logfart kan omfatte sideværts bevægelse.

Rapporten for d3ad41af49c9 manglede det oprindelige 40-knobsforløb. I den historiske serie ved 17 m/s var højeste fart 12,75 kn før og 10,95 kn efter. Målrettede tests giver passiv side-/yaw-modstand ved våd køl/dagger og tørt eller halvtørt ror. Ved 10 m/s og 58 % historisk trimgitter på halvvind gav vægt ved kanten/trapez 11,84/12,53 kn og 26,5°/20,7° ved samme last.

Præcis startposition, retning, bølgefase, fartmål og input fra den rapporterede situation mangler. Højvindsafdrift og modstand ved kraftig krængning er ikke eksternt kalibreret. Relevante regler er UNIT-02, DYN-02, HULL-03, HULL-04, HULL-05, HULL-06, RUDDER-01, RUDDER-03.

### P-05 · Lille reaktion på vægt frem og agter

Vægtflytning ændrer CG og inerti. Hele turbådens CG flytter sig langt mindre end roerens fysiske vandring. Let centrerer fore/aft fysisk i sin balancefunktion.

Historisk statisk/indsejlet sammenligning gav Laser ca. 45,1 cm CG-interval og 1,34° pitchændring, Turbåd 43 ca. 5,3 cm og 0,11°. Den aktuelle kodes statiske CG-udtræk i profiltabellen viser samme CG-intervaller. Foilregulatorens pitchmål ændres også af fore/aft.

Dynamiske dybder ved roret efter almindeligt input i forskellige bølger og målte pitch/trim-referencer for alle fem både. Relevante regler er INPUT-01, AID-01, MASS-01, MASS-02, MASS-03, FOIL-03, HULL-01, RUDDER-01, FOIL-02.

### P-06 · Chop og Bølger opleves uklare

Med de aktuelle managed-værdier er Chop både mængde kort sø, moderat kortere periode/stejlere form i langbåndet og visuel krusning. Bølger angiver dønningens ønskede signifikante åbentvandshøjde. Sheltered og eksponeret start giver meget forskellige resultater.

Historisk fire kombinationer på samme sted adskiller rolig sø, lang dønning, kort sø og begge. På 3bc3080b4406 gav langmåling ca. 2,49 m Hs ved 2,5 m indstillet og ca. 0,44 m kort sø ved 100 %. Tallene er fra tidligere version før nuværende Chop→langperiode-kobling. Aktuel Node-test ser oftere pitch ved ren chop end ved dønning.

Ingen ny modelmåling over lang tid i alle kombinationer på den nuværende Chop-kobling. Kystbølgelighed på alle LOD-trin samt virkelig sørespons er åben. Relevante regler er WIND-01, SEA-01, SEA-02, SEA-03, SEA-04, VIS-02, HULL-02, HULL-06.

### P-07 · Laser drejer ca. 62° med neutralt ror fra stilstand

Historisk reproduktion gav 61,6° på 2 s på begge halser. Første sejlbetingede yaw ca. 135 N·m ved skrogoprindelsen, 140 N·m om CG og 117 N·m efter koblet vandbidrag. Første trins skrog-, sværd- og rormomenter var nul fra hvile.

8d90e5c65143, dybt slør, 35 % skøde, neutral ror fra stilstand. Aktuel kode tester passive momenter, kendt moment og medbevæget vand i Node.

Måling af Lasers drejning fra stilstand under ens fysiske forhold og aktuelt fuldt diagnostisk replay. Relevante regler er SAIL-01, SAIL-04, RUDDER-01, HULL-04, HULL-05, DYN-02.

## Valideringsgrundlag

Auditten kontrollerede lokal browseridentitet og almindeligt rorinput og kørte eksisterende tests. Historiske prøver er angivet med deres respektive builds og begrænsninger. En simulering kan dokumentere forskelle i koden. De få eksterne datakilder har deres eget område.

| Prøve | Version og grundlag | Start og input | Senest kendte resultat | Begrænsning |
| --- | --- | --- | --- | --- |
| Funktion og numerik | 55afe8661449 Aktuel kilde, npm test. Tests server, kollision, terræn, settings og simulation. | Seks inputfixtures for fem både, isoleret tensor/tyngde, samme heave med og uden cache, datamatch pr. sample og kendte skøde-/rorprøver. | 58/58 Node-prøver bestod under audit. | Afprøver de definerede inputs og numeriske krav. Ingen dokumentation af fuldskala polaregenskaber. |
| Browser, funktion og eksisterende manøvre | 55afe8661449 Lokal Chrome og tests/difficulty.test.js. Eksisterende test genkørt under audit. | Laser Fri sejlads/Svær fra to halser ved ca. 7,5 m/s. 3→1→2 og holdt ror gennem vindøjet. | Sidekommandoen virkede på begge halser. 0/2 bestod kravet om ≥36° ved max prøvetid, slut 29,29° og 22,61°. | Slutkurs i en fast prøve. Den maksimalt kontrollerbare vending i virkeligheden eller i fri sejlads følger ikke af dette. |
| Før/efter numerisk og funktion | 4586930972bf → 55afe8661449 Eksisterende optimeringsrapport, gennemgang/ydelse-telefon/README.md. | 6 fixtures og 4.800 faste trin for fem både, Let/Svær med kystlæ og vejrskift. Produktionstest med Chrome/WebKit og to lokale klienter. 600,42 s med almindeligt input i passager initialiseret ved kyst og offshore. | Identiske sammenlignede state/kræfter. 28 produktionsbrowserprøver + 3 mobile + 3 Let/Svær bestod. I langtesten 8 tegningsintervaller >100 ms og max 2,66 s fysiktid i kø. Kontrolleret lokale to-klientrorer. | De samme fejl kan findes i begge builds. Ingen fysisk telefon, offentlig RTT eller fuld sejladsvalidering. |
| Simuleret sejlads, styring og vægt | c9f17e1e8ae0 → 8d90e5c65143 Eksisterende efterproevning.md. Laser Fri sejlads/Svær på åbent fladt vand med korte tastaturkorrektioner. | 8,5 m/s fra 000°, kursmål 52°, 78 % skøde, stabil fart fra sidste 8 s, position 1/2/3. Desuden 2,5 m/s/56 %, og skift 3→1 på halvvind ved 45 %. | Knob 5,99→6,13, 6,87→6,97 og 7,59→7,49. Ny afdrift 1,1°, 1,0°, 1,2° og krængning 23,2°, 12,4°, 3,2°. Pos. 3 ved 86 % gav 7,80 kn og 5,09 kn VMG. I let vind var 1 bedst på fælles trim. Maksimal trinvist ændring ved 3→1 ved O 1,081→0,077 m/s, ved CG 0,154→0,059 m/s. Flyttetid 0,38→0,70 s ved 60 Hz. | Stabil fart med position 1 blev ikke genskabt som højest i frisk vind, heller ikke før. Fuldskala sammenligning kun på andre vindpunkter. |
| Simuleret foilmanøvre | d22a46cf20bb → 4586930972bf Eksisterende AC72 browserlog og aktuel Node-scenarietest. | Start ca. 091°/5,8 kn, vind 270°/9,7 m/s, 67,4 % trim, roligt vand. Kontrolleret 6 s ror hver vej. | Left 90,46°→77,77°, right 112,11°→120,35°. Højreinput sejldrive −1052→+2517 N ved prøvens slutning. Aktuel Node-scenarietest bestod. | Ét afgrænset scenarie. Den rapporterede position er anslået; public build aktuelt ukendt. |
| Simuleret bølge- og bundfelt | 7ff40a671e84 → 3bc3080b4406; smalt bælte ved 8d90e5c65143 Eksisterende rapporter om bølgeindstillinger og efterprøvning. | Sammenlign fire kombinationer af 0/2,5 m og 0/100 % Chop på åbent vand. Laser/Turbåd samt kystpassager ved Faaborg og Bjørnø med andre både. | På 3bc3080b4406 målte 900 s åbent ca. 2,49 m Hs ved 2,5 m og kort sø ca. 0,44 m ved 100 %. Kystprøverne dokumenterede forskelle mellem solverens bund og dybderaster; GPU-match i fire punkter inden for 1,5 cm på den testede bølgeoverflade. | Tidligere build og til dels tidligere Chop-form. Bølge- og dybdeværdier er modelevalueringer. |
| Ekstern Laserreference, stabil fart | Fuldskalamålingerne har intet TACK-build; den historiske implementering med de afrundede referencepunkter har ikke et verificeret build-ID i fysikoversigten. Day figur 4–5 gengiver Binns. Projektets fysikoversigt og 8d90e5c65143 har beslægtede fartprøver. | Ca. 50° i 9 og 12 knob vind. Match på stævnens vinkel og vind; last/sø delvist beskrevet. | Reference ca. 5,2/5,6 kn; historisk simulation 5,25/5,64 kn. Omtrentlig aflæsning ±0,1–0,2 kn. Nærtliggende efterprøve ved ca. 52° gav 5,47/5,85 kn. | To omtrentlige krydspunkter. Afdrift, krængning og lave overgangshastigheder er ikke med denne sammenligning kalibreret. |
| Ekstern Laserreference, manøvre | De publicerede målinger er foretaget på en virkelig Laser. NTNU's publicerede sejladsforsøg, tabeller 1–2. | 12 stagvendinger ved 9,2±0,75 m/s; initial fart over grunden 2,1–2,7 m/s. | 80 % fart efter ca. 6,5–8,7 s. Arkivets spilprøve havde en anden startfart, fladt vand og konstant vind. | Tiden kan bruges som størrelsesreference. Ens styreinput, last og bådtilstand er ikke prøvet. |
| Ekstern beregningsreference, Racer-inspiration | ORC-resultatet er en fartberegning for Melges 32, separat fra spillets båd og builds. ORC VPP for Melges 32 og projektets fysikoversigt. | Reference omkring 110° sand vindvinkel og 20 knob vind, ca. 11,8 kn ifølge den tidligere udtrukne polar. | Separat historisk Racer-forløb var ca. 10,1 kn ved ca. 106°. Bådene har forskelle i masse, rig og besætning. | Kan sammenligne størrelsesorden. Ingen fysisk kalibreret fartpolare for Racer, Turbåd eller foilbådene. |

### Faglige kilder

- Fossens fartøjsmodel bruges som vurderingsramme for referencepunkter, træghed og kræfter. Projektets tidligere fysikoversigt henviser også til den. Koden har sin egen tensorintegrator og en delvis added-water-model. En fuld marine 6-DOF-matrice med alle hydrodynamiske inertiled er ikke dokumenteret i implementationen. [Fossen’s Marine Craft Model](https://www.fossen.biz/html/marineCraftModel.html)
- Tonelli og Vogels beskriver MARINs model for lokal indstrømning og rorvinkel, med et skibsror i forsøg. TACK prøver fire eller fem lokale segmenter og har egne stall- og ventilationskurver. Projektkoden dokumenterer ingen genbrug af MARINs koefficienter eller skroginteraktion. [MARIN rudder mathematical model](https://journals.sagepub.com/doi/full/10.3233/ISP-240004)
- ORC beskriver stationær balance mellem fremdrift/modstand og krængende/oprettende moment. Projektet henviser også til ORC-data som inspiration for Racer 32. En ORC-VPP-fart er et beregnet referencepunkt. [ORC’s VPP-beskrivelse](https://orc.org/organization/velocity-prediction-program-vpp)
- Day/Binns er projektets historiske reference for få stabile krydspunkter. De målte NTNU-vendinger giver en anden målestok for manøvretid og farttab. Vind, sø, last og fart under indgang skal med i en sammenligning. [Day, Performance Prediction for Sailing Dinghies](https://pure.strath.ac.uk/ws/portalfiles/portal/64217569/Day_OE_2017_Performance_prediction_for_sailing_dinghies.pdf), [NTNU, måling af stagvendinger](https://www.mdpi.com/2076-3417/15/15/8629)

### Mulige konflikter i den aktuelle kode

1. **Tidsplacering.** s.forces kommer fra trinnets kraftberegning, mens s.sail og s.wind genberegnes ved slutposen. Rorreglen kan bruge forrige vådhed og flapper; redning kan projicere tilstanden igen. Størrelsen af disse forskelle ved bomskift, landing og kæntring er åben.
2. **Hurtig intern massebevægelse.** Koden transformerer rigid-body-impulsmoment med ændret inertitensor og CG-hastighed. Den tilføjer ingen særskilt intern impulsmomentvektor for leds eller armes relative bevægelse. Relative armhastigheder indgår i vandhastigheden ved foil og i nogle bundprøver. Uafklaret betydning ved hurtige vendinger og armbytte.
3. **Bølgetryk og dæmpning.** Orbital vandbevægelse påvirker modstand og vandkontakt. Derudover beregnes incidenttryk og i Laseren et særskilt incidentbidrag fra medbevæget vand. Bidragene har forskellige roller, men samtidig størrelsesorden og eventuelt overlap i kraftig sø er åbent.
4. **Rorfølelse.** Rormål og vandkraft har separate begrænsninger. Racerens diagnostiske samlede bladstrøm er et uvægtet gennemsnit, også når kun ét blad er vådt. Det kan påvirke Lets aktuatorgrænse. Kraftsummen indeholder begge blades bidrag. Fordelingen af moment, transversmodstand og vådområde ved 17 m/s mangler i det rapporterede scenarie.
5. **Lavvand og grafik.** Fysikkens bund og bølgefeltets filtrerede dybdegrid har forskellig opløsning. CPU og GPU deler bølgebånd og felter. Vandets geometri kan stadig afvige på grund af interpoleret tid, LOD, masker, optik og forskellige metoder til at beregne gradienter. Materialet afprøver udvalgte prøvesteder frem for alle kameraer og kystpassager.
6. **Kalibrering.** Der mangler fulde fart-/afdriftspolarer, GZ ved større krængning, pitch/roll-serier i sø, styresvar ved høj riglast og fuldskaladata for foilernes ventilation og højdestyring. Euler-rateberegningen har desuden en særskilt konditionering ved næsten lodret stævn, som ikke er bredt undersøgt.

## Kodeuddrag til faglig kontrol

Uddragene er ordrette fra det gennemgåede kildegrundlag og valgt for at vise selve beregningerne. Længere forløb for ekstra sejl, kystfelter, redning, flåde og aktuatorer findes under samme regel-ID i den strukturerede leverance.

### MASS-01, MASS-02 · Massepunkter og skiftende tensor

assets/simulation/boats.js, linje 41–68.

```js
 function addPointInertia(inertia,p,mass){
  inertia.roll+=mass*(p.y*p.y+p.z*p.z);
  inertia.pitch+=mass*(p.x*p.x+p.y*p.y);
  inertia.yaw+=mass*(p.x*p.x+p.z*p.z);
  inertia.xy-=mass*p.x*p.y;
  inertia.xz-=mass*p.x*p.z;
  inertia.yz-=mass*p.y*p.z;
 }
 function make(id,name,description,v){
  const p={...COMMON,id,name,label:name,description,...v};p.hullRigMass=p.hullMass+p.rigMass+p.equipmentMass+(p.ballastMass||0)+2*(p.armMass||0);p.mass=p.hullRigMass+p.crewMass;
  p.hullSections=v.shape.map(([x,w])=>[x*p.length,w*(p.hullBeam||p.beam)*.5]);delete p.shape;
  p.cockpit={minX:p.cockpitMinX,maxX:p.cockpitMaxX,x0:p.cockpitMinX,x1:p.cockpitMaxX,halfWidth:p.cockpitHalfWidth,floorY:p.cockpitFloorY,radius:p.cockpitRadius};
  p.mastHeight=p.mastTop;p.sailFoot=p.boomLength-.06;
  // Flat reference areas in the sail plane, shared by the rig and its mesh.
  if(p.id==='laser')p.sailRoach=(p.sailArea/p.sailLuff-p.sailFoot*.5)*Math.PI*.5;
  if(p.jibArea)p.jibFoot=2*p.jibArea/(p.jibHeadY-p.jibTackY);
  p.crewX=p.crewX??(-.11*p.length);p.crewMax=p.beam*.5+.43;
  p.crewForeAftRange??=p.length*.065;
  p.massPoints=[...(p.hullOffsets||[0]).map(z=>({mass:p.hullMass/(p.hullOffsets?.length||1),x:p.hullCGX,y:p.hullCGY,z})),{mass:p.rigMass,x:p.mastX-.12,y:p.rigCGY,z:0},{mass:p.equipmentMass,x:-.25,y:p.deckY-.05,z:0}];
  if(p.ballastMass)p.massPoints.push({mass:p.ballastMass,x:p.ballastX,y:p.ballastY,z:0,ballast:true});
  if(p.kind!=='foiler'){
   p.intrinsicInertia={roll:p.rollInertia,pitch:p.pitchInertia,yaw:p.yawInertia};
   const inertia={...p.intrinsicInertia,xy:0,xz:0,yz:0};
   for(const m of p.massPoints)addPointInertia(inertia,m,m.mass);
   p.originInertia=inertia;
   p.rollInertia=inertia.roll;p.pitchInertia=inertia.pitch;p.yawInertia=inertia.yaw;
  }
  return p;
```

### MASS-03, INPUT-02 · Sidekommando og bevægelse

assets/simulation/physics.js, linje 718–755.

```js
function crewMotion(s,positionKey,velocityKey,target,maxSpeed,maxAcceleration,response,dt){
 let x=Number.isFinite(s[positionKey])?s[positionKey]:target,v=Number.isFinite(s[velocityKey])?s[velocityKey]:0;
 if(dt>0){const omega=1/Math.max(.04,response),acceleration=clamp(omega*omega*(target-x)-2*omega*v,-maxAcceleration,maxAcceleration),limitedVelocity=clamp(v+acceleration*dt,-maxSpeed,maxSpeed);v=move(v,limitedVelocity,maxAcceleration*dt);x+=v*dt;
  if(Math.abs(target-x)<1e-5&&Math.abs(v)<1e-4){x=target;v=0;}}
 s[positionKey]=x;s[velocityKey]=v;
}
const crewWindDeadband=5*DEG;
function windwardCrewSide(wind){
 const angle=wind?.twa,offBow=Math.abs(angle);
 return wind?.tws>.6&&offBow>crewWindDeadband&&offBow<PI-crewWindDeadband?Math.sign(angle):0;
}
function tackCrewSide(s,steer){
 const wind=s.wind,angle=wind?.twa;
 if(s.capsized||s.recovering||!(wind?.tws>.6)||angle==null||Math.abs(angle)>crewWindDeadband)return 0;
 const from=s.crewTackFrom;
 // The last established windward side stays fixed through the wind eye.
 // Small changes of wind angle or a second press should keep the same target.
 if(from)return -from;
 if(Math.abs(s.omega)>.10)return Math.sign(s.omega);
 if(Math.abs(steer)>.19)return -Math.sign(steer);
 return Math.sign(s.boom);
}
function manualCrewTarget(s,controls,env,dt,windSide){
 const requested=controls.crewPose??env.crewPose??s.crewPose??2;s.crewPose=clamp(Math.round(requested),1,3);
 if(s.recovering)s.crewPose=1;
 if(!Number.isFinite(s.crewSide))s.crewSide=-1;
 const requestedSide=Math.sign(controls.crew||0);
 if(!s.capsized&&!s.recovering&&Math.abs(controls.crew||0)>.2&&(!windSide||requestedSide===windSide))s.crewSide=requestedSide;
 if(s.boatId==='laser'){
  // The sailor ducks during a commanded crossing. Zero input holds the side.
  const crossing=Math.abs((s.crewSideBlend??s.crewSide)-s.crewSide)>.15,duck=crossing?1:0;
  s.crewDuck=move(s.crewDuck||0,duck,dt*(duck>(s.crewDuck||0)?5.6:3.2));
  if(crossing)(s.crewTransfer??={}).phase='crossing';
  else s.crewTransfer=null;
 }
 return s.crewPose;
}
const crewRightingMoment=new Map();
```

### SEA-02 · Fælles vandfase og orbitalbevægelse

assets/simulation/physics.js, linje 230–275.

```js
        swell=attenuate(swell,gain,dx,dy);
        chop=attenuate(chop,gain,dx,dy);
      }
      let profileHeight=0,profileDepth=0;
      const start=component>=0?component:waveScale||waveRate?0:FIRST_CHOP;
      const count=p.managed?band.terms.length:LEGACY_WAVE_COUNT;
      const end=component>=0?Math.min(component+1,count):band.short&&(windScale||windScaleRate)?count:FIRST_CHOP;
      for(let i=start;i<end;i++){
        const w=band.terms[i],local=w.windSea?chop:swell,travel=w.windSea?chopPath:swellPath;
        const amplitude=w.amplitude*(w.windSea?windScale:waveScale),a=amplitude*local.v;
        const driven=w.amplitude*local.v*(w.windSea?windScaleRate:waveRate)+amplitude*(w.windSea?chopRate:swellRate);
        if(!a&&!driven)continue;
        const {forwardX,forwardY}=w;
        const q=w.k*(x*forwardX+y*forwardY+travel.v)-w.omega*time+w.phase,sin=Math.sin(q);
        const bend=w.bend,cos2=1-2*sin*sin,harmonic=bend*a*a,crest=harmonic*cos2,h=a*sin-crest;
        height+=weight*h;
        if(heightOnly)continue;
        const gx=forwardX+travel.dx,gy=forwardY+travel.dy,directionLength=Math.hypot(gx,gy),localK=w.k*directionLength;
        const cos=Math.cos(q),rate=a*cos+4*harmonic*sin*cos;
        const areaGradient=sin-2*bend*a*cos2,base=amplitude*areaGradient;
        if(terms)terms.push({w,a,sin,cos,cos2,harmonic,crest,driven,weight,gx,gy,directionLength,localK});
        const decay=below?Math.exp(-localK*below):1;
        let sideDecay=decay,verticalDecay=decay;
        if(p.managed&&site&&site.depth>0&&site.depth*w.k<5){
          // Finite-depth orbital motion at a solid bottom. Horizontal
          // motion remains parallel to it and vertical motion goes to zero.
          const k=coast.waveNumber(w.k,site.depth),relativeDepth=Math.min(site.depth,below);
          const down=Math.exp(-k*relativeDepth),up=Math.exp(-k*(2*site.depth-relativeDepth));
          const column=-Math.expm1(-2*k*site.depth);
          sideDecay=below<=site.depth?(down+up)/column:0;
          verticalDecay=(down-up)/column;
        }
        const slope=rate*w.k;
        dx+=weight*(slope*gx+base*local.dx);dy+=weight*(slope*gy+base*local.dy);
        curvature+=weight*(a*sin-4*crest)*localK*localK;
        velocity+=weight*(-w.omega*rate+areaGradient*driven);
        const orbital=weight*a*sin*sideDecay;
        const normalizer=w.omega/Math.max(1e-8,directionLength);
        waterVx+=orbital*gx*normalizer;waterVy+=orbital*gy*normalizer;
        // First-order incident pressure follows the horizontal acceleration
        // of the water particles. Its phase is independent of the hull.
        const acceleration=-weight*a*w.omega*cos*sideDecay*normalizer;
        waterAx+=acceleration*gx;waterAy+=acceleration*gy;
        waterVz+=weight*verticalDecay*(-w.omega*(a*cos+4*harmonic*sin*cos*verticalDecay)+(sin-2*bend*a*cos2*verticalDecay)*driven);
        if(transition){profileHeight+=h;profileDepth+=verticalDecay*(a*sin-crest*verticalDecay);}
      }
```

### SAIL-02 · Skødeprocent, hastighed og fysisk stop

assets/simulation/physics.js, linje 1105–1158.

```js
function sheetFromTrim(trim,model){
 const t=clamp(trim,0,1);
 return t+(configFor(model).sheetCurve??0)*t*(1-t);
}
function trimFromSheet(sheet,model){
 const s=clamp(sheet,0,1);
 const curve=configFor(model).sheetCurve??0;
 if(!curve||s===0||s===1)return s;
 const b=1+curve;
 return 2*s/(b+Math.sqrt(b*b-4*curve*s));
}
// Pace player adjustments in displayed trim before converting to line travel.
// Both directions use the same fine control above 50%.
function limitSheetTravel(sheet,model,travel,dt,linear=false){
 if(!travel)return 0;
 const trim=linear?sheet:trimFromSheet(sheet,model);
 const looseRate=travel<0?.82:.58;
 const rate=looseRate+(.20-looseRate)*smooth(.35,.50,trim);
 const next=clamp(trim+Math.sign(travel)*rate*dt,0,1);
 const limit=(linear?next:sheetFromTrim(next,model))-sheet;
 return travel<0?Math.max(travel,limit):Math.min(travel,limit);
}
function boomLimit(sheet,model){
 const c=configFor(model);
 return c.boomMax+(c.boomMin-c.boomMax)*clamp(sheet,0,1);
}
function sheetRateFor(c,trim,fast,difficulty){
 if(trim<0&&fast)return c.sheetReleaseKeyRate??.5;
 if(trim<0&&difficulty!=='easy'&&c.sheetReleaseRate)return c.sheetReleaseRate;
 return fast?.5:c.sheetRate;
}
function updateSheet(s,c,control,env,dt){
 if(Number.isFinite(control.sheetTarget)){
  const travel=clamp(control.sheetTarget,0,1)-s.sheet;
  const time=clamp(env.controlRate??1,.35,2)*dt;
  const rate=sheetRateFor(c,travel,control.trimFast,control.difficulty??env.difficulty);
  s.sheet+=limitSheetTravel(s.sheet,c,clamp(travel,-rate*time,rate*time),time);
  return;
 }
 const trim=clamp(control.trim||0,-1,1);
 const rate=sheetRateFor(c,trim,control.trimFast,control.difficulty??env.difficulty);
 s.sheet=clamp(s.sheet+trim*rate*clamp(env.controlRate??1,.35,2)*dt,0,1);
}
// The sheet only pulls toward the centre. It becomes taut outside its stop;
// a small bounded stretch and outward damping avoid snapping the rig on trim.
function sheetTorque(s,limit,c){
 const side=Math.sign(s.boom)||1,stretch=Math.max(0,Math.abs(s.boom)-limit);
 if(!stretch)return 0;
 const outward=Math.max(0,side*(s.boomRate||0));
 const damping=c.rigidWing?1:smooth(0,DEG,stretch);
 return -side*c.boomInertia*(120*stretch+15*outward*damping);
}
// A right input turns the bow to starboard while moving forward. The actual
// blade keeps its speed and travel limits on both difficulty settings.
```

### SAIL-04 · Polar og kraft ved fysisk sejl

assets/simulation/physics.js, linje 964–990.

```js
 let mainPressure=0,jibPressure=0,boomTorque=0;
 const sections=[],actualCamber=(s.rig?.camber??c.camber)*(.55+.45*(s.rig?.fill??1)),mainFraction=mainArea/totalArea,strips=[[5/9,7/45],[3/9,13/27],[1/9,7/9]];
 for(const [weight,height]of strips){
  const beta=s.boom+(s.rig?.sideBlend??side)*twist*height*height+sailFlutter(s.rig,height)*.56,cp={x:c.mastX-chordArm*(1-height)*1.5*Math.cos(beta),y:c.boomY+c.sailLuff*height*mainScale,z:chordArm*(1-height)*1.5*Math.sin(beta)},wp=bodyPoint(s,cp),water=waveHeightAt(wp.x,wp.y,s.time,env),exposed=smooth(-.05,.22,wp.z-water);exposure+=exposed*weight;
  const air=sailAirAt(s,env,cp,overrideWind,s.boomRate||0),airF=air.x*a.fx+air.y*a.fy,airR=air.x*a.rx+air.y*a.ry;
  // Project onto the plane normal to the actual mast. The fixed cloth area
  // goes with these sectional polars, so there is no second heel correction.
  const localF=along.f*airF+along.r*airR+along.up*air.z;
  const localR=across.f*airF+across.r*airR+across.up*air.z;
  const localSpeed=Math.hypot(localF,localR);
  if(localSpeed<=1e-6)continue;
  const unitF=localF/localSpeed,unitR=localR/localSpeed,cf=-Math.cos(beta),cr=Math.sin(beta);
  const angle=Math.atan2(localF*-cr+localR*cf,localF*cf+localR*cr),coeff=sailCoefficients(angle,c,actualCamber*Math.abs(s.rig?.sideBlend??1),aftSailLoading(localF,localSpeed));
  const q=.5*c.airDensity*localSpeed**2*mainArea*sailPressure*weight*exposed,L=q*coeff.cl,D=q*coeff.cd;
  const sectionF=-unitR*L+unitF*D,sectionR=unitF*L+unitR*D;
  const ff=along.f*sectionF+across.f*sectionR;
  const rr=along.r*sectionF+across.r*sectionR;
  const up=along.up*sectionF+across.up*sectionR,m=forceMoment(s,cp,ff,rr,up);
  mainPressure+=q;
  if(laser)boomTorque+=cp.z*sectionF+(c.mastX-cp.x)*sectionR;
  sections.push({height,point:cp,drive:ff,sideForce:rr,vertical:up,alpha:coeff.folded,luff:coeff.luff,stall:coeff.stall,
   airForward:unitF,airRight:unitR,localAirSpeed:localSpeed,apparentSpeed:air.speed,trueSpeed:air.trueSpeed,load:Math.hypot(ff,rr,up)});
  forceF+=ff;forceR+=rr;forceUp+=up;rollMoment+=m.roll;pitchMoment+=m.pitch;yawMoment+=m.yaw;cl+=mainFraction*weight*coeff.cl;cd+=mainFraction*weight*coeff.cd;alpha+=mainFraction*weight*coeff.folded;luff+=mainFraction*weight*coeff.luff;stall+=mainFraction*weight*coeff.stall;lift+=L;drag+=D;
 }
 const mainLuff=luff/mainFraction;
 const main={area:mainArea,luffScale:mainScale,chordScale,trim:s.sheet,centre:{x:c.mastX-chordArm*Math.cos(s.boom),y:c.boomY+(c.sailCPHeight-c.boomY)*mainScale,z:chordArm*Math.sin(s.boom)},angle:s.boom,drive:forceF,sideForce:forceR,vertical:forceUp,rollMoment,alpha:alpha/(mainFraction||1),luff:mainLuff,stall:stall/(mainFraction||1),load:clamp(Math.hypot(forceF,forceR,forceUp)/(190*(c.sailArea/7.06)),0,1),side,twist,camber:actualCamber,fill:s.rig?.fill??0,sections,...(laser?{boomTorque}:{})};let jib=null;
 // The keel yacht has a second, continuously sheeted sail. Its own resultant
```

### HULL-01, HULL-02 · Vandkontakt, opdrift og tryk pr. celle

assets/simulation/physics.js, linje 806–824.

```js
 let buoyancy=0,verticalDamping=0,rollBuoyancy=0,pitchBuoyancy=0,rollHydroDamping=0,pitchHydroDamping=0,submergedVolume=0,centerX=0,centerY=0,centerZ=0,waveFx=0,waveFy=0,waveRoll=0,wavePitch=0,waveYaw=0;
 for(const p of data.points){
  const oy=ch*p.y-sh*p.z,rr=sh*p.y+ch*p.z,ff=cp*p.x-sp*oy,up=sp*p.x+cp*oy;
  const x=s.x+ff*a.fx+rr*a.rx,y=s.y+ff*a.fy+rr*a.ry,w=sampleWater(x,y,s.time,env,Math.max(0,-s.heave-up)),verticalSpan=Math.abs(sp)*p.dx+Math.abs(cp*ch)*p.dy+Math.abs(cp*sh)*p.dz;
  const fraction=clamp(.5+(w.height-s.heave-up)/Math.max(.008,verticalSpan),0,1)*(p.dryAir?1-(s.cockpitWet||0):1);if(fraction<=0)continue;
  const volume=p.volume*fraction,fb=c.waterDensity*c.gravity*volume,dHeel=-cp*rr,dPitch=ff;
  const relativeV=(s.heaveVelocity||0)+dHeel*(s.heelRate||0)+dPitch*(s.pitchRate||0)-(w.waterVz||0);
  const fd=withDamping?clamp(-c.heaveDamping*clamp(env.motionDamping??1,.35,2)*volume/(c.mass/c.waterDensity)*relativeV,-fb*.95,fb*3):0;
  buoyancy+=fb;verticalDamping+=fd;rollBuoyancy+=fb*dHeel;pitchBuoyancy+=fb*dPitch;rollHydroDamping+=fd*dHeel;pitchHydroDamping+=fd*dPitch;
  // Integrate the incident-wave pressure gradient over displaced water. The
  // resolved wave field provides its direction and depth dependence.
  const mass=c.waterDensity*volume,fx=mass*w.waterAx,fy=mass*w.waterAy;
  const moment=forceMoment(s,p,fx*a.fx+fy*a.fy,fx*a.rx+fy*a.ry);
  waveFx+=fx;waveFy+=fy;waveRoll+=moment.roll;wavePitch+=moment.pitch;waveYaw+=moment.yaw;
  submergedVolume+=volume;centerX+=ff*volume;centerY+=up*volume;centerZ+=rr*volume;
 }
 const hullCenterOfBuoyancy={x:centerX/(submergedVolume||1),y:centerY/(submergedVolume||1),z:centerZ/(submergedVolume||1)};
 const gravity=-c.mass*c.gravity;
 let rollCrew=0,pitchCrew=0,cgX=0,cgY=0,cgZ=0;
```

### RUDDER-01 · Angrebsvinkel, stall og trykside

assets/simulation/physics.js, linje 1038–1054.

```js
function foil(u,v,angle,area,model,ventilation=0,steering=false){const c=model?configFor(model):CONFIG;
 const speed=Math.hypot(u,v);if(speed<1e-8)return{forward:0,side:0,power:0,speed:0,alpha:0,stall:0};
 const wf=-u/speed,wr=-v/speed,cf=-Math.cos(angle),cr=Math.sin(angle);
 const alpha=Math.atan2(wf*-cr+wr*cf,wf*cf+wr*cr),fold=.5*Math.atan2(Math.sin(2*alpha),Math.cos(2*alpha)),stall=smooth(14*DEG,29*DEG,Math.abs(fold));
 const attached=c.foilCLMax*Math.tanh(c.foilLiftSlope*fold/c.foilCLMax);
 const suction=1-.82*ventilation;
 // At high incidence a wet rudder still deflects water on its pressure
 // face. In separated flow, resolve a single normal pressure into lift
 // and drag. Ventilation removes suction much faster than that pressure.
 const pressure=steering?1-.25*ventilation:suction;
 const separated=stall*.85*Math.sin(2*alpha);
 const cl=steering?(1-stall)*attached*suction+separated*pressure:((1-stall)*attached+separated)*suction;
 const profile=c.foilProfileCD??.008,induced=c.foilInducedCD*cl*cl;
 const stallCD=(steering?1.70*pressure:1.12)*Math.sin(alpha)**2*stall,cd=profile+induced+stallCD;
 const q=.5*c.waterDensity*area*speed*speed,forward=q*(-wr*cl+wf*cd),side=q*(wf*cl+wr*cd);
 return{forward,side,power:forward*u+side*v,speed,alpha:fold,stall,profileDrag:q*profile,inducedDrag:q*induced,stallDrag:q*stallCD};
}
```

### RUDDER-03 · Kraft og moment fra Racerens to ror

assets/simulation/physics.js, linje 1367–1381.

```js
 const waterInertia=c.id==='laser'?{sway:0,firstMoment:0,secondMoment:0,incidentSway:0,incidentFirstMoment:0}:null;
 const blades=c.waterBlades,offsets=c.rudderOffsets??[0];
 const {load:board,moment:bMoment}=appendageBlade(s,a,c,blades.board,0,wetEnv,h,s.forces?.board,waterInertia);
 const rudders=offsets.map((z,i)=>{
  const blade={...blades.rudder,z,area:blades.rudder.area/offsets.length};
  const prior=s.forces?.rudder?.parts?.[i]??s.forces?.rudder;
  return appendageBlade(s,a,c,blade,s.rudder,wetEnv,h,prior,waterInertia);
 });
 const rudder={parts:rudders.map(({load,moment},i)=>({...load,x:blades.rudder.x,z:offsets[i],area:blades.rudder.area/offsets.length,wetArea:load.wet*blades.rudder.area/offsets.length,moment}))};
 for(const key of Object.keys(rudders[0].load)){
  const total=rudders.reduce((sum,r)=>sum+r.load[key],0);
  rudder[key]=['forward','side','vertical','power','profileDrag','inducedDrag','stallDrag'].includes(key)?total:total/offsets.length;
 }
 const rMoment={roll:0,pitch:0,yaw:0};
 for(const {moment} of rudders)for(const axis of ['roll','pitch','yaw'])rMoment[axis]+=moment[axis];
```

### FOIL-02 · Foilkraft ved tredimensional relativ strøm

assets/simulation/foils.js, linje 63–82.

```js
function foilCoefficients(alpha,flap=0,c=C()){
 const a=alpha+flap,fold=.5*Math.atan2(Math.sin(2*a),Math.cos(2*a)),stall=smooth(c.foilStallStart,c.foilStallEnd,Math.abs(fold));
 const attached=c.foilCLMax*Math.tanh(c.foilLiftSlope*fold/c.foilCLMax),cl=mix(attached,.82*Math.sin(2*a),stall),cd=c.foilProfileCD+c.foilInducedCD*cl*cl+c.foilPlateCD*Math.sin(a)**2*stall;
 return{cl,cd,alpha:fold,stall};
}
function foilElement(o){
 const c=o.config||C(),velocity=o.velocity||V(),speed=len(velocity),area=Math.max(0,o.area||0),normal=unit(o.normal||V(0,1,0)),chord=unit(o.chord||V(1,0,0)),wet=clamp(o.wet??1,0,1),ventilation=clamp(o.ventilation||0,0,1);
 if(speed<1e-8||area===0||wet===0)return{force:V(),lift:0,drag:0,alpha:0,cl:0,cd:0,stall:0,speed,power:0,wet,ventilation};
 const stream=mul(velocity,1/speed),raw=(o.incidence||0)+(o.flap||0)-Math.atan2(dot(velocity,normal),dot(velocity,chord)),polar=foilCoefficients(raw,0,c),cl=o.coefficients?.cl??polar.cl,cd=o.coefficients?.cd??polar.cd;
 let liftNormal=sub(normal,mul(stream,dot(stream,normal)));liftNormal=unit(liftNormal);
 // A folded symmetric polar does not itself reverse the lift basis when
 // water flows from trailing edge to leading edge. Orient that basis by
 // chordwise flow. The tiny cross-flow band fades lift continuously to zero;
 // all ordinary forward flow (V.chord / |V| >= .03) is bit-for-bit unchanged.
 const chordFraction=clamp(dot(stream,chord)/.03,-1,1),orientation=chordFraction*(1.5-.5*chordFraction*chordFraction),liftEfficiency=Math.abs(orientation);liftNormal=mul(liftNormal,Math.sign(orientation));
 // Lift is perpendicular to actual local flow. Positive drag can only remove
 // mechanical energy; ventilation continuously removes lift and raises drag.
 const q=.5*(o.rho||c.waterDensity)*speed*speed*area*wet,L=q*cl*(1-c.foilVentLoss*ventilation)*liftEfficiency,drag=q*(cd+.035*ventilation),force=add(mul(liftNormal,L),mul(stream,-drag));
 return{force,liftForce:mul(liftNormal,L),dragForce:mul(stream,-drag),liftDirection:liftNormal,lift:L,drag,alpha:polar.alpha,cl,cd,stall:polar.stall,speed,power:dot(force,velocity),wet,ventilation,flowAngle:Math.atan2(dot(velocity,normal),dot(velocity,chord)),q};
}
```

### FOIL-03 · Højde- og attitude-krav til aktuatorerne

assets/simulation/foils.js, linje 273–298.

```js
 else{ctrl.trimRoll+=(externalRoll-ctrl.trimRoll)*blend;ctrl.trimPitch+=(externalPitch-ctrl.trimPitch)*blend;ctrl.trimAeroVertical+=(sail.fz-ctrl.trimAeroVertical)*blend;}
 const axes=P.axes(s.theta),flow=P.waterVelocity(s),forwardSpeed=(s.vx-flow.x)*axes.fx+(s.vy-flow.y)*axes.fy;
 const ride=c.rideControl?catFlightReference(s,c,hull,ctrl,forwardSpeed,dt):null;
 const clearance=ride?.clearance??hull.clearance,clearanceRate=ride?.rate??hull.clearanceRate,targetHeight=ride?.height??c.flightHeight;
 const targetVerticalVelocity=clamp((c.flightHeightRateGain??1.20)*(targetHeight-clearance),-(c.flightDescentRate??.85),c.flightClimbRate??.95);
 const verticalAcceleration=clamp((c.flightVerticalRateGain??(cat?1.8:1.65))*(targetVerticalVelocity-clearanceRate),-2.6,2.6);
 const release=(1-smooth(.015,.35,hull.hullWetFraction))*smooth(-.1,.30,clearance),bankMax=c.flightBankLimit??(cat?4*D:7*D),bankGain=c.flightBankGain??(cat?.25:.36),targetHeel=clamp(-Math.atan2(forwardSpeed*s.omega,c.gravity)*bankGain,-bankMax,bankMax)*release;
 // Keep the crew's longitudinal weight shift perceptible after the controller
 // learns the steady loads. Convert its gravity moment into the equivalent
 // attitude change at the controller's pitch stiffness. Only the reference
 // changes: gravity is still integrated once at each crew mass point.
 const crewShift=(s.crewForeAft??0)*c.crewForeAftRange;
 const crewPitchMoment=-m.crewMass*c.gravity*crewShift*Math.cos(s.pitch);
 const crewPitchTrim=clamp(crewPitchMoment/(m.inertiaPitch*c.pitchKp),-.85*D,.85*D);
 const climbPitch=clamp(targetVerticalVelocity*(c.flightClimbPitchGain??.012),-.8*D,.8*D);
 const targetPitch=c.flightPitch+(climbPitch+crewPitchTrim)*release;
 const rollAccel=clamp(c.rollKp*(targetHeel-s.heel)-c.rollKd*damping*s.heelRate,-(c.flightRollAccelLimit??.95),c.flightRollAccelLimit??.95),pitchAccel=clamp(c.pitchKp*(targetPitch-s.pitch)-c.pitchKd*damping*s.pitchRate,-(c.flightPitchAccelLimit??.70),c.flightPitchAccelLimit??.70);
 const aeroVertical=ride?mix(ctrl.trimAeroVertical,sail.fz,ride.fast*.65):ctrl.trimAeroVertical;
 const vertical=weight+m.mass*verticalAcceleration-hull.buoyancy-aeroVertical,roll=-ctrl.trimRoll+m.inertiaRoll*rollAccel,pitch=-ctrl.trimPitch+m.inertiaPitch*pitchAccel;
 Object.assign(ctrl,{externalRoll,externalPitch,transientRoll:externalRoll-ctrl.trimRoll,transientPitch:externalPitch-ctrl.trimPitch,targetVerticalVelocity,verticalAcceleration,targetHeel,targetPitch,rollAcceleration:rollAccel,pitchAcceleration:pitchAccel,release,trimTime,forceRequest:vertical,rollRequest:roll,pitchRequest:pitch});
 f.targetHeight=targetHeight;f.targetHeel=targetHeel;f.targetPitch=targetPitch;
 if(s.capsized||s.recovering)ctrl.initialized=false;
 return{vertical,roll,pitch};
}
// The AC72 game crew uses all four real foil supports. Minimum-norm load
// allocation solves the requested vertical force, roll and pitch moments;
```

### DYN-02 · Fælles integrator, CG og ændret inerti

assets/simulation/physics.js, linje 621–697.

```js
function integrateMass(s,dt,mass,cg,originInertia,force,moment,waterInertia,balance){
 const previous=s.massMotion,oldCg=previous?.cg??s.hydro?.cg??cg;
 const rate={x:(cg.x-oldCg.x)/dt,y:(cg.y-oldCg.y)/dt,z:(cg.z-oldCg.z)/dt};
 const axis=axes(s.theta),oldOffset=bodyOffset(s,oldCg),oldDrift=bodyOffset(s,previous?.rate??{x:0,y:0,z:0});
 const velocity=pointMotion(s,oldOffset,axis);
 let vx=velocity.x+oldDrift.f*axis.fx+oldDrift.r*axis.rx+force.x/mass*dt;
 let vy=velocity.y+oldDrift.f*axis.fy+oldDrift.r*axis.ry+force.y/mass*dt;
 const vz=velocity.z+oldDrift.up+force.z/mass*dt;
 const offset=bodyOffset(s,cg),forward=force.x*axis.fx+force.y*axis.fy,side=force.x*axis.rx+force.y*axis.ry;
 const originMoment=forceMoment(s,cg,forward,side,force.z);
 const inertia={
  roll:originInertia.roll-mass*(cg.y*cg.y+cg.z*cg.z),
  pitch:originInertia.pitch-mass*(cg.x*cg.x+cg.y*cg.y),
  yaw:originInertia.yaw-mass*(cg.x*cg.x+cg.z*cg.z),
  xy:(originInertia.xy??0)+mass*cg.x*cg.y,
  xz:(originInertia.xz??0)+mass*cg.x*cg.z,
  yz:(originInertia.yz??0)+mass*cg.y*cg.z
 };
 const frame=rotationFrame(s,axis),inverse=inverseInertia(inertia);
 const longitudinalSpin=frame.cp*s.heelRate;
 const oldSpin=toLocal(frame,{
  x:axis.fx*longitudinalSpin+axis.rx*s.pitchRate,
  y:axis.fy*longitudinalSpin+axis.ry*s.pitchRate,
  z:s.omega+frame.sp*s.heelRate
 });
 const yawAboutCG=moment.yaw-originMoment.yaw;
 const pitchAboutCG=moment.pitch-originMoment.pitch,rollAboutCG=moment.roll-originMoment.roll;
 // The heel axis is pitched. Its moment already contains a projection
 // of the vertical moment, which must be removed to recover the spatial torque.
 const along=(rollAboutCG-frame.sp*yawAboutCG)/(Math.sign(frame.cp||1)*Math.max(.001,Math.abs(frame.cp)));
 const torque=toLocal(frame,{x:along*axis.fx+pitchAboutCG*axis.rx,y:along*axis.fy+pitchAboutCG*axis.ry,z:yawAboutCG});
 const momentum=multiplyInertia(previous?.inertia??inertia,oldSpin);
 momentum.x+=torque.x*dt;momentum.y+=torque.y*dt;momentum.z+=torque.z*dt;
 const verticalAxis={x:frame.x.z,y:frame.y.z,z:frame.z.z};
 let yawWater=0;
 if(waterInertia?.sway>0){
  // Eliminate sway from the existing added-water model, then apply the
  // remaining impulse about world vertical through the full body inertia.
  const {sway,firstMoment,secondMoment}=waterInertia;
  const effectiveSway=mass+sway;
  const coupling=offset.f*sway-firstMoment;
  const addedYaw=secondMoment-offset.f*(2*firstMoment-offset.f*sway)-coupling*coupling/effectiveSway;
  const incidentSway=waterInertia.incidentSway??0,relativeSide=side+incidentSway;
  const incidentYaw=offset.f*incidentSway-(waterInertia.incidentFirstMoment??0);
  const freeChange=dot3(verticalAxis,multiplyInertia(inverse,momentum))-dot3(verticalAxis,oldSpin);
  const yawResponse=dot3(verticalAxis,multiplyInertia(inverse,verticalAxis));
  const impulse=((incidentYaw-coupling*relativeSide/effectiveSway)*dt-addedYaw*freeChange)/(1+addedYaw*yawResponse);
  momentum.x+=verticalAxis.x*impulse;momentum.y+=verticalAxis.y*impulse;momentum.z+=verticalAxis.z*impulse;
  const change=(relativeSide*dt-coupling*(freeChange+yawResponse*impulse))/effectiveSway-side/mass*dt;
  vx+=change*axis.rx;vy+=change*axis.ry;
  yawWater=impulse/dt;
 }
 if(balance){
  balance.yawAboutCG=yawAboutCG;
  balance.yawApplied=yawAboutCG+yawWater;
  balance.yawWater=yawWater;
  balance.yawInertia=1/dot3(verticalAxis,multiplyInertia(inverse,verticalAxis));
  balance.inertiaAtCG=inertia;
  balance.torqueAboutCG=toWorld(frame,torque);
 }
 const worldMomentum=toWorld(frame,momentum);
 advanceAttitude(s,frame,toWorld(frame,multiplyInertia(inverse,momentum)),dt);
 const nextAxis=axes(s.theta),nextFrame=rotationFrame(s,nextAxis);
 const spin=toWorld(nextFrame,multiplyInertia(inverse,toLocal(nextFrame,worldMomentum)));
 s.heelRate=(spin.x*nextAxis.fx+spin.y*nextAxis.fy)/Math.max(.001,nextFrame.cp);
 s.pitchRate=spin.x*nextAxis.rx+spin.y*nextAxis.ry;
 s.omega=spin.z-s.heelRate*nextFrame.sp;
 const next=bodyOffset(s,cg),nextDrift=bodyOffset(s,rate);
 const nextVelocity=pointMotion({vx:0,vy:0,heaveVelocity:0,omega:s.omega,heelRate:s.heelRate,pitchRate:s.pitchRate,pitch:s.pitch},next,nextAxis);
 s.x+=oldOffset.f*axis.fx+oldOffset.r*axis.rx+vx*dt-next.f*nextAxis.fx-next.r*nextAxis.rx;
 s.y+=oldOffset.f*axis.fy+oldOffset.r*axis.ry+vy*dt-next.f*nextAxis.fy-next.r*nextAxis.ry;
 s.heave+=oldOffset.up+vz*dt-next.up;
 s.vx=vx-nextVelocity.x-nextDrift.f*nextAxis.fx-nextDrift.r*nextAxis.rx;
 s.vy=vy-nextVelocity.y-nextDrift.f*nextAxis.fy-nextDrift.r*nextAxis.ry;
 s.heaveVelocity=vz-nextVelocity.z-nextDrift.up;
 s.massMotion={cg,rate,inertia};
}
```

### AID-04/05 · Opretning og deadline

assets/simulation/recovery.js, linje 152–166.

```js
function update(s,env,nowMs){
 if(!s||env?.autoRecovery===false)return{started:false,completed:false};let started=false;
 if(s.capsized&&!active(s)){start(s,env,nowMs);started=true;}
 if(!active(s))return{started,completed:false};
 const r=s.recoveryState,now=Math.max(r.lastMs,monotonicNow(nowMs));r.lastMs=now;r.elapsed=(now-r.startMs)/1000;s.recovery=clamp(r.elapsed/CONFIG.fallbackEndSeconds,0,1);s.recovering=true;s.crewPose=1;
 const released=smooth(r.elapsed/CONFIG.unloadSeconds);s.sheet=Math.min(s.sheet,mix(r.initial.sheet,Math.min(r.initial.sheet,CONFIG.sheet),released));s.recoveryAeroScale=mix(1,CONFIG.sailLoadFraction,smooth(r.elapsed/.15));
 if(r.elapsed>=CONFIG.deadlineSeconds)return{started,...finish(s,env,now,r.elapsed>5?'deadline-after-inactive-gap':'deadline')};
 if(r.elapsed>=CONFIG.fallbackStartSeconds){beginFallback(s,env);projectFallback(s,env);if(r.elapsed>=CONFIG.fallbackEndSeconds)return{started,...finish(s,env,now,'controlled-stabilization')};}
 else{
  r.phase=r.elapsed<CONFIG.unloadSeconds?'unload':'righting';
  if(r.elapsed>=CONFIG.minimumFinishSeconds){if(isStable(s,env)){if(r.stableSince==null)r.stableSince=now;if(now-r.stableSince>=CONFIG.stableHoldSeconds*1000)return{started,...finish(s,env,now,'force-settled')};}else r.stableSince=null;}
 }
 return{started,completed:false,record:r};
}
function postStep(s,env){if(active(s)&&s.recoveryState.fallback)projectFallback(s,env);}
```

### VIS-01 · Bådpose i renderer

index.html, linje 3465–3471.

```js
    const T=this.T,m=this.model,F=global.FoilingPhysics;
    this.boatRoot.position.set(s.x,s.heave,-s.y);this.heading.rotation.y=s.theta;this.hull.rotation.set(s.heel,0,s.pitch||0,'ZXY');this.boomPivot.rotation.y=s.boom??0;
    const crewStations=global.SailingBoats?.foilerCrewPositions?.(s)||m.crewStations;for(let i=0;i<this.foilingCrew.length;i++){const crew=this.foilingCrew[i],centre=crewStations[i];crew.centre={x:centre.x,y:centre.y,z:centre.z};crew.body=this.seatedCrewPose(crew.centre,(s.crewSideBlend??-1)*(.08+.12*clamp((s.crewPoseBlend??2)-1,0,2)));this.posePerson(crew.person,this.animatedCrewPose(crew.body,s,i));}
    for(let i=0;i<this.mast.length;i++){const a=m.deckY+(this.rig.mastTop-m.deckY)*i/18,b=m.deckY+(this.rig.mastTop-m.deckY)*(i+1)/18;this.rod(this.mast[i],this.foilerMastPoint(a,s),this.foilerMastPoint(b,s));}
    this.updateFoilSailGrid(this.sailMesh,s,false,1);this.updateFoilSailGrid(this.sailSkinMesh,s,false,-1);this.updateFoilSailGrid(this.jibMesh,s,true);
    const leech=(line,jib)=>{const a=line.geometry.attributes.position.array,n=a.length/3,half=Math.ceil(n/2);for(let i=0;i<n;i++){const p=jib?this.jibFoilerPoint(i<half?1:0,i<half?i/(half-1):(n-1-i)/(n-half-1),s):this.mainFoilerPoint(i<half?1:0,i<half?i/(half-1):(n-1-i)/(n-half-1),s,0);a[i*3]=p.x;a[i*3+1]=p.y;a[i*3+2]=p.z;}line.geometry.attributes.position.needsUpdate=true;};leech(this.sailEdge,false);leech(this.jibEdge,true);
    this.updateLine(this.forestay,[this.jibFoilerPoint(0,0,s),this.jibFoilerPoint(0,1,s,true)]);
```
