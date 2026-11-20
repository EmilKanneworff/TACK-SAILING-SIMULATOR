# FRI VIND i browseren

Åbn [spillet på localhost](http://localhost:5173/) og vælg **Fri sejlads** eller **Kapsejlads**. Begge handlinger starter direkte. For at starte i frisk sø på åbent vand skal du vælge **Fri sejlads** i [bølgeprøven i cockpit](http://localhost:5173/?proeve=boelger). **Menu → Om spillet** viser revisionen, som den åbne side fik fra serveren.

## Start og skift med ét tryk

- **Fri sejlads** sender dig ud fra Faaborg. **Kapsejlads** sender dig direkte ud ved startlinjen og begynder nedtællingen på 30 sekunder. Standardbanen er kort Op/ned.
- Før start er båd, vejr, banevalg og lobby samlet under **Opsætning**. Under sejlads ligger **Banevalg** i Menu. Du kan vælge og se næste bane særskilt, mens et eksisterende løb beholder sin bane.
- Knappen i højremenuen skifter direkte mellem fri sejlads og kapsejlads. **Nyt løb** i Menu starter en ny nedtælling. Et tryk på et bådkort vælger straks båden og lukker kortvælgeren. Pausepanelet har **Fortsæt**, og modeldetaljerne åbnes via instrumenternes **Detaljer**.
- I en fælles sejlads styrer værten sejltype og løbsstart. Gæsterne deltager gennem lobbyen.

Begge startknapper er prøvet fra localhost på revision `3077adbaf940`. Fri sejlads gik direkte til aktiv sejlads ved 1440 × 900. Kapsejlads gik direkte til nedtælling ved 390 × 844. [Startskærm før](start-foer.png) · [Startskærm efter](start-efter.png) · [Mobil](start-mobil.png) · [Nedtælling efter ét tryk](start-nedtaelling.png)

Genforbindelsestesten sporede en frysning hos værten til en layoutadvarsel, der blev behandlet som en fatal fejl. Kort og instrumentbjælke opdaterer nu størrelser i næste billedramme. De 13 browserkontroller af start, layout og multiplayer bestod, inklusive seks samtidige klienter på lav grafik. To gentagelser viste desuden, at simulationstiden gik frem hos både vært og gæst efter genforbindelse. Produktionsbuildet og de ni Node-tests bestod.

## Versionskontrol fra den første gennemgang

| Led | Observation |
| --- | --- |
| Projekt og kilde | /Users/emilkanneworff/Desktop/Sejlads/index.html. Projektet bruger en Node-server og indlæser Three.js r160 fra HTML-filen. |
| Proces og port før ændringer | PID 927 kørte node server/static.js fra projektmappen og lyttede på 5173. PID 64838 kørte samme projekts live-server på 3001. Portene til andre programmer blev ikke ændret. |
| Serverens indhold før ændringer | SHA-256 aa77b54aca2d0a2601bc5142a9275958cdd1d0685f772d37815b3bef6148df5b matchede index.html byte for byte. dist/index.html havde den samme hash på det tidspunkt. Den arkiverede index (11).html havde en anden hash og serverscriptet brugte den ikke. |
| Browseren før ændringer | Chrome 157 hentede HTML, scripts og de fem bådbilleder med HTTP 200. Den friske profil havde ingen aktiv service worker eller registrering på origin og ingen fejlede netværkskald eller konsolfejl. |
| Lagring og brugerens fane | Jeg fandt ingen FRI VIND-fane i de profiler, der var tilgængelige via browserens debugporte. Browsermålingen dokumenterer den friske profil, og årsagen i en allerede åben brugerfane er uafklaret. Gemte data i brugerens profil blev hverken læst eller slettet. |
| Server og revision efter de første ændringer | Node-processen med PID 34805 lyttede på 5173 fra projektmappen. Revision `7a2b255aad08` matchede i HTTP-svaret, HTML og **Om spillet**. HTML og assets leveres med Cache-Control no-store. Versionen beregnes af HTML og filerne i assets. Ændringer på disk tæller med, også når de ikke er registreret i versionsstyring. Alle 14 registrerede netværkssvar havde HTTP 200. Registreringen viste ingen aktiv service worker, konsolfejl eller fejlede kald. |

Det verificerede udgangspunkt var allerede den aktive udviklingsfil. Jeg fandt konkrete forklaringer på, hvorfor forbedringerne kunne være svære at se i den version. Førklippet viser små bølger ved en kyst i læ, procedurale skyer og adskilte lemmodeller. Brugeroplevelsen ændrer sig nu også fra den almindelige start. Det er ikke muligt at knytte brugerens tidligere oplevelse til en bestemt gammel fane ud fra de tilgængelige observationer.

## Billeder og optagelser

Parrene er taget med Laser, følgekamera, Faaborg, nordenvind på 5 m/s, små bølger, høj grafik, Chrome på macOS og 1440 × 900 ved 1× pixelratio. Playwrights ur gav samme simulationstid og position i hvert par. Standardvisningen, vejrpanelet og det store kort er taget efter henholdsvis 2,183, 2,267 og 2,367 aktive sekunder. Stilling, koordinater og bølgefelt fremgår af målingerne.

| Visning | Før | Efter |
| --- | --- | --- |
| Fri sejlads | [Billede](foer/sejlads.png) | [Billede](efter/sejlads.png) |
| Vejrpanelet | [Billede](foer/vejr.png) | [Billede](efter/vejr.png) |
| Stort kort | [Billede](foer/stort-kort.png) | [Billede](efter/stort-kort.png) |
| Turbåd i rolig og frisk sø på åbent vand | [Optagelse](foer/boelger.webm) | [Optagelse](efter/boelger.webm) |
| Racer 32 med position 1, 2, 3 og tilbage til 2 | [Optagelse](foer/besaetning.webm) | [Optagelse](efter/besaetning.webm) |
| Fire kameravinkler og tre kortstørrelser |  | [Optagelse](efter/kamera-kort.webm) |

Optagelserne bruger en kørende simulation. Klippene af bølger benytter samme Turbåd 43 og cockpitkamera. I begge klip begynder frisk sø i åbent vand. Først vælges roligt vand, så frisk sø igen efter otte aktive simulationsekunder. Restbølgerne svinder gradvist undervejs. Rådata findes i [førmålingen](foer/maaling.json) og [eftermålingen](efter/maaling.json).

## Betjening

| Under sejlads | Ændring |
| --- | --- |
| Højre kant | Kamera, Både, Vejr, Kapsejlads og Menu. Lobby er flyttet ind i Menu. Åbningsknapper angiver, hvilket panel der er åbent. |
| Kamera | Følge, Overblik, Cockpit, Side, tilbage til Følge. Knap og C bruger samme funktion. Det skjulte kameravalg og den gentagne kamerabesked er fjernet. |
| Kort | Lille, mellem, stort og tilbage til lille. Nordretning, zoom og visningen af båden bevares ved hvert skift. Stort kort holder afstand til bundbjælken og sejlbetjeningen. Start, mål og aktive mærker får plads før øvrige etiketter. Lange spillernavne forkortes på kortet og kan læses i lobbyen. |
| Instrumenter | Fart, vind, trim, ror og vægt vises i en lavere bjælke. Målinger af foilkræfter og modeltilstande ligger i Detaljer. Meddelelser og sejlråd deler samme plads. |
| Menu | Fri sejlads, lobby, pause, genstart, visning og hjælp. De gentagne knapper for fri sejlads, løbsstart, hjælp, lyd og genstart er samlet eller fjernet. Lyd, grafik, hjælp og teknisk styring har egne afsnit. |
| Vejr | Vind ved båden og åbent vand, læ, hurtigvalg og bølgehøjde ligger øverst. Gæster kan læse vejret. Kun værten kan ændre globale forhold før et fælles løb. |
| Sejl og besætning | Turbåden har spiler og Code 0 ved bundbjælken. Hver båds egne vægtvalg ligger samme sted. 1, 2 og 3 virker fortsat. |
| Fokus | Esc lukker det aktive panel og returnerer til åbneren. Det gælder også fra et tekstfelt i lobbyen. Hvis lobby eller hjælp blev åbnet fra Menu, vender fokus tilbage til den handling i Menu. |

Layoutet er afprøvet ved 1440 × 900, 1280 × 720, 390 × 844 og 320 × 600, med dynamisk ændring af vinduet og op til 162 % tekststørrelse. 3D-visning og kort beholder deres todimensionelle layout. Se [sejlads ved 1280 × 720](efter/sejlads-1280.png), [mobilvisning](efter/sejlads-390.png), [vejret på mobil](efter/vejr-390.png) og [nedtælling med 150 % tekst](efter/nedtaelling-150.png). [W3C om reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)

## Grafik, bølger og besætning

- Himlen bruger en lokal fototekstur, som også samples til refleksioner i bølgerne og de blanke bådmaterialer. Skydække, regn og dis blandes med himlen fra spillets vejr. Fototeksturen er sRGB. Bølge- og bumpdata er lineære. Alle fem billeder i bådvælgeren er regenereret fra deres faktiske 3D-båd. [Three.js r160 om farvehåndtering](https://github.com/mrdoob/three.js/blob/r160/docs/manual/en/introduction/Color-management.html)
- Himlen er afledt af *Kloofendal 38d Partly Cloudy (Pure Sky)* af Greg Zaal og Jarod Guest. Til spillet er panoramaet nedskaleret og drejet, så det passer med lysretningen. [Asset](https://polyhaven.com/a/kloofendal_38d_partly_cloudy_puresky) · [CC0](https://polyhaven.com/license)
- Højder og hældninger kommer fra det samme bølgefelt i fysik og rendering med samme tid og koordinater. Overfladen har mindre vindkrusninger, mens skummets placering afhænger af bølgekamme og kurvatur. Vandet ved kameraet samples med samme lokale læ. Vejrpanelet viser den forventede forskel mellem lokal og åben sø. Den beregnede vandhastighed følger også den gradvise overgang ved bølgeskift.
- Besætningen har et originalt skelet med 14 knogler og vægte i dragten over hofter, knæ, skuldre, albuer og manchetter. Det er koblet til fysikkens hoftepositioner og arbejdsstationer. Rorpind, rat og skøde følger relevante hænder. Visuel balance, blik og duk under bommen supplerer den fysiske vægtflytning. Racer 32 beholder sine to sejlere og trapezliner. Foilbådene bruger de beskyttede stationer. [Three.js r160 om skeletanimation](https://github.com/mrdoob/three.js/blob/r160/docs/manual/en/introduction/Animation-system.html)

## Målt under sejlads

Den aktive vindskyder er afprøvet med tastatur og hurtigvalg i Faaborg og på åbent vand. Ved 0 m/s forsvinder de bevægelige vindspor. Ved 12 m/s i åbent vand giver testforløbet over 1.000 N mere fremdrift fra sejlet end ved 0 m/s. Ved Faaborg målte den samme test 3–6 m/s lokalt og over 40 N ekstra sejlfremdrift. Forskellen følger vindlæet fra kysten og vises i vejrpanelet.

Åtte aktive sekunder med Turbåd 43 og identiske input sammenligner roligt vand med frisk sø. Målingen samler store og små bølgekomponenter, lokal læberegning og de kræfter, skroget faktisk modtager. Rådata indeholder også forskel på stævn og agterende samt slutfart. [Eftermåling](efter/maaling.json)

| Sted | Lodret udsving, rolig → frisk | Pitchudsving, rolig → frisk | Største vandrette bølgekraft i frisk sø |
| --- | --- | --- | --- |
| Faaborg | ca. 0,01 → 0,50 m | 1,65 → 3,49° | ca. 1.276 N |
| Åbent vand | ca. 0,03 → 0,725 m | 2,17 → 5,72° | ca. 2.400 N |

I åben sø accelererede Laserjollen i omtrent ét sekund på en identificeret bølgeforside. Den samlede bølgekraft i bevægelsesretningen var cirka 36 N. Farten steg fra cirka 0,09 til 0,48 m/s, hvorefter jollen toppede ved 0,59 m/s og igen faldt til 0,07 m/s. Forløbet viser en kort acceleration i medsø. Længerevarende surfing ved bølgens fart på 3,45 m/s er fortsat udokumenteret. [Måling](../surf-bolgefront.json) · [Optagelse med accelereret testur](../surf-bolgefront.webm)

Ydelsen er målt over seks sekunder i standardkameraet med Turbåd 43 ved 1440 × 900 og høj grafik. I Chrome 157 på macOS med Apple M5 leverede begge målinger ca. 60 billeder/s. p95 var 16,7 ms før og 16,8 ms efter. Tegnekald pr. billede faldt fra 478 til 435 og trekanter fra cirka 178.000 til 175.000. Netværksbådenes detaljer opdateres sjældnere på afstand og i lav grafik. Seks aktive klienter med blandede bådtyper og genforbindelse er kontrolleret i særskilte multiplayerforløb. Ydelsestallene er fra én lokal båd. [Førmåling](foer/maaling.json) · [Eftermåling](efter/maaling.json)

Browserkontrollerne dækker alle fem både, kamera- og kortcyklus, paneler og fokus, opretning under fem aktive sekunder, CPU/GPU-bølgefelt og kystlæ, kraftrespons, forsejl og løbsbeskeder. En ældre tilskuertest forsøgte at trykke på den deaktiverede værtsknap. Den kontrollerer nu, at en gæst kan se løbet, deltager i næste løb og møder en korrekt låst knap. Surfprøven havde tidligere kurs ind mod land. Den starter nu i åbent vand og udelukker intervaller med kæntring eller bundkontakt.

Den brede browsertest bestod 72 af 75 kontroller. De tre fejl involverede et opslag i den gamle besætningsmodels lemmepositioner, en ekstra aflæsning af styreinput i seksklienttesten efter at betingelserne allerede var opfyldt, og et fast 500 ms triminput i genforbindelsestesten. De rettede kontroller bruger henholdsvis den riggede figurs faktiske knogler, de fem samtidige kommandoer sammen med alle bådenes observerede kursændringer og det trim, værtens fysik faktisk har registreret. Alle tre bestod den målrettede genkørsel sammen med de nye kontroller af aktiv styring ved kameraskift og kortbetjening ved forstørret tekst. Seksklient- og genforbindelsestesten bestod også med begge kørende parallelt. Produktionsbuildet og de ni Node-tests bestod.

## Afgrænsning og tidligere arbejde

- Besætningen er fortsat en modelleret spilbesætning. Lemmerne er animeret gennem den fysiske stilling og begrænsede ledbevægelser. Løsningen dokumenterer de afprøvede positionsskift, ikke en udtømmende kollisionskontrol mellem person, bom, dæk og personer ved alle manøvrer. Ansigter og omgivelser er stadig stiliserede.
- Farvande og kyster er modelleret til spillet. Energien og dæmpningen fra de valgte bølger kan måles i spillet, men bølgeskum, skrogkontakt og surfing er tilnærmelser. Bådene har ikke validerede fartpolarer.
- Baneeditorens geometri og grundvalidering har egne tests. Editorens brugerflade og vejledning er fortsat udestående.
- Den tidligere fysikopgave har en eksperimentel planingstilnærmelse og to særskilte rorpunkter på Racer 32. Den fulde rotation omkring et flyttende tyngdepunkt samt ligevægtsfart og manøvrekalibrering er fortsat åbne. [Fysikoversigt](../fysik/README.md)
- Turbådens hvide Code 0 og spileren er fortsat to forskellige sejl med egne anvendelsesområder. Browserprøverne bekræfter hvid dug, skift af vindside, visning af de relevante knapper og egne sejlkræfter. Sejlene bruger spilkoefficienter og tilnærmet form og lineføring.
