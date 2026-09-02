# SuperSafe

En svensk fondanalys-pilot som visar rapporterade fondinnehav och innehavskoncentration.

## Fonddata

Pilotens riktiga fonddata kommer från Finansinspektionens öppna register över svenska
värdepappersfonders innehav. Nuvarande data avser 2026 Q2, med rapportdatum
2026-06-30 och publiceringsdatum 2026-08-20.

Källa: https://www.fi.se/sv/vara-register/fondinnehav/

Marknadssignaler är ännu inte anslutna. Demofondernas sannolikheter är fortsatt
tydligt märkta som demodata.

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

## Uppdatera FI-data

Ladda ned och packa upp FI:s senaste kvartalsfil och kör sedan:

```powershell
.\scripts\import-fi-funds.ps1 `
  -InputDirectory '.\work\fi-YYYYqN' `
  -OutputFile '.\public\data\fi-funds-YYYYqN.json'
```
