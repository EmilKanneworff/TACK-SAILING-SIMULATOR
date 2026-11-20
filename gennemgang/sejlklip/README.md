# Sejlklip

Klip optaget lokalt i Chrome fra spillets faktiske renderer og fysik. `node scripts/record-sails.cjs` genskaber dem; et eller flere klip kan vælges ved at tilføje deres filnavn uden endelse. Scenarierne placeres først på åbent vand og får én indledende kurs og fart. Derefter styres båden med normale tastetryk; dette er ikke optagelser af manuelle ture eller af seks spillere.

- `laser-trim.webm`: indhaling og udslækning af Laserens storsejl.
- `vindpust.webm`: det fælles vindfelt med kraftige, deterministiske variationer.
- `stagvending.webm` og `bomning.webm`: almindelige rorinput; den målte simulation registrerede henholdsvis én vending og én bomning.
- `spiler.webm`: sætning, overtrimning, genfyldning og nedtagning. Fyldningsgraden blev målt til ca. 0,61 → 0,23 → 0,65, mens sejlet var oppe.
- `code0.webm`: sætning, trim og nedtagning af det fladere forsejl.
- `rig-ac75.webm` og `rig-ac72.webm`: monohullens dobbelte, bløde storsejl og katamaranens stive vinge under trim og styring. De indledes med fart; klippene dokumenterer ikke et fuldt foilløb.
