# Modelkontrol: referencer og aktuelle afvigelser

**Opdatering:** Båd 2 er efter brugerens seneste valg ændret til en fiktiv 27-fods racer på 8,23 m med tre personer. De følgende ældre vurderinger af 12,2 m beskriver den tidligere version; Melges 40-billederne er fortsat stilreference, ikke en målfast tegning af den mindre båd.

De konkrete billeder blev genfundet i offentlige kilder og gemt til lokal modelkontrol: `referencer/laser-agter.jpg`, `laser-side.jpg` og `laser-cockpit.jpg` svarer til MarineVerse-billederne i samtalen; `referencer/melges-agter.jpg` viser samme Melges-rendering i en anden beskæring. Yderligere `melges-side.jpg` viser en beslægtet Melges-sejlplan og er kun supplerende. Numrene nedenfor følger rækkefølgen i brugerens billedbeskeder. Originaler anvendes kun til dokumentation og indgår ikke i spillets assets.

Kilder: [MarineVerse/Steam](https://store.steampowered.com/app/468240/VR_Regatta__The_Sailing_Game/), [MarineVerse/YACHT](https://www.yacht.de/en/races/virtual-reality-sailing-schools-and-regattas-in-the-future/) og [Melges 40-renderinger hos BLUR](https://www.blur.se/2016/04/29/sweet-melges-40/). Billederne er ikke påstået frit licenserede. `sammenlign.html` viser de oprindelige referencebilleder, den faktiske model og et justerbart overlay; kameramatch er fortsat manuelt og foreløbigt.

Laser: billede 1 viser jollen skråt fra siden med cockpittet tæt på; billede 2–3 viser agterspejl og dæk skråt bagfra; billede 4 viser cockpit, sværdkasse, beslag og liner tæt på; billede 5 viser båd og rig skråt forfra; billederne 6–8 viser en sejler under aktiv udhængning. Billede 2 er bedst til skrog og agterspejl, 4 til cockpit og dæk, og 5–6 til rig og sejl. Perspektiv og eventuelle afvigelser mellem de afbildede spilmodeller forhindrer præcis opmåling direkte fra billederne.

Performance: de fem billeder viser en Melges 40-lignende kølbåd fra agter, ovenfra og siden; de sidste tre viser et mørkeblåt skrog. Det første og tredje viser bedst åbent agtercockpit, det sidste viser stævn og sidelinje. Billederne viser en 40-fodsklasse, mens spillets eksisterende performancebåd er 32 fod. Brugeren har valgt billedernes 40-fods design. Båden er derfor ændret til 12,2 m; proportioner og fysik er foreløbige spilparametre.

## Laser: visuel sammenligning

| Område | Synligt i reference | Aktuel afvigelse | Rettelse / status |
|---|---|---|---|
| Skrog | Meget lav enmandsjolle med relativt bred, flad agterende | Lavt mesh findes, men stationernes kontur er endnu ikke kontrolleret mod et overlejret billede | Brug eksisterende 4,23 m som skala og sammenlign fra matchet vinkel, med et mere præcist kameramatch |
| Stævn | Spids, let afrundet og lav ved dækket | Polygonstationerne kan give et kantet omrids | Kontroller og juster de forreste stationer mod referenceoverlay |
| Agterspejl | Bredt, fladt og omtrent lodret med ophæng til ror | Der findes agterspejl og ror; kurve og bredde er ikke målt mod billedet | Match agterhjørner og rorophæng fra bagfra-vinkel |
| Cockpit | Lang, forsænket åbning med støbte, forholdsvis rette kanter | Tidligere ensartet afrundet rektangel og kort åbning | Den synlige åbning er forlænget 0,27 m og tilspidset mod masten; gulvhøjde og besætningens punkter er bevaret. Den fysiske oversvømmelsesmodel bruger stadig sine tidligere cockpitgrænser. |
| Dæk og ræling | Bredt hvidt dæk uden søgelænder; sværdkasse og skødeblokke | Dækket er forenklet og mangler flere formovergange | De store dæksflader og hjørner skal kontrolleres mod originalen før finere detaljer |
| Mast, bom og sejl | Én mast og bom, ét trekantet sejl med paneler og vindue | Én mast og bom findes; sidebilledet viser masten længere fremme. | Mastpositionen er flyttet 0,20 m frem; sejl og bom bruger den fælles mastposition. Vindue og sejldug er fortsat forenklede. |
| Materialer | Hvid gelcoat, tydelig blå skrogstribe, hvid sejldug og metal | Materialer er glatte og forenklede; sejlvinduets form afviger | Tilpas vindue, stof og overflader efter geometrikontrol |
| Sejler | Én anatomisk figur, fødder i cockpit og hænder ved rorpind/skøde | Figuren er fortsat tydeligt stiliseret og mangler fotografiets tøjfolder og menneskelige ansigt | Torsoen er erstattet af et kontureret mesh med hals, hjelm/hat, vestkrave og formede sko; alle dele følger fortsat fysikkens led. En mere naturtro figur mangler |

Tre største tilbageværende afvigelser: figurens menneskelige form, cockpittets støbte konturer og skrog/rigs præcise konturer i referenceperspektivet. Ingen lighedsprocent er påstået. De neutrale billeder er gengivet fra den aktuelle spilkode via `scripts/modelkontrol.cjs`.

## Performance: foreløbig sammenligning

| Område | Reference | Aktuel model og næste kontrol |
|---|---|---|
| Skrog | Langt, mørkeblåt skrog med lavt fribord og smal hvid vandlinje | Skaleret til 12,2 m; konturen kræver sammenligning fra identisk vinkel |
| Stævn | Slank og ret stejl med sort bovspryd | Bovspryd findes; stævnprofil skal matches til originalbilledet |
| Agterspejl | Bred, åben hæk med uhindret adgang til cockpittet | Cockpitåbning er ført til hækken, og den tværgående cockpitkant er fjernet; kurve kræver yderligere sammenligning |
| Cockpit | Langt, åbent arbejdsområde med lav kahyt og flere spil | Åbning og lav kahyt findes, men præcis form og arbejdsstationer er ikke godkendt |
| Dæk og ræling | Lyst dæk, slanke støtter og liner langs begge sider | Ræling og dæksbeslag findes; antal og placering skal sammenlignes |
| Mast og sejl | Mørk mast og bom; nogle billeder viser storsejl og fok | To sejl og to synlige rorblade; rorblade bruger én fælles aggregeret rorkraft. Dimensioner er foreløbige |
| Materialer | Blank mørkeblå skrogside, hvid dækflade og sort rig | Farver findes; materialekarakter skal vurderes i sammenligneligt lys |

Største usikkerheder: referenceperspektiv, den præcise form på åben hæk og cockpit, samt figurernes detaljer. Den eksisterende side-om-side-visning og overlay viser stadig tydelige afvigelser, og kameramatch skal forbedres.

Sådan åbnes kontrollen: Kør `python3 -m http.server 34128` fra projektroden, og åbn `http://localhost:34128/gennemgang/modelkontrol/sammenlign.html`. Visningen ændrer ikke spillets standardkamera.

## Seneste kontroller

Mastflytningen indgår i den fælles fysik. Begge korte banetyper er herefter fysisk gennemsejlet i isolerede browsertests, og testene af bølger, besætning og opretning er bestået. Racerens nye åbne hæk er en visuel ændring; detaljeret referencematch og kontakt i alle manøvrer er ikke dokumenteret. `laser-side-overlay-for.png` viser et foreløbigt perspektiv med originalreference og tidligere model; vinkel og beskæring er ikke tilstrækkeligt præcise til at bruge det som facit.

## Yderligere arbejde og kontrol

Sammenligningsvisningen har nu særskilt indstilling af bomvinkel, besætningsposition og side. Den kopierer de animerede meshdata, så den skjulte spilsimulation ikke efterfølgende ændrer kontrolbilledets sejlform. `scripts/boat-presentations.cjs` genskaber bådvælgerens to billeder direkte fra spillets scene og tager skærmbilleder med det normale kamera.

Kontrolleret i browseren: begge både kan vises i sammenligningsværktøjet, skift mellem position 2 og 3 ændrer figuren, og kontrolstillingen forbliver stabil. Bådvalg og animationer for alle både er testet. Det er ikke bevis for et præcist match: referenceperspektivet og sejlstillingen kræver fortsat visuel tilpasning, og figurer, overflader og dele af skrog/cockpit er endnu væsentligt enklere end fotografierne.
