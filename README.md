# SuperSafe

En svensk fondanalys-pilot som visar rapporterade fondinnehav och innehavskoncentration.

## Fonddata

### Mina fonder (webbläsarlokala favoriter)

Stjärnor i FI-sökresultat, vald fond, innehavsjämförelse, PPM-topplista och
avgiftslistor sparar genvägar i `supersafe:favorite-funds:v1` i localStorage.
Användaren har valt denna enhetslokala första version: inget konto, ingen
synkning mellan enheter och ingen serverlagring av favoriter. Endast källa,
identifierare och visningsnamn sparas, inte kurser, innehav eller sparbelopp.
Rensad webbplatsdata eller avslutat privat läge kan radera listan.

FI identifieras med datasetets exakta fond-ID och PPM med sexsiffrigt fondnummer.
Källorna hålls åtskilda; namn används aldrig för automatisk ihopslagning.
Demoexempel kan inte sparas. Saknade FI-fonder behålls som markerade genvägar,
inte som gamla innehavsdata. FI-favoriter öppnar aktuell tillgänglig analys;
PPM-favoriter öppnar Pensionsmyndighetens fondfakta och utlovar inte FI-täckning.

Listan valideras och begränsas till 100 poster. Lagringsfel annonseras utan
falsk sparbekräftelse. Inläsning sker före skrivning, och ändringar i andra flikar
läses via storage-händelser. Samtidiga skrivningar mellan flikar är inte
transaktionella. Okänt/skadat lagringsformat skrivs inte automatiskt över.
Tester: `node --test tests/favorites.test.mjs`.

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

## Portföljöversikt

Under Mina fonder kan användaren välja 2–10 unika FI-fonder och ange andelar
som tillsammans är exakt 100 %. FI-favoriter kan läggas till som genvägar;
PPM-favoriter matchas inte med namn. Valen är tillfälligt React-tillstånd:
inga sparbelopp krävs, inget skickas till servern och inget sparas vid omladdning.

`lib/funds/portfolio.ts` beräknar varje instruments portföljandel som summan av
`angiven fondandel * rapporterad innehavsvikt / 100`. Exakt ISIN matchas med
samma indexering som fondjämförelsen; upprepade positioner inom en fond summeras
först. Andelar anges med högst två decimaler, komma eller punkt, och valideras
som heltal i hundradelar av en procent. Fördela lika är en uttrycklig åtgärd;
resterande hundradelar tilldelas fonderna i listordning, aldrig dolt i beräkningen.

Resultatet visar identifierad täckning, okänd andel (inte kontanter), de tio
största kända positionerna, alla återkommande ISIN och varje fonds bidrag.
Ingen uppskalning av ofullständigt underlag, aktieslags-/bolagssammanslagning,
genomlysning av fonder/derivat eller risk-/avkastningsprognos görs. Vikterna
gäller hela den angivna portföljen och kombineras med historiska FI-innehav.

Olika/ogiltiga rapportdatum, ogiltiga vikter, dubbla fonder och ofullständig
fördelning döljer resultatet direkt. Summerade innehavsvikter över 100 %
(bortsett från flyttalsbrus) blockeras striktare än i parjämförelsen för att
undvika täckning över 100 %. Även avrundade källvärden kan utlösa spärren.
Tester: `node --test tests/portfolio.test.mjs`.

## Förklaringar på vanlig svenska

Giltiga FI-resultat får en deterministisk textförklaring vid den enskilda
fondanalysen, fondjämförelsen och portföljöversikten. Procentandelar översätts
till räkneexempel per 100 kronor. Texterna använder bara samma validerade vikter,
ISIN-matchningar, täckning och rapportdatum som redan visas; de anropar ingen
språkmodell och hittar inte på marknadsdata, riskbetyg eller prognoser.

Förklaringarna skiljer uttryckligen innehav från uppgång eller nedgång, visar att
okänd täckning inte är samma sak som kontanter och varnar för att noll hittad
överlappning inte bevisar god riskspridning. En fondförklaring döljs om datum
eller vikter är ogiltiga. Jämförelse- och portföljförklaringar visas endast när
respektive befintlig beräkning har status `ready`. Kronorna är proportionella
exempel, inte användarens faktiska saldo eller investeringsrådgivning.
Tester: `node --test tests/explanations.test.mjs`.

## Avgiftskalkylator

Kalkylatorn jämför två manuellt angivna årliga fondavgifter med samma
startkapital, månadssparande, spartid och antagna avkastning före avgifter.
Inmatningen är tillfälligt React-tillstånd och skickas inte till servern eller
sparas vid omladdning. Inga avgifter kopplas automatiskt till en fond eller
ett kontoslag, eftersom exempelvis premiepensionens rabatterade avgift kan
skilja sig från avgiften på den öppna marknaden.

Beräkningen omvandlar den årliga avkastningen till en geometriskt motsvarande
månadsutveckling. Sedan dras `årlig avgift / 12` från månadens kapital och
månadssparandet läggs till sist i månaden. Den visar uppskattat slutvärde,
uppskattat löpande avgiftsavdrag och total avgiftseffekt jämfört med samma
scenario utan fondavgift. Den totala effekten inkluderar även utebliven
avkastning på avgifterna och är därför inte samma sak som avgifterna som dras.

Modellen är avsiktligt förenklad: verkliga fondavgifter beräknas normalt
dagligen, avkastningen är inte jämn och framtida avkastning är okänd. Skatt,
valuta, köp-/säljkostnader, plattformsavgifter, prestationsavgifter, rabatter
och framtida ändringar ingår inte. Användaren hänvisas till fondens faktablad
och Pensionsmyndighetens officiella information:
https://www.pensionsmyndigheten.se/forsta-din-pension/valj-och-byt-fonder/avgifter-och-rabatter-inom-premiepensionen

Inmatningsgränserna är 0–100 miljoner kronor i startkapital, 0–1 miljon kronor
i månaden, 1–50 hela år, −20–20 procent avkastning och 0–10 procent avgift.
Komma eller punkt accepteras med högst två decimaler; exponent-, hex-,
plus- och icke-finita format avvisas. Minst ett av sparbeloppen måste vara
större än noll. Ogiltig inmatning döljer samtliga resultat direkt.
Tester: `node --test tests/fee-calculator.test.mjs`.

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
Ett separat GitHub Actions-jobb samlar dessutom kurser fyra gånger per dygn,
utan sidbesök eller en påslagen personlig dator. Se `scripts/PPM-COLLECTION.md`.
Sidan läser jobbets offentliga historik högst en gång i timmen och sparar en
senast fungerande kopia i R2. Senaste bakgrundsinsamling visas separat från
kursdatum, med varning efter 18 timmar utan ny insamling. GitHub kan försena
körningar; schemat är ingen leveranstidsgaranti. Avgiftslistorna och FI-data
omfattas inte av detta insamlingsjobb.
Vid källfel behålls senaste lyckade underlag och en varning visas.

Beräkningstester (Node 24): `node --test tests/ppm-ranking.test.mjs`.
`SITE_ORIGIN` kan sättas till den betrodda publicerade sidans origin för delningsmetadata.

## Datakontroller

PPM-kursflödet och GitHub-insamlingen använder samma `assertPpmUpdate`:
giltiga unika sexsiffriga fondnummer, positiva decimaltal (inte exponent-/hexformat),
giltiga kursdatum som inte ligger efter hämtningen, högst 2 000 och minst 100 rader.
En uppdatering avvisas om över 20 % av tidigare fondnummer försvinner eller något
matchande fondnummer får ett tidigare kursdatum. Hela tidigare underlaget behålls;
felorsak visas på sidan. Även verkliga utbudsändringar/korrigeringar kan stoppas och
behöva manuell granskning. Ingen automatisk sänkning av gränserna görs.

Rankningen matchar PPM-fondnummer och jämför normaliserade namn (skiftläge och
mellanslag ignoreras, inte andelsklassbeteckningar). Ändrade namn eller absolut
dagsförändring över 25 % flaggas och utesluts med motivering och fondlänk. Gränsen
är SuperSafes tekniska granskningsregel, inte ett påstående att siffran är fel.
Underliggande observationer bevaras. Om färre än fem återstår visas ingen topplista
för jämförelsen och ingen äldre topplista används för att dölja spärren.
Saknade föregående vardagskurser redovisas separat. Valutan är SEK enligt den fasta
PPM-källan och arkivets valutaschema; ingen växling eller ISIN-andelsklasskoppling görs.

Avgiftsflödet avvisar uppdateringar som tappar över 20 % av tidigare fondnummer
eller antalet kända avgifter. Befintliga åldersgränser, källmarkeringar och
snabbvisning gäller fortfarande. Kontrollerna garanterar inte riktiga källvärden
eller framtida fondavkastning. FI-import och prognosmodeller ändras inte i detta steg.

## Snabb visning och uppdatering

### Tydliga datum (steg 4)

Topplistan visar kursdatumet för den faktiskt visade jämförelsen separat från
senaste lyckade kurshämtningen. I vänteläget visas i stället senaste kursdatum
i underlaget; det innebär inte att alla fonder har detta datum. Hämtningstider
visas med klockslag i Europe/Stockholm, även om besökaren är i en annan tidszon.
En ny hämtning flyttar inte fram kursdagen och ändrar inte befintliga åldersgränser.

Avgiftslistorna visar uttryckligen att giltighetsdatum saknas i vårt källunderlag.
FI-innehav och innehavsjämförelsen skiljer på rapportdatum och källans
publiceringsdatum. FI-hämtningstid saknas i befintligt underlag och visas som
okänd; sidans laddningstid eller filens ändringstid används inte som ersättning.
Ingen ny dataleverantör eller prenumeration införs i detta steg.

### Sparat underlag först

Daglig topplista och avgiftslistor använder två steg vid öppning och uppdatering.
Vanlig GET läser enbart redan sparade R2-underlag (eller verifierat startunderlag)
och gör inga externa anrop eller skrivningar. Datumen, åldersgränserna och kända
källfel beräknas/visas även i denna snabba väg. Den väntar inte på en pågående
extern hämtning. Därefter gör klienten GET med `?refresh=1`, som behåller
befintliga intervall för källhämtning. Sparat innehåll går att använda under
kontrollen. Ett fel raderar inte redan visade uppgifter; en varning visas.

Anropen är `no-store` på HTTP-nivå: vår serverlagring är cachen, så webbläsarens
cache får inte dölja nya fel eller gammalt underlag. Hämtningstider ändras endast
vid lyckad källhämtning. Snabbare visning innebär inte färskare marknadsdata.
Återkomst till en tidigare öppen flik kontrollerar underlaget igen. Avbrutna
eller ersatta anrop får inte skriva in sena resultat. Ingen kurs- eller avgiftshistorik
sparas i localStorage; bara användarvalda favoritgenvägar. Bakgrundsuppdateringen i webbläsaren är separat från GitHub-jobbet,
som fortsätter samla kursdata även utan sidbesök. FI-sökningen ändras inte.

Tester: `node --test tests/fund-fast-read.test.mjs tests/progressive-fetch.test.mjs`.

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
