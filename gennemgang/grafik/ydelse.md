# Vandgrafik og billedtid i TACK

De fine striber i vandet kom fra vindkrusningernes tekstur. Et lille lokalt skift i vindretning drejede teksturens koordinater omkring kortets nulpunkt og strakte krusningerne til lange bånd. Krusningerne følger nu en sammenhængende bevægelse gennem landskabet. Vindstyrke, pust og læ bestemmer lokalt, hvor tydelige de er.

Vandets geometri skifter detaljeniveau gradvist efter maskevidde og bølgelængde. Vandets små normaldetaljer filtreres efter afstand, og regnens ringe filtreres efter pixelstørrelse. Kystskum tegnes tæt på kameraet og følger den samme bølgehøjde som vandet.

**Lav grafik** tegner ved 78 % af vinduets bredde og højde i CSS-pixels og tegner en ny scene ved hvert animationskald under sejlads. Fysik og rorinput kører med det faste simulationstrin. **Auto** sænker opløsningen gradvist, når billedfrekvensen falder vedvarende.

Andre både glider fra den viste stilling mod den nye netværkstilstand. Store positionsspring ved opretning eller genstart vises med det samme. Besætning og rig opdateres sjældnere på afstand, og grafiske ressourcer frigives ved bådskift og når en spiller forlader lobbyen.

[Laserjolle før](vand-foer.jpg) · [Laserjolle efter](vand-efter.jpg)

## Målemetode

Målt i Chrome 157 med Apple M5 og Metal. Browservinduet var 1280 × 800 ved 1× pixeltæthed. Efter tre sekunders opvarmning blev hver scene målt i 6,5 sekunder. De samme startpositioner, bådtyper, vind- og søindstillinger blev brugt før og efter. Antallet af tegnede scener kommer fra spillets renderer. Billedtiden måles mellem browserens animationskald.

Scenen med seks både brugte ét browservindue med de fem fjernbåde synlige, alle seks både i fysisk simulation og et fast måleperspektiv. En separat browsertest kørte seks spillere over den lokale WebSocket-tjeneste og kontrollerede, at alle fem gæsters rorinput blev modtaget og ændrede deres kurs.

## Målinger

| Situation | Tegnede billeder/s før → efter | CPU-tid til sceneopdatering, p95 før → efter | Trekanter pr. tegnet billede før → efter |
| --- | ---: | ---: | ---: |
| Laser ved kysten på Høj | 60,2 → 60,2 | 3,9 → 2,5 ms | 251.299 → 229.602 |
| AC72 med regn og 20 m/s grundvind på Høj | 60,2 → 60,2 | 4,9 → 4,1 ms | 317.307 → 295.635 |
| AC72 i samme vejr på Lav | 20,0 → 60,2 | 5,0 → 2,9 ms | 312.787 → 289.020 |
| Seks både på Høj | 59,1 → 58,8 | 8,5 → 7,8 ms | 370.060 → 348.637 |

På Lav faldt tegnebufferen fra 1280 × 800 til 998 × 624. Med seks både lå p95 for intervallet mellem browserens animationskald på 16,8 ms i begge målinger, og det længste interval var ca. 50 ms i begge. CPU-tiden i scenetabellen inkluderer klargøring og afsendelse af tegnekald. Førmålingen brugte kildekoden fra `24b7294`. Eftermålingen brugte det lokale produktionsbuild med revision `88eb7ef36a2f`.
