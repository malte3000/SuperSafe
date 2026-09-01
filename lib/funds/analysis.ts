import type { Fund } from './types';

export function getFundAnalysis(fund: Fund) {
  if (fund.source === 'fi') {
    const topTenWeight = fund.topTenWeight ?? 0;
    const largestWeight = fund.holdings[0]?.weight ?? 0;
    const concentration =
      topTenWeight >= 60 || largestWeight >= 15
        ? 'high'
        : topTenWeight >= 40 || largestWeight >= 10
          ? 'medium'
          : 'low';

    return {
      score: topTenWeight,
      lossRisk: largestWeight,
      weightedConfidence: fund.displayedWeight ?? 0,
      riskDrivers: fund.holdings.slice(0, 3),
      concentration,
    } as const;
  }

  const totalWeight = fund.holdings.reduce((sum, holding) => sum + holding.weight, 0);
  const score = Math.round(
    fund.holdings.reduce(
      (sum, holding) => sum + (holding.probability ?? 0) * holding.weight,
      0,
    ) / totalWeight,
  );
  const weightedConfidence = Math.round(
    fund.holdings.reduce(
      (sum, holding) => sum + (holding.confidence ?? 0) * holding.weight,
      0,
    ) / totalWeight,
  );
  const riskDrivers = [...fund.holdings]
    .sort(
      (a, b) =>
        (a.probability ?? 0) * a.weight - (b.probability ?? 0) * b.weight,
    )
    .slice(0, 3);

  return {
    score,
    lossRisk: 100 - score,
    weightedConfidence,
    riskDrivers,
    concentration: 'signal' as const,
  };
}
