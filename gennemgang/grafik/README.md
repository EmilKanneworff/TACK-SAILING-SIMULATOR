# Besætning, vandkontakt og omgivelser

Den kørende udgave har revision `05a743a7679e`. Vælg **Fri sejlads**. Brug **Både** og **Kamera** i højremenuen til at skifte båd og vinkel. Bølgeprøven starter Fri sejlads i Turbåd 43's cockpit i frisk sø. [Åbn FRI VIND](http://localhost:5173/) · [Åbn bølgeprøven](http://localhost:5173/?proeve=boelger)

## Billeder og bevægelse i spillet

| Forløb | Godkendt udgangspunkt | Efter integration |
| --- | --- | --- |
| Laserjolle gennem en vending og position 1, 2 og 3 | [Nærbillede](foer/laser-naer.png) · [Klip](foer/laser.webm) | [Nærbillede](efter/laser-naer.png) · [Klip](efter/laser.webm) |
| Racer 32 med to sejlere ud i trapez og tilbage | [Nærbillede](foer/dinghy-naer.png) · [Klip](foer/dinghy.webm) | [Nærbillede](efter/dinghy-naer.png) · [Klip](efter/dinghy.webm) |
| Turbåd 43 i frisk sø med cockpitbesætning | [Billede](foer/yacht.png) · [Klip](foer/yacht.webm) | [Billede](efter/yacht.png) · [Klip](efter/yacht.webm) |
| AC72 fra vandkontakt til foiling | [Billede](foer/ac72.png) · [Klip](foer/ac72.webm) | [Billede](efter/ac72.png) · [Klip](efter/ac72.webm) |
| Seks aktive klienter med alle fem bådtyper | [Billede](foer/seks.png) · [Klip](foer/seks.webm) | [Billede](efter/seks.png) · [Klip](efter/seks.webm) |
| Faaborgs havnefront i lysere vejr | [Billede](foer/kyst-lys.png) | [Billede](efter/kyst-lys.png) |
| Faaborgs havnefront i overskyet vejr | [Billede](foer/kyst-overskyet.png) | [Billede](efter/kyst-overskyet.png) |

Førklippene bruger den godkendte revision `3077adbaf940`. Optagelserne kører i browseren med spillets almindelige kraftintegration. Hvert par bruger samme startpunkt, startfart, båd, input, vind, bølgeindstilling og kamera. Nærbillederne og seksbådsforløbet bruger faste måleperspektiver. Kystbillederne er fastholdt ved samme simulationstid med Playwrights ur. Kurser, stillinger, tidspunkter og udvalgte tilstande fremgår af målingerne. [Førmåling](foer/maaling.json) · [Eftermåling](efter/maaling.json)

## Ændringer i scenen

- MakeHuman-geometrien giver hoveder og bøjede greb med tydeligere menneskelig form. De originale skinnede dragter har formet vest, reflekser, stofnormalkort og flade støvlesåler. Bådenes besætninger deler geometri og teksturer. Hver figur har egne knogler og egen stilling.
- Store vægtflytninger kommer fra samme hofte- og sædeplacering som fysikken. Under et sideskift løfter fødderne skiftevis og Laserens rorpindsforlænger får plads til et slip og et nyt greb. Overkroppen reagerer afdæmpet på krængningshastighed, stævnens bevægelse og acceleration. Ror, skøde og spilerhejs styrer de relevante arbejdsbevægelser.
- To fødder støtter nær Racer 32's kant ved fuldt trapez. Linjerne forbinder mastens fastgørelser med hver sejlers sele. Turbådens rorgænger og trimmer følger rat og skøde ved deres arbejdsområder. Foilbådenes besætninger bliver ved stationerne og giver efter, når båden accelererer eller løfter sig.
- Paneler, sømme og dæmpet vævning kan ses i sejlene. Blafren følger det beregnede løft, fyld og aflastning. Træ på moler og cockpitbænke er lagt i meterskala. Gelcoat, metal, gummi, sejldug og dragt har separate overfladeegenskaber.
- Panoramaerne bruges i himlen og vandrefleksionerne. Miljølyset på bådene skifter mellem to refleksionskort, mens overgangen på himmel og vand er gradvis. Kystens sand, græs, jord og sten glider over i hinanden. Det våde bælte er mørkere, og havnefronten har varierede facader, rammer, moler og pullerter. Grupper af træer og kyststen deler geometri og følger de eksisterende terrænhøjder.
- Kølvand ligger langs bådens sejlede spor med forskellig bredde og styrke for skrog og foils. Skum brydes op og fades ved kanterne. Kontaktbåndet følger en målt skæring mellem skrog og samme bølgefelt som rendering og fysik. Når en foil stikker gennem vandet, starter dens skumspor ved den beregnede overfladekontakt. Sprøjt ved slag følger relativ bevægelse og falder som dråber.

Ressourcerne indlæses lokalt. Kilde, licens, optimering og filnavne står i [ASSETS.md](../../ASSETS.md).

## Målt ydelse

Chrome 157 på en Apple M5 med macOS 26.3 og vindue på 1440 × 900. Browseren målte intervaller mellem animerede billeder over 4,5 sekunder under sejlads. Turbåd 43 sejlede alene på høj grafik i frisk sø. Seks forskellige browserklienter sejlede over den lokale live-tjeneste på lav grafik med alle seks både i værtsklientens billede. Før og efter bruger samme opsætning inden for hver måling.

| Måling | Før | Efter |
| --- | ---: | ---: |
| Én båd, billeder/s | 60,0 | 60,0 |
| Én båd, p95 billedtid | 16,7 ms | 16,7 ms |
| Én båd, tegnekald i slutbilledet | 393 | 504 |
| Én båd, trekanter i slutbilledet | 172.918 | 167.344 |
| Fra navigation til startknappen var klar, median af fire åbninger | 0,54 s | 0,82 s |
| Seks synlige både, billeder/s | 53,4 | 59,6 |
| Seks synlige både, p95 billedtid | 33,3 ms | 16,8 ms |
| Seks synlige både, tegnekald i slutbilledet | 1.377 | 1.088 |
| Seks synlige både, trekanter i slutbilledet | 394.318 | 320.483 |
| Seks klienter fra første navigation til de var med i sejladsen | 6,08 s | 7,15 s |

De nye teksturer og den indlejrede model fylder tilsammen ca. 426 KiB før HTTP-komprimering. Tiden til startknappen omfatter afkodning og klargøring før bådvalget. Tiden for seks klienter omfatter åbning af browserklienterne én ad gangen, lobby og opstart af fælles sejlads. Tallene er lokale målinger, og ydelsen kan variere med hardware og browser.

## Kontrol i sejlads

Laserklippet registrerede én vending. Racer 32 nåede stilling 2,97 af 3 med begge besætningsmedlemmer ude og gik derefter tilbage mod kanten. AC72 passerede fra delvis vandkontakt til løft og stabil foiling. I en separat otte sekunders test med én bølgekomponent bevægede Turbåd 43 sig 0,52–0,60 m op og ned i mod-, tværs- og medsø. Stævnens vinkel varierede ca. fire grader i mod- og medsø og 0,23 grader i tværsø. Alle tre forløb tegnede kontaktskum og kølvand.

`npm run build` gennemført. Alle 9 server- og geometriprøver og 51 udvalgte browsertests bestod, herunder seks aktive klienter, de fem bådtyper, kamerastyring, kortets navne, trim, vindstyring, opretning og overensstemmelse mellem vandets shader og bølgefysikken.

## Afgrænsning

Bryst, arme og ben bruger spillets tilpassede dragt og skelet. MakeHuman-delen omfatter hoved og greb. Kontakt løses med kendte punkter og begrænset rækkevidde, så der kan være overlap mellem tøj, liner og bådens udstyr i yderstillinger. Laserforløbet rammer høj krængning efter udhængningen ved den valgte kombination af vind og vægt. Kysten er den komprimerede, håndtegnede udgave af Sydfyn.
