import test from 'node:test';
import assert from 'node:assert/strict';
import { assertPpmUpdate, decodePpmCsv, parsePpmCsv, previousWeekday, rankPpmFunds } from '../lib/funds/ppm-ranking.ts';

const now = new Date('2026-09-02T12:00:00Z');
const header = '\uFEFFFondnr;Fondnamn;Köpkurs;Säljkurs;Kursdatum \r\n';
const row = '123456;"Test; fond ""A""";101;100,50;2026-08-31';
test('Windows-1252 decoding works in the Workers runtime without legacy TextDecoder', () => {
  assert.equal(decodePpmCsv(Uint8Array.from([197,196,214,229,228,246,128,150]).buffer), 'ÅÄÖåäö€–');
});
const snapshot = (date, values, fetchedAt = `${date}T12:00:00Z`) => ({
  fetchedAt,
  quotes: values.map((nav, i) => ({ id: String(100000 + i), name: `Testfond ${i}`, date, nav })),
});

test('CSV handles Swedish numbers, BOM, spaces, quoted delimiters and escaped quotes', () => {
  assert.deepEqual(parsePpmCsv(header + row, now), [{ id: '123456', name: 'Test; fond "A"', nav: 100.5, date: '2026-08-31' }]);
});
test('CSV rejects empty, malformed, duplicate, nonpositive and future quotes', () => {
  for (const csv of ['', header, header + row + '\n' + row,
    header + row.replace('100,50', '0'), header + row.replace('2026-08-31', '2026-09-03'),
    header + row.replace('2026-08-31', '2026-02-30'), header + '"unfinished']) {
    assert.throws(() => parsePpmCsv(csv, now));
  }
});
test('one day and same-day repeated fetches never produce a daily ranking', () => {
  const first = snapshot('2026-08-31', [100, 100, 100, 100, 100]);
  assert.equal(rankPpmFunds([first], now).status, 'waiting');
  const later = snapshot('2026-08-31', [110, 110, 110, 110, 110], '2026-09-01T12:00:00Z');
  assert.equal(rankPpmFunds([first, later], now).status, 'waiting');
});
test('Monday compares Friday, ranks numerically and shows only five', () => {
  assert.equal(previousWeekday('2026-08-31'), '2026-08-28');
  const result = rankPpmFunds([
    snapshot('2026-08-28', [100, 100, 100, 100, 100, 100]),
    snapshot('2026-08-31', [101, 112, 99, 103, 102, 100]),
  ], now);
  assert.equal(result.status, 'ready');
  assert.equal(result.comparedFunds, 6);
  assert.equal(result.previousDate, '2026-08-28');
  assert.deepEqual(result.funds.map(f => f.id), ['100001', '100003', '100004', '100000', '100005']);
  assert.ok(Math.abs(result.funds[0].changePercent - 12) < 1e-10);
});
test('missing weekdays and fewer than five pairs do not become top five', () => {
  const first = snapshot('2026-08-27', [100, 100, 100, 100, 100]);
  const last = snapshot('2026-08-31', [105, 106, 107, 108, 109]);
  assert.equal(rankPpmFunds([first, last], now).status, 'waiting');
  assert.equal(rankPpmFunds([snapshot('2026-08-28', [100, 100, 100, 100]), last], now).status, 'waiting');
});
test('negative changes retain their signs and newest corrections win', () => {
  const result = rankPpmFunds([
    snapshot('2026-08-28', [100, 100, 100, 100, 100]),
    snapshot('2026-08-31', [99, 98, 97, 96, 95]),
    snapshot('2026-08-31', [90, 98, 97, 96, 95], '2026-09-01T12:00:00Z'),
  ], now);
  assert.equal(result.funds[0].id, '100001');
  assert.ok(result.funds.every(f => f.changePercent < 0));
  assert.equal(result.funds[4].nav, 90);
});
test('old rankings are not presented as recent daily performance', () => {
  const result = rankPpmFunds([snapshot('2026-08-20', [100,100,100,100,100]), snapshot('2026-08-21', [101,102,103,104,105])], now);
  assert.equal(result.status, 'waiting');
  assert.equal(result.stale, true);
});

test('quality gates include exact 25 percent boundaries and exclude larger moves', () => {
  const result = rankPpmFunds([
    snapshot('2026-08-31', Array(8).fill(100)),
    snapshot('2026-09-01', [125, 75, 126, 74, 101, 102, 103, 104]),
  ], now);
  assert.equal(result.status, 'ready');
  assert.equal(result.comparedFunds, 6);
  assert.deepEqual(result.quality.excluded.map(f => f.id), ['100002', '100003']);
  assert.ok(result.quality.excluded.every(f => f.reason === 'large_change'));
  assert.equal(result.quality.matchedFunds, 8);
});

test('name changes are flagged, formatting changes are not, corrections restore eligibility', () => {
  const previous = snapshot('2026-08-31', Array(6).fill(100));
  const latest = snapshot('2026-09-01', Array(6).fill(101));
  latest.quotes[0].name = 'Testfond 0 B';
  latest.quotes[1].name = ' TESTFOND   1 ';
  const flagged = rankPpmFunds([previous, latest], now);
  assert.equal(flagged.comparedFunds, 5);
  assert.equal(flagged.quality.excluded[0].reason, 'identity_change');
  const corrected = structuredClone(latest);
  corrected.fetchedAt = now.toISOString(); corrected.quotes[0].name = previous.quotes[0].name;
  const restored = rankPpmFunds([previous, latest, corrected], now);
  assert.equal(restored.comparedFunds, 6);
  assert.deepEqual(restored.quality.excluded, []);
});

test('blocked latest comparison never resurrects older winners and reports missing pairs', () => {
  const latest = snapshot('2026-09-01', [150, 101, 102, 103, 104, 105]);
  const result = rankPpmFunds([
    snapshot('2026-08-28', Array(5).fill(100)),
    snapshot('2026-08-31', Array(5).fill(100)), latest,
  ], now);
  assert.equal(result.status, 'waiting');
  assert.equal(result.quality.date, '2026-09-01');
  assert.equal(result.quality.excluded.length, 1);
  assert.equal(result.quality.missingPrevious, 1);
  assert.deepEqual(result.funds, []);
});

test('updates require valid unique data and retain 80 percent of prior identities', () => {
  const previous = snapshot('2026-08-31', Array(125).fill(100));
  const next = snapshot('2026-09-01', Array(100).fill(101));
  assert.doesNotThrow(() => assertPpmUpdate(previous, next, now));
  const replaced = structuredClone(next); replaced.quotes[0].id = '999999';
  assert.throws(() => assertPpmUpdate(previous, replaced, now), { code: 'coverage_drop' });
  const backwards = structuredClone(next); backwards.quotes[0].date = '2026-08-28';
  assert.throws(() => assertPpmUpdate(previous, backwards, now), { code: 'date_regression' });
  for (const mutate of [v => v.quotes.pop(), v => v.quotes[0] = null,
    v => v.quotes[1].id = v.quotes[0].id, v => v.quotes[0].nav = Infinity,
    v => v.fetchedAt = previous.fetchedAt, v => v.fetchedAt = '2026-09-03T12:00:00Z']) {
    const invalid = structuredClone(next); mutate(invalid);
    assert.throws(() => assertPpmUpdate(previous, invalid, now), { code: 'invalid_data' });
  }
  const correction = structuredClone(next); correction.quotes.forEach(q => { q.date = '2026-08-31'; q.nav = 1000; });
  assert.doesNotThrow(() => assertPpmUpdate(previous, correction, now));
});

test('CSV rejects exponent, hexadecimal and signed numeric representations', () => {
  for (const value of ['1e2', '0x64', '+100', '-100']) assert.throws(() => parsePpmCsv(header + row.replace('100,50', value), now));
});
