export const PPM_FUND_FACTS_BASE_URL =
  'https://www.pensionsmyndigheten.se/service/fondtorg/fond/';

export type ReferenceFund = {
  id: string;
  name: string;
  officialName: string;
  category: string;
  type: string;
  aliases: string[];
};

/**
 * A small, explicitly verified bridge for requested foreign-domiciled funds.
 * These are searchable fund-fact references, not FI holding records.
 */
export const REFERENCE_FUNDS: ReferenceFund[] = [
  {
    id: '661066',
    name: 'BGF Latin American A2',
    officialName: 'BlackRock - Latin American A2',
    category: 'Latinamerika',
    type: 'Aktiefond',
    aliases: ['BlackRock Latin American A2'],
  },
  {
    id: '374421',
    name: 'BGF World Healthscience A2',
    officialName: 'BlackRock - World Healthscience A2',
    category: 'Läkemedel och bioteknik',
    type: 'Aktiefond',
    aliases: ['BlackRock World Healthscience A2'],
  },
  {
    id: '517748',
    name: 'BGF World Energy A2',
    officialName: 'BlackRock - World Energy A2',
    category: 'Råvaror och energi',
    type: 'Aktiefond',
    aliases: ['BlackRock World Energy A2'],
  },
  {
    id: '419101',
    name: 'ODIN Emerging Markets C SEK',
    officialName: 'Odin Emerging Markets C',
    category: 'Nya marknader',
    type: 'Aktiefond',
    aliases: ['Odin Emerging Markets C'],
  },
];

function normalizeReferenceSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/ø/g, 'o')
    .replace(/æ/g, 'ae')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function searchableNames(fund: ReferenceFund) {
  return [fund.name, fund.officialName, ...fund.aliases].map((name) =>
    normalizeReferenceSearch(name),
  );
}

export function searchReferenceFunds(
  funds: ReferenceFund[],
  query: string,
): ReferenceFund[] {
  const term = normalizeReferenceSearch(query);
  const compact = term.replace(/ /g, '');
  if (term.length < 2) return [];

  return funds
    .map((fund) => {
      if (fund.id === compact) return { fund, score: 100 };
      const names = searchableNames(fund);
      if (names.includes(term)) return { fund, score: 100 };
      if (names.some((name) => name.startsWith(term)))
        return { fund, score: 80 };
      if (names.some((name) => name.includes(term))) return { fund, score: 70 };
      const words = term.split(' ').filter(Boolean);
      return names.some((name) => words.every((word) => name.includes(word)))
        ? { fund, score: 60 }
        : { fund, score: -1 };
    })
    .filter((item) => item.score >= 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.fund.name.localeCompare(b.fund.name, 'sv-SE') ||
        a.fund.id.localeCompare(b.fund.id),
    )
    .map((item) => item.fund);
}

export function resolveReferenceFund(funds: ReferenceFund[], query: string) {
  const term = normalizeReferenceSearch(query);
  const compact = term.replace(/ /g, '');
  const matches = searchReferenceFunds(funds, query);
  const exact = matches.filter(
    (fund) => fund.id === compact || searchableNames(fund).includes(term),
  );
  if (exact.length === 1) return exact[0];
  return matches.length === 1 ? matches[0] : undefined;
}

export function referenceFundUrl(fund: Pick<ReferenceFund, 'id'>) {
  return `${PPM_FUND_FACTS_BASE_URL}${fund.id}`;
}
