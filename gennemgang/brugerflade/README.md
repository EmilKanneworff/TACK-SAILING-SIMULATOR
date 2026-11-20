# Brugerfladen i FRI VIND

[Åbn FRI VIND på localhost](http://localhost:5173/).

## Vejr og sejlads

Vejrmenuen har otte valg under **Vind og vand** og **Himmel og lys**. Vindstyrken kan indstilles mellem 0 og 20 m/s. Vindretningen har en separat skyder med kompasmarkeringer. De seks øvrige valg bruger grupper med én markeret mulighed. **Vind ved båden** er en aflæsning fra det lokale vindfelt. Vejrvalg og personlige indstillinger gemmes lokalt. Ældre vejrfelter migreres til de nye valg. Udviklertests kan stadig angive tekniske bølgeparametre.

**Roligt**, **Små** og **Store** vælger en samlet profil med bølgehøjde, periode, retningsspredning og krusninger. Vind og kyst påvirker den valgte sø i fysik og grafik. Vindens retning føres gradvis over til det nye mål, og gamle og nye bølgefronter blandes over tid. Vejrmenuen pauser solosejlads, inklusive løbsuret. I en lobby fortsætter sejladsen, og værten opdaterer vejret gennem de autoritative snapshots. Gæstens menu viser de fælles værdier med teksten **Værten styrer vejret**.

Vindpilene vises løbende under sejlads. Nye pile dukker op forskudt, glider med den lokale sande vind og følger den tegnede bølgehøjde. Pilene kan ses ved svag vind og på lav grafik, også når instrumenterne er skjult. Ved vindstille viser instrumentet **Vindstille**. [Klip med skift fra nordenvind til østenvind](vindskift.webm).

## Skærme og kort

| Visning | Dokumentation |
| --- | --- |
| Hovedskærm 1366 × 768 | [Se billedet](hovedskaerm-1366x768.jpg) |
| Vejrmenu 1366 × 768 | [Se billedet](vejr-1366x768.jpg) |
| Vejrmenu 1920 × 1080 | [Se billedet](vejr-1920x1080.jpg) |
| Mobil 390 × 844 | [Vejrmenu](vejr-mobil.jpg) · [Nederste del](vejr-mobil-nederst.jpg) |
| Chrome med 200 % zoom | [Øverst](vejr-zoom-200.jpg) · [Nederst](vejr-zoom-200-nederst.jpg) |
| Lille, mellem og stort kort på desktop | [Lille](kort-1920x1080-lille.jpg) · [Mellem](kort-1920x1080-mellem.jpg) · [Stort med Øhavet valgt](kort-1920x1080-stor.jpg) |
| Lille, mellem og stort kort på mobil | [Lille](kort-mobil-lille.jpg) · [Mellem](kort-mobil-mellem.jpg) · [Stort med Øhavet valgt](kort-mobil-stor.jpg) |

Kortet cykler **Lille → Mellem → Stor → Lille** med samme geografiske zoom. **Øhavet** indrammer sejlområdet omkring Faaborg, Lyø, Bjørnø, Avernakø og Svelmø. Fyns tegnede kyststreg bruger de kendte kystpunkter. Landets baggrund fortsætter op til kortets kant, og lukningen af landpolygonen ligger uden for kortets kyststreg. Stednavne placeres med plads til hinanden. På smalle skærme har det store kort pladsen for sig selv over instrumentbjælken.

## Kontrol

Mål og positioner blev registreret i Chrome ved 1366 × 768, 1920 × 1080 og 390 × 844. Den fjerde prøve brugte Chromes egen zoom på 200 %, som gav et CSS-område på 683 × 384. Kontrollerne efterprøvede lukkeknap og sidste vejrvalg efter scrolling, alle tre kortstørrelser, klikflader, bevaret zoom og fokus efter Escape. [Layoutmålinger](layout.json).

Browserprøverne omfatter uafhængige vejrvalg, gemte værdier og migration, bølgeovergange, effekten af bølger under sejlads, vindpile i de fire hovedretninger, sejlads ind og ud af læ, pauset løbsur, fokus på skydere og værtens kontrol af fælles vejr. En prøve med to samtidige berøringer zoomede kortet, og næste kortstørrelse bevarede det zoomniveau. Den samme simulerede tur med Laserjollen gav ens position, krængning, stampning, lodret bevægelse og lokal vind ved høj og lav grafik. Vindpilene kunne ses i begge visninger.

I en isoleret Chrome-måling ved 1366 × 768, 8 m/s og små bølger faldt CPU-tiden for at opdatere vindpilene fra 1,72 til 0,27 ms ved høj grafik og fra 0,97 til 0,15 ms ved lav grafik. Tallene dækker CPU-arbejdet i pileopdateringen før og efter flytningen af bølgehøjden til grafikkortet.

Den brede kørsel bestod 92 af 93 browserprøver, inklusive seks samtidige spillere og 150 ms simuleret netværksforsinkelse. Fejlen i den sidste prøve viste sig ved ændring af vinduesstørrelse, hvor menuens højde kortvarigt kunne blive beregnet ud fra det tidligere kort. Efter rettelsen bestod den prøve tre gentagelser og en samlet kørsel med 17 prøver af layout, kort og sejladsbetjening. Alle 12 Node-tests bestod.

Modalerne holder tastaturfokus inde i panelet. De almindelige skydere bruger browserens piletaster og Home/End. [W3C om modaler](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) · [W3C om skydere](https://www.w3.org/WAI/ARIA/apg/patterns/slider/) · [W3C om klikflader](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).
