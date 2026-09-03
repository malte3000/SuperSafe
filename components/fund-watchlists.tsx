'use client';

import { useEffect, useRef, useState } from 'react';
import { useFundData } from '@/components/use-fund-data';
import { DataFreshness } from '@/components/data-freshness';
import { FavoriteButton } from '@/components/fund-favorites';
import { formatFetchTime } from '@/lib/funds/freshness';
import { Binoculars, SearchCheck, RefreshCw, ArrowRight, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableHead, TableRow, TableBody, TableCell, TableCaption } from '@/components/ui/table';
import { WATCHLIST_SOURCE, WATCHLIST_FEES_SOURCE, watchCategoryKey, type WatchCandidate, type WatchlistData } from '@/lib/funds/watchlists';

const number = (value: number) => new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 3 }).format(value);
const percent = (value: number) => `${number(value)} %`;
const factUrl = (id: string) => `https://www.pensionsmyndigheten.se/service/fondtorg/fond/${id}`;

function WatchColumn({ kind, funds, fetchedAt, onCompare }: { kind: 'watch' | 'review'; funds: WatchCandidate[]; fetchedAt: string; onCompare: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const watching = kind === 'watch';
  const Icon = watching ? Binoculars : SearchCheck;
  return <article className={`watch-column ${kind}`} aria-labelledby={`watch-${kind}-title`}>
    <div className="watch-column-heading"><Icon aria-hidden="true" /><div>
      <h3 id={`watch-${kind}-title`}>Fonder att {watching ? 'hålla koll på' : 'granska extra'}</h3>
      <p>{funds.length} fonder · Avgift {watching ? 'under' : 'över'} kategorins median</p>
    </div></div>
    {funds.length === 0 && <p className="watch-notice">Inga fonder uppfyller urvalskriterierna just nu. Listan fylls inte ut med osäkra kandidater.</p>}
    <ul id={`watch-${kind}-list`} className="watch-cards">
      {(expanded ? funds : funds.slice(0, 3)).map(fund => <li key={fund.id} className="watch-fund">
        <Badge variant="outline">{fund.category}</Badge>
        <h4>{fund.name}</h4>
        <FavoriteButton fund={{ source: 'ppm', id: fund.id, name: fund.name }} />
        <div className="watch-fee"><strong>{percent(fund.fee)}</strong><span>per år efter PPM-rabatt</span></div>
        <p className="watch-reason"><strong>Varför med?</strong> Avgiften är {number(Math.abs(fund.difference))} procentenheter {watching ? 'lägre' : 'högre'} än medianen {percent(fund.median)} bland {fund.peerCount} fonder i samma kategori och fondtyp i underlaget.</p>
        <p className="watch-caution">{watching ? 'Låg avgift säger inget säkert om framtida avkastning. Kontrollera risk, placeringsinriktning och spartid.' : 'Högre avgift är inte i sig ett skäl att sälja. Förvaltningssätt och strategi kan skilja sig mellan fonderna.'}</p>
        <div className="watch-card-actions"><Button variant="outline" onClick={() => onCompare(fund.id)} aria-label={`Jämför ${fund.name} med kategorin`}>Jämför fonden <ArrowRight aria-hidden="true" /></Button><a href={factUrl(fund.id)} target="_blank" rel="noopener noreferrer">Fondfakta <ExternalLink aria-hidden="true" /></a></div>
        <small className="watch-date">Källa: Pensionsmyndigheten · Hämtat <time dateTime={fetchedAt}>{formatFetchTime(fetchedAt)}</time> · Avgiftens giltighetsdatum saknas i underlaget.</small>
      </li>)}
    </ul>
    {funds.length > 3 && <Button variant="ghost" className="watch-expand" aria-expanded={expanded} aria-controls={`watch-${kind}-list`} onClick={() => setExpanded(!expanded)}>{expanded ? 'Visa färre' : `Visa alla ${funds.length} fonder`}</Button>}
  </article>;
}

export function FundWatchlists() {
  const { data, error, loading, refreshing, refresh } = useFundData<WatchlistData>('/api/funds/watchlists', 6 * 3600000);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const comparisonHeading = useRef<HTMLHeadingElement>(null);
  const selected = data?.peers.find(fund => fund.id === selectedId);
  const peers = selected ? data!.peers.filter(fund => watchCategoryKey(fund) === watchCategoryKey(selected)).sort((a, b) => a.fee - b.fee || a.name.localeCompare(b.name, 'sv-SE')) : [];
  useEffect(() => { if (selectedId) comparisonHeading.current?.focus(); }, [selectedId]);

  return <section className="watch-section" aria-labelledby="watch-title" aria-busy={loading}>
    <div className="watch-heading"><div>
      <Badge variant="secondary">Premiepension · Avgiftsbaserat urval</Badge>
      <h2 id="watch-title">Fonder att undersöka närmare</h2>
      <p>Två bevakningslistor med högst tio fonder vardera. Vi jämför avgifter inom samma kategori — inte framtida vinnare och förlorare.</p>
    </div><Button variant="outline" disabled={refreshing} onClick={refresh}><RefreshCw className={refreshing ? 'animate-spin' : ''} aria-hidden="true" /> Uppdatera</Button></div>
    <p className="watch-scope">Avgifterna gäller <strong>efter Pensionsmyndighetens rabatt</strong>, inte sparande på ISK eller vanligt fondkonto. Listorna är inte köp- eller säljrekommendationer och inte anpassade till din ekonomi.</p>
    {data && <DataFreshness observationLabel="Avgifternas giltighetsdatum" unknownObservation="Anges inte i vårt källunderlag" fetchedAt={data.fetchedAt} note="Vi vet när uppgifterna hämtades, men inte när varje avgift senast ändrades eller började gälla. Nyligen hämtat är därför inte samma sak som nyligen ändrat." />}
    <div aria-live="polite">
      {loading && !data && <output className="watch-notice block">Hämtar fondkategorier och avgifter…</output>}
      {refreshing && data && <output className="watch-notice block">Sparat underlag visas. Kontrollerar uppdateringar i bakgrunden…</output>}
      {error && <p className="watch-notice" role="alert">Listorna kunde inte uppdateras. Senast hämtat underlag behålls när det finns. Försök igen med Uppdatera.</p>}
      {data?.sourceUnavailable && <p className="watch-notice">{data.qualityRejected ? 'Nytt avgiftsunderlag klarade inte datakontrollerna.' : 'Källan kunde inte nås.'} Senaste sparade underlag används; kontrollera hämtningsdatumet.</p>}
      {data?.expired && <p className="watch-notice">Underlaget är för gammalt för ett aktuellt urval. Listorna visas igen när en ny hämtning lyckas.</p>}
    </div>
    {data && !data.expired && <>
      <p className="watch-meta">{data.eligibleFunds} jämförbara av {data.totalFunds} rapporterade fonder.</p>
      <div className="watch-grid"><WatchColumn kind="watch" funds={data.watch} fetchedAt={data.fetchedAt} onCompare={setSelectedId} /><WatchColumn kind="review" funds={data.review} fetchedAt={data.fetchedAt} onCompare={setSelectedId} /></div>
    </>}
    {selected && <section className="watch-comparison" aria-labelledby="watch-comparison-title">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 id="watch-comparison-title" tabIndex={-1} ref={comparisonHeading}>Jämför {selected.name}</h3><p>{selected.category} · {selected.type} · Median {percent(selected.median)}</p></div><Button variant="ghost" onClick={() => setSelectedId(null)}>Stäng jämförelsen</Button></div>
      <p>Alla {peers.length} jämförbara fonder i samma kategori, sorterade på avgift. Aktiv förvaltning, indexförvaltning, risk och placeringsinriktning kan skilja sig. Lägst avgift betyder inte automatiskt bäst fond.</p>
      <div className="watch-peer-table"><Table><TableCaption>Årlig fondavgift efter PPM-rabatt. Detta är en avgiftsjämförelse, inte jämförelsen av FI-innehav längre ned.</TableCaption><TableHeader><TableRow><TableHead>Fond</TableHead><TableHead className="text-right">Avgift</TableHead></TableRow></TableHeader><TableBody>{peers.map(fund => <TableRow key={fund.id} className={fund.id === selected.id ? 'bg-secondary' : ''}><TableCell><a href={factUrl(fund.id)} target="_blank" rel="noopener noreferrer">{fund.name}</a>{fund.id === selected.id && <Badge variant="secondary" className="ml-2">Vald fond</Badge>}</TableCell><TableCell className="text-right">{percent(fund.fee)}</TableCell></TableRow>)}</TableBody></Table></div>
    </section>}
    <details className="watch-method"><summary>Urvalsregler, datakälla och begränsningar</summary>
      <p>Detta är SuperSafes avgiftsurval, inte Pensionsmyndighetens rekommendation. Vi använder källans fondtyp och kategori, med minst fem jämförbara fonder per grupp. Medianen beräknas av oss på dessa fonder, inklusive den granskade fonden.</p>
      <p>”Hålla koll på” kräver minst 25 % och minst 0,05 procentenheter lägre avgift än medianen. ”Granska extra” kräver motsvarande högre avgift. Urvalet sorteras efter relativ avgiftsskillnad, med högst två fonder per kategori och tio per lista. Det är inte en kvalitetsranking.</p>
      <p>Saknade eller ogiltiga avgifter, fonder med statusmeddelande från källan och för små kategorier utesluts. Nollavgift räknas bara när källan uttryckligen anger noll. En fond kan saknas i våra FI-baserade sökfält även om den finns på denna lista.</p>
      <p>En uppdatering stoppas om över 20 % av tidigare fondnummer eller antalet kända avgifter försvinner. Tidigare underlag behålls med varning. Gränsen är en teknisk kontroll; även verkliga förändringar i fondutbudet kan behöva granskas.</p>
      <p>Vi hämtar källan när sidan används, högst var sjätte timme efter en lyckad hämtning. Ingen oberoende bakgrundsinsamling är aktiverad. Underlag äldre än sju dygn döljs. Avgifterna kan ha ändrats sedan hämtningen; kontrollera aktuella villkor hos källan. Historisk avkastning och innehav används inte i denna första urvalsmodell.</p>
      <p><a href={WATCHLIST_SOURCE} target="_blank" rel="noopener noreferrer">Pensionsmyndighetens fondtorg</a> · <a href={WATCHLIST_FEES_SOURCE} target="_blank" rel="noopener noreferrer">Om avgifter och rabatter</a></p>
    </details>
  </section>;
}
