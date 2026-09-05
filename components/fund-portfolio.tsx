'use client';

import { useMemo, useState } from 'react';
import { Layers3, Plus, Trash2 } from 'lucide-react';
import { FundPicker } from '@/components/fund-comparison';
import { useFavorites } from '@/components/fund-favorites';
import { DataFreshness } from '@/components/data-freshness';
import { ResultExplanation } from '@/components/result-explanation';
import { explainPortfolio } from '@/lib/funds/explanations';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty';
import {
  Table,
  TableHeader,
  TableHead,
  TableRow,
  TableBody,
  TableCell,
  TableCaption,
} from '@/components/ui/table';
import {
  analyzePortfolio,
  equalAllocations,
  MAX_PORTFOLIO_FUNDS,
  parseAllocation,
  type PortfolioEntry,
  type PortfolioPosition,
} from '@/lib/funds/portfolio';
import type { FiFund, FiFundDataset } from '@/lib/funds/fi-funds';

const percent = (value: number) =>
  `${new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 2 }).format(value)} %`;

function PositionTable({
  positions,
  caption,
}: {
  positions: PortfolioPosition[];
  caption: string;
}) {
  return (
    <Table className="portfolio-table">
      <TableCaption>
        {caption} Andel av hela den angivna portföljen, inte av bara den
        identifierade delen.
      </TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Värdepapper</TableHead>
          <TableHead>Via dina valda fonder</TableHead>
          <TableHead className="text-right">Portföljandel</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {positions.map((position) => (
          <TableRow key={position.isin}>
            <TableCell>
              <strong>{position.name}</strong>
              <small>{position.isin}</small>
            </TableCell>
            <TableCell>
              <ul>
                {position.contributors.map((item) => (
                  <li key={item.fundId}>
                    {item.fundName}{' '}
                    <span>· {percent(item.portfolioWeight)}</span>
                  </li>
                ))}
              </ul>
            </TableCell>
            <TableCell className="text-right font-semibold tabular-nums">
              {percent(position.weight)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function FundPortfolio({
  dataset,
  dataState,
  onLoad,
}: {
  dataset: FiFundDataset | null;
  dataState: 'idle' | 'loading' | 'ready' | 'error';
  onLoad: () => Promise<FiFundDataset | null>;
}) {
  const [entries, setEntries] = useState<PortfolioEntry[]>([]);
  const [candidate, setCandidate] = useState<FiFund | null>(null);
  const { funds: favorites, ready: favoritesReady } = useFavorites();
  const result = useMemo(() => analyzePortfolio(entries), [entries]);
  const available = useMemo(
    () =>
      (dataset?.funds ?? [])
        .filter((fund) => !entries.some((entry) => entry.fund.id === fund.id))
        .sort((a, b) => a.name.localeCompare(b.name, 'sv-SE')),
    [dataset, entries],
  );
  const savedChoices = favoritesReady
    ? favorites.flatMap((favorite) => {
        const fund =
          favorite.source === 'fi'
            ? available.find((item) => item.id === favorite.id)
            : undefined;
        return fund ? [fund] : [];
      })
    : [];
  const atLimit = entries.length >= MAX_PORTFOLIO_FUNDS;
  function addFund(fund: FiFund) {
    setEntries((current) =>
      current.length >= MAX_PORTFOLIO_FUNDS ||
      current.some((entry) => entry.fund.id === fund.id)
        ? current
        : [...current, { fund, allocation: '' }],
    );
    setCandidate(null);
    requestAnimationFrame(() =>
      document.getElementById(`allocation-${fund.id}`)?.focus(),
    );
  }
  function changeAllocation(id: string, allocation: string) {
    setEntries((current) =>
      current.map((entry) =>
        entry.fund.id === id ? { ...entry, allocation } : entry,
      ),
    );
  }
  const statusMessage =
    result.status === 'choose-funds'
      ? 'Välj minst två fonder för att se en samlad översikt.'
      : result.status === 'too-many-funds'
        ? `Du kan välja högst ${MAX_PORTFOLIO_FUNDS} fonder.`
        : result.status === 'duplicate-fund'
          ? 'Samma fond får bara finnas en gång. Ta bort dubbletten.'
          : result.status === 'invalid-allocation'
            ? 'Ange en andel större än 0 och högst 100 % för varje fond, med högst två decimaler.'
            : result.status === 'allocation-total'
              ? result.totalAllocation! < 100
                ? `${percent(100 - result.totalAllocation!)} återstår att fördela. Summan ska vara 100 %.`
                : `${percent(result.totalAllocation! - 100)} för mycket är fördelat. Summan ska vara 100 %.`
              : result.status === 'invalid-date'
                ? 'Ett giltigt rapportdatum saknas. Ingen sammanvägning visas.'
                : result.status === 'different-dates'
                  ? 'Fondernas innehav avser olika datum. Ingen sammanvägning visas förrän underlagen har samma rapportdatum.'
                  : result.status === 'unsupported-weights'
                    ? 'Någon fond har vikter som översikten inte stödjer, till exempel negativa vikter eller en summa över 100 %. Ingen sammanvägning visas.'
                    : '';

  return (
    <section
      id="portfolj"
      className="portfolio-card"
      aria-labelledby="portfolio-title"
    >
      <div className="portfolio-heading">
        <div>
          <Badge variant="secondary">
            <Layers3 aria-hidden="true" /> Samlad bild
          </Badge>
          <h2 id="portfolio-title">Vad finns bakom dina fonder?</h2>
          <p>
            Välj 2–10 fonder och ange deras andel av ditt fondsparande. Se dina
            största kända positioner och vilka värdepapper som återkommer.
          </p>
        </div>
        <span className="portfolio-session">
          Valen sparas inte när sidan laddas om
        </span>
      </div>
      {dataState === 'idle' && (
        <div className="portfolio-notice">
          <p>Ladda FI-underlaget när du vill bygga en portföljbild.</p>
          <Button
            type="button"
            variant="outline"
            className="mt-3"
            onClick={() => {
              void onLoad();
            }}
          >
            Ladda fondlistan
          </Button>
        </div>
      )}
      {dataState === 'loading' && (
        <output className="portfolio-notice block">
          Hämtar fonder från Finansinspektionen…
        </output>
      )}
      {dataState === 'error' && (
        <p className="portfolio-notice" role="alert">
          Fondunderlaget kunde inte hämtas. Ladda om sidan för att försöka igen.
        </p>
      )}
      {dataState === 'ready' && (
        <>
          <div className="portfolio-layout">
            <div className="portfolio-editor">
              <h3>Din fördelning</h3>
              {!atLimit ? (
                <div className="portfolio-add">
                  <FundPicker
                    id="portfolio-fund"
                    label="Sök en fond att lägga till"
                    funds={available}
                    value={candidate}
                    onChange={setCandidate}
                  />
                  <Button
                    type="button"
                    disabled={!candidate}
                    onClick={() => {
                      if (candidate) addFund(candidate);
                    }}
                  >
                    <Plus aria-hidden="true" /> Lägg till fond
                  </Button>
                </div>
              ) : (
                <p className="portfolio-notice">
                  Du har valt {MAX_PORTFOLIO_FUNDS} fonder. Ta bort en för att
                  lägga till en annan.
                </p>
              )}
              {!atLimit && savedChoices.length > 0 && (
                <div className="portfolio-shortcuts">
                  <p>Lägg till från Mina fonder</p>
                  <div>
                    {savedChoices.slice(0, 6).map((fund) => (
                      <Button
                        type="button"
                        key={fund.id}
                        variant="outline"
                        onClick={() => addFund(fund)}
                      >
                        <Plus aria-hidden="true" />
                        {fund.name}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              <p className="portfolio-scope">
                Bara fonder med FI-innehav kan läggas till. PPM-favoriter
                kopplas inte automatiskt till FI-fonder.
              </p>
              {entries.length > 0 && (
                <>
                  <ol className="portfolio-entries">
                    {entries.map((entry, i) => (
                      <li key={entry.fund.id}>
                        <div className="portfolio-entry-name">
                          <span>{i + 1}</span>
                          <div>
                            <strong>{entry.fund.name}</strong>
                            <small>
                              Innehav {entry.fund.reportDate} ·{' '}
                              {entry.fund.isin ?? entry.fund.id}
                            </small>
                          </div>
                        </div>
                        <div className="portfolio-entry-actions">
                          <div>
                            <label htmlFor={`allocation-${entry.fund.id}`}>
                              Andel (%)
                              <span className="sr-only">
                                {' '}
                                för {entry.fund.name}
                              </span>
                            </label>
                            <Input
                              id={`allocation-${entry.fund.id}`}
                              type="text"
                              inputMode="decimal"
                              autoComplete="off"
                              placeholder="t.ex. 50"
                              value={entry.allocation}
                              aria-invalid={
                                entry.allocation !== '' &&
                                parseAllocation(entry.allocation) === null
                              }
                              aria-describedby="portfolio-allocation-help"
                              onChange={(event) =>
                                changeAllocation(
                                  entry.fund.id,
                                  event.target.value,
                                )
                              }
                            />
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`Ta bort ${entry.fund.name} från portföljen`}
                            onClick={() => {
                              setEntries((current) =>
                                current.filter(
                                  (item) => item.fund.id !== entry.fund.id,
                                ),
                              );
                              requestAnimationFrame(() =>
                                document
                                  .getElementById('portfolio-fund')
                                  ?.focus(),
                              );
                            }}
                          >
                            <Trash2 aria-hidden="true" />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ol>
                  <div className="portfolio-total">
                    <strong>
                      Fördelat:{' '}
                      {result.totalAllocation === null
                        ? '—'
                        : percent(result.totalAllocation)}{' '}
                      / 100 %
                    </strong>
                    {entries.length >= 2 && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          setEntries((current) => {
                            const weights = equalAllocations(current.length);
                            return current.map((entry, i) => ({
                              ...entry,
                              allocation: weights[i],
                            }));
                          })
                        }
                      >
                        Fördela lika
                      </Button>
                    )}
                  </div>
                </>
              )}
              <p id="portfolio-allocation-help" className="portfolio-scope">
                Summan ska vara 100 %. Använd komma eller punkt och högst två
                decimaler. Inga belopp behövs; dina val skickas inte till
                servern.
              </p>
              <output className="portfolio-status" aria-live="polite">
                {statusMessage ||
                  `Översikten är uppdaterad. ${percent(result.status === 'ready' ? result.coverage : 0)} har identifierade innehav.`}
              </output>
            </div>

            <div className="portfolio-overview">
              {result.status !== 'ready' ? (
                <Empty className="portfolio-empty">
                  <EmptyHeader>
                    <EmptyTitle className="text-lg">
                      Se fonderna som en helhet
                    </EmptyTitle>
                    <EmptyDescription className="text-base">
                      När minst två fonder är valda och fördelningen är 100 %
                      visas din översikt här. Bara identifierade innehav räknas
                      med.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <>
                  <h3>Så mycket kan vi se</h3>
                  <div className="portfolio-coverage">
                    <strong>{percent(result.coverage)}</strong>
                    <span>
                      av din angivna portfölj har identifierade innehav
                    </span>
                  </div>
                  <Progress
                    value={result.coverage}
                    aria-label="Andel av portföljen med identifierade innehav"
                  />
                  <p className="portfolio-unknown">
                    <strong>
                      {percent(result.unknownWeight)} saknar täckning.
                    </strong>{' '}
                    Det är inte en uppgift om kontanter. Innehaven kan saknas i
                    utdraget eller sakna användbart ISIN.
                  </p>
                  <dl className="portfolio-metrics">
                    <div>
                      <dt>Tio största kända positionerna</dt>
                      <dd>{percent(result.topTenWeight)}</dd>
                    </div>
                    <div>
                      <dt>Värdepapper i flera fonder</dt>
                      <dd>{result.shared.length} st</dd>
                    </div>
                  </dl>
                  <p className="portfolio-scope">
                    Andelarna gäller hela portföljen. Detta är
                    innehavskoncentration, inte avkastning eller ett riskbetyg.
                  </p>
                  <h4>Underlag per fond</h4>
                  <ul className="portfolio-fund-coverage">
                    {result.funds.map((fund) => (
                      <li key={fund.id}>
                        <strong>{fund.name}</strong>
                        <span>
                          Identifierade innehav:{' '}
                          {percent(fund.identifiedWeight)} av fondens värde ·
                          bidrar med {percent(fund.portfolioWeight)} av
                          portföljen
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>
          {result.status === 'ready' && (
            <DataFreshness
              observationLabel="Innehaven i översikten avser"
              observationDate={result.reportDate}
              publishedAt={dataset?.source.publishedAt}
              fetchedAt={dataset?.source.fetchedAt}
              fetchLabel="Hämtat till SuperSafe"
              note="Historiska kvartalsinnehav, inte dagens portföljer. Beräkningen kombinerar dina angivna andelar med fondvikterna på rapportdagen."
            />
          )}
          <ResultExplanation
            id="portfolio-explanation"
            explanation={explainPortfolio(result)}
          />
          {result.status === 'ready' && (
            <div className="portfolio-results">
              <h3>Största kända positionerna</h3>
              <p>
                Högst tio visas, sorterade efter deras sammanlagda andel av din
                portfölj.
              </p>
              {result.positions.length > 0 ? (
                <PositionTable
                  positions={result.positions.slice(0, 10)}
                  caption="Största kända positionerna."
                />
              ) : (
                <p className="portfolio-notice">
                  Inga innehav med användbart ISIN finns för de valda fonderna.
                  Hela portföljen saknar täckning.
                </p>
              )}
              <h3>Värdepapper som återkommer</h3>
              <p>
                Samma ISIN i minst två av dina valda fonder. Detta är inte samma
                mått som den parvisa fondjämförelsen längre ned.
              </p>
              {result.shared.length > 0 ? (
                <PositionTable
                  positions={result.shared}
                  caption={`${result.shared.length} återkommande värdepapper.`}
                />
              ) : (
                <p className="portfolio-notice">
                  Inga återkommande värdepapper hittades i underlaget. Det
                  betyder inte säkert att fonderna saknar gemensamma innehav
                  eller liknande exponering.
                </p>
              )}
            </div>
          )}
        </>
      )}
      <details className="portfolio-method">
        <summary>Så räknar vi och detta saknas</summary>
        <p>
          Varje innehavs fondvikt multipliceras med din andel i fonden. Om du
          anger 50 % i en fond där ett värdepapper väger 8 %, bidrar det med 4 %
          av portföljen. Bidragen summeras för exakt samma ISIN. Flera rader med
          samma ISIN i en fond summeras först.
        </p>
        <p>
          Endast tillgängliga positioner med användbart ISIN räknas. Olika
          aktieslag i samma bolag hålls isär. Underliggande fonder och derivat
          genomlyses inte. Saknade innehav uppskattas inte och vikterna skalas
          aldrig upp till 100 %. Det här är inte en fullständig riskanalys eller
          investeringsrådgivning.
        </p>
        <p>
          Alla fonder måste ha samma giltiga rapportdatum. Negativa eller
          ogiltiga vikter och summor över 100 % stoppar resultatet, även om
          skillnaden kan bero på avrundning i källan. ”Fördela lika” ger vid
          behov den extra hundradelen till fonderna överst så att summan blir
          exakt 100 %.
        </p>
        <a
          href={
            dataset?.source.url ??
            'https://www.fi.se/sv/vara-register/fondinnehav/'
          }
          target="_blank"
          rel="noopener noreferrer"
        >
          Källa: Finansinspektionen ·{' '}
          {dataset?.source.period ?? 'Rapporterade fondinnehav'}
        </a>
      </details>
    </section>
  );
}
