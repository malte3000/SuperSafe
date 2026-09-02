'use client';

import { useEffect, useMemo, useState, type CSSProperties, type SubmitEvent } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Database,
  Info,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { DailyTopFunds } from '@/components/daily-top-funds';
import { FundComparison } from '@/components/fund-comparison';
import { FundWatchlists } from '@/components/fund-watchlists';
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getFundAnalysis } from '@/lib/funds/analysis';
import { defaultFund, demoFunds } from '@/lib/funds/demo-funds';
import {
  fiFundToFund,
  searchFiFunds,
  normalizeFundSearch,
  resolveFiFund,
  type FiFund,
  type FiFundDataset,
} from '@/lib/funds/fi-funds';
import type { Fund } from '@/lib/funds/types';

const directionStyles = {
  positive: { label: 'Positiv', className: 'signal-positive', Icon: ArrowUpRight },
  neutral: { label: 'Neutral', className: 'signal-neutral', Icon: ArrowRight },
  negative: { label: 'Negativ', className: 'signal-negative', Icon: ArrowDownRight },
};

export default function Home() {
  const [query, setQuery] = useState(defaultFund.name);
  const [selectedFund, setSelectedFund] = useState(defaultFund);
  const [visibleResults, setVisibleResults] = useState(6);
  const [fiDataset, setFiDataset] = useState<FiFundDataset | null>(null);
  const [dataState, setDataState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [searchMessage, setSearchMessage] = useState('');

  const { score, lossRisk, weightedConfidence, riskDrivers, concentration } = useMemo(
    () => getFundAnalysis(selectedFund),
    [selectedFund],
  );
  const isFiFund = selectedFund.source === 'fi';
  const searchResults = useMemo(() => {
    if (!fiDataset || query === selectedFund.name) return [];
    return searchFiFunds(fiDataset.funds, query);
  }, [fiDataset, query, selectedFund.name]);
  const isDemoQuery = demoFunds.some(fund => normalizeFundSearch(fund.name) === normalizeFundSearch(query));
  const showNoMatches = dataState === 'ready' && normalizeFundSearch(query).length >= 2
    && query !== selectedFund.name && !isDemoQuery && searchResults.length === 0;

  useEffect(() => {
    let cancelled = false;

    fetch('/data/fi-funds-2026q2.json')
      .then((response) => {
        if (!response.ok) throw new Error('Fonddata kunde inte hämtas.');
        return response.json() as Promise<FiFundDataset>;
      })
      .then((dataset) => {
        if (cancelled) return;
        setFiDataset(dataset);
        setDataState('ready');
      })
      .catch(() => {
        if (!cancelled) setDataState('error');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function runAnalysis(event?: SubmitEvent<HTMLFormElement>) {
    event?.preventDefault();
    const demoMatch = demoFunds.find(fund => normalizeFundSearch(fund.name) === normalizeFundSearch(query));
    const fiMatch = fiDataset ? resolveFiFund(fiDataset.funds, query) : undefined;
    const match = fiMatch ? fiFundToFund(fiMatch) : demoMatch;
    if (match) { chooseFund(match); return; }
    if (normalizeFundSearch(query).length < 2) {
      setSearchMessage('Skriv minst två tecken, ett fondnamn eller ISIN.');
    } else if (dataState !== 'ready') {
      setSearchMessage(dataState === 'loading' ? 'Fondlistan laddas fortfarande. Försök igen om en stund.' : 'Fondlistan kunde inte hämtas. Ladda om sidan för att försöka igen.');
    } else if (searchResults.length > 1) {
      setSearchMessage(`${searchResults.length} fonder matchar. Välj rätt fond i listan nedan — ingen fond väljs automatiskt.`);
    } else {
      setSearchMessage('Ingen träff i vårt FI-underlag. Prova ett annat namn eller ISIN. Fonden kan saknas i datakällan.');
    }
  }

  function chooseFund(fund: Fund) {
    setQuery(fund.name);
    setSelectedFund(fund);
    setSearchMessage('');
    setVisibleResults(6);
  }

  function chooseFiFund(fund: FiFund) {
    chooseFund(fiFundToFund(fund));
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-white/8 bg-[#071410]/95 text-white">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-5 lg:px-8">
          <div className="flex items-center gap-3">
            <span className="brand-mark"><ShieldCheck aria-hidden="true" /></span>
            <div>
              <p className="font-semibold tracking-[-0.03em]">SuperSafe</p>
              <p className="text-[10px] uppercase tracking-[0.18em] text-emerald-100/55">Fondanalys</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge className="border-emerald-300/20 bg-emerald-200/10 text-emerald-100">
              {isFiFund ? 'MVP · FI-data' : 'MVP · Demoläge'}
            </Badge>
            <Button variant="ghost" nativeButton={false} render={<a href="#jamfor-fonder" aria-label="Jämför fonder" />} className="hidden text-emerald-50 hover:bg-white/10 hover:text-white sm:inline-flex">Jämför fonder</Button>
          </div>
        </div>
      </header>

      <section className="search-stage">
        <div className="mx-auto max-w-[1440px] px-5 py-9 lg:px-8 lg:py-11">
          <div className="mb-6 max-w-3xl">
            <div className="eyebrow"><Sparkles aria-hidden="true" /> Verkliga fondinnehav från Finansinspektionen</div>
            <h1>Se risken bakom fondens etikett.</h1>
            <p>Sök bland hundratals svenska värdepappersfonder med namn eller ISIN. Först visar vi verklig koncentration och innehav; marknadssignaler kopplas på i nästa steg.</p>
          </div>

          <form onSubmit={runAnalysis} className="search-shell">
            <Search className="size-5 text-emerald-900/45" aria-hidden="true" />
            <Input value={query} onChange={(event) => { setQuery(event.target.value); setVisibleResults(6); setSearchMessage(''); }} aria-label="Sök efter fond eller ISIN" aria-describedby="fund-search-help" className="h-12 border-0 bg-transparent px-1 text-base shadow-none focus-visible:ring-0" placeholder="Till exempel LF Global eller ISIN..." />
            <Button type="submit" size="lg" className="h-11 rounded-xl bg-[#0f6b4f] px-5 text-white hover:bg-[#0b5b43]">
              Analysera fond <ArrowRight aria-hidden="true" />
            </Button>
          </form>
          <p id="fund-search-help" className="mt-3 text-xs leading-5 text-emerald-950/65">Sök med eller utan å, ä och ö, i valfri ordning. LF = Länsförsäkringar. {fiDataset ? `${fiDataset.funds.length} fonder i FI-underlaget; alla fonder på marknaden ingår inte.` : 'Sökningen omfattar vårt FI-underlag.'}</p>
          {searchResults.length > 0 && (
            <>
            <output className="mt-3 block text-xs text-emerald-950/70">Visar {Math.min(visibleResults, searchResults.length)} av {searchResults.length} träffar</output>
            <div id="fund-search-results" className="fund-results" aria-label="Sökresultat">
              {searchResults.slice(0, visibleResults).map((fund) => (
                <button key={fund.id} type="button" onClick={() => chooseFiFund(fund)}>
                  <span><strong>{fund.name}</strong><small>{fund.company}</small></span>
                  <code>{fund.isin ?? `FI-${fund.instituteNumber}`}</code>
                </button>
              ))}
            </div>
            {visibleResults < searchResults.length && <Button type="button" variant="outline" className="mt-3" aria-controls="fund-search-results" onClick={() => setVisibleResults(count => count + 12)}>Visa fler träffar ({searchResults.length - visibleResults} kvar)</Button>}
            </>
          )}
          {showNoMatches && !searchMessage && <output className="mt-3 block max-w-3xl text-sm leading-6 text-emerald-950/80">Ingen träff i vårt FI-underlag. Prova ISIN eller färre sökord. Specialfonder och utlandsregistrerade fonder kan saknas — det betyder inte att fonden inte finns.</output>}
          {searchMessage && <output className="mt-3 block text-sm font-medium text-rose-700">{searchMessage}</output>}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-emerald-950/60">
            <span>{dataState === 'loading' ? 'Läser in FI-data…' : dataState === 'error' ? 'FI-data kunde inte läsas in · Testa demo:' : 'Testa demo:'}</span>
            {demoFunds.map((fund) => (
              <button key={fund.name} type="button" className="demo-chip" onClick={() => chooseFund(fund)}>{fund.name.replace('SuperSafe ', '').replace(' Demo', '')}</button>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1440px] px-5 py-7 lg:px-8 lg:py-9">
        <FundWatchlists />
        <FundComparison dataset={fiDataset} dataState={dataState} />
        <DailyTopFunds />
        <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold tracking-[-0.03em]">{selectedFund.name}</h2>
              <Badge variant="outline" className={isFiFund ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-amber-300 bg-amber-50 text-amber-800'}>
                {isFiFund ? 'Verifierad FI-data' : 'Demodata'}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{selectedFund.category}</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Clock3 className="size-3.5" aria-hidden="true" /> {selectedFund.updated}</div>
        </div>

        <section className="overview-grid" aria-label="Samlad fondbedömning">
          <article className="score-card">
            <div className="score-dial" style={{ '--score': `${Math.min(score, 100) * 3.6}deg` } as CSSProperties}>
              <div><strong>{score}%</strong><span>{isFiFund ? 'i tio största' : 'positiv utveckling'}</span></div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex items-center gap-2"><span className="status-dot" /><p className="text-sm font-semibold uppercase tracking-[0.12em] text-emerald-800">{isFiFund ? `${concentrationLabel(concentration)} koncentration` : 'Försiktigt positiv'}</p></div>
              <h3>{isFiFund ? 'Fondens innehavskoncentration' : 'Fondens viktade sannolikhetstest'}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {isFiFund
                  ? `De tio största positionerna utgör ${score}% av fonden. ${riskDrivers[0]?.name ?? 'Det största innehavet'} är störst med ${lossRisk}% av fondförmögenheten.`
                  : `Starka kärninnehav ger stöd, men ${riskDrivers[0].name} och ${riskDrivers[1].name} drar ned helhetsbilden. Bedömningen gäller kommande sex månader.`}
              </p>
              <div className="mt-5 grid grid-cols-3 gap-3 border-t pt-4">
                <Metric label={isFiFund ? 'Största innehav' : 'Kapitalrisk'} value={`${lossRisk}%`} tone="amber" />
                <Metric label={isFiFund ? 'Visad andel' : 'AI-säkerhet'} value={`${weightedConfidence}%`} tone="green" />
                <Metric label={isFiFund ? 'Rapporterade' : 'Analyserat'} value={isFiFund ? `${selectedFund.holdingsCount ?? selectedFund.holdings.length} st` : '100%'} tone="green" />
              </div>
            </div>
          </article>

          <article className="panel-card">
            <div className="panel-heading">
              <div><span className="panel-icon risk"><AlertTriangle /></span><div><h3>{isFiFund ? 'Största positioner' : 'Största riskbidrag'}</h3><p>{isFiFund ? 'Andel av fondförmögenheten' : 'Vikt × aktierisk'}</p></div></div>
              <Popover>
                <PopoverTrigger
                  aria-label={`Information om ${isFiFund ? 'största positioner' : 'största riskbidrag'}`}
                  className="info-button"
                >
                  <Info aria-hidden="true" />
                </PopoverTrigger>
                <PopoverContent align="end" side="bottom" className="w-80 p-4">
                  <PopoverHeader>
                    <PopoverTitle>{isFiFund ? 'Vad visar största positioner?' : 'Vad visar största riskbidrag?'}</PopoverTitle>
                    <PopoverDescription className="leading-5">
                      {isFiFund
                        ? 'Siffran är innehavets fondvikt på rapportdagen. 9,23 % betyder alltså att innehavet utgör 9,23 % av fonden – inte att kursen har gått upp 9,23 %.'
                        : 'Riskbidrag väger ihop hur stor positionen är med den uppskattade aktierisken i demonstrationsanalysen.'}
                    </PopoverDescription>
                  </PopoverHeader>
                  {isFiFund && (
                    <p className="border-t pt-3 text-xs leading-5 text-muted-foreground">
                      Uppgång och nedgång kräver separat NAV- eller marknadsdata och visas när den datakällan har kopplats in.
                    </p>
                  )}
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-4 pt-4">
              {riskDrivers.map((holding) => (
                <div key={holding.ticker}>
                  <div className="mb-1.5 flex items-center justify-between text-sm"><span className="font-medium">{holding.name}</span><span className="font-mono text-xs text-rose-700">{holding.weight}% vikt</span></div>
                  <Progress value={isFiFund ? Math.min(100, holding.weight * 7) : 100 - (holding.probability ?? 0)} className="risk-progress" aria-label={`${holding.name} fondvikt`} />
                </div>
              ))}
            </div>
          </article>

          <article className="panel-card confidence-card">
            <div className="panel-heading"><div><span className="panel-icon safe">{isFiFund ? <Database /> : <CheckCircle2 />}</span><div><h3>Datatäckning</h3><p>{isFiFund ? 'Officiellt rapporterade innehav' : 'Underlag i bedömningen'}</p></div></div></div>
            <div className="coverage-number">{isFiFund ? weightedConfidence : 100}<span>%</span></div>
            <p className="text-sm leading-6 text-muted-foreground">
              {isFiFund
                ? `De ${selectedFund.holdings.length} största av ${selectedFund.holdingsCount} rapporterade innehav visas. Källa: Finansinspektionen.`
                : `Alla ${selectedFund.holdings.length} demoinnehav är analyserade och viktade till fondens hela värde.`}
            </p>
          </article>
        </section>

        <section className="holdings-card" aria-labelledby="holdings-title">
          <div className="holdings-heading">
            <div>
              <div className="flex items-center gap-2"><h2 id="holdings-title">{isFiFund ? 'Största rapporterade innehav' : 'Innehavens sannolikhetstest'}</h2><Badge variant="secondary">{selectedFund.holdings.length} visas</Badge></div>
              <p>{isFiFund ? `Rapporterat ${selectedFund.reportDate} · sökbar med ISIN` : 'Sorterat efter hur stor del av fonden varje aktie utgör.'}</p>
            </div>
            {isFiFund ? (
              <div className="legend"><span><i className="bg-emerald-500" /> FI 2026 Q2</span><span>Marknadsdata ej ansluten</span></div>
            ) : (
              <div className="legend"><span><i className="bg-emerald-500" /> Positiv</span><span><i className="bg-amber-400" /> Neutral</span><span><i className="bg-rose-500" /> Negativ</span></div>
            )}
          </div>

          <Table>
            <TableHeader><TableRow className="hover:bg-transparent"><TableHead>Innehav</TableHead><TableHead>Fondvikt</TableHead><TableHead>{isFiFund ? 'ISIN' : 'Sannolikhet'}</TableHead><TableHead>{isFiFund ? 'Land' : 'Bedömning'}</TableHead><TableHead className="min-w-[300px]">{isFiFund ? 'Instrumenttyp' : 'AI:s huvudskäl'}</TableHead><TableHead className="text-right">{isFiFund ? 'Valuta' : 'Säkerhet'}</TableHead></TableRow></TableHeader>
            <TableBody>
              {selectedFund.holdings.map((holding) => {
                const signal = directionStyles[holding.direction ?? 'neutral'];
                return (
                  <TableRow key={holding.isin ?? holding.ticker}>
                    <TableCell><div className="flex items-center gap-3"><span className="ticker-avatar">{holding.ticker.slice(0, 2)}</span><div><p className="font-semibold">{holding.name}</p><p className="text-xs text-muted-foreground">{holding.ticker}</p></div></div></TableCell>
                    <TableCell><strong className="font-mono text-sm">{holding.weight}%</strong></TableCell>
                    {isFiFund ? (
                      <>
                        <TableCell className="font-mono text-xs">{holding.isin ?? 'Saknas'}</TableCell>
                        <TableCell><Badge variant="outline">{holding.country ?? '—'}</Badge></TableCell>
                        <TableCell className="whitespace-normal text-sm text-muted-foreground">{formatAssetClass(holding.assetClass)}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{holding.currency ?? '—'}</TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell><div className="flex items-center gap-3"><div className="probability-track"><span style={{ width: `${holding.probability ?? 0}%` }} /></div><span className="font-mono text-xs font-semibold">{holding.probability}%</span></div></TableCell>
                        <TableCell><span className={`signal ${signal.className}`}><signal.Icon />{signal.label}</span></TableCell>
                        <TableCell className="whitespace-normal text-sm text-muted-foreground">{holding.reason}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{holding.confidence}%</TableCell>
                      </>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </section>

        <footer className="mt-5 flex flex-col gap-2 border-t py-5 text-xs leading-5 text-muted-foreground sm:flex-row sm:justify-between">
          <p>{isFiFund ? 'Officiella innehav från Finansinspektionen. Marknadssignal är ännu inte ansluten – inte investeringsrådgivning.' : 'Demonstration – inte investeringsrådgivning. Verkliga innehav finns via fondsökningen.'}</p>
          <p>SuperSafe · Risk före avkastning</p>
        </footer>
      </div>
    </main>
  );
}

function concentrationLabel(level: 'high' | 'medium' | 'low' | 'signal') {
  if (level === 'high') return 'Hög';
  if (level === 'medium') return 'Medelhög';
  if (level === 'low') return 'Låg';
  return 'Ej bedömd';
}

function formatAssetClass(assetClass?: string) {
  if (!assetClass) return 'Ej angivet';
  return assetClass.replaceAll(/([a-zåäö])([A-ZÅÄÖ])/g, '$1 $2');
}

function Metric({ label, value, tone }: { label: string; value: string; tone: 'green' | 'amber' }) {
  return <div><p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">{label}</p><p className={`mt-1 font-mono text-lg font-semibold ${tone === 'green' ? 'text-emerald-800' : 'text-amber-700'}`}>{value}</p></div>;
}
