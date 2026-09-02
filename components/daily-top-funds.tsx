'use client';

import { useFundData } from '@/components/use-fund-data';
import { ArrowUpRight, Clock3, ExternalLink, Info, RefreshCw, Trophy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverDescription, PopoverTitle, PopoverTrigger } from '@/components/ui/popover';
import { PPM_SOURCE_URL, PPM_COLLECTION_URL, MAX_DAILY_CHANGE_PERCENT, type PpmRanking } from '@/lib/funds/ppm-ranking';

const percent = new Intl.NumberFormat('sv-SE', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: 'exceptZero' });

function displayDate(value: string) {
  return new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Stockholm' }).format(new Date(value));
}

export function DailyTopFunds() {
  const { data: ranking, loading, refreshing, error, refresh } = useFundData<PpmRanking>('/api/funds/top-daily', 3600000);

  return (
    <section className="daily-top-card" aria-labelledby="daily-top-title" aria-busy={loading}>
      <div className="daily-top-heading">
        <div className="flex items-start gap-3">
          <span className="panel-icon safe"><Trophy aria-hidden="true" /></span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="daily-top-title">Topp 5 – senaste kursdagen</h2>
              <Badge variant="secondary">Premiepension</Badge>
            </div>
            <p>Högst dagsförändring bland fonder som klarar datakontrollerna · PPM · SEK</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger className="info-button" aria-label="Så beräknas dagens topplista"><Info aria-hidden="true" /></PopoverTrigger>
            <PopoverContent align="end" className="max-w-[calc(100vw-2rem)] p-4">
              <PopoverTitle>En kursdag, samma jämförelse</PopoverTitle>
              <PopoverDescription className="leading-5">
                Vi jämför säljkursen i SEK med föregående vardags kurs: (ny kurs / tidigare kurs − 1) × 100. Endast fonder med kurser på båda datumen ingår. Kurserna är inte utdelningsjusterade; detta är kursförändring, inte totalavkastning.
              </PopoverDescription>
              <p className="text-xs leading-5 text-muted-foreground">Kurslistan släpar normalt 1–2 dagar efter. Saknade kursdagar, exempelvis helgdagar, kan begränsa jämförelsen. Historiska vinnare är ingen prognos eller köprekommendation.</p>
            </PopoverContent>
          </Popover>
          <Button variant="ghost" size="sm" onClick={refresh} disabled={refreshing} aria-label="Uppdatera topplistan">
            <RefreshCw className={refreshing ? 'animate-spin' : ''} aria-hidden="true" /> Uppdatera
          </Button>
        </div>
      </div>

      <div aria-live="polite">
        {loading && !ranking && <p className="daily-top-notice">Hämtar officiella fondkurser…</p>}
        {refreshing && ranking && <output className="daily-top-notice block">Sparat underlag visas. Kontrollerar uppdateringar i bakgrunden…</output>}
        {error && <p className="daily-top-notice" role="alert">Topplistan kunde inte uppdateras. {ranking ? 'Senast hämtat underlag visas nedan.' : 'Prova Uppdatera igen om en stund.'}</p>}
        {ranking?.sourceUnavailable && <p className="daily-top-notice">{ranking.sourceIssue === 'coverage_drop'
          ? 'Uppdateringen stoppades: över 20 % av tidigare fondnummer saknas.'
          : ranking.sourceIssue === 'date_regression' ? 'Uppdateringen stoppades: ett kursdatum gick bakåt för samma fondnummer.'
          : ranking.sourceIssue === 'invalid_data' ? 'Nytt kursunderlag klarade inte datakontrollerna.'
          : 'Källan kunde inte nås.'} Tidigare underlag behålls. Datumen nedan gäller.</p>}
        {ranking?.stale && <p className="daily-top-notice">Äldre kursunderlag – datumen nedan gäller, inte dagens utveckling.</p>}
        {ranking?.status === 'waiting' && (
          <div className="daily-top-waiting">
            <Clock3 aria-hidden="true" />
            <div>
              <h3>{ranking.quality?.excluded.length ? 'För få fonder klarar datakontrollerna' : 'Väntar på två jämförbara kursdagar'}</h3>
              <p>{ranking.latestQuoteDate ? `Senaste sparade kursdatum är ${displayDate(ranking.latestQuoteDate)}. ` : ''}{ranking.quality?.excluded.length ? 'Efter datakontrollerna återstår färre än fem jämförbara fonder. Se de flaggade jämförelserna nedan.' : 'Den officiella filen innehåller bara senaste kursen per fond. Vi behöver samla kurser från två på varandra följande vardagar för minst fem fonder innan listan kan visas.'}</p>
              <small>Fondkurser samlas enligt schema även utan sidbesök. Listan aktiveras när tillräcklig jämförbar dagsdata finns – ingen demodata används här.</small>
            </div>
          </div>
        )}
        {ranking?.status === 'ready' && (
          <>
            <p className="daily-top-period"><Clock3 className="size-3.5" aria-hidden="true" /> {displayDate(ranking.previousDate!)} → {displayDate(ranking.date!)} · {ranking.comparedFunds} jämförbara fonder</p>
            <ol className="daily-top-list">
              {ranking.funds.map((fund, index) => (
                <li key={fund.id}>
                  <span className="daily-top-rank" aria-label={`Plats ${index + 1}`}>{index + 1}</span>
                  <a href={`https://www.pensionsmyndigheten.se/service/fondtorg/fond/${fund.id}`} target="_blank" rel="noopener noreferrer" className="daily-top-fund">
                    <span>{fund.name}<ExternalLink aria-hidden="true" /></span>
                    <small>Fondnummer {fund.id} · Läs fondfakta</small>
                  </a>
                  <strong className={`daily-top-change ${fund.changePercent < 0 ? 'negative' : fund.changePercent > 0 ? 'positive' : ''}`}>
                    {fund.changePercent > 0 && <ArrowUpRight aria-hidden="true" />}
                    {percent.format(fund.changePercent / 100)}
                  </strong>
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
      {ranking?.quality && <details className="daily-top-notice">
        <summary className="cursor-pointer font-semibold">Datakontroller · {ranking.quality.excluded.length ? `${ranking.quality.excluded.length} fondjämförelser flaggade` : 'Visa regler och täckning'}</summary>
        <p className="mt-2">{ranking.quality.date ? `Kontroll för kursdagen ${displayDate(ranking.quality.date)}. ` : ''}{ranking.quality.matchedFunds} fondnummer har kurser på båda jämförelsedatumen. {ranking.quality.missingPrevious} saknar föregående vardags kurs och ingår inte.</p>
        <p className="mt-2">Vi matchar exakt PPM-fondnummer, jämför namn och använder endast SEK-kurser från samma källa. Namnbyten och kursändringar större än ±{MAX_DAILY_CHANGE_PERCENT} % på en jämförelsedag utesluts från rankningen. Detta är SuperSafes granskningsgräns, inte ett bevis på fel eller en riskklassning.</p>
        {ranking.quality.excluded.length > 0 && <ul className="mt-3 max-h-64 list-disc space-y-2 overflow-auto pl-5">{ranking.quality.excluded.map(item => <li key={item.id}>
          <a className="underline" href={`https://www.pensionsmyndigheten.se/service/fondtorg/fond/${item.id}`} target="_blank" rel="noopener noreferrer">{item.name}</a> · {item.reason === 'identity_change' ? 'Namnet skiljer sig mellan kursdagarna' : `Observerad kursändring ${item.changePercent === null ? 'kunde inte beräknas' : percent.format(item.changePercent / 100)}`}. Ingår inte i rankningen för dessa datum.
        </li>)}</ul>}
        <p className="mt-2">Flaggade observationer sparas i historiken men blir inte automatiskt verifierade. Korrigerade källuppgifter prövas på nytt. Verkliga namnbyten eller stora kursrörelser kan också flaggas. Kurserna är inte justerade för utdelningar. Vi verifierar inte andelsklass via ISIN i denna källa och garanterar inte att uppgifterna är felfria.</p>
      </details>}
      {!!ranking?.quality?.excluded.length && <p className="daily-top-notice" role="alert">{ranking.quality.excluded.length} fondjämförelser är uteslutna och behöver granskas. Öppna Datakontroller ovan för detaljer. En eventuell topplista gäller bara återstående underlag.</p>}
      {ranking?.collection && <div className="daily-top-notice">
        <p><strong>Automatisk kursinsamling</strong> · Fyra schemalagda körningar per dygn, oberoende av sidbesök.</p>
        <p>{ranking.collection.lastSuccessAt
          ? `Senast sparad insamling: ${new Intl.DateTimeFormat('sv-SE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Stockholm' }).format(new Date(ranking.collection.lastSuccessAt))} (svensk tid).`
          : 'Ingen lyckad bakgrundsinsamling har kunnat bekräftas ännu.'}</p>
        {ranking.collection.unavailable && <p>Insamlingsarkivet kunde inte uppdateras. Tidigare underlag och direkt hämtade kurser används när de finns.</p>}
        {ranking.collection.stale && ranking.collection.lastSuccessAt && <p>Ingen ny bakgrundsinsamling har bekräftats på över 18 timmar. Kontrollera körningarna.</p>}
        <p>Insamlingstid är inte kursdatum. Schemalagda körningar kan försenas. <a className="underline" href={PPM_COLLECTION_URL} target="_blank" rel="noopener noreferrer">Se insamlingsstatus på GitHub</a></p>
      </div>}
      <div className="daily-top-footer">
        <a href={PPM_SOURCE_URL} target="_blank" rel="noopener noreferrer">Källa: Pensionsmyndigheten <ExternalLink aria-hidden="true" /></a>
        <span>{ranking?.fetchedAt ? `Underlag hämtat ${displayDate(ranking.fetchedAt)}` : 'Dagliga kurser, inte realtid'} · Inte investeringsrådgivning</span>
      </div>
    </section>
  );
}
