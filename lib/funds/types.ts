export type Holding = {
  name: string;
  ticker: string;
  weight: number;
  isin?: string;
  country?: string;
  currency?: string;
  assetClass?: string;
};

export type Fund = {
  source: 'fi';
  sourceId?: string;
  name: string;
  category: string;
  holdings: Holding[];
  isin?: string;
  company?: string;
  reportDate?: string;
  holdingsCount?: number;
  displayedWeight?: number;
  cashWeight?: number;
  topTenWeight?: number;
};
