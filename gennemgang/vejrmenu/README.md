# Vejrmenu i FRI VIND

Åbn [spillet på localhost](http://localhost:5173/), og vælg **Vejr**. [Produktionsbuildet](http://localhost:4173/) er kontrolleret med live-tjenesten på port 3001.

## Før og efter

Den hidtidige menu ved 1366 × 900 var 400 CSS-pixels bred. Ældre kolonneregler begrænsede de seks radiogrupper til højre side af feltet, og deres valg havde faste værdier. Den nye menu er 500 pixels bred med 22 pixels indvendig afstand. Alle otte sliders er 454 pixels brede i samme visning. Navn og værdi deler første række, og kompasmarkeringerne følger sliderens trin ved 0°, 90°, 180°, 270° og 360°. Førbilledet er optaget i den tidligere kørende version, da opgaveteksten kom som en tekstfil.

| Før | Efter |
|---|---|
| [Tidligere menu](foer.png) | [Ny menu](efter.png) |

På mobil bruger sliderne et 44 pixels højt berøringsfelt. Ved 390 × 844 og ved 200 % browserzoom kunne panelet rulles lodret med lukkeknappen synlig. En ekstra layoutprøve ved 320 CSS-pixels og dobbelt tekststørrelse viste ingen overlappende felter eller vandret rulning. [Mobil](mobil.png) · [200 % zoom](zoom-200-nederst.png) · [W3C om reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html).

## Indstillinger og simulation

- **Bølgehøjde** går fra 0 til 1,50 m i trin på 0,05 m. Værdien er signifikant bølgehøjde på åbent vand, beregnet som fire gange højdespredningen i bølgespektret. Kystlæ, frit vand og lokal dybde påvirker den observerede overflade. Intervallet og den gradvise overgang i eksisterende bølger er bevaret.
- **Vindpust, regn, tåge, skydække og aftenlys** justeres i hele procentpoint. Vindpust og regn følger deres numeriske effektniveau i modellen. Aftenlys blander de eksisterende farver, lysstyrker, solelevation og eksponering fra dag til aften uafhængigt af skydække, regn og tåge.
- **Vind fra** har samme fysiske retning ved 0° og 360°. Håndtaget kan blive stående ved 360°, og vinden drejer den korteste vej over nord. Vindpilene viser lokal vind og er slået til som standard. Valget **Vindpile Til/Fra** står stadig i den personlige menu.
- Gamle søtrin er migreret til 0, 0,35 og 0,85 m, og Dag og Aften til 0 og 100 %. Gemte numeriske mål bevares. En tidligere gemt bølgeværdi som 0,36 m vises og bruges stadig, mens selve håndtaget følger de nye trin på 0,05 m ved næste justering. Løbsrekorder fra gamle vejrtrin vises ved de tilsvarende præcise mål.
- Ved pause opdateres målindstillingerne med det samme. Ved en ændring af vinden mærkes den senest simulerede måling **Ved båden før ændring**. Den fælles simulation bruger de nye mål, når solosejladsen fortsætter.

## Multiplayer

To Chrome-klienter brugte produktionssiden og den samme live-tjeneste. Gæstens otte felter var låst og viste værtens numeriske mål. Under et testtræk med 61 inputhændelser blev værtens render-loop kort holdt i ro for at skelne normale snapshots fra beskeder udløst af betjeningen. Der kom ingen ekstra snapshots under træk og ét på slip. Gæsten modtog 37 % vindpust og beholdt 0,45 m bølger. Når simulationen kører, følger mellemværdierne med de normale snapshots. [Målinger og modtagne værdier](kontrol.json).

De 21 Node-prøver og de målrettede browserprøver for vejr, bølger, læ, layout, pauser og multiplayer bestod. Højdekontrollen sammenlignede også 0,45 m med spredningen fra 2.048 prøver af den beregnede overflade på åbent vand.
