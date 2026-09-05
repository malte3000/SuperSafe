import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizeFundSearch, matchesFiFund, isExactFiFundMatch, searchFiFunds, resolveFiFund } from '../lib/funds/fi-funds.ts';

const funds = [
  { id: 'global', name: 'Länsförsäkringar Global Index', company: 'Länsförsäkringar Fondförvaltning AB', isin: 'SE0005188836' },
  { id: 'vision', name: 'Länsförsäkringar Global Vision', company: 'Länsförsäkringar Fondförvaltning AB', isin: 'SE0000837205' },
  { id: 'zero', name: 'Avanza Zero', company: 'Avanza Fonder AB', isin: 'SE0001718388' },
  { id: 'alfred', name: 'Alfred Berg Sverige', company: 'Alfred Berg', isin: null },
];

test('accents, decomposed Unicode, repeated spaces and punctuation normalize', () => {
  assert.equal(normalizeFundSearch('  LÄNSFÖRSÄKRINGAR  Global–Index '), 'lansforsakringar global index');
  assert.equal(normalizeFundSearch('La\u0308nsfo\u0308rsa\u0308kringar'), 'lansforsakringar');
  for (const query of ['lansforsakringar global index', '  LÄNSFÖRSÄKRINGAR   GLOBAL INDEX', 'Index, Global Länsförsäkringar']) {
    assert.equal(searchFiFunds(funds, query)[0].id, 'global');
  }
});
test('LF expands only as a whole word and works in either word order', () => {
  for (const query of ['LF Global', 'global lf', 'lf-global']) {
    assert.deepEqual(searchFiFunds(funds, query).map(f => f.id), ['global', 'vision']);
  }
  assert.deepEqual(searchFiFunds(funds, 'Alfred').map(f => f.id), ['alfred']);
});
test('ISIN can contain formatting spaces and hyphens, without fuzzy code matching', () => {
  assert.equal(resolveFiFund(funds, 'se 0005-188836').id, 'global');
  assert.equal(isExactFiFundMatch(funds[0], 'SE0005188836'), true);
  assert.deepEqual(searchFiFunds(funds, 'SE000518').map(f => f.id), ['global']);
  assert.deepEqual(searchFiFunds(funds, 'SE0005188837'), []);
});
test('blank or one-letter queries and missing funds do not pick a fund', () => {
  for (const query of ['', ' ', '---', 'a', 'Spiltan Aktiefond Investmentbolag']) {
    assert.deepEqual(searchFiFunds(funds, query), []);
    assert.equal(resolveFiFund(funds, query), undefined);
  }
});
test('ambiguous searches require selection while unique or exact searches resolve', () => {
  assert.equal(resolveFiFund(funds, 'global'), undefined);
  assert.equal(resolveFiFund(funds, 'LF Global Index').id, 'global');
  assert.equal(resolveFiFund(funds, 'zero').id, 'zero');
  assert.equal(resolveFiFund([...funds, { ...funds[0], id: 'duplicate-class' }], funds[0].name), undefined);
});
test('exact names precede partial names and results are not silently limited', () => {
  const items = Array.from({ length: 20 }, (_, i) => ({ id: String(i), name: `Avanza Fond ${i}`, company: 'Avanza Fonder', isin: null }));
  items.push({ id: 'exact', name: 'Avanza', company: 'Avanza Fonder', isin: null });
  assert.equal(searchFiFunds(items, 'avanza').length, 21);
  assert.equal(searchFiFunds(items, 'avanza')[0].id, 'exact');
  assert.equal(searchFiFunds(items, 'avanza', 6).length, 6);
});
test('main search and comparison filter agree on real FI funds', async () => {
  const { funds: real } = JSON.parse(await readFile(new URL('../public/data/fi-funds-latest.json', import.meta.url), 'utf8'));
  for (const query of ['LF Global', 'global lansforsakringar', 'avanza', 'SE 0005-188836', 'DNB Global Indeks']) {
    const main = searchFiFunds(real, query).map(f => f.id).sort();
    const comparison = real.filter(f => matchesFiFund(f, query)).map(f => f.id).sort();
    assert.deepEqual(main, comparison);
  }
  assert.equal(searchFiFunds(real, 'LF Global').length, 3);
  assert.ok(searchFiFunds(real, 'avanza').length > 6);
  assert.ok(searchFiFunds(real, 'global index lf').some(f => f.id === 'SE0005188836'));
});
