import type { FiFund } from './fi-funds';

export type SharedHolding = { isin: string; name: string; leftWeight: number; rightWeight: number; sharedWeight: number };

export function indexHoldings(fund: FiFund) {
  const positions = new Map<string, { name: string; weight: number }>();
  let excluded = 0;
  let validWeights = true;
  let totalWeight = 0;
  for (const holding of fund.holdings) {
    if (!Number.isFinite(holding.weight) || holding.weight < 0 || holding.weight > 100) {
      validWeights = false;
      continue;
    }
    totalWeight += holding.weight;
    const isin = holding.isin?.trim().toUpperCase();
    if (!isin || !/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(isin)) { excluded++; continue; }
    if (holding.weight === 0) continue;
    const existing = positions.get(isin);
    positions.set(isin, { name: existing?.name ?? holding.name, weight: (existing?.weight ?? 0) + holding.weight });
  }
  return {
    positions, excluded, validWeights: validWeights && totalWeight <= 100.1,
    identifiedWeight: [...positions.values()].reduce((sum, holding) => sum + holding.weight, 0),
  };
}

export function compareFunds(left: FiFund, right: FiFund) {
  const a = indexHoldings(left);
  const b = indexHoldings(right);
  const status = left.id === right.id ? 'same-fund'
    : left.reportDate !== right.reportDate ? 'different-dates'
    : !a.validWeights || !b.validWeights ? 'unsupported-weights' : 'ready';
  const shared: SharedHolding[] = [];
  if (status === 'ready') {
    for (const [isin, holding] of a.positions) {
      const other = b.positions.get(isin);
      if (other) shared.push({ isin, name: holding.name, leftWeight: holding.weight, rightWeight: other.weight, sharedWeight: Math.min(holding.weight, other.weight) });
    }
    shared.sort((x, y) => y.sharedWeight - x.sharedWeight || x.isin.localeCompare(y.isin));
  }
  return { status, left: a, right: b, shared, overlapWeight: shared.reduce((sum, holding) => sum + holding.sharedWeight, 0) };
}
