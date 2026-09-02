'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowUpRight, Clock3, ExternalLink, Info, RefreshCw, Trophy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverDescription, PopoverTitle, PopoverTrigger } from '@/components/ui/popover';
import { PPM_SOURCE_URL, PPM_COLLECTION_URL, type PpmRanking } from '@/lib/funds/ppm-ranking';

const percent = new Intl.NumberFormat('sv-SE', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: 'exceptZero' });

function displayDate(value: string) {
  return new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Stockholm' }).format(new Date(value));
}

export function DailyTopFunds() {
  const [ranking, setRanking] = useState<PpmRanking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const refresh = useCallback((signal?: AbortSignal) => {
    return fetch('/api/funds/top-daily', { signal }).then(async response => {
      if (!response.ok) throw new Error('Ranking unavailable');
      const data = await response.json() as PpmRanking;
      if (!signal?.aborted) { setRanking(data); setError(false); }
    }).catch(() => {
      if (!signal?.aborted) setError(true);
    }).finally(() => {
      if (!signal?.aborted) setLoading(false);
    });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    const timer = window.setInterval(() => { setLoading(true); void refresh(controller.signal); }, 60 * 60 * 1000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [refresh]);

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
            <p>Högst dagsförändring i Pensionsmyndighetens kurslista · SEK</p>
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
          <Button variant="ghost" size="sm" onClick={() => { setLoading(true); void refresh(); }} disabled={loading} aria-label="Uppdatera topplistan">
            <RefreshCw className={loading ? 'animate-spin' : ''} aria-hidden="true" /> Uppdatera
          </Button>
        </div>
      </div>

      <div aria-live="polite">
        {loading && !ranking && <p className="daily-top-notice">Hämtar officiella fondkurser…</p>}
        {error && <p className="daily-top-notice" role="alert">Topplistan kunde inte uppdateras. {ranking ? 'Senast hämtat underlag visas nedan.' : 'Prova Uppdatera igen om en stund.'}</p>}
        {ranking?.sourceUnavailable && <p className="daily-top-notice">Källan kunde inte nås. Senast sparade kurser visas; ingen ny dagsdata är bekräftad.</p>}
        {ranking?.stale && <p className="daily-top-notice">Äldre kursunderlag – datumen nedan gäller, inte dagens utveckling.</p>}
        {ranking?.status === 'waiting' && (
          <div className="daily-top-waiting">
            <Clock3 aria-hidden="true" />
            <div>
              <h3>Väntar på två jämförbara kursdagar</h3>
              <p>{ranking.latestQuoteDate ? `Senaste sparade kursdatum är ${displayDate(ranking.latestQuoteDate)}. ` : ''}Den officiella filen innehåller bara senaste kursen per fond. Vi behöver samla kurser från två på varandra följande vardagar för minst fem fonder innan listan kan visas.</p>
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
