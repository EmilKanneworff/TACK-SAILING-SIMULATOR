# FRI VIND · aflevering

Spil på [localhost:5173](http://localhost:5173/), eller prøv [produktionsbuildet på localhost:4173](http://localhost:4173/). Begge bruger den lokale live-tjeneste på port 3001. Se [start og drift](../../README.md#kør-lokalt).

## Implementeret

- Skrog, sværd, ror og foils bruger vandets bevægelse relativt til deres placering på den roterende båd. Sejlene bruger den lokale luft ved deres angrebspunkter. Svagere vind i læ påvirker kræfterne og vindpilene. Vandoverfladens højde, hældning og bevægelse deles mellem fysikken og grafikken. Lokalt kølvand og sprøjt aflæser kontakten med vandet.
- Vindretning vises som retningen **fra** i instrumentet og med vindpile, der glider **mod** den retning, luften bevæger sig. Pilene er slået til som standard og har én personlig indstilling. Vindstyrken kan vælges op til 20 m/s. Opbygningen af vindsø kræver længere fri vandstrækning end vindfeltet, så vinden kan være tilbage, mens bølgerne stadig er små. [Målinger af læ og vindsø](../lae/README.md#bølgelæ-og-åbent-vand).
- Baneeditoren begynder med referencevind. På søkortet kan spilleren placere alle mærker selv eller redigere et forslag fra den valgte standardbane, inklusive linjeender, rundingsside, gatepar og rækkefølge. Editorens råd dækker baneben, startlinjens bredde og favoriserede ende. Kort, 3D og kapsejlads bruger den gemte model. Vindskift flytter ingen bøjer. En bevidst rotation kan vises og fortrydes. Banebibliotek, import og eksport ligger i browseren.
- Værten lægger feltet ud bag startlinjen og fastlægger fælles vejr, bevægelse og resultater. Værtens pauser stopper løbsuret. Gæsten sender egne styreinput og kan ændre personlig grafik, kort, kamera og vindpile uden at ændre værtens fysik.

## De fem både

| Båd | Sejlklar masse | Beregnet vandlinje i hvile | Arbejdssejl | Særlige egenskaber |
|---|---:|---:|---:|---|
| Laserjolle | 137 kg | 3,56 m | 7,06 m² | Én person, sværd og stor relativ virkning af vægtflytning |
| Racer 32 | 2.600 kg | 8,85 m | 62 m² | To personer à 80 kg, trapez og uafhængig neddykning ved de to ror |
| Turbåd 43 | 9.600 kg | 12,26 m | 80 m² | Ballastkøl, fire personer, hvid Code 0 og særskilt spiler |
| Foilmonohull | 6.900 kg | 16,25 m | 230 m² | Foilarme, flaps og ændret rorrespons med løft |
| Foilkatamaran | 6.900 kg | 20,24 m | 260 m² | To skrog, stiv vinge, fok og særskilte ror og foils |

[Profiler med massepunkter, lasttilstand, inerti, rig, undervandsdele og aktuatorer](../fysik/baadprofiler.json). [Fysikmodel og målgrundlag](../fysik/README.md).

Styrehjælpen omsætter piletaster til ønsket drejehastighed. Roret og et begrænset hjælpemoment udfører drejningen, også når vandstrømmen ved roret er lille. Position 2 hjælper med vægtflytning, mens position 3 beholder sin side ved vending på de konventionelle både. Foilernes automatiske aktuatorer regulerer løft og deres besætning arbejder inden for modellens stationer. Opretning er en spilassistance, der aflaster riggen, genskaber stabil flydestilling og ved behov søger frit vand. Parametrene står i profilerne og spillets udviklervisning.

## Afprøvet

- Alle fem både opfyldte opdrift mod vægt i den beregnede hviletilstand inden for 0,001 N. Masse og inertibidrag blev kontrolleret under vægtflytning. En strøm på 3 m/s gav 3 m/s over grunden og 0 m/s gennem vandet, når båd og vand bevægede sig sammen. De 100 kalibreringsforløb sluttede uden ugyldige værdier eller kæntring.
- Alle fem både gennemførte stagvending og bomning ved 5,5 m/s med ror- og triminput. Sejlene skiftede side, og bådene genvandt fremdrift. Fysik- og rigforløb med samme tidsbestemte input gav samme sluttilstand ved 30, 60 og 120 billeder pr. sekund.
- Browserprøver fremprovokerede kæntring og gennemførte automatisk opretning for alle fem både efter 3,12–4,41 aktive sekunder. Klippet viser et konkret Laserforløb. Vægtflytning, bølger og foilmonohullens overgang fra skrogkontakt til flyvning og tilbage er optaget i sejladsvisningen.
- Syv komplette prøver med tre bådtyper brugte almindelige ror- og trimkommandoer gennem fysikken ved 7 m/s vind fra nord og roligt vand. Baneregistreringen målte start, mærker og mål, uden grundstødning eller redning i disse prøver. Separate prøver kontrollerer fejlpassager og de alternative gates. [Dansk Sejlunions banetyper](https://dansksejlunion.dk/kapsejlads/information-om-maerkebaade/kapsejladsbanen).

| Bane | Båd | Tid fra start | Passager inkl. mål |
|---|---|---:|---:|
| Op/ned kort | Laserjolle | 12:16,2 | 6 |
| Op/ned lang | Laserjolle | 18:34,6 | 9 |
| Trekant kort | Laserjolle | 9:07,7 | 4 |
| Trekant lang | Laserjolle | 13:27,5 | 6 |
| Trekant kort | Racer 32 | 17:44,7 | 4 |
| Trekant kort | Turbåd 43 | 27:09,8 | 4 |
| Brugerbane rundt om Bjørnø | Laserjolle | 9:44,5 | 6 |

Seks separate browserklienter tilsluttede sig et fælles **Trekant kort**-løb via WebSocket på produktionsfrontenden. Værtens normale fysiktrin beregnede seks Laserjoller fra før startsignalet til mål. Alle seks klienter modtog samme resultatliste, med tider fra **10:13,7 til 15:34,3**. Testen kørte med fremskyndet tid og automatiske styreinput hos værten. Klienternes egne ror- og triminput, forskellige rigtyper, genforbindelse og 150 ms rundtur blev kontrolleret særskilt med den lokale live-tjeneste. En anden produktionstest gemte en brugerbane, startede den med to klienter og bekræftede, at en gæsts private kladde ikke ændrede den fælles bane. [Forløbsdata](forloeb.json) · [100 kalibreringspunkter](../fysik/kalibrering.json).

Alle 19 Node-prøver bestod. Af de 98 browserprøver bestod 96 første gang. De to flerklientprøver, der havde timeout under parallel kørsel, bestod ved gentagelse og ved en separat sekventiel kørsel. Den dokumenterede standardkommando kører nu én testarbejder ad gangen.

## Klip og sammenlignelige billeder

[Klip fra sejladsvisningen, 43 sekunder](manoeuvrer.mp4) · [Data fra optagelsen](manoeuvrer.json) · [Baneeditor](baneeditor.jpg) · [Sammenligning af hækbølgen](../vand/haekboelge/laser-foer-og-efter.mp4).

| Forløb | Før manøvren | Efter manøvren |
|---|---|---|
| Vægt fra cockpit til luv | [Før](vaegt-start.jpg) | [Efter](vaegt-slut.jpg) |
| Stagvending | [Før](stagvending-start.jpg) | [Efter](stagvending-slut.jpg) |
| Bomning | [Før](bomning-start.jpg) | [Efter](bomning-slut.jpg) |
| Passage af bølger | [Før](boelger-start.jpg) | [Efter](boelger-slut.jpg) |
| Foilforløb med løft og landing | [Før](foil-start.jpg) | [Efter](foil-slut.jpg) |
| Automatisk opretning | [Før](opretning-start.jpg) | [Efter](opretning-slut.jpg) |

## Brugerflade

Kortets tre størrelser, lodret menu, instrumentbjælke og scroll i vejrmenuen er kontrolleret ved 1366 × 768, 1920 × 1080, 390 × 844 og ved 200 % browserzoom. Escape lukker dialogen og giver fokus tilbage til dens knap. [Spillevisning](brugerflade/hovedskaerm-1366x768.jpg) · [Mobil](brugerflade/kort-mobil-lille.jpg) · [Vejrmenu ved 200 % zoom](brugerflade/vejr-zoom-200-nederst.jpg) · [Layoutmålinger](brugerflade/layout.json).

## Billedtid

Målt på Apple M5 med Chrome 157, 1440 × 900 og lav grafik i produktionsbuildet. Værten beregnede seks både i alle fire intervaller på 4,5 sekunder. Fem gæster var tilsluttet med deres egen rendering sat i bero, så målingen isolerer værtens visning. Kamera, vejr og synsvinkel var de samme.

| Synlige både | FPS, to intervaller | 95-percentil for billedtid | 95-percentil for CPU-tid til renderkald |
|---|---:|---:|---:|
| 1 | 60,0 og 60,0 | 16,8 og 16,7 ms | 1,2 og 1,2 ms |
| 6 | 60,0 og 60,0 | 16,7 og 16,7 ms | 3,6 og 4,2 ms |

Flere både øgede renderarbejdet fra 123 til 1.090 tegnekald. Billedtiden holdt sig omkring 16,7 ms ved begge belastninger i denne opsætning. Seks separate browseres samtidige rendering på samme maskine gav større udsving. [Rå måling](efter/maaling.json) · [Én synlig båd](efter/en-synlig.png) · [Seks synlige både](efter/seks.png) · [Klip af seks blandede rigs](efter/seks.webm).

## Afgrænsning

Bådprofilerne beskriver spillets aktuelle model. Rotation beregnes omkring skrogets referencepunkt med diagonal inerti og bidrag fra bevægelige massepunkter. Planing, skrogmodstand, foilregulering og aerodynamik bruger reducerede modeller og spilkalibrering. Prøverne dækker valgte vejrforhold og trim. Sammenligning med målte polarer og fulde stabilitetskurver er ikke udført.

Baneeditoren kontrollerer vand ved mærker, linjer og start. Råd ved et lige baneben hen over land kan hjælpe planlægningen. Alle mulige selvbyggede ruter er ikke gennemsejlet. Deltagerne deler den valgte bane fra nedtællingen. Det komplette seksbådsløb brugte Laserjoller. Seks blandede både er kontrolleret i fælles fri sejlads.

Multiplayer er afprøvet lokalt i Chrome. Der foreligger ikke en offentlig installation, en måling for længerevarende pakketab eller et manuelt internetløb med seks mennesker.
