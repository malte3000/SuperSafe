export type HoldingDirection = 'positive' | 'neutral' | 'negative';

export type Holding = {
  name: string;
  ticker: string;
  weight: number;
  probability?: number;
  confidence?: number;
  direction?: HoldingDirection;
  reason?: string;
  isin?: string;
  country?: string;
  currency?: string;
  assetClass?: string;
};

export type Fund = {
  source: 'demo' | 'fi';
  name: string;
  category: string;
  riskClass: number;
  updated: string;
  holdings: Holding[];
  isin?: string;
  company?: string;
  reportDate?: string;
  holdingsCount?: number;
  displayedWeight?: number;
  cashWeight?: number;
  topTenWeight?: number;
};
