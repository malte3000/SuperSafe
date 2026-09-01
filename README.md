# SuperSafe

En svensk fondanalys-pilot som visar rapporterade fondinnehav och innehavskoncentration.

## Fonddata

Pilotens riktiga fonddata kommer från Finansinspektionens öppna register över svenska
värdepappersfonders innehav. Nuvarande data avser 2026 Q2, med rapportdatum
2026-06-30 och publiceringsdatum 2026-08-20.

Källa: https://www.fi.se/sv/vara-register/fondinnehav/

Marknadssignaler är ännu inte anslutna. Demofondernas sannolikheter är fortsatt
tydligt märkta som demodata.

## Uppdatera FI-data

Ladda ned och packa upp FI:s senaste kvartalsfil och kör sedan:

```powershell
.\scripts\import-fi-funds.ps1 `
  -InputDirectory '.\work\fi-YYYYqN' `
  -OutputFile '.\public\data\fi-funds-YYYYqN.json'
```
