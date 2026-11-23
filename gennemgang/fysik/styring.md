# Styring, rig og vandkontakt i TACK

Testet på [localhost:5173](http://localhost:5173/) i Chrome 157.0.8103.79, 1280 × 800, DPR 1. Førbuildet er `83a1549f5b06`. Efterbuildet er `d3ad41af49c9`. Begge builds bruger kildekode fra samme lokale workspace med udgangspunkt i Git-revision `f38a981`. Efterbuildet svarer til HTTP-headeren og buildvisningen i spillet. Den lokale autoritative multiplayerproces på port 3001 kører samme efterbuild.

## Fejl og rettelser

| Oplevelse | Fund i kæden fra input til bådens bevægelse |
|---|---|
| Roret virker kun til én side | Jeg kunne ikke genskabe en vedvarende blokering i førbuildet. Rorvinklen kunne dog skifte størrelse med den lokale strøm på ét blad, selv ved uændret tast. På Svær bruger `updateHelm` nu bådens fremdrift gennem middelstrømmen til det progressive rorudslag. Hvert blad bruger stadig sin egen vandkontakt og strøm til kraften. Hvis båden vedvarende gør vej baglæns, bevares den eksisterende vending af styreretningen. |
| Ved 0 % sker der intet | Skødeprocenten angiver linevandring. Bommen skal først svinge, og et sejl ved sit mekaniske stop kan fortsat være fyldt på læns. Den aktuelle browser viste slæk på kryds og halvvind. Rorkraften og sejlet kan aflæses uafhængigt. I multiplayer blev skødet sendt som en ændringshastighed. Klienten og værten kan nu begge bruge det absolutte mål, så et forsinket eller gentaget input ikke kan køre forbi den valgte procent. |
| Vind eller hjælp overtager | På Svær er ror og hovedskøde under spillerens kontrol i de afprøvede forløb. Genvinding fra en kæntring er en særskilt tilstand med synlig feedback. På Let styrer balancehjælpen besætningen, og den valgfri hjælp i vindøjet virker ved at bakke med sejlet. Testen om forældede multiplayerinput afviser et ældre skødemål og kontrollerer det nyere mål i værtens faktiske bådtilstand. |
| Racer 32 observeret ved 40 knob | Det rapporterede løb kunne ikke genskabes. Jeg fandt en modeluoverensstemmelse i kølbådenes sejl, som havde vandrette kræfter og en særskilt heel-faktor. Storsejl og fok beregnes nu i deres krængede profilplan, og resultatet transformeres til tre kraftkomponenter med moment ved det faktiske kraftpunkt. Turbådens ekstra sejl følger det samme koordinatsystem. Der er ikke indført en fartgrænse. |
| Båden skøjter eller svæver | De afprøvede skrog, køl, sværd og ror mister ikke vandkontakt samlet, når planingsløftet vokser. Skrogfriktion og sidekraft bruger neddykket areal og lokal vandhastighed. De nye rorlogs viser faktisk vådt areal, angrebsvinkel, vandstrøm og moment for hvert blad. Fem prøver med 1,2 m/s startsidefart i stille vand endte på 0,01–0,17 m/s sidefart efter otte sekunder. |
| Vægt frem/agter mærkes for lidt | Kontrolleret på alle fem profiler med samme last. Flytningen ændrer tyngdepunktet, stævnens hældning og neddykningen. Den koblede rotationsberegning fra førbuildet integrerer omkring det øjeblikkelige tyngdepunkt. Vægt er en lodret kraft. Ændringen i opdriftens momentarm, vandkontakt og inertitensor forklarer reaktionen. Lodret tyngdekraft skaber intet moment omkring tyngdepunktet. |
| Rebning er uklar | Synlig betjening angiver nu **Reb storsejl**, **Reb begge sejl** eller **Vinge og fok**. På Turbåd 43 skiftes fokken særskilt. Et samlet rebvalg på foilmonohullen gør begge duge mindre. Vingens belastning ændres med flap og profil, og fokken reduceres. Vingens 205 m² bevares. |
| Grafik følger ikke tilstanden | Den almindelige sejladsprøve logger rorudslag og den tegnede rorgruppes vinkel, aktiv stofskalering og faktisk besætningsplacering. Værtens og gæstens grafik bruger de samme ledpositioner, genskabt fra den modtagne kropsstilling. Den tidligere multiplayerprøve forventede en liste af led, som transporten bevidst udelader. Prøven kontrollerer nu både rekonstruktionen og den synlige besætning. |

Ror og sværd beregner relativ bevægelse i profilerne fra verdensstrømmen minus punkthastigheden inklusive rotation. Stall dæmper løft og øger modstand. Neddykning og ventilation beregnes særskilt. Ved tab af vandkontakt i Laserprøven kom roret igen ned i vandet efter ca. 1,57 s. I det næste halve sekund gav modror ca. 3° mere kursændring på begge halser end i en parallel prøve med neutralt ror.

## Målinger

På åbent vand tilføjes hvert af de to rorinput i en prøve med 5 knob startfart. Efter 0,65 s af det første input var rorudslaget ca. ±23,4° på fladt vand og ±23,6° med 1,5 m lange bølger og 0 % chop. Rormomentets størrelse var henholdsvis ca. 182 og 190 Nm, med modsatte fortegn. Ved halvt fysiktrin ændredes slutkursen under 0,14° og slutfarten under 0,005 kn i disse fire korte forløb. I sejlads fra startmenuen på Svær ved 8,5 m/s vendte Laserjollen fra 229° til 130° og tilbage til 230° med tastaturbetjening. [Før/efter-log fra vendingerne](styring-stagvending.json)

I Chrome ved 5,5 m/s og 1,5 m bølger viste skødeskyderen 100 → 0 → 100 %. Bommen stod ved 12° fra center, svingede til 39° og kom tilbage til 12°. Storsejlets beregnede fremadkraft ved de tre målinger var 59, −10 og 49 N. Rebtrinnene ændrede storsejlet fra 7,06 m² til 5,93 og 4,80 m². Modellen viste 43 cm langs skroget ved fuldt fremflyttet Laserbesætning. Ved 5,55 og 4,91 knob i den sidste del af samme forløb nåede rorbladet henholdsvis +23,5° og −24,0°. Den tegnede vinkel lå inden for 0,1° af fysiktilstanden ved målepunkterne. [Browser efter](styring-browser.json) · [Browser før](styring-browser-foer.json)

I den kontrollerede Laserprøve ved 4 m/s var bomåbningen ved 0 % ca. 41° på kryds, 70° på halvvind og 86° på læns. I lænsprøven voksede storsejlets fremadkraft fra 0,3 til 36 N, da sejlet blev åbnet. På den kurs kan sejlet fortsat være fyldt mod riggens stop. Ved fastsat vind og samme indfaldsvinkel følger drivkraften arealforholdet ved de to rebtrin for de bløde storsejl. Under sejlads kan det faktiske sejltryk ændre sig anderledes, fordi fart, krængning og vind ved sejlet også ændrer sig. [ORC VPP om kraft- og momentbalance](https://orc.org/organization/velocity-prediction-program-vpp)

### Racer 32 i 17 m/s

24 prøver pr. build, seks vindvinkler og to skødeindstillinger på både fladt vand og 1,5 m bølger. Start fra hvile med tre sejlere i trapez, ingen strøm, 0 % chop og ingen pust. Scriptet holder den valgte kurs med en almindelig rorkommando. Nedenfor vises to identiske prøvepar. Tallene er maksimal fart gennem middelstrømmen inden for 20 s.

| Startvinkel til vinden og skøde | Før, kn | Efter, kn |
|---|---:|---:|
| 160°, 0,50 fysisk linevandring, fladt | 12,35 | 10,56 |
| 160°, 0,50 fysisk linevandring, 1,5 m bølger | 12,75 | 10,95 |

Højeste fart i hele serien var 12,75 kn før og 10,95 kn efter. Skrogmodstanden i slutningen af bølgeprøven var ca. 2,53 kN agterud med 2,10 m³ neddykket skrog. Det rapporterede tal på 40 kn kan derfor hverken forklares eller betragtes som genskabt. ORC’s sammenligningsbåd Melges 32 har ca. 11,8 kn beregnet ved 110° og 20 knob vind. TACKs Racer nåede ca. 10,1 kn i den separat kørte prøve ved samme vindstyrke og en stævnvinkel omkring 106°. Sejlplan, besætning og model er forskellige. ORC-certifikatet rækker til 20 knob vind og giver ingen direkte validering ved 17 m/s, der svarer til ca. 33 knob. [ORC Melges 32](https://data.orc.org/public/od/2022/melg32.od.html?nav=1)

I et andet Racer-forløb ved 12,1 m/s og samme skøde sænkede trapezen krængningen med 0,97° efter ét sekund og 5,15° efter fem sekunder i den nye model. Før var ændringerne 1,46° og 4,02°. Farten efter fem sekunder var 7,61 kn i trapez mod 7,22 kn på kanten i efterbuildet. Den faste tærskel for det første sekund i testen er afstemt efter den målte overgang. Testens krav til slutbalancen og fartforbedringen er bevaret.

### Vægt, bølger og passiv bevægelse

På fladt vand i ro gav fuldt agter til fuldt frem et skift af Laserens samlede tyngdepunkt på 45,1 cm. Med 75 kg af sejlklar vægt på 143 kg og 86 cm vandring giver regnestykket samme resultat. Stævnhældningen ændrede sig 1,34°. Turbåd 43 flyttede det samlede tyngdepunkt 5,3 cm og ændrede stævnhældningen 0,11°. Alle fem skift, den lokale neddykning ved stævn og agterende samt inertierne står i rådata. [ILCA om besætningsvægt på læns](https://ilcasailing.org/downwind-in-lasers/)

Med den kendte startfart på 11 m/s kom begge foilbåde i fasen `foiling` inden den første måling ved 2,5 s. Efter fuldt slæk og faldende vind havde monohullens skrog igen ca. 61,7 kN opdrift, og katamaranens skrog ca. 33,4 kN. Katamaranen delte belastningen med foilernes ca. 34,1 kN i den sidste måling.

Med 1,5 m bølger og 0 % chop varierede den lokale vandhøjde med ca. 1,26 m langs den afprøvede Racer-rute. Ror, sværd og foils bruger `waveAt` ved kontaktpunkternes aktuelle verdenspositioner, og simulation og vandgrafik bruger den fælles definition af bølgefeltet. Grafikvalget påvirker tegnedetaljer. Ved restaurering af stillevandsligevægt i Laserjollen faldt den anslåede sum af potentiel og kinetisk energi med ca. 52 J over fem sekunder. Ved 60 Hz var der et kort oversving på 2,2 J i energiestimatet. Ved 120 Hz forsvandt oversvinget. Prøven bruger potentialet for de samme lineært neddykkede skrogceller og gælder små bevægelser. [ITTC’s vejledning om validering og tidssteg](https://ittc.info/media/11868/75-02-06-03.pdf)

## Bådprofiler og uafklarede forhold

[De aktuelle profiler](baadprofiler.json) viser skrogmål og -sektioner, masser, sejlklar vægt, neddykket volumen, vandlinje, appendager og de fulde inertier om tyngdepunktet. Koden i `assets/simulation/boats.js` er kilden til geometri og masser. Laserens 7,06 m² er et klassemål. De 56 kg i TACK er den kalibrerede skrogkomponent, separat fra 10 kg rig, 2 kg udstyr og 75 kg sejler. ILCA Australia angiver 56,7 kg skrogvægt. Racer 32 og Turbåd 43 bruger inspirationsbåde, og foilbådenes kraftkoefficienter og aktuatorer er spilkalibreringer. De målte eller kildebelagte størrelser, beregnede hydrostatikker og antagne parametre er beskrevet i [fysikoversigten](README.md). [ILCA Australia](https://ilca.au/about-us/)

Det oprindelige 40-knobsforløb mangler et reproducerbart startpunkt, sejlinput og tidsserie. Der mangler også fuldskala manøvredata og fartpolarer for de fiktive profiler. Laserens prøve med kraftigt slæk i chop ligger på 2,42 m/s, under den eksisterende testgrænse på 2,50 m/s, både før og efter. I vindskiftprøven med fuld rig kæntrer Laserjollen på Svær i begge builds. De to kendte prøver på 36° kurs efter en vending fra næsten vindøjet er særskilte fra de to fulde, beståede tastaturvendinger.

## Kørbare prøver og billeder

```sh
node scripts/control-audit.cjs
node scripts/control-audit.cjs . 120
TACK_URL=http://localhost:5173/ node scripts/playability-check.cjs laser-tacks
TACK_URL=http://localhost:5173/ TACK_CAPTURE_DIR=/tmp/tack-billeder node scripts/playability-check.cjs control-chain
npm test
npm run check:simulation
npm run test:physics
```

Åbn diagnostikken i spillet med tasten med browserkoden `Backquote`. De komprimerede JSON-logs indeholder starttilstand, vejr, indstillinger, tidsstemplede kommandoer og kræfter. Sammenlign den samme prøve mellem filerne. [Før](styring-foer.json.gz) · [Efter](styring-efter.json.gz) · [Halvt fysiktrin](styring-halvt-trin.json.gz)

Alle 54 Node-tests og typekontrollen bestod. 28 af 30 prøver i browserpakken for fysisk model, ror, Racer 32, rig og manøvrer bestod. De to fejl er de ovenfor beskrevne Laserforløb med slæk i chop og vindskift med fuld rig. De 11 særskilte prøver for grafik, sø, netværksforsinkelse og ekstra sejl i multiplayer bestod.

Billeder fra samme sejlads og standardkamera. [Ror mod styrbord](styring-billeder/control-chain-hard/02.jpg) · [Vægt agter](styring-billeder/control-chain-hard/04.jpg) · [Fuldt slæk](styring-billeder/control-chain-hard/07.jpg) · [To reb](styring-billeder/control-chain-hard/10.jpg)
