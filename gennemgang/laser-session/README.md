# TACK · Stagvending og rorgreb i Laserjollen

## Rorgreb i vindstød

I build `5490e0ae7507` sidder Laserjollens rorblad bag agterspejlet. Den tidligere placering gik ind i skroget, og bladet mistede for tidligt kontakten med vandet, når båden krængede og hækken løftede sig. Det nominelle bladareal er 0,105 m². Det tegnede blad og fysikkens vandprøver bruger samme profil. [Prøv den lokale version](http://localhost:5173/)

Optagelsen sammenligner Fri sejlads på Svær før og efter rettelsen. Begge starter på kurs 060° med 3,4 m/s gennem vandet og 70 % skøde på fladt vand. Nordenvinden sættes fra 10 til 12 m/s efter ét sekund og tilbage til 10 m/s efter tre. Efter to sekunder giver spilleren styrbords ror, går fra position 2 til 3 i luv og slækker skødet i 0,34 sekunder. [Se manøvren side om side](ror-i-vindstoed.mp4)

| Måling i optagelsen | Før (`55e96ec`) | Efter |
|---|---:|---:|
| Kurs efter tre sekunder | 013° | 038° |
| Kurs efter fem sekunder | 043° | 064° |
| Fart gennem vandet efter fem sekunder | 4,4 knob | 7,3 knob |

Den spejlede browserprøve i `tests/difficulty.test.js` kontrollerer rorudslag, vådt blad og afslag på begge halser med almindelige tastetryk. Starttilstanden er sat for at gøre sammenligningen gentagelig. Prøven måler spillets opførsel. De to skærmoptagelser fra spilleren indeholder ingen log over tastetryk eller kræfter, og prøven er derfor en rekonstruktion.

## Tidligere målinger af stagvending og ror

De følgende målinger hører til build `ce403d458ca7`. Før/efter bruger de lokale kildeversioner `919c6440ddf4` og `1ee6b006d9a9`, med Git-revision `7ad0ecc` som grundlag.

## Hvad blev rettet

Laserjollens rorblade integreres over den del af den tegnede rorprofil, der er under vand. Prøverne medtager nu også rorbladets egen bevægelse, mens det drejer om hængslet. Strømmen ved et punkt på bladet afhænger af jollens fart, rulning, stampning og drejning, den lokale vandbevægelse og bladets faktiske vinkelhastighed. Vinkelhastigheden måles mellem de to fysiske trin. Samme neddykkede areal og planform bruges til at beregne kraft og moment.

En isoleret prøve holder skroget i ro på fladt vand og roret på 12°. Før gav en bladhastighed på ±1,5 rad/s strøm og moment lig nul. Efter giver det yderste våde prøvepunkt en tværhastighed på ±0,194 m/s. Det samlede rormoment er ±3,24 Nm, og retningen spejles, når bevægelsen vendes. Med bladet stille er momentet 0. Prøven kontrollerer geometrien med en numerisk afledt af bladets placering. [Fossens skibsmodel](https://www.fossen.biz/html/marineCraftModel.html)

Udviklervisningen åbnes med backtick-tasten eller **Detaljer → Model & beregninger → Koefficientkurver & kontrolscenarier → Åbn debugvisning**. Den viser nu input, bestilt og faktisk rorvinkel, bladets vinkelhastighed, relativ strøm, vådt areal og momenter om det samlede tyngdepunkt. Laserjollens to uldtråde ved hvert sejlpunkt tegnes på hver sin side af dugen. Vedhæftet strømning følger sejlets lokale profil. Urolig strømning giver tydeligere bevægelse. Indikationen bruger modellens lokale vind, luffen og stall. [North Sails · kryds og trim](https://www.northsails.com/en-us/blogs/north-sails-blog/steering-upwind)

## Vending med de almindelige kontroller

Fri sejlads på Svær, Følg-kamera, vand med 7,5 m/s fra nord, 0,35 m dønning, 16 % Chop og ingen pust eller læ. Start på kurs ±49° fra vinden, 3 m/s og 73 % skøde. Prøven vælger 56 % skøde og position 1 ved 1,50 s, giver ror ved 2,33 s, vælger ny side med Q/E og position 2 omkring 3,9 s og haler ind til 68 % omkring 4,7 s. De efterfølgende rortryk modvirker overdrejning. Starten er sat som testforudsætning. Derefter styrer browseren via den almindelige skyder og tastaturet. Samme kommandoer genafspilles ved samme faste trin. Instrumenterne skjules efter ca. 7,5 s, så det gamle og det nye kølspor kan ses.

| Besætningen flytter til | Før, start → laveste → slut | Efter, start → laveste → slut |
|---|---:|---:|
| Styrbord | 5,58 → 3,93 → 5,81 kn | 5,58 → 3,98 → 5,83 kn |
| Bagbord | 5,62 → 4,15 → 5,77 kn | 5,62 → 4,19 → 5,79 kn |

Begge versioner gennemførte én stagvending på hver halse uden kæntring eller grundkontakt. På den første vending gik sejlets fremadkraft i efterprøven fra ca. 104 N før slæk til −18 N ved begyndelsen af drejningen, hvor sejlet luffede. Da sejleren passerede centerlinjen, lå de to spor forskelligt ved agterhjørnerne, og et kort vandindslag gav sprøjt. Efter indhaling på den nye halse målte sejlet ca. 47 N fremad ved 7,1 s. Grafikken interpolerer mellem simulationstrin. Derfor kan den tegnede besætning være op til ca. 6 cm fra det seneste 60 Hz-målepunkt, mens den følger samme fysiske overgang. [Vending med skift til styrbord](til-styrbord.mp4) · [Vending med skift til bagbord](til-bagbord.mp4) · [Log styrbord](til-styrbord.json.gz) · [Log bagbord](til-bagbord.json.gz)

## Øvrige kontrolprøver

| Prøve | Resultat |
|---|---|
| Ror begge veje ved 0, 1,2 og 3,8 m/s i stille vand | Roret når ca. 28°, 27° og 24° ved de tre begyndelsesfarter. Efter rortryk og frigivelse ændres kursen henholdsvis 0,09°, ca. 19° og ca. 49° i den valgte retning. |
| Afslag ved 16,8 m/s med to reb | Med fastholdt skøde og ca. 22° ror drejer båden først godt 5°. Ved 1,15 s er ca. 10 % af bladet vådt, og kursændringen er tilbage på ca. 2,6°. Efter fuldt slæk når afvigelsen fra startkursen 32–33°. Fortsat belastning kan kæntre jollen. Ingen drejehjælp i kraftregnskabet. |
| Slæk og indhaling ved fast kurs på begge halser | Fra 72 % til 0 % åbner bommen fra ca. 20° til 39–40° på kryds og 74° på halvvind. På læns kan den åbne til den mekaniske grænse ved 86° og fortsat trække, ca. 157 N i det målte punkt. Efter indhaling vender bommen tilbage. |
| Vægt på stille vand | Massen er 143 kg gennem hele prøven. Fra position 1 til 3 flyttede bådens samlede tyngdepunkt sig ca. 31 cm sideværts. Med vægten fremme endte tyngdepunktet 22,6 cm foran neutral og stævnen ca. 0,57° nedad. Med vægten agter endte det 22,6 cm bag neutral og stævnen ca. 0,77° opad. |
| Vindpust og aktivt slæk | En valgt puls fra 6 til 9 m/s giver op til 8,03 m/s lokal anvendt vind under opbygningen. Jollen når ca. 26° maksimal krængning. Prøven logger vind, skødevandring og kurs, mens spilleren slækker og korrigerer med roret. |
| Passiv afdrift | Fart gennem vandet falder fra 2,74 til 0,29 m/s over 105 s. Den målte sidefart går fra ca. 0,52 m/s til under 0,01 m/s. Ror, sværd og planingsmodel har intet positivt arbejde i de målte punkter. Det er en henfaldsprøve og en kontrol af dissipative led. En total energibalance ville også kræve potentiel energi, rotationsenergi og den bevægede vandmasse. |
| Modsø, tværsø og medsø | Ved 0,65 m dønning i den valgte 10 s prøve var spændet i stampning ca. 3,7°, 0,2° og 4,8°. Tværsø havde mest rulning, ca. 4,9°. Højdemålingen tæt på skroget afveg højst 3,2 mm fra det tegnede vand i Lav og 1,3 mm i Høj, inden for testens prøvepunkter. [MIT · bølgers dispersion](https://web.mit.edu/fluids-modules/www/potential_flows/LecturesHTML/lec19/node5.html) |

Den ældre surfprøve målte kun 0,091 m/s acceleration før og efter rettelsen, fordi den arvede meterværdi og Chop fra spillet, men placerede båden efter det gamle bølgeformat. Den er rettet som test. Den vælger nu eksplicit 0,42 m dønning og 0 % Chop, bruger det aktive bølgetal og finder overgangen ud fra den integrerede bølgekraft. Farten går fra 2,97 til 3,26 m/s på forsiden og falder derefter til 3,07 m/s. Den særskilte medsøprøve måler 5,59 m/s på forsiden og 4,79 m/s på bagsiden under sine testforhold. Planingskraften omfordeler bevægelse i det lokale vand og udfører højst 0 W i de målte mod-, tvær- og medsøprøver. [Målinger for kontrolprøverne](fysiske-proever.json)

## Grafik og ydelse

Apple M5, Chrome 158 headless med ANGLE/Metal, viewport 1.280 × 800. To ca. fire sekunders prøver pr. grafikniveau og version. Fysikken for position, fart, vinkler, besætning, skøde, sejlkræfter og bølgekontakt gav identiske målepunkter under begge vendinger på Lav og Høj. Testen bruger den almindelige browserkørsel med en styret klokke for optagelserne. Billedtid og tastelatenstid måles særskilt med browserens normale klokke.

| Grafik | Tegnet opløsning | P95 mellem renderkald før → efter | Tast til målt ror- eller skødeændring efter |
|---|---:|---:|---:|
| Høj | 1.280 × 800 | 17,6 → 17,6–18,0 ms | 6–31 ms |
| Lav | 789 × 493 | 17,6–18,3 → 17,4–17,5 ms | 4–32 ms |

Alle 48 tastetryk blev registreret. Rest i simulationens tidsakkumulator var højst 16,63 ms i målingen, under ét trin. Den simulerede tid fulgte væguret inden for 0,4 %. Tallene angiver denne maskine og én båd. [Billedtid og inputdata](billedtid.json)

67 Node-tests, simulationens typekontrol og 28 målrettede browserprøver bestod. De fire arkiverede scenarier for de øvrige bådtyper er fortsat identiske. Fart, belastning og vendetider kræver fortsat kalibrering mod fysiske ILCA-målinger. Stentecs dokumentation bruges til sammenligning af betjening og respons. Denne undersøgelse har ingen nye tidsstemplede observationer fra SS5-videoerne. [Stentecs modelnoter](https://www.sailsimulator.com/en/game-info/boatset)

Genskab prøver med `node scripts/laser-probes.cjs FØR_PROJEKTMAPPE RAPPORT.json`. Kør `node scripts/laser-session.cjs FØR_URL EFTER_URL RAPPORTMAPPE` til video og browserlog, og tilføj `--timing` til billedmålingerne. Videokørslen bruger FFmpeg.
