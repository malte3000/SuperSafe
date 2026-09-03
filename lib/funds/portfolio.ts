import type { FiFund } from './fi-funds';
import { indexHoldings } from './overlap';

export const MAX_PORTFOLIO_FUNDS = 10;
export type PortfolioEntry = { fund: FiFund; allocation: string };
export type PortfolioPosition = {
  isin: string; name: string; weight: number;
  contributors: { fundId: string; fundName: string; fundWeight: number; portfolioWeight: number }[];
};

// Integer basis points avoid floating-point ambiguity when allocations must total 100%.
export function parseAllocation(value: string): number | null {
  const text = value.trim();
  if (!/^\d{1,3}(?:[.,]\d{1,2})?$/.test(text)) return null;
  const [whole, decimal = ''] = text.replace(',', '.').split('.');
  const points = Number(whole) * 100 + Number(decimal.padEnd(2, '0'));
  return points > 0 && points <= 10000 ? points : null;
}

export function equalAllocations(count: number): string[] {
  if (!Number.isInteger(count) || count < 2 || count > MAX_PORTFOLIO_FUNDS) return [];
  const base = Math.floor(10000 / count);
  return Array.from({ length: count }, (_, i) => ((base + (i < 10000 % count ? 1 : 0)) / 100).toFixed(2).replace('.', ','));
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function analyzePortfolio(entries: PortfolioEntry[]) {
  const allocations = entries.map(entry => parseAllocation(entry.allocation));
  const totalAllocation = allocations.every(value => value !== null)
    ? allocations.reduce((sum, value) => sum + value, 0) / 100 : null;
  const unavailable = (status: 'choose-funds' | 'too-many-funds' | 'duplicate-fund' | 'invalid-allocation' | 'allocation-total' | 'invalid-date' | 'different-dates' | 'unsupported-weights') => ({ status, totalAllocation });
  if (entries.length < 2) return unavailable('choose-funds');
  if (entries.length > MAX_PORTFOLIO_FUNDS) return unavailable('too-many-funds');
  if (new Set(entries.map(entry => entry.fund.id)).size !== entries.length) return unavailable('duplicate-fund');
  if (totalAllocation === null) return unavailable('invalid-allocation');
  if (totalAllocation !== 100) return unavailable('allocation-total');
  if (entries.some(entry => !validDate(entry.fund.reportDate))) return unavailable('invalid-date');
  if (new Set(entries.map(entry => entry.fund.reportDate)).size !== 1) return unavailable('different-dates');

  const indexed = entries.map(entry => indexHoldings(entry.fund));
  // Stricter than the pairwise comparison: coverage cannot exceed the portfolio.
  // Allow only floating-point noise, never rescale rounded source weights to 100%.
  if (indexed.some((item, i) => !item.validWeights || entries[i].fund.holdings.reduce((sum, holding) => sum + holding.weight, 0) > 100 + 1e-8)) {
    return unavailable('unsupported-weights');
  }

  const positions = new Map<string, PortfolioPosition>();
  const funds = entries.map((entry, i) => {
    const allocation = allocations[i]! / 100;
    const known = indexed[i];
    for (const [isin, holding] of known.positions) {
      const portfolioWeight = allocation * holding.weight / 100;
      const position = positions.get(isin) ?? { isin, name: holding.name, weight: 0, contributors: [] };
      position.weight += portfolioWeight;
      position.contributors.push({ fundId: entry.fund.id, fundName: entry.fund.name, fundWeight: holding.weight, portfolioWeight });
      positions.set(isin, position);
    }
    return { id: entry.fund.id, name: entry.fund.name, allocation, identifiedWeight: known.identifiedWeight, portfolioWeight: allocation * known.identifiedWeight / 100 };
  });
  const sorted = [...positions.values()].sort((a, b) => b.weight - a.weight || a.isin.localeCompare(b.isin));
  const coverage = Math.min(100, sorted.reduce((sum, position) => sum + position.weight, 0));
  return {
    status: 'ready' as const, totalAllocation, reportDate: entries[0].fund.reportDate,
    funds, positions: sorted, shared: sorted.filter(position => position.contributors.length > 1),
    coverage, unknownWeight: 100 - coverage,
    topTenWeight: sorted.slice(0, 10).reduce((sum, position) => sum + position.weight, 0),
  };
}
