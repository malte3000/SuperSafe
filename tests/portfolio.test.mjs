import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === './overlap' && context.parentURL?.endsWith('/portfolio.ts')) return next(new URL('./overlap.ts', context.parentURL).href, context);
    return next(specifier, context);
  },
});
const { analyzePortfolio, parseAllocation, equalAllocations } = await import('../lib/funds/portfolio.ts');
const A = 'SE0015811963';
const B = 'SE0017486889';
const C = 'SE0000115446';
const holding = (isin, weight, name = 'Testbolag') => ({ isin, weight, name });
const entry = (id, allocation, holdings, extra = {}) => ({ allocation, fund: { id, name: id, reportDate: '2026-06-30', holdings, ...extra } });
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

test('allocations accept Swedish or decimal notation as integer basis points', () => {
  for (const [text, expected] of [['50', 5000], [' 33,33 ', 3333], ['33.34', 3334], ['0,01', 1], ['100.00', 10000]]) assert.equal(parseAllocation(text), expected);
  for (const text of ['', ' ', '0', '-5', '+5', '100,01', '101', '1e2', '0x10', 'NaN', 'Infinity', '33,333', '50%', '1,2.3', '1 0', '50,']) assert.equal(parseAllocation(text), null, text);
});

test('equal distribution is explicit, deterministic and totals exactly 100%', () => {
  for (let count = 2; count <= 10; count++) {
    const allocations = equalAllocations(count);
    assert.equal(allocations.length, count);
    assert.equal(allocations.reduce((sum, value) => sum + parseAllocation(value), 0), 10000);
  }
  assert.deepEqual(equalAllocations(3), ['33,34', '33,33', '33,33']);
  for (const count of [0, 1, 11, 2.5, NaN]) assert.deepEqual(equalAllocations(count), []);
});

test('portfolio weights sum allocations times fund weights, not pairwise minimum overlap', () => {
  const result = analyzePortfolio([entry('a', '60', [holding(A, 10), holding(B, 30)]), entry('b', '40', [holding(A, 20), holding(C, 50)])]);
  assert.equal(result.status, 'ready');
  close(result.coverage, 52);
  close(result.unknownWeight, 48);
  close(result.topTenWeight, 52);
  assert.deepEqual(result.positions.map(row => row.isin), [C, B, A]);
  assert.equal(result.shared.length, 1);
  close(result.shared[0].weight, 14);
  assert.deepEqual(result.shared[0].contributors.map(row => row.portfolioWeight), [6, 8]);
  assert.deepEqual(result.funds.map(fund => fund.portfolioWeight), [24, 28]);
});

test('repeated ISIN within a fund is counted once before aggregation across funds', () => {
  const result = analyzePortfolio([entry('a', '50', [holding(A, 3), holding(` ${A.toLowerCase()} `, 5), holding(B, 10)]), entry('b', '50', [holding(A, 6)])]);
  assert.equal(result.status, 'ready');
  assert.equal(result.shared.length, 1);
  assert.equal(result.shared[0].contributors.length, 2);
  close(result.shared[0].weight, 7);
  close(result.coverage, 12);
});

test('same name, different share classes, invalid ISIN and zero weights do not make false overlaps', () => {
  const result = analyzePortfolio([entry('a', '50', [holding(A, 10), holding(null, 20), holding('invalid', 10), holding(C, 0)]), entry('b', '50', [holding(B, 10), holding(C, 10)])]);
  assert.equal(result.status, 'ready');
  assert.equal(result.shared.length, 0);
  close(result.coverage, 15);
  close(result.unknownWeight, 85);
});

test('totals below or above 100, missing values and malformed allocations have no stale results', () => {
  for (const [left, right, status] of [['50', '40', 'allocation-total'], ['60', '50', 'allocation-total'], ['', '100', 'invalid-allocation'], ['0', '100', 'invalid-allocation'], ['1e2', '50', 'invalid-allocation']]) {
    const result = analyzePortfolio([entry('a', left, [holding(A, 10)]), entry('b', right, [holding(A, 10)])]);
    assert.equal(result.status, status);
    assert.equal(result.positions, undefined);
    assert.equal(result.coverage, undefined);
  }
  const result = analyzePortfolio(['33,33', '33,33', '33,34'].map((allocation, i) => entry(String(i), allocation, [holding(A, 100)])));
  assert.equal(result.status, 'ready');
  close(result.coverage, 100);
});

test('requires two to ten unique funds, exact matching valid dates', () => {
  assert.equal(analyzePortfolio([]).status, 'choose-funds');
  assert.equal(analyzePortfolio([entry('a', '100', [])]).status, 'choose-funds');
  assert.equal(analyzePortfolio(Array.from({ length: 11 }, (_, i) => entry(String(i), '10', []))).status, 'too-many-funds');
  assert.equal(analyzePortfolio([entry('a', '50', []), entry('a', '50', [])]).status, 'duplicate-fund');
  assert.equal(analyzePortfolio([entry('a', '50', []), entry('b', '50', [], { reportDate: '2026-03-31' })]).status, 'different-dates');
  for (const reportDate of ['', '2026-02-30', '2026-6-30']) {
    assert.equal(analyzePortfolio([entry('a', '50', [], { reportDate }), entry('b', '50', [], { reportDate })]).status, 'invalid-date');
  }
});

test('negative, nonfinite, oversized and summed over-100 weights block aggregation even without ISIN', () => {
  for (const weights of [[-1], [NaN], [Infinity], [101], [80, 30], [50, 50.01]]) {
    const result = analyzePortfolio([entry('a', '50', []), entry('b', '50', weights.map(weight => holding(null, weight)))]);
    assert.equal(result.status, 'unsupported-weights');
    assert.equal(result.coverage, undefined);
  }
});

test('no available holdings means unknown coverage, not cash or full diversification', () => {
  const result = analyzePortfolio([entry('a', '50', []), entry('b', '50', [holding(null, 100)])]);
  assert.equal(result.status, 'ready');
  assert.equal(result.coverage, 0);
  assert.equal(result.unknownWeight, 100);
  assert.deepEqual(result.positions, []);
});

test('ten largest is a bounded subset and recurrence requires two distinct funds', () => {
  const positions = Array.from({ length: 12 }, (_, i) => holding(`SE${String(i).padStart(10, '0')}`, 5));
  const result = analyzePortfolio([entry('a', '50', positions), entry('b', '50', [])]);
  assert.equal(result.status, 'ready');
  assert.equal(result.positions.length, 12);
  close(result.coverage, 30);
  close(result.topTenWeight, 25);
  assert.equal(result.shared.length, 0);
});

test('real FI portfolio is deterministic, bounded, additive and does not mutate its input', async () => {
  const dataset = JSON.parse(await readFile(new URL('../public/data/fi-funds-latest.json', import.meta.url), 'utf8'));
  const entries = ['SE0001718388', 'SE0009773716'].map(id => ({ fund: dataset.funds.find(fund => fund.id === id), allocation: '50' }));
  const original = JSON.stringify(entries);
  const result = analyzePortfolio(entries);
  const reversed = analyzePortfolio([...entries].reverse());
  assert.equal(result.status, 'ready');
  assert.equal(result.reportDate, '2026-06-30');
  assert.ok(result.shared.length > 0);
  assert.ok(result.coverage > 0 && result.coverage <= 100);
  close(result.coverage + result.unknownWeight, 100);
  close(result.coverage, result.funds.reduce((sum, fund) => sum + fund.portfolioWeight, 0));
  assert.ok(result.topTenWeight <= result.coverage);
  assert.deepEqual(result.positions.map(row => [row.isin, row.weight]), reversed.positions.map(row => [row.isin, row.weight]));
  assert.equal(JSON.stringify(entries), original);
});
