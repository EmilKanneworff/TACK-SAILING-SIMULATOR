# FRI VIND: baseline og afprøvning

17. november 2026. Originalfil: `index (11).html`, 4.807.915 byte, SHA-256 `eef748aa1cc79dd494df5197962d57d764294dd7b293f4ec71ca6ceaa2d120f2`. Ingen Git-mappe fandtes. Spilfilen er uændret; Three.js-licensen er bevaret.

## Arkitektur

Dokumentation i HTML-kommentarer indleder filen; den anden kommentar indeholder store historiske testdata. Stil og UI følger før 11 scriptblokke: Three.js inkl. MIT-licens (linje 388), båddata (424), verden (673), grundfysik (785), foils (1122), opretning (1454), vejr (1613), bane (1702), kort (1899), 3D-scene (2283) og hovedprogram (3464). `SAILING_GAME` eksponerer tilstand, miljø, bane, scene, kort, spor, pause og numeriske selvtests. Input fødes til 1/60 s fysik; foilmodellen bruger deltrin på højst 1/240 s; scene og kort læser den interpolerede tilstand. Banemodellen bruges til bane, kort og registrering. Hovedloop og watchdog opdaterer opretning med monoton tid.

## Nye resultater

Chrome 157.0.8103.79, headless, SwiftShader, direkte `file://`, desktop 1440×900 og 1100×800 samt 390×844. Dette er automatiseret browserafprøvning; screenshots er visuelt gennemset, ikke manuel sejlads. Kun den lokale HTML blev anmodet under en observeret start. Tre.js udsendte en deprecation-advarsel; ingen observerede JavaScript-fejl eller shaderfejl under de udførte scenarier. De 13 indbyggede numeriske selvtests bestod ved den nye kørsel. Dette siger ikke noget om uudførte scenarier.

- Laser: 1,5 s venstre gav positiv vinkelhastighed; begge pile gav neutral kommando og ca. nul vinkelhastighed; højre gav negativ vinkelhastighed; slip gav næsten neutralt ror. Position 3 ændrede tilstanden med gradvis animation; pause standsede fysikken.
- Fem opretninger med starttilstanden manuelt sat til ca. 109–115° hældning: Laser 3,1152 s; sportsjolle 3,1188 s; yacht 3,1144 s; AC75 3,1119 s; AC72 4,4047 s. Sidstnævnte brugte kontrolleret afslutning. Dette er ikke en øvre grænse for alle tilstande.
- Isoleret numerisk kontrol med kunstig monoton tid: gentaget start bevarede den første starttid; første opdatering efter et simuleret 5,1 s ophold afsluttede straks opretningen. 5,1 s er et konstrueret inaktivt hul, ikke en aktiv browsermåling.
- Gatebanens forhåndsvisning og nedtælling blev åbnet. Under pause faldt nedtællingen ca. 1,5 s, mens fysiktiden stod stille. Kortet reagerede på zoom og træk, og styrepil virkede med kortet i fokus. En syntetisk blur-hændelse satte spillet på pause; en faktisk fanesuspension blev ikke afprøvet.
- `baseline.png` er den uændrede startvisning; `sailing.png`, `mobile.png`, `race.png` og `race-mobile.png` viser de nye browserkørsler. Billederne viser ingen åbenlys opstartsfejl i de kontrollerede viewport-størrelser, men udgør ikke en fuld visuel gennemgang.

Ingen konkret reproduceret fejl blev rettet. Følgende dele mangler stadig før den ønskede fulde gennemgang er færdig: reel sejlads på begge halser, vindøje og bakning; fokus/tab af holdte taster på tværs af rigtig faneskift; bådskift og genstart under sejlads; systematisk test af trim og alle besætningspositioner; reel takeoff, foiling, sving og touchdown; mere varierede kæntringer og styring efter redning; fulde baner med tyvstart, rettelse, alle rundinger og mål; beregningsmæssig måling af billed- og fysikydelse; flere skærmstørrelser, browsere og fysisk GPU. En testserver er heller ikke afprøvet. Ingen historiske testresultater er behandlet som nye beviser.

## Gentagelse

Testene er arbejdsfiler og ingen runtimeafhængighed. På macOS med Chrome installeret og Node.js kan Playwright Core installeres uden for repoet med `npm install --prefix /tmp/fri-vind-review playwright-core`, og et script kan køres med `NODE_PATH=/tmp/fri-vind-review/node_modules node gennemgang/test.js`. Scripts bruger direkte filåbning og gemmer billeder i denne mappe. `more.js` tester fem opretninger samlet med `test.js`. Forløb påvirkes af maskinens renderingstempo og er ikke en fuld regressionssuite.
