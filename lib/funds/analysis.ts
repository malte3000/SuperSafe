import type { FiFund } from './fi-funds';

/** Descriptive holdings metrics only. None of these values predicts return or total risk. */
export function getFundAnalysis(fund: FiFund) {
  return {
    topTenWeight: fund.topTenWeight,
    largestHoldingWeight: fund.holdings[0]?.weight ?? 0,
    displayedWeight: fund.displayedWeight,
    largestHoldings: fund.holdings.slice(0, 3),
  };
}
