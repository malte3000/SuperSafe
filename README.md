# SuperSafe

En svensk fondanalys-pilot som visar rapporterade fondinnehav och innehavskoncentration.

## Fonddata

Pilotens riktiga fonddata kommer från Finansinspektionens öppna register över svenska
värdepappersfonders innehav. Nuvarande data avser 2026 Q2, med rapportdatum
2026-06-30 och publiceringsdatum 2026-08-20.

Källa: https://www.fi.se/sv/vara-register/fondinnehav/

Marknadssignaler är ännu inte anslutna. Demofondernas sannolikheter är fortsatt
tydligt märkta som demodata.

## Sökning

Huvudsökningen och fondjämförelsen använder samma matchningsregler i `lib/funds/fi-funds.ts`:
diakritiska tecken, extra mellanslag och skiljetecken normaliseras; sökord kan
stå i valfri ordning; hela ordet `LF` utökas till `Länsförsäkringar`.
Sökningen matchar fondnamn, fondbolag och ISIN. Identifierare får formateras
med mellanslag/bindestreck men stavfel i ISIN korrigeras inte automatiskt.

Huvudfältet visar sex träffar först, sedan tolv till per klick på Visa fler.
Fondjämförelsens rullbara lista har inte längre en gräns på 30 träffar.
Exakt fondnamn/ISIN eller en ensam träff kan öppnas direkt; annars måste användaren
välja rätt fond. Demo kräver uttryckligt val eller exakt demonamn.
Inga nya fonder har lagts till i detta steg. Saknat underlag skiljs från laddningsfel.

Söktester: `node --test tests/fund-search.test.mjs` (Node 24).

## Jämför fondinnehav

På startsidan väljs två FI-fonder i sökbara fält. Gemensam vikt är summan av
`min(vikt i fond 1, vikt i fond 2)` för varje exakt matchande ISIN. Dubbletter
summerar sina vikter innan matchning. Olika aktieslag slås inte ihop och
underliggande fondinnehav eller derivat genomlyses inte.

Jämförelsen omfattar bara tillgängliga positioner med giltigt ISIN och redovisar
identifierad fondvikt för respektive fond. Den normaliserar aldrig upp till 100 %.
Noll träffar betyder inte att hela fonderna är olika. Samma fond, olika rapportdatum,
negativa eller icke-finita vikter och summerad innehavsvikt över 100,1 % blockeras.
Gränsen tillåter liten avrundning i rapporterade vikter.

Tester: `node --test tests/overlap.test.mjs tests/ppm-ranking.test.mjs` (Node 24).

## Daglig topplista för premiepension

`/api/funds/top-daily` hämtar Pensionsmyndighetens offentliga kurslista:
https://static.pensionsmyndigheten.se/fond/kurser.csv

Listan omfattar endast jämförbara premiepensionsfonder, inte alla svenska fonder.
Förändringen beräknas som `(säljkurs i SEK / föregående vardags säljkurs i SEK - 1) * 100`.
Kurserna är inte utdelningsjusterade och är alltså inte totalavkastning.
Källan släpar normalt 1–2 dagar efter; jämförelsedatum och antal fonder visas alltid.
Helgdagar med saknad vardagskurs hoppas konservativt över, aldrig som en dags förändring.

CSV-filen innehåller endast senaste kurs per fond. En verifierad första hämtning
finns i `lib/funds/ppm-baseline.json`. Fram till två jämförbara kursdagar för minst
fem fonder finns visar sidan ett vänteläge, utan konstruerade kursförändringar.
Lyckade hämtningar sparas i R2-bindningen `PPM_DATA` (lokalt i Wrangler-lagringen).
API-anrop hämtar nytt underlag högst en gång i timmen efter en lyckad hämtning.
Sidan anropar API:t vid öppning, manuellt och varje timme medan sidan är öppen.
Det finns inget fristående bakgrundsjobb: sidan behöver användas på flera kursdagar.
Vid källfel behålls senaste lyckade underlag och en varning visas.

Beräkningstester (Node 24): `node --test tests/ppm-ranking.test.mjs`.
`SITE_ORIGIN` kan sättas till den betrodda publicerade sidans origin för delningsmetadata.

## Fonder att undersöka närmare

`/api/funds/watchlists` ger två avgiftsbaserade urval med högst tio fonder vardera:
”Fonder att hålla koll på” och ”Fonder att granska extra”. Första versionen omfattar
bara Pensionsmyndighetens fondtorg och årliga avgifter **efter premiepensionsrabatt**.
Avgifterna gäller inte ett vanligt fondkonto/ISK. Urvalet är inte köp-/säljråd,
en prognos för månaden eller en sammanvägd kvalitetsbedömning.

Källa: https://www.pensionsmyndigheten.se/service/fondtorg/
Offentlig datakälla: https://www.pensionsmyndigheten.se/service/fondtorg/api/searchFunds?resultSize=1000

Reglerna finns i `lib/funds/watchlists.ts`. Minst fem fonder med känd avgift och
utan statusmeddelande krävs inom samma officiella fondtyp och kategori.
Medianen beräknas av SuperSafe, inklusive den bedömda fonden. För bevakningslistan
krävs minst 25 % och 0,05 procentenheter lägre avgift än medianen; granskningslistan
kräver motsvarande högre avgift. Median noll ger inget urval. Rangordning görs på
relativ avgiftsavvikelse, fondnummer avgör lika värden. Högst två per kategori
och tio per lista visas. Saknade platser fylls aldrig med påhittade fonder.
Kategorier kan innehålla olika strategier/risker. Avkastning och innehav ingår inte.

”Jämför fonden” visar avgifterna för urvalets jämförbara PPM-fonder i kategorin,
separat från FI-jämförelsen av innehav. Källänkar och hämtningstid visas.
Verifierat startunderlag finns i `lib/funds/watchlist-baseline.json`.
Nytt underlag hämtas vid användning när senaste lyckade hämtning är äldre än sex
timmar och sparas i R2 `PPM_DATA`, nyckel `watchlist/latest.json`.
Sidan läser vid öppning, manuell uppdatering och var sjätte timme medan den är öppen.
Det är inget fristående bakgrundsjobb. Källfel behåller senaste lyckade underlag
med en varning; underlag äldre än sju dagar döljs. Hämtningstid är inte ett
löfte om avgiftens giltighetsdatum. Ofullständiga källsvar avvisas.

Tester: `node --test tests/watchlists.test.mjs` (Node 24).

## Uppdatera FI-data

Ladda ned och packa upp FI:s senaste kvartalsfil och kör sedan:

```powershell
.\scripts\import-fi-funds.ps1 `
  -InputDirectory '.\work\fi-YYYYqN' `
  -OutputFile '.\public\data\fi-funds-YYYYqN.json'
```
