# Sejlegenskaber, stagvending og vindlæ

[Start FRI VIND](http://localhost:4173/) · [Prøv læet ved Dyreborg](http://localhost:4173/?proeve=lae) · [Se stagvendingen](stagvending.mp4) · [Sejleren under bommen](stagvending.jpg)

## Hvad der forklarede adfærden

Racer 32 brugte allerede sin egen kølbådsprofil. Den store skrogmodstand begrænsede båden, samtidig med at Laserjollen havde lav modstand ved høj fart. Laserjollens vending var også begrænset af en langsom rorrespons og en besætningstilstand, hvor valgt stilling og aktuel side hang sammen. Et hurtigt tryk på 3 kunne derfor sende vægten tilbage på den gamle side, mens sejltrykket var ved at skifte. Den tidligere læmodel havde mildere vindunderskud ved kysten og brugte en kortere genopretning.

- Laserjollen bruger 4,23 × 1,37 m og 7,06 m² som ILCA 7. De nominelle 58 kg med beslag er repræsenteret som 56 + 2 kg. Yderligere 10 kg til løs rig og udstyr samt 75 kg til sejleren er spillets estimater. Totalen er 143 kg. Spilskrogets beregnede vandlinje er 3,58 m i den afprøvede lasttilstand. Klasseværdien på 3,81 m bruges som reference for modstandens Froude-tal. [ILCA-håndbogen](https://ilcasailing.org/laserinternational/wp-content/uploads/2025/02/HANDBOOK-2025.pdf)
- Laserens skrog har samme grundmodstand i den lave ende. Den kalibrerede koefficient for bølgedannelsesmodstand stiger gradvist fra 0,60 til 1,00 mellem Froude 0,54 og 0,70. Det mindsker for høj vedvarende fart og bevarer accelerationen på en medsøbølge. Den maksimale ønskede drejerate er øget fra 0,72/0,42 til 0,81/0,53 rad/s i de langsomme/hurtige ender. Rorvirkningen bygges hurtigere op og virker gennem moment og rorkraft.
- Racer 32 er et fiktivt design på 9,75 × 3,10 m og 2.600 kg med 900 kg ballast og to sejlere à 80 kg. Storsejl og fok er 38 og 24 m². Fokkens synlige mål er afstemt med arealet. Skrogmodstandens tre koefficienter er ændret fra 60/30/1,80 til 26/25/1,30. Dynamisk tryk, trimvinkel og våd planflade giver en begrænset lodret planingskraft med ledsagende modstand. Løftet er begrænset til 52 % af vægten. De to ror bruger hver sin lokale strømning og nedsænkning. Trapezerne flytter begge sejleres massepunkter uden for rælingen.
- Besætningens segmenter, skrog, rig, udstyr og ballast har hver én masse. De konventionelle bådes oprettende moment kommer fra vandkontakt og komponenternes tyngde. Inertien inkluderer faste og bevægelige massebidrag. Foilbådene har separate løfteflader og automatisk flaptrim. Grundkontakt og opretning er særskilte spilfunktioner. [Profiler, masser, vandlinjer, våd flade og undervandsdele](../fysik/baadprofiler.json)
- Sejlenes sektioner bruger tilsyneladende vind i deres egen højde og bevægelse. Ror, sværd, skrog og foils bruger lokal strøm og bølgernes partikelhastighed ved kraftpunktet, inklusive bådens rotation. Bølgetoppenes udbredelseshastighed bruges til fasen. De neddykkede skrogceller giver opdrift og søgangsmomenter. [MIT om bølgebevægelse](https://ocw.mit.edu/courses/12-333-atmospheric-and-ocean-circulations-spring-2004/pages/lecture-notes/)

## Vindlæ på meterkortet

Målingerne på det tidligere komprimerede kort ligger i [lae.json](lae.json). På meterkortet har lave kyster, skrænter og bevoksede kyster hver deres profil. [Aktuelle målinger og modelbeskrivelse](../lae/README.md).

## Laserjollens stagvending

Retningen under vendingen, bommens passage og den nye vindside bestemmer gennemgangen af cockpittet. Kroppen trækkes først ind. Knæ, hofter og hoved sænkes om nødvendigt ift. bommen, og fødderne skifter støttepunkt. Samme ledpositioner bruges til at placere massen og tegne sejleren. Hvis 3 allerede er valgt, vokser hænget på den nye side i takt med fyldt sejl og belastning. Valg 1 bliver stående, indtil spilleren ændrer det. [MIT's manøvrevejledning](https://sailing.mit.edu/lts/sailing-booklet/booklet_unified.shtml)

40 forløb i hver version fordelt over 8 og 9 m/s, begge halser, fladt vand og 0,35 m signifikant bølgehøjde. Ror og trim bruger samme kontrolinput som spillet. Forløbene begynder med otte sekunder på kryds. Den laveste fart måles i manøvrens første syv sekunder. Ny hals registreres, når stævnen passerer sand vind. Sidepassagen måles fra den bekræftede nye luvside til 80 % af bevægelsen ud mod den. Optagelsen bruger de almindelige taster i det kørende spil og en tættere kameravinkel.

| Manøvre | Indgang (kn) | Laveste fart (kn) | Ny hals | Største krængning | Kæntringer før / efter |
| --- | ---: | ---: | ---: | ---: | ---: |
| 3 → 1 | 5,34–6,09 | 3,35–3,65 | 1,80–1,82 s | 12,8–25,9° | 2 / 0 |
| Hurtig 3 → 1 → 3 | 5,34–6,09 | 3,39–3,69 | 1,80–1,82 s | 10,9–25,9° | 8 / 0 |
| Langsom passage | 5,34–6,09 | 2,67–2,86 | 4,28–4,33 s | 10,7–25,9° | 2 / 0 |
| Afbrudt vending | 5,34–6,09 | 3,53–4,02 | Oprindelig hals | 11,8–25,9° | 2 / 0 |
| 3 → 1 på lige kurs | 5,34–6,09 | 4,72–5,58 | Samme kurs | 10,7–25,9° | 0 / 0 |

Sejleren nåede næsten helt ind efter 0,25 s og passerede mod den nye side cirka 0,63 s efter bekræftelsen. På de fuldførte stagvendinger steg den mindste afstand fra hovedets referencepunkt til bommens akse fra 0,05 til 0,22 m. For brystets referencepunkt steg den fra 0,09 til 0,40 m. Hurtigt valg af 3 gav ingen tilbagevenden til hæng på den gamle side. 1 giver et mindre oprettende moment end 3 og kan stadig kræve mere modvægt eller ændret trim ved fortsat kryds. [Før](vending-foer.json) · [Efter](vending-efter.json) · [Tastaturforløb](stagvending-tastatur.json)

## Laserjolle og Racer 32

Fart gennem vandet i knob. Vind fra nord, pust, strøm og bølger slået fra. For hver kurs blev der prøvet flere trimindstillinger. De to bedste stabile resultater gennemførte 65 sekunder med en middelværdi over de sidste ti. 170° repræsenterer læns med arbejdssejl. Procenten er Racerens fordel relativt til Laserjollen i den nye version. [ORC om balance mellem sejlkræfter og modstand i VPP](https://orc.org/organization/velocity-prediction-program-vpp)

| Vind (m/s) | Sand vindvinkel | Før Laser | Før Racer | Nu Laser | Nu Racer | Forskel (kn) | Forskel (%) |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 6 | 45° | 7,48 | 7,22 | 7,16 | 7,97 | +0,81 | +11 % |
| 6 | 90° | 8,79 | 9,42 | 7,97 | 10,35 | +2,38 | +30 % |
| 6 | 130° | 6,92 | 7,04 | 6,85 | 7,93 | +1,08 | +16 % |
| 6 | 170° | 6,21 | 5,76 | 6,20 | 6,18 | −0,02 | <1 % |
| 8 | 45° | 8,60 | 8,19 | 7,71 | 9,04 | +1,32 | +17 % |
| 8 | 90° | 10,53 | 10,74 | 9,18 | 11,54 | +2,36 | +26 % |
| 8 | 130° | 8,83 | 8,91 | 8,01 | 9,61 | +1,60 | +20 % |
| 8 | 170° | 7,86 | 7,49 | 7,49 | 8,00 | +0,51 | +7 % |
| 9 | 45° | 9,87 | 8,67 | 8,48 | 9,56 | +1,08 | +13 % |
| 9 | 90° | 10,82 | 11,28 | 9,52 | 12,20 | +2,67 | +28 % |
| 9 | 130° | 9,48 | 9,85 | 8,56 | 10,66 | +2,10 | +25 % |
| 9 | 170° | 8,62 | 8,29 | 7,99 | 8,84 | +0,84 | +11 % |

På slør i 9 m/s gav den nye version 0,29 og 0,36 m/s² i gennemsnit over de første ti sekunder fra 1,5 m/s. Krængningen i stabil sejlads var 1,1° og 10,4°, afdriften 0,6° og 0,5° og VMG direkte med vinden 5,57 og 6,92 kn for henholdsvis Laser og Racer. I 0,35 m bølger var gennemsnit/maksimum på slør 8,60/8,81 kn for Laser og 10,43/10,86 kn for Racer. Et separat medsøforløb kontrollerer jollens korte acceleration på bølgesiden og afmatningen bagefter. [Fart, acceleration, krængning, kurs, afdrift og VMG for alle prøver før](fart-foer.json) · [Tilsvarende data efter](fart-efter.json)

## Kontrol og modellens rækkevidde

- Gentagne positionsskift på fladt vand uden vind ændrede ingen af de fem bådes totalmasse. Efter 40 s var største fart på tværs af testene cirka 0,0021 m/s. Opdrift og vægt stemmer i den statiske starttilstand.
- GPU-aflæsning af vind og vandhøjde stemmer med fysikken. Kort, vindpile og instrumenter deler vindfeltet. Under kystsejlads dannes og dæmpes vindbølger separat fra middelvinden. Testene gennemgår også pause, forskellige renderfrekvenser, sliders og opretning.
- Tastaturvendingen blev kørt lokalt ved 9 m/s. En separat prøve med to lokale browserklienter via realtidsserveren viste den modsatte vending ved 8 m/s. Gæsten modtog både dukning, side og den valgte besætningsposition. [Browserprøve og multiplayerdata](lokal-multiplayer.json)
- Fart og stabilitet er spilkalibreringer. De fem profiler bruger reduceret hydrodynamik og estimerede inertimomenter. Data er fra simulering og er ikke målt på virkelige både. Vindmodellen har ingen særskilt acceleration af vinden gennem smalle sunde. [Bådprofiler og fuld modelbeskrivelse](../fysik/README.md)

Revision `e154e3f55297` er verificeret på localhost. 22 Node-tests og 62 browsertests bestod.

Målingerne kan køres igen med `node scripts/handling-review.cjs http://localhost:4173/ <fil> polar`, `tacks` eller `lee`. Optagelsen kan genskabes med `FRI_VIND_URL=http://localhost:4173/ node scripts/record-laser-tack.cjs`.
