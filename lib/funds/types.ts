export type HoldingDirection = 'positive' | 'neutral' | 'negative';

export type Holding = {
  name: string;
  ticker: string;
  weight: number;
  probability: number;
  confidence: number;
  direction: HoldingDirection;
  reason: string;
};

export type Fund = {
  name: string;
  category: string;
  riskClass: number;
  updated: string;
  holdings: Holding[];
};
