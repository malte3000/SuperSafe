import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildWatchlists, parseWatchSource, watchCategoryKey } from '../lib/funds/watchlists.ts';

const date = '2026-09-02T12:00:00Z';
const now = new Date(date);
const funds = (fees, categoryId = 1, type = 'Aktiefonder') => fees.map((fee, i) => ({
  id: String(100000 + categoryId * 100 + i), name: `Fond ${i}`, categoryId,
  category: `Kategori ${categoryId}`, type, fee, status: null,
}));
const build = rows => buildWatchlists({ fetchedAt: date, funds: rows }, now);
const source = () => ({ numberOfHits: 100, totalNumberOfFunds: 100,
  fondLista: Array.from({ length: 100 }, (_, i) => ({ fondId: String(100000 + i),
    fondNamn: `Fond ${i}`, kategoriId: 1, fondKategoriNamn: 'Global', fondTypNamn: 'Aktiefonder',
    forvaltningsArvode: '0,25', subtitle: null })) });

test('odd and even category medians retain precision', () => {
  assert.equal(build(funds([0, .1, .2, .3, .4])).peers[0].median, .2);
  assert.ok(Math.abs(build(funds([0, .04, .08, .09, .3, .4])).peers[0].median - .085) < 1e-12);
});
test('requires five eligible peers and groups by category and type', () => {
  assert.equal(build(funds([0, .1, .2, .3])).eligibleFunds, 0);
  const rows = funds([0, .1, .2, .3, .4]);
  rows[0].status = 'Fonden går inte att välja';
  assert.equal(build(rows).eligibleFunds, 0);
  assert.equal(build([...funds([0, .1, .2], 1), ...funds([.3, .4], 2)]).eligibleFunds, 0);
  const separate = funds([0, .1, .2, .3, .4]);
  separate[0].type = 'Räntefonder';
  assert.equal(build(separate).eligibleFunds, 0);
});
test('both relative and absolute thresholds are required, including boundaries', () => {
  const result = build(funds([.15, .16, .2, .24, .25]));
  assert.deepEqual(result.watch.map(f => f.fee), [.15]);
  assert.deepEqual(result.review.map(f => f.fee), [.25]);
  assert.equal(build(funds([.07, .1, .1, .1, .13])).watch.length, 0);
  assert.equal(build(funds([.07, .1, .1, .1, .13])).review.length, 0);
  assert.equal(build(funds([.4, .5, .5, .5, .6])).watch.length, 0);
  assert.equal(build(funds([.4, .5, .5, .5, .6])).review.length, 0);
  assert.equal(build(funds([0, 0, 0, 0, .5])).review.length, 0);
});
test('unknown fees are not zero and unavailable funds are excluded', () => {
  const rows = funds([0, .1, .2, .3, .4, null, NaN, -1, 11]);
  assert.equal(build(rows).eligibleFunds, 5);
  assert.equal(build(rows).watch[0].fee, 0);
  assert.throws(() => build([...rows, rows[0]]), /Duplicate/);
});
test('parser requires complete, unique and valid source metadata', () => {
  assert.equal(parseWatchSource(source()).length, 100);
  const partial = source(); partial.totalNumberOfFunds++;
  assert.throws(() => parseWatchSource(partial), /Incomplete/);
  const duplicate = source(); duplicate.fondLista[1].fondId = duplicate.fondLista[0].fondId;
  assert.throws(() => parseWatchSource(duplicate), /metadata/);
  const missing = source(); delete missing.fondLista[0].subtitle;
  assert.throws(() => parseWatchSource(missing), /metadata/);
  const malformed = source(); malformed.fondLista[0].fondId = 'invalid';
  assert.throws(() => parseWatchSource(malformed), /metadata/);
});
test('parser preserves explicit zero but rejects missing or invalid fees', () => {
  const data = source();
  ['', null, '0', '0,15', 'NaN', '-1', '11'].forEach((fee, i) => data.fondLista[i].forvaltningsArvode = fee);
  assert.deepEqual(parseWatchSource(data).slice(0, 7).map(f => f.fee), [null, null, 0, .15, null, null, null]);
});
test('caps ten per list and two per category with stable order and no overlap', () => {
  const rows = Array.from({ length: 8 }, (_, i) => funds([0, .01, .02, .2, .2, .2, .5, .6, .7], i + 1)).flat();
  const result = build(rows);
  assert.equal(result.watch.length, 10); assert.equal(result.review.length, 10);
  for (const list of [result.watch, result.review]) {
    const counts = new Map();
    for (const fund of list) counts.set(watchCategoryKey(fund), (counts.get(watchCategoryKey(fund)) ?? 0) + 1);
    assert.ok([...counts.values()].every(count => count <= 2));
  }
  assert.deepEqual(result.watch.map(f => f.id), build([...rows].reverse()).watch.map(f => f.id));
  assert.ok(result.watch.every(f => !result.review.some(other => f.id === other.id)));
});
test('stale, future and invalid timestamps suppress lists', () => {
  for (const fetchedAt of ['invalid', '2026-09-03T00:00:00Z', '2026-08-26T11:59:59Z']) {
    const result = buildWatchlists({ fetchedAt, funds: funds([0, .1, .2, .3, .4]) }, now);
    assert.equal(result.expired, true); assert.equal(result.peers.length, 0);
  }
  assert.equal(buildWatchlists({ fetchedAt: '2026-08-26T12:00:00Z', funds: [] }, now).expired, false);
});
test('verified baseline produces transparent qualifying lists without unavailable funds', () => {
  const baseline = JSON.parse(readFileSync(new URL('../lib/funds/watchlist-baseline.json', import.meta.url), 'utf8'));
  const result = buildWatchlists(baseline, new Date(baseline.fetchedAt));
  assert.equal(result.totalFunds, 381); assert.equal(result.eligibleFunds, 338);
  assert.equal(result.watch.length, 10); assert.equal(result.review.length, 10);
  assert.ok(result.peers.every(f => f.status === null && f.peerCount >= 5));
  assert.ok(result.watch.every(f => f.fee <= f.median * .75 + 1e-9 && f.difference <= -.05 + 1e-9));
  assert.ok(result.review.every(f => f.fee >= f.median * 1.25 - 1e-9 && f.difference >= .05 - 1e-9));
});
