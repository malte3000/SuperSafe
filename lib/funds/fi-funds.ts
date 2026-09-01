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

function normalize(value: string) {
  return value.trim().toLocaleLowerCase('sv-SE');
}

export function searchFiFunds(funds: FiFund[], query: string, limit = 6) {
  const term = normalize(query);
  if (term.length < 2) return [];

  return funds
    .filter((fund) => normalize(fund.name).includes(term) || normalize(fund.isin ?? '') === term)
    .sort((a, b) => {
      const aExact = normalize(a.name) === term || normalize(a.isin ?? '') === term;
      const bExact = normalize(b.name) === term || normalize(b.isin ?? '') === term;
      if (aExact !== bExact) return aExact ? -1 : 1;
      return a.name.localeCompare(b.name, 'sv-SE');
    })
    .slice(0, limit);
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
