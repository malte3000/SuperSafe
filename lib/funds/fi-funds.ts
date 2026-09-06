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

export type FiFundSource = {
  name: string;
  period: string;
  reportDate: string;
  publishedAt: string;
  fetchedAt?: string;
  archiveName?: string;
  url: string;
};

export type FiFundDataset = {
  source: FiFundSource;
  funds: FiFund[];
};

const isoDate = /^\d{4}-\d{2}-\d{2}$/;

export function isFiFundSource(value: unknown): value is FiFundSource {
  if (!value || typeof value !== 'object') return false;
  const source = value as Record<string, unknown>;
  return (
    source.name === 'Finansinspektionen' &&
    typeof source.period === 'string' &&
    isoDate.test(String(source.reportDate)) &&
    isoDate.test(String(source.publishedAt)) &&
    (source.fetchedAt === undefined ||
      (typeof source.fetchedAt === 'string' &&
        !Number.isNaN(Date.parse(source.fetchedAt)))) &&
    (source.archiveName === undefined ||
      typeof source.archiveName === 'string') &&
    typeof source.url === 'string'
  );
}

export function isFiFundDataset(value: unknown): value is FiFundDataset {
  if (!value || typeof value !== 'object') return false;
  const dataset = value as { source?: unknown; funds?: unknown };
  const source = dataset.source;
  if (
    !isFiFundSource(source) ||
    !Array.isArray(dataset.funds) ||
    dataset.funds.length < 100
  )
    return false;
  return dataset.funds.every((item) => {
    if (!item || typeof item !== 'object') return false;
    const fund = item as Record<string, unknown>;
    return (
      typeof fund.id === 'string' &&
      typeof fund.name === 'string' &&
      fund.reportDate === source.reportDate &&
      Array.isArray(fund.holdings) &&
      fund.holdings.every((holding) => {
        if (!holding || typeof holding !== 'object') return false;
        const row = holding as Record<string, unknown>;
        return (
          typeof row.name === 'string' &&
          typeof row.weight === 'number' &&
          Number.isFinite(row.weight) &&
          row.weight > 0 &&
          row.weight <= 100
        );
      })
    );
  });
}

export function isNewerFiSource(
  candidate: FiFundSource,
  current: FiFundSource,
) {
  if (candidate.reportDate !== current.reportDate)
    return candidate.reportDate > current.reportDate;
  return (
    candidate.archiveName !== current.archiveName &&
    candidate.publishedAt >= current.publishedAt
  );
}

export function normalizeFundSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/ø/g, 'o')
    .replace(/æ/g, 'ae')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function searchTerm(query: string) {
  // Expand only known, whole-word abbreviations, never fragments of fund names.
  const aliases: Record<string, string> = {
    hb: 'handelsbanken',
    lf: 'lansforsakringar',
    shb: 'handelsbanken',
  };
  return normalizeFundSearch(query)
    .split(' ')
    .map((word) => aliases[word] ?? word)
    .join(' ');
}

function fundIdentifiers(fund: FiFund) {
  return [fund.isin, fund.instituteNumber]
    .filter((value): value is string => Boolean(value))
    .map((value) => normalizeFundSearch(value).replace(/ /g, ''));
}

export function isExactFiFundMatch(fund: FiFund, query: string) {
  const term = searchTerm(query);
  const compact = term.replace(/ /g, '');
  return (
    term.length >= 2 &&
    (normalizeFundSearch(fund.name) === term ||
      fundIdentifiers(fund).includes(compact))
  );
}

function matchScore(fund: FiFund, query: string) {
  const term = searchTerm(query);
  if (term.length < 2) return -1;
  if (isExactFiFundMatch(fund, query)) return 100;
  const compact = term.replace(/ /g, '');
  // Identifier-like queries must match identifiers, not unrelated fund names.
  if (/^[a-z]{2}\d[a-z0-9]*$/.test(compact) || /^\d+$/.test(compact)) {
    return compact.length >= 4 &&
      fundIdentifiers(fund).some((identifier) => identifier.startsWith(compact))
      ? 90
      : -1;
  }
  const name = normalizeFundSearch(fund.name);
  const tokens = term.split(' ');
  if (name === term) return 100;
  if (name.startsWith(term)) return 80;
  if (name.includes(term)) return 70;
  if (tokens.every((token) => name.includes(token))) return 60;
  const withCompany = `${name} ${normalizeFundSearch(fund.company)}`;
  return tokens.every((token) => withCompany.includes(token)) ? 40 : -1;
}

function differsByAtMostOneEdit(candidate: string, wanted: string) {
  if (candidate === wanted) return true;
  if (candidate.length < 5 || wanted.length < 5) return false;
  if (Math.abs(candidate.length - wanted.length) > 1) return false;

  if (candidate.length === wanted.length) {
    const differences: number[] = [];
    for (let index = 0; index < candidate.length; index += 1) {
      if (candidate[index] !== wanted[index]) differences.push(index);
      if (differences.length > 2) return false;
    }
    if (differences.length <= 1) return true;
    const [first, second] = differences;
    return (
      second === first + 1 &&
      candidate[first] === wanted[second] &&
      candidate[second] === wanted[first]
    );
  }

  const [shorter, longer] =
    candidate.length < wanted.length
      ? [candidate, wanted]
      : [wanted, candidate];
  let shortIndex = 0;
  let longIndex = 0;
  let skipped = false;
  while (shortIndex < shorter.length && longIndex < longer.length) {
    if (shorter[shortIndex] === longer[longIndex]) {
      shortIndex += 1;
      longIndex += 1;
      continue;
    }
    if (skipped) return false;
    skipped = true;
    longIndex += 1;
  }
  return true;
}

/**
 * Offers conservative spelling suggestions without ever selecting a fund.
 * Every query word must match a complete fund/company word with at most one
 * edit, and short words must match exactly.
 */
export function suggestFiFunds(funds: FiFund[], query: string, limit = 5) {
  const term = searchTerm(query);
  if (term.length < 2 || searchFiFunds(funds, query, 1).length > 0) return [];
  const queryWords = term.split(' ').filter(Boolean);
  if (queryWords.length === 0) return [];

  return funds
    .map((fund) => {
      const words = normalizeFundSearch(`${fund.name} ${fund.company}`)
        .split(' ')
        .filter(Boolean);
      let edits = 0;
      const matches = queryWords.every((queryWord) => {
        if (words.includes(queryWord)) return true;
        const near = words.some((word) =>
          differsByAtMostOneEdit(word, queryWord),
        );
        if (near) edits += 1;
        return near;
      });
      return { fund, edits, matches };
    })
    .filter((item) => item.matches && item.edits > 0)
    .sort(
      (a, b) =>
        a.edits - b.edits ||
        a.fund.name.localeCompare(b.fund.name, 'sv-SE') ||
        a.fund.id.localeCompare(b.fund.id),
    )
    .slice(0, limit)
    .map((item) => item.fund);
}

export function matchesFiFund(fund: FiFund, query: string) {
  return matchScore(fund, query) >= 0;
}

export function searchFiFunds(
  funds: FiFund[],
  query: string,
  limit = Infinity,
) {
  return funds
    .map((fund) => ({ fund, score: matchScore(fund, query) }))
    .filter((item) => item.score >= 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.fund.name.localeCompare(b.fund.name, 'sv-SE') ||
        a.fund.id.localeCompare(b.fund.id),
    )
    .slice(0, limit)
    .map((item) => item.fund);
}

export function resolveFiFund(
  funds: FiFund[],
  query: string,
): FiFund | undefined {
  const matches = searchFiFunds(funds, query);
  const exact = matches.filter((fund) => isExactFiFundMatch(fund, query));
  if (exact.length === 1) return exact[0];
  return matches.length === 1 ? matches[0] : undefined;
}

export function fiFundToFund(fund: FiFund): Fund {
  return {
    source: 'fi',
    sourceId: fund.id,
    name: fund.name,
    category: `${fund.company} · Svensk värdepappersfond`,
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
