# Vandkontakt i FRI VIND

[Åbn spillet på localhost](http://localhost:5173/). Målingerne bruger samme fysiske starttilstand, vejr og kameravinkel før og efter. Standardkameraet er **Følg båden**. HUD'en er skjult i de kontrollerede klip, og klippenes tekst bruger fart og krængning fra det aktuelle manøvreforløb.

| Manøvre | Før | Efter |
| --- | --- | --- |
| Laserjolle i stille vand, under acceleration og krængning, i sving med afbremsning og gennem bølger | [Klip](foer/laser.mp4) | [Klip](efter/laser.mp4) |
| Foilmonohull fra skrogkontakt til løft og tilbage til landing | [Klip](foer/foil.mp4) | [Klip](efter/foil.mp4) |
| Samme Laserjolle efter 4,5 sekunders acceleration | [Billede](foer/laser-acceleration-68.jpg) | [Billede](efter/laser-acceleration-68.jpg) |

[Acceleration side om side, før til venstre](laser-sammenligning.jpg). Den sidste del af Laserjollens afbremsning vises i 25 gange hastighed for at medtage, at det tidligere spor forsvinder. Ved foilmonohullets landing sættes vinden ned, og sejlet slækkes. Spillets egen flyvekontrol, kræfter og opdrift beregner løft og landing.

## Lagprøve

De to lyse parallelle spor kom fra skrogkølvandets geometri. Renderingen brugte én liste med punkter fra agterenden to gange og forskød kopierne til hver sin side. Ved samme bådpose og tidspunkt forsvinder begge spor, når kun det lag er skjult. Skrogkontakt, vindbølger og almindelig skumrendering er aktive under prøven. [Alle lag før](foer/lag-alle.jpg) · [Uden kølvand før](foer/lag-uden-koelvand.jpg).

Den tidligere vandflade var heldækkende på de konventionelle både og lod kun lidt synlighed gennem vandet nær foils. Under rolige forhold viser den nye visning den lokale spejling af skrog og sejl sammen med himlen. Skrogets underflade, sværd og ror mister kontrast med dybden. [Med bådspejling](efter/lag-refleksion.jpg) · [Uden bådspejling](efter/lag-uden-refleksion.jpg).

Udviklervisningen læser `?vandlag=koelvand,kontakt` på [localhost](http://localhost:5173/?vandlag=koelvand,kontakt). Parametrene `koelvand`, `kontakt`, `foilspor`, `sproejt`, `lokale-boelger`, `gennemsigtighed`, `materiale` og `refleksion` slår de tilsvarende lag fra. Parametrene kan kombineres.

## Beregning og visning

- Kontaktpunkterne bruger fysikkens skrogform, vandoverflade og vandhastighed. Hastigheden i hvert punkt medregner bådens hævning, stampning, krængning og drejning samt foilarmenes bevægelse. Forskellen mellem overfladens og punktets lodrette hastighed afgør, hvornår et nedslag fortrænger vand. Ved planing dæmpes virkningen fra jollens forskib efter det beregnede planingsløft og den lokale neddykning.
- Den fysiske vandoverflade bestemmer kontakt og opdrift. Vandets vertexshader lægger et afgrænset lag med lokale stævnbølger, bølgeskuldre og bølger fra den sejlede rute ovenpå. Det lokale visuelle lag medregnes ikke i opdrift. Vandlinjen følger overfladens højde, og cockpitmasken følger de fysiske skrogsektioner. Materialets vådfilm bruger vandets lokale tangent ved båden og en kort aftagende fugtighed på hver side.
- Kølvandet registreres efter sejlet afstand, og dets tværretning følger kontaktpunktets bevægelse gennem vandet. Bølgekamme breder sig på tværs af ruten, mens skum følger en vægtet lokal vandbevægelse. Skummet bredes ud, får synlige huller og opløses. Registreringen afbrydes, når skroget løfter sig, og nulstilles ved bådskift, redning og hop. Tidligere punkter fortsætter med at udvikle sig efter et sving eller et løft.
- Sprøjt dannes ved lokal vandkontakt, især ved nedslag eller kraftig vandbevægelse omkring skroget. Dråberne genbruges, dybdetestes mod båden og vandet og følger tyngde og en del af vinden. Kraftige nedslag kan efterlade et kortvarigt skumfelt.
- Ét delt spejlpass viser synlig skrog- og sejlgeometri for det lokale renderudsnit. Dønningernes og krusningernes hældning forskyder spejlingen. Overblikskameraet højt over vandet bruger himmelrefleksion, og grafikindstillingen **Let** opdaterer bådspejlingen sjældnere. Fuld detalje til vandlinje og sprøjt bruges på spillerens båd. De nærmeste medspillere kan tilføje lokale bølger og kølvand; de øvrige vises med det almindelige bølgefelt.

| Båd | Kontakt og visuel profil |
| --- | --- |
| Laserjolle | Smalt spor. De to sider reagerer uafhængigt ved krængning, og ved løft flytter påvirkningen sig mod det våde agterskib. [Fra siden](efter/lag-alle.jpg) · [Cockpit](efter/laser-cockpit.jpg) · [Ovenfra](efter/laser-ovenfra.jpg) · [Overskyet](efter/laser-overskyet.jpg) |
| Racer 32 | Smallere og hurtigere reagerende spor end turbåden. De to ror prøves hver for sig. [Fra siden](efter/dinghy-fra-siden.jpg) |
| Turbåd 43 | Større skrogflade, bredere spor, længere skumlevetid og roligere overgange. [Fra siden](efter/yacht-fra-siden.jpg) |
| Foilmonohull | Særskilt skrog-, foilarm- og rorkontakt. Ved løft afbrydes nye skrogspor, og ved landing følger nye spor den afrundede skrogbund. [Fra siden](efter/ac75-fra-siden.jpg) |
| Foilkatamaran | Separate skrogspor, to foilben og to ror. Vandet mellem skrogene forbliver synligt. [Fra siden](efter/ac72-fra-siden.jpg) |

Se [grafikressourcer og licenser](../../../ASSETS.md). Princippet med et separat lokalt bølgelag, skum med levetid og en fælles spejling følger disse tekniske referencer. [Crest Dynamic Waves](https://docs.crest.waveharmonic.com/Manual/Simulation/Ripples.html) · [Crest Foam](https://docs.crest.waveharmonic.com/Manual/Appearance/Foam.html) · [Crest Reflections](https://docs.crest.waveharmonic.com/Manual/Appearance/Reflections.html).

## Afprøvning

I de syv optagne manøvrer var position, højde, fart, krængning og foilbådens skrogkontakt identiske mellem før og efter ved alle sammenlignede tidspunkter. Laserjollen dannede hverken kølvand, lokale bølger eller sprøjt i stille vand. Under acceleration steg farten fra 0,9 til 12,5 knob. Efter svinget og afbremsningen var den nede på 0,59 knob, og det tidligere spor var opløst. Foilmonohullets skrogkontakt faldt fra 37 % til tæt på 0 % ved løft og steg til 30 % under landing. [Førdata](foer/manoeverdata.json) · [Efterdata](efter/manoeverdata.json).

Browserprøverne kontrollerer vandhøjde i CPU og GPU, opdrift og kontinuitet i bølgefeltet, vandmasken omkring Laserjollens cockpit og lokale kontakter under rotation. De målrettede prøver kontrollerer også verdensfaste, afstandsfordelte kølvandspunkter, transport med vandet, sporskifte efter et sving, afbrudte spor ved hop og nye skrogspor efter foil-landing.

## Billedtid før og efter

Målt i Chrome 157 med ANGLE Metal på Apple M5. Værtsvisningen var 1440 × 900 ved samme grafikindstilling før og efter. Hver prøve tog cirka 4,5 sekunder efter opvarmning. P95-billedtid er afstanden mellem browserens animationstidsstempler. CPU-kolonnen måler rendererens arbejde med at indsende geometri, inklusive spejlpasset, og er et separat mål.

| Scene | Grafik | Billeder/s før → efter | P95 billedtid før → efter | P95 CPU i renderer før → efter |
| --- | --- | ---: | ---: | ---: |
| Én Turbåd 43, cockpitkamera | Høj | 60,0 → 60,0 | 16,8 → 16,7 ms | 1,5 → 1,6 ms |
| Seks både, højt overblik | Let | 60,0 → 56,2 | 16,7 → 16,8 ms | 4,4 → 7,5 ms |
| Seks både, nærmere udsnit med bådspejling efter | Let | 56,4 → 58,2 | 16,8 → 16,8 ms | 7,9 → 9,0 ms |

Alle seks både var inden for kamerafeltet i begge flerspillerprøver. Testen på 31 meters kamerahøjde viser den delte spejling og spillerbådens lokale effektbudget. Medspillernes kølvand vælges efter, hvor tæt de er på kameraet. Grafikken **Let** bruger et spejlbillede på 320 × 180, mens **Høj** bruger 640 × 360. [Højt overblik med seks både](efter/seks.png) · [Nærmere udsnit](efter/seks-naer.png) · [Rå førmåling](foer/maaling.json) · [Rå eftermåling](efter/maaling.json).
