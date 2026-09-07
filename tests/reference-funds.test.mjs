import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REFERENCE_FUNDS,
  referenceFundUrl,
  resolveReferenceFund,
  searchReferenceFunds,
} from '../lib/funds/reference-funds.ts';

test('all requested foreign funds are available by their common names', () => {
  for (const query of [
    'BGF Latin American A2',
    'BGF World Healthscience A2',
    'BGF World Energy A2',
    'ODIN Emerging Markets C SEK',
  ]) {
    assert.equal(resolveReferenceFund(REFERENCE_FUNDS, query)?.name, query);
  }
});

test('official BlackRock names, BGF abbreviation and PPM numbers work', () => {
  assert.equal(
    resolveReferenceFund(REFERENCE_FUNDS, 'BlackRock World Healthscience A2')
      ?.id,
    '374421',
  );
  assert.deepEqual(
    searchReferenceFunds(REFERENCE_FUNDS, 'BGF').map((fund) => fund.id),
    ['661066', '517748', '374421'],
  );
  assert.equal(
    resolveReferenceFund(REFERENCE_FUNDS, '419101')?.name,
    'ODIN Emerging Markets C SEK',
  );
});

test('reference links use official Pensionsmyndigheten fund facts', () => {
  assert.equal(
    referenceFundUrl(REFERENCE_FUNDS[0]),
    'https://www.pensionsmyndigheten.se/service/fondtorg/fond/661066',
  );
});

test('reference funds expose dated, attributed holdings without overstating coverage', () => {
  for (const fund of REFERENCE_FUNDS) {
    assert.match(fund.portfolio.asOf, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(fund.portfolio.sourceUrl, /^https:\/\//);
    assert.ok(fund.portfolio.holdings.length > 0);
    assert.ok(
      fund.portfolio.holdings.every(
        (holding) => holding.name && holding.weight > 0 && holding.weight <= 100,
      ),
    );
  }

  const odin = resolveReferenceFund(
    REFERENCE_FUNDS,
    'ODIN Emerging Markets C SEK',
  );
  assert.equal(odin?.portfolio.scope, 'complete-equities');
  assert.equal(odin?.portfolio.holdings.length, 41);

  const health = resolveReferenceFund(
    REFERENCE_FUNDS,
    'BGF World Healthscience A2',
  );
  assert.equal(health?.portfolio.scope, 'top-ten');
  assert.equal(health?.portfolio.reportedHoldingsCount, 90);
  assert.equal(health?.portfolio.holdings.length, 10);
});
