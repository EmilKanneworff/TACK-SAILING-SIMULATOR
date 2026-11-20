# Lokalt vindlæ i TACK

[Prøv sejlads ud af læ ved Dyreborg](http://localhost:4173/?proeve=lae) · [Åbn vindkortet](http://localhost:4173/assets/vindkort.html)

Kortets øst- og nordkoordinater er i meter omkring Faaborg. Kystlinjen er forenklet OpenStreetMap-geometri. Vind og 3D-terræn bruger samme overflade, beregnet fra Copernicus GLO-30. Havbund, havnebygninger og bevoksning er tilnærmelser i spillet. [Datakilder og licenser](../../ASSETS.md)

## Vindmålinger i spillet

Grundvind 8,5 m/s fra nord. Der er målt 2 m over vandet med pust slået fra. Afstanden er målt sydpå fra kysten langs vindens vej.

| Kyst | 5 m | 50 m | 150 m | 300 m |
| --- | ---: | ---: | ---: | ---: |
| Øst for Dyreborg | 2,91 m/s | 4,83 m/s | 7,53 m/s | 8,30 m/s |
| Sydøst for Bjørnø | 4,87 m/s | 7,05 m/s | 8,34 m/s | 8,50 m/s |
| En lav vig ved Svelmø | 8,38 m/s | 8,50 m/s | 8,50 m/s | 8,50 m/s |

Prøvepositionerne i verdenskoordinater har østkoordinaterne −1.150, 1.500 og 6.280 m. Ved første punkt øst for Dyreborg steg vinden til 4,57 m/s i 10 m højde. Med vind fra syd var den 8,50 m/s i 2 m højde ved samme punkt.

I prøvesejladsen fra Dyreborg voksede middelvinden fra 3,74 til 7,89 m/s over 45 sekunder. Jollens fart faldt først fra 2,58 til 2,45 m/s efter fem sekunder og steg siden til 3,84 m/s. Jollen havde ingen bundkontakt, og instrumentet viste den samme vind som fysikken ved hvert målepunkt. `node scripts/wind-review.cjs` optager prøven og måler de tre kystprofiler igen.

## Beregning

Vindens passage over kysten aflæser den lokale terrænhøjde og hældning, bevoksning og husgrupper samt landets bredde. Højden af den lægivende kyst bestemmer, hvor hurtigt fri vind blandes ind fra siderne og ovenfra. Læet kan derfor række ud over 150 m ved høje kyster og være svagt få meter fra lavt land. Modellen bruger den stærkeste gældende læzone, når flere kyster ligger op mod vinden. Den bruger et 25 m gitter og blander naboretninger med 5° mellemrum. Tallene er kalibrering i spillet. [Forsøg med vindlæ over vand og afstand relativt til forhindringens højde](https://agupubs.onlinelibrary.wiley.com/doi/10.1029/2002WR001784)

Vejrets grundvind er middelvinden 2 m over åbent vand. Instrumenter, vindpile og vandets vindkrusninger aflæser det samme lokale felt. Sejlenes sektioner bruger vinden i deres egen højde. Vindpust bruger fælles simulationstid og følger den lokale styrke og retning.

Kort vindsø vokser med det frie stræk vand op mod vinden. Dønning kan komme fra en anden retning og dæmpes langs sin egen vej. Vandets shader og bådfysikken bruger det samme bølgefelt. [NOAA om vindbølger, vindens varighed og frit vand](https://www.noaa.gov/jetstream/ocean/waves)

## Tidligere optagelser

[Dynamisk læ på det komprimerede kort](fra-lae-til-fri-vind.webm) · [Tidligere vindmålinger](maalinger.json) · [Tidligere bølgemålinger](boelgelae/maaling.json)
