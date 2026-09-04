import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith('./') && context.parentURL?.endsWith('.ts')) return next(new URL(`${specifier}.ts`, context.parentURL).href, context);
    return next(specifier, context);
  },
});
const { explainFund, explainComparison, explainPortfolio } = await import('../lib/funds/explanations.ts');
const { compareFunds } = await import('../lib/funds/overlap.ts');
const { analyzePortfolio } = await import('../lib/funds/portfolio.ts');
const A = 'SE0015811963';
const B = 'SE0017486889';
const holding = (isin, weight, name = 'Testbolaget') => ({ isin, weight, name });
const fund = (id, holdings, reportDate = '2026-06-30') => ({ id, name: `Fond ${id}`, holdings, reportDate });

test('single-fund explanation turns weights into examples without calling them performance', () => {
  const explanation = explainFund(fund('a', [holding(A, 9.23), holding(B, 50, 'Andra bolaget')]));
  assert.equal(explanation.items.length, 3);
  assert.match(explanation.context, /30 juni 2026/);
  assert.match(explanation.items[0].text, /50 kr.*Andra bolaget/);
  assert.match(explanation.items[0].text, /inte hur mycket det har stigit/);
  assert.match(explanation.items[2].text, /40,77 kr/);
  assert.match(explanation.limitation, /inte uppgång, nedgång eller framtida avkastning/);
});

test('comparison explains min-weight overlap and known coverage separately', () => {
  const result = compareFunds(fund('a', [holding(A, 8), holding(B, 12)]), fund('b', [holding(A, 5)]));
  const explanation = explainComparison(result, '2026-06-30');
  assert.match(explanation.items[0].text, /5 kr i var och en/);
  assert.match(explanation.items[1].text, /8 kr.*5 kr.*5 kr/);
  assert.match(explanation.items[2].text, /20 kr.*fond 1.*5 kr.*fond 2/);
});

test('zero overlap is cautious and never presented as proof of diversification', () => {
  const result = compareFunds(fund('a', [holding(A, 10)]), fund('b', [holding(B, 10)]));
  const explanation = explainComparison(result, '2026-06-30');
  assert.equal(explanation.items[0].title, 'Ingen gemensam del hittad');
  assert.match(explanation.items[0].text, /bevisar inte.*riskspridning/);
});

test('portfolio explanation uses portfolio-weighted positions and flags repetition', () => {
  const result = analyzePortfolio([
    { fund: fund('a', [holding(A, 10)]), allocation: '60' },
    { fund: fund('b', [holding(A, 20), holding(B, 50, 'Andra bolaget')]), allocation: '40' },
  ]);
  const explanation = explainPortfolio(result);
  assert.match(explanation.items[0].text, /20 kr.*Andra bolaget.*1 av dina valda fonder/);
  assert.match(explanation.items[1].text, /1 värdepapper/);
  assert.match(explanation.items[2].text, /66 kr/);
});

test('full and empty coverage remain distinct and neither invents risk', () => {
  const full = explainFund(fund('a', [holding(A, 100)]));
  assert.match(full.items[2].title, /Alla 100 kr/);
  assert.match(full.items[2].text, /säger inte att risken är låg/);
  const empty = explainFund(fund('b', []));
  assert.equal(empty.items.length, 2);
  assert.match(empty.items[0].text, /varken.*fördelade/);
  assert.match(empty.items[1].text, /100 kr/);
});

test('invalid, blocked or unfinished data never gets an explanation', () => {
  assert.equal(explainFund(null), null);
  assert.equal(explainFund(fund('a', [holding(A, -1)])), null);
  assert.equal(explainFund(fund('a', [holding(A, 10)], '2026-02-30')), null);
  assert.equal(explainComparison(null, '2026-06-30'), null);
  assert.equal(explainComparison(compareFunds(fund('a', []), fund('a', [])), '2026-06-30'), null);
  assert.equal(explainComparison(compareFunds(fund('a', []), fund('b', [])), ''), null);
  assert.equal(explainPortfolio(analyzePortfolio([])), null);
});

test('tiny positive weights are not rounded down to zero', () => {
  const explanation = explainFund(fund('a', [holding(A, 0.001)]));
  assert.match(explanation.items[0].text, /mindre än 0,01 kr/);
});
