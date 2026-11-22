# TACK på svagere computere

## Resultat

Ved kysten faldt CPU-tiden til scenen fra **3,5 → 2,4 ms** og tegnekaldene fra **818 → 433** på Høj. På testmaskinen lå almindelig sejlads allerede omkring 60 FPS. Gevinsten er mindre arbejde pr. billede og mere plads til tungt vejr og andre både.

Scenen var den største CPU-post med én almindelig båd. Med seks både dominerede værtens faste fysiktrin. I seksbådsprøven med 3× simuleret CPU-belastning faldt p95 fra **233,4 → 66,7 ms**. Værten var stadig bagud i simulationen i den prøve.

## Betingelser

Målt i headless Chrome 157.0.8103.79 på en Mac17,2 med Apple M5, 10 CPU-kerner, 32 GB RAM og ANGLE på Metal. Three.js r160. Browserfeltet var 1120 × 700 CSS-pixel og skærmens DPR 1,5. GPU-tallene kom fra asynkrone WebGL-tidsforespørgsler. Baseline er det lokale build `139a9cda2795`. Målesættet efter ændringen er fra `d4145a82173b`. Den kørende lokale build og den afsluttende teststatus står nederst.

Prøven starter med det almindelige **Fri sejlads**-valg. Scenarierne begynder ved faste positioner med ens vind, bølger og regn. Scener med Laserjolle og Turbåd bruger 8 m/s og bølgehøjde på 0,38 m. AC75 bruger 17 m/s og 0,60 m. Regnindstillingen er 36 %. Derefter driver de almindelige fysiktrin båden i cirka 2,4 sekunder pr. målevindue. Positionerne bruges til at gentage samme udsnit på begge builds. Kameraskiftet sker med **C**. Seksbådsprøven bruger den almindelige værtssimulation, kollisioner og modeller til lokalbåden og fem modstandere. Nettransporten kontrolleres i de særskilte browserprøver.

Høj brugte en intern pixel ratio på 1,500 → 1,473, og Lav brugte 0,780 → 0,740. Høj tegnede i 1680 × 1050 før og 1649 × 1030 efter. Lav tegnede i 873 × 546 før og 828 × 518 efter. Kort og tekst følger browserens opløsning.

## Billedintervaller og renderarbejde

Alle tal viser før → efter. Billedintervaller er p50 / p95 / p99 mellem faktiske 3D-tegninger i ms. Hak er intervaller over 50 ms. CPU viser medianen pr. browseromgang. GPU, tegnekald og trekanter er medianer af de tegnede billeder. Tegnekald og trekanter summerer hovedbilledet, skygger og refleksioner med én nulstilling af Three.js' tællere pr. billede.

| Grafik og sejlads | Billedintervaller før → efter | Hak | CPU | GPU | Tegnekald | Trekanter |
|---|---|---:|---:|---:|---:|---:|
| Høj · Havn | 16,7 / 16,8 / 16,8 → 16,7 / 16,7 / 16,8 | 0 → 0 | 4,0 → 2,7 | 3,9 → 5,9 | 640 → 237 | 140.028 → 90.605 |
| Høj · Kameraskift | 16,7 / 16,7 / 16,7 → 16,7 / 16,7 / 16,8 | 0 → 0 | 4,1 → 3,4 | 3,2 → 5,0 | 501 → 374 | 221.629 → 181.790 |
| Høj · Kyst | 16,7 / 16,7 / 16,8 → 16,7 / 16,7 / 16,8 | 0 → 0 | 4,5 → 3,6 | 4,7 → 5,3 | 818 → 433 | 186.428 → 133.086 |
| Høj · Åbent vand | 16,7 / 16,7 / 16,8 → 16,7 / 16,7 / 16,8 | 0 → 0 | 3,3 → 2,9 | 3,9 → 5,8 | 479 → 204 | 137.351 → 84.271 |
| Høj · Foil i overblik | 16,7 / 16,7 / 16,8 → 16,7 / 16,8 / 16,8 | 0 → 0 | 6,5 → 5,0 | 5,7 → 5,6 | 438 → 432 | 225.220 → 174.336 |
| Høj · Seks både | 16,7 / 16,7 / 33,3 → 16,7 / 16,8 / 49,9 | 0 → 1 | 14,9 → 11,8 | 4,5 → 5,0 | 386 → 383 | 268.416 → 186.129 |
| Høj · Retur til havn | 16,7 / 16,8 / 16,8 → 16,7 / 16,7 / 16,8 | 0 → 0 | 4,4 → 3,1 | 5,0 → 5,8 | 640 → 237 | 140.032 → 90.617 |
| Lav · Havn | 16,7 / 16,8 / 16,8 → 16,7 / 16,8 / 16,8 | 0 → 0 | 2,6 → 2,4 | 2,1 → 2,0 | 255 → 200 | 56.675 → 64.128 |
| Lav · Kyst | 16,7 / 16,7 / 16,8 → 16,7 / 16,8 / 16,8 | 0 → 0 | 3,3 → 3,2 | 1,7 → 1,8 | 516 → 331 | 83.397 → 84.054 |
| Lav · Åbent vand | 16,7 / 16,7 / 16,8 → 16,7 / 16,7 / 16,8 | 0 → 0 | 2,5 → 2,7 | 2,0 → 2,0 | 119 → 170 | 49.033 → 54.838 |
| Lav · Foil i overblik | 16,7 / 16,7 / 16,8 → 16,7 / 16,7 / 16,8 | 0 → 0 | 5,6 → 4,3 | 1,8 → 2,1 | 263 → 264 | 99.174 → 98.692 |
| Lav · Seks både | 16,7 / 16,8 / 33,3 → 16,7 / 16,7 / 16,8 | 0 → 0 | 11,7 → 8,9 | 2,4 → 2,4 | 303 → 295 | 118.669 → 111.021 |
| Lav med CPU 3× · Havn | 16,7 / 16,7 / 16,8 → 16,7 / 16,7 / 16,8 | 0 → 0 | 7,8 → 6,2 | 2,1 → 2,0 | 255 → 200 | 56.675 → 64.128 |
| Lav med CPU 3× · Kyst | 16,7 / 16,7 / 16,8 → 16,7 / 16,7 / 16,8 | 0 → 0 | 9,1 → 6,7 | 1,7 → 1,9 | 513 → 330 | 83.413 → 84.113 |
| Lav med CPU 3× · Foil i overblik | 16,7 / 33,4 / 33,4 → 16,7 / 16,8 / 33,2 | 0 → 0 | 17,7 → 11,9 | 1,8 → 2,0 | 263 → 264 | 99.210 → 98.736 |
| Lav med CPU 3× · Seks både | 216,7 / 233,4 / 233,4 → 50,0 / 66,7 / 66,8 | 10 → 14 | 218,7 → 26,7 | 2,8 → 2,3 | 253 → 213 | 111.015 → 100.399 |

Lav grafik tegner flere kysttrekanter i enkelte udsnit med den fælles synsafstand. Det betyder blandt andet, at fjerne øer kan aflæses på åbent vand på Lav. Vejr og bådafstand gælder ens på alle trin.

### CPU-tid pr. del

Medianer i ms på almindelig CPU-hastighed. Scenen omfatter kamera, animation, vandkontakt, atmosfære og renderafsendelse. Underposter kan overlappe deres overordnede måling. Medianen beregnes separat for hver post.

| Grafik og scene | Fysik inkl. værtsarbejde | Scene | Båd og rig | Besætning | Kort | UI | Renderafsendelse | Refleksion |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Høj · Havn | 0,9 → 0,9 | 2,9 → 1,5 | 0,2 → 0,2 | 0,0 → 0,0 | 0,1 → 0,1 | 0,0 → 0,0 | 1,5 → 0,8 | 0,0 → 0,0 |
| Høj · Kyst | 0,8 → 0,9 | 3,5 → 2,4 | 0,4 → 0,5 | 0,0 → 0,0 | 0,1 → 0,2 | 0,0 → 0,0 | 1,9 → 1,3 | 0,0 → 0,0 |
| Høj · Foil i overblik | 3,1 → 2,3 | 3,1 → 2,4 | 1,0 → 1,0 | 0,0 → 0,0 | 0,1 → 0,1 | 0,0 → 0,0 | 1,2 → 1,1 | 0,0 → 0,0 |
| Høj · Seks både | 9,2 → 7,2 | 3,4 → 2,6 | 0,5 → 0,3 | 0,0 → 0,0 | 0,1 → 0,1 | 0,0 → 0,0 | 2,0 → 1,7 | 0,5 → 0,0 |
| Lav · Havn | 0,9 → 1,0 | 1,4 → 1,2 | 0,2 → 0,2 | 0,0 → 0,0 | 0,1 → 0,1 | 0,0 → 0,0 | 0,8 → 0,6 | 0,0 → 0,0 |
| Lav · Kyst | 0,8 → 0,9 | 2,1 → 2,0 | 0,4 → 0,5 | 0,0 → 0,0 | 0,1 → 0,2 | 0,0 → 0,0 | 1,2 → 1,0 | 0,0 → 0,0 |
| Lav · Foil i overblik | 3,0 → 2,0 | 2,2 → 2,0 | 1,0 → 0,9 | 0,0 → 0,0 | 0,1 → 0,1 | 0,0 → 0,0 | 0,9 → 0,8 | 0,0 → 0,0 |
| Lav · Seks både | 9,3 → 6,7 | 1,9 → 1,7 | 0,2 → 0,2 | 0,0 → 0,0 | 0,1 → 0,1 | 0,0 → 0,0 | 1,3 → 1,2 | 0,0 → 0,0 |

### Indlæsning, første bådskift og retur

| Grafik | Frisk indlæsning til startknap, ms | Startklik til 0,05 s simulation, ms | Største interval ved første skift til Turbåd, ms | Største interval ved første skift til AC75, ms |
|---|---:|---:|---:|---:|
| Høj | 1.778 → 1.611 | 308 → 248 | 100,0 → 100,0 | 66,7 → 83,4 |
| Lav | 1.558 → 1.513 | 214 → 223 | 83,3 → 83,4 | 66,8 → 83,3 |
| Lav med CPU 3× | 4.065 → 4.101 | 375 → 356 | 183,3 → 166,6 | 149,9 → 133,2 |

Frisk indlæsning og de korte vinduer omkring første modelskift er enkeltmålinger. På Høj tog første renderafsendelse efter skiftet til Turbåd op til 81,6 ms. Bådopbygningen i JavaScript tog 7,7 ms. Der er fortsat et hak ved førstegangsvisning af visse modeller. Første renderafsendelse indbefatter browserens ressourceforberedelse.

På Høj viste havnen først 225 geometrier og 26 teksturer. Efter skift mellem bådtyper og besøget med seks både nåede havnen 269 og 28. Efter endnu en tur ud og hjem stod den på 269 og 28. Tallene er antal WebGL-ressourcer og måler ingen bytes. Første besøg uploader ressourcer som sømærker, kyst og rig. Budget, aktiv pynt, kystregioner, cache og opløsning findes for hvert målepunkt i JSON-filerne.

### Vand og spejling

Isolerede GPU-prøver på Høj med 12 målinger pr. passage. Vand alene tegnes ved den normale interne opløsning og med den valgte kameravinkel. Den enkle shader angiver arbejdsmængden for det flade net med basal rasterisering. Spilshaderen inkluderer bølgeforskydning og optik. Passagerne kan ikke lægges sammen eller trækkes fra hinanden som præcise enkeltomkostninger.

| Kamera | Vandtrekanter | Net med enkel shader, ms | Spillets vandshader, ms | Planar spejling af både, ms |
|---|---:|---:|---:|---:|
| Følgekamera ved havn | 60.480 → 39.600 | 2,6 → 0,7 | 2,7 → 1,9 | 0,2 → 0,3 |
| Overblik på AC75 | 60.480 → 39.600 | 4,3 → 4,6 | 6,1 → 2,6 | — → — |

Spejling ligger i ét fælles render target og tegnes ved Høj eller Mellem, når kameraet er tæt på vandoverfladen. Overblik bruger himmellys og vandets øvrige refleksioner.

## Grafikbudgetter

| Trin | Detaljeafstande, m | Udtoning af grafisk bølgehøjde, m | Enkel vandoptik efter, m | Internt pixelmaks. | Bådspejling |
|---|---:|---:|---:|---:|---:|
| Høj | 80 / 250 / 700 | 210–380 | 410 | 1,70 MP | 448 px bredde, op til 20 Hz |
| Mellem | 70 / 195 / 480 | 185–300 | 300 | 1,10 MP | 288 px bredde, op til 11 Hz |
| Lav | 52 / 135 / 310 | 150–235 | 220 | 0,44 MP | Himmel |
| Auto, laveste trin | 38 / 95 / 210 | 135–205 | 185 | 0,26 MP | Himmel |

- Geografiske pyntefelter er 125 m brede og bruger objekternes samlede udstrækning. Sten og stammer falder først væk. Veje, marker og hække rækker længere. Fjerne træer bruger enklere kroner. Ved tærsklerne er der 14 m margen mod pendling.
- Fjerne kystregioner tegner de samme terræntrekanter i større grupper med et enklere materiale. Huse, moler, fyr og kystens form bevares. Hvert billede kan forberede højst to sæt af vinduer og moledetaljer. Cachen rummer højst 24 sæt. Delte modeller og materialer genbruges.
- Det sammenhængende havnet når 11 km fra båden og bruger fælles verdenskoordinater og tid. Båden og kølvandet har det tætte net også i overblik. Ved større afstand udfases små bølger og dyr vandoptik gradvist.
- Høj bruger et lokalt skyggekort på 1024 × 1024. Fjernsprøjt og pynteregn har lavere budget. Fjernere både bruger simple skrog og sejl med samme position, synsgrænse, vejrtåge og skjul bag terræn. Spillerens båd, navigationsmærker og lokale vindpile bruger de almindelige modeller.
- **Auto** starter på Mellem, falder efter vedvarende belastning og hæver kvaliteten efter en længere stabil periode. Den samlede styring ligger på én skyder med den valgte værdi.

## Sejlads og begrænsninger

De seks gemte fysikprøver og 15 nye før/efter-prøver gav bit-for-bit samme prøveværdier. De nye forløb dækker alle fem bådtyper med dønning, chop, åbent vand og kystlæ. De sammenligner blandt andet position, fart, ror, trim, besætning, rotation og vandkræfter. Højden beregnes fra samme spektrum. Vandets hastigheder beregnes ved de punkter, hvor de kan bidrage til kræfterne.

Tidssteppet er 1/60 s. En tegnepause beholder ventende trin og begrænser arbejdet pr. browseromgang. Ved tung vedvarende belastning kan værten ikke indhente alle trin i realtid. Prøven med seks både og 3× CPU-belastning viste det særskilt. Kapsejladsen bruger de bearbejdede trins tidsstempler. Grafikniveauet ændrer hverken fysikkens felter eller reglement.

3× CPU-begrænsning er en Chrome-simulering på den samme Mac. Der er ingen måling på en fysisk svag GPU. Høj framerate under normal sejlads dækker ét kameraudsnit ad gangen. Der kan stadig forekomme hak ved første ressourceupload, især efter bådskift.

Ved udgangen af 3×-prøven med seks både var 1,60 s endnu ikke simuleret. Der var 43 browseromgange uden 3D-tegning. Det fremgår af forskellen på browserens p95 på 33,4 ms og p95 mellem 3D-tegninger på 66,7 ms. Antallet af intervaller over 100 ms faldt fra 10 til 0.

## Billeder og reproduktion

| Samme grafikvalg og kamera | Før | Efter |
|---|---|---|
| Laserjolle, følgekamera | [Billede](foer-havn.jpg) | [Billede](efter-havn.jpg) |
| AC75, overblik | [Billede](foer-overblik.jpg) | [Billede](efter-overblik.jpg) |

[Målinger på Høj før](foer-hoej.json) · [Høj efter](efter-hoej.json) · [Lav før](foer-lav.json) · [Lav efter](efter-lav.json) · [3× før](foer-cpu3.json) · [3× efter](efter-cpu3.json) · [Vand før](vand-foer.json) · [Vand efter](vand-efter.json).

```sh
node scripts/render-performance.cjs http://localhost:4173/ /tmp/tack-maaling high
node scripts/render-performance.cjs http://localhost:4173/ /tmp/tack-maaling low
node scripts/render-performance.cjs http://localhost:4173/ /tmp/tack-cpu3 low 3
TACK_PERF_LAYERS=1 node scripts/render-performance.cjs http://localhost:4173/ /tmp/tack-vand high
```

## Teststatus

[Den lokale build](http://localhost:4173/) svarer med revision `d4145a82173b`. Typekontrol og 37 Node-prøver bestod. Den brede serie på 53 browserprøver bestod før den sidste ændring af tegnebudgettets måling og kadence. På `d4145a82173b` bestod de otte gentagne prøver af grafik, fast tidssteg, kurssynkronisering og genforbindelse.

Den brede serie dækkede blandt andet fem bådtypers vandkontakt, shaderens højde ved de samme punkter som fysikken, farten ved forskellige billedfrekvenser, kyst og dybde, to kapsejladsforløb, seks klienters separate styreinput og udveksling af rigtilstande.

Den særskilte fulde trekantbane med seks automatiske piloter endte med 0 af 6 både i mål både på baseline `139a9cda2795` og på optimeringsbuildet efter 1.560 simulerede sekunder. Den prøve af det fulde løb er fortsat åben. De øvrige kapsejlads- og netværksprøver kontrollerer start, delte baner, styring, genforbindelse og udveksling af resultater.

Jeg åbnede den lokale build i Chrome, valgte Fri sejlads og brugte kvalitetsskyderen med tastaturet. Alle fire værdier blev vist, og roret reagerede efter lukning af menuen. Browseren meldte ingen fejl i den prøve.
