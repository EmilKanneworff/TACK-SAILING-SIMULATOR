# TACK multiplayer på Render Free

[Spil TACK](https://tack-sailing-simulator.vercel.app/) · [Render health](https://tack-sailing-live.onrender.com/health) · [Optagelse fra den offentlige version](TACK-online-to-spillere.mp4)

Vælg **Sejl sammen → Opret spil**. Del den sekscifrede kode eller invitationslinket. Gæsten indtaster navn og deltager. Værten vælger Fri sejlads, Op/ned eller Trekant og starter for begge. Der er plads til værten og én gæst.

## Build og drift

| Del | Version eller konfiguration |
|---|---|
| Frontend på Vercel | `3b04ae593054` |
| GitHub main | `f38a9812f885edb48af50ea0a0add57a8b299c02` |
| Render-serverbuild | `3dcd09cfc3231e3ea8d5a0bde4111fdddbfe7faa` |
| Live-protokol og verden | `3` og `faaborg-quarter-1` |
| Vercel Production og Preview | `VITE_REALTIME_URL=wss://tack-sailing-live.onrender.com` |
| Render Free i Frankfurt | Én instans på main med manuel deploy og startkommandoen `TACK_LIVE_AUTHORITY=browser npm run realtime` |

Den gamle Vercel-udgave byggede en tom live-adresse ind i `assets/config.js`. Den lokale lobby og det tidligere WebSocket-relæ kunne bruges med en selvkonfigureret adresse. Production og Preview indlæser nu den krypterede Render-forbindelse ved build.

Render holder lobby, koder, forbindelser, adgang og indstillinger. Værtens Web Worker kører den fælles fysik og følger startlinje, rundinger og mål. Render videresender bådenes tilstande og samler resultatlisten. Node kan også køre samme model med faste trin på 1/60 sekund i det lokale servermiljø.

Værtens fane skal forblive åben. En plads reserveres i 30 sekunder ved afbrydelse. Hvis værten forlader under sejladsen, får gæsten værtsrollen og kan starte igen fra lobbyen. Genstart af Render afslutter lobbyer i hukommelsen. Gratisinstansen kan gå i dvale ved inaktivitet. [Render om gratisinstanser](https://render.com/docs/free)

Koden er merged til main gennem [multiplayerændringen](https://github.com/EmilKanneworff/TACK-SAILING-SIMULATOR/pull/9) og [rettelsen af banevalget](https://github.com/EmilKanneworff/TACK-SAILING-SIMULATOR/pull/10).

## Efterprøvning den 22. november 2026

| Forsøg | Resultat |
|---|---|
| Render Free med serverfysik, seks blandede både | 0,23 sekunders simulation på 7,50 sekunder i realtid i det målte udsnit. |
| Render Free med serverfysik, to Laserjoller og normal sø | 5,18 sekunders simulation på 14,81 sekunder i realtid. |
| Offentlig gratisversion med to Laserjoller | 3,70 sekunders simulation på 3,73 sekunder i realtid i en kort styreprøve. Gæstens ror og båd reagerede, og værten så båden dreje. |
| Offentlig kapacitet og lobby | Invitation udfyldte koden. To deltagere blev accepteret. Den tredje fik besked om, at lobbyen var fuld. |
| Offentlig mobilvisning | Invitation, touchdeltagelse og fælles sejlads bestod i emuleret mobilvisning på 390 × 664. |
| Offentlig gendannelse | Gæsten genindlæste og vendte tilbage med samme spilleridentitet. Da værten forlod en aktiv sejlads, kom gæsten tilbage i lobbyen som vært. |
| Offentlig fælles bane og start | Op/ned og Trekant blev startet for begge klienter med samme bane og samme nedtælling. Den afsluttende prøve skiftede direkte mellem banerne. |
| Offentlig WebSocket | Health og en rigtig WSS-oprettelse bestod. To lobbyer bevarede forskellige vindindstillinger. Den tidligere protokol blev afvist med en besked om versionsforskel. |
| Lokale prøver | 44 Node-prøver og fem målrettede browserprøver bestod. Begge baner blev gennemsejlet til mål enkeltvis i den delte fysikmodel. |

Den optagede browserprøve blev kørt i to separate Chrome-profiler på den samme Mac. Fælles målgang for to spillere er stadig ikke verificeret på den offentlige tjeneste. Et lokalt tospillerforløb med en testpilot registrerede målgang for den ene båd på begge baner. Den anden pilots kørsel kom ikke frem til mål i prøveperioden.
