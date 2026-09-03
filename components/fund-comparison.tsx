'use client';

import { useMemo, useState } from 'react';
import { DataFreshness } from '@/components/data-freshness';
import { ArrowLeftRight, Info, Layers3 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Combobox, ComboboxInput, ComboboxContent, ComboboxEmpty, ComboboxList, ComboboxItem } from '@/components/ui/combobox';
import { Table, TableHeader, TableHead, TableRow, TableBody, TableCell, TableCaption } from '@/components/ui/table';
import { matchesFiFund, normalizeFundSearch, type FiFund, type FiFundDataset } from '@/lib/funds/fi-funds';
import { compareFunds, indexHoldings } from '@/lib/funds/overlap';

const percent = (value: number) => `${new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 2 }).format(value)} %`;

function FundPicker({ id, label, funds, value, onChange }: { id: string; label: string; funds: FiFund[]; value: FiFund | null; onChange: (fund: FiFund | null) => void }) {
  return <div className="compare-picker">
    <label htmlFor={id}>{label}</label>
    <Combobox items={funds} value={value} onValueChange={onChange} itemToStringLabel={(fund: FiFund) => fund.name}
      isItemEqualToValue={(a: FiFund, b: FiFund) => a.id === b.id}
      filter={(fund: FiFund, query: string) => !normalizeFundSearch(query) || matchesFiFund(fund, query)}>
      <ComboboxInput id={id} placeholder="Till exempel LF Global eller ISIN…" showClear className="h-12 w-full bg-background" aria-describedby={`${id}-help`} />
      <ComboboxContent>
        <ComboboxEmpty className="p-4 text-left leading-5">Ingen träff i vårt FI-underlag. Skriv minst två tecken eller prova ISIN. Fonden kan också saknas i datakällan — alla fonder ingår inte.</ComboboxEmpty>
        <ComboboxList>{(fund: FiFund) => <ComboboxItem key={fund.id} value={fund} className="py-3 data-highlighted:bg-secondary data-highlighted:text-foreground">
          <span className="min-w-0"><span className="block font-medium">{fund.name}</span><small className="block text-muted-foreground">{fund.company} · {fund.isin ?? 'ISIN saknas'}</small></span>
        </ComboboxItem>}</ComboboxList>
      </ComboboxContent>
    </Combobox>
    <p id={`${id}-help`} className="mt-2 text-xs leading-5 text-muted-foreground">{funds.length} FI-fonder · LF = Länsförsäkringar · Alla träffar kan rullas fram.</p>
  </div>;
}

function Coverage({ fund }: { fund: FiFund }) {
  const identified = indexHoldings(fund);
  return <div className="compare-coverage">
    <h3>{fund.name}</h3>
    <p><strong>{percent(identified.identifiedWeight)}</strong> av fondens värde har identifierbart ISIN i underlaget.</p>
    <small>{fund.holdings.length} av {fund.holdingsCount} rapporterade positioner visas · {fund.reportDate}</small>
    {identified.excluded > 0 && <small>{identified.excluded} positioner saknar användbart ISIN och matchas inte.</small>}
  </div>;
}

export function FundComparison({ dataset, dataState }: { dataset: FiFundDataset | null; dataState: 'loading' | 'ready' | 'error' }) {
  const [left, setLeft] = useState<FiFund | null>(null);
  const [right, setRight] = useState<FiFund | null>(null);
  const result = useMemo(() => left && right ? compareFunds(left, right) : null, [left, right]);
  const funds = useMemo(() => [...(dataset?.funds ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'sv-SE')), [dataset]);
  const exampleA = funds.find(fund => fund.id === 'SE0001718388');
  const exampleB = funds.find(fund => fund.id === 'SE0009773716');

  return <section id="jamfor-fonder" className="compare-card" aria-labelledby="compare-title">
    <div className="compare-heading">
      <div className="flex items-center gap-3"><span className="panel-icon safe"><Layers3 aria-hidden="true" /></span><Badge variant="secondary">Jämför verkliga innehav</Badge></div>
      <h2 id="compare-title">Hur lika är dina fonder?</h2>
      <p>Välj två fonder och se vilka värdepapper som återkommer. Fler fonder behöver inte betyda fler olika innehav.</p>
    </div>
    {dataState === 'loading' && <output className="compare-message block">Hämtar fonder från Finansinspektionen…</output>}
    {dataState === 'error' && <p className="compare-message" role="alert">Fondlistan kunde inte hämtas. Ladda om sidan för att försöka igen.</p>}
    {dataState === 'ready' && <>
      <DataFreshness observationLabel="FI-underlagets innehav avser" observationDate={dataset?.source.reportDate} publishedAt={dataset?.source.publishedAt} note="Kvartalsrapporterade innehav, inte dagens portföljer. Hämtningsdatum från FI är inte sparat i detta underlag. Att öppna sidan på nytt ändrar inte rapportdatumet. Varje vald fonds rapportdatum visas i resultatet." />
      <div className="compare-selectors">
        <FundPicker id="compare-left" label="Fond 1" funds={funds} value={left} onChange={setLeft} />
        <Button variant="outline" size="icon" aria-label="Byt plats på fonderna" onClick={() => { setLeft(right); setRight(left); }} disabled={!left && !right} className="compare-swap"><ArrowLeftRight aria-hidden="true" /></Button>
        <FundPicker id="compare-right" label="Fond 2" funds={funds} value={right} onChange={setRight} />
      </div>
      {!result && <div className="compare-start">
        <p>Välj en fond i varje fält. Jämförelsen visas direkt.</p>
        {exampleA && exampleB && <Button variant="outline" onClick={() => { setLeft(exampleA); setRight(exampleB); }}>Prova Avanza Zero + SEB Sverige Indexfond</Button>}
      </div>}
      <div aria-live="polite">
        {result?.status === 'same-fund' && <p className="compare-message">Du har valt samma fond två gånger. Välj en annan fond för att jämföra.</p>}
        {result?.status === 'different-dates' && <p className="compare-message">Rapportdatumen skiljer sig. Vi visar ingen överlappningssiffra när underlagen avser olika datum.</p>}
        {result?.status === 'unsupported-weights' && <p className="compare-message">Underlaget innehåller vikter som den här enkla jämförelsen inte stödjer, exempelvis negativa positioner eller vikter över 100 %. Ingen överlappningssiffra beräknas.</p>}
        {result?.status === 'ready' && left && right && <>
          <div className="compare-summary">
            <div><span className="compare-score">{percent(result.overlapWeight)}</span><h3>Identifierad gemensam vikt</h3><p>{result.shared.length} gemensamma värdepapper med samma ISIN.</p></div>
            <div className="compare-explanation"><Info aria-hidden="true" /><p>Detta gäller bara de innehav vi kan identifiera i båda fonderna. Den totala överlappningen kan vara större. Siffran är varken avkastning eller ett riskbetyg.</p></div>
          </div>
          <div className="compare-coverage-grid"><Coverage fund={left} /><Coverage fund={right} /></div>
          {result.shared.length > 0 ? <Table className="compare-table">
            <TableCaption>Gemensamma värdepapper · rapportdatum {left.reportDate}. Sorterat efter gemensam vikt.</TableCaption>
            <TableHeader><TableRow><TableHead>Värdepapper</TableHead><TableHead className="text-right">Fond 1</TableHead><TableHead className="text-right">Fond 2</TableHead><TableHead className="text-right">Gemensam vikt</TableHead></TableRow></TableHeader>
            <TableBody>{result.shared.map(holding => <TableRow key={holding.isin}>
              <TableCell><strong>{holding.name}</strong><small className="block text-muted-foreground">{holding.isin}</small></TableCell>
              <TableCell className="text-right">{percent(holding.leftWeight)}</TableCell><TableCell className="text-right">{percent(holding.rightWeight)}</TableCell><TableCell className="text-right font-semibold">{percent(holding.sharedWeight)}</TableCell>
            </TableRow>)}</TableBody>
          </Table> : <p className="compare-message">Inga gemensamma värdepapper hittades i det tillgängliga underlaget. Det betyder inte säkert att fonderna saknar gemensamma innehav eller liknande exponering.</p>}
        </>}
      </div>
    </>}
    <details className="compare-method">
      <summary>Så beräknas jämförelsen och detta ingår inte</summary>
      <p>Vi matchar exakt ISIN och summerar den lägre fondvikten för varje gemensamt värdepapper. Om samma värdepapper väger 8 % i fond 1 och 5 % i fond 2 bidrar det med 5 procentenheter. Flera positioner med samma ISIN summeras först inom respektive fond.</p>
      <p>Olika aktieslag, exempelvis A- och B-aktier i samma bolag, matchas inte. Vi tittar inte igenom underliggande fonder eller derivat. Bara de största tillgängliga positionerna ingår; ingen uppskalning till 100 % görs. Vikterna är avrundade i källan. Fonderna måste ha samma rapportdatum.</p>
      <a href={dataset?.source.url ?? 'https://www.fi.se/sv/vara-register/fondinnehav/'} target="_blank" rel="noopener noreferrer">Källa: Finansinspektionen · {dataset?.source.period ?? 'Rapporterade fondinnehav'}</a>
    </details>
  </section>;
}
