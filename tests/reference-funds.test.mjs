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
