# FRI VIND – visuel kontrol

Kørslen bruger den normale kameravisning i spillet, Laserjollen, standardvejret, høj grafik, 1280 × 720 og pixelratio 1. `scripts/visual-qa.cjs` udfører den samme måling igen. Målingerne er browserens `requestAnimationFrame`, ikke en måling af uudnyttet GPU-kapacitet; en opdateringsgrænse omkring 60 Hz sætter derfor et loft. Computer: MacBook Pro med Apple M5 og 32 GB RAM. Browser og WebGL-renderer er angivet præcist i JSON-filerne.

## Konkret status

- Bådene bygges af redigerbar programmatisk geometri i `index.html`, med Three.js r160. Skrogmaterialet har nu et særskilt gelcoatlag; katamaranens kulfiber har en separat overflade. Dæk og sejl har egne ruheds- og bumpmaterialer. Sol, skyer, båddekaler og sejl er farveteksturer i sRGB; bumpteksturer er data.
- Vandfladens store bølger bruger samme analytiske felt som fysikken. De små krusninger er kun grafiske og aftager med afstanden. En bredere solrefleks er tilføjet; den ændrer ikke bølgerne eller kræfterne.
- Laserens vandmaske følger cockpittets tilspidsning ved overskylning. Den tørre åbning holdes fortsat fri for vand. Den grafiske maske og CPU-kontrollen er begge opdateret; hverken foilernes fysik eller styring er ændret.
- Træernes individuelle farver varierer på samme faste kystgeometri. Bådvælgerens fem billeder er lavet ud fra de faktiske spilmodeller med `scripts/boat-presentations.cjs`.
- De konkrete Laser- og Melges-referencer og eksisterende formvurdering ligger i `../modelkontrol/`. Før- og efterbillederne viser ikke nødvendigvis et fuldstændigt match af perspektiv, bådbevægelse og solposition; de er ikke målfast dokumentation for lighed.

## Resterende afvigelser

Laserens besætning er fortsat en forenklet, proceduremæssig figur. Den er ikke på samme detaljeniveau som mennesket på referencebilledet. Laserens cockpitkanter og skrog bør fortsat modelleres og kontrolleres mod et bedre matchet referencekamera. Racerens åbne hæk, skrogprofil og udstyr er ikke endeligt godkendt mod Melges-billederne. Også turbåd og foilbåde har fortsat stiliseret geometri og overflader. Vandets refleksion er en shaderbaseret tilnærmelse, ikke en fuld spejling af omgivelserne. Optagelsen bruger tastaturinput; de observerede sideændringer fremgår af målingens JSON og må ikke antages ud fra videoens titel alene.
