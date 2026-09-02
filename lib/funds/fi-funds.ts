import type { Fund } from './types';

export type FiHolding = {
  name: string;
  isin: string | null;
  country: string | null;
  currency: string | null;
  assetClass: string | null;
  weight: number;
  marketValue: number;
};

export type FiFund = {
  id: string;
  name: string;
  isin: string | null;
  company: string;
  instituteNumber: string;
  reportDate: string;
  holdingsCount: number;
  fundWealth: number;
  cashWeight: number;
  displayedWeight: number;
  topTenWeight: number;
  holdings: FiHolding[];
};

export type FiFundDataset = {
  source: {
    name: string;
    period: string;
    reportDate: string;
    publishedAt: string;
    url: string;
  };
  funds: FiFund[];
};

export function normalizeFundSearch(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/ø/g, 'o').replace(/æ/g, 'ae')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

function searchTerm(query: string) {
  // Expand only known, whole-word abbreviations, never fragments of fund names.
  const aliases: Record<string, string> = { lf: 'lansforsakringar' };
  return normalizeFundSearch(query).split(' ').map(word => aliases[word] ?? word).join(' ');
}

export function isExactFiFundMatch(fund: FiFund, query: string) {
  const term = searchTerm(query);
  return term.length >= 2 && (normalizeFundSearch(fund.name) === term
    || (!!fund.isin && normalizeFundSearch(fund.isin).replace(/ /g, '') === term.replace(/ /g, '')));
}

function matchScore(fund: FiFund, query: string) {
  const term = searchTerm(query);
  if (term.length < 2) return -1;
  if (isExactFiFundMatch(fund, query)) return 100;
  const compact = term.replace(/ /g, '');
  // An ISIN-like query must match the identifier, not an unrelated fund name.
  if (/^[a-z]{2}\d[a-z0-9]*$/.test(compact)) {
    return compact.length >= 4 && normalizeFundSearch(fund.isin ?? '').startsWith(compact) ? 90 : -1;
  }
  const name = normalizeFundSearch(fund.name);
  const tokens = term.split(' ');
  if (name === term) return 100;
  if (name.startsWith(term)) return 80;
  if (name.includes(term)) return 70;
  if (tokens.every(token => name.includes(token))) return 60;
  const withCompany = `${name} ${normalizeFundSearch(fund.company)}`;
  return tokens.every(token => withCompany.includes(token)) ? 40 : -1;
}

export function matchesFiFund(fund: FiFund, query: string) {
  return matchScore(fund, query) >= 0;
}

export function searchFiFunds(funds: FiFund[], query: string, limit = Infinity) {
  return funds.map(fund => ({ fund, score: matchScore(fund, query) }))
    .filter(item => item.score >= 0)
    .sort((a, b) => b.score - a.score || a.fund.name.localeCompare(b.fund.name, 'sv-SE') || a.fund.id.localeCompare(b.fund.id))
    .slice(0, limit).map(item => item.fund);
}

export function resolveFiFund(funds: FiFund[], query: string): FiFund | undefined {
  const matches = searchFiFunds(funds, query);
  const exact = matches.filter(fund => isExactFiFundMatch(fund, query));
  if (exact.length === 1) return exact[0];
  return matches.length === 1 ? matches[0] : undefined;
}

export function fiFundToFund(fund: FiFund): Fund {
  return {
    source: 'fi',
    name: fund.name,
    category: `${fund.company} · Svensk värdepappersfond`,
    riskClass: 0,
    updated: `FI-data · ${fund.reportDate}`,
    isin: fund.isin ?? undefined,
    company: fund.company,
    reportDate: fund.reportDate,
    holdingsCount: fund.holdingsCount,
    displayedWeight: fund.displayedWeight,
    cashWeight: fund.cashWeight,
    topTenWeight: fund.topTenWeight,
    holdings: fund.holdings.map((holding) => ({
      name: holding.name,
      ticker: holding.isin?.slice(-6) ?? 'SAKNAS',
      isin: holding.isin ?? undefined,
      country: holding.country ?? undefined,
      currency: holding.currency ?? undefined,
      assetClass: holding.assetClass ?? undefined,
      weight: holding.weight,
    })),
  };
}
