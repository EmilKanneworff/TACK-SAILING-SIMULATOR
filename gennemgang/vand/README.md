# Vand, bølger og skrogkontakt i FRI VIND

[Åbn bølgeprøven med Laserjolle](http://localhost:5173/?proeve=boelger&baad=laser) · [Åbn bølgeprøven med Turbåd 43](http://localhost:5173/?proeve=boelger) · [Vis fysikkens vandpunkter](http://localhost:5173/?proeve=boelger&vandproever=1)

[Seneste vandkontakt med før- og efterklip](vandkontakt/README.md) viser lokale stævnbølger, kølvand fra den sejlede rute, skumsprøjt og bådspejling.

## Hækbølge og kølvand

[Laserjolle før og efter](haekboelge/laser-foer-og-efter.jpg) · [Kølvandet i bevægelse](haekboelge/laser-foer-og-efter.mp4). Før er til venstre. Klippet bruger følgekameraet med skjult HUD og skjulte vindpile, så hækbølgen kan sammenlignes under samme sejladsforløb. Billedet er taget ved 4,3 knob. Fart, position, kurs, krængning og neddykket volumen var ens ved alle 11 sammenlignede tidspunkter.

En krum bølgekam og en bølgedal former nu vandet umiddelbart agten for de våde skrog. Højden følger det neddykkede volumen og den lokale fart gennem vandet. Tidligere kamme dannes langs den sejlede rute og breder sig ud til siderne, mens den lyse, luftfyldte del af kølvandet spredes og opløses. Formen er en grafisk tilnærmelse baseret på tværgående og skråt udbredende bølger. [Journal of Fluid Mechanics om kølvandsbølger](https://www.cambridge.org/core/journals/journal-of-fluid-mechanics/article/an-earthfixed-observer-to-ship-waves/255AFBB3B7E155957B177BDD84C32ACF).

## Vand og lys efter skærmoptagelsen

Laserjollen er sammenlignet før og efter med samme startpunkt, sidekamera, grundvind på 6,2 m/s og bølgehøjde på 0,82 m i åbent vand. Bølgefeltet har flere fysiske bølgelængder på 4–9,4 m oven på den lange sø. De korte krusninger vandrer med bølgefeltet og vinden og bryder himmelrefleksionen op. Stævnens sprøjt dannes ved vandkontakt, og dråberne forsvinder ved den fælles vandhøjde. I de første 1,5 sekunder af prøven steg det maksimale antal aktive dråber fra 46 til 91. Himlen og vandet læser samme fotograferede panorama. [Poly Haven · Sunflowers (Pure Sky)](https://polyhaven.com/a/sunflowers_puresky)

- [Før fra siden](overflade/foer-side.png) · [Efter fra siden](overflade/efter-side.png).
- [Før fra cockpit](overflade/foer-cockpit.png) · [Efter fra cockpit](overflade/efter-cockpit.png).
- [Sejlads med det nye vand](overflade/sejlads.mp4) · [Vandet i modlys](overflade/modlys.png) · [Førmåling](overflade/foer.json) · [Eftermåling](overflade/efter.json).

## Kontrol af bølgefronterne i den tidligere revision

Én hovedkomponent på 27 m og fire ledsagere danner bølgegrupper med små variationer langs kammene. Hovedfamilien har bølgelængder på 22,5–34 m ved standardperioden. Den står for 85,9 % af den beregnede højdevarians på åbent vand ved 8,5–20 m/s med standardindstillingen for kort sø. Energien er beregnet fra amplitudernes kvadrater. Alle fem komponenter holder sig inden for ±5° af hovedretningen.

Grafikken og fysikken bruger samme fase i verdenskoordinater. Vandgitteret tilpasser detaljegraden efter trekantens størrelse langs den enkelte bølges retning. Fine krusninger bidrager mindre til himmelrefleksionen, og skumpolygonerne ligger langs de lokale kamme. Bølgefamilien bruger kystens afskærmning i sin hovedretning. De korte vindlæzoner virker fortsat på sejl og krusninger.

- [Fast kamera med markeret kam, retningspil og gitter](boelgefronter/fast-kamera.mp4) · [Stillbillede](boelgefronter/fast-kamera.png).
- [Sejlads med fuldt vandmateriale og skum](boelgefronter/sejlads.mp4) · [Stillbillede](boelgefronter/sejlads.png).
- [Måledata](boelgefronter/maaling.json). Ved standardperioden passerer toppen to prøvepunkter med 6 m afstand i bølgeretningen med 0,92 s forskel. En isoleret kam passerer prøvepunkter på tværs samtidig.

Kameraet og startpunktet er de samme i begge 8-sekunders klip. Vinden er 20 m/s fra vest, og bølgeindstillingen er på maksimum, så også skummet kan ses. Den markerede kam passerer båden efter knap fire sekunder og rykker i alt 47,7 m. Linjen følger den lokale top over 48 m på tværs. I sejlklippet flytter båden sig 34,2 m, og dens stævn har et vinkeludsving på 10,1° mellem de målte yderpunkter.

## Før og efter

De følgende sammenligninger, klip og ydelsestal dokumenterer den tidligere vandrevision `8db8a365a640`.

Lagene er optaget med Turbåd 43 i **Følge**, spillets standardkamera. Billederne bruger samme simulerede tid på 8,75 s, position, lys, kurs og 12,1 m/s vind fra vest. Vedhæftningen angiver vindstyrken i skærmbilledet. De øvrige parametre er fastlagt til en gentagelig scene i spillets **Frisk sø**. [Førdata](foer/lag.json) · [Efterdata](efter/lag.json)

| Lag | Før | Efter |
| --- | --- | --- |
| Samlet vand | [Se billede](foer/samlet.png) | [Se billede](efter/samlet.png) |
| Geometri med neutralt materiale | [Se billede](foer/geometri.png) | [Se billede](efter/geometri.png) |
| Overfladenormaler | [Se billede](foer/normaler.png) | [Se billede](efter/normaler.png) |
| Himmelrefleksion og solglimt | [Se billede](foer/refleksion.png) | [Se billede](efter/refleksion.png) |
| Skum alene på vandet | [Se billede](foer/skum.png) | [Se billede](efter/skum.png) |
| Roligt vand og vindkrusninger | [Se billede](foer/roligt.png) | [Se billede](efter/roligt.png) |
| Moderat sø | [Se billede](foer/moderat.png) | [Se billede](efter/moderat.png) |

Den gamle **refleksionsvisning** gengiver hovedparten af de lyse folder. Korte optiske normalvariationer forvrængede himlen, og områder omkring horisonten skiftede hurtigt mellem kraftig refleksion og mørke dale. Refleksionsbidrag fra både den indlæste himmel og de beregnede skyer forstærkede billedet. Hvide skumpletter blev tegnet direkte på mange af de samme toppe. I **geometrivisningen** kunne man se dele af trekantgitteret i mellemafstanden. Overfladen bruger én højde pr. vandret position, så meshens bølgebevægelse har ingen vandret foldning.

De mindste krusninger har nu svagere optiske normaler. Himmelpanoramaet læses med blødere detaljer, og refleksionsstyrken ændrer sig jævnere mellem dale og toppe. Lavvandet får farve fra samme dybdefelt som bølgerne. Vandets shader konverterer farve ved udgangen, mens dybdeteksturen læses som data. Gitteret prøver tættere i mellemafstanden og filtrerer komponenter, når deres bølgelængde nærmer sig trekantstørrelsen. Tæt ved båden bruges hele feltet.

## Bølgeform, kyst og skum

- Tre dønninger og syv vindbølger beregnes i verdenskoordinater. Vindbølgelængderne er 3,25–16,4 m. De korteste komponenter har mindre amplitude, mens de længere får lov at fremstå som sammenhængende toppe. Retning, fase og periode varierer mellem komponenterne og skaber bølgegrupper.
- Hver komponent har fast fasefart `ω/k` for den valgte profil. Vandpartikler har den lokale orbitalhastighed, som aftager med dybden. De fine krusninger påvirker kun lyset.
- Vindlæ, fri vandstrækning for vindsø og retningsbestemt læ for dønning er særskilte felter. Et fælles dybdegitter dæmper dønninger under 2,4 m og vindsø under 1,4 m og fører den beregnede amplitude til nul ved vandlinjen. Normalen medregner hældningen fra dæmpningen, og vandhastighederne bruger den dæmpede amplitude. Modellen bevarer dybvandsfasen ind mod kysten og tilnærmer bølgebrud med lokale dybde- og hældningstærskler. Ved moler gælder områdets dybde og kystafskærmning. [FEMA om bølgeforandringer i lavt vand](https://www.fema.gov/sites/default/files/2020-02/Determination_Of_Wave_Characteristics_Guidance_Feb_2019.pdf)
- Ændringer af vinden filtreres over tid, så vindsøens energi når at bygge op og aftage. Vindlæets grænse på normalt 50 m og højst 75 m styrer sejlets lokale vind. Vindsø og indkommende dønning bruger hver deres kyst- og bølgefelt på begge sider af den grænse.
- Skum dannes i lokale pletter ved tilstrækkelig krumning og overfladehældning samt ved lavvandsbrud. Pletterne driver svagt og fader over 1,6–3,8 s. Hvidt kølvand og sprøjt fra båden tegnes separat. [Målinger af skum efter bølgebrud](https://agupubs.onlinelibrary.wiley.com/doi/10.1029/2023JC020193)

## Sejlads og kontrolpunkter

| Forløb | Optagelse |
| --- | --- |
| Turbåd 43 mod bølgerne | [Modsø](efter/modsoe.webm) |
| Turbåd 43 på tværs | [Tværsø](efter/tvaerssoe.webm) |
| Turbåd 43 med bølgerne | [Medsø](efter/medsoe.webm) |
| Faste målepunkter og skift fra Følge til Overblik | [Bølger i verdenskoordinater](efter/verdenskoordinater.webm) · [Kontrolbillede](efter/vandproever.png) |
| Sejlads fra beskyttet mod mere åbent vand ved Faaborg | [Kystforløb](efter/fra-kysten.webm) · [Start](efter/kyst-naer.png) · [Slut](efter/kyst-ude.png) |

De grønne punkter markerer fysikkens højde ved faste verdenspositioner, med 3,3 cm visuel afstand til fladen. Punkter og shader bruger samme simulationstid og kystfelt. CPU- og GPU-prøver køres både offshore og i lavt kystvand. [Målinger fra sejladsen](efter/sejlads.json)

Skrogets neddykkede volumen bestemmer opdrift og moment. Seks vægtede modstandspunkter på jolle og kølbåd bruger både skrogets translation og rotation relativt til det lokale vand. Den samme indfaldende bølgetryktilnærmelse driver bølgepåvirkning i mod- og medsø. Stævnsprøjt, støj og slagtryk følger indtrængning ved ny vandkontakt. Foilbådene beholder deres slagtryk over de faktiske neddykkede skrogflader og foilernes dybdeafhængige løft. Bådenes positioner udvikler sig gennem kræfterne.

Stævnens vinkeludsving i de tre optagelser var 10,1° i modsø, 7,1° i tværsø og 2,1° i medsø. Målingen er forskellen mellem højeste og laveste prøvede vinkel i hvert klip. I kystforløbet sejlede båden 54,5 m fra startpunktet og gik fra en lokal dybde på 5,2 m til 10,2 m uden grundberøring.

I en separat kontrol med én bølgekomponent accelererede en Laserjolle fra 3,01 til 3,36 m/s på bølgens forside og faldt tilbage til ca. 3,22 m/s efter toppen. De automatiske kontroller dækker også de fem bådtypers stabilitet og opretning i bølger, vandlinjen ved lavvandsdybder samt sprøjt ved dokumenteret stævnkontakt.

## Ydelse

Målt i Chrome 157 på Apple M5 med 1.440 × 900 px og 4,5 sekunders måling pr. scene. Enkeltbåden var Turbåd 43 i høj grafikkvalitet med 9 m/s og Frisk sø. Seks både med besætninger kørte via seks lokale multiplayerklienter i lav grafikkvalitet med 8 m/s og en lav bølgeindstilling på 0,16. Alle seks var synlige fra den samme oversigtsvinkel i begge versioner. Tallene gælder de to konkrete scener.

| Scene | Billeder/s før → efter | 95-percentil for billedtid | Renderede trekanter før → efter |
| --- | ---: | ---: | ---: |
| Én båd | 60,0 → 60,0 | 16,7 → 16,8 ms | 173.480 → 171.046 |
| Seks både | 53,8 → 56,5 | 33,3 → 16,8 ms | 326.707 → 324.403 |

[Måledata før](foer/maaling.json) · [Måledata efter](efter/maaling.json) · [Seks både før](foer/seks.webm) · [Seks både efter](efter/seks.webm)

42 browserkontroller og 11 Node-tests bestod. Frontend-buildet bestod. Den kørende bølgeprøve blev også kontrolleret i Chrome med et gitter på 25 målepunkter og med vindskyderen på 20 m/s, som både fysikken og vandmaterialet modtog.
