'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';

import { DataFreshness } from '@/components/data-freshness';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ReferenceFund } from '@/lib/funds/reference-funds';

const number = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 2 });

export function ReferenceFundHoldings({ fund }: { fund: ReferenceFund }) {
  const [showAll, setShowAll] = useState(false);
  const { portfolio } = fund;
  const isComplete = portfolio.scope === 'complete-equities';
  const holdings = showAll
    ? portfolio.holdings
    : portfolio.holdings.slice(0, 10);
  const canExpand = portfolio.holdings.length > 10;

  return (
    <div className="mt-8 border-t border-emerald-900/10 pt-8">
      <DataFreshness
        observationLabel="Fondens innehav avser"
        observationDate={portfolio.asOf}
        fetchedAt={portfolio.fetchedAt}
        fetchLabel="Hämtat till SuperSafe"
        note="Fondvikt och kursutveckling är olika uppgifter. Innehaven är en historisk ögonblicksbild och kan ha ändrats efter rapportdagen."
      />

      <div className="mt-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xl font-semibold tracking-[-0.02em]">
              {isComplete
                ? 'Rapporterade aktieinnehav'
                : '10 största innehaven'}
            </h3>
            <Badge
              variant="outline"
              className={
                isComplete
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                  : 'border-amber-300 bg-amber-50 text-amber-900'
              }
            >
              {isComplete ? 'Komplett aktielista' : 'Topp 10 · inte komplett'}
            </Badge>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {isComplete
              ? `${portfolio.holdings.length} aktieinnehav visas. Kassa är inte en aktie och har därför utelämnats.`
              : `${portfolio.holdings.length} av ${portfolio.reportedHoldingsCount ?? 'fler'} rapporterade innehav visas eftersom fondbolagets öppna data bara anger de största positionerna.`}
          </p>
        </div>
        <a
          href={portfolio.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="share-fund-link shrink-0"
        >
          Källa: {portfolio.sourceName} <ExternalLink aria-hidden="true" />
        </a>
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-emerald-900/10">
        <Table className="table-fixed sm:table-auto">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[72%] sm:w-auto">Aktie</TableHead>
              <TableHead className="w-[28%] text-right sm:w-auto sm:text-left">
                <span className="sm:hidden">Vikt</span>
                <span className="hidden sm:inline">Fondvikt</span>
              </TableHead>
              <TableHead className="hidden sm:table-cell">Land</TableHead>
              <TableHead className="hidden sm:table-cell">Valuta</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {holdings.map((holding, index) => (
              <TableRow key={`${holding.name}-${index}`}>
                <TableCell>
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="ticker-avatar shrink-0">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <div className="min-w-0">
                      <p className="break-words font-semibold">
                        {holding.name}
                      </p>
                      {(holding.country || holding.currency) && (
                        <p className="text-sm text-muted-foreground sm:hidden">
                          {[holding.country, holding.currency]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="whitespace-nowrap text-right sm:text-left">
                  <strong className="font-mono text-sm">
                    {number.format(holding.weight)} %
                  </strong>
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  {holding.country ?? '—'}
                </TableCell>
                <TableCell className="hidden font-mono text-sm sm:table-cell">
                  {holding.currency ?? '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {canExpand && (
        <div className="mt-4 flex justify-center">
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowAll((value) => !value)}
            aria-expanded={showAll}
          >
            {showAll
              ? 'Visa de 10 största'
              : `Visa alla ${portfolio.holdings.length} aktier`}
            {showAll ? (
              <ChevronUp aria-hidden="true" />
            ) : (
              <ChevronDown aria-hidden="true" />
            )}
          </Button>
        </div>
      )}

      <div className="mt-5 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm leading-6 text-sky-950">
        <strong>Kursutveckling 1D, 1V och 1M:</strong> nästa del kräver en
        separat marknadsdatakälla. Kolumnerna läggs inte ut med uppskattade
        värden; de kopplas först när varje aktie och handelsplats kan
        verifieras.
      </div>
    </div>
  );
}
