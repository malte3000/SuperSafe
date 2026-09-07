export const PPM_FUND_FACTS_BASE_URL =
  'https://www.pensionsmyndigheten.se/service/fondtorg/fond/';

export type ReferenceFund = {
  id: string;
  name: string;
  officialName: string;
  category: string;
  type: string;
  aliases: string[];
  portfolio: ReferenceFundPortfolio;
};

export type ReferenceFundHolding = {
  name: string;
  weight: number;
  country?: string;
  currency?: string;
};

export type ReferenceFundPortfolio = {
  asOf: string;
  fetchedAt: string;
  sourceName: string;
  sourceUrl: string;
  scope: 'top-ten' | 'complete-equities';
  reportedHoldingsCount?: number;
  holdings: ReferenceFundHolding[];
};

const fetchedAt = '2026-09-07T18:02:17.112Z';

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
    portfolio: {
      asOf: '2026-07-31',
      fetchedAt,
      sourceName: 'BlackRock',
      sourceUrl:
        'https://www.blackrock.com/se/individual/products/229286/blackrock-latin-american-a2-usd-fund',
      scope: 'top-ten',
      reportedHoldingsCount: 41,
      holdings: [
        { name: 'Grupo Financiero Banorte SAB de CV', weight: 7.7 },
        { name: 'Wal Mart de Mexico SAB de CV', weight: 5.87 },
        { name: 'Vale SA', weight: 5.78 },
        { name: 'Petroleo Brasileiro SA Petrobras', weight: 5.6 },
        { name: 'Nu Holdings Ltd', weight: 5.32 },
        { name: 'Southern Copper Corp', weight: 5.23 },
        { name: 'XP Inc', weight: 4.38 },
        { name: 'Itau Unibanco Holding SA', weight: 4.38 },
        { name: 'Klabin SA', weight: 4.34 },
        { name: 'Localiza Rent a Car SA', weight: 3.43 },
      ],
    },
  },
  {
    id: '374421',
    name: 'BGF World Healthscience A2',
    officialName: 'BlackRock - World Healthscience A2',
    category: 'Läkemedel och bioteknik',
    type: 'Aktiefond',
    aliases: ['BlackRock World Healthscience A2'],
    portfolio: {
      asOf: '2026-07-31',
      fetchedAt,
      sourceName: 'BlackRock',
      sourceUrl:
        'https://www.blackrock.com/se/individual/products/229338/blackrock-world-healthscience-fund',
      scope: 'top-ten',
      reportedHoldingsCount: 90,
      holdings: [
        { name: 'Eli Lilly', weight: 9.66 },
        { name: 'Johnson & Johnson', weight: 8.48 },
        { name: 'AbbVie Inc', weight: 6.06 },
        { name: 'Merck & Co Inc', weight: 5.25 },
        { name: 'UnitedHealth Group Inc', weight: 4.89 },
        { name: 'Roche PS PAR AG', weight: 4.75 },
        { name: 'Novartis AG', weight: 4.52 },
        { name: 'AstraZeneca PLC', weight: 4.41 },
        { name: 'Thermo Fisher Scientific Inc', weight: 3.58 },
        { name: 'Gilead Sciences Inc', weight: 3.49 },
      ],
    },
  },
  {
    id: '517748',
    name: 'BGF World Energy A2',
    officialName: 'BlackRock - World Energy A2',
    category: 'Råvaror och energi',
    type: 'Aktiefond',
    aliases: ['BlackRock World Energy A2'],
    portfolio: {
      asOf: '2026-07-31',
      fetchedAt,
      sourceName: 'BlackRock',
      sourceUrl:
        'https://www.blackrock.com/se/individual/products/229918/blackrock-world-energy-fund',
      scope: 'top-ten',
      reportedHoldingsCount: 31,
      holdings: [
        { name: 'Shell PLC', weight: 9.29 },
        { name: 'Chevron Corp', weight: 8.97 },
        { name: 'TotalEnergies SE', weight: 8.85 },
        { name: 'ExxonMobil Holdings Corp', weight: 8.69 },
        { name: 'Valero Energy Corporation', weight: 4.82 },
        { name: 'Marathon Petroleum Corp', weight: 4.82 },
        { name: 'Suncor Energy Inc (Canada)', weight: 4.66 },
        { name: 'Canadian Natural Resources Ltd', weight: 4.61 },
        { name: 'TC Energy Corp', weight: 4.48 },
        { name: 'Targa Resources Corp', weight: 4.43 },
      ],
    },
  },
  {
    id: '419101',
    name: 'ODIN Emerging Markets C SEK',
    officialName: 'Odin Emerging Markets C',
    category: 'Nya marknader',
    type: 'Aktiefond',
    aliases: ['Odin Emerging Markets C'],
    portfolio: {
      asOf: '2026-07-31',
      fetchedAt,
      sourceName: 'ODIN Fonder',
      sourceUrl: 'https://odinfonder.se/fond/odin-emerging-markets-c-sek/',
      scope: 'complete-equities',
      reportedHoldingsCount: 42,
      holdings: [
        {
          name: 'Samsung Electronics Co Pref',
          country: 'Sydkorea',
          currency: 'KRW',
          weight: 9.15,
        },
        {
          name: 'SK Square',
          country: 'Sydkorea',
          currency: 'KRW',
          weight: 5.49,
        },
        {
          name: 'Taiwan Semiconductor ADR',
          country: 'Taiwan',
          currency: 'USD',
          weight: 4.72,
        },
        {
          name: 'Taiwan Semiconductor MFG',
          country: 'Taiwan',
          currency: 'TWD',
          weight: 4.7,
        },
        {
          name: 'Naspers N',
          country: 'Sydafrika',
          currency: 'ZAR',
          weight: 4.33,
        },
        {
          name: 'Chroma Ate INC',
          country: 'Taiwan',
          currency: 'TWD',
          weight: 3.7,
        },
        {
          name: 'ASPEED Tehnology',
          country: 'Taiwan',
          currency: 'TWD',
          weight: 3.59,
        },
        {
          name: 'ICTSI Intl Container',
          country: 'Filippinerna',
          currency: 'PHP',
          weight: 3.36,
        },
        {
          name: 'Sinbon Electronics Co.',
          country: 'Taiwan',
          currency: 'TWD',
          weight: 3.19,
        },
        { name: 'Alibaba', country: 'Kina', currency: 'HKD', weight: 2.97 },
        {
          name: 'Amphenol Corp',
          country: 'USA',
          currency: 'USD',
          weight: 2.74,
        },
        {
          name: 'Vitrox Corp',
          country: 'Malaysia',
          currency: 'MYR',
          weight: 2.48,
        },
        {
          name: 'Asia Commercial Joint Stock Bank',
          country: 'Vietnam',
          currency: 'VND',
          weight: 2.28,
        },
        {
          name: 'Capitec Bank Holdings',
          country: 'Sydafrika',
          currency: 'ZAR',
          weight: 2.23,
        },
        {
          name: 'Contemporary Amperex Tech',
          country: 'Kina',
          currency: 'CNY',
          weight: 2.17,
        },
        {
          name: 'Bidvest',
          country: 'Sydafrika',
          currency: 'ZAR',
          weight: 2.13,
        },
        {
          name: 'C Sun Mfg. Ltd',
          country: 'Taiwan',
          currency: 'TWD',
          weight: 2.11,
        },
        {
          name: 'Vijaya Diagnostic Centre',
          country: 'Indien',
          currency: 'INR',
          weight: 2.11,
        },
        {
          name: 'GPS Participacoes e Empreendimentos SA Ordinary Sh',
          country: 'Brasilien',
          currency: 'BRL',
          weight: 2.07,
        },
        {
          name: 'Garware Technical Fibres',
          country: 'Indien',
          currency: 'INR',
          weight: 2.05,
        },
        {
          name: 'Ping An Insurance H',
          country: 'Kina',
          currency: 'HKD',
          weight: 2.02,
        },
        { name: 'MCB Group', country: 'Mauritius', currency: 'MUR', weight: 2 },
        {
          name: 'King Yuan Electronics Co',
          country: 'Taiwan',
          currency: 'TWD',
          weight: 1.96,
        },
        {
          name: 'HDFC Bank - ADR',
          country: 'Indien',
          currency: 'USD',
          weight: 1.87,
        },
        {
          name: 'MercadoLibre, Inc.',
          country: 'Brasilien',
          currency: 'USD',
          weight: 1.87,
        },
        {
          name: 'Dino Polska',
          country: 'Polen',
          currency: 'PLN',
          weight: 1.82,
        },
        {
          name: 'Corp.Moctezuma',
          country: 'Mexiko',
          currency: 'MXN',
          weight: 1.7,
        },
        {
          name: 'Bid Corp',
          country: 'Sydafrika',
          currency: 'ZAR',
          weight: 1.65,
        },
        {
          name: 'HD Hyundai Marine Solution Co Ltd',
          country: 'Sydkorea',
          currency: 'KRW',
          weight: 1.65,
        },
        {
          name: 'Full Truck Alliance Co Ltd ADR',
          country: 'Kina',
          currency: 'USD',
          weight: 1.62,
        },
        {
          name: 'Digiworld',
          country: 'Vietnam',
          currency: 'VND',
          weight: 1.61,
        },
        {
          name: 'Trip.com Group',
          country: 'Kina',
          currency: 'HKD',
          weight: 1.6,
        },
        { name: 'Crisil', country: 'Indien', currency: 'INR', weight: 1.56 },
        {
          name: 'Travelsky Technology H',
          country: 'Kina',
          currency: 'HKD',
          weight: 1.41,
        },
        {
          name: 'Mold-Tek Packaging',
          country: 'Indien',
          currency: 'INR',
          weight: 1.32,
        },
        { name: 'Alicorp', country: 'Peru', currency: 'PEN', weight: 1.25 },
        {
          name: 'Metrodata Electronics PT',
          country: 'Indonesien',
          currency: 'IDR',
          weight: 1.11,
        },
        {
          name: 'Teleperformance',
          country: 'Frankrike',
          currency: 'EUR',
          weight: 1.07,
        },
        {
          name: 'Avia Avian PT',
          country: 'Indonesien',
          currency: 'IDR',
          weight: 0.92,
        },
        {
          name: 'Wonderla Holidays Ltd',
          country: 'Indien',
          currency: 'INR',
          weight: 0.85,
        },
        {
          name: 'Humanica Public Company',
          country: 'Thailand',
          currency: 'THB',
          weight: 0.51,
        },
      ],
    },
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
