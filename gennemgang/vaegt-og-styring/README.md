# Sidevalg, vandkontakt og styring i TACK

**Testet build `a445477ce395` på [localhost:5177](http://localhost:5177/).** Git-grundlag `7ad0ecc` med de igangværende ændringer i arbejdsområdet. Før-build `93298c1d7f6c` blev gemt og serveret separat på [localhost:5187](http://localhost:5187/). Optagescriptet sammenholdt både HTTP-revisionen og revisionen i spillet.

[Stagvending til styrbord · før/efter](til-styrbord.mp4) · [Stagvending til bagbord · før/efter](til-bagbord.mp4)

## Fejlen og rettelsen

Brugerens optagelse fra kl. 15.04.39 varer 13,9 s. Omkring 0,7–3,8 s ses opretning og en midlertidig position inde i båden. Ved ca. 5 s vises position 2. Mellem ca. 10,5 og 13 s ændres kursen fra omtrent 054° gennem vinden til 327–330°. Jollen mister fart og sejleren ender på den gamle side. Optagelsen viser kurs, vind, skøde og besætning, mens de præcise tastetryk og den kørende revision ikke fremgår. Den viser situationen, som før-prøverne reproducerer med kendte input.

Før havde `setPose` en skjult sideeffekt. Et tryk på 1–3 kunne vælge ny luvside, også forsinket efter passage af vindøjet. Derudover erstattede opretning et tidligere Q/E-valg, hvis redningskursen efterlod vægten i læ. Begge overskrivninger er fjernet. Simulationens `crewTarget` er det senest accepterede valg af side, stilling og længdeplacering. Brugerfladen sender absolutte kommandoer med orden og opretningsfase. Båden afviser ældre og gentagne kommandoer. Midlertidig opretningspose og senest accepterede valg gemmes hver for sig. Ved fokus- eller pausetab frigives holdte input og uafviklede besætningskommandoer kasseres. Den fysiske besætning flytter sig med begrænset hastighed og acceleration. Renderingen læser den interpolerede fysiske pose. [Spillets input](../../index.html) · [Simulation](../../assets/simulation/physics.js) · [Opretning](../../assets/simulation/recovery.js) · [Netværksinput](../../assets/fleet.js)

På **Svær** vælger Q bagbord og E styrbord, uanset hvor kamera og stævn peger. 1–3 vælger stilling, og Z/X eller skyderen flytter vægten agter/frem. Vælg ny side med Q eller E i vendingen. På **Let** flytter hjælpen selv vægten med de samme fysiske aktuatorer. Den vælger først en ny side efter mindst 0,16 s med en tydelig vindside og fastholder siden inden for vindøjets dødbånd. Den manuelle indstilling gemmes, mens Let er aktiv.

## Hele stagvendinger

Fri sejlads på Svær, følgekameravinkel, 8,5 m/s fra nord, 0,35 m bølger, 16 % chop og intet kystlæ eller pust. Starten blev sat 49° fra vinden med 3,0 m/s og 73 % skøde. En styresekvens fra efter-buildet brugte almindelige piletaster, 1–3, Q/E og skødeskyderen. Den samme sekvens blev derefter afspillet på begge builds. Der blev ikke rettet i kurs, stilling eller fart efter start. Grænserne for efter-prøven var én gennemført stagvending, korrekt side først efter Q/E, ingen grundkontakt eller kæntring og mindst 0,25 knobs genvundet fart fra det laveste målepunkt. Det er sammenligningsprøver af en kontrollogik med samme input.

| Vægtskift | Før skifter siden ved | Efter skifter siden ved | Fart før ved klippets slutning | Fart efter ved klippets slutning |
|---|---:|---:|---:|---:|
| Til styrbord | 3,43 s af sig selv | 3,60 s med E | 4,17 kn | 5,72 kn |
| Til bagbord | 3,27 s af sig selv | 3,52 s med Q | 1,93 kn | 5,75 kn |

På efter-buildet faldt farten under vendingerne til henholdsvis 3,91 og 3,61 knob. Inden for ca. 0,75 s efter sidekommandoen var den fysiske sidebevægelse nået inden for 5 % af sin nye position. Den gamle version kom gennem vindøjet, men med samme rorforløb endte bagbordsvendingen tæt på vinden igen. Slutfarten er et øjebliksbillede i manøvren. På prøven med Q/E midt under en igangværende bevægelse skiftede målet straks, mens hastigheden i bevægelsen stadig var kontinuerlig. Gentagelse og pause ændrede ikke den senest accepterede ordre.

Sejleren dukkede i begge klip. Den målte minimumsafstand fra kasketten til bommens prøvevolumen var 11–12 cm. De tegnede fødder fulgte deres interpolerede fysiske støttepunkter. Skøde og rorpindsforlænger fulgte grebene med mindre end 0,0001 m afstand i de målte billeder. Lasermodellen bruger det eksisterende originale Blender-GLB, en rig med 14 knogler og beregnede greb og støttepunkter. Trapez på Racer 32, sidedæk på Turbåd 43 og foilbådenes cockpitstationer har deres egne geometrier. Kropsstøtten er modelleret som arbejdsstillinger og ledbevægelse, uden fuld fysisk simulering af muskler, stof og kropskontakt. [Målinger og input · styrbord](til-styrbord.json.gz) · [Målinger og input · bagbord](til-bagbord.json.gz) · [GLB og rig](../laser-model/README.md)

### Ror og sejl

I Laser-prøven til styrbord omkring vindøjet registrerede loggen venstre input, −24,8° aktuelt ror, 0,0159 m² vådt bladareal og 2,60 m/s fremadrettet lokal vandstrøm. I den spejlede manøvre lå det tilsvarende blad på 0,0049 m² vådt areal trods 25,4° faktisk udslag. Drejningen afhænger af våd geometri, lokal strøm og de samlede momenter. Diagnosevisningen med tasten **`** fører nominelt og faktisk udslag, vådt areal, strøm og kraftbidrag fra sejl, mast, skrog, sværd og ror frem til nettomoment og ændring i drejehastighed. Både negative og positive rorinput er testet i vand med kendt fart. I browseren kom Laserjollen ud af de to kontrollerede rapportforløb i 9,5 og 11 m/s med slæk og ror. Ved ca. 40° fra vinden tog det omkring 3,8–4,0 s at komme ud af vindøjet. Vindøjehjælpen var slået fra.

Testene følger skødet over hele intervallet. Ved 0 % bliver bommens mekaniske åbningsgrænse størst. Sejltrykket følger stadig det aktuelle sejl og dets vinkel til den relative vind. Fyldning, blafren, bomning og rebning følger samme rigtilstand i grafik og fysik. Prøverne dækker separat fok, storsejl, Turbåd 43’s Code 0, gennaker og spiler samt mono- og katamaranens rig. Storsejlet på Turbåd 43 går fra 48 til 26,88 m² med to reb. Katamaranens tunge vejrin­dstilling reducerer vingens kraft og fokkearealet med egne parametre. Foilernes regulering af arme og flapper er aktiv, også på Svær. Almindelig sejlads på Svær i de prøvede vendinger havde intet hjælpemoment på roret. [Rig- og grafikprøver](../../tests/sail-state.test.js) · [Styringslog og data](til-styrbord.json.gz)

## Masse, opdrift og vandkontakt

I spillets bådkoordinater er x frem, y op og z mod styrbord. Vægten virker i verdens lodrette retning. Opdriften følger de neddykkede volumenceller. Kraftmomenter ved skrog, ror, sejl og foils flyttes til systemets aktuelle tyngdepunkt i `integrateMass`. Kroppens masse er fordelt i segmenter, eller i cockpitstationer på foilbådene. Den samme vægt indgår én gang. Tensoren følger massefordelingen, og vandets medbevægelse indgår i særskilt inertikobling på Laserjollen. Alle profilværdier og belastninger er målt i SI-enheder. 0°, 15° og 30° krængning, med 0° og 5° pitch, blev prøvet ved hydrostatisk ligevægt. De loggede tyngdemomenter stemte med vægt gange den transformerede arm. [Profiler, kræfter, inertitensor og forløb](kraefter.json)

| Båd | Længde × bredde | Samlet masse · personer | Grundsejl | Ændring i systemets CG frem/agter | Forskel i pitch |
|---|---:|---:|---:|---:|---:|
| Laserjolle | 4,23 × 1,37 m | 143 kg · 1 | 7,06 m² | 45,1 cm | 1,61° |
| Racer 32 | 9,75 × 3,10 m | 2.200 kg · 3 | 35 + 20 m² | 13,8 cm | 0,23° |
| Turbåd 43 | 13,10 × 4,05 m | 9.600 kg · 4 | 48 + 32 m² | 5,3 cm | 0,11° |
| Foilmonohull | 20,70 × 5,00 m | 6.900 kg · 8 | 165 + 65 m² | 11,5 cm | 0,12° |
| Foilkatamaran | 22,00 × 14,00 m | 6.900 kg · 11 | 205 + 55 m² | 14,3 cm | 0,08° |

Tabellens længdetrim er målt på fladt, vindstille vand ved samme side og stilling. Det er den samlede CG-vandring fra helt agter til helt fremme. Foilbådene var vandbårne under denne prøve. En separat styrbordsvægtprøve fra position 1 til 3 i vindstille vand førte til overbalance og kæntring på Laserjollen. Den gennemførtes uden kæntring på de fire tungere eller bredere både. Racer 32 og Turbåd 43 har henholdsvis 760 og 2.800 kg separat ballast. Laserjollens sværd skaber vandkræfter uden ballastkøl. Foilbådenes lift og momenter følger løftefladernes placering, fart, orientering og neddykning. Samme forløb ved identiske fysiske kontrolinput gav de samme referenceværdier før og efter på alle fem både. Bådprofiler og de målte koefficienter i spillet er spilkalibrering. [Flådens input og målinger](flaade.json.gz) · [ILCA’s måletegninger](https://ilcasailing.org/rules-and-technical/measurement-diagrams/) · [Day om Laserens præstation](https://pure.strath.ac.uk/ws/portalfiles/portal/64217569/Day_OE_2017_Performance_prediction_for_sailing_dinghies.pdf) · [Fossens model](https://www.fossen.biz/html/marineCraftModel.html)

### Vandfelt og surf

På én kendt bølge sammenlignede vi vandhøjde ved stævn, midtskibs og agter på nøjagtig samme position og simulationstid i CPU og GPU. Maksimal afvigelse i 45 aflæsninger var 4,7 mm. Pitch spændte over 2,82° i prøven. På de normale scener bekræftede browseren, at sprøjt starter ved stævnkontakt, at de våde hækhjørner efterlader særskilte spor, og at skrogkølvand aftager under flyvning og vender tilbage ved landing. 120 sekunders prøve i åbent vand med 12 m/s gav signifikant højde 0,00, 2,38, 0,50 og 2,50 m for henholdsvis ro, 2,5 m lange bølger, 100 % chop alene og begge sammen. Ingen af feltets fysiske bølger afhænger af grafikvalget.

Surfprøven brugte én komponent fra vest, 1,35 m valgt dønning, 0 % chop og 4,25 m/s startfart. Båden sejlede 15° fra bølgens udbredelsesretning. Fronten startede i fase 3,40 rad, bagsiden i 0,70 rad. Kraftens arbejde er summen af den integrerede bølgegradientkraft ganget med forflytningen i hvert trin. Det måler bølgeleddets bidrag. De øvrige sejl- og vandkræfter fortsatte under forsøget.

| Måling | På bølgen | Matchet fladt vand | Bølgearbejde |
|---|---:|---:|---:|
| Forside efter 0,75 s | 5,59 m/s i bølgens retning | 5,20 m/s | +311 J |
| Bagside efter 2,00 s | 4,79 m/s i bølgens retning | 5,45 m/s | −1.560 J |

Ved 1/60, 1/120 og 1/240 s fysiktrin holdt fortegnet i begge prøver. Maksimal ændring i slutfart mellem 1/60 og 1/240 s var 0,029 m/s for disse prøver. Foilmodellens interne trin er allerede højst 1/240 s. Billedfrekvensprøven brugte derimod samme fysiktrin med 30, 60 og 120 renderbilleder/s. Desuden målte vi Høj og Lav grafik ved samme indspillede input, hvor positioner, hastigheder, vinkler, sejlfyldning og vandkontakt var identiske. [Bølgeprøvens rådata](kraefter.json) · [CPU/GPU og billedfrekvens](../../tests/waves.test.js) · [Bølgeteori, MIT](https://web.mit.edu/fluids-modules/www/potential_flows/LecturesHTML/lec19/node5.html)

## Browser, netværk og resterende kalibrering

I en lokal lobby på to med browseren som vært så gæsten E → Q → E og stilling 1 → 3 → 2 i de modtagne tilstande og i den tegnede besætning. Den samme kontrolkæde bestod også en browsertest med serveren som fysikvært. Onlinelobbyen til to blev afprøvet med det opdaterede lokale build. [Lobbyens tilstandslog](lobby.json)

På Apple M5, macOS 26.3 og Chrome 158 gav fire gennemløb pr. grafikniveau median 16,7 ms på både før- og efter-build. P95 var ca. 17,6 → 17,8 ms på Høj og 17,6 → 17,6 ms på Lav. Korte ror- og skødetryk blev registreret i alle gennemløb. På efter-build lå den observerede inputrespons mellem 4 og 30 ms. Et gennemløb varede fire sekunder. Der var én synlig båd og 1280 × 800 i visningsområdet. Lav tegnede i 789 × 493. [Billedtid og input](billedtid.json)

69 Node-tests og typekontrollen bestod. Den brede browserprøve dækkede blandt andet sejl, vand, opretning og multiplayer. En opfølgning bekræftede, at de to fejl i crew-prøvens startopsætning og UI-aflæsning er væk, og at en eksplicit nulstilling af både bølger og chop gør roligtvandsprøven grøn. Fire øvrige afvigelser var til stede i før-buildet og er fortsat åbne i de afprøvede scenarier. Den gamle standardbølgetest aflæser en `waves`-værdi, som den nyere `waveHeight` har forrang over. En bred bølgefrontprøve ligger uden for sin grænse, én ud af tre AC75-starter i prøvesø nåede den registrerede flyvetilstand mod et krav om to, og mobilkortets menuknapper viste sig ikke efter tryk midt på kortet i den pågældende test. Ingen afvigelser gav grundlag for at ændre bådprofiler for at rette sidevalget.

Den fysiske kontrol viser fortegn, sammenhæng og reproducerbare spilresultater. Laserens fart, krængning, planing, rorventilation og surf er endnu ikke kalibreret mod et fuldt sæt målinger fra ILCA-sejlads. Racer 32’s balance ved 17 m/s og foilbådenes løft, regulering og rorsvar i sø kræver egne måleserier. Brug af Sail Simulator 5 omfattede en visuel reference for besætningens bevægelse og kobling til bom, greb og vand. [Stentecs spilbeskrivelse](https://www.sailsimulator.com/en/game-info/features) · [Day og Nixon om Laserens modstand](https://pure.strath.ac.uk/ws/portalfiles/portal/42141576/Day_Nixon_IJSCT_2014_Measurement_and_prediction_of_the_resistance_of_a_laser_sailing.pdf)

## Genskab prøverne

```sh
TACK_LASER_TRIAL=manual-side node scripts/laser-session.cjs http://localhost:5187/ http://localhost:5177/ gennemgang/vaegt-og-styring
node scripts/fleet-review.cjs /tmp/tack-control-baseline.JCmHZA . gennemgang/vaegt-og-styring/flaade.json.gz
node scripts/crew-water-probes.cjs /tmp/tack-control-baseline.JCmHZA . gennemgang/vaegt-og-styring/kraefter.json
node scripts/laser-session.cjs http://localhost:5187/ http://localhost:5177/ gennemgang/vaegt-og-styring --timing
```
