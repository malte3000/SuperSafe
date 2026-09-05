import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { compareFunds, indexHoldings } from '../lib/funds/overlap.ts';

const A = 'SE0015811963';
const B = 'SE0017486889';
const C = 'SE0000115446';
const holding = (isin, weight, name = 'Testbolag') => ({ isin, weight, name });
const fund = (id, holdings, extra = {}) => ({ id, name: id, holdings, reportDate: '2026-06-30', holdingsCount: 100, ...extra });

test('weighted overlap is sum of minimum weights, never renormalized', () => {
  const result = compareFunds(fund('a', [holding(A, 8), holding(B, 10)]), fund('b', [holding(A, 5), holding(B, 20), holding(C, 30)]));
  assert.equal(result.status, 'ready');
  assert.equal(result.overlapWeight, 15);
  assert.equal(result.left.identifiedWeight, 18);
  assert.equal(result.right.identifiedWeight, 55);
  assert.deepEqual(result.shared.map(row => row.isin), [B, A]);
});
test('positions sharing an ISIN are aggregated before comparison', () => {
  const result = compareFunds(fund('a', [holding(A, 3), holding(A.toLowerCase(), 5)]), fund('b', [holding(A, 6)]));
  assert.equal(result.shared.length, 1);
  assert.equal(result.shared[0].leftWeight, 8);
  assert.equal(result.overlapWeight, 6);
});
test('same names and missing/invalid ISIN never create a false match', () => {
  const a = fund('a', [holding(A, 5), holding(null, 8), holding('INVALID', 3)]);
  const result = compareFunds(a, fund('b', [holding(B, 5), holding(null, 10)]));
  assert.equal(result.shared.length, 0);
  assert.equal(result.overlapWeight, 0);
  assert.equal(indexHoldings(a).excluded, 2);
});
test('same fund, mismatched dates and unsupported weights are blocked', () => {
  const a = fund('a', [holding(A, 5)]);
  assert.equal(compareFunds(a, a).status, 'same-fund');
  assert.equal(compareFunds(a, fund('b', [], { reportDate: '2026-03-31' })).status, 'different-dates');
  for (const weights of [[-5], [Infinity], [NaN], [101], [80, 30]]) {
    assert.equal(compareFunds(a, fund('b', weights.map(weight => holding(A, weight)))).status, 'unsupported-weights');
  }
});
test('empty holdings are valid but do not imply full coverage', () => {
  const result = compareFunds(fund('a', []), fund('b', [holding(A, 5)]));
  assert.equal(result.overlapWeight, 0);
  assert.equal(result.left.identifiedWeight, 0);
});
test('real FI example is comparable, symmetric and bounded by known coverage', async () => {
  const data = JSON.parse(await readFile(new URL('../public/data/fi-funds-latest.json', import.meta.url), 'utf8'));
  const a = data.funds.find(fund => fund.id === 'SE0001718388');
  const b = data.funds.find(fund => fund.id === 'SE0009773716');
  const result = compareFunds(a, b);
  assert.equal(result.status, 'ready');
  assert.ok(result.shared.length > 0);
  assert.ok(result.overlapWeight > 0);
  assert.ok(result.overlapWeight <= Math.min(result.left.identifiedWeight, result.right.identifiedWeight));
  assert.ok(Math.abs(result.overlapWeight - compareFunds(b, a).overlapWeight) < 1e-8);
  console.log(`FI example: ${result.shared.length} shared ISIN, ${result.overlapWeight.toFixed(2)}% known overlap`);
});
