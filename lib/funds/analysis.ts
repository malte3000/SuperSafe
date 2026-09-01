import type { Fund } from './types';

export function getFundAnalysis(fund: Fund) {
  const totalWeight = fund.holdings.reduce((sum, holding) => sum + holding.weight, 0);
  const score = Math.round(
    fund.holdings.reduce(
      (sum, holding) => sum + holding.probability * holding.weight,
      0,
    ) / totalWeight,
  );
  const weightedConfidence = Math.round(
    fund.holdings.reduce(
      (sum, holding) => sum + holding.confidence * holding.weight,
      0,
    ) / totalWeight,
  );
  const riskDrivers = [...fund.holdings]
    .sort((a, b) => a.probability * a.weight - b.probability * b.weight)
    .slice(0, 3);

  return {
    score,
    lossRisk: 100 - score,
    weightedConfidence,
    riskDrivers,
  };
}
