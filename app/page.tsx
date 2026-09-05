'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type SubmitEvent,
} from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Database,
  Info,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

import { DataFreshness } from '@/components/data-freshness';
import {
  FavoriteButton,
  FundFavoritesProvider,
  MyFunds,
} from '@/components/fund-favorites';
import { FeeCalculator } from '@/components/fee-calculator';
import { FundComparison } from '@/components/fund-comparison';
import { FundPortfolio } from '@/components/fund-portfolio';
import { FundWatchlists } from '@/components/fund-watchlists';
import { ResultExplanation } from '@/components/result-explanation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getFundAnalysis } from '@/lib/funds/analysis';
import { explainFund } from '@/lib/funds/explanations';
import {
  fiFundToFund,
  isFiFundDataset,
  isFiFundSource,
  isNewerFiSource,
  normalizeFundSearch,
  resolveFiFund,
  searchFiFunds,
  type FiFund,
  type FiFundDataset,
} from '@/lib/funds/fi-funds';

type DataState = 'idle' | 'loading' | 'ready' | 'error';
type ToolName = 'mina' | 'compare' | 'portfolio' | 'fees' | 'ppm';

const number = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 2 });
const percent = (value: number) => `${number.format(value)} %`;
const localFiDatasetUrl = '/data/fi-funds-latest.json';
const publicFiDatasetUrl =
  'https://raw.githubusercontent.com/malte3000/SuperSafe/main/public/data/fi-funds-latest.json';
const publicFiManifestUrl =
  'https://raw.githubusercontent.com/malte3000/SuperSafe/main/public/data/fi-funds-latest.meta.json';

function scrollAfterRender(id: string) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ block: 'start' });
    });
  });
}

async function fetchFiDataset(url: string) {
  const response = await fetch(
    url,
    url.startsWith('https://') ? { cache: 'no-store' } : undefined,
  );
  if (!response.ok) throw new Error('Fonddata kunde inte hämtas.');
  const dataset: unknown = await response.json();
  if (!isFiFundDataset(dataset))
    throw new Error('Fonddata klarade inte valideringen.');
  return dataset;
}

async function loadPreferredFiDataset() {
  const [localDataset, publicManifest] = await Promise.all([
    fetchFiDataset(localFiDatasetUrl).catch(() => null),
    fetch(publicFiManifestUrl, { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) return null;
        const source: unknown = await response.json();
        return isFiFundSource(source) ? source : null;
      })
      .catch(() => null),
  ]);

  const shouldFetchPublic =
    !localDataset ||
    (publicManifest && isNewerFiSource(publicManifest, localDataset.source));
  if (shouldFetchPublic) {
    try {
      const publicDataset = await fetchFiDataset(publicFiDatasetUrl);
      if (
        !publicManifest ||
        publicDataset.source.archiveName === publicManifest.archiveName
      ) {
        return publicDataset;
      }
    } catch {
      // The bundled, validated dataset remains the offline fallback.
    }
  }

  if (localDataset) return localDataset;
  throw new Error('Fonddata kunde inte hämtas.');
}

export default function Home() {
  return (
    <FundFavoritesProvider>
      <FundHome />
    </FundFavoritesProvider>
  );
}

function FundHome() {
  const [query, setQuery] = useState('');
  const [selectedFiFund, setSelectedFiFund] = useState<FiFund | null>(null);
  const [visibleResults, setVisibleResults] = useState(6);
  const [fiDataset, setFiDataset] = useState<FiFundDataset | null>(null);
  const [dataState, setDataState] = useState<DataState>('idle');
  const [searchMessage, setSearchMessage] = useState('');
  const [activeTool, setActiveTool] = useState<ToolName>('mina');
  const [visitedTools, setVisitedTools] = useState<Set<ToolName>>(
    () => new Set(['mina']),
  );
  const loadPromise = useRef<Promise<FiFundDataset | null> | null>(null);
  const mounted = useRef(true);
  const initialLocationHandled = useRef(false);

  const selectedFund = useMemo(
    () => (selectedFiFund ? fiFundToFund(selectedFiFund) : null),
    [selectedFiFund],
  );
  const analysis = useMemo(
    () => (selectedFiFund ? getFundAnalysis(selectedFiFund) : null),
    [selectedFiFund],
  );
  const fundExplanation = useMemo(
    () => explainFund(selectedFiFund),
    [selectedFiFund],
  );
  const searchResults = useMemo(() => {
    if (!fiDataset || query === selectedFiFund?.name) return [];
    return searchFiFunds(fiDataset.funds, query);
  }, [fiDataset, query, selectedFiFund?.name]);
  const showNoMatches =
    dataState === 'ready' &&
    normalizeFundSearch(query).length >= 2 &&
    query !== selectedFiFund?.name &&
    searchResults.length === 0;

  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

  const loadFiData = useCallback((): Promise<FiFundDataset | null> => {
    if (fiDataset) return Promise.resolve(fiDataset);
    if (loadPromise.current) return loadPromise.current;

    setDataState('loading');
    const request = loadPreferredFiDataset()
      .then((dataset) => {
        if (mounted.current) {
          setFiDataset(dataset);
          setDataState('ready');
        }
        return dataset;
      })
      .catch(() => {
        if (mounted.current) setDataState('error');
        return null;
      })
      .finally(() => {
        loadPromise.current = null;
      });

    loadPromise.current = request;
    return request;
  }, [fiDataset]);

  useEffect(() => {
    if (initialLocationHandled.current) return;
    initialLocationHandled.current = true;
    const requestedFund = new URLSearchParams(window.location.search).get(
      'fund',
    );
    const toolByHash: Record<string, ToolName> = {
      '#mina-fonder': 'mina',
      '#jamfor-fonder': 'compare',
      '#portfolj': 'portfolio',
      '#avgiftskalkyl': 'fees',
      '#ppm-avgifter': 'ppm',
      '#verktyg': 'mina',
    };
    const requestedTool = toolByHash[window.location.hash];
    if (requestedTool) {
      queueMicrotask(() => {
        setActiveTool(requestedTool);
        setVisitedTools((current) => new Set(current).add(requestedTool));
        scrollAfterRender('verktyg');
      });
    }
    const fiSection =
      requestedTool === 'mina' ||
      requestedTool === 'compare' ||
      requestedTool === 'portfolio';
    if (!requestedFund && !fiSection) return;

    void loadFiData().then((dataset) => {
      if (!requestedFund || !dataset) return;
      const match = dataset.funds.find(
        (fund) => fund.id === requestedFund || fund.isin === requestedFund,
      );
      if (match && mounted.current) {
        setSelectedFiFund(match);
        setQuery(match.name);
        scrollAfterRender('fondanalys');
      }
    });
  }, [loadFiData]);

  function selectFund(fund: FiFund, scroll = true) {
    setSelectedFiFund(fund);
    setQuery(fund.name);
    setSearchMessage('');
    setVisibleResults(6);
    const nextUrl = `${window.location.pathname}?fund=${encodeURIComponent(fund.id)}#fondanalys`;
    window.history.replaceState(null, '', nextUrl);
    if (scroll) {
      requestAnimationFrame(() => {
        const heading = document.getElementById('fund-analysis-title');
        heading?.focus({ preventScroll: true });
        document
          .getElementById('fondanalys')
          ?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      });
    }
  }

  async function runAnalysis(event?: SubmitEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (normalizeFundSearch(query).length < 2) {
      setSearchMessage('Skriv minst två tecken, ett fondnamn eller ISIN.');
      return;
    }

    const dataset = await loadFiData();
    if (!dataset) {
      setSearchMessage(
        'Fondlistan kunde inte hämtas. Försök igen om en stund.',
      );
      return;
    }

    const match = resolveFiFund(dataset.funds, query);
    if (match) {
      selectFund(match);
      return;
    }

    const matches = searchFiFunds(dataset.funds, query);
    setSearchMessage(
      matches.length > 1
        ? `${matches.length} fonder matchar. Välj rätt fond i listan — ingen fond väljs automatiskt.`
        : 'Ingen träff i vårt FI-underlag. Prova ett annat namn eller ISIN. Fonden kan saknas i datakällan.',
    );
  }

  async function openExample(id: string) {
    const dataset = await loadFiData();
    const fund = dataset?.funds.find((item) => item.id === id);
    if (fund) selectFund(fund);
  }

  function openTool(tool: ToolName, needsFi = false) {
    setActiveTool(tool);
    setVisitedTools((current) =>
      current.has(tool) ? current : new Set(current).add(tool),
    );
    if (needsFi) void loadFiData();
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="site-header border-b border-white/8 bg-[#071410]/95 text-white">
        <div className="mx-auto flex min-h-16 max-w-[1440px] flex-wrap items-center justify-between gap-3 px-5 py-3 lg:px-8">
          <a
            href="#fondsok"
            className="flex items-center gap-3"
            aria-label="SuperSafe – gå till fondsökningen"
          >
            <span className="brand-mark">
              <ShieldCheck aria-hidden="true" />
            </span>
            <div>
              <p className="font-semibold tracking-[-0.03em]">SuperSafe</p>
              <p className="text-xs uppercase tracking-[0.15em] text-emerald-100/65">
                Fondinnehav
              </p>
            </div>
          </a>
          <nav className="site-nav" aria-label="Huvudnavigation">
            <Badge className="hidden border-emerald-300/20 bg-emerald-200/10 text-emerald-100 md:inline-flex">
              FI · 2026 Q2
            </Badge>
            <a href="#verktyg" onClick={() => openTool('mina', true)}>
              Mina
            </a>
            <a href="#verktyg" onClick={() => openTool('compare', true)}>
              Jämför
            </a>
            <a href="#verktyg" onClick={() => openTool('portfolio', true)}>
              Portfölj
            </a>
            <a href="#verktyg" onClick={() => openTool('fees')}>
              Avgifter
            </a>
          </nav>
        </div>
      </header>

      <main>
        <section id="fondsok" className="search-stage">
          <div className="mx-auto max-w-[1440px] px-5 py-9 lg:px-8 lg:py-11">
            <div className="mb-6 max-w-3xl">
              <div className="eyebrow">
                <Sparkles aria-hidden="true" /> Rapporterade fondinnehav från
                Finansinspektionen
              </div>
              <h1>Se vad fonden faktiskt äger.</h1>
              <p>
                Sök på fondnamn eller ISIN. Du får en tydlig bild av de största
                innehaven, koncentrationen och hur stor del av fonden vårt
                FI-underlag täcker.
              </p>
            </div>

            <form onSubmit={runAnalysis} className="search-shell">
              <Search
                className="size-5 text-emerald-900/45"
                aria-hidden="true"
              />
              <Input
                value={query}
                onFocus={() => {
                  void loadFiData();
                }}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setVisibleResults(6);
                  setSearchMessage('');
                  if (normalizeFundSearch(event.target.value).length >= 1)
                    void loadFiData();
                }}
                aria-label="Sök efter fond eller ISIN"
                aria-describedby="fund-search-help"
                className="h-12 border-0 bg-transparent px-1 text-base shadow-none focus-visible:ring-0"
                placeholder="Till exempel Avanza Zero eller ett ISIN…"
              />
              <Button
                type="submit"
                size="lg"
                className="h-11 rounded-xl bg-[#0f6b4f] px-5 text-white hover:bg-[#0b5b43]"
              >
                Visa innehav <ArrowRight aria-hidden="true" />
              </Button>
            </form>
            <p
              id="fund-search-help"
              className="mt-3 text-sm leading-6 text-emerald-950/70"
            >
              Sök med eller utan å, ä och ö, i valfri ordning. LF =
              Länsförsäkringar.{' '}
              {fiDataset
                ? `${fiDataset.funds.length} fonder ingår i FI-underlaget; hela marknaden ingår inte.`
                : dataState === 'loading'
                  ? 'Läser in FI-underlaget…'
                  : dataState === 'error'
                    ? 'FI-underlaget kunde inte läsas in just nu.'
                    : 'Fondlistan laddas när du börjar söka.'}
            </p>
            {searchResults.length > 0 && (
              <>
                <output className="mt-3 block text-sm text-emerald-950/75">
                  Visar {Math.min(visibleResults, searchResults.length)} av{' '}
                  {searchResults.length} träffar
                </output>
                <div
                  id="fund-search-results"
                  className="fund-results"
                  aria-label="Sökresultat"
                >
                  {searchResults.slice(0, visibleResults).map((fund) => (
                    <div key={fund.id} className="fund-result-row">
                      <button
                        type="button"
                        className="fund-result-open"
                        onClick={() => selectFund(fund)}
                      >
                        <span>
                          <strong>{fund.name}</strong>
                          <small>{fund.company}</small>
                        </span>
                        <code>{fund.isin ?? `FI-${fund.instituteNumber}`}</code>
                      </button>
                      <FavoriteButton
                        fund={{ source: 'fi', id: fund.id, name: fund.name }}
                        compact
                      />
                    </div>
                  ))}
                </div>
                {visibleResults < searchResults.length && (
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-3"
                    aria-controls="fund-search-results"
                    onClick={() => setVisibleResults((count) => count + 12)}
                  >
                    Visa fler träffar ({searchResults.length - visibleResults}{' '}
                    kvar)
                  </Button>
                )}
              </>
            )}
            {showNoMatches && !searchMessage && (
              <output className="mt-3 block max-w-3xl text-sm leading-6 text-emerald-950/80">
                Ingen träff i vårt FI-underlag. Prova ISIN eller färre sökord.
                Specialfonder och utlandsregistrerade fonder kan saknas — det
                betyder inte att fonden inte finns.
              </output>
            )}
            {searchMessage && (
              <output className="mt-3 block text-sm font-medium text-rose-700">
                {searchMessage}
              </output>
            )}
            <div
              className="real-examples"
              aria-label="Exempel med verkliga FI-fonder"
            >
              <span>Verkliga exempel:</span>
              <button
                type="button"
                onClick={() => {
                  void openExample('SE0001718388');
                }}
              >
                Avanza Zero
              </button>
              <button
                type="button"
                onClick={() => {
                  void openExample('SE0009773716');
                }}
              >
                SEB Sverige Indexnära
              </button>
            </div>
          </div>
        </section>

        {selectedFund && selectedFiFund && analysis && (
          <section id="fondanalys" className="analysis-section scroll-mt-4">
            <div className="mx-auto max-w-[1440px] px-5 py-8 lg:px-8 lg:py-10">
              <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                <div>
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <h2
                      id="fund-analysis-title"
                      tabIndex={-1}
                      className="text-2xl font-semibold tracking-[-0.03em]"
                    >
                      {selectedFund.name}
                    </h2>
                    <Badge
                      variant="outline"
                      className="border-emerald-300 bg-emerald-50 text-emerald-800"
                    >
                      FI-underlag
                    </Badge>
                    {selectedFund.sourceId && (
                      <FavoriteButton
                        fund={{
                          source: 'fi',
                          id: selectedFund.sourceId,
                          name: selectedFund.name,
                        }}
                      />
                    )}
                  </div>
                  <p className="text-base text-muted-foreground">
                    {selectedFund.category}
                  </p>
                </div>
                <a
                  className="share-fund-link"
                  href={`?fund=${encodeURIComponent(selectedFiFund.id)}#fondanalys`}
                >
                  Länk till analysen
                </a>
              </div>
              <DataFreshness
                observationLabel="Fondens innehav avser"
                observationDate={selectedFund.reportDate}
                publishedAt={fiDataset?.source.publishedAt}
                fetchedAt={fiDataset?.source.fetchedAt}
                fetchLabel="Hämtat till SuperSafe"
                note="Historisk ögonblicksbild, inte fondens portfölj i dag. Publiceringsdatumet är inte innehavens datum."
              />
              <section
                className="overview-grid"
                aria-label="Samlad bild av fondens innehav"
              >
                <article className="score-card">
                  <div
                    className="score-dial"
                    style={
                      {
                        '--score': `${Math.min(analysis.topTenWeight, 100) * 3.6}deg`,
                      } as CSSProperties
                    }
                  >
                    <div>
                      <strong>{percent(analysis.topTenWeight)}</strong>
                      <span>i tio största</span>
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="status-dot" />
                      <p className="text-sm font-semibold uppercase tracking-[0.1em] text-emerald-800">
                        De tio största innehaven
                      </p>
                    </div>
                    <h3>Fondens innehavskoncentration</h3>
                    <p className="mt-2 text-base leading-7 text-muted-foreground">
                      De tio största positionerna utgör{' '}
                      {percent(analysis.topTenWeight)} av fonden.{' '}
                      {analysis.largestHoldings[0]?.name ??
                        'Det största innehavet'}{' '}
                      är störst med {percent(analysis.largestHoldingWeight)} av
                      fondförmögenheten. Det beskriver fördelningen, inte
                      fondens totala risk.
                    </p>
                    <div className="mt-5 grid grid-cols-3 gap-3 border-t pt-4">
                      <Metric
                        label="Största innehav"
                        value={percent(analysis.largestHoldingWeight)}
                        tone="amber"
                      />
                      <Metric
                        label="Visad andel"
                        value={percent(analysis.displayedWeight)}
                        tone="green"
                      />
                      <Metric
                        label="Rapporterade"
                        value={`${selectedFund.holdingsCount ?? selectedFund.holdings.length} st`}
                        tone="green"
                      />
                    </div>
                  </div>
                </article>
                <article className="panel-card">
                  <div className="panel-heading">
                    <div>
                      <span className="panel-icon risk">
                        <AlertTriangle aria-hidden="true" />
                      </span>
                      <div>
                        <h3>Största positioner</h3>
                        <p>Andel av fondförmögenheten</p>
                      </div>
                    </div>
                    <Popover>
                      <PopoverTrigger
                        aria-label="Information om största positioner"
                        className="info-button"
                      >
                        <Info aria-hidden="true" />
                      </PopoverTrigger>
                      <PopoverContent
                        align="end"
                        side="bottom"
                        className="w-80 p-4"
                      >
                        <PopoverHeader>
                          <PopoverTitle>
                            Vad visar största positioner?
                          </PopoverTitle>
                          <PopoverDescription className="leading-5">
                            Siffran är innehavets fondvikt på rapportdagen.{' '}
                            {analysis.largestHoldings[0]
                              ? `${percent(analysis.largestHoldings[0].weight)} betyder att ${analysis.largestHoldings[0].name} utgör den andelen av fonden`
                              : 'Fondvikten visar hur stor del av fonden innehavet utgör'}{' '}
                            — inte hur mycket kursen har gått upp.
                          </PopoverDescription>
                        </PopoverHeader>
                        <p className="border-t pt-3 text-sm leading-6 text-muted-foreground">
                          Uppgång och nedgång kräver separat NAV- eller
                          marknadsdata och ingår inte i den här
                          innehavsanalysen.
                        </p>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-4 pt-4">
                    {analysis.largestHoldings.map((holding) => (
                      <div key={holding.isin ?? holding.name}>
                        <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                          <span className="font-medium">{holding.name}</span>
                          <span className="shrink-0 font-mono text-sm text-rose-700">
                            {percent(holding.weight)}
                          </span>
                        </div>
                        <Progress
                          value={holding.weight}
                          className="risk-progress"
                          aria-label={`${holding.name}: ${percent(holding.weight)} av fonden`}
                        />
                      </div>
                    ))}
                  </div>
                </article>
                <article className="panel-card confidence-card">
                  <div className="panel-heading">
                    <div>
                      <span className="panel-icon safe">
                        <Database aria-hidden="true" />
                      </span>
                      <div>
                        <h3>Datatäckning</h3>
                        <p>Identifierade innehav i utdraget</p>
                      </div>
                    </div>
                  </div>
                  <div className="coverage-number">
                    {number.format(analysis.displayedWeight)}
                    <span>%</span>
                  </div>
                  <p className="text-base leading-7 text-muted-foreground">
                    De {selectedFund.holdings.length} största av{' '}
                    {selectedFund.holdingsCount} rapporterade innehav visas.
                    Källa: Finansinspektionen.
                  </p>
                </article>
              </section>
              <ResultExplanation
                id="fund-explanation"
                explanation={fundExplanation}
              />
              <section
                className="holdings-card"
                aria-labelledby="holdings-title"
              >
                <div className="holdings-heading">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 id="holdings-title">Största rapporterade innehav</h2>
                      <Badge variant="secondary">
                        {selectedFund.holdings.length} visas
                      </Badge>
                    </div>
                    <p>
                      Rapporterat {selectedFund.reportDate} · sökbart med ISIN
                    </p>
                  </div>
                  <div className="legend">
                    <span>
                      <i className="bg-emerald-500" /> FI{' '}
                      {fiDataset?.source.period ?? 'fondinnehav'}
                    </span>
                    <span>Innehav · inte kursutveckling</span>
                  </div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Innehav</TableHead>
                      <TableHead>Fondvikt</TableHead>
                      <TableHead className="hidden md:table-cell">
                        ISIN
                      </TableHead>
                      <TableHead className="hidden md:table-cell">
                        Land
                      </TableHead>
                      <TableHead className="hidden min-w-[260px] lg:table-cell">
                        Instrumenttyp
                      </TableHead>
                      <TableHead className="hidden text-right lg:table-cell">
                        Valuta
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedFund.holdings.map((holding) => (
                      <TableRow key={holding.isin ?? holding.ticker}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <span className="ticker-avatar">
                              {holding.ticker.slice(0, 2)}
                            </span>
                            <div>
                              <p className="font-semibold">{holding.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {holding.ticker}
                                <span className="md:hidden">
                                  {' '}
                                  · {holding.isin ?? 'ISIN saknas'}
                                </span>
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <strong className="font-mono text-sm">
                            {percent(holding.weight)}
                          </strong>
                        </TableCell>
                        <TableCell className="hidden font-mono text-sm md:table-cell">
                          {holding.isin ?? 'Saknas'}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Badge variant="outline">
                            {holding.country ?? '—'}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden whitespace-normal text-sm text-muted-foreground lg:table-cell">
                          {formatAssetClass(holding.assetClass)}
                        </TableCell>
                        <TableCell className="hidden text-right font-mono text-sm lg:table-cell">
                          {holding.currency ?? '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </section>
            </div>
          </section>
        )}

        <div className="mx-auto max-w-[1440px] px-5 py-8 lg:px-8 lg:py-10">
          <section className="tool-index" aria-labelledby="tool-index-title">
            <div>
              <Badge variant="secondary">Fler fondverktyg</Badge>
              <h2 id="tool-index-title">Fördjupa bilden när du behöver</h2>
              <p>
                Börja med en fondanalys ovan. Använd sedan bara det verktyg som
                svarar på din nästa fråga.
              </p>
            </div>
            <div className="tool-index-links">
              <a href="#verktyg" onClick={() => openTool('mina', true)}>
                <strong>Mina fonder</strong>
                <span>Sparade genvägar i webbläsaren</span>
              </a>
              <a href="#verktyg" onClick={() => openTool('compare', true)}>
                <strong>Jämför innehav</strong>
                <span>Se gemensamma värdepapper</span>
              </a>
              <a href="#verktyg" onClick={() => openTool('portfolio', true)}>
                <strong>Portföljbild</strong>
                <span>Väg samman 2–10 fonder</span>
              </a>
              <a href="#verktyg" onClick={() => openTool('fees')}>
                <strong>Avgiftskalkyl</strong>
                <span>Jämför långsiktig avgiftseffekt</span>
              </a>
              <a href="#verktyg" onClick={() => openTool('ppm')}>
                <strong>PPM-avgifter</strong>
                <span>Jämför inom samma kategori</span>
              </a>
            </div>
          </section>
          <section
            id="verktyg"
            className="tool-workspace"
            aria-label="Fondverktyg"
          >
            <Tabs
              value={activeTool}
              onValueChange={(value) =>
                openTool(
                  value as ToolName,
                  value === 'mina' ||
                    value === 'compare' ||
                    value === 'portfolio',
                )
              }
            >
              <TabsList className="tool-tabs" aria-label="Välj fondverktyg">
                <TabsTrigger value="mina">Mina fonder</TabsTrigger>
                <TabsTrigger value="compare">Jämför</TabsTrigger>
                <TabsTrigger value="portfolio">Portfölj</TabsTrigger>
                <TabsTrigger value="fees">Avgifter</TabsTrigger>
                <TabsTrigger value="ppm">PPM-avgifter</TabsTrigger>
              </TabsList>
              <TabsContent value="mina" keepMounted>
                {visitedTools.has('mina') && (
                  <MyFunds
                    dataset={fiDataset}
                    dataState={dataState}
                    onLoad={loadFiData}
                    onOpen={(fund) => selectFund(fund)}
                  />
                )}
              </TabsContent>
              <TabsContent value="compare" keepMounted>
                {visitedTools.has('compare') && (
                  <FundComparison
                    dataset={fiDataset}
                    dataState={dataState}
                    onLoad={loadFiData}
                  />
                )}
              </TabsContent>
              <TabsContent value="portfolio" keepMounted>
                {visitedTools.has('portfolio') && (
                  <FundPortfolio
                    dataset={fiDataset}
                    dataState={dataState}
                    onLoad={loadFiData}
                  />
                )}
              </TabsContent>
              <TabsContent value="fees" keepMounted>
                {visitedTools.has('fees') && <FeeCalculator />}
              </TabsContent>
              <TabsContent value="ppm" keepMounted>
                {visitedTools.has('ppm') && <FundWatchlists />}
              </TabsContent>
            </Tabs>
          </section>
        </div>
      </main>

      <footer className="site-footer">
        <div className="mx-auto grid max-w-[1440px] gap-6 px-5 py-8 md:grid-cols-3 lg:px-8">
          <div>
            <strong>Vad SuperSafe visar</strong>
            <p>
              Rapporterade innehav, koncentration, överlappning och förenklade
              avgiftsexempel. Inte en fullständig riskbedömning.
            </p>
          </div>
          <div>
            <strong>Integritet</strong>
            <p>
              Sökningar och kalkylvärden sparas inte på servern. Mina fonder
              lagras endast i den här webbläsaren.
            </p>
          </div>
          <div>
            <strong>Viktigt</strong>
            <p>
              Historiska uppgifter och räkneexempel är inte
              investeringsrådgivning eller prognoser. Kontrollera alltid fondens
              aktuella faktablad.
            </p>
          </div>
        </div>
        <div className="site-footer-bottom">
          <span>SuperSafe · förstå fondens innehav</span>
          <span>
            FI-data och Pensionsmyndighetens fonddata hålls tydligt åtskilda
          </span>
        </div>
      </footer>
    </div>
  );
}

function formatAssetClass(assetClass?: string) {
  if (!assetClass) return 'Ej angivet';
  return assetClass.replaceAll(/([a-zåäö])([A-ZÅÄÖ])/g, '$1 $2');
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'green' | 'amber';
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-1 font-mono text-lg font-semibold ${tone === 'green' ? 'text-emerald-800' : 'text-amber-700'}`}
      >
        {value}
      </p>
    </div>
  );
}
